/**
 * Three classic examples of chaos and fractals, computed from their rules:
 *
 * 1. The double pendulum: two rigid rods (massless, equal length), each with
 *    a point mass at its end, swinging without friction under gravity. The
 *    equations of motion are the standard ones (e.g. Taylor, "Classical
 *    Mechanics", §11), integrated with fourth-order Runge–Kutta.
 * 2. The logistic map x → r·x·(1 − x), a model of a population that grows
 *    but is held back by crowding (May 1976).
 * 3. The Mandelbrot set: the numbers c for which z → z² + c, starting from
 *    z = 0, never runs off to infinity (Mandelbrot 1980).
 */

export const G = 9.81;

// ------------------------------------------------------------ 1. double pendulum

export interface PendulumState {
	/** Angles from straight down (rad) and angular velocities (rad/s). */
	a1: number;
	a2: number;
	w1: number;
	w2: number;
}

export const ARM = 1; // m, both rods
export const MASS = 1; // kg, both bobs

/** Time derivatives of the state (equal masses m and equal lengths L). */
function deriv(s: PendulumState, L = ARM): PendulumState {
	const { a1, a2, w1, w2 } = s;
	const d = a1 - a2;
	const den = 3 - Math.cos(2 * d); // 2m1 + m2 − m2 cos(2Δ) with m1 = m2
	const dw1 =
		(-G * 3 * Math.sin(a1) -
			G * Math.sin(a1 - 2 * a2) -
			2 * Math.sin(d) * (w2 * w2 * L + w1 * w1 * L * Math.cos(d))) /
		(L * den);
	const dw2 =
		(2 * Math.sin(d) * (w1 * w1 * L * 2 + G * 2 * Math.cos(a1) + w2 * w2 * L * Math.cos(d))) /
		(L * den);
	return { a1: w1, a2: w2, w1: dw1, w2: dw2 };
}

const add = (s: PendulumState, k: PendulumState, h: number): PendulumState => ({
	a1: s.a1 + h * k.a1,
	a2: s.a2 + h * k.a2,
	w1: s.w1 + h * k.w1,
	w2: s.w2 + h * k.w2
});

/** One RK4 step of length h. */
export function rk4(s: PendulumState, h: number): PendulumState {
	const k1 = deriv(s);
	const k2 = deriv(add(s, k1, h / 2));
	const k3 = deriv(add(s, k2, h / 2));
	const k4 = deriv(add(s, k3, h));
	return {
		a1: s.a1 + (h / 6) * (k1.a1 + 2 * k2.a1 + 2 * k3.a1 + k4.a1),
		a2: s.a2 + (h / 6) * (k1.a2 + 2 * k2.a2 + 2 * k3.a2 + k4.a2),
		w1: s.w1 + (h / 6) * (k1.w1 + 2 * k2.w1 + 2 * k3.w1 + k4.w1),
		w2: s.w2 + (h / 6) * (k1.w2 + 2 * k2.w2 + 2 * k3.w2 + k4.w2)
	};
}

/** Total energy (J): kinetic + potential (zero with both rods hanging straight down). */
export function energy(s: PendulumState, L = ARM, m = MASS) {
	const { a1, a2, w1, w2 } = s;
	const v1sq = L * L * w1 * w1;
	const v2sq = L * L * (w1 * w1 + w2 * w2 + 2 * w1 * w2 * Math.cos(a1 - a2));
	const ke = 0.5 * m * v1sq + 0.5 * m * v2sq;
	const y1 = -L * Math.cos(a1);
	const y2 = y1 - L * Math.cos(a2);
	const pe = m * G * (y1 + L) + m * G * (y2 + 2 * L);
	return ke + pe;
}

/** Positions of the two bobs (m), origin at the pivot, y up. */
export function bobs(s: PendulumState, L = ARM) {
	const x1 = L * Math.sin(s.a1);
	const y1 = -L * Math.cos(s.a1);
	return { x1, y1, x2: x1 + L * Math.sin(s.a2), y2: y1 - L * Math.cos(s.a2) };
}

/**
 * Simulates a pendulum released at rest from angles (degrees) for `seconds`,
 * returning the state every `sample` seconds (integrated with steps of at most 1 ms).
 */
export function swing(
	a1deg: number,
	a2deg: number,
	seconds: number,
	sample = 1 / 60
): PendulumState[] {
	const rad = Math.PI / 180;
	let s: PendulumState = { a1: a1deg * rad, a2: a2deg * rad, w1: 0, w2: 0 };
	const every = Math.max(1, Math.ceil(sample / 0.001)); // steps of at most 1 ms
	const h = sample / every;
	const out = [s];
	const steps = Math.round(seconds / h);
	for (let i = 1; i <= steps; i++) {
		s = rk4(s, h);
		if (i % every === 0) out.push(s);
	}
	return out;
}

/** Distance (m) between the lower bobs of two pendulums. */
export const separation = (p: PendulumState, q: PendulumState) => {
	const a = bobs(p);
	const b = bobs(q);
	return Math.hypot(a.x2 - b.x2, a.y2 - b.y2);
};

// ------------------------------------------------------------ 2. logistic map

export const logistic = (r: number, x: number) => r * x * (1 - x);

/** The first `n` values of the logistic map from x0. */
export function orbit(r: number, x0: number, n: number) {
	const out = [x0];
	for (let i = 1; i < n; i++) out.push(logistic(r, out[i - 1]));
	return out;
}

/**
 * Where the map settles for growth rate r: iterate past `transient` steps,
 * then collect up to `keep` values, merging values closer than `tol`. A
 * short list is a cycle (1 value = a steady population); a long one, chaos.
 */
export function attractor(r: number, transient = 2000, keep = 256, x0 = 0.5, tol = 1e-6) {
	let x = x0;
	for (let i = 0; i < transient; i++) x = logistic(r, x);
	const vals: number[] = [];
	for (let i = 0; i < keep; i++) {
		x = logistic(r, x);
		if (!vals.some((v) => Math.abs(v - x) < tol)) vals.push(x);
	}
	return vals.sort((a, b) => a - b);
}

/** Period of the attractor (number of distinct values), or Infinity if it looks chaotic (more than 64). */
export function period(r: number) {
	const n = attractor(r).length;
	return n > 64 ? Infinity : n;
}

/** The first period-doubling points of the logistic map (known values): 2 → 4 → 8 → 16 → 32. */
export const DOUBLINGS = [3, 3.449489743, 3.544090359, 3.564407266, 3.56875942];
/** Where the cascade ends and chaos begins. */
export const CHAOS_ONSET = 3.569945672;
/** Feigenbaum's constant: the ratio of successive gaps between doublings. */
export const FEIGENBAUM = 4.669201609;

/** Lyapunov exponent of the logistic map at r: > 0 means nearby starts separate exponentially (chaos). */
export function lyapunov(r: number, n = 4000, transient = 1000) {
	let x = 0.4;
	for (let i = 0; i < transient; i++) x = logistic(r, x);
	let sum = 0;
	for (let i = 0; i < n; i++) {
		x = logistic(r, x);
		sum += Math.log(Math.max(1e-12, Math.abs(r * (1 - 2 * x))));
	}
	return sum / n;
}

// ------------------------------------------------------------ 3. Mandelbrot

/**
 * Escape time of c = (cx, cy): how many steps of z → z² + c (from z = 0)
 * before |z| > 2, or `max` if it never escapes in `max` steps (taken to be in
 * the set). Returns a smooth (fractional) count for nicer colouring.
 */
export function escape(cx: number, cy: number, max: number): number {
	// Skip the main cardioid and the period-2 bulb, which are in the set.
	const q = (cx - 0.25) ** 2 + cy * cy;
	if (q * (q + (cx - 0.25)) <= 0.25 * cy * cy) return max;
	if ((cx + 1) ** 2 + cy * cy <= 1 / 16) return max;
	let x = 0;
	let y = 0;
	let i = 0;
	while (i < max) {
		const xx = x * x;
		const yy = y * y;
		if (xx + yy > 256) break; // escape radius 16 for smooth colouring (|z| > 2 already escapes)
		y = 2 * x * y + cy;
		x = xx - yy + cx;
		i++;
	}
	if (i >= max) return max;
	const mod = Math.sqrt(x * x + y * y);
	return i + 1 - Math.log(Math.log(mod)) / Math.LN2;
}

/** Is c in the Mandelbrot set (to `max` iterations)? */
export const inSet = (cx: number, cy: number, max = 500) => escape(cx, cy, max) >= max;

/** How many iterations to use at a zoom (view width in the complex plane). */
export const iterationsFor = (width: number) =>
	Math.round(Math.min(3000, 120 + 90 * Math.log2(3 / width)));

/** Places worth zooming into: centre and the width of the view there. */
export const TOUR = [
	{ id: 'whole', label: 'The whole set', x: -0.6, y: 0, width: 3.2 },
	{ id: 'seahorse', label: 'Seahorse valley', x: -0.7453, y: 0.1127, width: 0.01 },
	{ id: 'spiral', label: 'A spiral', x: -0.761574, y: -0.0847596, width: 0.0006 },
	{ id: 'minibrot', label: 'A tiny copy of the set', x: -1.7549, y: 0, width: 0.04 }
];
