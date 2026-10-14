/**
 * The electrochemistry behind the page.
 *
 * 1. Cell voltage from standard reduction potentials: E°cell = E°(reduced) − E°(oxidised),
 *    the couple higher on the table taking electrons (`potentials.ts`).
 * 2. The Nernst equation, E = E° − (RT / nF) · ln Q, for the Daniell cell
 *    Zn + Cu²⁺ → Zn²⁺ + Cu, with Q = [Zn²⁺] / [Cu²⁺]; and its equilibrium constant
 *    K = exp(nFE° / RT), the Q at which E = 0.
 * 3. Faraday's law: a mole of electrons carries F = 96 485 C; a charge Q moves Q / F moles
 *    of electrons, so a material that takes n lithium per formula unit of molar mass M
 *    holds n·F / M coulombs per gram (÷ 3.6 for mAh/g).
 * 4. A lithium-ion cell's open-circuit voltage at a state of charge: the cathode's potential
 *    minus the anode's, both vs Li/Li⁺ (`electrodes.ts`).
 *
 * Constants: CODATA 2018 / SI 2019 exact values for e, N_A and k_B, so F = e·N_A and
 * R = k_B·N_A exactly. 25 °C throughout.
 *
 * Simplifications, stated on the page: concentrations stand in for activities (ideal
 * solutions), voltages are open-circuit (no current, so no losses inside the cell), and
 * temperature is fixed at 25 °C.
 */
import { COUPLES, couple, type Couple } from './potentials';
import { ATOMIC, fillAt, potentialAt, type Material } from './electrodes';

/** Elementary charge, C (exact). */
export const E_CHARGE = 1.602176634e-19;
/** Avogadro's constant, 1/mol (exact). */
export const AVOGADRO = 6.02214076e23;
/** Faraday's constant, C/mol: the charge of a mole of electrons. */
export const FARADAY = E_CHARGE * AVOGADRO;
/** Gas constant, J/(mol·K). */
export const R_GAS = 1.380649e-23 * AVOGADRO;
/** 25 °C in kelvin. */
export const T25 = 298.15;
/** RT/F at 25 °C, V (≈ 25.7 mV). */
export const THERMAL_V = (R_GAS * T25) / FARADAY;
/** RT·ln10 / F at 25 °C: the voltage per tenfold change of Q for one electron (≈ 59.2 mV). */
export const NERNST_SLOPE = THERMAL_V * Math.LN10;
/** Coulombs in one milliamp-hour. */
export const MAH = 3.6;

// ---- 1. two couples ----------------------------------------------------------------------

export interface Pairing {
	/** The couple that is oxidised: the metal gives up electrons (the − terminal, anode). */
	anode: Couple;
	/** The couple that is reduced: its ions take electrons (the + terminal, cathode). */
	cathode: Couple;
	/** E°cell, V (≥ 0; 0 when both electrodes are the same). */
	voltage: number;
}

/** Whichever couple sits higher on the table is reduced, whatever order they are given in. */
export function pairing(aId: string, bId: string): Pairing {
	const a = couple(aId);
	const b = couple(bId);
	const [anode, cathode] = a.e0 <= b.e0 ? [a, b] : [b, a];
	return { anode, cathode, voltage: cathode.e0 - anode.e0 };
}

/** ΔG° = −nFE° in kJ per mole of reaction as written with n electrons. */
export const freeEnergy = (n: number, e0: number) => (-n * FARADAY * e0) / 1000;

// ---- 2. the Daniell cell and Nernst ------------------------------------------------------

export const ZINC = couple('zn');
export const COPPER = couple('cu');
/** E° of the Daniell cell, V: 0.3419 − (−0.7618) = 1.1037. */
export const DANIELL_E0 = COPPER.e0 - ZINC.e0;
/** Electrons per zinc atom. */
export const DANIELL_N = 2;

/** Nernst: the cell voltage for reaction quotient q, with n electrons, at 25 °C. */
export const nernst = (e0: number, n: number, q: number) => e0 - (NERNST_SLOPE / n) * Math.log10(q);

/** The Daniell cell's voltage with these concentrations (mol/L). */
export const daniellVoltage = (zn: number, cu: number) => nernst(DANIELL_E0, DANIELL_N, zn / cu);

/** log₁₀ of the equilibrium constant K = exp(nFE°/RT). */
export const log10K = (e0: number, n: number) => (n * e0) / NERNST_SLOPE;

/** The Daniell beakers of the page: each 100 mL, both solutions 1.0 mol/L to start. */
export const BEAKER_L = 0.1;
export const START_M = 1;

export interface DaniellState {
	/** Charge passed through the wire, mol of electrons. */
	electrons: number;
	/** The same in amp-hours. */
	ah: number;
	/** mol/L. */
	zn: number;
	cu: number;
	/** log₁₀ [Cu²⁺], kept separately so it stays finite near the end. */
	logCu: number;
	/** Cell voltage, V. */
	voltage: number;
}

/** Most electrons the beakers can pass: two per Cu²⁺ ion, 0.2 mol. */
export const DANIELL_MAX_E = DANIELL_N * START_M * BEAKER_L;

/**
 * The Daniell cell after a share `used` (0–1) of its copper ions has been turned into
 * copper. Each Cu²⁺ reduced takes 2 e⁻ through the wire and lets one Zn²⁺ into the zinc
 * beaker (Faraday's law). Equilibrium: the cell stops when E = 0, i.e. when
 * [Zn²⁺]/[Cu²⁺] = K; `used` is capped there.
 */
export function daniellAt(used: number): DaniellState {
	const total = START_M * 2;
	const logK = log10K(DANIELL_E0, DANIELL_N);
	// At equilibrium [Cu²⁺] = [Zn²⁺]/K ≈ 2 × 10⁻³⁷·³ mol/L: as close to zero as anything gets.
	const logCuEq = Math.log10(total) - logK;
	const u = Math.max(0, Math.min(1, used));
	const left = START_M * (1 - u);
	const logCu = left > 0 ? Math.max(Math.log10(left), logCuEq) : logCuEq;
	const cu = 10 ** logCu;
	const zn = total - cu;
	const electrons = DANIELL_N * (START_M - cu) * BEAKER_L;
	const voltage = DANIELL_E0 - (NERNST_SLOPE / DANIELL_N) * (Math.log10(zn) - logCu);
	return { electrons, ah: (electrons * FARADAY) / 3600, zn, cu, logCu, voltage };
}

// ---- 3. Faraday's law: capacity --------------------------------------------------------------

/** Charge one gram can store if every host unit takes `liPerUnit` lithium: mAh/g. */
export const theoreticalCapacity = (m: Pick<Material, 'liPerUnit' | 'molarMass'>) =>
	(m.liPerUnit * FARADAY) / m.molarMass / MAH;

/** The part of that a real cell uses (its window of lithium fraction): mAh/g. */
export const usableCapacity = (m: Material) => theoreticalCapacity(m) * Math.abs(m.full - m.empty);

/** Moles of lithium (one electron each) that move for a charge of `ah` amp-hours. */
export const lithiumMoles = (ah: number) => (ah * 3600) / FARADAY;
/** …and their mass in grams. */
export const lithiumGrams = (ah: number) => lithiumMoles(ah) * ATOMIC.Li;

// ---- 4. a lithium-ion cell ------------------------------------------------------------------

/** Open-circuit voltage of a cathode/anode pair at a state of charge (0–1). */
export const cellVoltage = (cathode: Material, anode: Material, soc: number) =>
	potentialAt(cathode, soc) - potentialAt(anode, soc);

/** Sampled voltage curve: from empty (0) to full (1). */
export function voltageCurve(cathode: Material, anode: Material, samples = 120) {
	return Array.from({ length: samples + 1 }, (_, i) => {
		const soc = i / samples;
		return {
			soc,
			cathode: potentialAt(cathode, soc),
			anode: potentialAt(anode, soc),
			v: cellVoltage(cathode, anode, soc)
		};
	});
}

/** Mean voltage over a full discharge (energy ÷ charge), by the trapezium rule. */
export function meanVoltage(cathode: Material, anode: Material, samples = 400) {
	let sum = 0;
	for (let i = 0; i < samples; i++) {
		const a = cellVoltage(cathode, anode, i / samples);
		const b = cellVoltage(cathode, anode, (i + 1) / samples);
		sum += (a + b) / 2;
	}
	return sum / samples;
}

export interface PairFigures {
	/** Usable mAh/g of each. */
	qCathode: number;
	qAnode: number;
	/** Grams of each needed per amp-hour. */
	gCathode: number;
	gAnode: number;
	/** mAh per gram of the two together. */
	qPair: number;
	meanV: number;
	/** Wh per kg of the two active materials together. */
	specificEnergy: number;
	/** Voltage when full and when empty. */
	vFull: number;
	vEmpty: number;
}

/** The figures of a matched pair: each electrode sized to hold the same charge. */
export function pairFigures(cathode: Material, anode: Material): PairFigures {
	const qCathode = usableCapacity(cathode);
	const qAnode = usableCapacity(anode);
	const gCathode = 1000 / qCathode;
	const gAnode = 1000 / qAnode;
	const qPair = 1000 / (gCathode + gAnode);
	const meanV = meanVoltage(cathode, anode);
	return {
		qCathode,
		qAnode,
		gCathode,
		gAnode,
		qPair,
		meanV,
		specificEnergy: qPair * meanV,
		vFull: cellVoltage(cathode, anode, 1),
		vEmpty: cellVoltage(cathode, anode, 0)
	};
}

/** Lithium fractions of both electrodes at a state of charge, for drawing them. */
export const fills = (cathode: Material, anode: Material, soc: number) => ({
	cathode: fillAt(cathode, soc),
	anode: fillAt(anode, soc)
});

// ---- the LG M50 cell (Chen et al. 2020) ------------------------------------------------------

/**
 * The cell drawn in cross-section: LG INR21700 M50, NMC 811 against graphite (with a little
 * silicon oxide, ignored here). From Chen et al., J. Electrochem. Soc. 167, 080534 (2020):
 * rated 5 Ah between 2.5 and 4.2 V, 68.38 g with its can; layer thicknesses in µm (PyBaMM
 * Chen2020 parameter set, from the same paper).
 */
export const M50 = {
	capacityAh: 5,
	vMin: 2.5,
	vMax: 4.2,
	massG: 68.38,
	layers: { cu: 12, anode: 85.2, separator: 12, cathode: 75.6, al: 16 }
} as const;

export { COUPLES };
