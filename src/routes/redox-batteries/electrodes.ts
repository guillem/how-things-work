/**
 * Lithium-ion electrode materials: their potential against lithium metal (V vs Li/Li⁺)
 * as a function of how full of lithium they are, the window of that filling a real cell
 * uses, and what one formula unit weighs (for Faraday's law, in `model.ts`).
 *
 * Each curve is a published open-circuit-potential (OCP) fit, as implemented in the
 * PyBaMM parameter library (github.com/pybamm-team/PyBaMM,
 * packages/pybamm/src/pybamm/input/parameters/lithium_ion/, BSD 3-clause licence,
 * fetched October 2026). The coefficients are copied unchanged; only the window each
 * fit is evaluated over is our choice, stated per material, and every fit is used only
 * inside its window (the LiCoO₂ and silicon fits have poles outside it).
 *
 *   graphite  — Chen2020.py, graphite_LGM50_ocp_Chen2020: C.-H. Chen, F. Brosa Planella,
 *               K. O'Regan, D. Gastol, W. D. Widanage and E. Kendrick, "Development of
 *               experimental techniques for parameterization of multi-scale lithium-ion
 *               battery models", J. Electrochem. Soc. 167, 080534 (2020), LG M50 cell.
 *               Window: x = 0.0279 (0 % charge) to 0.9014 (100 %), from that paper.
 *   NMC 811   — Chen2020.py, nmc_LGM50_ocp_Chen2020, same paper and cell. Window:
 *               y = 0.9084 (0 %) to 0.2661 (100 %), from that paper.
 *   LiCoO₂    — Ramadass2004.py, lico2_ocp_Ramadass2004: P. Ramadass, B. Haran,
 *               P. M. Gomadam, R. White and B. N. Popov, "Development of first principles
 *               capacity fade model for Li-ion cells", J. Electrochem. Soc. 151, A196
 *               (2004). The fit's variable is stretched by 1.13 (u = 1.13·sto); we take
 *               u as the lithium content y of LiᵧCoO₂, window y = 0.97 to 0.50: about
 *               half the lithium, the usual limit for LiCoO₂ (A. Manthiram, Nat. Commun.
 *               11, 1550 (2020): "practical capacity … limited to ~140 mA h g⁻¹").
 *   LiFePO₄   — Prada2013.py, LFP_ocp_Afshar2017: S. Afshar, K. Morris and A. Khajepour,
 *               "Efficient electrochemical model for lithium-ion cells", arXiv:1709.03970
 *               (2017). Window: y = 0.99 to 0.01.
 *   silicon   — Chen2020_composite.py, silicon_ocp_(de)lithiation_Mark2016: M. Verbrugge,
 *               D. Baker and X. Xiao, J. Electrochem. Soc. 163, A262 (2016). Silicon's
 *               charge and discharge curves differ (hysteresis); we use their average,
 *               as PyBaMM's silicon_ocp_average_Mark2016 does. Full = Li₁₅Si₄.
 *               Window: x = 0.02 to 0.98.
 *   lithium   — the reference electrode itself: 0 V by definition.
 *
 * Simplification (stated on the page): "full" means one lithium per formula unit of the
 * host (LiC₆, LiMO₂, LiFePO₄, Li₁₅Si₄ per silicon as 3.75 Li per Si), and the share of
 * that a cell uses is the window above.
 */

export type Side = 'anode' | 'cathode';

export interface Material {
	id: string;
	name: string;
	/** Short formula for labels. */
	formula: string;
	side: Side;
	/** Grams per mole of host that holds `liPerUnit` lithium when full. */
	molarMass: number;
	/** Lithium per formula unit when full. */
	liPerUnit: number;
	/** Lithium fraction (0–1 of full) at 0 % and at 100 % state of charge of a cell. */
	empty: number;
	full: number;
	/** Open-circuit potential, V vs Li/Li⁺, at lithium fraction s (inside the window). */
	ocp: (s: number) => number;
	/** What is oxidised or reduced in it. */
	redox: string;
}

// IUPAC standard atomic weights (abridged, 2021), g/mol.
export const ATOMIC = {
	Li: 6.94,
	C: 12.011,
	O: 15.999,
	P: 30.974,
	Si: 28.085,
	Fe: 55.845,
	Co: 58.933,
	Ni: 58.693,
	Mn: 54.938,
	Cu: 63.546,
	Zn: 65.38
} as const;

const A = ATOMIC;

function graphiteChen2020(s: number) {
	return (
		1.9793 * Math.exp(-39.3631 * s) +
		0.2482 -
		0.0909 * Math.tanh(29.8538 * (s - 0.1234)) -
		0.04478 * Math.tanh(14.9159 * (s - 0.2769)) -
		0.0205 * Math.tanh(30.4444 * (s - 0.6103))
	);
}

function nmcChen2020(s: number) {
	return (
		-0.809 * s +
		4.4875 -
		0.0428 * Math.tanh(18.5138 * (s - 0.5542)) -
		17.7326 * Math.tanh(15.789 * (s - 0.3117)) +
		17.5842 * Math.tanh(15.9308 * (s - 0.312))
	);
}

/** LiCoO₂, with `u` the fit's stretched variable (1.13 × sto), read as y in LiᵧCoO₂. */
function lcoRamadass2004(u: number) {
	const s2 = u * u;
	const s4 = s2 * s2;
	const s6 = s4 * s2;
	const s8 = s4 * s4;
	const s10 = s8 * s2;
	return (
		(-4.656 + 88.669 * s2 - 401.119 * s4 + 342.909 * s6 - 462.471 * s8 + 433.434 * s10) /
		(-1 + 18.933 * s2 - 79.532 * s4 + 37.311 * s6 - 73.083 * s8 + 95.96 * s10)
	);
}

function lfpAfshar2017(s: number) {
	return 3.4077 - 0.020269 * s + 0.5 * Math.exp(-150 * s) - 0.9 * Math.exp(-30 * (1 - s));
}

function siliconMark2016(s: number) {
	const lith =
		-96.63 * s ** 7 +
		372.6 * s ** 6 -
		587.6 * s ** 5 +
		489.9 * s ** 4 -
		232.8 * s ** 3 +
		62.99 * s ** 2 -
		9.286 * s +
		0.8633 +
		1e-4 * (1 / s + 1 / (s - 1));
	const delith =
		-51.02 * s ** 7 +
		161.3 * s ** 6 -
		205.7 * s ** 5 +
		140.2 * s ** 4 -
		58.76 * s ** 3 +
		16.87 * s ** 2 -
		3.792 * s +
		0.9937;
	return (lith + delith) / 2;
}

export const MATERIALS: readonly Material[] = [
	{
		id: 'nmc',
		name: 'NMC 811',
		formula: 'LiNi₀.₈Mn₀.₁Co₀.₁O₂',
		side: 'cathode',
		molarMass: A.Li + 0.8 * A.Ni + 0.1 * A.Mn + 0.1 * A.Co + 2 * A.O,
		liPerUnit: 1,
		empty: 0.9084,
		full: 0.2661,
		ocp: nmcChen2020,
		redox: 'nickel (Ni⁴⁺ ⇌ Ni²⁺)'
	},
	{
		id: 'lco',
		name: 'lithium cobalt oxide',
		formula: 'LiCoO₂',
		side: 'cathode',
		molarMass: A.Li + A.Co + 2 * A.O,
		liPerUnit: 1,
		empty: 0.97,
		full: 0.5,
		ocp: lcoRamadass2004,
		redox: 'cobalt (Co⁴⁺ ⇌ Co³⁺)'
	},
	{
		id: 'lfp',
		name: 'lithium iron phosphate',
		formula: 'LiFePO₄',
		side: 'cathode',
		molarMass: A.Li + A.Fe + A.P + 4 * A.O,
		liPerUnit: 1,
		empty: 0.99,
		full: 0.01,
		ocp: lfpAfshar2017,
		redox: 'iron (Fe³⁺ ⇌ Fe²⁺)'
	},
	{
		id: 'graphite',
		name: 'graphite',
		formula: 'LiC₆',
		side: 'anode',
		molarMass: 6 * A.C,
		liPerUnit: 1,
		empty: 0.0279,
		full: 0.9014,
		ocp: graphiteChen2020,
		redox: 'the carbon layers'
	},
	{
		id: 'silicon',
		name: 'silicon',
		formula: 'Li₁₅Si₄',
		side: 'anode',
		molarMass: A.Si,
		liPerUnit: 3.75,
		empty: 0.02,
		full: 0.98,
		ocp: siliconMark2016,
		redox: 'silicon'
	},
	{
		id: 'limetal',
		name: 'lithium metal',
		formula: 'Li',
		side: 'anode',
		molarMass: A.Li,
		liPerUnit: 1,
		empty: 0,
		full: 1,
		ocp: () => 0,
		redox: 'lithium itself (Li ⇌ Li⁺)'
	}
];

const materialById = new Map(MATERIALS.map((m) => [m.id, m]));
export const material = (id: string, side: Side): Material =>
	materialById.get(id) ?? (side === 'anode' ? MATERIALS[3] : MATERIALS[0]);
export const CATHODES = MATERIALS.filter((m) => m.side === 'cathode');
export const ANODES = MATERIALS.filter((m) => m.side === 'anode');

/** Lithium fraction of a material at a cell's state of charge (0 empty … 1 full). */
export const fillAt = (m: Material, soc: number) => m.empty + (m.full - m.empty) * soc;

/** Its potential vs Li/Li⁺ at that state of charge. */
export const potentialAt = (m: Material, soc: number) => m.ocp(fillAt(m, soc));
