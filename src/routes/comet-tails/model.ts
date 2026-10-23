/**
 * Comet 1P/Halley on its real orbit, and the two tails sunlight pulls out of it.
 *
 * - The orbit is a Kepler ellipse with Halley's elements from JPL (orbit solution 75, at the
 *   1986 perihelion; Courtesy NASA/JPL-Caltech), drawn flat in its own plane with
 *   the Sun at the origin and the closest point (perihelion) on the +x axis. Distances are in
 *   au (Earth's average distance from the Sun), times in days from the 1986 perihelion.
 * - How fast ice turns to gas follows the water-ice sublimation law of Marsden, Sekanina and
 *   Yeomans (1973, AJ 78, 211), the curve fitted to how a sublimating ice ball's output falls
 *   with distance from the Sun; it is 1 at Earth's distance and collapses past about 3 au.
 * - The gas tail points along the solar wind as the comet feels it: 400 km/s straight out from
 *   the Sun, minus the comet's own velocity. So it points almost straight away from the Sun,
 *   bent back by a few degrees (Biermann's aberration).
 * - Dust grains leave the nucleus with its velocity and then move under the Sun's gravity
 *   weakened by the push of sunlight: a grain with `beta` 0.5 feels half the Sun's pull. This is
 *   the Finson–Probstein model of dust tails (ejection speeds ignored); the grains of one size
 *   released at different times lie on a curve (a syndyne) that bends back along the orbit.
 */

/**
 * Halley's orbital elements: JPL orbit solution 75 (the Small-Body Database's), as osculating
 * elements at the 1986 perihelion from JPL Horizons (epoch 1986-Feb-09.0 TDB).
 */
export const HALLEY = {
	/** Perihelion distance, au. */
	q: 0.5871034488173393,
	e: 0.9672792271749998,
	/** Semi-major axis, au. */
	a: 17.94283564013973,
	/** Aphelion distance, au. */
	Q: 35.29856783146212,
	/** Orbital period, days. */
	period: 27760.99611023302,
	/** Time of perihelion, Julian date (TDB): 9 February 1986. */
	tp: 2446470.958961020689
} as const;

/** Gaussian gravitational constant squared: the Sun's pull, in au³ per day². */
export const MU = 0.01720209895 ** 2;
export const AU_KM = 149_597_870.7;
const DAY_S = 86_400;
/** Speed of the slow solar wind, km/s. */
export const SOLAR_WIND = 400;
/** Sunlight's strength at Earth's distance, W/m² (the solar constant). */
const SOLAR_CONSTANT = 1361;
const SIGMA = 5.670374419e-8;

export interface State {
	/** Position, au (Sun at the origin, perihelion on +x). */
	x: number;
	y: number;
	/** Velocity, au per day. */
	vx: number;
	vy: number;
	/** Distance from the Sun, au. */
	r: number;
}

/** Eccentric anomaly for mean anomaly `M` (Kepler's equation, Newton's method). */
function eccentric(M: number, e: number): number {
	let E = M + 0.85 * e * Math.sign(Math.sin(M));
	for (let i = 0; i < 50; i++) {
		const f = E - e * Math.sin(E) - M;
		const dE = f / (1 - e * Math.cos(E));
		E -= dE;
		if (Math.abs(dE) < 1e-13) break;
	}
	return E;
}

/** Halley's position and velocity `days` after the 1986 perihelion (negative: before). */
export function stateAt(days: number): State {
	const { a, e, period } = HALLEY;
	const n = (2 * Math.PI) / period;
	// Mean anomaly in (−π, π], so the comet comes in on one side and leaves on the other.
	let M = (n * days) % (2 * Math.PI);
	if (M > Math.PI) M -= 2 * Math.PI;
	if (M <= -Math.PI) M += 2 * Math.PI;
	const E = eccentric(M, e);
	const b = a * Math.sqrt(1 - e * e);
	const x = a * (Math.cos(E) - e);
	const y = b * Math.sin(E);
	const r = a * (1 - e * Math.cos(E));
	const Edot = n / (1 - e * Math.cos(E));
	return { x, y, vx: -a * Math.sin(E) * Edot, vy: b * Math.cos(E) * Edot, r };
}

/** Days after perihelion at which the comet, coming in (`-1`) or going out (`1`), is `r` au out. */
export function daysAtDistance(r: number, side: -1 | 1 = -1): number {
	const { a, e, period } = HALLEY;
	const E = Math.acos((1 - r / a) / e);
	const M = E - e * Math.sin(E);
	return (side * M * period) / (2 * Math.PI);
}

/** Speed, km/s. */
export const speed = (s: State) => (Math.hypot(s.vx, s.vy) * AU_KM) / DAY_S;

/** The orbit as a closed polyline (au), from perihelion round and back. */
export function orbitPath(samples = 360): { x: number; y: number }[] {
	const { a, e } = HALLEY;
	const b = a * Math.sqrt(1 - e * e);
	const pts = [];
	for (let i = 0; i <= samples; i++) {
		const E = (i / samples) * 2 * Math.PI;
		pts.push({ x: a * (Math.cos(E) - e), y: b * Math.sin(E) });
	}
	return pts;
}

/** How much stronger sunlight is than at Earth (below 1: weaker). */
export const sunlight = (r: number) => 1 / (r * r);

/**
 * Temperature (°C) a dark, fast-spinning ball would warm to in sunlight at `r` au: the warmth
 * it soaks up balances what it glows away. Ice that is turning to gas stays colder than this.
 */
export const darkTemperature = (r: number) =>
	Math.pow((SOLAR_CONSTANT * sunlight(r)) / (4 * SIGMA), 0.25) - 273.15;

/**
 * How fast the ice turns to gas at `r` au, compared with at Earth's distance (Marsden,
 * Sekanina and Yeomans 1973, water ice).
 */
export function iceRate(r: number): number {
	const r0 = 2.808;
	const u = r / r0;
	return 0.111262 * Math.pow(u, -2.15) * Math.pow(1 + Math.pow(u, 5.093), -4.6142);
}

export interface Dir {
	x: number;
	y: number;
}

/** Unit vector straight away from the Sun. */
export const antiSun = (s: State): Dir => ({ x: s.x / s.r, y: s.y / s.r });

/** Unit vector of the comet's motion. */
export function heading(s: State): Dir {
	const v = Math.hypot(s.vx, s.vy);
	return { x: s.vx / v, y: s.vy / v };
}

/** Which way the gas tail points: along the solar wind as the moving comet meets it. */
export function gasTailDirection(s: State): Dir {
	const k = DAY_S / AU_KM; // km/s → au/day
	const wx = SOLAR_WIND * k * (s.x / s.r) - s.vx;
	const wy = SOLAR_WIND * k * (s.y / s.r) - s.vy;
	const w = Math.hypot(wx, wy);
	return { x: wx / w, y: wy / w };
}

/** Angle in degrees between two unit vectors. */
export const angleBetween = (u: Dir, v: Dir) =>
	(Math.acos(Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y))) * 180) / Math.PI;

/** Angle (degrees) between the gas tail and the line straight away from the Sun. */
export const tailBend = (s: State) => angleBetween(gasTailDirection(s), antiSun(s));

/**
 * Angle (degrees) between the gas tail and the way the comet is going: near 180 the tail
 * streams behind it, near 0 it goes first.
 */
export const tailToHeading = (s: State) => angleBetween(gasTailDirection(s), heading(s));

/** Where a dust grain is at `now` (days), released from the nucleus at `released`. */
export function grainAt(released: number, beta: number, now: number): State {
	const s = stateAt(released);
	let { x, y, vx, vy } = s;
	const mu = MU * (1 - beta);
	const acc = (px: number, py: number) => {
		const r3 = Math.pow(px * px + py * py, 1.5);
		return [(-mu * px) / r3, (-mu * py) / r3];
	};
	const span = now - released;
	const steps = Math.max(1, Math.ceil(Math.abs(span) / 0.25));
	const h = span / steps;
	for (let i = 0; i < steps; i++) {
		// Runge–Kutta–Nyström, fourth order, for position under an acceleration.
		const h2 = h * h;
		const [a1x, a1y] = acc(x, y);
		const [a2x, a2y] = acc(x + (h / 2) * vx + (h2 / 8) * a1x, y + (h / 2) * vy + (h2 / 8) * a1y);
		const [a3x, a3y] = acc(x + (h / 2) * vx + (h2 / 8) * a2x, y + (h / 2) * vy + (h2 / 8) * a2y);
		const [a4x, a4y] = acc(x + h * vx + (h2 / 2) * a3x, y + h * vy + (h2 / 2) * a3y);
		const nx = x + h * vx + (h2 / 6) * (a1x + a2x + a3x);
		const ny = y + h * vy + (h2 / 6) * (a1y + a2y + a3y);
		vx += (h / 6) * (a1x + 2 * a2x + 2 * a3x + a4x);
		vy += (h / 6) * (a1y + 2 * a2y + 2 * a3y + a4y);
		x = nx;
		y = ny;
	}
	return { x, y, vx, vy, r: Math.hypot(x, y) };
}

/** Pushes of sunlight on the grains the page draws: from big grains (0.1) to the finest (1). */
export const BETAS = [0.1, 0.25, 0.5, 1] as const;

export interface Grain {
	beta: number;
	/** Days since it left the nucleus. */
	age: number;
	x: number;
	y: number;
	/** How much dust left at its release (the ice rate then), 0–1 relative to perihelion. */
	weight: number;
}

/**
 * The dust tail at `now`: grains of each size in `BETAS`, released every `every` days over the
 * last `maxAge` days.
 */
export function dustTail(now: number, maxAge = 40, every = 2): Grain[] {
	const peak = iceRate(HALLEY.q);
	const out: Grain[] = [];
	for (const beta of BETAS) {
		for (let age = every; age <= maxAge; age += every) {
			const g = grainAt(now - age, beta, now);
			const weight = Math.min(1, iceRate(stateAt(now - age).r) / peak);
			out.push({ beta, age, x: g.x, y: g.y, weight });
		}
	}
	return out;
}

/** Julian date to a calendar date (Gregorian), as day, month (1–12) and year. */
function calendar(jd: number): { d: number; m: number; y: number } {
	const Z = Math.floor(jd + 0.5);
	const alpha = Math.floor((Z - 1867216.25) / 36524.25);
	const A = Z + 1 + alpha - Math.floor(alpha / 4);
	const B = A + 1524;
	const C = Math.floor((B - 122.1) / 365.25);
	const D = Math.floor(365.25 * C);
	const E = Math.floor((B - D) / 30.6001);
	const d = B - D - Math.floor(30.6001 * E);
	const m = E < 14 ? E - 1 : E - 13;
	return { d, m, y: m > 2 ? C - 4716 : C - 4715 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date `days` after the 1986 perihelion, as "9 Feb 1986". */
export function dateOf(days: number): string {
	const { d, m, y } = calendar(HALLEY.tp + days);
	return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The calendar year (with fraction) `days` after the 1986 perihelion. */
export const yearOf = (days: number) => 2000 + (HALLEY.tp + days - 2451545) / 365.25;

/** Days after the 1986 perihelion at the given calendar year (with fraction). */
export const daysOfYear = (year: number) => (year - 2000) * 365.25 + 2451545 - HALLEY.tp;

/** Total days of one orbit spent closer to the Sun than `r` au. */
export const daysWithin = (r: number) => 2 * daysAtDistance(r, 1);

/**
 * Days after the 1986 perihelion at which the comet passes closest to the point (`x`, `y`) au,
 * between `lo` and `hi` days: for dragging the comet along its path.
 */
export function nearestDay(x: number, y: number, lo: number, hi: number, samples = 400): number {
	let best = lo;
	let bestD = Infinity;
	// Sample evenly in the eccentric anomaly, which spreads the samples along the path.
	const { a, e, period } = HALLEY;
	const b = a * Math.sqrt(1 - e * e);
	const n = (2 * Math.PI) / period;
	const E0 = eccentric(Math.max(-Math.PI, n * lo), e);
	const E1 = eccentric(Math.min(Math.PI, n * hi), e);
	for (let i = 0; i <= samples; i++) {
		const E = E0 + (i / samples) * (E1 - E0);
		const d = ((E - e * Math.sin(E)) * period) / (2 * Math.PI);
		const dd = (a * (Math.cos(E) - e) - x) ** 2 + (b * Math.sin(E) - y) ** 2;
		if (dd < bestD) {
			bestD = dd;
			best = d;
		}
	}
	return best;
}
