/**
 * The mathematics behind the calculus explainer.
 *
 * Two parts:
 *   - generic operations on any function f: the slope of a chord (and so of
 *     the tangent, as the chord shrinks), Riemann sums with left, right or
 *     midpoint rectangles, and the running area A(x) = ∫ₐˣ f;
 *   - the curves the reader works with: a few analytic presets (whose exact
 *     derivatives the page quotes, such as 2x for x²) and an editable curve, a
 *     natural cubic spline through draggable knots.
 *
 * Everything is a pure function; the scenes only draw what these return.
 */

export type Fn = (x: number) => number;

/** The curves live on 0 ≤ x ≤ 3 (seconds, for the thrown ball). */
export const X0 = 0;
export const X1 = 3;

// ---- generic operations ------------------------------------------------------------------

/**
 * Slope of the chord from (x, f(x)) to (x + h, f(x + h)): rise ÷ run. As h
 * shrinks it tends to the slope of the tangent, the derivative f′(x). A
 * negative h gives the chord to a point on the left.
 */
export function chordSlope(f: Fn, x: number, h: number): number {
	return (f(x + h) - f(x)) / h;
}

/** Derivative by a central difference (accurate to ~h² for smooth f): for checks and fallbacks. */
export function numericSlope(f: Fn, x: number, h = 1e-5): number {
	return (f(x + h) - f(x - h)) / (2 * h);
}

export type Rule = 'left' | 'mid' | 'right';

/** Where each rule measures a rectangle's height, as a fraction of its width. */
const ruleOffset: Record<Rule, number> = { left: 0, mid: 0.5, right: 1 };

interface Rect {
	x: number;
	width: number;
	/** Signed height: rectangles below the axis count as negative area. */
	height: number;
}

/** The n rectangles of a Riemann sum of f over [a, b]. */
export function rectangles(f: Fn, a: number, b: number, n: number, rule: Rule = 'left'): Rect[] {
	const width = (b - a) / n;
	const k = ruleOffset[rule];
	return Array.from({ length: n }, (_, i) => {
		const x = a + i * width;
		return { x, width, height: f(x + k * width) };
	});
}

/** Total (signed) area of the n rectangles: the Riemann sum. */
export function riemann(f: Fn, a: number, b: number, n: number, rule: Rule = 'left'): number {
	const width = (b - a) / n;
	const k = ruleOffset[rule];
	let sum = 0;
	for (let i = 0; i < n; i++) sum += f(a + (i + k) * width);
	return sum * width;
}

/**
 * The exact integral of f over [a, b] for a smooth f, by composite Simpson's
 * rule (error ∝ 1/m⁴; with the default m it is exact to ~10 digits for these
 * curves). Signed: area below the axis counts as negative.
 */
export function integral(f: Fn, a: number, b: number, m = 400): number {
	if (a === b) return 0;
	const n = m % 2 === 0 ? m : m + 1;
	const h = (b - a) / n;
	let s = f(a) + f(b);
	for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
	return (s * h) / 3;
}

/** The running area A(x) = ∫ₐˣ f: the area accumulated from a up to x. */
export function runningArea(f: Fn, a: number, x: number): number {
	return integral(f, a, x);
}

/**
 * The running area at `count` evenly spaced points from a to b (inclusive),
 * built up piece by piece, for drawing A(x) as a curve.
 */
export function accumulate(f: Fn, a: number, b: number, count: number): number[] {
	const out = [0];
	const step = (b - a) / (count - 1);
	for (let i = 1; i < count; i++) {
		const x = a + (i - 1) * step;
		out.push(out[i - 1] + integral(f, x, x + step, 8));
	}
	return out;
}

// ---- the editable curve: a natural cubic spline ----------------------------------------------

/**
 * Knot positions of the editable curve: six, 0.6 apart, so that none sits
 * under the point at x = 1 or 1.5, where the narrative puts it.
 */
export const KNOT_X = [0, 0.6, 1.2, 1.8, 2.4, 3];

/**
 * The natural cubic spline through the points (xs[i], ys[i]): the smoothest
 * curve through them (its curvature is continuous, and zero at both ends).
 * Unlike a shape-preserving interpolation, it does not flatten at every
 * knot, so its derivative is a smooth curve too.
 */
export function spline(xs: number[], ys: number[]): { f: Fn; df: Fn } {
	const n = xs.length - 1;
	const h = xs.slice(1).map((x, i) => x - xs[i]);
	// Second derivatives M[i] from the tridiagonal system (Thomas algorithm),
	// with M[0] = M[n] = 0 (the "natural" end conditions).
	const M = new Array<number>(n + 1).fill(0);
	if (n >= 2) {
		const a: number[] = [];
		const b: number[] = [];
		const c: number[] = [];
		const d: number[] = [];
		for (let i = 1; i < n; i++) {
			a.push(h[i - 1]);
			b.push(2 * (h[i - 1] + h[i]));
			c.push(h[i]);
			d.push(6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]));
		}
		const m = b.length;
		for (let i = 1; i < m; i++) {
			const w = a[i] / b[i - 1];
			b[i] -= w * c[i - 1];
			d[i] -= w * d[i - 1];
		}
		const sol = new Array<number>(m);
		sol[m - 1] = d[m - 1] / b[m - 1];
		for (let i = m - 2; i >= 0; i--) sol[i] = (d[i] - c[i] * sol[i + 1]) / b[i];
		for (let i = 0; i < m; i++) M[i + 1] = sol[i];
	}
	const seg = (x: number) => {
		let i = 0;
		while (i < n - 1 && x > xs[i + 1]) i++;
		return i;
	};
	return {
		f: (x) => {
			const i = seg(x);
			const A = xs[i + 1] - x;
			const B = x - xs[i];
			const hi = h[i];
			return (
				(M[i] * A ** 3 + M[i + 1] * B ** 3) / (6 * hi) +
				(ys[i] / hi - (M[i] * hi) / 6) * A +
				(ys[i + 1] / hi - (M[i + 1] * hi) / 6) * B
			);
		},
		df: (x) => {
			const i = seg(x);
			const A = xs[i + 1] - x;
			const B = x - xs[i];
			const hi = h[i];
			return (
				(-M[i] * A ** 2 + M[i + 1] * B ** 2) / (2 * hi) +
				(ys[i + 1] - ys[i]) / hi -
				((M[i + 1] - M[i]) * hi) / 6
			);
		}
	};
}

// ---- the curves -------------------------------------------------------------------------------

/**
 * Gravity near the ground, m/s²: standard gravity is 9.80665 m/s² (CGPM 1901;
 * NIST, "Standard acceleration of gravity"), rounded as the page quotes it.
 */
export const G = 9.8;
/** Launch speed of the thrown ball, 14.7 m/s (1.5 g): it lands again after exactly 3 s. */
export const V0 = 1.5 * G;

export type CurveId = 'parabola' | 'cubic' | 'wave' | 'ball' | 'custom';

export interface Curve {
	id: CurveId;
	/** The curve's formula as shown on the stage. */
	formula: string;
	f: Fn;
	/** Its exact derivative. */
	df: Fn;
	/** Axis names: plain x and y, or time and height for the ball. */
	xName: string;
	yName: string;
	/** Units after numbers on each axis ('' for none). */
	xUnit: string;
	yUnit: string;
}

const plain = { xName: 'x', yName: 'y', xUnit: '', yUnit: '' };

export const presets: Record<Exclude<CurveId, 'custom'>, Curve> = {
	parabola: { id: 'parabola', formula: 'y = x²', f: (x) => x * x, df: (x) => 2 * x, ...plain },
	cubic: {
		id: 'cubic',
		formula: 'y = 2(x − 1.5)³ − 3(x − 1.5) + 3',
		f: (x) => 2 * (x - 1.5) ** 3 - 3 * (x - 1.5) + 3,
		df: (x) => 6 * (x - 1.5) ** 2 - 3,
		...plain
	},
	wave: {
		id: 'wave',
		formula: 'y = 3 sin(2πx / 3)',
		f: (x) => 3 * Math.sin((2 * Math.PI * x) / 3),
		df: (x) => 2 * Math.PI * Math.cos((2 * Math.PI * x) / 3),
		...plain
	},
	ball: {
		id: 'ball',
		formula: 'h = 14.7 t − 4.9 t²',
		f: (t) => V0 * t - 0.5 * G * t * t,
		df: (t) => V0 - G * t,
		xName: 't',
		yName: 'h',
		xUnit: 's',
		yUnit: 'm'
	}
};

/** The editable curve's knot heights before the reader moves any. */
export const DEFAULT_KNOTS = [1.5, 5, 6.5, 3, 2, 8];

/** Lowest and highest a knot can be dragged (the plot shows −4 … 12). */
export const KNOT_MIN = -3.5;
export const KNOT_MAX = 11.5;

/** Knot heights from a param string ("1.5,5,6.5,3,2,8"), or null if it is not one. */
export function parseKnots(value: unknown): number[] | null {
	if (typeof value !== 'string') return null;
	const ys = value.split(',').map(Number);
	return ys.length === KNOT_X.length && ys.every(Number.isFinite)
		? ys.map((y) => Math.min(KNOT_MAX, Math.max(KNOT_MIN, y)))
		: null;
}

/** The curve to draw: a preset, or the spline through the knots. */
export function curveFor(id: string, knots: number[] | null): Curve {
	if (id in presets) return presets[id as keyof typeof presets];
	const { f, df } = spline(KNOT_X, knots ?? DEFAULT_KNOTS);
	return { id: 'custom', formula: 'your own curve', f, df, ...plain };
}

/** Heights of a curve at the knots: where the knots sit before the reader drags one. */
export function knotsOf(curve: Curve): number[] {
	return KNOT_X.map((x) => Math.round(curve.f(x) * 100) / 100);
}
