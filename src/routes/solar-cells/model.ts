/**
 * Solar cells: the model behind the explainer. An ideal single-junction cell in standard
 * sunlight, in the detailed-balance picture of W. Shockley and H. J. Queisser, "Detailed
 * Balance Limit of Efficiency of p-n Junction Solar Cells", J. Appl. Phys. 32, 510 (1961).
 *
 * - Sunlight: ASTM G173-03 AM1.5 global, 1000.4 W/m² (`spectrum.ts`).
 * - Every photon with at least the band gap's energy is absorbed and makes one electron–hole
 *   pair, and every pair is collected: the photocurrent is q × (photons above the gap).
 *   Photons below the gap pass through. No reflection, no series or shunt resistance.
 * - The only way pairs are lost is the unavoidable one: radiative recombination, the light a
 *   warm cell must give off. A cell in the dark at temperature T absorbs the black-body
 *   radiation of its surroundings above the gap and, in balance, emits exactly as much; from
 *   its front surface into a hemisphere that is
 *     Φ_bb = (2π / h³c²) ∫_Eg^∞ E² / (e^(E/kT) − 1) dE   photons per m² per second.
 *   With a voltage V across it the emission grows by e^(qV/kT), so the cell is the ideal
 *   (Shockley) diode of the semiconductors explainer, with saturation current density
 *   J₀ = q Φ_bb, minus the photocurrent:
 *     J(V) = J_sc − J₀ (e^(qV/kT) − 1).
 *   This is the standard modern form of the limit (e.g. S. Rühle, "Tabulated values of the
 *   Shockley–Queisser limit for single junction solar cells", Solar Energy 130, 139 (2016),
 *   who finds 33.7 % at 1.34 eV for AM1.5G at 300 K; this model reproduces it).
 * - Constants: CODATA 2018 (exact SI values of h, c, q; Boltzmann constant in eV/K), shared
 *   with the semiconductors model. The band gap is held fixed when the temperature changes.
 */
import { GAPS, K_B, Q, T_ROOM, diodeCurrent } from '../semiconductors/model';
import { E_START, E_STEP, FLUX, POWER } from './spectrum';

export { GAPS, K_B, Q, T_ROOM };

/** Planck constant, J·s (exact). */
const H = 6.62607015e-34;
/** Speed of light, m/s (exact). */
const C = 299792458;
/** hc in eV·nm: a photon of wavelength λ (nm) carries 1239.84/λ eV. */
const HC_EV_NM = (H * C * 1e9) / Q;

/** Photon energy (eV) of light of wavelength `nm`. */
export const photonEnergy = (nm: number) => HC_EV_NM / nm;
/** Wavelength (nm) of a photon of energy `ev`. */
export const wavelength = (ev: number) => HC_EV_NM / ev;

/** Total power of standard sunlight, W/m². */
export const SUN_POWER = POWER.reduce((a, b) => a + b, 0);
/** Photons of standard sunlight per m² per second (280–4000 nm). */
export const SUN_FLUX = FLUX.reduce((a, b) => a + b, 0);

/** Sum of a binned spectral quantity over photon energies ≥ `gap` (part of a bin counts pro rata). */
function above(bins: readonly number[], gap: number): number {
	let s = 0;
	for (let i = bins.length - 1; i >= 0; i--) {
		const lo = E_START + E_STEP * i;
		const hi = lo + E_STEP;
		if (lo >= gap) s += bins[i];
		else {
			if (hi > gap) s += (bins[i] * (hi - gap)) / E_STEP;
			break;
		}
	}
	return s;
}

/** Photons of standard sunlight with at least `gap` eV, per m² per second. */
export const photonsAbove = (gap: number) => above(FLUX, gap);
/** Power of standard sunlight carried by photons of at least `gap` eV, W/m². */
export const powerAbove = (gap: number) => above(POWER, gap);

/**
 * Black-body photon flux above `gap` (eV) emitted by a surface at temperature `T` into a
 * hemisphere, photons per m² per second. Simpson's rule from Eg to Eg + 40 kT.
 */
export function blackbodyAbove(gap: number, T = T_ROOM): number {
	const kT = K_B * T;
	const n = 400;
	const d = (40 * kT) / n;
	let s = 0;
	for (let i = 0; i <= n; i++) {
		const E = gap + i * d;
		const w = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
		s += (w * E * E) / Math.expm1(E / kT);
	}
	s *= d / 3;
	return ((2 * Math.PI * Q ** 3) / (H ** 3 * C ** 2)) * s;
}

interface CellOptions {
	/** Light intensity in suns (1 = standard sunlight). */
	suns?: number;
	/** Cell temperature, K. */
	T?: number;
}

/** Short-circuit current density of the ideal cell, A/m² (÷ 10 for mA/cm²). */
const shortCircuit = (gap: number, { suns = 1 }: CellOptions = {}) => Q * photonsAbove(gap) * suns;

/** Dark (saturation) current density J₀ = q Φ_bb, A/m². */
const darkCurrent = (gap: number, T = T_ROOM) => Q * blackbodyAbove(gap, T);

/** Current density (A/m²) delivered at voltage `V`: the lit diode. */
export function cellCurrent(V: number, gap: number, opts: CellOptions = {}): number {
	const T = opts.T ?? T_ROOM;
	return shortCircuit(gap, opts) - diodeCurrent(V, darkCurrent(gap, T), T);
}

interface Cell {
	gap: number;
	T: number;
	suns: number;
	/** A/m². */
	jsc: number;
	/** A/m². */
	j0: number;
	/** V. */
	voc: number;
	/** Voltage and current density at the maximum power point (V, A/m²). */
	vmp: number;
	jmp: number;
	/** Output at the maximum power point, W/m². */
	pmax: number;
	/** Fill factor Pmax / (Voc Jsc). */
	ff: number;
	/** Incident power, W/m². */
	pin: number;
	/** Pmax / Pin. */
	efficiency: number;
}

/** The ideal cell's operating figures for band gap `gap` (eV). */
export function cell(gap: number, opts: CellOptions = {}): Cell {
	const T = opts.T ?? T_ROOM;
	const suns = opts.suns ?? 1;
	const kT = K_B * T;
	const jsc = shortCircuit(gap, { suns });
	const j0 = darkCurrent(gap, T);
	const voc = kT * Math.log1p(jsc / j0);
	// Maximum of V·J(V): with x = qV/kT, e^x (1 + x) = 1 + Jsc/J₀ (Newton).
	const target = 1 + jsc / j0;
	let x = voc / kT;
	for (let i = 0; i < 60; i++) {
		const ex = Math.exp(x);
		const step = (ex * (1 + x) - target) / (ex * (2 + x));
		x -= step;
		if (Math.abs(step) < 1e-12) break;
	}
	const vmp = x * kT;
	const jmp = jsc - j0 * Math.expm1(x);
	const pmax = vmp * jmp;
	const pin = SUN_POWER * suns;
	return {
		gap,
		T,
		suns,
		jsc,
		j0,
		voc,
		vmp,
		jmp,
		pmax,
		ff: pmax / (voc * jsc),
		pin,
		efficiency: pmax / pin
	};
}

interface Split {
	/** Photons below the gap: they pass through. */
	below: number;
	/** Absorbed photons' energy above the gap: given to the crystal as heat. */
	heat: number;
	/**
	 * Energy Eg per collected pair that the cell does not deliver: the voltage stays below
	 * the gap (the light it must emit) and the best operating point gives up a little
	 * current and voltage.
	 */
	voltage: number;
	/** Electrical output at the maximum power point. */
	output: number;
}

/** Where the energy of standard sunlight goes in the ideal cell; fractions summing to 1. */
export function split(gap: number, opts: CellOptions = {}): Split {
	const c = cell(gap, opts);
	const abs = powerAbove(gap) / SUN_POWER;
	const kept = (photonsAbove(gap) * gap * Q) / SUN_POWER; // Eg per absorbed photon
	return {
		below: 1 - abs,
		heat: abs - kept,
		voltage: kept - c.efficiency,
		output: c.efficiency
	};
}

/** The ceiling left by the two spectrum losses alone (no voltage loss): Eg × photons ÷ power. */
export const spectrumCeiling = (gap: number) => (photonsAbove(gap) * gap * Q) / SUN_POWER;

/**
 * Current density (A/m²) from monochromatic light of wavelength `nm` and power `watts`
 * per m² on the ideal cell: one electron per absorbed photon, J = q × P/E = P / (E in eV).
 */
export function monoCurrent(nm: number, watts: number, gap: number): number {
	const E = photonEnergy(nm);
	return E >= gap ? watts / E : 0;
}

/** Band gap (eV) of the best single-junction cell, and its efficiency, searched on a 0.001 eV grid. */
export function bestGap(lo = 0.9, hi = 1.6): { gap: number; efficiency: number } {
	let best = { gap: lo, efficiency: 0 };
	for (let g = lo; g <= hi + 1e-9; g += 0.001) {
		const e = cell(g).efficiency;
		if (e > best.efficiency) best = { gap: g, efficiency: e };
	}
	return best;
}

/** Band gap of gallium arsenide at 300 K, eV (Sze & Ng, Physics of Semiconductor Devices, 2007). */
export const GAAS_GAP = 1.42;

/** °C → K. */
export const kelvin = (celsius: number) => celsius + 273.15;
