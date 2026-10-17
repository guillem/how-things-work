/**
 * Earthquake magnitude and energy.
 *
 * Moment magnitude (Hanks & Kanamori 1979, J. Geophys. Res. 84, 2348–2350,
 * doi:10.1029/JB084iB05p02348): Mw = ⅔·log₁₀ M₀ − 10.7 with the seismic moment M₀ in dyne·cm,
 * i.e. log₁₀ M₀ [N·m] = 1.5·Mw + 9.05. M₀ = rigidity × fault area × average slip.
 * Radiated energy: log₁₀ E [J] = 1.5·M + 4.8, the Gutenberg–Richter energy relation (1956,
 * log E = 1.5 M + 11.8 in ergs) that Hanks & Kanamori used to tie Mw to the older magnitude
 * scales; it is the same as E ≈ M₀ / 20,000 (Kanamori 1977).
 * Richter's scale (1935): magnitude is the logarithm of the largest swing on a standard
 * seismograph at a standard distance, so one step up is ten times bigger wiggles.
 *
 * How often: the USGS catalogue of M ≥ 5.5 earthquakes in 2015–2024 (the plate-tectonics
 * explainer's data, `../plate-tectonics/data/quakes.ts`).
 */
import { quakes } from '../plate-tectonics/globe';

/** Seismic moment, N·m. */
export const moment = (mw: number) => 10 ** (1.5 * mw + 9.05);
/** Magnitude for a seismic moment in N·m (the inverse of `moment`). */
export const magnitudeOf = (m0: number) => (2 / 3) * (Math.log10(m0 * 1e7) - 16.05);
/** Energy radiated as seismic waves, J. */
export const energy = (m: number) => 10 ** (1.5 * m + 4.8);
/** How many times more energy a magnitude `a` earthquake releases than one of magnitude `b`. */
export const energyRatio = (a: number, b: number) => 10 ** (1.5 * (a - b));
/** How many times bigger the wiggles on a seismograph at the same distance (Richter). */
export const amplitudeRatio = (a: number, b: number) => 10 ** (a - b);
/** One tonne of TNT, J (the defined value). */
export const TNT_TONNE = 4.184e9;

/**
 * Notable earthquakes, from the USGS ANSS Comprehensive Catalog (ComCat): magnitude and the
 * event id, https://earthquake.usgs.gov/earthquakes/eventpage/<id>.
 */
export const NOTABLE = [
	{
		name: 'Chile 1960',
		mag: 9.5,
		id: 'official19600522191120_30',
		note: 'the largest ever recorded'
	},
	{ name: 'Japan 2011', mag: 9.1, id: 'official20110311054624120_30', note: 'Tōhoku' },
	{
		name: 'Sumatra 2004',
		mag: 9.1,
		id: 'official20041226005853450_30',
		note: 'Indian Ocean tsunami'
	},
	{ name: 'Nepal 2015', mag: 7.8, id: 'us20002926', note: 'Gorkha' },
	{ name: 'Türkiye 2023', mag: 7.8, id: 'us6000jllz', note: 'Pazarcık' }
] as const;

/** Years covered by the catalogue. */
const CATALOGUE_YEARS = 10;

/** Earthquakes a year of magnitude ≥ m (m ≥ 5.5), from the 2015–2024 catalogue. */
export const perYearAtLeast = (m: number) =>
	quakes.filter((q) => q.mag >= m - 1e-9).length / CATALOGUE_YEARS;

/**
 * The Gutenberg–Richter b-value of the catalogue (log₁₀ N(≥M) = a − b·M), by Aki's (1965)
 * maximum-likelihood estimate for magnitudes binned to 0.1 from `min` up.
 */
export function bValue(min = 5.5) {
	const ms = quakes.filter((q) => q.mag >= min - 1e-9).map((q) => q.mag);
	const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
	return Math.LOG10E / (mean - (min - 0.05));
}

/** The largest earthquakes of the catalogue, biggest first. */
export const largest = (n: number) => [...quakes].sort((a, b) => b.mag - a.mag).slice(0, n);

/** Share of the catalogue's total seismic energy released by the earthquakes of magnitude ≥ m. */
export function energyShare(m: number) {
	const total = quakes.reduce((s, q) => s + energy(q.mag), 0);
	return quakes.filter((q) => q.mag >= m - 1e-9).reduce((s, q) => s + energy(q.mag), 0) / total;
}

/** Total seismic energy of the catalogue's earthquakes, J. */
export const catalogueEnergy = () => quakes.reduce((s, q) => s + energy(q.mag), 0);
