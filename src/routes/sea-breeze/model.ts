/**
 * A sunny summer day on a straight coast, land on one side and sea on the other.
 *
 * - Sunshine: the Sun's height over the day at 40° N near midsummer (declination 23°, solar
 *   time), and the clear-sky sunlight reaching the ground through that much air (Meinel's
 *   air-mass formula).
 * - Heating: the land and the sea each keep a simple heat budget. The sunlight they absorb warms a
 *   layer of them; they lose warmth back to the air and the sky in proportion to how far above
 *   their usual temperature they are. The land keeps the day's warmth in a thin top layer (moist
 *   soil to about 20 cm; a daily warming wave fades within a few tens of centimetres), while
 *   waves stir the sea's warmth down through a mixed top layer about 10 m deep. The loss rate is
 *   chosen so the air over the land swings about 14 °C over the day, warmest in mid-afternoon:
 *   a clear summer day.
 * - The breeze: Bjerknes's circulation theorem for the loop of air over the coast (Holton,
 *   "An Introduction to Dynamic Meteorology", §4.1): warmer air on the land side drives the loop
 *   round, in at the bottom from the sea and out at the top, with a push in proportion to the
 *   temperature difference; friction with the ground holds it back. In the theorem the difference
 *   is between the two columns' mean temperatures up to the loop's top; the page uses the
 *   difference of the air near the ground, with the friction chosen so the afternoon sea breeze
 *   peaks at about 6.5 m/s, a typical sea breeze. Earth's spin is left out.
 *
 * Times in hours of solar time (12 = noon), temperatures in °C, speeds in m/s.
 */

const DEG = Math.PI / 180;
/** Seconds in an hour. */
const H = 3600;

/** Latitude of the coast, degrees north. */
export const LATITUDE = 40;
/** The Sun's declination near midsummer, degrees. */
export const DECLINATION = 23;
/** Sunlight above the atmosphere, W/m². */
export const SOLAR_CONSTANT = 1361;

/** Height of the Sun above the horizon, degrees (negative at night), at solar `hour`. */
export function sunHeight(hour: number): number {
	const lat = LATITUDE * DEG;
	const dec = DECLINATION * DEG;
	const ha = (hour - 12) * 15 * DEG;
	const s = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
	return Math.asin(s) / DEG;
}

/** Sunrise, solar hours (sunset is 24 minus this). */
export function sunrise(): number {
	const c = -Math.tan(LATITUDE * DEG) * Math.tan(DECLINATION * DEG);
	return 12 - Math.acos(c) / DEG / 15;
}

/** Clear-sky direct sunlight on flat ground, W/m², at solar `hour` (Meinel's air-mass formula; the
 * sky's diffuse light, about a tenth more, is left out: the loss rate is tuned to the day anyway). */
export function sunlight(hour: number): number {
	const h = sunHeight(hour);
	if (h <= 0) return 0;
	const s = Math.sin(h * DEG);
	const airMass = 1 / s;
	return SOLAR_CONSTANT * Math.pow(0.7, Math.pow(airMass, 0.678)) * s;
}

/** One surface's heat budget. */
export interface Surface {
	/** Share of sunlight reflected. */
	albedo: number;
	/** Warmth needed to warm one square metre of it by 1 °C, J/(m²·°C). */
	capacity: number;
	/** Its average temperature over the day, °C. */
	mean: number;
}

/** Warmth lost per °C above its usual temperature, W/(m²·°C) (to the air, the sky and below). */
export const LOSS = 40;

/** Moist soil: 2.5 MJ per m³ per °C, through the top 20 cm. */
export const LAND_DEPTH = 0.2;
export const LAND: Surface = { albedo: 0.2, capacity: 2.5e6 * LAND_DEPTH, mean: 23 };
/** Sea water: 4.0 MJ per m³ per °C, stirred through its top 10 m. */
export const SEA_DEPTH = 10;
export const SEA: Surface = { albedo: 0.06, capacity: 4.0e6 * SEA_DEPTH, mean: 22 };

/** The day's average absorbed sunlight, W/m², per unit of (1 − albedo). */
const MEAN_SUN = (() => {
	let s = 0;
	const n = 24 * 60;
	for (let i = 0; i < n; i++) s += sunlight((i + 0.5) / 60);
	return s / n;
})();

// ---- the breeze ---------------------------------------------------------------------------------

/** Gas constant of dry air, J/(kg·K). */
export const RD = 287.04;
/** Pressure at the ground and at the top of the loop (about 1 km up), hPa. */
export const P_GROUND = 1000;
export const P_TOP = 900;
/** Height of the loop, m, and its width (half on each side of the shore), m. */
export const LOOP_HEIGHT = 1000;
export const LOOP_WIDTH = 20000;
/** Friction's hold on the breeze, per second (a breeze left alone would lose about two-thirds of its speed in 17 min). */
export const FRICTION = 1 / 1000;

/** The breeze's acceleration, m/s², from a land-minus-sea temperature difference `dT` (°C). */
export function push(dT: number): number {
	return (RD * Math.log(P_GROUND / P_TOP) * dT) / (2 * (LOOP_HEIGHT + LOOP_WIDTH));
}

/** The speed a steady temperature difference `dT` would settle to, m/s (+ blows from the sea). */
export function steadyBreeze(dT: number): number {
	return push(dT) / FRICTION;
}

/** Weight of a cubic metre of air at `tC` near the ground (1013 hPa), kg. */
export function airDensity(tC: number): number {
	return 101325 / (RD * (tC + 273.15));
}

// ---- the day ------------------------------------------------------------------------------------

export interface Moment {
	hour: number;
	/** Temperature of the air over the land, °C. */
	land: number;
	/** Temperature of the air over the sea, °C. */
	sea: number;
	/** Breeze at the beach, m/s: positive from the sea onto the land, negative out to sea. */
	breeze: number;
	/** Sunlight on the ground, W/m². */
	sun: number;
}

/** Samples per hour. */
const PER_HOUR = 12;

/** The day, every five minutes from midnight to midnight, after sixty days to settle (the sea takes weeks to forget where it started). */
export const day: Moment[] = (() => {
	const dt = H / PER_HOUR;
	const n = 24 * PER_HOUR;
	// Start each surface near its mean; temperature relative to the mean (anomaly).
	let a = 0;
	let b = 0;
	let v = 0;
	const out: Moment[] = [];
	for (let d = 0; d < 61; d++) {
		for (let i = 0; i < n; i++) {
			const hour = i / PER_HOUR;
			if (d === 60)
				out.push({
					hour,
					land: LAND.mean + a,
					sea: SEA.mean + b,
					breeze: v,
					sun: sunlight(hour)
				});
			// Midpoint steps for the two heat budgets and the breeze.
			const step = (x: number, s: Surface, h: number) =>
				((1 - s.albedo) * (sunlight(h) - MEAN_SUN) - LOSS * x) / s.capacity;
			const hm = hour + 0.5 / PER_HOUR;
			const am = a + (step(a, LAND, hour) * dt) / 2;
			const bm = b + (step(b, SEA, hour) * dt) / 2;
			const vm = v + ((push(LAND.mean + a - SEA.mean - b) - FRICTION * v) * dt) / 2;
			a += step(am, LAND, hm) * dt;
			b += step(bm, SEA, hm) * dt;
			v += (push(LAND.mean + am - SEA.mean - bm) - FRICTION * vm) * dt;
		}
	}
	out.push({ ...out[0], hour: 24 });
	return out;
})();

/** The moment at solar `hour` (0–24, wrapping), interpolated between samples. */
export function at(hour: number): Moment {
	const h = ((hour % 24) + 24) % 24;
	const x = h * PER_HOUR;
	const i = Math.min(day.length - 2, Math.floor(x));
	const f = x - i;
	const p = day[i];
	const q = day[i + 1];
	const mix = (u: number, w: number) => u + (w - u) * f;
	return {
		hour: h,
		land: mix(p.land, q.land),
		sea: mix(p.sea, q.sea),
		breeze: mix(p.breeze, q.breeze),
		sun: mix(p.sun, q.sun)
	};
}

/** The day's extremes of one quantity, with the hours they happen. */
export function extremes(key: 'land' | 'sea' | 'breeze') {
	let lo = day[0];
	let hi = day[0];
	for (const m of day) {
		if (m[key] < lo[key]) lo = m;
		if (m[key] > hi[key]) hi = m;
	}
	return { min: lo[key], minHour: lo.hour, max: hi[key], maxHour: hi.hour };
}

/** Hours at which the breeze turns round: [turns onshore, turns offshore]. */
export function turns(): { onshore: number; offshore: number } {
	let onshore = NaN;
	let offshore = NaN;
	for (let i = 1; i < day.length; i++) {
		const a = day[i - 1].breeze;
		const b = day[i].breeze;
		const h = day[i - 1].hour + (a / (a - b)) * (day[i].hour - day[i - 1].hour);
		if (a < 0 && b >= 0) onshore = h;
		if (a > 0 && b <= 0) offshore = h;
	}
	return { onshore, offshore };
}

/** Speed in km/h, rounded to a whole number. */
export const kmh = (v: number) => Math.round(Math.abs(v) * 3.6);
