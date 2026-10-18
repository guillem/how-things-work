/**
 * The mathematics behind the phase-portraits explainer: flows in the plane
 * x′ = f(x, y), y′ = g(x, y).
 *
 * - Orbits traced with the classical fourth-order Runge–Kutta method (RK4)
 *   in small fixed steps, forwards and backwards from a start.
 * - Linear systems v′ = A·v: eigenvalues, the classification read off the
 *   trace and determinant, and the matrix rebuilt from two eigenvalues.
 * - Nonlinear systems (the damped pendulum, Lotka–Volterra predator and
 *   prey, van der Pol's oscillator, the Hopf normal form and its mirror
 *   image): their fixed points found numerically by Newton's method from a
 *   grid of seeds, and the Jacobian matrix (the linearisation) at each.
 *
 * All parameters are dimensionless round numbers; no data.
 */

export type Vec = [number, number];
export type Field = (x: number, y: number) => Vec;
/** A 2 × 2 matrix [[a, b], [c, d]] as [a, b, c, d]. */
export type Mat = [number, number, number, number];

export interface Box {
	x: [number, number];
	y: [number, number];
}

// ---------------------------------------------------------------------------- integration

/** One RK4 step of length h (negative to go backwards in time). */
export function rk4(f: Field, x: number, y: number, h: number): Vec {
	const [k1x, k1y] = f(x, y);
	const [k2x, k2y] = f(x + (h / 2) * k1x, y + (h / 2) * k1y);
	const [k3x, k3y] = f(x + (h / 2) * k2x, y + (h / 2) * k2y);
	const [k4x, k4y] = f(x + h * k3x, y + h * k3y);
	return [
		x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
		y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y)
	];
}

/** Integrate from (x₀, y₀) for a time T (negative: backwards) in n RK4 steps; the end point. */
export function flow(
	f: Field,
	x0: number,
	y0: number,
	T: number,
	n = Math.ceil(Math.abs(T) / 0.005)
): Vec {
	let p: Vec = [x0, y0];
	const h = T / n;
	for (let i = 0; i < n; i++) p = rk4(f, p[0], p[1], h);
	return p;
}

export interface Orbit {
	/** Times (from the start, increasing) and positions of the kept points. */
	t: number[];
	x: number[];
	y: number[];
	/** Index of the start in the arrays. */
	start: number;
}

export interface OrbitOptions {
	/** The window: a trace stops when it leaves it by more than a fifth of its size. */
	box: Box;
	/** How long to follow the orbit each way. */
	tMax: number;
	/** RK4 step. */
	h?: number;
	/** Follow it backwards too (default true). */
	back?: boolean;
	/** Keep a point when it has moved this far (as a fraction of the window) since the last. */
	gap?: number;
}

/**
 * The orbit through (x₀, y₀), followed forwards (and backwards) in time in
 * RK4 steps of h. It stops when it leaves the window by a margin, or when it
 * has all but stopped (it has reached a fixed point, for drawing purposes).
 */
export function orbit(f: Field, x0: number, y0: number, o: OrbitOptions): Orbit {
	const h = o.h ?? 0.01;
	const wx = o.box.x[1] - o.box.x[0];
	const wy = o.box.y[1] - o.box.y[0];
	const mx = wx / 5;
	const my = wy / 5;
	const gap = o.gap ?? 1 / 250;
	const run = (dir: 1 | -1) => {
		const ts: number[] = [];
		const xs: number[] = [];
		const ys: number[] = [];
		let x = x0;
		let y = y0;
		let lx = x0;
		let ly = y0;
		const n = Math.ceil(o.tMax / h);
		for (let i = 1; i <= n; i++) {
			const [nx, ny] = rk4(f, x, y, dir * h);
			if (!Number.isFinite(nx) || !Number.isFinite(ny)) break;
			x = nx;
			y = ny;
			const out =
				x < o.box.x[0] - mx || x > o.box.x[1] + mx || y < o.box.y[0] - my || y > o.box.y[1] + my;
			const moved = Math.hypot((x - lx) / wx, (y - ly) / wy);
			if (moved >= gap || out || i === n) {
				ts.push(dir * i * h);
				xs.push(x);
				ys.push(y);
				lx = x;
				ly = y;
			}
			if (out) break;
			const [vx, vy] = f(x, y);
			if (Math.hypot(vx / wx, vy / wy) < 1e-5) break;
		}
		return { ts, xs, ys };
	};
	const fwd = run(1);
	const back = o.back === false ? { ts: [], xs: [], ys: [] } : run(-1);
	return {
		t: [...back.ts.reverse(), 0, ...fwd.ts],
		x: [...back.xs.reverse(), x0, ...fwd.xs],
		y: [...back.ys.reverse(), y0, ...fwd.ys],
		start: back.ts.length
	};
}

/** Where an orbit is at time τ after its start (linear between kept points); null outside it. */
export function at(o: Orbit, tau: number): Vec | null {
	const { t } = o;
	if (tau < t[0] || tau > t[t.length - 1]) return null;
	let a = 0;
	let b = t.length - 1;
	while (b - a > 1) {
		const m = (a + b) >> 1;
		if (t[m] <= tau) a = m;
		else b = m;
	}
	const u = t[b] === t[a] ? 0 : (tau - t[a]) / (t[b] - t[a]);
	return [o.x[a] + u * (o.x[b] - o.x[a]), o.y[a] + u * (o.y[b] - o.y[a])];
}

// ---------------------------------------------------------------------------- linear systems

export const linearField =
	([a, b, c, d]: Mat): Field =>
	(x, y) => [a * x + b * y, c * x + d * y];

export const trace = (m: Mat) => m[0] + m[3];
export const det = (m: Mat) => m[0] * m[3] - m[1] * m[2];

/** λ₁ and λ₂ as real and imaginary parts; for a complex pair, λ₁ has the positive imaginary part. */
export interface Eigen {
	re: [number, number];
	im: [number, number];
}

/** The roots of λ² − τλ + Δ = 0 (λ₁ ≥ λ₂ when real). */
export function eigenvalues(m: Mat): Eigen {
	const tr = trace(m);
	const dt = det(m);
	const disc = tr * tr - 4 * dt;
	if (disc >= 0) {
		const s = Math.sqrt(disc);
		// The larger root without cancellation, the other from λ₁λ₂ = Δ.
		const big = tr >= 0 ? (tr + s) / 2 : (tr - s) / 2;
		const other = big === 0 ? 0 : dt / big;
		const [l1, l2] = big >= other ? [big, other] : [other, big];
		return { re: [l1, l2], im: [0, 0] };
	}
	const w = Math.sqrt(-disc) / 2;
	return { re: [tr / 2, tr / 2], im: [w, -w] };
}

/** A real eigenvector (unit length) for the real eigenvalue λ, or null if the matrix is λ·I. */
export function eigenvector(m: Mat, l: number): Vec | null {
	const [a, b, c, d] = m;
	// Rows of A − λI are [a − λ, b] and [c, d − λ]; a vector orthogonal to the larger row.
	const r1: Vec = [b, l - a];
	const r2: Vec = [l - d, c];
	const v = Math.hypot(...r1) >= Math.hypot(...r2) ? r1 : r2;
	const n = Math.hypot(...v);
	if (n < 1e-12) return null;
	return [v[0] / n, v[1] / n];
}

export type Kind =
	| 'saddle'
	| 'stable node'
	| 'unstable node'
	| 'stable degenerate node'
	| 'unstable degenerate node'
	| 'stable spiral'
	| 'unstable spiral'
	| 'centre'
	| 'non-isolated';

export interface Classified {
	kind: Kind;
	/** No eigenvalue on the imaginary axis: the linearisation decides the local picture. */
	hyperbolic: boolean;
}

/**
 * The type of the fixed point of v′ = A·v from τ = trace and Δ = det:
 * Δ < 0 saddle; Δ = 0 a line of fixed points (or the whole plane); Δ > 0
 * a node when τ² ≥ 4Δ, a spiral when τ² < 4Δ, stable when τ < 0, and a
 * centre when τ = 0. `tol` absorbs the rounding of slider values.
 */
export function classify(tr: number, dt: number, tol = 1e-9): Classified {
	const z = (v: number) => Math.abs(v) <= tol;
	if (z(dt)) return { kind: 'non-isolated', hyperbolic: false };
	if (dt < 0) return { kind: 'saddle', hyperbolic: true };
	if (z(tr)) return { kind: 'centre', hyperbolic: false };
	const s = tr < 0 ? 'stable' : 'unstable';
	const disc = tr * tr - 4 * dt;
	if (z(disc)) return { kind: `${s} degenerate node`, hyperbolic: true };
	return { kind: disc > 0 ? `${s} node` : `${s} spiral`, hyperbolic: true };
}

/** The eigenvectors used when a matrix is rebuilt from two real eigenvalues. */
export const V1: Vec = [1, 0.25];
export const V2: Vec = [-0.4, 1];

/**
 * A matrix with the given eigenvalues: for a complex pair α ± iω the rotation
 * and stretch [[α, −ω], [ω, α]]; for real λ₁, λ₂ the matrix P·diag(λ₁, λ₂)·P⁻¹
 * whose eigenvectors are the columns V1, V2 of P. Both give α·I when the pair
 * meets on the real axis, so the matrix changes continuously as the
 * eigenvalues are dragged off or onto it.
 */
export function fromEigenvalues(l1: number, l2: number, w: number): Mat {
	if (w > 0) return [l1, -w, w, l1];
	const [p, r] = V1;
	const [q, s] = V2;
	const dP = p * s - q * r;
	// P D P⁻¹ with P = [[p, q], [r, s]], P⁻¹ = [[s, −q], [−r, p]] / det P.
	return [
		(p * l1 * s - q * l2 * r) / dP,
		(-p * l1 * q + q * l2 * p) / dP,
		(r * l1 * s - s * l2 * r) / dP,
		(-r * l1 * q + s * l2 * p) / dP
	];
}

// ---------------------------------------------------------------------------- nonlinear systems

export type SystemId = 'pendulum' | 'predator' | 'vanderpol' | 'hopf' | 'subcritical';

export interface SystemParams {
	/** Friction of the pendulum. */
	gamma: number;
	/** van der Pol's μ, or the Hopf normal form's μ. */
	mu: number;
}

export interface System {
	id: SystemId;
	box: Box;
	field: (p: SystemParams) => Field;
	/** The Jacobian matrix [[∂f/∂x, ∂f/∂y], [∂g/∂x, ∂g/∂y]] at a point. */
	jacobian: (p: SystemParams, x: number, y: number) => Mat;
}

/** Lotka–Volterra: prey x grow at rate α, are eaten at βxy; predators y grow at δxy, die at γ. */
export const LV = { alpha: 1, beta: 0.5, gamma: 0.75, delta: 0.25 };

export const systems: Record<SystemId, System> = {
	/** θ′ = ω, ω′ = −sin θ − γω (time in units of √(L/g)). */
	pendulum: {
		id: 'pendulum',
		box: { x: [-7, 7], y: [-3.5, 3.5] },
		field: (p) => (x, y) => [y, -Math.sin(x) - p.gamma * y],
		jacobian: (p, x) => [0, 1, -Math.cos(x), -p.gamma]
	},
	/** x′ = x(α − βy), y′ = y(δx − γ). */
	predator: {
		id: 'predator',
		box: { x: [0, 10], y: [0, 7] },
		field: () => (x, y) => [x * (LV.alpha - LV.beta * y), y * (LV.delta * x - LV.gamma)],
		jacobian: (_p, x, y) => [
			LV.alpha - LV.beta * y,
			-LV.beta * x,
			LV.delta * y,
			LV.delta * x - LV.gamma
		]
	},
	/** x′ = y, y′ = μ(1 − x²)y − x. */
	vanderpol: {
		id: 'vanderpol',
		box: { x: [-3.5, 3.5], y: [-5, 5] },
		field: (p) => (x, y) => [y, p.mu * (1 - x * x) * y - x],
		jacobian: (p, x, y) => [0, 1, -2 * p.mu * x * y - 1, p.mu * (1 - x * x)]
	},
	/** The supercritical Hopf normal form: r′ = μr − r³, φ′ = 1. */
	hopf: {
		id: 'hopf',
		box: { x: [-1.5, 1.5], y: [-1.5, 1.5] },
		field: (p) => (x, y) => {
			const r2 = x * x + y * y;
			return [p.mu * x - y - x * r2, x + p.mu * y - y * r2];
		},
		jacobian: (p, x, y) => [
			p.mu - 3 * x * x - y * y,
			-1 - 2 * x * y,
			1 - 2 * x * y,
			p.mu - x * x - 3 * y * y
		]
	},
	/** Its mirror image, r′ = μr + r³: the same linearisation, the cubic term pushing out. */
	subcritical: {
		id: 'subcritical',
		box: { x: [-1.5, 1.5], y: [-1.5, 1.5] },
		field: (p) => (x, y) => {
			const r2 = x * x + y * y;
			return [p.mu * x - y + x * r2, x + p.mu * y + y * r2];
		},
		jacobian: (p, x, y) => [
			p.mu + 3 * x * x + y * y,
			-1 + 2 * x * y,
			1 + 2 * x * y,
			p.mu + x * x + 3 * y * y
		]
	}
};

/** The pendulum's energy per unit mass (in units of gL): ω²/2 − cos θ. */
export const pendulumEnergy = (theta: number, omega: number) =>
	(omega * omega) / 2 - Math.cos(theta);

/** Conserved by Lotka–Volterra orbits: δx − γ ln x + βy − α ln y. */
export const lvInvariant = (x: number, y: number) =>
	LV.delta * x - LV.gamma * Math.log(x) + LV.beta * y - LV.alpha * Math.log(y);

export interface FixedPoint {
	x: number;
	y: number;
	jacobian: Mat;
	eigen: Eigen;
	kind: Kind;
	hyperbolic: boolean;
}

/**
 * The fixed points inside the window: Newton's method on (f, g) = 0 from a
 * grid of seeds, kept when it converges inside the window, duplicates
 * merged, sorted by x then y.
 */
export function fixedPoints(sys: System, p: SystemParams, seeds = 14): FixedPoint[] {
	const f = sys.field(p);
	const { box } = sys;
	const wx = box.x[1] - box.x[0];
	const wy = box.y[1] - box.y[0];
	const found: Vec[] = [];
	for (let i = 0; i <= seeds; i++)
		for (let j = 0; j <= seeds; j++) {
			let x = box.x[0] + (wx * i) / seeds;
			let y = box.y[0] + (wy * j) / seeds;
			let ok = false;
			for (let k = 0; k < 60; k++) {
				const [u, v] = f(x, y);
				const [a, b, c, d] = sys.jacobian(p, x, y);
				const D = a * d - b * c;
				if (Math.abs(D) < 1e-14) break;
				const dx = (d * u - b * v) / D;
				const dy = (-c * u + a * v) / D;
				x -= dx;
				y -= dy;
				if (!Number.isFinite(x) || !Number.isFinite(y)) break;
				if (Math.hypot(dx / wx, dy / wy) < 1e-13) {
					ok = true;
					break;
				}
			}
			if (!ok) continue;
			const [u, v] = f(x, y);
			if (Math.hypot(u, v) > 1e-9) continue;
			const eps = 1e-9;
			if (x < box.x[0] - eps || x > box.x[1] + eps || y < box.y[0] - eps || y > box.y[1] + eps)
				continue;
			if (found.some(([fx, fy]) => Math.hypot((fx - x) / wx, (fy - y) / wy) < 1e-6)) continue;
			found.push([Math.abs(x) < 1e-12 ? 0 : x, Math.abs(y) < 1e-12 ? 0 : y]);
		}
	found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	return found.map(([x, y]) => {
		const J = sys.jacobian(p, x, y);
		const c = classify(trace(J), det(J));
		return { x, y, jacobian: J, eigen: eigenvalues(J), ...c };
	});
}

/**
 * The size of the cycle an orbit settles on: follow it for `settle` time
 * units, then return the largest `size` (by default the distance from the
 * origin) over the next `measure` units. For a system without a cycle it is how far the orbit
 * still is from the fixed point.
 */
export function settledAmplitude(
	f: Field,
	start: Vec,
	settle: number,
	measure: number,
	h = 0.01,
	size: (x: number, y: number) => number = Math.hypot
): number {
	let [x, y] = flow(f, start[0], start[1], settle, Math.ceil(settle / h));
	let r = 0;
	const n = Math.ceil(measure / h);
	for (let i = 0; i < n; i++) {
		[x, y] = rk4(f, x, y, h);
		r = Math.max(r, size(x, y));
	}
	return r;
}

/**
 * The period of a closed orbit (or of the cycle an orbit has settled on):
 * after `settle`, the mean time between successive upward crossings of
 * y = cy, over `cycles` turns, interpolating each crossing.
 */
export function period(
	f: Field,
	start: Vec,
	settle: number,
	cycles = 3,
	h = 0.002,
	cy = 0
): number {
	let [x, y] = flow(f, start[0], start[1], settle, Math.max(1, Math.ceil(settle / h)));
	let t = 0;
	const crossings: number[] = [];
	for (let i = 0; i < 2e7 && crossings.length <= cycles; i++) {
		const [nx, ny] = rk4(f, x, y, h);
		// Upward through y = cy: once a turn for an orbit around a point on that line.
		if (y < cy && ny >= cy) crossings.push(t + (h * (cy - y)) / (ny - y));
		x = nx;
		y = ny;
		t += h;
	}
	return (crossings[crossings.length - 1] - crossings[0]) / (crossings.length - 1);
}
