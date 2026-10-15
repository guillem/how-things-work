/**
 * The orbital (Milankovitch) theory of the ice ages: Earth's orbit from the
 * La2004 solution, the sunlight it brings to each latitude, and the ice-core
 * record it is compared with.
 *
 * Insolation is the standard daily mean at the top of the atmosphere (Berger
 * 1978, J. Atmos. Sci. 35, 2362):
 *
 *   Q = (S₀ / π) (a / r)² (h₀ sin φ sin δ + cos φ cos δ sin h₀)
 *
 * with φ the latitude, δ the Sun's declination (sin δ = sin ε sin λ, ε the
 * obliquity, λ the Sun's true longitude from the March equinox), h₀ the hour
 * angle of sunset and r / a = (1 − e²) / (1 + e cos v), where the true anomaly
 * is v = λ − ϖ − 180° (ϖ: heliocentric longitude of perihelion from the moving
 * equinox, as La2004 and Berger tabulate it; the Sun seen from Earth is at
 * perihelion when its longitude is ϖ + 180°).
 */
import { CO2_NOW, CO2_RECORD, DOME_C_TEMPERATURE } from './icecore-data';
import { ECCENTRICITY, OBLIQUITY, ORBIT_FIRST_KYR, PERIHELION } from './orbit-data';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const mod360 = (a: number) => ((a % 360) + 360) % 360;

/** Total solar irradiance, W/m² (Kopp & Lean 2011, GRL 38, L01706: 1360.8 ± 0.5). */
export const SOLAR = 1361;
/** Length of the year, days, and day of the March equinox (0 = 1 January; 20 March). */
export const YEAR = 365.2422;
export const MARCH_EQUINOX_DAY = 78.6;
/** The latitude most often used since Milankovitch: where the great northern ice sheets grew. */
export const LAT_65N = 65;

export interface Orbit {
	/** Eccentricity: 0 for a circle. */
	e: number;
	/** Obliquity, the tilt of the axis, degrees. */
	tilt: number;
	/** Heliocentric longitude of perihelion from the moving March equinox, degrees. */
	peri: number;
}

// ------------------------------------------------------------------ orbit through time

export const ORBIT_LAST_KYR = ORBIT_FIRST_KYR + ECCENTRICITY.length - 1;

/**
 * Orbit `kyr` thousand years from now (negative: in the past), interpolated
 * linearly between La2004's 1 kyr rows (the perihelion through the short way round).
 */
export function orbitAt(kyr: number): Orbit {
	const x = Math.min(ORBIT_LAST_KYR, Math.max(ORBIT_FIRST_KYR, kyr)) - ORBIT_FIRST_KYR;
	const i = Math.min(ECCENTRICITY.length - 2, Math.floor(x));
	const f = x - i;
	const lerp = (a: readonly number[]) => a[i] + (a[i + 1] - a[i]) * f;
	let dp = PERIHELION[i + 1] - PERIHELION[i];
	if (dp > 180) dp -= 360;
	if (dp < -180) dp += 360;
	return { e: lerp(ECCENTRICITY), tilt: lerp(OBLIQUITY), peri: mod360(PERIHELION[i] + dp * f) };
}

export const TODAY: Orbit = orbitAt(0);

// ------------------------------------------------------------------ sunlight

/** Earth–Sun distance in units of the semi-major axis when the Sun's true longitude is `lambda`. */
export function distance(o: Orbit, lambda: number) {
	const v = rad(lambda - o.peri - 180);
	return (1 - o.e * o.e) / (1 + o.e * Math.cos(v));
}

/** Solar declination, degrees, at true longitude `lambda` (90 = June solstice). */
export const declination = (o: Orbit, lambda: number) =>
	deg(Math.asin(Math.sin(rad(o.tilt)) * Math.sin(rad(lambda))));

/** Daily mean insolation at the top of the atmosphere, W/m², at latitude `lat` (degrees). */
export function dailyInsolation(o: Orbit, lat: number, lambda: number) {
	const p = rad(lat);
	const d = rad(declination(o, lambda));
	const x = -Math.tan(p) * Math.tan(d);
	const h0 = x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x);
	const q = h0 * Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.sin(h0);
	const r = distance(o, lambda);
	return Math.max(0, (SOLAR / Math.PI) * q) / (r * r);
}

/** Daily mean insolation at 65° N on the June solstice, W/m²: "summer sunshine in the far north". */
export const summerSunshine = (o: Orbit) => dailyInsolation(o, LAT_65N, 90);

/**
 * Sunlight averaged over the whole globe and the whole year, W/m². Only the
 * eccentricity changes it, and only a little: S₀ / (4 √(1 − e²)).
 */
export const globalMean = (o: Orbit) => SOLAR / (4 * Math.sqrt(1 - o.e * o.e));

/**
 * Climatic precession e sin ϖ: the part of the precession that matters for
 * the seasons. Positive: the northern summer falls far from the Sun.
 */
export const climaticPrecession = (o: Orbit) => o.e * Math.sin(rad(o.peri));

/**
 * Day of the year (0 = 1 January, in a calendar tied to the March equinox)
 * when the Earth is closest to the Sun. Kepler's second law: the time from
 * perihelion to the equinox is the mean anomaly of the equinox.
 */
export function perihelionDay(o: Orbit) {
	const v = rad(mod360(-o.peri - 180));
	const E = 2 * Math.atan(Math.sqrt((1 - o.e) / (1 + o.e)) * Math.tan(v / 2));
	const M = (((E - o.e * Math.sin(E)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	return (((MARCH_EQUINOX_DAY - (M / (2 * Math.PI)) * YEAR) % YEAR) + YEAR) % YEAR;
}

/** Inverse of `perihelionDay`: the perihelion longitude that puts closest approach on `day`. */
export function periForDay(day: number, e: number) {
	const M = (2 * Math.PI * (MARCH_EQUINOX_DAY - day)) / YEAR;
	let E = M;
	for (let k = 0; k < 20; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
	const v = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
	return mod360(-deg(v) - 180);
}

// ------------------------------------------------------------------ series

export interface Point {
	/** Thousands of years ago (positive in the past, 0 = today). */
	ka: number;
	v: number;
}

/** Orbital series every 1 kyr from `fromKa` thousand years ago to `toKa` (negative: the future). */
export function orbitSeries(fromKa = 800, toKa = 0) {
	const out: { ka: number; o: Orbit; summer: number }[] = [];
	for (let ka = fromKa; ka >= toKa; ka--) {
		const o = orbitAt(-ka);
		out.push({ ka, o, summer: summerSunshine(o) });
	}
	return out;
}

const unpack = (flat: readonly number[]): Point[] => {
	const out: Point[] = [];
	for (let i = 0; i < flat.length; i += 2) out.push({ ka: flat[i] / 1000, v: flat[i + 1] });
	return out;
};

/** Antarctic (EPICA Dome C) temperature, °C from the average of the last 1000 years; youngest first. */
export const TEMPERATURE: readonly Point[] = unpack(DOME_C_TEMPERATURE);
/** CO₂ in the air from Antarctic ice, ppm, before 1850; youngest first. */
export const CO2: readonly Point[] = unpack(CO2_RECORD);
export { CO2_NOW };
/** CO₂ just before industry, ppm (AR6 WG1 §2.2.3.3: 278.3 in 1750). */
export const CO2_PREINDUSTRIAL = 278;

/** Value of a record (youngest first) at `ka`, linearly interpolated. */
export function valueAt(rec: readonly Point[], ka: number) {
	if (ka <= rec[0].ka) return rec[0].v;
	const last = rec[rec.length - 1];
	if (ka >= last.ka) return last.v;
	let lo = 0;
	let hi = rec.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (rec[mid].ka <= ka) lo = mid;
		else hi = mid;
	}
	const a = rec[lo];
	const b = rec[hi];
	return a.v + ((b.v - a.v) * (ka - a.ka)) / (b.ka - a.ka);
}

/** Record resampled every 1 kyr from `fromKa` down to `toKa`. */
export const resample = (rec: readonly Point[], fromKa = 800, toKa = 0) => {
	const out: number[] = [];
	for (let ka = fromKa; ka >= toKa; ka--) out.push(valueAt(rec, ka));
	return out;
};

/** Pearson correlation of two equal-length series. */
export function correlation(a: readonly number[], b: readonly number[]) {
	const n = a.length;
	const ma = a.reduce((s, x) => s + x, 0) / n;
	const mb = b.reduce((s, x) => s + x, 0) / n;
	let sab = 0;
	let saa = 0;
	let sbb = 0;
	for (let i = 0; i < n; i++) {
		sab += (a[i] - ma) * (b[i] - mb);
		saa += (a[i] - ma) ** 2;
		sbb += (b[i] - mb) ** 2;
	}
	return sab / Math.sqrt(saa * sbb);
}

/** CO₂ forcing relative to `ref` ppm, W/m² (AR6 WG1 §7.3.2.1: 3.93 W/m² per doubling). */
export const co2Forcing = (ppm: number, ref = CO2_PREINDUSTRIAL) =>
	(3.93 * Math.log(ppm / ref)) / Math.LN2;

// ------------------------------------------------------------------ rhythms

/**
 * Amplitude spectrum of a series sampled every 1 kyr, at the given periods
 * (kyr): mean and linear trend removed, Hann window, then the amplitude of the
 * Fourier component at each period, in the series' own units (a pure sine of
 * amplitude A at one of the periods gives a peak of height A).
 */
export function spectrum(series: readonly number[], periods: readonly number[]) {
	const n = series.length;
	const mean = series.reduce((s, x) => s + x, 0) / n;
	// least-squares trend
	let sxy = 0;
	let sxx = 0;
	for (let i = 0; i < n; i++) {
		const x = i - (n - 1) / 2;
		sxy += x * (series[i] - mean);
		sxx += x * x;
	}
	const slope = sxy / sxx;
	let wsum = 0;
	const y = series.map((v, i) => {
		const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
		wsum += w;
		return (v - mean - slope * (i - (n - 1) / 2)) * w;
	});
	return periods.map((p) => {
		let re = 0;
		let im = 0;
		for (let i = 0; i < n; i++) {
			const a = (2 * Math.PI * i) / p;
			re += y[i] * Math.cos(a);
			im += y[i] * Math.sin(a);
		}
		return (2 * Math.hypot(re, im)) / wsum;
	});
}

/** Periods from 10 to 160 kyr, evenly spaced in frequency (`count` of them). */
export function spectrumPeriods(count = 240, shortest = 10, longest = 160) {
	const f0 = 1 / longest;
	const f1 = 1 / shortest;
	return Array.from({ length: count }, (_, i) => 1 / (f0 + ((f1 - f0) * i) / (count - 1)));
}

/** The local maxima of a spectrum at least `min` × the largest, strongest first. */
export function peaks(periods: readonly number[], amp: readonly number[], min = 0.1) {
	const top = Math.max(...amp);
	const out: { period: number; amp: number }[] = [];
	for (let i = 1; i < amp.length - 1; i++) {
		if (amp[i] >= amp[i - 1] && amp[i] > amp[i + 1] && amp[i] >= min * top) {
			out.push({ period: periods[i], amp: amp[i] });
		}
	}
	return out.sort((a, b) => b.amp - a.amp);
}

/**
 * The warm peaks of the record (interglacials): the warmest point of each
 * stretch that climbs above `threshold` °C, with at least `gap` kyr between
 * them. Youngest first.
 */
export function warmPeaks(rec: readonly Point[], threshold = -1.5, gap = 30) {
	const out: Point[] = [];
	let best: Point | null = null;
	for (const p of rec) {
		if (p.v >= threshold) {
			if (!best || p.v > best.v) best = p;
		} else if (best) {
			const prev = out[out.length - 1];
			if (prev && best.ka - prev.ka < gap) {
				if (best.v > prev.v) out[out.length - 1] = best;
			} else out.push(best);
			best = null;
		}
	}
	if (best) out.push(best);
	return out;
}

/**
 * The terminations of the record: for each warm peak (see `warmPeaks`), from
 * the end of the cold before it (the youngest point within 1 °C of the coldest
 * of the 40,000 years before the peak) to the first point within 1.5 °C of
 * the peak. Youngest first; ages in kyr.
 */
export function terminations(rec: readonly Point[] = TEMPERATURE) {
	return warmPeaks(rec, -2.5, 40).flatMap((peak) => {
		const before = rec.filter((p) => p.ka > peak.ka && p.ka < peak.ka + 40);
		if (before.length === 0) return [];
		const coldest = Math.min(...before.map((p) => p.v));
		const start = before.find((p) => p.v < coldest + 1);
		if (!start) return [];
		const end = rec
			.filter((p) => p.ka < start.ka && p.ka >= peak.ka)
			.reverse()
			.find((p) => p.v >= peak.v - 1.5);
		return end ? [{ from: start.ka, to: end.ka }] : [];
	});
}
