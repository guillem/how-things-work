/**
 * 2 × 2 matrices for the linear-transformations explainer: applying a matrix
 * to a vector, composing two matrices, the determinant and the real
 * eigenvalues and eigenvectors.
 *
 * A matrix [[a, b], [c, d]] is stored as { a, b, c, d }. Its COLUMNS are where
 * it sends the basis vectors: î = (1, 0) lands on (a, c) and ĵ = (0, 1) on
 * (b, d). So M·(x, y) = x·(a, c) + y·(b, d) = (ax + by, cx + dy).
 *
 * Eigenvalues are the roots of λ² − (a + d)λ + (ad − bc) = 0. Their
 * discriminant (a + d)² − 4(ad − bc) decides the case:
 *   > 0  two different real eigenvalues, two eigen-directions;
 *   < 0  a complex pair (a rotation is in there): no real eigen-direction;
 *   = 0  one repeated eigenvalue λ: either M = λI (every direction is an
 *        eigen-direction) or M − λI ≠ 0 (a shear-like matrix: one direction).
 * The scenes round entries to 0.1, so "= 0" is tested with a small tolerance
 * against floating-point noise.
 *
 * Simplifications: none (floating point only). Complex eigenvalues are
 * reported as such but their complex eigenvectors are not computed: on the
 * real plane there is no direction to draw.
 */

export interface Vec {
	x: number;
	y: number;
}

/** [[a, b], [c, d]]: î ↦ (a, c), ĵ ↦ (b, d). */
export interface Mat {
	a: number;
	b: number;
	c: number;
	d: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const mat = (a: number, b: number, c: number, d: number): Mat => ({ a, b, c, d });
/** The matrix whose columns are i′ and j′. */
export const fromColumns = (i: Vec, j: Vec): Mat => ({ a: i.x, b: j.x, c: i.y, d: j.y });

export const I2: Mat = mat(1, 0, 0, 1);

/** Where î goes: the first column. */
export const col1 = (m: Mat): Vec => ({ x: m.a, y: m.c });
/** Where ĵ goes: the second column. */
export const col2 = (m: Mat): Vec => ({ x: m.b, y: m.d });

/** M·v = x·(a, c) + y·(b, d). */
export const apply = (m: Mat, v: Vec): Vec => ({
	x: m.a * v.x + m.b * v.y,
	y: m.c * v.x + m.d * v.y
});

/** The product M·N: first N, then M. Its columns are M applied to N's columns. */
export const compose = (m: Mat, n: Mat): Mat => ({
	a: m.a * n.a + m.b * n.c,
	b: m.a * n.b + m.b * n.d,
	c: m.c * n.a + m.d * n.c,
	d: m.c * n.b + m.d * n.d
});

export const det = (m: Mat): number => m.a * m.d - m.b * m.c;
const trace = (m: Mat): number => m.a + m.d;

/** Straight-line blend between two matrices (s = 0 gives m, s = 1 gives n). */
export const lerpMat = (m: Mat, n: Mat, s: number): Mat => ({
	a: m.a + (n.a - m.a) * s,
	b: m.b + (n.b - m.b) * s,
	c: m.c + (n.c - m.c) * s,
	d: m.d + (n.d - m.d) * s
});

/** Rotation by `deg` degrees anticlockwise. */
export const rotation = (deg: number): Mat => {
	const r = (deg * Math.PI) / 180;
	return mat(Math.cos(r), -Math.sin(r), Math.sin(r), Math.cos(r));
};

/** Horizontal shear: î stays, ĵ ↦ (k, 1). */
export const shear = (k: number): Mat => mat(1, k, 0, 1);

export const length = (v: Vec): number => Math.hypot(v.x, v.y);
export const scale = (v: Vec, k: number): Vec => ({ x: v.x * k, y: v.y * k });
export const add = (v: Vec, w: Vec): Vec => ({ x: v.x + w.x, y: v.y + w.y });

/**
 * Signed area of a polygon (shoelace formula): positive when its corners run
 * anticlockwise, negative when they run clockwise.
 */
export function signedArea(points: Vec[]): number {
	let s = 0;
	for (let k = 0; k < points.length; k++) {
		const p = points[k];
		const q = points[(k + 1) % points.length];
		s += p.x * q.y - q.x * p.y;
	}
	return s / 2;
}

/** How many independent directions survive: 2 (det ≠ 0), 1 (a line) or 0 (a point). */
export function rank(m: Mat, eps = 1e-9): 0 | 1 | 2 {
	if (Math.abs(det(m)) > eps) return 2;
	return Math.max(Math.abs(m.a), Math.abs(m.b), Math.abs(m.c), Math.abs(m.d)) > eps ? 1 : 0;
}

interface EigenPair {
	value: number;
	/** A unit vector along the eigen-direction. */
	vector: Vec;
}

type Eigen =
	/** Two different real eigenvalues; `pairs` is ordered by |λ|, biggest first. */
	| { kind: 'two'; pairs: [EigenPair, EigenPair] }
	/** One repeated eigenvalue with a single direction (a shear-like matrix). */
	| { kind: 'one'; pairs: [EigenPair] }
	/** M = λI: every direction is an eigen-direction with eigenvalue λ. */
	| { kind: 'all'; value: number }
	/** Complex pair re ± i·im: no real eigen-direction. */
	| { kind: 'none'; re: number; im: number };

/** A unit vector along the null direction of [[p, q], [r, s]] (assumed singular, not zero). */
function nullDirection(p: number, q: number, r: number, s: number): Vec {
	// Each row (p, q) is perpendicular to the null direction, so (q, −p) lies along it;
	// use the longer row for accuracy.
	const v = Math.hypot(p, q) >= Math.hypot(r, s) ? vec(q, -p) : vec(s, -r);
	const len = length(v);
	return vec(v.x / len, v.y / len);
}

/** A unit vector along the eigen-direction for eigenvalue `lambda`, pointing into x ≥ 0. */
function eigenvector(m: Mat, lambda: number): Vec {
	const v = nullDirection(m.a - lambda, m.b, m.c, m.d - lambda);
	return v.x < -1e-12 || (Math.abs(v.x) <= 1e-12 && v.y < 0) ? vec(-v.x, -v.y) : v;
}

export function eigen(m: Mat, eps = 1e-9): Eigen {
	const tr = trace(m);
	const disc = tr * tr - 4 * det(m);
	const scaleEps = eps * Math.max(1, tr * tr);
	if (disc < -scaleEps) return { kind: 'none', re: tr / 2, im: Math.sqrt(-disc) / 2 };
	if (disc <= scaleEps) {
		const value = tr / 2;
		const offDiagonal = Math.max(
			Math.abs(m.a - value),
			Math.abs(m.b),
			Math.abs(m.c),
			Math.abs(m.d - value)
		);
		if (offDiagonal <= eps * Math.max(1, Math.abs(value))) return { kind: 'all', value };
		return { kind: 'one', pairs: [{ value, vector: eigenvector(m, value) }] };
	}
	const root = Math.sqrt(disc);
	const l1 = (tr + root) / 2;
	const l2 = (tr - root) / 2;
	const [big, small] = Math.abs(l1) >= Math.abs(l2) ? [l1, l2] : [l2, l1];
	return {
		kind: 'two',
		pairs: [
			{ value: big, vector: eigenvector(m, big) },
			{ value: small, vector: eigenvector(m, small) }
		]
	};
}

/** Angle of a vector in degrees, anticlockwise from the positive x-axis, in (−180, 180]. */
export const angleOf = (v: Vec): number => (Math.atan2(v.y, v.x) * 180) / Math.PI;

/**
 * Applies `m` to `v` again and again, `n` times: [v, Mv, M²v, …, Mⁿv]. Repeating
 * a matrix turns almost any starting vector towards the eigen-direction with
 * the biggest |λ| (the "power method" behind PageRank).
 */
export function iterate(m: Mat, v: Vec, n: number): Vec[] {
	const out = [v];
	for (let k = 0; k < n; k++) out.push(apply(m, out[out.length - 1]));
	return out;
}

/** A number for the readouts: at most `d` decimals, trailing zeros dropped, a real minus sign. */
export function num(v: number, d = 2): string {
	const r = Number(v.toFixed(d));
	const s = (Object.is(r, -0) ? 0 : r).toString();
	return s.replace('-', '−');
}

/** Rounds to the slider step of 0.1 (handles and keys snap to it). */
export const round1 = (v: number): number => Math.round(v * 10) / 10;
