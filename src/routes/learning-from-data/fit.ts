/**
 * Fitting curves to examples: least-squares polynomial fits, their errors on
 * training and test points, and the synthetic data the page uses.
 *
 * The data are generated, not measured: a smooth "true" curve plus random
 * noise, so the page can show what a perfect model would look like. This is
 * stated on the page.
 *
 * Fits use the Legendre polynomials on x ∈ [−1, 1] as the basis (well
 * conditioned up to degree ~15, unlike plain powers of x), solving the
 * normal equations with partial pivoting.
 */

export interface Point {
	x: number;
	y: number;
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
	let a = seed >>> 0 || 0x9e3779b9;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Standard normal random number (Box–Muller). */
const gaussian = (rand: () => number) =>
	Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

/** The hidden "true" relationship the examples come from (x and y in [−1, 1]). */
export const truth = (x: number) => 0.55 * Math.sin(2.4 * x + 0.4) + 0.25 * x;

/**
 * `n` examples with x spread over [−0.95, 0.95] (jittered), y = truth + noise
 * of standard deviation `noise`. Every third point (from `offset`) is marked
 * as a test point when `testEvery` > 0.
 */
export function makeData(n: number, noise: number, seed = 1, testEvery = 3) {
	const rand = rng(seed);
	const pts: (Point & { test: boolean; id: number })[] = [];
	for (let i = 0; i < n; i++) {
		const x = -0.95 + (1.9 * (i + 0.2 + 0.6 * rand())) / n;
		pts.push({
			id: i,
			x,
			y: truth(x) + noise * gaussian(rand),
			test: testEvery > 0 && i % testEvery === 1
		});
	}
	return pts;
}

/** Legendre polynomials P0…Pd at x, by the three-term recurrence. */
export function legendre(x: number, d: number): number[] {
	const p = [1, x];
	for (let k = 1; k < d; k++) p.push(((2 * k + 1) * x * p[k] - k * p[k - 1]) / (k + 1));
	return p.slice(0, d + 1);
}

/** Solves A·x = b (A square) by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let piv = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
		[M[c], M[piv]] = [M[piv], M[c]];
		const d = M[c][c];
		if (Math.abs(d) < 1e-14) continue; // singular direction: leave its coefficient at 0
		for (let r = 0; r < n; r++) {
			if (r === c) continue;
			const f = M[r][c] / d;
			for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
		}
	}
	return M.map((row, i) => (Math.abs(row[i]) < 1e-14 ? 0 : row[n] / row[i]));
}

export interface Model {
	degree: number;
	coefficients: number[];
	predict: (x: number) => number;
}

/**
 * Least-squares polynomial of the given degree through the points. With
 * `ridge` > 0, a tiny penalty keeps the system solvable when there are fewer
 * points than coefficients (then the fit passes through every point).
 */
export function fitPolynomial(points: readonly Point[], degree: number, ridge = 1e-9): Model {
	const m = degree + 1;
	const A = Array.from({ length: m }, () => new Array(m).fill(0));
	const b = new Array(m).fill(0);
	for (const p of points) {
		const phi = legendre(p.x, degree);
		for (let i = 0; i < m; i++) {
			b[i] += phi[i] * p.y;
			for (let j = 0; j < m; j++) A[i][j] += phi[i] * phi[j];
		}
	}
	for (let i = 0; i < m; i++) A[i][i] += ridge;
	const c = points.length ? solve(A, b) : new Array(m).fill(0);
	const predict = (x: number) => {
		const phi = legendre(x, degree);
		let s = 0;
		for (let i = 0; i < m; i++) s += c[i] * phi[i];
		return s;
	};
	return { degree, coefficients: c, predict };
}

/** Mean squared error of a model on points (0 for no points). */
export function mse(model: Model, points: readonly Point[]) {
	if (!points.length) return 0;
	let s = 0;
	for (const p of points) s += (model.predict(p.x) - p.y) ** 2;
	return s / points.length;
}

/** Training and test error for every degree from 0 to `maxDegree`. */
export function errorCurve(train: readonly Point[], test: readonly Point[], maxDegree: number) {
	return Array.from({ length: maxDegree + 1 }, (_, d) => {
		const model = fitPolynomial(train, d);
		return { degree: d, train: mse(model, train), test: mse(model, test) };
	});
}
