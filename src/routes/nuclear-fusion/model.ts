/**
 * The physics behind the nuclear-fusion explainer, in plain TypeScript.
 *
 * - Energies released by reactions, from the AME2020 atomic masses (`binding.ts`).
 * - The Coulomb barrier and the Gamow tunnelling factor.
 * - Fusion cross sections and thermal reactivities ⟨σv⟩ from the parametrisations of
 *   H.-S. Bosch and G. M. Hale, "Improved formulas for fusion cross-sections and thermal
 *   reactivities", Nuclear Fusion 32, 611 (1992). The constants are those of the paper's
 *   tables, as listed to full precision in the C code of T. A. Heltemes, G. A. Moses and
 *   J. F. Santarius, "Analysis of an improved fusion reaction rate model for use in fusion
 *   plasma simulations", UWFDM-1268 (University of Wisconsin, 2005), whose table 6 of
 *   reactivities the model tests reproduce.
 * - A zero-dimensional power balance of a 50:50 deuterium–tritium plasma: fusion, alpha
 *   heating, bremsstrahlung (NRL Plasma Formulary) and conduction losses W/τ_E, the Lawson
 *   (ignition) criterion and the gain Q, and the plasma's temperature through time once the
 *   heating is switched off.
 *
 * Units: temperatures and particle energies in keV, densities in m⁻³, times in s, powers in
 * W/m³ unless a name says otherwise.
 */
import { nuclides, type NuclideName } from './binding';

// ---- constants (CODATA 2018) ------------------------------------------------------------

/** Joules per keV. */
export const KEV = 1.602176634e-16;
/** Kelvin per keV of temperature (1 keV / k_B). */
export const KELVIN_PER_KEV = 1.160451812e7;
/** keV per atomic mass unit (u c²). */
export const U_KEV = 931494.10242;
/** Kilograms per atomic mass unit. */
export const U_KG = 1.6605390666e-27;
/** Fine-structure constant. */
export const ALPHA = 7.2973525693e-3;
/** e²/4πε₀ in keV·fm: the Coulomb energy of two unit charges 1 fm apart. */
export const COULOMB_KEV_FM = 1439.96448;
/** Nuclear radius R = R0 · A^⅓, in fm (the usual textbook value). */
export const R0_FM = 1.2;

export const kelvin = (tKeV: number) => tKeV * KELVIN_PER_KEV;

// ---- masses and reaction energies -------------------------------------------------------

/** Atomic mass in u, from the AME2020 mass excess. */
export const atomicMass = (name: NuclideName) =>
	nuclides[name].a + nuclides[name].massExcess / U_KEV;

/**
 * Energy released (keV) when `reactants` become `products`, from atomic masses. Electrons
 * balance on both sides because the charges do, so atomic masses can be used directly.
 */
export function qValue(reactants: NuclideName[], products: NuclideName[]): number {
	const sum = (list: NuclideName[]) => list.reduce((s, n) => s + nuclides[n].massExcess, 0);
	return sum(reactants) - sum(products);
}

/** D + T → ⁴He + n. */
export const Q_DT = qValue(['H-2', 'H-3'], ['He-4', 'n']);
/** D + D → ³He + n and D + D → T + p. */
export const Q_DD_N = qValue(['H-2', 'H-2'], ['He-3', 'n']);
export const Q_DD_P = qValue(['H-2', 'H-2'], ['H-3', 'H-1']);
/** D + ³He → ⁴He + p. */
export const Q_DHE3 = qValue(['H-2', 'He-3'], ['He-4', 'H-1']);
/** Tritium breeding in the blanket: n + ⁶Li → T + ⁴He. */
export const Q_LI6 = qValue(['n', 'Li-6'], ['H-3', 'He-4']);
/**
 * A typical fission of uranium-235, followed to its stable end products: n + ²³⁵U →
 * ¹⁴¹Ba + ⁹²Kr + 3n, then beta decays down to ¹⁴¹Pr and ⁹²Zr. About a twentieth of this
 * leaves as neutrinos.
 */
export const Q_FISSION = qValue(['n', 'U-235'], ['Pr-141', 'Zr-92', 'n', 'n', 'n']);
/** The prompt part of that fission: the two fragments as they are first made. */
export const Q_FISSION_PROMPT = qValue(['n', 'U-235'], ['Ba-141', 'Kr-92', 'n', 'n', 'n']);

/**
 * How the energy of a two-body reaction at rest is shared: momentum is conserved, so the
 * lighter product takes the larger share, in inverse proportion to the masses.
 */
export function shares(q: number, m1: number, m2: number): [number, number] {
	return [(q * m2) / (m1 + m2), (q * m1) / (m1 + m2)];
}
/** [alpha, neutron] energies of D–T fusion, keV. */
export const DT_SPLIT = shares(Q_DT, atomicMass('He-4'), atomicMass('n'));
export const E_ALPHA = DT_SPLIT[0];
export const E_NEUTRON = DT_SPLIT[1];

/** Share of the fuel's mass turned into energy. */
export const DT_MASS_FRACTION = Q_DT / U_KEV / (atomicMass('H-2') + atomicMass('H-3'));

/** Standard enthalpy of combustion of methane, 890.6 kJ/mol (NIST), over its molar mass. */
export const METHANE_J_PER_KG = 890.6e3 / 16.043e-3;

/** Energy released per kilogram of fuel, J/kg. */
export const energyPerKg = {
	fusion: (Q_DT * KEV) / ((atomicMass('H-2') + atomicMass('H-3')) * U_KG),
	fission: (Q_FISSION * KEV) / (atomicMass('U-235') * U_KG),
	methane: METHANE_J_PER_KG
};

// ---- the Coulomb barrier and tunnelling --------------------------------------------------

export interface Pair {
	z1: number;
	z2: number;
	a1: number;
	a2: number;
}
export const DT_PAIR: Pair = { z1: 1, z2: 1, a1: 2, a2: 3 };

/** Distance at which the two nuclei touch, fm. */
export const touching = (p: Pair = DT_PAIR) => R0_FM * (Math.cbrt(p.a1) + Math.cbrt(p.a2));
/** Coulomb potential energy at distance r (fm), keV. */
export const coulomb = (r: number, p: Pair = DT_PAIR) => (p.z1 * p.z2 * COULOMB_KEV_FM) / r;
/** Height of the Coulomb barrier, keV. */
export const barrier = (p: Pair = DT_PAIR) => coulomb(touching(p), p);
/** Temperature (keV) at which the average particle energy 3/2 kT equals the barrier. */
export const classicalTemperature = (p: Pair = DT_PAIR) => barrier(p) / 1.5;

/** Reduced mass of D and T, as energy (keV). */
export const MR_DT =
	(atomicMass('H-2') * atomicMass('H-3') * U_KEV) / (atomicMass('H-2') + atomicMass('H-3'));
/** Gamow energy E_G = 2 m_r c² (π α Z₁Z₂)², keV. */
export const gamowEnergy = (mr = MR_DT, z1z2 = 1) => 2 * mr * (Math.PI * ALPHA * z1z2) ** 2;
/** Chance of tunnelling through the barrier at energy E (keV): the Gamow factor. */
export const tunnelling = (e: number, eg = gamowEnergy()) =>
	e > 0 ? Math.exp(-Math.sqrt(eg / e)) : 0;
/**
 * Maxwell–Boltzmann distribution of the energy of relative motion of two nuclei at
 * temperature T (per keV).
 */
export const maxwell = (e: number, tKeV: number) =>
	e > 0 ? 2 * Math.sqrt(e / Math.PI) * tKeV ** -1.5 * Math.exp(-e / tKeV) : 0;
/**
 * Fusions per unit time from collisions at relative energy E (per keV, arbitrary scale):
 * the share of pairs at that energy × their speed × the real cross section, the integrand
 * of ⟨σv⟩. Its maximum is where most fusions happen.
 */
export const fusionsAt = (e: number, tKeV: number) =>
	maxwell(e, tKeV) * Math.sqrt(e) * crossSectionDT(e);
/** Energy where the most fusions happen, keV (scan of `fusionsAt`). */
export function fusionPeak(tKeV: number): number {
	let best = 0;
	let at = 0;
	for (let e = 0.5; e < 550; e += 0.05) {
		const v = fusionsAt(e, tKeV);
		if (v > best) [best, at] = [v, e];
	}
	return at;
}
/**
 * The Gamow peak of textbooks, for a cross section with no resonance: where e^(−E/kT) times
 * the tunnelling chance is largest, (E_G (kT)²/4)^⅓, keV.
 */
export const gamowPeak = (tKeV: number, eg = gamowEnergy()) => Math.cbrt((eg * tKeV * tKeV) / 4);

// ---- Bosch–Hale cross section and reactivities -------------------------------------------

/**
 * D–T fusion cross section at centre-of-mass energy E (keV), in m². Bosch & Hale (1992),
 * valid 0.5–550 keV.
 */
export function crossSectionDT(e: number): number {
	if (e <= 0) return 0;
	const [a1, a2, a3, a4, a5] = [6.927e4, 7.454e8, 2.05e6, 5.2002e4, 0];
	const [b1, b2, b3, b4] = [6.38e1, -9.95e-1, 6.981e-5, 1.728e-4];
	const s =
		(a1 + e * (a2 + e * (a3 + e * (a4 + e * a5)))) / (1 + e * (b1 + e * (b2 + e * (b3 + e * b4))));
	const mb = s / (e * Math.exp(34.3827 / Math.sqrt(e)));
	return mb * 1e-31; // millibarn → m²
}

export type Reaction = 'DT' | 'DDn' | 'DDp' | 'DHe3';
interface Coefs {
	bg: number;
	mrc2: number;
	c: [number, number, number, number, number, number, number];
}
const BH: Record<Reaction, Coefs> = {
	DT: {
		bg: 34.3827,
		mrc2: 1.124656e6,
		c: [1.17302e-9, 1.51361e-2, 7.51886e-2, 4.60643e-3, 1.35e-2, -1.0675e-4, 1.366e-5]
	},
	DHe3: {
		bg: 68.7508,
		mrc2: 1.124572e6,
		c: [5.51036e-10, 6.41918e-3, -2.02896e-3, -1.9108e-5, 1.35776e-4, 0, 0]
	},
	DDp: {
		bg: 31.397,
		mrc2: 9.37814e5,
		c: [5.65718e-12, 3.41267e-3, 1.99167e-3, 0, 1.0506e-5, 0, 0]
	},
	DDn: {
		bg: 31.397,
		mrc2: 9.37814e5,
		c: [5.4336e-12, 5.85778e-3, 7.68222e-3, 0, -2.964e-6, 0, 0]
	}
};
/** Temperatures (keV) over which the parametrisation is valid. */
export const T_MIN = 0.2;
export const T_MAX = 100;

/** Thermal reactivity ⟨σv⟩ of a reaction at ion temperature T (keV), in m³/s. */
export function reactivity(tKeV: number, r: Reaction = 'DT'): number {
	const { bg, mrc2, c } = BH[r];
	const [c1, c2, c3, c4, c5, c6, c7] = c;
	const t = tKeV;
	const theta = t / (1 - (t * (c2 + t * (c4 + t * c6))) / (1 + t * (c3 + t * (c5 + t * c7))));
	const xi = Math.cbrt((bg * bg) / (4 * theta));
	return c1 * theta * Math.sqrt(xi / (mrc2 * t ** 3)) * Math.exp(-3 * xi) * 1e-6; // cm³ → m³
}
/** D–D reactivity, both branches together. */
export const reactivityDD = (tKeV: number) => reactivity(tKeV, 'DDn') + reactivity(tKeV, 'DDp');

/**
 * ⟨σv⟩ from the cross section, averaged over the Maxwell–Boltzmann distribution of relative
 * energies (m³/s): √(8/π m_r) (kT)^(-3/2) ∫ σ(E) E e^(−E/kT) dE. Used to check that the
 * cross section and the reactivity fit agree, and that the Gamow-peak picture is right.
 */
export function reactivityFromCrossSection(tKeV: number): number {
	const mr = (MR_DT / U_KEV) * U_KG;
	let sum = 0;
	const n = 4000;
	const eMax = Math.min(550, 40 * tKeV + 200);
	const de = eMax / n;
	for (let i = 1; i <= n; i++) {
		const e = (i - 0.5) * de;
		if (e < 0.5) continue;
		sum += crossSectionDT(e) * e * KEV * Math.exp(-e / tKeV) * de * KEV;
	}
	return Math.sqrt(8 / (Math.PI * mr)) * (tKeV * KEV) ** -1.5 * sum;
}

// ---- power balance of a D–T plasma ------------------------------------------------------

/**
 * Bremsstrahlung: P = 1.69 × 10⁻³² n_e² √T_e Z_eff W/cm³ with n in cm⁻³ and T in eV (NRL
 * Plasma Formulary). In SI with T in keV: C_B n² √T, C_B ≈ 5.34 × 10⁻³⁷ W m³ keV^-½.
 */
export const C_BREMS = 1.69e-32 * 1e-12 * 1e6 * Math.sqrt(1000);

export interface Plasma {
	/** Ion temperature = electron temperature, keV. */
	t: number;
	/** Fuel-ion density (half deuterium, half tritium) = electron density, m⁻³. */
	n: number;
	/** Energy confinement time, s. */
	tau: number;
}

export interface Powers {
	/** Total fusion power, W/m³ (a fifth in alphas, four-fifths in neutrons). */
	fusion: number;
	/** Alpha heating: the part of the fusion power that stays in the plasma. */
	alpha: number;
	/** Heat leaking out of the plasma, W/τ_E. */
	conduction: number;
	/** X-rays radiated by electrons swerving past ions. */
	brems: number;
	/** Outside heating needed to hold the temperature steady (≤ 0: none needed). */
	heating: number;
	/** Gain Q = fusion / heating (Infinity when the plasma heats itself). */
	q: number;
	/** Thermal energy stored, J/m³. */
	energy: number;
}

export const thermalEnergy = (n: number, t: number) => 3 * n * t * KEV;

export function powers({ t, n, tau }: Plasma): Powers {
	const rate = (n * n * reactivity(t)) / 4;
	const fusion = rate * Q_DT * KEV;
	const alpha = rate * E_ALPHA * KEV;
	const energy = thermalEnergy(n, t);
	const conduction = energy / tau;
	const brems = C_BREMS * n * n * Math.sqrt(t);
	const heating = conduction + brems - alpha;
	return {
		fusion,
		alpha,
		conduction,
		brems,
		heating,
		q: heating > 0 ? fusion / heating : Infinity,
		energy
	};
}

/**
 * The density × confinement time (m⁻³ s) at which a plasma at temperature T reaches gain
 * Q in steady state: n τ_E = 3T / (⟨σv⟩(E_fus/Q + E_α)/4 − C_B √T). Q = Infinity gives the
 * ignition (Lawson) condition. Infinity when no n τ_E is enough.
 */
export function nTauFor(tKeV: number, q = Infinity): number {
	const sv = reactivity(tKeV);
	const gain = (sv * (Q_DT / q + E_ALPHA) * KEV) / 4 - C_BREMS * Math.sqrt(tKeV);
	return gain > 0 ? (3 * tKeV * KEV) / gain : Infinity;
}
/** Triple product n T τ_E (keV s m⁻³) needed for gain Q (Infinity = ignition). */
export const tripleFor = (tKeV: number, q = Infinity) => tKeV * nTauFor(tKeV, q);

/** Minimum of a function on [lo, hi] (log-spaced scan, then golden-section refinement). */
function argmin(f: (x: number) => number, lo: number, hi: number): number {
	let best = lo;
	for (let i = 0; i <= 200; i++) {
		const x = lo * (hi / lo) ** (i / 200);
		if (f(x) < f(best)) best = x;
	}
	let a = best / 1.05;
	let b = best * 1.05;
	const g = (Math.sqrt(5) - 1) / 2;
	for (let i = 0; i < 60; i++) {
		const c = b - g * (b - a);
		const d = a + g * (b - a);
		if (f(c) < f(d)) b = d;
		else a = c;
	}
	return (a + b) / 2;
}

/** Temperature (keV) at which the ignition triple product is smallest, and its value. */
export function bestIgnition(): { t: number; triple: number } {
	const t = argmin((x) => tripleFor(x), 3, 100);
	return { t, triple: tripleFor(t) };
}

/**
 * Ideal ignition temperature (keV): below it, alpha heating cannot even keep up with
 * bremsstrahlung, so no confinement, however good, gives ignition.
 */
export function idealIgnitionTemperature(): number {
	let lo = 1;
	let hi = 20;
	const f = (t: number) => (reactivity(t) * E_ALPHA * KEV) / 4 - C_BREMS * Math.sqrt(t);
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (f(mid) > 0) hi = mid;
		else lo = mid;
	}
	return (lo + hi) / 2;
}

// ---- the plasma through time ------------------------------------------------------------

export interface Sample {
	/** Time since the heating was switched off, s. */
	time: number;
	t: number;
	fusion: number;
}

export interface Run {
	samples: Sample[];
	/** What happened once the heating was off. */
	outcome: 'ignites' | 'cools' | 'steady';
	/** Temperature at the end of the run (capped at T_MAX), keV. */
	final: number;
	/** The run reached the top of the model's range (100 keV) and was stopped there. */
	capped: boolean;
	/** Length of the run, s. */
	duration: number;
}

/**
 * Switches the outside heating off a plasma held at temperature T and follows its
 * temperature: 3n dT/dt = P_α − W/τ_E − P_brems (RK4). The energy confinement time is held
 * fixed, a simplification: in real machines it gets worse as the heating power rises. Runs
 * for `spans` confinement times; stops at the bottom (0.2 keV) or the top (100 keV) of the
 * reactivity fit's range.
 */
export function coast(p: Plasma, spans = 8, steps = 400): Run {
	const { n, tau } = p;
	const rate = (t: number) => {
		const x = powers({ t, n, tau });
		return (x.alpha - x.conduction - x.brems) / (3 * n * KEV);
	};
	const duration = spans * tau;
	const dt = duration / steps;
	let t = p.t;
	const samples: Sample[] = [{ time: 0, t, fusion: powers(p).fusion }];
	let capped = false;
	for (let i = 1; i <= steps; i++) {
		const k1 = rate(t);
		const k2 = rate(Math.max(T_MIN, t + (dt * k1) / 2));
		const k3 = rate(Math.max(T_MIN, t + (dt * k2) / 2));
		const k4 = rate(Math.max(T_MIN, t + dt * k3));
		t += (dt * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
		if (t >= T_MAX) {
			t = T_MAX;
			capped = true;
		}
		t = Math.max(T_MIN, t);
		samples.push({ time: i * dt, t, fusion: powers({ t, n, tau }).fusion });
		if (capped) {
			// Hold at the cap for the rest of the run so the plot stays a full width.
			for (let j = i + 1; j <= steps; j++)
				samples.push({ time: j * dt, t, fusion: samples[samples.length - 1].fusion });
			break;
		}
	}
	const final = samples[samples.length - 1].t;
	const outcome = final > p.t * 1.02 ? 'ignites' : final < p.t * 0.98 ? 'cools' : 'steady';
	return { samples, outcome, final, capped, duration };
}

/** Where a self-heated plasma settles: the stable burn temperature (keV), or null if none ≤ 100. */
export function burnTemperature(n: number, tau: number): number | null {
	const f = (t: number) => {
		const x = powers({ t, n, tau });
		return x.alpha - x.conduction - x.brems;
	};
	// The stable point is where net heating crosses from positive to negative going up in T.
	let prev = f(T_MIN);
	for (let i = 1; i <= 2000; i++) {
		const t = T_MIN * (T_MAX / T_MIN) ** (i / 2000);
		const v = f(t);
		if (prev > 0 && v <= 0) return t;
		prev = v;
	}
	return null;
}
