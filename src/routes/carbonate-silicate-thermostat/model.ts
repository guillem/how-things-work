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
 *  - G_CO₂ = 8 K today and 1.5 K more per doubling of CO₂ (zero below about 7 µbar), which
 *    the water term doubles to 3 °C per doubling, the IPCC AR6 best estimate of the
 *    equilibrium climate sensitivity. These offsets are fitted, not an attribution: they
 *    reproduce today's 15 °C and the 3 °C per doubling, and the water term lumps together
 *    water vapour, clouds and everything else. WHK's own CO₂ term gave only 1.3 K per
 *    doubling, which they called an underestimate.
 *
 * Ice: the albedo rises linearly from 0.3 for a global mean of 0 °C or more to 0.6 for a
 * fully frozen planet at −28 °C or less (a Budyko–Sellers ice-albedo feedback squeezed into
 * one number). Between the two the ice feedback is stronger than the restoring infrared, so
 * no state is stable there: a planet is either open (≥ 0 °C) or a snowball (≤ −28 °C), and
 * the temperature jumps between them.
 *
 * CO₂ is a partial pressure in µbar, which in today's one-bar air is the same number as ppm
 * (280 µbar ≈ 280 ppm); a thick snowball atmosphere is quoted in bar.
 *
 * The carbon: the air holds 2.124 billion tonnes (Pg) of carbon per µbar. Today's volcanic
 * and metamorphic release, 3.3 × 10¹⁴ g CO₂ a year (Holland 1978, used by WHK), "would
 * double the carbon in the ocean and atmosphere in only 400,000 years", so air and ocean
 * together hold about 36,000 Pg, nearly all of it in the ocean, which takes up its share of
 * any change: near today 128 Pg per µbar of the air's CO₂ (WHK's assumption that the air's
 * CO₂ follows their total; so below today the ocean empties in step with the air). Above
 * today its share shrinks as the CO₂ grows (the ocean's extra carbon
 * here grows as the logarithm of the CO₂), so a thick CO₂ atmosphere stays mostly in the
 * air. Under a snowball the ocean is sealed by ice and the volcanoes' CO₂ builds up in the
 * air alone (WHK: about a bar in 20 million years; here 24). When the ice goes, air and
 * ocean share the carbon again, conserving it.
 *
 * The temperature adjusts much faster than the carbon (centuries against hundreds of
 * thousands of years), so it is always taken in balance with the current CO₂ (found by
 * following the sign of the energy imbalance from the previous temperature, so a frozen
 * planet stays frozen until its frozen balance disappears). Time is in years, temperatures
 * in K.
 */

// ------------------------------------------------------------------ constants

/** Pre-industrial CO₂, µbar (= ppm): the reference P₀. */
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
/** Today's volcanic release, Pg (billion tonnes) of carbon a year: 3.3 × 10¹⁴ g CO₂ × 12/44. */
export const VOLCANIC_PGC = (3.3e14 * 12) / 44 / 1e15;
/** Carbon in the air per µbar (ppm) of CO₂, Pg. */
export const AIR_PGC = 2.124;
/** Carbon in air and ocean together, Pg: what today's volcanoes double in 400,000 years. */
export const FLUID_PGC = VOLCANIC_PGC * DOUBLING_YEARS;
/** The ocean's uptake near today, Pg per µbar of the air's CO₂. */
const OCEAN_K = FLUID_PGC / P0 - AIR_PGC;
/** The ocean's carbon above today's when its air holds `p` µbar, Pg (logarithmic). */
export const oceanExtra = (p: number) =>
	p < P0 ? OCEAN_K * (p - P0) : OCEAN_K * P0 * Math.log(p / P0);
/** Carbon in air and ocean together, above today's, for an open planet at `p` µbar, Pg. */
export const openCarbon = (p: number) => AIR_PGC * (p - P0) + oceanExtra(p);
/** Pg of carbon per µbar of the air's change, with the ocean open. */
const openCapacity = (p: number) => AIR_PGC + (p < P0 ? OCEAN_K : (OCEAN_K * P0) / p);
/** CO₂ added per year by today's volcanoes to a sealed (frozen) planet's air, µbar. */
export const SEALED_RATE = VOLCANIC_PGC / AIR_PGC;
/** Sunlight of the snowball glaciations, about 700 million years ago (Gough 1981). */
export const SNOWBALL_SUN = 0.94;
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
	let lo = Math.log(1e-4);
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

/**
 * The farthest distance from today's Sun, in Earth's distances, at which an open balance
 * exists with volcanoes `volcanoes` × today's, searched between `near` and `far` (scanned
 * from the far end, then refined): null if there is none anywhere in the range, `far` if
 * there is one there.
 */
export function outerEdge(volcanoes: number, near = 0.95, far = 1.3): number | null {
	const open = (au: number) => openEquilibrium(sunlightAt(au), volcanoes) !== null;
	if (open(far)) return far;
	const step = 0.005;
	for (let au = far - step; au >= near - 1e-9; au -= step) {
		if (!open(au)) continue;
		let lo = au;
		let hi = au + step;
		for (let i = 0; i < 20; i++) {
			const m = (lo + hi) / 2;
			if (open(m)) lo = m;
			else hi = m;
		}
		return lo;
	}
	return null;
}

/** CO₂ added to an open planet's air per year by today's volcanoes, µbar, at `p` µbar. */
export const openRate = (p: number) => VOLCANIC_PGC / openCapacity(p);

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
	/** The ocean's carbon above today's, Pg (sealed while frozen). */
	ocean: number;
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

/** The open planet's CO₂ (µbar) holding `pgc` Pg of carbon above today's in air and ocean. */
export function openPressure(pgc: number, guess: number) {
	let lo = Math.max(1e-6, guess / 1e4);
	let hi = guess * 1e4;
	for (let i = 0; i < 80; i++) {
		const m = Math.sqrt(lo * hi);
		if (openCarbon(m) > pgc) hi = m;
		else lo = m;
	}
	return Math.sqrt(lo * hi);
}

/**
 * Runs the box forwards. Open, the carbon of air and ocean changes by (volcanoes −
 * weathering) and the air's CO₂ with it; frozen, the sea is sealed and the volcanoes' CO₂
 * stays in the air. When a frozen planet thaws, air and ocean share their carbon again
 * (conserved), and the temperature follows. Integrated with steps of at most 2,000 years,
 * each split so that CO₂ never changes by more than 2 % in one step.
 */
export function run(opts: RunOptions): Sample[] {
	const s = opts.sun ?? 1;
	const v = opts.volcanoes ?? 1;
	let ppm = opts.ppm ?? P0;
	let k = balance(ppm, s, opts.k ?? (opts.frozen ? 150 : T0));
	/** The ocean's carbon above today's, Pg: in step with the air when open, fixed when sealed. */
	let ocean = oceanExtra(ppm);
	const n = opts.samples ?? 400;
	const every = opts.years / n;
	const out: Sample[] = [];
	const push = (year: number) =>
		out.push({ year, ppm, k, w: weathering(k, ppm), frozen: isFrozen(k), ocean });
	push(0);
	let year = 0;
	for (let i = 1; i <= n; i++) {
		const end = i * every;
		while (year < end - 1e-6) {
			const frozen = isFrozen(k);
			const rate = (frozen ? SEALED_RATE : openRate(ppm)) * (v - weathering(k, ppm));
			let dt = Math.min(2000, end - year);
			if (rate !== 0) dt = Math.min(dt, Math.max(1, (0.02 * ppm) / Math.abs(rate)));
			ppm = Math.max(1e-4, ppm + rate * dt);
			k = balance(ppm, s, k);
			if (frozen && !isFrozen(k)) {
				// the thaw: the ocean takes its share of the carbon the air built up
				ppm = openPressure(AIR_PGC * (ppm - P0) + ocean, ppm);
				k = balance(ppm, s, k);
			}
			if (!isFrozen(k)) ocean = oceanExtra(ppm);
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
	/** The thermostat's steady open balance: CO₂ (µbar) and temperature (K); null where none exists. */
	ppm: number | null;
	k: number | null;
	/** Temperature with CO₂ held at 280 µbar (K), followed from the frozen start. */
	fixedK: number;
}

/** Volcanic release `ga` billion years ago, relative to today's, falling linearly from `early` at 4.5 Ga. */
export const volcanoesAgo = (ga: number, early: number) => 1 + ((early - 1) * ga) / 4.5;

/**
 * The thermostat's balance as the Sun brightens, from `from` billion years ago to today, with
 * volcanoes `early` times today's 4.5 billion years ago, declining steadily to today's. The
 * carbon settles in about half a million years while the Sun brightens by 1 % in about 100
 * million, so at each moment the planet sits at its balance for that sunlight (if an open one
 * exists). `fixedK` is the planet without the thermostat: CO₂ held at 280 µbar, starting
 * frozen under the faint Sun and followed forward, so once frozen it stays frozen while a
 * frozen balance exists (the ice's hysteresis).
 */
export function history(early: number, from = 4.5, steps = 90): HistoryPoint[] {
	const out: HistoryPoint[] = [];
	let fixedK = frozenTemperature(P0, sunlightAgo(from));
	for (let i = 0; i <= steps; i++) {
		const ga = from * (1 - i / steps);
		const sun = sunlightAgo(ga);
		const eq = openEquilibrium(sun, volcanoesAgo(ga, early));
		fixedK = balance(P0, sun, fixedK);
		out.push({ ga, sun, ppm: eq?.ppm ?? null, k: eq?.k ?? null, fixedK });
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
