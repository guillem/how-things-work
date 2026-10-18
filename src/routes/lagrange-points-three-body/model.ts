/**
 * The circular restricted three-body problem (Szebehely, Theory of Orbits, 1967; Murray & Dermott,
 * Solar System Dynamics, ch. 3; MIT OCW 16.346, lecture 25).
 *
 * Two large bodies of masses 1 − μ and μ circle their common centre of mass; a third body, the
 * probe, is too light to pull on them. In the frame that turns with the two, in units where their
 * separation, the sum of their masses, G and their angular speed are all 1, the large body sits
 * at (−μ, 0), the small one at (1 − μ, 0), one turn of the frame takes 2π, and the probe obeys
 *
 *   ẍ − 2ẏ = ∂Ω/∂x,  ÿ + 2ẋ = ∂Ω/∂y,  Ω = (x² + y²)/2 + (1 − μ)/r₁ + μ/r₂ + μ(1 − μ)/2,
 *
 * with r₁, r₂ its distances to the two. −2ẏ, +2ẋ are the Coriolis terms; Ω holds the centrifugal
 * potential and the two gravities. The Jacobi constant C = 2Ω − (ẋ² + ẏ²) stays fixed along every
 * path; the constant μ(1 − μ)/2 makes C = 3 at L4 and L5 (Murray & Dermott's convention).
 *
 * Plain TypeScript with no imports: the Node tests import it.
 */

export type Vec = { x: number; y: number };
/** Position and velocity in the rotating frame. */
export type State = [x: number, y: number, vx: number, vy: number];

// ---------------------------------------------------------------- real systems

export interface System {
	id: string;
	/** Name of the pair, "Sun–Earth". */
	name: string;
	big: string;
	small: string;
	/** μ = m_small / (m_big + m_small). */
	mu: number;
	/** Separation of the two bodies, km. */
	a: number;
	/** Orbital period of the pair, days. */
	period: number;
	/** Radii of the two bodies, km (a probe that comes closer has hit them). */
	rBig: number;
	rSmall: number;
}

/*
 * Mass ratios from the GM values of JPL's planetary physical parameters and DE440 (km³/s²):
 * Sun 132,712,440,041.3; Earth + Moon 403,503.2; Jupiter system 126,712,764.1; Earth 398,600.44;
 * Moon 4,902.80; Pluto 869.6 and Charon 106.1 (Brozović et al. 2015). Separations and periods:
 * semi-major axes and sidereal periods (NASA planetary fact sheets).
 */
export const SYSTEMS: Record<string, System> = {
	'sun-jupiter': {
		id: 'sun-jupiter',
		name: 'Sun–Jupiter',
		big: 'Sun',
		small: 'Jupiter',
		mu: 126_712_764.1 / (132_712_440_041.3 + 126_712_764.1),
		a: 778.48e6,
		period: 4332.59,
		rBig: 695_700,
		rSmall: 71_492
	},
	'sun-earth': {
		id: 'sun-earth',
		name: 'Sun–Earth',
		big: 'Sun',
		small: 'Earth',
		mu: 403_503.2 / (132_712_440_041.3 + 403_503.2),
		a: 149.598e6,
		period: 365.256,
		rBig: 695_700,
		rSmall: 6371
	},
	'earth-moon': {
		id: 'earth-moon',
		name: 'Earth–Moon',
		big: 'Earth',
		small: 'Moon',
		mu: 4902.8 / (398_600.44 + 4902.8),
		a: 384_400,
		period: 27.3217,
		rBig: 6371,
		rSmall: 1737.4
	},
	'pluto-charon': {
		id: 'pluto-charon',
		name: 'Pluto–Charon',
		big: 'Pluto',
		small: 'Charon',
		mu: 106.1 / (869.6 + 106.1),
		a: 19_596,
		period: 6.3872,
		rBig: 1188.3,
		rSmall: 606
	}
};

/** Routh's critical mass ratio: L4 and L5 are linearly stable only for μ below it. */
export const ROUTH = (1 - Math.sqrt(23 / 27)) / 2;

// ---------------------------------------------------------------- the potential

/** Ω, the effective potential (centrifugal + both gravities, sign chosen so it is positive). */
export function omega(mu: number, x: number, y: number): number {
	const r1 = Math.hypot(x + mu, y);
	const r2 = Math.hypot(x - 1 + mu, y);
	return (x * x + y * y) / 2 + (1 - mu) / r1 + mu / r2 + (mu * (1 - mu)) / 2;
}

/** ∂Ω/∂x, ∂Ω/∂y. */
export function gradOmega(mu: number, x: number, y: number): Vec {
	const dx1 = x + mu;
	const dx2 = x - 1 + mu;
	const r1 = Math.hypot(dx1, y);
	const r2 = Math.hypot(dx2, y);
	const a = (1 - mu) / (r1 * r1 * r1);
	const b = mu / (r2 * r2 * r2);
	return { x: x - a * dx1 - b * dx2, y: y - a * y - b * y };
}

/** The Jacobi constant of a state: C = 2Ω − v². */
export function jacobi(mu: number, s: State): number {
	return 2 * omega(mu, s[0], s[1]) - (s[2] * s[2] + s[3] * s[3]);
}

/** Where a probe with Jacobi constant C may go: 2Ω ≥ C (v² cannot be negative). */
export function allowed(mu: number, C: number, x: number, y: number): boolean {
	return 2 * omega(mu, x, y) >= C;
}

// ---------------------------------------------------------------- the five points

export type PointId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
export const POINT_IDS: PointId[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

/** Zero of ∂Ω/∂x on the x axis between lo and hi (it changes sign once there), by bisection. */
function axisRoot(mu: number, lo: number, hi: number): number {
	const f = (x: number) => gradOmega(mu, x, 0).x;
	let flo = f(lo);
	for (let k = 0; k < 200; k++) {
		const mid = (lo + hi) / 2;
		const fm = f(mid);
		if (fm === 0) return mid;
		if (fm < 0 === flo < 0) {
			lo = mid;
			flo = fm;
		} else hi = mid;
		if (hi - lo < 1e-15) break;
	}
	return (lo + hi) / 2;
}

/**
 * The five equilibrium points of the rotating frame. L1 lies between the two bodies, L2 beyond
 * the small one, L3 beyond the large one; L4 leads the small body by 60°, L5 trails it.
 */
export function lagrangePoints(mu: number): Record<PointId, Vec> {
	const e = 1e-12;
	return {
		L1: { x: axisRoot(mu, -mu + e, 1 - mu - e), y: 0 },
		L2: { x: axisRoot(mu, 1 - mu + e, 2.5), y: 0 },
		L3: { x: axisRoot(mu, -2.5, -mu - e), y: 0 },
		L4: { x: 0.5 - mu, y: Math.sqrt(3) / 2 },
		L5: { x: 0.5 - mu, y: -Math.sqrt(3) / 2 }
	};
}

/** The Jacobi constant of a probe at rest at each point: C1 > C2 > C3 > C4 = C5 = 3. */
export function criticalC(mu: number): Record<PointId, number> {
	const L = lagrangePoints(mu);
	const c = (p: Vec) => 2 * omega(mu, p.x, p.y);
	return { L1: c(L.L1), L2: c(L.L2), L3: c(L.L3), L4: c(L.L4), L5: c(L.L5) };
}

/** Second derivatives of Ω (by central differences, accurate to ~1e-8 away from the bodies). */
function hessian(mu: number, p: Vec) {
	const h =
		1e-5 * Math.max(1e-3, Math.min(Math.hypot(p.x + mu, p.y), Math.hypot(p.x - 1 + mu, p.y)));
	const gx1 = gradOmega(mu, p.x + h, p.y);
	const gx0 = gradOmega(mu, p.x - h, p.y);
	const gy1 = gradOmega(mu, p.x, p.y + h);
	const gy0 = gradOmega(mu, p.x, p.y - h);
	return {
		xx: (gx1.x - gx0.x) / (2 * h),
		yy: (gy1.y - gy0.y) / (2 * h),
		xy: (gy1.x - gy0.x) / (2 * h)
	};
}

/**
 * Linear stability of an equilibrium: the largest real part of the eigenvalues of the motion
 * linearised about it (λ⁴ + (4 − Ωxx − Ωyy) λ² + Ωxx Ωyy − Ωxy² = 0), per unit time (one turn of
 * the frame is 2π). Zero (to rounding) means small displacements only oscillate.
 */
export function growthRate(mu: number, p: Vec): number {
	const H = hessian(mu, p);
	const b = 4 - H.xx - H.yy;
	const c = H.xx * H.yy - H.xy * H.xy;
	// roots s = λ² of s² + b s + c = 0, possibly complex
	const disc = b * b - 4 * c;
	const roots: { re: number; im: number }[] = [];
	if (disc >= 0) {
		const q = Math.sqrt(disc);
		roots.push({ re: (-b + q) / 2, im: 0 }, { re: (-b - q) / 2, im: 0 });
	} else {
		const q = Math.sqrt(-disc);
		roots.push({ re: -b / 2, im: q / 2 }, { re: -b / 2, im: -q / 2 });
	}
	// λ = ±√s; the largest real part of √s for complex s = re + i im
	let best = 0;
	for (const s of roots) {
		const m = Math.hypot(s.re, s.im);
		best = Math.max(best, Math.sqrt(Math.max(0, (m + s.re) / 2)));
	}
	return best;
}

// ---------------------------------------------------------------- integration

function deriv(mu: number, s: State): State {
	const g = gradOmega(mu, s[0], s[1]);
	return [s[2], s[3], g.x + 2 * s[3], g.y - 2 * s[2]];
}

/**
 * A step size that follows the fastest local motion: the Kepler time scale r^{3/2}/√m around
 * whichever body is nearer, capped at `hMax`.
 */
function stepSize(mu: number, s: State, k: number, hMax: number): number {
	const r1 = Math.hypot(s[0] + mu, s[1]);
	const r2 = Math.hypot(s[0] - 1 + mu, s[1]);
	const t1 = (r1 * Math.sqrt(r1)) / Math.sqrt(1 - mu);
	const t2 = (r2 * Math.sqrt(r2)) / Math.sqrt(mu);
	return Math.min(hMax, k * Math.min(t1, t2, 1));
}

function rk4(mu: number, s: State, h: number): State {
	const k1 = deriv(mu, s);
	const s2: State = [
		s[0] + (h / 2) * k1[0],
		s[1] + (h / 2) * k1[1],
		s[2] + (h / 2) * k1[2],
		s[3] + (h / 2) * k1[3]
	];
	const k2 = deriv(mu, s2);
	const s3: State = [
		s[0] + (h / 2) * k2[0],
		s[1] + (h / 2) * k2[1],
		s[2] + (h / 2) * k2[2],
		s[3] + (h / 2) * k2[3]
	];
	const k3 = deriv(mu, s3);
	const s4: State = [s[0] + h * k3[0], s[1] + h * k3[1], s[2] + h * k3[2], s[3] + h * k3[3]];
	const k4 = deriv(mu, s4);
	return [
		s[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
		s[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
		s[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
		s[3] + (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
	];
}

export interface Path {
	/** Output times (frame units; one turn of the frame is 2π). */
	t: Float64Array;
	/** Positions at those times, x and y interleaved. */
	xy: Float64Array;
	/** Number of samples filled (fewer than requested if the probe hit a body or left). */
	n: number;
	/** Why the run stopped early, if it did. */
	end: 'hit-big' | 'hit-small' | 'gone' | null;
	/** The state at the last sample. */
	last: State;
}

export interface RunOptions {
	/** Radii of the bodies in frame units (separation 1): a probe inside has crashed. */
	rBig?: number;
	rSmall?: number;
	/** Distance from the centre of mass beyond which the probe counts as gone. */
	far?: number;
	/** Accuracy knob: steps are this fraction of the local Kepler time (default 0.004). */
	k?: number;
}

/**
 * Integrates from `s0` to `tEnd`, sampling `samples` evenly spaced outputs (the first is `s0`).
 * Fourth-order Runge–Kutta with the step following the local time scale, landing exactly on each
 * output time.
 */
export function integrate(
	mu: number,
	s0: State,
	tEnd: number,
	samples: number,
	opts: RunOptions = {}
): Path {
	const { rBig = 0, rSmall = 0, far = 6, k = 0.004 } = opts;
	const t = new Float64Array(samples);
	const xy = new Float64Array(2 * samples);
	let s: State = [...s0];
	t[0] = 0;
	xy[0] = s[0];
	xy[1] = s[1];
	const dtOut = tEnd / (samples - 1);
	let now = 0;
	let end: Path['end'] = null;
	let n = 1;
	for (let i = 1; i < samples && !end; i++) {
		const target = i * dtOut;
		while (now < target - 1e-14) {
			const h = Math.min(stepSize(mu, s, k, dtOut), target - now);
			s = rk4(mu, s, h);
			now += h;
			const r1 = Math.hypot(s[0] + mu, s[1]);
			const r2 = Math.hypot(s[0] - 1 + mu, s[1]);
			if (r1 < rBig) end = 'hit-big';
			else if (r2 < rSmall) end = 'hit-small';
			else if (Math.hypot(s[0], s[1]) > far) end = 'gone';
			if (end) break;
		}
		t[i] = now;
		xy[2 * i] = s[0];
		xy[2 * i + 1] = s[1];
		n = i + 1;
	}
	return { t, xy, n, end, last: s };
}

// ---------------------------------------------------------------- probes

/** A probe at rest in the rotating frame at a point, displaced by (dx, dy). */
export function restingAt(p: Vec, dx = 0, dy = 0): State {
	return [p.x + dx, p.y + dy, 0, 0];
}

/**
 * A probe at rest in the rotating frame on the small body's orbit (radius 1 − μ about the centre
 * of mass… to first order the unit circle about the large body), `deg` degrees ahead of the small
 * body: 60 is L4. Used for the tadpoles and horseshoes.
 */
export function onOrbit(mu: number, deg: number): State {
	const a = (deg * Math.PI) / 180;
	return [-mu + Math.cos(a), Math.sin(a), 0, 0];
}

/** Largest distance of a path from a point, over its filled samples. */
export function maxDistance(path: Path, p: Vec, from = 0): number {
	let m = 0;
	for (let i = from; i < path.n; i++)
		m = Math.max(m, Math.hypot(path.xy[2 * i] - p.x, path.xy[2 * i + 1] - p.y));
	return m;
}

/** Distance between two paths at each common sample. */
export function separation(a: Path, b: Path): Float64Array {
	const n = Math.min(a.n, b.n);
	const d = new Float64Array(n);
	for (let i = 0; i < n; i++)
		d[i] = Math.hypot(a.xy[2 * i] - b.xy[2 * i], a.xy[2 * i + 1] - b.xy[2 * i + 1]);
	return d;
}

/** Angle (degrees) of a point seen from the large body, measured from the small body's direction. */
export function angleFromBig(mu: number, x: number, y: number): number {
	return (Math.atan2(y, x + mu) * 180) / Math.PI;
}

// ---------------------------------------------------------------- the balance at L1 and L2

/**
 * Accelerations at a point on the line through the two bodies, seen from the non-rotating frame
 * (frame units; multiply by `accelUnit` for m/s²): the large body's pull and the small body's, as
 * signed x components (positive away from the large body), and what a circular orbit about the
 * centre of mass at that distance needs, ω² × (distance from the centre of mass), pointing in.
 */
export function pullsOnAxis(mu: number, x: number) {
	const d1 = x + mu;
	const d2 = x - 1 + mu;
	return {
		big: (-(1 - mu) * Math.sign(d1)) / (d1 * d1),
		small: (-mu * Math.sign(d2)) / (d2 * d2),
		needed: -x
	};
}

/** The frame's unit of acceleration for a system, m/s²: separation × angular speed². */
export function accelUnit(s: System): number {
	const w = (2 * Math.PI) / (s.period * 86400);
	return s.a * 1000 * w * w;
}

/** Days per frame time unit (one turn, 2π, is one orbital period). */
export const daysPerUnit = (s: System) => s.period / (2 * Math.PI);

/**
 * The point on the axis between the two bodies where their pulls are equal and opposite (where
 * "gravity cancels"): distance from the small body, frame units.
 */
export function equalPullFromSmall(mu: number): number {
	// (1 − μ)/(1 − d)² = μ/d²  ⇒  d = √μ / (√μ + √(1 − μ))
	return Math.sqrt(mu) / (Math.sqrt(mu) + Math.sqrt(1 - mu));
}
