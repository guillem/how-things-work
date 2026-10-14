/**
 * Max Bodenstein's measurements of the hydrogen–iodine reaction, H₂ + I₂ ⇌ 2 HI.
 *
 * Source: M. Bodenstein, "Gasreaktionen in der chemischen Kinetik II. Einfluss der
 * Temperatur auf Bildung und Zersetzung von Jodwasserstoff", Zeitschrift für
 * physikalische Chemie 29, 295–314 (1899). Tables as transcribed by Carmen Giunta,
 * Le Moyne College, "Classic Calculations in Chemistry":
 *   https://web.lemoyne.edu/Giunta/classicalcs/bodenkin.html  (rate constants)
 *   https://web.lemoyne.edu/Giunta/classicalcs/bodeneq.html   (equilibrium)
 * © 2003 Carmen Giunta, reproduced with permission for non-commercial educational use.
 * The values are copied unchanged (every row of both pages).
 *
 * Giunta gives the rate constants in "arbitrary units", the same for both
 * directions (their ratio is the equilibrium constant, ≈ 55 at 427 °C). The unit
 * is calibrated with OpenStax, Chemistry 2e, §12.5 (CC BY 4.0), as reproduced in
 * the University of Calgary's open textbook
 * (https://chem-textbook.ucalgary.ca/version2/chapter-7-main/collision-theory/activation-energy-and-the-arrhenius-equation/):
 * its table of k for 2 HI → H₂ + I₂ in L mol⁻¹ s⁻¹ at 555, 575, 645, 700 and
 * 781 K is Bodenstein's decomposition data divided by 2.675 (the same factor at
 * all five temperatures, to ±0.2 %). It is therefore not an independent check, only
 * the unit.
 */

/** Rate constant of 2 HI → H₂ + I₂: [temperature °C, k in Giunta's arbitrary units]. */
export const DECOMPOSITION: readonly (readonly [number, number])[] = [
	[508, 0.1059],
	[443, 0.0067],
	[427, 0.0031],
	[410, 0.00137],
	[393, 0.000588],
	[374, 0.00023],
	[356, 0.0000809],
	[302, 0.00000326],
	[283, 0.000000942]
];

/** Rate constant of H₂ + I₂ → 2 HI: [temperature °C, k in the same arbitrary units]. */
export const FORMATION: readonly (readonly [number, number])[] = [
	[508, 3.58],
	[443, 0.375],
	[427, 0.172],
	[410, 0.0659],
	[393, 0.0379],
	[374, 0.014],
	[356, 0.00676],
	[326, 0.00146],
	[302, 0.000353],
	[283, 0.0000826]
];

/**
 * Equilibrium: [temperature °C, fraction ξ of pure HI decomposed at equilibrium].
 * Then [H₂] = [I₂] = ξ/2 and [HI] = 1 − ξ (per unit of HI), so the equilibrium
 * constant of H₂ + I₂ ⇌ 2 HI is K = (1 − ξ)² / (ξ/2)².
 */
export const EQUILIBRIUM: readonly (readonly [number, number])[] = [
	[508, 0.2408],
	[487.2, 0.234],
	[443, 0.2198],
	[427, 0.2157],
	[410, 0.21],
	[393, 0.2058],
	[374, 0.201],
	[356, 0.1946],
	[328, 0.1885],
	[302, 0.1815],
	[283, 0.1787]
];

/**
 * OpenStax's decomposition rate constants (K, L mol⁻¹ s⁻¹): the unit calibration.
 * The temperatures are Bodenstein's, rounded to the kelvin.
 */
export const OPENSTAX_DECOMPOSITION: readonly (readonly [number, number])[] = [
	[555, 3.52e-7],
	[575, 1.22e-6],
	[645, 8.59e-5],
	[700, 1.16e-3],
	[781, 3.95e-2]
];

/** OpenStax temperature (K) ↔ Bodenstein temperature (°C) of the same measurement. */
export const OPENSTAX_MATCH: readonly (readonly [number, number])[] = [
	[555, 283],
	[575, 302],
	[645, 374],
	[700, 427],
	[781, 508]
];
