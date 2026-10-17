/**
 * Crystals and semiconductors: the model behind the explainer. Everything is at room
 * temperature, T = 300 K.
 *
 * Sources:
 * - Constants: CODATA 2018 (Boltzmann constant in eV/K, elementary charge, vacuum
 *   permittivity).
 * - Band gaps at 300 K: silicon 1.12 eV, germanium 0.66 eV, diamond 5.47 eV (S. M. Sze and
 *   K. K. Ng, Physics of Semiconductor Devices, 3rd ed., Wiley 2007, appendix tables; Kittel,
 *   Introduction to Solid State Physics, Table 8.1, gives the same for Si and Ge and
 *   5.4 eV for diamond).
 * - Intrinsic carrier density of silicon at 300 K: 9.65 × 10⁹ cm⁻³ (Sze & Ng 2007,
 *   P. P. Altermatt et al., J. Appl. Phys. 93, 1598 (2003)); germanium
 *   2.0 × 10¹³ cm⁻³ (Sze & Ng 2007).
 * - Silicon's lattice constant 5.431 Å (CODATA 2018: 5.431 020 511 Å), 8 atoms per cubic
 *   cell (diamond structure): 5.0 × 10²² atoms per cm³.
 * - Relative permittivity of silicon 11.7 (Ioffe Institute, NSM semiconductor archive).
 * - Ionisation energies of dopants in silicon: phosphorus 45 meV, arsenic 54 meV (donors),
 *   boron 45 meV (acceptor) (Sze & Ng 2007, measured ionisation energies of impurities
 *   in Si).
 * - Mobility against doping: G. Masetti, M. Severi and S. Solmi, IEEE Trans. Electron
 *   Devices ED-30, 764 (1983), Table I: phosphorus-doped (electrons) and boron-doped
 *   (holes) silicon. The parameters were checked against the Allpix Squared
 *   documentation, which implements the same table.
 * - Copper's resistivity 1.68 × 10⁻⁶ Ω·cm at 20 °C (CRC Handbook of Chemistry and
 *   Physics).
 * - Diode: the ideal (Shockley) diode equation I = Iₛ (e^(V/Vₜ) − 1) with an ideality
 *   factor of 1. Iₛ = 10⁻¹⁵ A is the order of magnitude Sedra & Smith (Microelectronic
 *   Circuits) give for a small-signal silicon diode; it depends on the junction's area and
 *   doping and is not computed from the doping drawn on the page.
 * - Junction: abrupt junction in the depletion approximation (Sze & Ng §2.2): built-in
 *   voltage V_bi = Vₜ ln(N_A N_D / nᵢ²), depletion width
 *   W = √(2 ε (V_bi − V)/q · (1/N_A + 1/N_D)), valid for V below V_bi.
 * - Energy levels into bands: a chain of N identical atoms in the tight-binding picture,
 *   E_k = E₀ − 2β cos(kπ/(N + 1)), k = 1…N: N levels inside a band of width 4β.
 */
import { ELEMENTS } from '../atoms-periodic-table/atom';

// ------------------------------------------------------------------ constants

/** Boltzmann constant (eV/K), CODATA 2018 (exact). */
export const K_B = 8.617333262e-5;
/** Elementary charge (C), exact. */
export const Q = 1.602176634e-19;
/** Vacuum permittivity (F/cm), CODATA 2018. */
const EPS0 = 8.8541878128e-14;
/** Room temperature (K). */
export const T_ROOM = 300;
/** Thermal energy kT at room temperature (eV) — also the thermal voltage Vₜ in volts. */
export const KT = K_B * T_ROOM;

// ------------------------------------------------------------------ materials

export type Material = 'metal' | 'insulator' | 'semiconductor';

interface Gap {
	name: string;
	symbol: string;
	/** Band gap at 300 K (eV). */
	gap: number;
}

/** Band gaps at 300 K (Sze & Ng 2007). */
export const GAPS: Record<'Ge' | 'Si' | 'C', Gap> = {
	Ge: { name: 'germanium', symbol: 'Ge', gap: 0.66 },
	Si: { name: 'silicon', symbol: 'Si', gap: 1.12 },
	C: { name: 'diamond', symbol: 'C', gap: 5.47 }
};

/** Intrinsic carrier densities at 300 K (cm⁻³; Sze & Ng 2007). */
export const NI_SI = 9.65e9;
export const NI_GE = 2.0e13;

/** Silicon lattice constant (cm). */
const A_SI = 5.431e-8;
/** Silicon atoms per cm³: 8 per cubic cell of the diamond structure. */
export const N_SI = 8 / A_SI ** 3;
/** Relative permittivity of silicon. */
const EPS_SI = 11.7;
/** Copper's resistivity (Ω·cm) at 20 °C. */
export const RHO_COPPER = 1.68e-6;

/**
 * Boltzmann factor for an electron to cross a gap by heat alone, e^(−Eg/2kT). Ratios of
 * it between materials give the order of magnitude only (they ignore the densities of
 * states, which differ by a few times).
 */
export const crossing = (gap: number, T = T_ROOM) => Math.exp(-gap / (2 * K_B * T));

// ------------------------------------------------------------------ dopants

export type Dopant = 'P' | 'As' | 'B';
export type Site = 'Si' | Dopant;

/** Ionisation energies in silicon (eV): how far below the conduction band (donors) or
 * above the valence band (acceptors) the dopant's level sits. */
export const IONISATION: Record<Dopant, number> = { P: 0.045, As: 0.054, B: 0.045 };

const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));

export function elementName(sym: Site): string {
	return BY_SYMBOL.get(sym)?.name ?? sym;
}

/** Outer (valence) electrons, from the group in the element data: 13 → 3, 14 → 4, 15 → 5. */
export function valence(sym: Site): number {
	const g = BY_SYMBOL.get(sym)?.group;
	if (!g || g < 13) throw new Error(`not a group 13–15 element: ${sym}`);
	return g - 10;
}

/** A donor has one outer electron more than silicon, an acceptor one fewer. */
export const role = (sym: Site): 'donor' | 'acceptor' | 'host' =>
	valence(sym) > valence('Si') ? 'donor' : valence(sym) < valence('Si') ? 'acceptor' : 'host';

/**
 * Free carriers made by the dopants in a patch of crystal (ignoring the very rare
 * thermal pairs). Each donor's spare electron fills an acceptor's missing one first
 * (compensation); what is left over is free.
 */
export function patchCarriers(sites: Site[]) {
	const donors = sites.filter((s) => role(s) === 'donor').length;
	const acceptors = sites.filter((s) => role(s) === 'acceptor').length;
	return {
		donors,
		acceptors,
		electrons: Math.max(0, donors - acceptors),
		holes: Math.max(0, acceptors - donors)
	};
}

/**
 * Electron and hole densities (cm⁻³) in silicon with donor density nd and acceptor
 * density na, all dopants ionised (true at room temperature for these shallow
 * dopants up to ~10¹⁸ cm⁻³; above that the donor levels merge with the band, so their
 * electrons still conduct). Charge neutrality plus the mass-action law n·p = nᵢ².
 */
export function carriers(nd: number, na: number, ni = NI_SI) {
	const net = nd - na;
	const half = net / 2;
	const root = Math.sqrt(half * half + ni * ni);
	// Avoid cancellation: compute the majority carrier directly, the minority from n·p = nᵢ².
	if (net >= 0) {
		const n = half + root;
		return { n, p: (ni * ni) / n };
	}
	const p = -half + root;
	return { n: (ni * ni) / p, p };
}

/** Electron mobility (cm²/V·s) in phosphorus-doped silicon (Masetti et al. 1983). */
function electronMobility(nTotal: number) {
	const N = Math.max(nTotal, 1);
	return 68.5 + (1414 - 68.5) / (1 + (N / 9.2e16) ** 0.711) - 56.1 / (1 + (3.41e20 / N) ** 1.98);
}

/** Hole mobility (cm²/V·s) in boron-doped silicon (Masetti et al. 1983). */
function holeMobility(nTotal: number) {
	const N = Math.max(nTotal, 1);
	return (
		44.9 * Math.exp(-9.23e16 / N) +
		470.5 / (1 + (N / 2.23e17) ** 0.719) -
		29.0 / (1 + (6.1e20 / N) ** 2.0)
	);
}

/** Conductivity (S/cm) and resistivity (Ω·cm) of silicon doped with nd donors and na acceptors per cm³. */
export function conductivity(nd: number, na: number) {
	const { n, p } = carriers(nd, na);
	const N = nd + na;
	const sigma = Q * (n * electronMobility(N) + p * holeMobility(N));
	return { n, p, sigma, rho: 1 / sigma };
}

/** Pure (intrinsic) silicon. */
export const INTRINSIC = conductivity(0, 0);

/** "One dopant atom for every … silicon atoms" at a concentration (cm⁻³). */
export const atomsPerDopant = (conc: number) => N_SI / conc;

// ------------------------------------------------------------------ the p–n junction

/** Doping on each side of the junction drawn on the page (cm⁻³). */
export const JUNCTION_DOPING = 1e17;

/** Built-in voltage (V) of an abrupt junction. */
export const builtIn = (na = JUNCTION_DOPING, nd = JUNCTION_DOPING) =>
	KT * Math.log((na * nd) / (NI_SI * NI_SI));

/** Depletion width (µm) at applied voltage V (positive = forward), for V below V_bi. */
export function depletionWidth(V: number, na = JUNCTION_DOPING, nd = JUNCTION_DOPING) {
	const drop = Math.max(builtIn(na, nd) - V, 0);
	const w = Math.sqrt(((2 * EPS_SI * EPS0 * drop) / Q) * (1 / na + 1 / nd));
	return w * 1e4;
}

/** Saturation current of the drawn diode (A): a typical small-signal silicon diode. */
export const I_SAT = 1e-15;

/** Ideal diode current (A) at voltage V (positive = forward: + on the p side). */
export const diodeCurrent = (V: number, Is = I_SAT, T = T_ROOM) => Is * Math.expm1(V / (K_B * T));

/**
 * Electron energy of the conduction-band edge across the junction, relative to the
 * n side, as a fraction of the total step q(V_bi − V): 1 deep in the p side, 0 deep in
 * the n side. `x` is the position (µm) from the metallurgical junction, positive into
 * the n side. Symmetric doping: the potential is two parabolas that meet at x = 0.
 */
export function bandStep(x: number, V: number) {
	const w = depletionWidth(V) / 2; // each side's share (symmetric doping)
	if (w <= 0) return x < 0 ? 1 : 0;
	if (x <= -w) return 1;
	if (x >= w) return 0;
	const u = x < 0 ? (x + w) / w : (w - x) / w;
	return x < 0 ? 1 - 0.5 * u * u : 0.5 * u * u;
}

// ------------------------------------------------------------------ levels into bands

/**
 * Energies of the N levels that one atomic level becomes in a chain of N atoms (tight
 * binding, nearest neighbours): E₀ − 2β cos(kπ/(N + 1)), k = 1…N.
 */
export function chainLevels(N: number, E0 = 0, beta = 1): number[] {
	return Array.from(
		{ length: N },
		(_, i) => E0 - 2 * beta * Math.cos(((i + 1) * Math.PI) / (N + 1))
	);
}

// ------------------------------------------------------------------ formatting

const SUP: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹'
};
export const sup = (n: number) =>
	String(n)
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');

/** 1.2 × 10¹⁶ style, with `digits` significant figures; plain for 0.01 ≤ |v| < 10 000. */
export function sci(v: number, digits = 2): string {
	if (v === 0) return '0';
	const a = Math.abs(v);
	if (a >= 0.01 && a < 1e4) return Number(v.toPrecision(digits)).toLocaleString('en-US');
	const e = Math.floor(Math.log10(a));
	const m = v / 10 ** e;
	const ms = Number(m.toPrecision(digits));
	if (Math.abs(ms) === 10) return `${ms < 0 ? '−' : ''}10${sup(e + 1)}`;
	if (Math.abs(ms) === 1) return `${ms < 0 ? '−' : ''}10${sup(e)}`;
	return `${ms.toString().replace('-', '−')} × 10${sup(e)}`;
}

/** Current with an SI prefix: "0.58 mA", "1 fA". */
export function amps(I: number): string {
	const a = Math.abs(I);
	const sign = I < 0 ? '−' : '';
	if (a === 0) return '0 A';
	const units: [number, string][] = [
		[1, 'A'],
		[1e-3, 'mA'],
		[1e-6, 'µA'],
		[1e-9, 'nA'],
		[1e-12, 'pA'],
		[1e-15, 'fA'],
		[1e-18, 'aA']
	];
	const [f, u] = units.find(([f]) => a >= f * 0.9995) ?? units[units.length - 1];
	const v = a / f;
	const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
	return `${sign}${s} ${u}`;
}
