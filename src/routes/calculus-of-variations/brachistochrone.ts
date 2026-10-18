/**
 * The mathematics behind the brachistochrone explainer: a bead slides without
 * friction from rest at the start A = (0, 0) to the end B = (L, h), with depth y
 * measured downwards from A, under g = 9.81 m/s². Energy gives its speed at depth
 * y, v = √(2g·y), so the descent time along a curve is T = ∫ ds / √(2g·y).
 *
 * Every curve is a polyline (the reader's spline, the arc and the cycloid are
 * sampled finely). On one straight segment the acceleration is constant, so the
 * time is exact: the average speed is (v₀ + v₁)/2, and Δt = 2ℓ/(v₀ + v₁). That
 * is the substitution that tames the integrand's 1/√y at the start: the first
 * segment, from v₀ = 0, takes the finite 2ℓ/v₁. The polyline's time is then a
 * smooth function of its node depths, with an exact gradient, and gradient
 * descent on it finds the fastest polyline.
 */

export const G = 9.81;

export interface Pt {
	x: number;
	/** Depth below the start (m, downwards). */
	y: number;
}

const K = Math.sqrt(2 / G);

/** Time on a straight segment from depth y0 to depth y1 (length ℓ), from rest at depth 0. */
function segmentTime(len: number, y0: number, y1: number): number {
	const s = Math.sqrt(Math.max(0, y0)) + Math.sqrt(Math.max(0, y1));
	return s > 0 ? (K * len) / s : len > 0 ? Infinity : 0;
}

/**
 * Cumulative arrival times at the polyline's points (the first is 0). A point at
 * or above the start's height after the first one stops the bead: from there on
 * the times are Infinity (it never arrives).
 */
export function arrivalTimes(pts: readonly Pt[]): number[] {
	const out = [0];
	let t = 0;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		if (!(b.y > 0) && i > 0) t = Infinity;
		else t += segmentTime(Math.hypot(b.x - a.x, b.y - a.y), a.y, b.y);
		out.push(t);
	}
	return out;
}

/** The descent time along a polyline (s); Infinity if the bead never gets to the end. */
export function descentTime(pts: readonly Pt[]): number {
	return arrivalTimes(pts)[pts.length - 1];
}

/**
 * Where the bead is at time t (s after release), from the polyline and its
 * arrival times: inside a segment the acceleration is constant, so the distance
 * along it is v₀τ + ½aτ². Parks at the end once it has arrived.
 */
export function positionAt(pts: readonly Pt[], times: readonly number[], t: number): Pt {
	if (t <= 0) return pts[0];
	let i = 1;
	while (i < pts.length && times[i] < t) i++;
	if (i >= pts.length) {
		const last = times[pts.length - 1];
		if (Number.isFinite(last)) return pts[pts.length - 1];
		// Never arrives: stop at the last point it reaches.
		let j = pts.length - 1;
		while (j > 0 && !Number.isFinite(times[j])) j--;
		return pts[j];
	}
	const a = pts[i - 1];
	const b = pts[i];
	const len = Math.hypot(b.x - a.x, b.y - a.y);
	if (len === 0) return b;
	const v0 = Math.sqrt(2 * G * Math.max(0, a.y));
	const acc = (G * (b.y - a.y)) / len;
	const tau = t - times[i - 1];
	const s = Math.min(len, Math.max(0, v0 * tau + 0.5 * acc * tau * tau));
	return { x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len };
}

/** The speed at depth y (m/s), from energy: ½v² = g·y. */
export const speedAt = (y: number) => Math.sqrt(2 * G * Math.max(0, y));

// ------------------------------------------------------------------ the curves

/** The straight line's time, in closed form: T = √(2(L² + h²)/(g·h)). */
export const lineTime = (L: number, h: number) => Math.sqrt((2 * (L * L + h * h)) / (G * h));

export function linePoints(L: number, h: number): Pt[] {
	return [
		{ x: 0, y: 0 },
		{ x: L, y: h }
	];
}

/**
 * The circular arc through A and B that leaves A straight down (its centre is
 * level with A): radius R = (L² + h²)/(2L).
 */
export function arcPoints(L: number, h: number, n = 400): Pt[] {
	const R = (L * L + h * h) / (2 * L);
	// Angle measured at the centre (R, 0) from the direction of A (pointing −x).
	const end = Math.atan2(h, R - L); // from A's direction (−x) round to B, downwards
	const pts: Pt[] = [];
	for (let i = 0; i <= n; i++) {
		// Points crowd near A, where the bead is slow and the integrand largest.
		const phi = end * (i / n) ** 2;
		pts.push({ x: R - R * Math.cos(phi), y: R * Math.sin(phi) });
	}
	pts[n] = { x: L, y: h };
	return pts;
}

export interface Cycloid {
	/** The rolling circle's radius (m). */
	r: number;
	/** The angle the circle has turned through at B (rad). */
	theta: number;
	/** The exact descent time, θ·√(r/g) (s). */
	T: number;
	/** The deepest point's depth: 2r if θ > π, else h. */
	lowest: number;
	/** The point after the circle has turned through φ. */
	at(phi: number): Pt;
}

/**
 * The cycloid from A through B, traced by a point on a circle of radius r
 * rolling along the underside of the line through A: x = r(φ − sin φ),
 * y = r(1 − cos φ). θ solves (θ − sin θ)/(1 − cos θ) = L/h (bisection: the left
 * side grows from 0 to ∞ on (0, 2π)).
 */
export function cycloid(L: number, h: number): Cycloid {
	const target = L / h;
	let lo = 1e-9;
	let hi = 2 * Math.PI - 1e-12;
	for (let k = 0; k < 200; k++) {
		const mid = (lo + hi) / 2;
		if ((mid - Math.sin(mid)) / (1 - Math.cos(mid)) < target) lo = mid;
		else hi = mid;
	}
	const theta = (lo + hi) / 2;
	const r = h / (1 - Math.cos(theta));
	return {
		r,
		theta,
		T: theta * Math.sqrt(r / G),
		lowest: theta > Math.PI ? 2 * r : h,
		at: (phi) => ({ x: r * (phi - Math.sin(phi)), y: r * (1 - Math.cos(phi)) })
	};
}

/** The cycloid sampled at n + 1 points, evenly in the rolling angle (which crowds them near A). */
export function cycloidPoints(c: Cycloid, n = 400): Pt[] {
	return Array.from({ length: n + 1 }, (_, i) => c.at((c.theta * i) / n));
}

/** The cycloid's depth at horizontal distance x (Newton's method on the rolling angle). */
export function cycloidDepthAt(c: Cycloid, x: number): number {
	if (x <= 0) return 0;
	// Start from the small-angle form x ≈ rφ³/6, or the end.
	let phi = Math.min(c.theta, Math.cbrt((6 * x) / c.r));
	for (let k = 0; k < 60; k++) {
		const f = c.r * (phi - Math.sin(phi)) - x;
		const d = c.r * (1 - Math.cos(phi));
		const next = d > 1e-14 ? phi - f / d : phi * 1.5;
		phi = Math.min(2 * Math.PI, Math.max(1e-12, next));
		if (Math.abs(f) < 1e-14) break;
	}
	return c.r * (1 - Math.cos(phi));
}

/**
 * The reader's curve: a natural cubic spline through A, the control depths at
 * evenly spaced x (L/(n + 1), 2L/(n + 1), …) and B. Returns its depth at x.
 */
export function spline(L: number, h: number, depths: readonly number[]): (x: number) => number {
	const ys = [0, ...depths, h];
	const m = ys.length - 1;
	const dx = L / m;
	// Natural spline: second derivatives M with M₀ = Mₘ = 0, from
	// M_{i−1} + 4Mᵢ + M_{i+1} = 6(y_{i+1} − 2yᵢ + y_{i−1})/Δx² (a tridiagonal solve).
	const M = new Array<number>(m + 1).fill(0);
	if (m > 1) {
		const b = new Array<number>(m + 1).fill(4);
		const d = new Array<number>(m + 1).fill(0);
		for (let i = 1; i < m; i++) d[i] = (6 * (ys[i + 1] - 2 * ys[i] + ys[i - 1])) / (dx * dx);
		for (let i = 2; i < m; i++) {
			const w = 1 / b[i - 1];
			b[i] -= w;
			d[i] -= w * d[i - 1];
		}
		for (let i = m - 1; i >= 1; i--) M[i] = (d[i] - M[i + 1]) / b[i];
	}
	return (x: number) => {
		const s = Math.min(m - 1, Math.max(0, Math.floor(x / dx)));
		const u = x / dx - s;
		const A = 1 - u;
		return (
			A * ys[s] + u * ys[s + 1] + ((A ** 3 - A) * M[s] + (u ** 3 - u) * M[s + 1]) * ((dx * dx) / 6)
		);
	};
}

/** The reader's curve sampled finely (crowded towards A, where the bead is slow). */
export function splinePoints(L: number, h: number, depths: readonly number[], n = 300): Pt[] {
	const f = spline(L, h, depths);
	const pts = Array.from({ length: n + 1 }, (_, i) => {
		const x = L * (i / n) ** 1.5;
		return { x, y: f(x) };
	});
	pts[0] = { x: 0, y: 0 };
	pts[n] = { x: L, y: h };
	return pts;
}

// ------------------------------------------------------------------ optimisation

/**
 * The optimiser's grid: n + 1 fixed x positions from 0 to L, crowded towards A
 * (x ∝ (i/n)^1.5), where the fastest curve starts vertically.
 */
export function grid(L: number, n = 48): number[] {
	return Array.from({ length: n + 1 }, (_, i) => L * (i / n) ** 1.5);
}

const toPts = (xs: readonly number[], ys: readonly number[]): Pt[] =>
	xs.map((x, i) => ({ x, y: ys[i] }));

/** The descent time of the polyline through (xs[i], ys[i]). */
export const gridTime = (xs: readonly number[], ys: readonly number[]) =>
	descentTime(toPts(xs, ys));

/**
 * ∂T/∂yᵢ for the interior nodes (0 at the two fixed ends): each depth enters the
 * two segments that meet at it.
 */
export function gradient(xs: readonly number[], ys: readonly number[]): number[] {
	const n = xs.length - 1;
	const g = new Array<number>(n + 1).fill(0);
	for (let j = 0; j < n; j++) {
		const dx = xs[j + 1] - xs[j];
		const dy = ys[j + 1] - ys[j];
		const len = Math.hypot(dx, dy);
		const r0 = Math.sqrt(Math.max(1e-12, ys[j]));
		const r1 = Math.sqrt(Math.max(1e-12, ys[j + 1]));
		const S = j === 0 ? r1 : r0 + r1;
		// t = K·len/S
		const dLen1 = dy / len; // ∂len/∂y_{j+1}
		if (j + 1 < n) g[j + 1] += K * (dLen1 / S - len / (S * S) / (2 * r1));
		if (j > 0) g[j] += K * (-dLen1 / S - len / (S * S) / (2 * r0));
	}
	return g;
}

/**
 * The discrete Euler–Lagrange residual at the interior nodes: ∂T/∂yᵢ divided by
 * the width of x the node stands for, (x_{i+1} − x_{i−1})/2. It tends to the
 * functional derivative δT/δy = ∂F/∂y − d/dx ∂F/∂y′ (s/m²), which is zero all
 * along the fastest curve.
 */
export function residual(xs: readonly number[], ys: readonly number[]): number[] {
	const g = gradient(xs, ys);
	return g.map((v, i) => (i === 0 || i === xs.length - 1 ? 0 : v / ((xs[i + 1] - xs[i - 1]) / 2)));
}

/**
 * The direction of steepest descent when a change δy to the curve is measured by
 * Σ wᵢ δyᵢ² + β Σ (δy_{i+1} − δyᵢ)²/Δxᵢ (its size plus its wiggliness): the
 * solution d of (W + β·Δ)d = −g, a tridiagonal system. With β = 0 it is −gᵢ/wᵢ;
 * a β > 0 moves neighbouring points together, so long smooth changes of shape are
 * not starved by the jagged ones (plain descent would crawl).
 */
function smoothedDescent(
	xs: readonly number[],
	w: readonly number[],
	g: readonly number[],
	beta: number
): number[] {
	const n = xs.length - 1;
	const d = new Array<number>(n + 1).fill(0);
	const m = n - 1; // unknowns 1…n−1
	if (m < 1) return d;
	const a = new Array<number>(m).fill(0);
	const b = new Array<number>(m).fill(0);
	const c = new Array<number>(m).fill(0);
	const r = new Array<number>(m).fill(0);
	for (let k = 0; k < m; k++) {
		const i = k + 1;
		const kl = beta / (xs[i] - xs[i - 1]);
		const kr = beta / (xs[i + 1] - xs[i]);
		a[k] = -kl;
		b[k] = w[i] + kl + kr;
		c[k] = -kr;
		r[k] = -g[i];
	}
	for (let k = 1; k < m; k++) {
		const f = a[k] / b[k - 1];
		b[k] -= f * c[k - 1];
		r[k] -= f * r[k - 1];
	}
	d[m] = r[m - 1] / b[m - 1];
	for (let k = m - 2; k >= 0; k--) d[k + 1] = (r[k] - c[k] * d[k + 2]) / b[k];
	return d;
}

export interface Iterate {
	/** Iteration number. */
	k: number;
	ys: number[];
	T: number;
	/** Largest |residual| over the interior nodes (s/m²). */
	worst: number;
}

/**
 * Gradient descent on the node depths, steepest descent of T in the metric of
 * the functional (each component of the gradient divided by its node's width),
 * with a backtracking line search: every accepted step makes the slide faster.
 * Returns the iterates whose numbers are in `keep` (sorted), plus the last.
 */
export function optimise(
	xs: readonly number[],
	start: readonly number[],
	iterations: number,
	keep: (k: number) => boolean = () => true,
	beta = 0.1
): Iterate[] {
	const n = xs.length - 1;
	const w = xs.map((_, i) => (i === 0 || i === n ? 1 : (xs[i + 1] - xs[i - 1]) / 2));
	// Depths at or above the start would stop the bead: begin from a curve that descends.
	let ys = start.map((y, i) => (i === 0 ? 0 : Math.max(y, 1e-6)));
	let T = gridTime(xs, ys);
	let step = 0.02;
	const out: Iterate[] = [];
	const record = (k: number) => {
		const r = residual(xs, ys);
		out.push({ k, ys: [...ys], T, worst: Math.max(...r.map(Math.abs)) });
	};
	for (let k = 0; k <= iterations; k++) {
		if (keep(k) || k === iterations) record(k);
		if (k === iterations) break;
		const g = gradient(xs, ys);
		const d = smoothedDescent(xs, w, g, beta);
		const slope = d.reduce((s, v, i) => s + v * g[i], 0);
		let accepted = false;
		for (let tries = 0; tries < 40; tries++) {
			const trial = ys.map((y, i) => y + step * d[i]);
			const Tt = trial.slice(1).every((y) => y > 0) ? gridTime(xs, trial) : Infinity;
			if (Tt <= T + 1e-4 * step * slope) {
				ys = trial;
				T = Tt;
				accepted = true;
				step *= 1.3;
				break;
			}
			step /= 2;
		}
		if (!accepted) step = 1e-6;
	}
	return out;
}

// ------------------------------------------------------------------ Beltrami / Snell

/**
 * Along each segment of a polyline: sin φ / v, where φ is the angle of the path
 * from the vertical and v the speed at the segment's mid-depth (s/m). For this
 * functional Beltrami's identity, F − y′·∂F/∂y′ = constant, says exactly that
 * this is the same all along the fastest curve: Snell's law, with the bead's
 * speed in place of light's. On a cycloid of radius r it is 1/√(4g·r).
 */
export function snell(pts: readonly Pt[]): { x: number; value: number }[] {
	const out: { x: number; value: number }[] = [];
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		const len = Math.hypot(b.x - a.x, b.y - a.y);
		if (len === 0) continue;
		const sinPhi = (b.x - a.x) / len;
		const v = speedAt((a.y + b.y) / 2);
		if (v > 0) out.push({ x: (a.x + b.x) / 2, value: sinPhi / v });
	}
	return out;
}
