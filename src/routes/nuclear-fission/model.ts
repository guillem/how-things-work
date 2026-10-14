/**
 * The physics behind the nuclear fission explainer: binding energies and the
 * energy of a split (AME2020 masses), the neutron chain as a branching
 * process, a homogenised four-factor model of a water-moderated core, point
 * kinetics with six groups of delayed neutrons, and decay heat.
 *
 * Every constant below names its source. Where a value is a design choice of
 * this page rather than data (the strength of the control rods, the size of
 * the core's leakage), the comment says so and the page states it.
 */
import { rng } from '#lib/draw/math.ts';
import { curve, nuclides } from './ame2020';

// ---------------------------------------------------------------------------
// Physical constants (CODATA 2018; exact in the 2019 SI where marked)
// ---------------------------------------------------------------------------

/** One MeV in joules (exact). */
export const MEV = 1.602176634e-13;
/** Avogadro constant, per mole (exact). */
export const AVOGADRO = 6.02214076e23;
/** Atomic mass unit in MeV (CODATA 2018). */
export const AMU_MEV = 931.49410242;

// ---------------------------------------------------------------------------
// Binding energy (AME2020)
// ---------------------------------------------------------------------------

export interface CurvePoint {
	A: number;
	Z: number;
	element: string;
	/** Binding energy per nucleon, MeV. */
	b: number;
}

/** The most tightly bound nucleus of each mass number, MeV per nucleon. */
export const bindingCurve: readonly CurvePoint[] = curve.map(([A, Z, element, keV]) => ({
	A,
	Z,
	element,
	b: keV / 1000
}));

export type NuclideKey = keyof typeof nuclides;

/** Binding energy per nucleon of a named nucleus, MeV. */
export const perNucleon = (key: NuclideKey) => nuclides[key].perNucleon / 1000;

/** The most tightly bound nucleus on the curve. */
export function peak(): CurvePoint {
	return bindingCurve.reduce((best, p) => (p.b > best.b ? p : best));
}

// ---------------------------------------------------------------------------
// The energy of a split
// ---------------------------------------------------------------------------

export interface Split {
	id: string;
	/** Light and heavy fragment, as they fly apart. */
	light: NuclideKey;
	heavy: NuclideKey;
	/** Prompt neutrons set free. */
	neutrons: number;
	/** The stable nuclei the fragments' beta decays end on. */
	lightEnd: NuclideKey;
	heavyEnd: NuclideKey;
}

/** Three of the many ways a uranium-236 nucleus (U-235 + n) can split. */
export const SPLITS: readonly Split[] = [
	{ id: 'bakr', light: 'Kr92', heavy: 'Ba141', neutrons: 3, lightEnd: 'Zr92', heavyEnd: 'Pr141' },
	{ id: 'xesr', light: 'Sr94', heavy: 'Xe140', neutrons: 2, lightEnd: 'Zr94', heavyEnd: 'Ce140' },
	{ id: 'csrb', light: 'Rb96', heavy: 'Cs137', neutrons: 3, lightEnd: 'Zr96', heavyEnd: 'Ba137' }
];

export const splitById = (id: string) => SPLITS.find((s) => s.id === id) ?? SPLITS[0];

const me = (key: NuclideKey) => nuclides[key].massExcess / 1000; // MeV

/**
 * Energy released at the moment of the split, MeV: the mass of U-235 and the
 * neutron minus the mass of the fragments and the free neutrons. Atomic mass
 * excesses can be used directly because the electrons balance (Z is conserved).
 */
export function promptQ(s: Split): number {
	return me('U235') + me('n') - me(s.light) - me(s.heavy) - s.neutrons * me('n');
}

/** As `promptQ`, once the fragments have beta-decayed to stable nuclei. */
export function totalQ(s: Split): number {
	return me('U235') + me('n') - me(s.lightEnd) - me(s.heavyEnd) - s.neutrons * me('n');
}

/** Share of the starting mass (U-235 + n) that turns into energy. */
export function massLost(s: Split): number {
	const start = nuclides.U235.A + 1 + (me('U235') + me('n')) / AMU_MEV; // in u
	return totalQ(s) / (start * AMU_MEV);
}

/**
 * How the energy of an average thermal fission of U-235 ends up, MeV, from
 * X.B. Ma et al., "Improved calculation of the energy release in neutron-induced
 * fission", Phys. Rev. C 88, 014605 (2013), tables 6–9 (arXiv:1212.6625). The
 * total is over all the ways the nucleus splits, weighted by how often each
 * happens; the antineutrinos escape; capture is the energy of the spare neutrons
 * absorbed in the core.
 */
export const FISSION_ENERGY = {
	/** Total from the masses, split to beta-stable products. */
	total: 193.79 + 9.06 + 0.35,
	/** Carried away by antineutrinos. */
	neutrinos: 9.06,
	/** Decays still to come at a given moment of operation. */
	pending: 0.35,
	/** Gained when the spare neutrons are captured. */
	capture: 8.57,
	/** Heat left in the reactor per fission. */
	heat: 202.36
} as const;

/** Heat per kilogram of U-235 split, J (using the heat per fission above). */
export const heatPerKgU235 = () => ((FISSION_ENERGY.heat * MEV * AVOGADRO) / 235.0439) * 1000;

/**
 * Heat of combustion of methane (natural gas): 890.71 kJ/mol (NIST Chemistry
 * WebBook, ΔcH°gas), molar mass 16.043 g/mol: J per kg.
 */
export const METHANE_J_PER_KG = (890.71e3 / 16.043) * 1000;

// ---------------------------------------------------------------------------
// Neutron data
// ---------------------------------------------------------------------------

/**
 * Thermal (2200 m/s) neutron constants of U-235 from the IAEA Neutron Standards
 * 2017 (A.D. Carlson et al., Nucl. Data Sheets 148, 143 (2018)), as listed in
 * table XLVI of the ENDF/B-VIII.1 paper (G.P.A. Nobre et al., arXiv:2511.03564):
 * fission and capture cross sections in barns, mean neutrons per fission.
 */
export const U235 = { fission: 587.3, capture: 99.5, nu: 2.425 } as const;

/**
 * 2200 m/s absorption cross sections (barns) and bound scattering cross sections
 * from V.F. Sears, "Neutron scattering lengths and cross sections", Neutron News
 * 3, 26 (1992), via the NIST Center for Neutron Research table.
 */
export const ABSORB = { U238: 2.68, H: 0.3326, O: 0.00019 } as const;
const SCATTER_BOUND = { H: 82.03, O: 4.232 } as const;

/** Natural uranium: 0.72% U-235 by atoms (same NIST table). */
export const NATURAL = 0.72;

/** Atom fraction of U-235 for an enrichment given in percent by weight. */
export function atomFraction(enrichmentPct: number): number {
	const w = enrichmentPct / 100;
	return w / 235.0439 / (w / 235.0439 + (1 - w) / 238.0508);
}

/**
 * η: neutrons released per thermal neutron absorbed in the fuel. Only U-235
 * fissions with slow neutrons; U-238 just captures.
 */
export function eta(enrichmentPct: number): number {
	const a = atomFraction(enrichmentPct);
	const absorbed = a * (U235.fission + U235.capture) + (1 - a) * ABSORB.U238;
	return (U235.nu * a * U235.fission) / absorbed;
}

/** Mean logarithmic energy loss per elastic collision with a nucleus of mass A. */
export function xi(A: number): number {
	if (A === 1) return 1;
	const alpha = ((A - 1) / (A + 1)) ** 2;
	return 1 + (alpha * Math.log(alpha)) / (1 - alpha);
}

/** Average number of collisions to slow a neutron from `from` to `to` (eV). */
export const collisions = (from: number, to: number, x: number) => Math.log(from / to) / x;

/** Energy of a fission neutron (eV, typical) and of a thermal one at 20 °C. */
export const FAST_EV = 2e6;
export const THERMAL_EV = 0.0253;

/** Free-atom scattering cross section, barns (σ_bound × (A / (A + 1))²). */
const freeScatter = (bound: number, A: number) => bound * (A / (A + 1)) ** 2;

/** ξ of water: each collision weighted by its scattering cross section. */
export function waterXi(): number {
	const sH = freeScatter(SCATTER_BOUND.H, 1);
	const sO = freeScatter(SCATTER_BOUND.O, 16);
	return (2 * sH * xi(1) + sO * xi(16)) / (2 * sH + sO);
}

/**
 * The fission cross section of U-235 for a fast (MeV) neutron is of the order
 * of 1 barn (evaluated libraries give about 1.2 b near 2 MeV), against 587 b
 * for a slow one. Used only for the round comparison the page quotes.
 */
export const U235_FAST_FISSION = 1;

// ---------------------------------------------------------------------------
// A water-moderated core: the four-factor formula
// ---------------------------------------------------------------------------

/**
 * A pressurized-water lattice, homogenised. Fuel: UO₂ pellets of 10.4 g/cm³
 * (95% of theoretical density) and 0.41 cm radius; water at 0.72 g/cm³ (about
 * 300 °C at 15.5 MPa); about 2 volumes of water per volume of fuel, typical of a
 * PWR. These are representative design values, not one particular reactor.
 */
export const LATTICE = {
	uo2Density: 10.4,
	pelletRadius: 0.41,
	waterDensity: 0.72,
	waterPerFuel: 2
} as const;

/** Fast-fission factor ε: extra neutrons from fast fission of U-238 (textbook value for LWR lattices). */
export const EPSILON = 1.03;
/** Share of neutrons that do not leak out of a large core (a design choice of this page). */
export const NON_LEAKAGE = 0.97;

/**
 * Effective resonance integral of U-238 in UO₂ rods, barns: Hellstrand's
 * correlation I = 4.45 + 26.6 √(S/M), with S/M the rod's surface-to-mass
 * ratio in cm²/g (as given in J.R. Lamarsh and A.J. Baratta, Introduction to
 * Nuclear Engineering, 3rd ed., ch. 6).
 */
export function resonanceIntegral(): number {
	const sm = 2 / (LATTICE.uo2Density * LATTICE.pelletRadius);
	return 4.45 + 26.6 * Math.sqrt(sm);
}

/** Integral worth shape of a control rod: share of its full effect at insertion x (0–1). */
export const rodShape = (x: number) => {
	const u = Math.min(1, Math.max(0, x));
	return u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);
};

export interface CoreSettings {
	/** U-235 enrichment, percent by weight. */
	enrichment: number;
	/** Water in the core relative to the design amount (1 = design). */
	water: number;
	/** Control-rod insertion, 0 (out) to 1 (fully in). */
	rods: number;
}

export interface Factors {
	eta: number;
	epsilon: number;
	/** Resonance escape: share of neutrons not captured by U-238 while slowing down. */
	p: number;
	/** Thermal utilisation: share of slow neutrons absorbed in the fuel. */
	f: number;
	nonLeakage: number;
	kInf: number;
	k: number;
}

function macroscopic(enrichment: number) {
	const nU = (LATTICE.uo2Density / (238.0289 + 2 * 15.9994)) * AVOGADRO * 1e-24; // per b·cm
	const a = atomFraction(enrichment);
	const fuelAbs = nU * (a * (U235.fission + U235.capture) + (1 - a) * ABSORB.U238 + 2 * ABSORB.O);
	const n238 = nU * (1 - a);
	const nW = (LATTICE.waterDensity / 18.015) * AVOGADRO * 1e-24;
	const waterAbs = nW * (2 * ABSORB.H + ABSORB.O);
	const waterSlowing =
		nW * (2 * freeScatter(SCATTER_BOUND.H, 1) * xi(1) + freeScatter(SCATTER_BOUND.O, 16) * xi(16));
	return { fuelAbs, n238, waterAbs, waterSlowing };
}

function factorsWith(s: CoreSettings, rodAbs: number): Factors {
	const m = macroscopic(s.enrichment);
	const ratio = Math.max(0, s.water) * LATTICE.waterPerFuel;
	const p = ratio > 0 ? Math.exp(-(m.n238 * resonanceIntegral()) / (m.waterSlowing * ratio)) : 0;
	const f = m.fuelAbs / (m.fuelAbs + m.waterAbs * ratio + rodAbs * rodShape(s.rods));
	const e = eta(s.enrichment);
	const kInf = e * EPSILON * p * f;
	return { eta: e, epsilon: EPSILON, p, f, nonLeakage: NON_LEAKAGE, kInf, k: kInf * NON_LEAKAGE };
}

/**
 * Full-insertion strength of the control rods (absorption per cm, per volume of
 * fuel). A design choice of this page: chosen so that the design core (4%
 * fuel, design water) is exactly critical with the rods half in. In a real
 * core this margin is held by rods, boron dissolved in the water and burnable
 * absorbers in the fuel together.
 */
export const DESIGN: CoreSettings = { enrichment: 4, water: 1, rods: 0.5 };
export const ROD_STRENGTH = (() => {
	const out = factorsWith({ ...DESIGN, rods: 0 }, 0);
	const m = macroscopic(DESIGN.enrichment);
	const ratio = DESIGN.water * LATTICE.waterPerFuel;
	// k = k_out × f / f_out = 1  →  total absorption = fuelAbs × k_out / f_out
	const total = (m.fuelAbs * out.k) / out.f;
	return (total - m.fuelAbs - m.waterAbs * ratio) / rodShape(DESIGN.rods);
})();

/** The four factors and k of a core. */
export const factors = (s: CoreSettings): Factors => factorsWith(s, ROD_STRENGTH);

export type Regime = 'subcritical' | 'critical' | 'supercritical';
/** Within ±0.001 of 1 counts as critical (what the page calls "steady"). */
export function regime(k: number, tolerance = 0.001): Regime {
	if (k < 1 - tolerance) return 'subcritical';
	if (k > 1 + tolerance) return 'supercritical';
	return 'critical';
}

/** Rod insertion that makes k = 1 for the given fuel and water, or null if none can. */
export function criticalRods(enrichment: number, water: number): number | null {
	const k = (x: number) => factors({ enrichment, water, rods: x }).k;
	if (k(0) < 1 || k(1) > 1) return null;
	let lo = 0;
	let hi = 1;
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (k(mid) > 1) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// The chain reaction as a branching process
// ---------------------------------------------------------------------------

/**
 * Neutrons per fission in this page's simulations: 2 or 3, with the mean of
 * U-235 (2.425). The real distribution runs from 0 to about 7.
 */
export const P_THREE = U235.nu - 2;

/**
 * Neutron counts, generation by generation, starting from `n0`. Each neutron
 * causes a fission with probability k / ν̄ (otherwise it is captured or
 * escapes), and each fission releases 2 or 3 new ones, so on average k new
 * neutrons go on per neutron. Above `cap` the count is only followed as the
 * expected growth (it has left the chart).
 */
export function chainRun(k: number, n0: number, generations: number, seed: number, cap = 1e6) {
	const r = rng(seed);
	const q = Math.min(1, k / U235.nu);
	const out = [n0];
	let n = n0;
	for (let g = 1; g <= generations; g++) {
		if (n > cap) {
			n *= k;
		} else {
			let next = 0;
			for (let i = 0; i < n; i++) if (r() < q) next += r() < P_THREE ? 3 : 2;
			n = next;
		}
		out.push(n);
	}
	return out;
}

/** Expected neutron count after g generations. */
export const expectedChain = (k: number, n0: number, g: number) => n0 * k ** g;

// ---------------------------------------------------------------------------
// Point kinetics with delayed neutrons
// ---------------------------------------------------------------------------

/**
 * Six groups of delayed neutrons from thermal fission of U-235: fraction of all
 * fission neutrons and decay constant (per second). G.R. Keepin, Physics of
 * Nuclear Kinetics (1965), as tabulated in Lamarsh and Baratta (3rd ed.).
 */
export const DELAYED = [
	{ beta: 0.000215, lambda: 0.0124 },
	{ beta: 0.001424, lambda: 0.0305 },
	{ beta: 0.001274, lambda: 0.111 },
	{ beta: 0.002568, lambda: 0.301 },
	{ beta: 0.000748, lambda: 1.14 },
	{ beta: 0.000273, lambda: 3.01 }
] as const;
export const BETA = DELAYED.reduce((s, g) => s + g.beta, 0);

/**
 * Prompt neutron generation time, s: of the order of 10⁻⁴ s in a
 * water-moderated reactor (Lamarsh and Baratta's worked example gives
 * 1.08 × 10⁻⁴ s).
 */
export const GENERATION_TIME = 1e-4;

/** Mean delay of a delayed neutron, s (Σ βᵢ/λᵢ / β). */
export const meanDelay = () => DELAYED.reduce((s, g) => s + g.beta / g.lambda, 0) / BETA;

/** Reactivity ρ = (k − 1) / k. */
export const reactivity = (k: number) => (k - 1) / k;

export interface Kinetics {
	/** Power, relative to the starting power. */
	power: number;
	/** Delayed-neutron precursors of each group (in the same units). */
	precursors: number[];
}

/** A reactor that has run steadily at `power` long enough for its precursors to settle. */
export function steady(power = 1): Kinetics {
	return {
		power,
		precursors: DELAYED.map((g) => (g.beta * power) / (g.lambda * GENERATION_TIME))
	};
}

/**
 * Advances the point-kinetics equations by `dt` seconds at reactivity `rho`,
 * with backward-Euler substeps of at most `sub` seconds (the equations are
 * stiff: after a shutdown the prompt term decays in about a millisecond).
 */
export function advance(state: Kinetics, rho: number, dt: number, sub = 1e-3): Kinetics {
	if (!(dt > 0)) return state;
	const steps = Math.max(1, Math.ceil(dt / sub));
	const h = dt / steps;
	let P = state.power;
	const C = state.precursors.slice();
	const L = GENERATION_TIME;
	for (let s = 0; s < steps; s++) {
		let lhs = 1 / h - (rho - BETA) / L;
		let rhs = P / h;
		for (let i = 0; i < 6; i++) {
			const { beta, lambda } = DELAYED[i];
			const d = 1 / h + lambda;
			lhs -= (lambda * beta) / (L * d);
			rhs += (lambda * C[i]) / (h * d);
		}
		P = rhs / lhs;
		for (let i = 0; i < 6; i++) {
			const { beta, lambda } = DELAYED[i];
			C[i] = (C[i] / h + (beta * P) / L) / (1 / h + lambda);
		}
	}
	return { power: P, precursors: C };
}

/**
 * The inhour equation, ρ = ωΛ + Σ βᵢ ω / (ω + λᵢ): the growth rate ω (per
 * second) a reactor settles into at reactivity ρ. Its stable period is 1/ω.
 */
export function inhour(rho: number): number {
	const f = (w: number) =>
		w * GENERATION_TIME + DELAYED.reduce((s, g) => s + (g.beta * w) / (w + g.lambda), 0) - rho;
	let lo = rho >= 0 ? 0 : -DELAYED[0].lambda + 1e-12;
	let hi = rho >= 0 ? 1 : 0;
	while (rho >= 0 && f(hi) < 0) hi *= 2;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (f(mid) < 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Growth rate per second if there were no delayed neutrons: ρ / Λ. */
export const promptOnlyRate = (rho: number) => rho / GENERATION_TIME;

/**
 * The operating bank of control rods: its full stroke is worth this much
 * reactivity, less than β, so that pulling it out can never make the reactor
 * critical on prompt neutrons alone. A design choice of this page in line with
 * how real plants limit the worth and withdrawal speed of their rods.
 */
export const BANK_WORTH = 0.006;
/** Reactivity of the bank at insertion x, relative to half in (the critical position). */
export const bankReactivity = (x: number) => BANK_WORTH * (rodShape(0.5) - rodShape(x));
/** Reactivity once every rod has dropped in (a scram); several dollars below critical. */
export const SCRAM_REACTIVITY = -0.06;

// ---------------------------------------------------------------------------
// A power plant
// ---------------------------------------------------------------------------

/** Heat output of a large reactor at full power, W (about 3 GW). */
export const PLANT_HEAT = 3e9;
/** Share of the heat turned into electricity (about a third in a water-cooled plant). */
export const PLANT_EFFICIENCY = 1 / 3;

/** Fissions per second at a given heat output. */
export const fissionsPerSecond = (watts: number) => watts / (FISSION_ENERGY.heat * MEV);

/** Kilograms of U-235 split per day at a given heat output. */
export const u235PerDay = (watts: number) =>
	(fissionsPerSecond(watts) * 86400 * 0.2350439) / AVOGADRO;

/**
 * Decay heat after shutdown as a share of the power before it: the Way–Wigner
 * approximation P/P₀ = 0.0622 [t^−0.2 − (t + T)^−0.2], with t the time since
 * shutdown and T the time the reactor ran, both in seconds (as given in
 * S. Glasstone and A. Sesonske, Nuclear Reactor Engineering). Good to a few
 * tens of percent between about 10 s and 100 days.
 */
export function decayHeat(t: number, operated = 365.25 * 86400): number {
	const s = Math.max(1, t); // the formula diverges at t = 0; hold its 1 s value
	return 0.0622 * (s ** -0.2 - (s + operated) ** -0.2);
}
