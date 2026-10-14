/**
 * Everyday liquids on the pH scale.
 *
 * Measured ranges (foods): US FDA / CFSAN, "Approximate pH of Foods and Food Products",
 * Acidified and Low-Acid Canned Foods, April 2007. A US government work (public
 * domain). Read from the copy at riverstonehealth.org/wp-content/uploads/
 * FDA-Approximate-pH-of-Foods.pdf (the page has left fda.gov); entries used as
 * printed: "Lemon Juice 2.00 - 2.60", "Vinegar 2.40 - 3.40", "Orange Juice,
 * California 3.30 - 4.19", "Tomatoes 4.30 - 4.90", "Milk, cow 6.40 - 6.80".
 * Blood: "normal pH range of about 7.35 to 7.45", MSD Manual Consumer Version,
 * "Overview of Acid-Base Balance" (msdmanuals.com).
 * Seawater: global average surface pH 8.07 ± 0.02 (total scale, 60° N–60° S, year
 * 2000), L.-Q. Jiang et al., "Surface ocean pH and buffer capacity: past, present and
 * future", Scientific Reports 9, 18624 (2019), doi:10.1038/s41598-019-55039-4.
 *
 * Computed entries come from the page's own model (`model.ts`) for the stated
 * recipe, so they are exact for an ideal solution at 25 °C:
 *   clean rain — pure water open to air with 420 ppm of CO₂ (NOAA Global Monitoring
 *   Laboratory, April 2024 release: 2023 global surface mean 419.3 ppm, provisional),
 *   Henry's constant 0.034 mol/(L·atm) (Sander compilation, see model.ts), carbonic
 *   acid pKa 6.35 and 10.33 (CRC). An open system: the air fixes the dissolved CO₂
 *   (H₂CO₃*) at K_H · pCO₂, and the bicarbonate and carbonate come on top of it;
 *   baking soda — NaHCO₃ at 0.1 mol/L (a level teaspoon, ~5 g, in half a litre is
 *   about 0.12 mol/L); ammonia — NH₃ at 0.1 mol/L, pKa of NH₄⁺ 9.25 (CRC);
 *   hydrochloric acid and sodium hydroxide at 0.1 mol/L.
 */
import { fractions, solvePH } from './model';

export interface Liquid {
	id: string;
	name: string;
	/** pH, or the low and high ends of a measured range. */
	lo: number;
	hi: number;
	/** How the value was obtained, shown on the page. */
	source: string;
	measured: boolean;
}

const CO2_PPM = 420;
const HENRY_CO2 = 0.034; // mol / (L · atm)
const CARBONIC = [6.35, 10.33];
const AMMONIUM = [9.25];

const computed = (id: string, name: string, ph: number, source: string): Liquid => ({
	id,
	name,
	lo: ph,
	hi: ph,
	source,
	measured: false
});
const measured = (id: string, name: string, lo: number, hi: number, source: string): Liquid => ({
	id,
	name,
	lo,
	hi,
	source,
	measured: true
});

/** Rain open to the air: find the total carbonate whose dissolved-CO₂ share is K_H · pCO₂. */
function openRainPH(): number {
	const co2aq = HENRY_CO2 * CO2_PPM * 1e-6;
	let ph = 5.6;
	for (let k = 0; k < 20; k++) {
		const c = co2aq / fractions(CARBONIC, 10 ** -ph)[0];
		ph = solvePH({ systems: [{ c, z: 0, pKa: CARBONIC }] });
	}
	return ph;
}
const rain = openRainPH();
const soda = solvePH({ systems: [{ c: 0.1, z: 0, pKa: CARBONIC }], cations: 0.1 });
const ammonia = solvePH({ systems: [{ c: 0.1, z: 1, pKa: AMMONIUM }] });

export const LIQUIDS: Liquid[] = [
	computed('hcl', 'hydrochloric acid', solvePH({ anions: 0.1 }), 'computed: 0.1 mol/L HCl'),
	measured('lemon', 'lemon juice', 2.0, 2.6, 'measured (FDA)'),
	measured('vinegar', 'vinegar', 2.4, 3.4, 'measured (FDA)'),
	measured('orange', 'orange juice', 3.3, 4.19, 'measured (FDA)'),
	measured('tomato', 'tomatoes', 4.3, 4.9, 'measured (FDA)'),
	computed('rain', 'clean rain', rain, 'computed: water + 420 ppm CO₂ in the air'),
	measured('milk', 'milk', 6.4, 6.8, 'measured (FDA)'),
	computed('water', 'pure water', solvePH({}), 'computed: water alone, 25 °C'),
	measured('blood', 'blood', 7.35, 7.45, 'normal range (MSD Manual)'),
	measured('sea', 'seawater', 8.07, 8.07, 'measured average, 2000 (Jiang et al. 2019)'),
	computed('soda', 'baking soda in water', soda, 'computed: 0.1 mol/L NaHCO₃'),
	computed('ammonia', 'ammonia solution', ammonia, 'computed: 0.1 mol/L NH₃'),
	computed('naoh', 'sodium hydroxide', solvePH({ cations: 0.1 }), 'computed: 0.1 mol/L NaOH')
];
