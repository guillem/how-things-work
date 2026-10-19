/**
 * The Kalman filter (Kalman 1960), in its discrete linear form:
 *
 *   predict  x⁻ = F x + B u        P⁻ = F P Fᵀ + Q
 *   update   ν = z − H x⁻          S = H P⁻ Hᵀ + R
 *            K = P⁻ Hᵀ S⁻¹         x = x⁻ + K ν       P = (I − K H) P⁻
 *
 * on plain number arrays (the matrices here are at most 4 × 4), with the systems the page
 * draws: a scalar random walk measured by a noisy sensor; and an object moving in a plane,
 * state [x, y, vx, vy] in metres and metres per second, under the discrete white-noise
 * acceleration model (an acceleration held constant over each step, drawn afresh at random each
 * step), seen by a GPS fix of its position and, optionally, an accelerometer used as the
 * prediction's input (dead reckoning, corrected by GPS). All randomness comes from seeded
 * streams, so every run replays exactly; the data are simulated, never recorded.
 */
import { rng } from '#lib/draw/math.ts';

export type Vec = number[];
export type Mat = number[][];

// ------------------------------------------------------------------ small linear algebra

export const eye = (n: number): Mat =>
	Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((row) => row[j]));

export function mul(A: Mat, B: Mat): Mat {
	return A.map((row) => B[0].map((_, j) => row.reduce((s, a, k) => s + a * B[k][j], 0)));
}

export const mulVec = (A: Mat, v: Vec): Vec =>
	A.map((row) => row.reduce((s, a, k) => s + a * v[k], 0));

export const add = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a + B[i][j]));

export const scaleMat = (A: Mat, s: number): Mat => A.map((row) => row.map((a) => a * s));

/** Inverse of a small square matrix by Gauss–Jordan elimination with partial pivoting. */
export function inv(A: Mat): Mat {
	const n = A.length;
	const M = A.map((row, i) => [...row, ...eye(n)[i]]);
	for (let c = 0; c < n; c++) {
		let p = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
		[M[c], M[p]] = [M[p], M[c]];
		const d = M[c][c];
		for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = M[r][c];
			if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
		}
	}
	return M.map((row) => row.slice(n));
}

/** xᵀ A⁻¹ x: the squared Mahalanobis distance of x under covariance A. */
export function mahalanobis2(x: Vec, A: Mat): number {
	const Ai = inv(A);
	return x.reduce((s, xi, i) => s + xi * Ai[i].reduce((t, a, j) => t + a * x[j], 0), 0);
}

// ------------------------------------------------------------------ the filter

/** A Gaussian belief: mean x, covariance P. */
export interface Belief {
	x: Vec;
	P: Mat;
}

export function predict(b: Belief, F: Mat, Q: Mat, Bu?: Vec): Belief {
	const x = mulVec(F, b.x);
	if (Bu) for (let i = 0; i < x.length; i++) x[i] += Bu[i];
	return { x, P: add(mul(mul(F, b.P), transpose(F)), Q) };
}

export interface Correction {
	post: Belief;
	/** The gain K. */
	K: Mat;
	/** The innovation ν = z − H x⁻, and its predicted covariance S. */
	innov: Vec;
	S: Mat;
}

export function update(prior: Belief, z: Vec, H: Mat, R: Mat): Correction {
	const Ht = transpose(H);
	const S = add(mul(mul(H, prior.P), Ht), R);
	const K = mul(mul(prior.P, Ht), inv(S));
	const hx = mulVec(H, prior.x);
	const innov = z.map((zi, i) => zi - hx[i]);
	const x = prior.x.map((xi, i) => xi + K[i].reduce((s, k, j) => s + k * innov[j], 0));
	const IKH = add(eye(prior.x.length), scaleMat(mul(K, H), -1));
	// Joseph form, (I − KH) P⁻ (I − KH)ᵀ + K R Kᵀ: the same covariance, kept symmetric.
	const P = add(mul(mul(IKH, prior.P), transpose(IKH)), mul(mul(K, R), transpose(K)));
	return { post: { x, P }, K, innov, S };
}

// ------------------------------------------------------------------ random numbers

/** A seeded stream of standard normal numbers (Box–Muller). */
export function normals(seed: number): () => number {
	const r = rng(seed);
	let spare: number | null = null;
	return () => {
		if (spare !== null) {
			const s = spare;
			spare = null;
			return s;
		}
		const u = 1 - r();
		const v = r();
		const m = Math.sqrt(-2 * Math.log(u));
		spare = m * Math.sin(2 * Math.PI * v);
		return m * Math.cos(2 * Math.PI * v);
	};
}

export function draws(n: number, seed: number): number[] {
	const g = normals(seed);
	return Array.from({ length: n }, () => g());
}

// ------------------------------------------------------------------ one number

/**
 * Two Gaussian guesses of one number, a prediction (mean mp, variance vp) and a measurement
 * (z, variance vr), combined by Bayes' rule: their product, normalised.
 */
export function blend(mp: number, vp: number, z: number, vr: number) {
	const K = vp / (vp + vr);
	return { mean: mp + K * (z - mp), variance: (1 - K) * vp, K };
}

/**
 * A scalar random walk, x_k = x_{k−1} + w_k with w ~ N(0, q²), measured as z_k = x_k + v_k with
 * v ~ N(0, r²). The noise streams are fixed by the seed, so changing q or r only rescales them.
 */
export function randomWalk(n: number, q: number, r: number, seed = 7, x0 = 0) {
	const w = draws(n, seed);
	const v = draws(n, seed + 1000);
	const truth: number[] = [];
	let x = x0;
	for (let k = 0; k < n; k++) {
		if (k > 0) x += q * w[k];
		truth.push(x);
	}
	return { truth, z: truth.map((x, k) => x + r * v[k]) };
}

export interface ScalarStep {
	prior: number;
	priorVar: number;
	est: number;
	variance: number;
	K: number;
	innov: number;
	S: number;
}

/**
 * The Kalman filter for the scalar random walk (F = H = 1, Q = q², R = r²). The default prior is
 * diffuse (variance 10¹²), so the first estimate is the first measurement.
 */
export function scalarFilter(z: readonly number[], q: number, r: number, x0 = 0, p0 = 1e12) {
	const out: ScalarStep[] = [];
	let b: Belief = { x: [x0], P: [[p0]] };
	z.forEach((zk, k) => {
		const prior = k === 0 ? b : predict(b, [[1]], [[q * q]]);
		const c = update(prior, [zk], [[1]], [[r * r]]);
		out.push({
			prior: prior.x[0],
			priorVar: prior.P[0][0],
			est: c.post.x[0],
			variance: c.post.P[0][0],
			K: c.K[0][0],
			innov: c.innov[0],
			S: c.S[0][0]
		});
		b = c.post;
	});
	return out;
}

/**
 * The gain the scalar filter settles to, from the fixed point of its Riccati recursion
 * P⁻ = P⁻R/(P⁻ + R) + Q: P⁻ = (Q + √(Q² + 4QR))/2, K = P⁻/(P⁻ + R).
 */
export function steadyGain(q: number, r: number) {
	const Q = q * q;
	const R = r * r;
	const Pm = (Q + Math.sqrt(Q * Q + 4 * Q * R)) / 2;
	return { K: Pm / (Pm + R), variance: (Pm * R) / (Pm + R) };
}

/** The mean of every measurement so far. */
export function runningMean(z: readonly number[]): number[] {
	let s = 0;
	return z.map((zk, k) => (s += zk) / (k + 1));
}

/** The mean of the last w measurements (fewer at the start). */
export function movingAverage(z: readonly number[], w: number): number[] {
	return z.map((_, k) => {
		const from = Math.max(0, k - w + 1);
		let s = 0;
		for (let i = from; i <= k; i++) s += z[i];
		return s / (k - from + 1);
	});
}

export function rms(errors: readonly number[]): number {
	return Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
}

/** Sample autocorrelation of a sequence at lags 1 … maxLag. */
export function autocorrelation(x: readonly number[], maxLag: number): number[] {
	const n = x.length;
	const m = x.reduce((s, v) => s + v, 0) / n;
	const c0 = x.reduce((s, v) => s + (v - m) ** 2, 0);
	return Array.from({ length: maxLag }, (_, i) => {
		const lag = i + 1;
		let c = 0;
		for (let k = lag; k < n; k++) c += (x[k] - m) * (x[k - lag] - m);
		return c / c0;
	});
}

// ------------------------------------------------------------------ tracking in a plane

/** State [x, y, vx, vy]: the constant-velocity transition over dt, and how a held acceleration
 * [ax, ay] enters it (G: ½dt² on position, dt on velocity). */
export function motion(dt: number) {
	const F: Mat = [
		[1, 0, dt, 0],
		[0, 1, 0, dt],
		[0, 0, 1, 0],
		[0, 0, 0, 1]
	];
	const h = (dt * dt) / 2;
	const G: Mat = [
		[h, 0],
		[0, h],
		[dt, 0],
		[0, dt]
	];
	return { F, G };
}

/** The process noise of an acceleration of standard deviation sigma per axis: G Gᵀ σ². */
export const processNoise = (dt: number, sigma: number): Mat => {
	const { G } = motion(dt);
	return scaleMat(mul(G, transpose(G)), sigma * sigma);
};

/** GPS measures the position. */
export const H_GPS: Mat = [
	[1, 0, 0, 0],
	[0, 1, 0, 0]
];

export interface Truth {
	dt: number;
	/** State at each step k = 0 … n − 1. */
	states: Vec[];
	/** Acceleration held over step k → k + 1 (the last one unused). */
	accel: Vec[];
}

/**
 * A path drawn from the filter's own motion model: each step's acceleration is N(0, σ²) per
 * axis, held for the step.
 */
export function wander(
	n: number,
	sigma: number,
	seed: number,
	dt = 1,
	start: Vec = [0, 0, 6, 1.5]
): Truth {
	const g = normals(seed);
	const { F, G } = motion(dt);
	const states: Vec[] = [start.slice()];
	const accel: Vec[] = [];
	for (let k = 0; k < n; k++) {
		const a = [sigma * g(), sigma * g()];
		accel.push(a);
		if (k < n - 1) {
			const s = mulVec(F, states[k]);
			const ga = mulVec(G, a);
			states.push(s.map((v, i) => v + ga[i]));
		}
	}
	return { dt, states, accel };
}

/**
 * Straight at 8 m/s, then a quarter turn to the left over a few seconds (about 2 m/s² sideways,
 * a brisk car round a corner), then straight again. Deterministic.
 */
export const SWERVE = { n: 50, straight: 20, turn: 6, speed: 8 };
export function swerve(dt = 1): Truth {
	const { n, straight, turn, speed } = SWERVE;
	const omega = Math.PI / 2 / (turn / dt); // radians per step
	const states: Vec[] = [];
	const accel: Vec[] = [];
	let x = 0;
	let y = 0;
	let heading = 0;
	for (let k = 0; k < n; k++) {
		states.push([x, y, speed * Math.cos(heading), speed * Math.sin(heading)]);
		const turning = k >= straight && k < straight + turn / dt;
		// exact arc over the step for the turning part, a straight segment otherwise
		if (turning) {
			const h2 = heading + omega;
			const rad = (speed * dt) / omega;
			x += rad * (Math.sin(h2) - Math.sin(heading));
			y -= rad * (Math.cos(h2) - Math.cos(heading));
			heading = h2;
		} else {
			x += speed * dt * Math.cos(heading);
			y += speed * dt * Math.sin(heading);
		}
		const v1 = [speed * Math.cos(heading), speed * Math.sin(heading)];
		accel.push([(v1[0] - states[k][2]) / dt, (v1[1] - states[k][3]) / dt]);
	}
	return { dt, states, accel };
}

/** A GPS fix (position plus N(0, σ²) per axis) every `every` steps, null in between. */
export function gpsFixes(truth: Truth, sigma: number, seed: number, every = 1): (Vec | null)[] {
	const g = normals(seed);
	return truth.states.map((s, k) => {
		const e = [g(), g()];
		return k % every === 0 ? [s[0] + sigma * e[0], s[1] + sigma * e[1]] : null;
	});
}

/** Accelerometer readings: the true acceleration plus N(0, σ²) per axis. */
export function accelerometer(truth: Truth, sigma: number, seed: number): Vec[] {
	const g = normals(seed);
	return truth.accel.map((a) => [a[0] + sigma * g(), a[1] + sigma * g()]);
}

export interface TrackStep {
	prior: Belief;
	post: Belief;
	/** The fix used at this step, or null when none arrived. */
	z: Vec | null;
	K: Mat | null;
	innov: Vec | null;
	S: Mat | null;
}

export interface TrackOptions {
	/** The acceleration the filter allows for, standard deviation per axis (m/s²). */
	q: number;
	/** The GPS fixes' standard deviation per axis (m). */
	r: number;
	/** Accelerometer readings used as the prediction's input; then q is the accelerometer's
	 * noise. */
	accel?: Vec[];
	/** Starting belief; by default the true start with a small spread. */
	start?: Belief;
}

export const START_P: Mat = [
	[4, 0, 0, 0],
	[0, 4, 0, 0],
	[0, 0, 1, 0],
	[0, 0, 0, 1]
];

/**
 * Runs the filter along a truth's GPS fixes. Step 0 is the starting belief corrected by the
 * first fix; each later step predicts over dt (with the accelerometer's reading if given) and
 * corrects with that step's fix, if any.
 */
export function track(truth: Truth, fixes: (Vec | null)[], o: TrackOptions): TrackStep[] {
	const { F, G } = motion(truth.dt);
	const Q = processNoise(truth.dt, o.q);
	const R: Mat = [
		[o.r * o.r, 0],
		[0, o.r * o.r]
	];
	let b: Belief = o.start ?? { x: truth.states[0].slice(), P: START_P };
	const out: TrackStep[] = [];
	fixes.forEach((z, k) => {
		const prior = k === 0 ? b : predict(b, F, Q, o.accel ? mulVec(G, o.accel[k - 1]) : undefined);
		if (z) {
			const c = update(prior, z, H_GPS, R);
			out.push({ prior, post: c.post, z, K: c.K, innov: c.innov, S: c.S });
			b = c.post;
		} else {
			out.push({ prior, post: prior, z: null, K: null, innov: null, S: null });
			b = prior;
		}
	});
	return out;
}

/** The distance from the truth to the estimate at each step (m). */
export const positionErrors = (truth: Truth, steps: readonly TrackStep[]) =>
	steps.map((s, k) =>
		Math.hypot(s.post.x[0] - truth.states[k][0], s.post.x[1] - truth.states[k][1])
	);

/** The distance from the truth to each fix (m). */
export const fixErrors = (truth: Truth, fixes: readonly (Vec | null)[]) =>
	fixes.flatMap((z, k) =>
		z ? [Math.hypot(z[0] - truth.states[k][0], z[1] - truth.states[k][1])] : []
	);

/** The position block of a covariance. */
export const positionCov = (P: Mat): Mat => [
	[P[0][0], P[0][1]],
	[P[1][0], P[1][1]]
];

/** χ² with 2 degrees of freedom at 95 %: a 2-D Gaussian's 95 % ellipse is d² ≤ 5.991. */
export const CHI2_95 = -2 * Math.log(0.05);

/** Whether the truth lies inside the estimate's 95 % position ellipse. */
export const inside95 = (truth: Vec, b: Belief) =>
	mahalanobis2([truth[0] - b.x[0], truth[1] - b.x[1]], positionCov(b.P)) <= CHI2_95;

/**
 * The 95 % ellipse of a 2 × 2 covariance: semi-axes a ≥ b and the angle of the long axis
 * (radians, from the x axis).
 */
export function ellipse(C: Mat) {
	const [[sxx, sxy], [, syy]] = C;
	const m = (sxx + syy) / 2;
	const d = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
	const l1 = m + d;
	const l2 = Math.max(0, m - d);
	const angle = Math.atan2(l1 - sxx, sxy || 1e-12);
	const k = Math.sqrt(CHI2_95);
	return { a: k * Math.sqrt(l1), b: k * Math.sqrt(l2), angle: sxy === 0 && sxx >= syy ? 0 : angle };
}

/** The root-mean-square of a 2 × 2 covariance's spread, √(trace/2): one axis's σ. */
export const sigmaOf = (C: Mat) => Math.sqrt((C[0][0] + C[1][1]) / 2);
