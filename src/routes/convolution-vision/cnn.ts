/**
 * The convolutional network of the convolution-vision explainer, and the image operations it is
 * made of, in plain TypeScript (no inference library).
 *
 * Architecture (a small LeNet-style network; LeCun, Bottou, Bengio & Haffner, "Gradient-based
 * learning applied to document recognition", Proc. IEEE 86, 2278–2324, 1998):
 *
 *   input            1 × 28 × 28   grey, ink = 1, paper = 0 (as MNIST)
 *   conv 1           8 filters of 5 × 5, zero padding of 2 ("same"), + bias   → 8 × 28 × 28
 *   ReLU, max pool   2 × 2, stride 2                                            → 8 × 14 × 14
 *   conv 2           16 filters of 5 × 5 × 8, "same", + bias                    → 16 × 14 × 14
 *   ReLU, max pool   2 × 2, stride 2                                            → 16 × 7 × 7
 *   dense            784 → 10, + bias, softmax                                  → 10 probabilities
 *
 * As in every deep-learning library, "convolution" here is cross-correlation: the kernel is not
 * flipped, out(y, x) = Σ w(dy, dx) · in(y + dy − p, x + dx − p). For learned kernels the
 * difference is only a convention.
 *
 * The weights are trained by `scripts/data/convolution-vision/train.mjs`, which also evaluates
 * the shipped weights with THIS file's `forward` on the 10 000 MNIST test digits. This file must
 * stay importable by Node as-is (erasable TypeScript only, no imports).
 *
 * `prepare` turns strokes drawn by the reader into an MNIST-like input, the way the MNIST digits
 * were made (LeCun, Cortes & Burges, http://yann.lecun.com/exdb/mnist/): the digit is scaled so
 * that its bounding box fits a 20 × 20 box, aspect ratio kept, anti-aliased, then placed in the
 * 28 × 28 image so that its centre of mass is at the centre.
 */

export const SIDE = 28;
export const K = 5;
export const C1 = 8;
export const C2 = 16;
export const CLASSES = 10;
export const P1 = SIDE / 2; // 14
export const P2 = SIDE / 4; // 7
export const FLAT = C2 * P2 * P2; // 784

export interface Weights {
	/** conv 1: [8][1][5][5] */
	c1w: Float32Array;
	c1b: Float32Array;
	/** conv 2: [16][8][5][5] */
	c2w: Float32Array;
	c2b: Float32Array;
	/** dense: [10][784], the input index being [channel][y][x] of the second pooled maps */
	dw: Float32Array;
	db: Float32Array;
}

/** Sizes of the weight tensors, in the order they are stored. */
export const SHAPES: [keyof Weights, number][] = [
	['c1w', C1 * K * K],
	['c1b', C1],
	['c2w', C2 * C1 * K * K],
	['c2b', C2],
	['dw', CLASSES * FLAT],
	['db', CLASSES]
];

export const PARAMS = SHAPES.reduce((n, [, s]) => n + s, 0);

/** Decodes the weights: little-endian float32, the tensors one after the other (`SHAPES`). */
export function decodeWeights(base64: string): Weights {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	const view = new DataView(bytes.buffer);
	if (bytes.length !== PARAMS * 4) throw new Error(`expected ${PARAMS * 4} bytes`);
	const out: Partial<Weights> = {};
	let o = 0;
	for (const [name, size] of SHAPES) {
		const a = new Float32Array(size);
		for (let i = 0; i < size; i++, o += 4) a[i] = view.getFloat32(o, true);
		out[name] = a;
	}
	return out as Weights;
}

/** Decodes 8-bit grey pixels (base64) to values 0–1. */
export function decodeBytes(base64: string): Uint8Array {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

// ------------------------------------------------------------------------- the operations

/**
 * Convolution with zero padding, output the same size as the input ("same"): `cout` maps of
 * h × w from `cin` maps, `k` × `k` kernels stored [cout][cin][k][k], plus one bias per output.
 */
export function conv2d(
	input: ArrayLike<number>,
	cin: number,
	h: number,
	w: number,
	kernel: ArrayLike<number>,
	bias: ArrayLike<number> | null,
	cout: number,
	k: number
): Float32Array {
	const p = (k - 1) >> 1;
	const out = new Float32Array(cout * h * w);
	for (let co = 0; co < cout; co++) {
		const b = bias ? bias[co] : 0;
		const o = co * h * w;
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				let s = b;
				for (let ci = 0; ci < cin; ci++) {
					const ib = ci * h * w;
					const kb = (co * cin + ci) * k * k;
					for (let dy = 0; dy < k; dy++) {
						const yy = y + dy - p;
						if (yy < 0 || yy >= h) continue;
						for (let dx = 0; dx < k; dx++) {
							const xx = x + dx - p;
							if (xx < 0 || xx >= w) continue;
							s += kernel[kb + dy * k + dx] * input[ib + yy * w + xx];
						}
					}
				}
				out[o + y * w + x] = s;
			}
	}
	return out;
}

/** max(0, v) for every value. */
export const relu = (a: Float32Array): Float32Array => a.map((v) => (v > 0 ? v : 0));

/** 2 × 2 max pooling with stride 2 of `c` maps of h × w (h and w even). */
export function maxPool(a: ArrayLike<number>, c: number, h: number, w: number): Float32Array {
	const h2 = h >> 1;
	const w2 = w >> 1;
	const out = new Float32Array(c * h2 * w2);
	for (let ch = 0; ch < c; ch++)
		for (let y = 0; y < h2; y++)
			for (let x = 0; x < w2; x++) {
				const i = ch * h * w + 2 * y * w + 2 * x;
				out[ch * h2 * w2 + y * w2 + x] = Math.max(a[i], a[i + 1], a[i + w], a[i + w + 1]);
			}
	return out;
}

/** Softmax: e^z / Σ e^z (shifted by the largest z, which changes nothing but avoids overflow). */
export function softmax(z: ArrayLike<number>): number[] {
	const m = Math.max(...Array.from(z));
	const e = Array.from(z, (v) => Math.exp(v - m));
	const s = e.reduce((a, b) => a + b, 0);
	return e.map((v) => v / s);
}

export interface Activations {
	input: ArrayLike<number>;
	/** first convolution, before the ReLU: 8 × 28 × 28 */
	conv1: Float32Array;
	relu1: Float32Array;
	/** 8 × 14 × 14 */
	pool1: Float32Array;
	/** second convolution, before the ReLU: 16 × 14 × 14 */
	conv2: Float32Array;
	relu2: Float32Array;
	/** 16 × 7 × 7 */
	pool2: Float32Array;
	/** the 10 scores before the softmax */
	logits: Float32Array;
	probs: number[];
	/** the most probable digit */
	digit: number;
}

/** Runs the network on a 28 × 28 input (values 0–1, ink = 1), keeping every layer's maps. */
export function forward(wt: Weights, input: ArrayLike<number>): Activations {
	const conv1 = conv2d(input, 1, SIDE, SIDE, wt.c1w, wt.c1b, C1, K);
	const relu1 = relu(conv1);
	const pool1 = maxPool(relu1, C1, SIDE, SIDE);
	const conv2 = conv2d(pool1, C1, P1, P1, wt.c2w, wt.c2b, C2, K);
	const relu2 = relu(conv2);
	const pool2 = maxPool(relu2, C2, P1, P1);
	const logits = new Float32Array(CLASSES);
	for (let j = 0; j < CLASSES; j++) {
		let s = wt.db[j];
		for (let i = 0; i < FLAT; i++) s += wt.dw[j * FLAT + i] * pool2[i];
		logits[j] = s;
	}
	const probs = softmax(logits);
	let digit = 0;
	for (let j = 1; j < CLASSES; j++) if (probs[j] > probs[digit]) digit = j;
	return { input, conv1, relu1, pool1, conv2, relu2, pool2, logits, probs, digit };
}

// ----------------------------------------------------------------------- drawn digits

export interface Pt {
	x: number;
	y: number;
}
/** A stroke: the pointer's path from press to release, in any unit (both axes the same). */
export type Stroke = Pt[];

/** Pen radius in pixels of the 28 × 28 image: strokes about 2.6 px wide, like MNIST's. */
export const PEN = 1.3;
/** The bounding box of the ink (pen included) is scaled to fit this square, as in MNIST. */
export const BOX = 20;

/** Squared distance from p to the segment ab. */
function dist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
	const vx = bx - ax;
	const vy = by - ay;
	const l2 = vx * vx + vy * vy;
	let u = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
	u = u < 0 ? 0 : u > 1 ? 1 : u;
	const dx = px - (ax + u * vx);
	const dy = py - (ay + u * vy);
	return dx * dx + dy * dy;
}

/**
 * Anti-aliased strokes on a 28 × 28 image: each pixel's value is the fraction of its 4 × 4
 * sub-samples within `PEN` of a stroke. `segs` are already in pixel units.
 */
function rasterise(segs: number[][]): Float32Array {
	const img = new Float32Array(SIDE * SIDE);
	const r2 = PEN * PEN;
	const S = 4;
	for (const [ax, ay, bx, by] of segs) {
		const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - PEN));
		const x1 = Math.min(SIDE - 1, Math.floor(Math.max(ax, bx) + PEN));
		const y0 = Math.max(0, Math.floor(Math.min(ay, by) - PEN));
		const y1 = Math.min(SIDE - 1, Math.floor(Math.max(ay, by) + PEN));
		for (let y = y0; y <= y1; y++)
			for (let x = x0; x <= x1; x++) {
				let n = 0;
				for (let sy = 0; sy < S; sy++)
					for (let sx = 0; sx < S; sx++)
						if (dist2(x + (sx + 0.5) / S, y + (sy + 0.5) / S, ax, ay, bx, by) <= r2) n++;
				// several segments overlap at joints: keep the largest coverage, not the sum
				const v = n / (S * S);
				if (v > img[y * SIDE + x]) img[y * SIDE + x] = v;
			}
	}
	return img;
}

/**
 * Turns strokes into the network's input, MNIST-style: the drawing is scaled so that its ink's
 * bounding box (pen width included) fits 20 × 20 with the aspect ratio kept, rasterised
 * anti-aliased with a pen of fixed width, and shifted so that the ink's centre of mass sits at
 * the centre of the 28 × 28 image. Where or how big the digit was drawn does not matter.
 * Returns null when there is nothing drawn.
 */
export function prepare(strokes: Stroke[]): Float32Array | null {
	const pts = strokes.flat();
	if (pts.length === 0) return null;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		maxX = Math.max(maxX, p.x);
		minY = Math.min(minY, p.y);
		maxY = Math.max(maxY, p.y);
	}
	const span = Math.max(maxX - minX, maxY - minY);
	// the centre line fills BOX − pen width; a lone dot stays a dot
	const s = span > 0 ? (BOX - 2 * PEN) / span : 0;
	const cx = (minX + maxX) / 2;
	const cy = (minY + maxY) / 2;
	const segsAt = (ox: number, oy: number) =>
		strokes.flatMap((st) => {
			const q = st.map((p) => [(p.x - cx) * s + ox, (p.y - cy) * s + oy]);
			if (q.length === 1) return [[q[0][0], q[0][1], q[0][0], q[0][1]]];
			return q.slice(1).map((b, i) => [q[i][0], q[i][1], b[0], b[1]]);
		});
	// first placement: the box centred; then move the centre of mass to the centre
	const first = rasterise(segsAt(SIDE / 2, SIDE / 2));
	let m = 0;
	let mx = 0;
	let my = 0;
	for (let y = 0; y < SIDE; y++)
		for (let x = 0; x < SIDE; x++) {
			const v = first[y * SIDE + x];
			m += v;
			mx += v * (x + 0.5);
			my += v * (y + 0.5);
		}
	if (m === 0) return first;
	return rasterise(segsAt(SIDE / 2 + (SIDE / 2 - mx / m), SIDE / 2 + (SIDE / 2 - my / m)));
}
