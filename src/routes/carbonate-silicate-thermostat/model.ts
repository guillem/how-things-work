/**
 * The carbonate-silicate thermostat as a box model: one reservoir of carbon dioxide, filled
 * by volcanoes at a steady rate and emptied by the weathering of silicate rock, whose rate
 * rises with temperature; and a zero-dimensional energy balance that sets the temperature
 * from the sunlight, the ice and the CO₂.
 *
 * Weathering is the law of Walker, Hays & Kasting (1981, JGR 86, 9776; "WHK", eq. 1):
 *
 *     W / W₀ = (P / P₀)^0.3 · exp(ΔT / 13.7 K)
 *
 * where the 13.7 K combines faster dissolution of feldspar (an e-folding of 17.7 K, from
 * Lagache's experiments) with more runoff in a warmer, wetter climate (an e-folding of 60 K).
 * A fully frozen planet has no rain and no runoff, so W = 0 (WHK's own remark).
 *
 * The surface temperature follows WHK's split T = Tₑ + G_water + G_CO₂ (eq. 3):
 *  - Tₑ is the effective (bare) temperature, from absorbed sunlight = σTₑ⁴ (255 K today,
 *    with an albedo of 0.3);
 *  - G_water = 25 K + 0.5 (T − 288 K), never below 0: WHK's water-vapour term (eq. 4: the
 *    slope 0.5 is theirs, which doubles any change of Tₑ), here re-referenced to today's
 *    288 K;
 *  - G_CO₂ = 8 K today and 1.5 K more per doubling of CO₂ (zero below about 7 ppm), which
 *    the water term doubles to 3 °C per doubling, the IPCC AR6 best estimate of the
 *    equilibrium climate sensitivity. About a quarter of today's 33 K greenhouse effect is
 *    CO₂'s (Schmidt et al. 2010). WHK's own CO₂ term gave only 1.3 K per doubling, which
 *    they called an underestimate.
 *
 * Ice: the albedo rises linearly from 0.3 for a global mean of 0 °C or more to 0.6 for a
 * fully frozen planet at −28 °C or less (a Budyko–Sellers ice-albedo feedback squeezed into
 * one number). Between the two the ice feedback is stronger than the restoring infrared, so
 * no state is stable there: a planet is either open (≥ 0 °C) or a snowball (≤ −28 °C), and
 * the temperature jumps between them.
 *
 * The reservoir: with the ocean open, air and ocean exchange CO₂ freely and the air's CO₂ is
 * taken as proportional to the carbon in both (WHK's assumption). Today's volcanic and
 * metamorphic release, 3.3 × 10¹⁴ g CO₂ a year (Holland 1978, used by WHK), "would double
 * the carbon in the ocean and atmosphere in only 400,000 years": 280 ppm per 400,000 years.
 * Under a snowball the ocean is sealed by ice and the same release builds up in the air
 * alone: one bar in 20 million years (WHK).
 *
 * The temperature adjusts in years and the carbon in hundreds of thousands, so the
 * temperature is always in balance with the current CO₂ (it is found by following the sign
 * of the energy imbalance from the previous temperature, so a frozen planet stays frozen
 * until its frozen balance disappears). Time is in years, CO₂ in ppm, temperatures in K.
 */

// ------------------------------------------------------------------ constants

/** Pre-industrial CO₂, ppm: the reference P₀. */
export const P0 = 280;
/** Today's global mean surface temperature, K (about 15 °C). */
export const T0 = 288;
/** Today's effective temperature, K, with albedo 0.3 (absorbed sunlight = σTₑ⁴). */
const TE0 = 255;
/** Albedo of the open (ice-free enough) planet, and of a fully frozen one. */
export const ALBEDO_OPEN = 0.3;
export const ALBEDO_ICE = 0.6;
/** Global mean at or above which the planet is open, and at or below which it is frozen, K. */
export const T_OPEN = 273.15;
export const T_FROZEN = 245.15;
/** Water vapour's greenhouse today, K, and its slope (WHK eq. 4). */
const G_WATER0 = 25;
const WATER_SLOPE = 0.5;
/** CO₂'s greenhouse today, K, and its increase per doubling before the water vapour feedback. */
export const G_CO2_TODAY = 8;
const PER_DOUBLING = 1.5;
/** CO₂ below which its greenhouse is taken as zero, ppm (where the log law reaches 0). */
const P_NONE = P0 * Math.exp((-G_CO2_TODAY * Math.LN2) / PER_DOUBLING);
/** Weathering: CO₂ exponent and temperature e-folding, K (WHK eq. 1). */
export const WEATHER_CO2 = 0.3;
export const WEATHER_EFOLD = 13.7;
/** Its two parts: dissolution kinetics and runoff, K (WHK). */
export const KINETIC_EFOLD = 17.7;
export const RUNOFF_EFOLD = 60;
/** Years for today's volcanoes to double the carbon of an open ocean and air (WHK). */
export const DOUBLING_YEARS = 400e3;
/** CO₂ added per year by today's volcanoes with the ocean open, and sealed under ice, ppm. */
export const OPEN_RATE = P0 / DOUBLING_YEARS;
export const SEALED_RATE = 1e6 / 20e6;
/** Today's volcanic release, Pg (billion tonnes) of carbon a year: 3.3 × 10¹⁴ g CO₂ × 12/44. */
export const VOLCANIC_PGC = (3.3e14 * 12) / 44 / 1e15;
/** Age of the Sun at present, Gyr, for Gough's law. */
const SUN_AGE = 4.57;

export const toC = (k: number) => k - 273.15;

// ------------------------------------------------------------------ sunlight

/**
 * Sunlight relative to today `ga` billion years ago (Gough 1981, Solar Physics 74, 21):
 * S = S₀ / (1 + 0.4 (1 − t/t₀)), with t₀ = 4.57 Gyr.
 */
export const sunlightAgo = (ga: number) => 1 / (1 + 0.4 * (ga / SUN_AGE));

/** Sunlight relative to Earth's for a planet `au` astronomical units from today's Sun. */
export const sunlightAt = (au: number) => 1 / (au * au);

// ------------------------------------------------------------------ climate

/** Albedo at global mean temperature `k`. */
export function albedo(k: number) {
	if (k >= T_OPEN) return ALBEDO_OPEN;
	if (k <= T_FROZEN) return ALBEDO_ICE;
	return ALBEDO_ICE + ((ALBEDO_OPEN - ALBEDO_ICE) * (k - T_FROZEN)) / (T_OPEN - T_FROZEN);
}

/** Effective (bare) temperature for relative sunlight `s` and albedo `a`, K. */
export const effectiveTemperature = (s: number, a: number) =>
	TE0 * ((s * (1 - a)) / (1 - ALBEDO_OPEN)) ** 0.25;

/** Greenhouse warming by water vapour at surface temperature `k`, K. */
export const waterGreenhouse = (k: number) => Math.max(0, G_WATER0 + WATER_SLOPE * (k - T0));

/** Greenhouse warming by CO₂ at `ppm`, K. */
export const co2Greenhouse = (ppm: number) =>
	Math.max(0, (PER_DOUBLING / Math.LN2) * Math.log(ppm / P_NONE));

/** The temperature the balance asks for, minus the temperature: > 0 means warming. */
const imbalance = (k: number, ppm: number, s: number) =>
	effectiveTemperature(s, albedo(k)) + waterGreenhouse(k) + co2Greenhouse(ppm) - k;

/**
 * The balanced surface temperature reached from `from` (K): the energy imbalance is followed
 * in half-kelvin steps to its first change of sign, then bisected. A planet that starts
 * frozen therefore stays frozen while a frozen balance exists, and an open one stays open.
 */
export function balance(ppm: number, s: number, from: number): number {
	const dir = Math.sign(imbalance(from, ppm, s));
	if (dir === 0) return from;
	let a = from;
	let b = from + dir * 0.5;
	while (Math.sign(imbalance(b, ppm, s)) === dir) {
		a = b;
		b += dir * 0.5;
		if (b < 120 || b > 420) return b;
	}
	for (let i = 0; i < 40; i++) {
		const m = (a + b) / 2;
		if (Math.sign(imbalance(m, ppm, s)) === dir) a = m;
		else b = m;
	}
	return (a + b) / 2;
}

/** Balanced temperature of an open planet (searched from a warm start), K. */
export const openTemperature = (ppm: number, s = 1) => balance(ppm, s, 330);
/** Balanced temperature of a frozen planet (searched from a frozen start), K. */
export const frozenTemperature = (ppm: number, s = 1) => balance(ppm, s, 150);

/** Is a planet at `k` kelvin fully frozen? */
export const isFrozen = (k: number) => k <= T_FROZEN + 1e-6;

// ------------------------------------------------------------------ weathering

/** Silicate weathering relative to today's (WHK eq. 1); zero on a frozen planet. */
export function weathering(k: number, ppm: number) {
	if (isFrozen(k)) return 0;
	return (ppm / P0) ** WEATHER_CO2 * Math.exp((k - T0) / WEATHER_EFOLD);
}

/** The two temperature parts of weathering, relative to today: dissolution and runoff. */
export const kineticFactor = (k: number) => Math.exp((k - T0) / KINETIC_EFOLD);
export const runoffFactor = (k: number) => Math.exp((k - T0) / RUNOFF_EFOLD);

/**
 * The CO₂ (ppm) and temperature (K) at which an open planet's weathering equals volcanoes
 * `volcanoes` times today's, for relative sunlight `s`; null if no open balance exists.
 */
export function openEquilibrium(s: number, volcanoes = 1): { ppm: number; k: number } | null {
	if (volcanoes <= 0) return null;
	let lo = Math.log(1);
	let hi = Math.log(3e6);
	const wAt = (ppm: number) => {
		const k = openTemperature(ppm, s);
		return k < T_OPEN ? 0 : weathering(k, ppm);
	};
	if (wAt(Math.exp(hi)) < volcanoes) return null;
	for (let i = 0; i < 60; i++) {
		const m = (lo + hi) / 2;
		if (wAt(Math.exp(m)) > volcanoes) hi = m;
		else lo = m;
	}
	const ppm = Math.exp(hi);
	const k = openTemperature(ppm, s);
	// The bisection also lands on the jump where an open state first exists; that is a
	// balance only if weathering there really matches the volcanoes.
	if (k < T_OPEN || Math.abs(weathering(k, ppm) / volcanoes - 1) > 1e-3) return null;
	return { ppm, k };
}

// ------------------------------------------------------------------ running it

export interface Sample {
	/** Years since the start. */
	year: number;
	/** CO₂, ppm. */
	ppm: number;
	/** Surface temperature, K. */
	k: number;
	/** Weathering relative to today's. */
	w: number;
	frozen: boolean;
}

export interface RunOptions {
	/** Relative sunlight (1 = today's Earth). */
	sun?: number;
	/** Volcanic release relative to today's. */
	volcanoes?: number;
	/** Starting CO₂, ppm. */
	ppm?: number;
	/** Start frozen (a snowball) rather than open. */
	frozen?: boolean;
	/** Starting temperature, K, when the run continues an earlier state (overrides `frozen`). */
	k?: number;
	/** Length of the run, years. */
	years: number;
	/** Number of samples returned (plus the start). */
	samples?: number;
}

/**
 * Runs the box forwards: CO₂ changes by (volcanoes − weathering) at the open or sealed rate,
 * and the temperature follows. Integrated with steps of at most 2,000 years, each split so
 * that CO₂ never changes by more than 2 % in one step (the hothouse after a snowball).
 */
export function run(opts: RunOptions): Sample[] {
	const s = opts.sun ?? 1;
	const v = opts.volcanoes ?? 1;
	let ppm = opts.ppm ?? P0;
	let k = balance(ppm, s, opts.k ?? (opts.frozen ? 150 : T0));
	const n = opts.samples ?? 400;
	const every = opts.years / n;
	const out: Sample[] = [];
	const push = (year: number) =>
		out.push({ year, ppm, k, w: weathering(k, ppm), frozen: isFrozen(k) });
	push(0);
	let year = 0;
	for (let i = 1; i <= n; i++) {
		const end = i * every;
		while (year < end - 1e-6) {
			const rate = (isFrozen(k) ? SEALED_RATE : OPEN_RATE) * (v - weathering(k, ppm));
			let dt = Math.min(2000, end - year);
			if (rate !== 0) dt = Math.min(dt, Math.max(1, (0.02 * ppm) / Math.abs(rate)));
			ppm = Math.max(0.01, ppm + rate * dt);
			k = balance(ppm, s, k);
			year += dt;
		}
		push(end);
	}
	return out;
}

/** The first sample at which the planet's state (frozen or open) changes, or null. */
export function firstSwitch(samples: Sample[]): Sample | null {
	for (let i = 1; i < samples.length; i++)
		if (samples[i].frozen !== samples[i - 1].frozen) return samples[i];
	return null;
}

/**
 * Years for CO₂ to close all but 1/e of the gap between its start and the balance `settle`
 * (the e-folding time of the thermostat), linear between samples; null if never.
 */
export function eFoldingYears(samples: Sample[], settle: number): number | null {
	const start = samples[0].ppm;
	const target = settle + (start - settle) / Math.E;
	for (let i = 1; i < samples.length; i++) {
		const a = samples[i - 1];
		const b = samples[i];
		if ((a.ppm - target) * (b.ppm - target) <= 0 && a.ppm !== b.ppm) {
			return a.year + ((target - a.ppm) / (b.ppm - a.ppm)) * (b.year - a.year);
		}
	}
	return null;
}

// ------------------------------------------------------------------ the brightening Sun

export interface HistoryPoint {
	/** Billion years ago. */
	ga: number;
	/** Relative sunlight. */
	sun: number;
	/** The thermostat's CO₂ (ppm) and temperature (K), or null where the planet is frozen. */
	ppm: number | null;
	k: number | null;
	/** Temperature with CO₂ held at 280 ppm, open start (K); frozen where no open balance. */
	fixedK: number;
}

/**
 * The thermostat's balance as the Sun brightens, from `from` billion years ago to today. The
 * carbon settles in about half a million years, while the Sun brightens by 1 % in about 100
 * million, so at each moment the planet sits at its balance for that sunlight (if an open one
 * exists). `fixedK` is the planet without the thermostat: CO₂ held at 280 ppm.
 */
export function history(volcanoes: number, from = 4.5, steps = 90): HistoryPoint[] {
	const out: HistoryPoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const ga = from * (1 - i / steps);
		const sun = sunlightAgo(ga);
		const eq = openEquilibrium(sun, volcanoes);
		const open = openTemperature(P0, sun);
		out.push({
			ga,
			sun,
			ppm: eq?.ppm ?? null,
			k: eq?.k ?? null,
			fixedK: open >= T_OPEN ? open : frozenTemperature(P0, sun)
		});
	}
	return out;
}

// ------------------------------------------------------------------ formatting

/** "280 ppm", "12,000 ppm", "0.26 bar". */
export function co2Text(ppm: number) {
	if (ppm >= 100_000) return `${(ppm / 1e6).toFixed(2)} bar`;
	if (ppm >= 10_000) return `${(Math.round(ppm / 1000) * 1000).toLocaleString('en-US')} ppm`;
	if (ppm >= 1000) return `${(Math.round(ppm / 100) * 100).toLocaleString('en-US')} ppm`;
	return `${Math.round(ppm)} ppm`;
}

/** "+15 °C", "−47 °C". */
export function celsiusText(k: number, digits = 0) {
	const c = toC(k);
	const v = c.toFixed(digits);
	return `${Number(v) < 0 ? '−' + v.slice(1) : v} °C`;
}

/** "350,000 years", "2.5 million years". */
export function yearsText(y: number) {
	if (y >= 1e6) return `${Number((y / 1e6).toFixed(y >= 1e7 ? 0 : 1))} million years`;
	return `${(Math.round(y / 10_000) * 10_000).toLocaleString('en-US')} years`;
}
