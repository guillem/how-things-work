/**
 * Standard reduction potentials E° at 25 °C, in volts against the standard hydrogen
 * electrode (SHE), in water, for the metals the page offers (plus hydrogen and oxygen).
 *
 * Source: LibreTexts Chemistry, Reference Tables, Electrochemistry Tables,
 * "P1: Standard Reduction Potentials by Element"
 * (chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Electrochemistry_Tables),
 * which compiles A. J. Bard, R. Parsons and J. Jordan, "Standard Potentials in Aqueous
 * Solution" (Marcel Dekker, 1985), G. Milazzo, S. Caroli and V. K. Sharma, "Tables of
 * Standard Electrode Potentials" (Wiley, 1978) and Swift and Butler (1972). Values
 * copied as printed there (October 2026), with the precision printed; licence CC BY-NC-SA.
 * The subset: the metals' simple M^n+ + n e⁻ ⇌ M couples, 2H⁺/H₂ and O₂/H₂O.
 */

export interface Couple {
	id: string;
	/** The metal (or element) on its own. */
	name: string;
	/** Its symbol. */
	symbol: string;
	/** The ion it forms, as written on the stage. */
	ion: string;
	/** Electrons per atom, n in Mⁿ⁺ + n e⁻ ⇌ M. */
	n: number;
	/** The half-reaction as a reduction. */
	reaction: string;
	/** E°, V vs SHE. */
	e0: number;
}

export const COUPLES: readonly Couple[] = [
	{
		id: 'li',
		name: 'lithium',
		symbol: 'Li',
		ion: 'Li⁺',
		n: 1,
		reaction: 'Li⁺ + e⁻ → Li',
		e0: -3.04
	},
	{
		id: 'na',
		name: 'sodium',
		symbol: 'Na',
		ion: 'Na⁺',
		n: 1,
		reaction: 'Na⁺ + e⁻ → Na',
		e0: -2.713
	},
	{
		id: 'mg',
		name: 'magnesium',
		symbol: 'Mg',
		ion: 'Mg²⁺',
		n: 2,
		reaction: 'Mg²⁺ + 2e⁻ → Mg',
		e0: -2.356
	},
	{
		id: 'al',
		name: 'aluminium',
		symbol: 'Al',
		ion: 'Al³⁺',
		n: 3,
		reaction: 'Al³⁺ + 3e⁻ → Al',
		e0: -1.676
	},
	{
		id: 'zn',
		name: 'zinc',
		symbol: 'Zn',
		ion: 'Zn²⁺',
		n: 2,
		reaction: 'Zn²⁺ + 2e⁻ → Zn',
		e0: -0.7618
	},
	{
		id: 'fe',
		name: 'iron',
		symbol: 'Fe',
		ion: 'Fe²⁺',
		n: 2,
		reaction: 'Fe²⁺ + 2e⁻ → Fe',
		e0: -0.44
	},
	{
		id: 'ni',
		name: 'nickel',
		symbol: 'Ni',
		ion: 'Ni²⁺',
		n: 2,
		reaction: 'Ni²⁺ + 2e⁻ → Ni',
		e0: -0.257
	},
	{
		id: 'pb',
		name: 'lead',
		symbol: 'Pb',
		ion: 'Pb²⁺',
		n: 2,
		reaction: 'Pb²⁺ + 2e⁻ → Pb',
		e0: -0.126
	},
	{
		id: 'cu',
		name: 'copper',
		symbol: 'Cu',
		ion: 'Cu²⁺',
		n: 2,
		reaction: 'Cu²⁺ + 2e⁻ → Cu',
		e0: 0.3419
	},
	{
		id: 'ag',
		name: 'silver',
		symbol: 'Ag',
		ion: 'Ag⁺',
		n: 1,
		reaction: 'Ag⁺ + e⁻ → Ag',
		e0: 0.7996
	},
	{
		id: 'au',
		name: 'gold',
		symbol: 'Au',
		ion: 'Au³⁺',
		n: 3,
		reaction: 'Au³⁺ + 3e⁻ → Au',
		e0: 1.52
	}
];

/** 2H⁺ + 2e⁻ ⇌ H₂: the zero of the scale, by definition. */
export const E0_HYDROGEN = 0;
/** O₂ + 4H⁺ + 4e⁻ ⇌ 2H₂O (same table): the top of water's stability window. */
export const E0_OXYGEN = 1.229;

export const coupleById = new Map(COUPLES.map((c) => [c.id, c]));
export const couple = (id: string): Couple => coupleById.get(id) ?? COUPLES[4];
