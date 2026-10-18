/**
 * The mathematics behind the Taylor-series explainer: exact Taylor
 * coefficients of four functions about any centre a, their partial sums, the
 * radius of convergence (from the singularities, and from the coefficients
 * alone), Taylor's error bound, and Chebyshev interpolation on an interval.
 *
 * Everything is exact closed-form arithmetic; no data.
 */

export type FnId = 'exp' | 'sin' | 'runge' | 'log';

export interface Complex {
	re: number;
	im: number;
}

export interface TaylorFn {
	id: FnId;
	/** The value on the real line (NaN where it is not defined). */
	f: (x: number) => number;
	/** Taylor coefficients c₀ … c_n about a: f(x) = Σ c_k (x − a)^k. */
	coefficients: (a: number, n: number) => number[];
	/** Where the function (continued into the complex plane) stops being analytic. */
	singularities: Complex[];
	/** The centres a the series may be taken about. */
	centre: [number, number];
}

const exp: TaylorFn = {
	id: 'exp',
	f: Math.exp,
	coefficients(a, n) {
		const out: number[] = [];
		let c = Math.exp(a);
		for (let k = 0; k <= n; k++) {
			out.push(c);
			c /= k + 1;
		}
		return out;
	},
	singularities: [],
	centre: [-3, 3]
};

const sin: TaylorFn = {
	id: 'sin',
	f: Math.sin,
	coefficients(a, n) {
		// The k-th derivative of sin is sin(x + kπ/2).
		const out: number[] = [];
		let fact = 1;
		for (let k = 0; k <= n; k++) {
			if (k > 0) fact *= k;
			out.push(Math.sin(a + (k * Math.PI) / 2) / fact);
		}
		return out;
	},
	singularities: [],
	centre: [-3, 3]
};

/**
 * 1/(1 + x²) = Im(1/(x − i)), and 1/(x − i) = 1/((a − i) + (x − a)) is a
 * geometric series in (x − a)/(a − i). So c_k = (−1)^k Im((a − i)^−(k+1)).
 * With 1/(a − i) = (a + i)/(1 + a²) = ρ e^{iφ}, ρ = 1/√(1 + a²), φ = atan2(1, a):
 * c_k = (−1)^k ρ^{k+1} sin((k + 1)φ).
 */
const runge: TaylorFn = {
	id: 'runge',
	f: (x) => 1 / (1 + x * x),
	coefficients(a, n) {
		const rho = 1 / Math.sqrt(1 + a * a);
		const phi = Math.atan2(1, a);
		const out: number[] = [];
		let p = rho;
		for (let k = 0; k <= n; k++) {
			out.push((k % 2 ? -1 : 1) * p * Math.sin((k + 1) * phi));
			p *= rho;
		}
		return out;
	},
	singularities: [
		{ re: 0, im: 1 },
		{ re: 0, im: -1 }
	],
	centre: [-3, 3]
};

/** log(1 + x): c₀ = log(1 + a), c_k = (−1)^(k+1) / (k (1 + a)^k). */
const log: TaylorFn = {
	id: 'log',
	f: (x) => (x > -1 ? Math.log1p(x) : NaN),
	coefficients(a, n) {
		const out = [Math.log1p(a)];
		let p = 1;
		for (let k = 1; k <= n; k++) {
			p /= 1 + a;
			out.push(((k % 2 ? 1 : -1) * p) / k);
		}
		return out;
	},
	singularities: [{ re: -1, im: 0 }],
	centre: [-0.75, 3]
};

export const functions: Record<FnId, TaylorFn> = { exp, sin, runge, log };

export function fnFor(id: unknown): TaylorFn {
	return functions[id as FnId] ?? runge;
}

/** Value of Σ c_k (x − a)^k (Horner's rule). */
export function evalSeries(c: readonly number[], a: number, x: number): number {
	const h = x - a;
	let s = 0;
	for (let k = c.length - 1; k >= 0; k--) s = s * h + c[k];
	return s;
}

/** The Taylor polynomial of degree n about a, as a function of x. */
export function taylor(fn: TaylorFn, a: number, n: number): (x: number) => number {
	const c = fn.coefficients(a, n);
	return (x) => evalSeries(c, a, x);
}

/** Radius of convergence about a: the distance to the nearest singularity (∞ if none). */
export function radius(fn: TaylorFn, a: number): number {
	let r = Infinity;
	for (const s of fn.singularities) r = Math.min(r, Math.hypot(s.re - a, s.im));
	return r;
}

/**
 * The radius worked out from the coefficients alone, by the root test
 * (Cauchy–Hadamard: 1/R = limsup |c_k|^(1/k)), using the largest
 * |c_k|^(1/k) over k = from … to. ∞ when the coefficients die off too fast to
 * measure (an entire function such as eˣ or sin).
 */
export function radiusFromCoefficients(fn: TaylorFn, a: number, from = 100, to = 200): number {
	const c = fn.coefficients(a, to);
	let m = 0;
	for (let k = from; k <= to; k++) {
		const v = Math.abs(c[k]);
		if (v > 0 && Number.isFinite(v)) m = Math.max(m, Math.pow(v, 1 / k));
	}
	return m > 0 ? 1 / m : Infinity;
}

/**
 * Taylor's theorem (Lagrange's remainder): |f(x) − P_n(x)| ≤ M |x − a|^(n+1) / (n+1)!,
 * where M bounds |f^(n+1)| between a and x: e^max(a, x) for eˣ, 1 for sin.
 * Only for the two entire functions (NaN otherwise).
 */
export function remainderBound(fn: TaylorFn, a: number, x: number, n: number): number {
	let m: number;
	if (fn.id === 'exp') m = Math.exp(Math.max(a, x));
	else if (fn.id === 'sin') m = 1;
	else return NaN;
	let b = m;
	const h = Math.abs(x - a);
	for (let k = 1; k <= n + 1; k++) b *= h / k;
	return b;
}

/**
 * The polynomial of degree n that matches f at the n + 1 Chebyshev points of
 * [lo, hi] (the extremes of T_n, which crowd towards the ends), evaluated by
 * the barycentric formula.
 */
export function chebyshev(
	f: (x: number) => number,
	lo: number,
	hi: number,
	n: number
): { nodes: number[]; values: number[]; at: (x: number) => number } {
	const nodes: number[] = [];
	const values: number[] = [];
	const w: number[] = [];
	for (let j = 0; j <= n; j++) {
		const x =
			n === 0 ? (lo + hi) / 2 : (lo + hi) / 2 + ((hi - lo) / 2) * Math.cos((j * Math.PI) / n);
		nodes.push(x);
		values.push(f(x));
		w.push((j % 2 ? -1 : 1) * (j === 0 || j === n ? 0.5 : 1));
	}
	const at = (x: number) => {
		if (n === 0) return values[0];
		let num = 0;
		let den = 0;
		for (let j = 0; j <= n; j++) {
			const d = x - nodes[j];
			if (d === 0) return values[j];
			const q = w[j] / d;
			num += q * values[j];
			den += q;
		}
		return num / den;
	};
	return { nodes, values, at };
}

/**
 * For comparison (the narrative mentions it): the interpolant of degree n
 * through n + 1 equally spaced points of [lo, hi], by the barycentric formula
 * with general weights 1/Π(x_j − x_k).
 */
export function equispaced(
	f: (x: number) => number,
	lo: number,
	hi: number,
	n: number
): (x: number) => number {
	const xs = Array.from({ length: n + 1 }, (_, j) =>
		n === 0 ? (lo + hi) / 2 : lo + ((hi - lo) * j) / n
	);
	const w = xs.map((xj, j) => 1 / xs.reduce((p, xk, k) => (k === j ? p : p * (xj - xk)), 1));
	const v = xs.map(f);
	return (x) => {
		let num = 0;
		let den = 0;
		for (let j = 0; j <= n; j++) {
			const d = x - xs[j];
			if (d === 0) return v[j];
			num += (w[j] / d) * v[j];
			den += w[j] / d;
		}
		return num / den;
	};
}

/**
 * Chebyshev interpolation on [lo, hi] converges like ρ^−n, where ρ is the sum
 * of the semi-axes (rescaled to [−1, 1]) of the largest ellipse with foci at
 * the interval's ends that keeps the singularities outside (Bernstein's
 * ellipse). ∞ for an entire function.
 */
export function bernsteinRho(fn: TaylorFn, lo: number, hi: number): number {
	let rho = Infinity;
	const mid = (lo + hi) / 2;
	const half = (hi - lo) / 2;
	for (const s of fn.singularities) {
		// z = (s − mid)/half; ρ = |z + √(z² − 1)| with the root chosen so |·| ≥ 1.
		const z = { re: (s.re - mid) / half, im: s.im / half };
		const z2 = { re: z.re * z.re - z.im * z.im - 1, im: 2 * z.re * z.im };
		const r = Math.hypot(z2.re, z2.im);
		const sq = {
			re: Math.sqrt((r + z2.re) / 2),
			im: Math.sign(z2.im || 1) * Math.sqrt((r - z2.re) / 2)
		};
		const p = Math.hypot(z.re + sq.re, z.im + sq.im);
		const m = Math.hypot(z.re - sq.re, z.im - sq.im);
		rho = Math.min(rho, Math.max(p, m));
	}
	return rho;
}

/** Largest |f − g| over [lo, hi], sampled. */
export function maxError(
	f: (x: number) => number,
	g: (x: number) => number,
	lo: number,
	hi: number,
	samples = 2000
): number {
	let m = 0;
	for (let i = 0; i <= samples; i++) {
		const x = lo + ((hi - lo) * i) / samples;
		m = Math.max(m, Math.abs(f(x) - g(x)));
	}
	return m;
}
