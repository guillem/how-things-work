/** Measured solubility, not a fitted cartoon curve. ACS Middle School Chemistry,
 * chapter 5 lesson 6, table “Comparing the solubility of sodium chloride and sucrose”.
 * https://www.acs.org/middleschoolchemistry/lessonplans/chapter5/lesson6.html
 * Units in the source: grams dissolved in 100 mL of water. We scale to the remaining
 * equivalent amount of starting water; thermal expansion and evaporation during warming
 * are ignored. Values are published numerical facts, transcribed with attribution.
 * No source text, graphics or worksheets are redistributed.
 * Linear interpolation between the six measured temperatures, clamped outside 0–100 °C.
 */
export type Solute = 'sugar' | 'salt';
export const solubilityTable = [
	{ temperature: 0, sugar: 179, salt: 35.5 },
	{ temperature: 20, sugar: 204, salt: 36 },
	{ temperature: 40, sugar: 241, salt: 36.5 },
	{ temperature: 60, sugar: 288, salt: 37.5 },
	{ temperature: 80, sugar: 363, salt: 38 },
	{ temperature: 100, sugar: 487, salt: 39 }
] as const;

/** Every illustrated spoon is weighed to 20 g, for both solids: volumes differ. */
export const SPOON_GRAMS = 20;

export function solubility(solute: Solute, temperature: number): number {
	const t = Math.max(0, Math.min(100, temperature));
	for (let i = 1; i < solubilityTable.length; i++) {
		const low = solubilityTable[i - 1];
		const high = solubilityTable[i];
		if (t <= high.temperature)
			return (
				low[solute] +
				((high[solute] - low[solute]) * (t - low.temperature)) /
					(high.temperature - low.temperature)
			);
	}
	return solubilityTable[5][solute];
}

export function glass(solute: Solute, spoonfuls: number, temperature: number, evaporated = 0) {
	const added = Math.max(0, Math.min(20, spoonfuls)) * SPOON_GRAMS;
	const water = 100 * (1 - Math.max(0, Math.min(100, evaporated)) / 100);
	const capacity = (solubility(solute, temperature) * water) / 100;
	const dissolved = Math.min(added, capacity);
	const solid = added - dissolved;
	return {
		added,
		water,
		capacity,
		dissolved,
		solid,
		saturated: added > 0 && added >= capacity,
		mass: water + added
	};
}

/** Stable, deterministic initial positions for a small magnified sample. */
export function samplePosition(i: number, seed = 0): { x: number; y: number } {
	const random = (n: number) => {
		const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
		return v - Math.floor(v);
	};
	return { x: 0.08 + 0.84 * random(i * 2 + 1), y: 0.08 + 0.84 * random(i * 2 + 2) };
}
