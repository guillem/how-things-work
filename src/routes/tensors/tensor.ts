/**
 * The model behind the tensors explainer.
 *
 * Two views of the word "tensor":
 *
 * 1. Computing (NumPy, PyTorch, TensorFlow): a tensor is an array of numbers with some number of
 *    axes. Its shape lists the length of each axis; the numbers are stored one after another in
 *    row-major order (the last index changes fastest), so element (i, j, k) of a shape (A, B, C)
 *    array sits at position i·B·C + j·C + k. Slicing fixes one index and drops that axis;
 *    reshaping re-reads the same list of numbers with a different shape; transposing reorders
 *    the axes; a matrix–vector product multiplies along the axis the two share and sums it away.
 *
 * 2. Physics: a tensor is a quantity whose components follow a fixed rule when the coordinate
 *    axes change. In 2D, with the axes turned by θ (R the rotation matrix by θ), the components of
 *    an arrow change as v′ = Rᵀ v and those of a second-order tensor such as the stress tensor
 *    as σ′ = Rᵀ σ R. The stress tensor maps the unit normal n of a cut to the force per area
 *    (traction) on it: t = σ n (Cauchy). Its trace and determinant (and so its principal stresses,
 *    the eigenvalues) are the same in every axes.
 *
 * Reference formulas checked in the model tests: the Mohr's-circle transformation of plane
 * stress, σx′x′ = (σxx + σyy)/2 + (σxx − σyy)/2 · cos 2θ + τxy · sin 2θ and
 * τx′y′ = −(σxx − σyy)/2 · sin 2θ + τxy · cos 2θ, principal angle tan 2θp = 2τxy / (σxx − σyy)
 * (e.g. Gere & Goodno, Mechanics of Materials, §7.2–7.3).
 */
import { MACAW_HEIGHT, MACAW_RGB_BASE64, MACAW_WIDTH } from './macaw';

// ============================================================================ arrays

/** An array of numbers with a shape, stored row-major. */
export interface Tensor {
	shape: readonly number[];
	data: Float64Array;
}

/** Number of elements of an array of this shape (1 for a scalar, whose shape is empty). */
export const size = (shape: readonly number[]) => shape.reduce((a, b) => a * b, 1);

/** How far apart, in the stored list, neighbours along each axis are. */
export function strides(shape: readonly number[]): number[] {
	const out = new Array<number>(shape.length);
	let s = 1;
	for (let a = shape.length - 1; a >= 0; a--) {
		out[a] = s;
		s *= shape[a];
	}
	return out;
}

/** Position in the stored list of the element at `index`. */
export function offset(shape: readonly number[], index: readonly number[]): number {
	if (index.length !== shape.length)
		throw new Error(`need ${shape.length} indices, got ${index.length}`);
	const st = strides(shape);
	let o = 0;
	for (let a = 0; a < shape.length; a++) {
		const i = index[a];
		if (!Number.isInteger(i) || i < 0 || i >= shape[a])
			throw new Error(`index ${i} out of range for axis ${a} of length ${shape[a]}`);
		o += i * st[a];
	}
	return o;
}

/** The indices of the element stored at position `o`. */
export function unravel(shape: readonly number[], o: number): number[] {
	return strides(shape).map((s, a) => Math.floor(o / s) % shape[a]);
}

export const tensor = (shape: readonly number[], data: ArrayLike<number>): Tensor => {
	if (data.length !== size(shape))
		throw new Error(`shape (${shape.join(', ')}) needs ${size(shape)} numbers, got ${data.length}`);
	return { shape: [...shape], data: Float64Array.from(data) };
};

export const get = (t: Tensor, index: readonly number[]) => t.data[offset(t.shape, index)];

/** Fixes index `i` along `axis`: the result has one axis fewer. */
export function slice(t: Tensor, axis: number, i: number): Tensor {
	const shape = t.shape.filter((_, a) => a !== axis);
	const out = new Float64Array(size(shape));
	for (let o = 0; o < out.length; o++) {
		const idx = unravel(shape, o);
		idx.splice(axis, 0, i);
		out[o] = get(t, idx);
	}
	return { shape, data: out };
}

/** The same numbers, in the same order, read with another shape. */
export function reshape(t: Tensor, shape: readonly number[]): Tensor {
	if (size(shape) !== t.data.length)
		throw new Error(
			`cannot reshape ${t.data.length} numbers into (${shape.join(', ')}) = ${size(shape)}`
		);
	return { shape: [...shape], data: t.data };
}

/** Reorders the axes: axis a of the result is axis perm[a] of `t`. The numbers move. */
export function transpose(t: Tensor, perm: readonly number[]): Tensor {
	const shape = perm.map((p) => t.shape[p]);
	const out = new Float64Array(t.data.length);
	const idx = new Array<number>(t.shape.length);
	for (let o = 0; o < out.length; o++) {
		const j = unravel(shape, o);
		for (let a = 0; a < perm.length; a++) idx[perm[a]] = j[a];
		out[o] = get(t, idx);
	}
	return { shape, data: out };
}

/**
 * Multiplies along the last axis of `t` and the only axis of `w`, and sums that axis away:
 * result[…] = Σₖ t[…, k] · w[k]. For a matrix and a vector this is the matrix–vector product;
 * for an image and three weights it is a weighted sum of the channels.
 */
export function contractLast(t: Tensor, w: readonly number[]): Tensor {
	const n = t.shape[t.shape.length - 1];
	if (n !== w.length)
		throw new Error(`axes don't match: the last axis has length ${n}, the vector ${w.length}`);
	const shape = t.shape.slice(0, -1);
	const out = new Float64Array(size(shape));
	for (let o = 0; o < out.length; o++) {
		let s = 0;
		for (let k = 0; k < n; k++) s += t.data[o * n + k] * w[k];
		out[o] = s;
	}
	return { shape, data: out };
}

/** Matrix (rows × columns) times vector: the columns axis must match the vector's length. */
export function matVec(m: Tensor, v: readonly number[]): Tensor {
	if (m.shape.length !== 2) throw new Error('not a matrix');
	return contractLast(m, v);
}

/** Averages over the given axes, keeping the others (in their order). */
export function meanOver(t: Tensor, axes: readonly number[]): Tensor {
	const keep = t.shape.map((_, a) => a).filter((a) => !axes.includes(a));
	const shape = keep.map((a) => t.shape[a]);
	const out = new Float64Array(size(shape));
	const count = t.data.length / out.length;
	for (let o = 0; o < t.data.length; o++) {
		const idx = unravel(t.shape, o);
		const k = keep.length
			? offset(
					shape,
					keep.map((a) => idx[a])
				)
			: 0;
		out[k] += t.data[o] / count;
	}
	return { shape, data: out };
}

// ============================================================================ the image

/** Channel names along the last axis of the image. */
export const CHANNELS = ['red', 'green', 'blue'] as const;

let cached: Tensor | null = null;
/** The photograph as a (height, width, channel) = (48, 36, 3) array of values 0–255. */
export function macaw(): Tensor {
	if (cached) return cached;
	const bin = atob(MACAW_RGB_BASE64);
	const bytes = Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
	cached = tensor([MACAW_HEIGHT, MACAW_WIDTH, 3], bytes);
	return cached;
}

/**
 * Luma weights of ITU-R BT.601: Y′ = 0.299 R′ + 0.587 G′ + 0.114 B′, applied to the
 * gamma-encoded (sRGB) values, the classic recipe for turning a colour picture grey. They sum
 * to 1, so white stays white.
 */
export const LUMA_601 = [0.299, 0.587, 0.114] as const;

// ============================================================================ pictures

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** An uncompressed 24-bit BMP data URL of an RGB image (row-major, 3 values 0–255 a pixel). */
export function rgbBmpUrl(width: number, height: number, rgb: ArrayLike<number>): string {
	const row = Math.ceil((width * 3) / 4) * 4;
	const offsetBytes = 14 + 40;
	const buf = new Uint8Array(offsetBytes + row * height);
	const dv = new DataView(buf.buffer);
	buf[0] = 0x42; // 'B'
	buf[1] = 0x4d; // 'M'
	dv.setUint32(2, buf.length, true);
	dv.setUint32(10, offsetBytes, true);
	dv.setUint32(14, 40, true);
	dv.setInt32(18, width, true);
	dv.setInt32(22, -height, true); // negative: top row first
	dv.setUint16(26, 1, true);
	dv.setUint16(28, 24, true);
	dv.setUint32(34, row * height, true);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const s = (y * width + x) * 3;
			const d = offsetBytes + y * row + x * 3;
			buf[d] = clamp255(rgb[s + 2]); // BMP stores blue, green, red
			buf[d + 1] = clamp255(rgb[s + 1]);
			buf[d + 2] = clamp255(rgb[s]);
		}
	let bin = '';
	for (let i = 0; i < buf.length; i += 0x8000)
		bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return 'data:image/bmp;base64,' + btoa(bin);
}

/** A one-number-per-pixel image drawn in shades from black (0) to `tint` (255). */
export function tintedBmpUrl(
	width: number,
	height: number,
	values: ArrayLike<number>,
	tint: readonly [number, number, number] = [255, 255, 255]
): string {
	const rgb = new Float64Array(width * height * 3);
	for (let p = 0; p < width * height; p++)
		for (let c = 0; c < 3; c++) rgb[p * 3 + c] = (values[p] / 255) * tint[c];
	return rgbBmpUrl(width, height, rgb);
}

// ============================================================================ physics

export type Vec2 = readonly [number, number];
/** A 2 × 2 matrix, row by row: [[a, b], [c, d]]. */
export type Mat2 = readonly [Vec2, Vec2];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The rotation by θ degrees (anticlockwise). Its columns are the turned axes x′ and y′. */
export function rotation(deg: number): Mat2 {
	const c = Math.cos(rad(deg));
	const s = Math.sin(rad(deg));
	return [
		[c, -s],
		[s, c]
	];
}

export const mul = (a: Mat2, b: Mat2): Mat2 => [
	[a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
	[a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]]
];
export const apply = (m: Mat2, v: Vec2): Vec2 => [
	m[0][0] * v[0] + m[0][1] * v[1],
	m[1][0] * v[0] + m[1][1] * v[1]
];
export const transposed = (m: Mat2): Mat2 => [
	[m[0][0], m[1][0]],
	[m[0][1], m[1][1]]
];
export const trace = (m: Mat2) => m[0][0] + m[1][1];
export const det = (m: Mat2) => m[0][0] * m[1][1] - m[0][1] * m[1][0];

/**
 * The components of a fixed arrow measured along axes turned by θ: v′ = Rᵀ v (one factor of R,
 * because an arrow has one index).
 */
export const vectorInAxes = (v: Vec2, deg: number): Vec2 => apply(transposed(rotation(deg)), v);

/**
 * The components of a second-order tensor in axes turned by θ: σ′ = Rᵀ σ R (one factor of R per
 * index).
 */
export function tensorInAxes(m: Mat2, deg: number): Mat2 {
	const r = rotation(deg);
	return mul(mul(transposed(r), m), r);
}

/** Plane stress, in MPa: σ = [[σxx, τxy], [τxy, σyy]]. */
export const stress = (sxx: number, syy: number, txy: number): Mat2 => [
	[sxx, txy],
	[txy, syy]
];

/** The traction (force per unit area) on a cut whose unit normal is n: t = σ n. */
export const traction = (s: Mat2, n: Vec2): Vec2 => apply(s, n);

/** The unit vector at θ degrees from the x-axis. */
export const unit = (deg: number): Vec2 => [Math.cos(rad(deg)), Math.sin(rad(deg))];

/**
 * Principal stresses σ₁ ≥ σ₂ (the eigenvalues of a symmetric σ) and the angle θp of the axis of
 * σ₁ from x, in degrees in (−90, 90]: turning the axes by θp makes the shear zero.
 */
export function principal(s: Mat2): { s1: number; s2: number; deg: number } {
	const c = (s[0][0] + s[1][1]) / 2;
	const h = (s[0][0] - s[1][1]) / 2;
	const r = Math.hypot(h, s[0][1]);
	let deg = (Math.atan2(s[0][1], h) * 90) / Math.PI;
	if (deg <= -90) deg += 180;
	return { s1: c + r, s2: c - r, deg };
}

// ============================================================================ text

/** A number for the page: at most `d` decimals, a real minus sign, no "−0". */
export function num(v: number, d = 2): string {
	const k = 10 ** d;
	const r = Math.round(v * k) / k;
	if (Object.is(r, -0) || r === 0) return '0';
	return String(r).replace('-', '−');
}

/** A shape as Python writes it: (), (4,), (3, 4). */
export const shapeText = (shape: readonly number[]) =>
	shape.length === 1 ? `(${shape[0]},)` : `(${shape.join(', ')})`;
