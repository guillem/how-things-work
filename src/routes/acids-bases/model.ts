/**
 * Acid–base equilibrium in water, solved exactly from the charge balance.
 *
 * A solution is a list of acid–base systems plus fixed ("spectator") ions. Each
 * system is a family of species that differ only by protons, e.g. CH₃COOH / CH₃COO⁻
 * or H₂CO₃ / HCO₃⁻ / CO₃²⁻, with total concentration `c` (mol/L), the charge `z`
 * of its most protonated form and its stepwise pKa values. A strong acid such as
 * HCl gives away its proton completely, so it is just a fixed anion (Cl⁻); a strong
 * base such as NaOH is a fixed cation (Na⁺).
 *
 * The pH is the one root of the charge balance
 *
 *   [H⁺] + Σ cations = [OH⁻] + Σ anions − Σ c·(z − n̄),   [OH⁻] = Kw / [H⁺]
 *
 * where n̄ is the average number of protons a system has lost at that [H⁺]. The
 * left minus the right falls steadily as the pH rises, so bisection on the pH finds
 * it to any precision, with no approximation (no Henderson–Hasselbalch, no
 * "√(Ka·c)" shortcut).
 *
 * Simplifications, stated on the page: 25 °C, and concentrations stand in for
 * activities (an ideal dilute solution), so pH = −log₁₀[H⁺] exactly.
 *
 * Constants:
 *   Kw = 1.0 × 10⁻¹⁴ at 25 °C (pKw = 14.00), the measured 1.01 × 10⁻¹⁴ (pKw 13.995 at
 *   0.1 MPa: A. V. Bandura and S. N. Lvov, "The ionization constant of water over wide
 *   ranges of temperature and density", J. Phys. Chem. Ref. Data 35, 15 (2006)) rounded
 *   to the two figures textbooks use, so that neutral water is pH 7.00 exactly.
 *   Acid pKa values at 25 °C: CRC Handbook of Chemistry and Physics, 84th ed. (2004),
 *   "Dissociation constants of inorganic acids and bases" and "… of organic acids
 *   and bases", as reproduced in the LibreTexts table "Acid Dissociation Constants"
 *   (chem.libretexts.org, University of Toronto, Chemistry: Physical Principles,
 *   §12.3); NH₄⁺ 9.25 from the same CRC tables.
 *   Henry's law constant of CO₂ in water at 25 °C, 3.3 × 10⁻⁴ mol m⁻³ Pa⁻¹
 *   (0.034 mol L⁻¹ atm⁻¹): R. Sander, Atmos. Chem. Phys. 15, 4399 (2015).
 */

export const PKW = 14;
export const KW = 10 ** -PKW;
/** Avogadro's constant, per mole (exact, SI 2019). */
export const AVOGADRO = 6.02214076e23;

export interface AcidSystem {
	/** Total concentration of all forms, mol/L. */
	c: number;
	/** Charge of the most protonated form (0 for CH₃COOH, +1 for NH₄⁺). */
	z: number;
	/** Stepwise pKa values, strongest first. */
	pKa: readonly number[];
}

export interface Solution {
	systems?: readonly AcidSystem[];
	/** Fixed positive charge (mol/L of charge), e.g. Na⁺ from NaOH. */
	cations?: number;
	/** Fixed negative charge (mol/L of charge), e.g. Cl⁻ from HCl. */
	anions?: number;
}

/**
 * Average number of protons lost by one system at hydrogen-ion concentration h:
 * the fractions of its forms are proportional to Ka₁…Kaⱼ / hʲ.
 */
export function protonsLost(pKa: readonly number[], h: number): number {
	// Work in logs so that very small or large ratios do not overflow.
	const logH = Math.log10(h);
	const logs = [0];
	let acc = 0;
	for (let j = 0; j < pKa.length; j++) {
		acc += -pKa[j] - logH;
		logs.push(acc);
	}
	const top = Math.max(...logs);
	let sum = 0;
	let weighted = 0;
	for (let j = 0; j < logs.length; j++) {
		const w = 10 ** (logs[j] - top);
		sum += w;
		weighted += j * w;
	}
	return weighted / sum;
}

/** Fractions of each form of a system (most protonated first) at h. */
export function fractions(pKa: readonly number[], h: number): number[] {
	const logH = Math.log10(h);
	const logs = [0];
	let acc = 0;
	for (const p of pKa) {
		acc += -p - logH;
		logs.push(acc);
	}
	const top = Math.max(...logs);
	const w = logs.map((l) => 10 ** (l - top));
	const sum = w.reduce((a, b) => a + b, 0);
	return w.map((v) => v / sum);
}

/** Net charge (mol/L) of everything in the solution at pH `ph`. */
function netCharge(s: Solution, ph: number): number {
	const h = 10 ** -ph;
	let q = h - KW / h + (s.cations ?? 0) - (s.anions ?? 0);
	for (const sys of s.systems ?? []) q += sys.c * (sys.z - protonsLost(sys.pKa, h));
	return q;
}

/** The pH of a solution: the root of its charge balance, by bisection. */
export function solvePH(s: Solution): number {
	let lo = -3;
	let hi = 17;
	for (let k = 0; k < 80; k++) {
		const mid = (lo + hi) / 2;
		if (netCharge(s, mid) > 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ---- acids for the titration ---------------------------------------------------------

export type AcidId = 'hcl' | 'acetic' | 'hocl';

export interface Acid {
	id: AcidId;
	name: string;
	formula: string;
	/** Formula of the anion left after it gives up its proton. */
	anion: string;
	/** null: a strong acid, which gives away all its protons. */
	pKa: number | null;
}

export const ACIDS: Record<AcidId, Acid> = {
	hcl: { id: 'hcl', name: 'hydrochloric acid', formula: 'HCl', anion: 'Cl⁻', pKa: null },
	acetic: {
		id: 'acetic',
		name: 'acetic acid',
		formula: 'CH₃COOH',
		anion: 'CH₃COO⁻',
		pKa: 4.756
	},
	hocl: {
		id: 'hocl',
		name: 'hypochlorous acid',
		formula: 'HOCl',
		anion: 'OCl⁻',
		pKa: 7.4
	}
};

/** An acid at concentration c (mol/L) with c_b mol/L of Na⁺ from added NaOH. */
export function acidSolution(acid: Acid, c: number, cb = 0): Solution {
	return acid.pKa === null
		? { anions: c, cations: cb }
		: { systems: [{ c, z: 0, pKa: [acid.pKa] }], cations: cb };
}

/** pH of the acid alone at concentration c. */
export function acidPH(acid: Acid, c: number): number {
	return solvePH(acidSolution(acid, c));
}

/** Share of the acid's molecules that have given away their proton, at concentration c. */
export function dissociated(acid: Acid, c: number): number {
	if (acid.pKa === null) return 1;
	const h = 10 ** -acidPH(acid, c);
	return fractions([acid.pKa], h)[1];
}

// ---- titration --------------------------------------------------------------------------

export interface Titration {
	acid: Acid;
	/** Acid concentration in the flask before any base, mol/L. */
	ca: number;
	/** Volume of acid in the flask, mL. */
	va: number;
	/** Concentration of the NaOH in the burette, mol/L. */
	cb: number;
}

/** The titration on the page: 25.00 mL of 0.100 mol/L acid, 0.100 mol/L NaOH. */
export function standard(acid: Acid): Titration {
	return { acid, ca: 0.1, va: 25, cb: 0.1 };
}

/** One drop from a burette, mL (a typical burette drop is about 0.05 mL). */
export const DROP = 0.05;

/** Volume of base at which the moles of OH⁻ added equal the moles of acid, mL. */
export function equivalenceVolume(T: Titration): number {
	return (T.ca * T.va) / T.cb;
}

/** pH in the flask after `vb` mL of base. */
export function titrationPH(T: Titration, vb: number): number {
	const v = T.va + vb;
	return solvePH(acidSolution(T.acid, (T.ca * T.va) / v, (T.cb * vb) / v));
}

/** pH curve sampled every `dv` mL from 0 to `vmax`, plus the points around equivalence. */
export function titrationCurve(T: Titration, vmax: number, dv = 0.25): { v: number; ph: number }[] {
	const veq = equivalenceVolume(T);
	const vs = new Set<number>();
	for (let v = 0; v <= vmax + 1e-9; v += dv) vs.add(Number(v.toFixed(4)));
	// Fine samples near equivalence so the jump is drawn as steep as it is.
	for (let k = -40; k <= 40; k++) {
		const v = veq + k * 0.01;
		if (v >= 0 && v <= vmax) vs.add(Number(v.toFixed(4)));
	}
	return [...vs].sort((a, b) => a - b).map((v) => ({ v, ph: titrationPH(T, v) }));
}

// ---- counting ions -----------------------------------------------------------------------

/** Volume of the cube in the zoomed view: 1 µm on a side = 10⁻¹⁵ L. */
export const CUBE_LITRES = 1e-15;

/** Average number of H⁺ (H₃O⁺) and OH⁻ ions in a 1 µm cube at pH `ph`. */
export function ionsInCube(ph: number): { h: number; oh: number } {
	const h = 10 ** -ph;
	return { h: h * AVOGADRO * CUBE_LITRES, oh: (KW / h) * AVOGADRO * CUBE_LITRES };
}

/** Water molecules in the same cube (density 0.997 g/mL at 25 °C, 18.015 g/mol). */
export const WATER_IN_CUBE = ((0.997 * 1000) / 18.015) * AVOGADRO * CUBE_LITRES;

// ---- indicators ----------------------------------------------------------------------------

/**
 * Indicator dyes are weak acids themselves, with an acid form and a base form of
 * different colours. The share in the base form is 1 / (1 + 10^(pKIn − pH)).
 * pKIn values, colour change ranges and colours: W. Locke, "Acid–Base Indicators and
 * Titrations", Department of Chemistry, Imperial College London
 * (ch.ic.ac.uk/rzepa/aptonge/mdl/indi/indicator.html).
 */
export type IndicatorId = 'methylOrange' | 'bromothymol' | 'phenolphthalein';

export interface Indicator {
	id: IndicatorId;
	name: string;
	pKIn: number;
	range: readonly [number, number];
	acidName: string;
	baseName: string;
	/** sRGB colours of the acid and base forms; null: colourless. */
	acidColor: readonly [number, number, number] | null;
	baseColor: readonly [number, number, number] | null;
}

export const INDICATORS: Record<IndicatorId, Indicator> = {
	methylOrange: {
		id: 'methylOrange',
		name: 'methyl orange',
		pKIn: 3.7,
		range: [3.2, 4.4],
		acidName: 'red',
		baseName: 'yellow',
		acidColor: [214, 48, 49],
		baseColor: [245, 190, 40]
	},
	bromothymol: {
		id: 'bromothymol',
		name: 'bromothymol blue',
		pKIn: 7.0,
		range: [6.0, 7.6],
		acidName: 'yellow',
		baseName: 'blue',
		acidColor: [236, 200, 40],
		baseColor: [40, 100, 210]
	},
	phenolphthalein: {
		id: 'phenolphthalein',
		name: 'phenolphthalein',
		pKIn: 9.4,
		range: [8.2, 10.0],
		acidName: 'colourless',
		baseName: 'pink',
		acidColor: null,
		baseColor: [222, 40, 140]
	}
};

/** Share of the indicator in its base form at pH `ph`. */
export function indicatorBase(ind: Indicator, ph: number): number {
	return 1 / (1 + 10 ** (ind.pKIn - ph));
}

/**
 * Colour of the solution: the two forms mixed by their shares. A colourless form
 * adds no colour, so the mix is the coloured form at an opacity equal to its share.
 */
export function indicatorColor(ind: Indicator, ph: number): { rgb: string; alpha: number } {
	const f = indicatorBase(ind, ph);
	const a = ind.acidColor;
	const b = ind.baseColor;
	const hex = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v)).join(', ')})`;
	if (a && b) return { rgb: hex(a.map((v, i) => v + (b[i] - v) * f)), alpha: 1 };
	if (b) return { rgb: hex(b), alpha: f };
	if (a) return { rgb: hex(a), alpha: 1 - f };
	return { rgb: 'rgb(0, 0, 0)', alpha: 0 };
}
