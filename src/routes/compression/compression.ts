/**
 * The model behind the compression explainer: information measured as surprise (Shannon),
 * Huffman coding of a message, and the lossy core of baseline JPEG on grey (luminance)
 * images: 8 × 8 DCT, quantisation and the run-length + Huffman size of what is left.
 *
 * Sources:
 * - C. E. Shannon, "A Mathematical Theory of Communication", Bell System Technical Journal 27
 *   (1948): surprisal −log₂ p and entropy H = Σ p·log₂(1/p); no lossless code of single
 *   symbols has an average length below H.
 * - D. A. Huffman, "A Method for the Construction of Minimum-Redundancy Codes", Proc. IRE 40
 *   (1952): repeatedly merge the two least frequent nodes. The average length L of a Huffman
 *   code satisfies H ≤ L < H + 1 (Cover & Thomas, Elements of Information Theory, 2nd ed.,
 *   theorem 5.4.1 and section 5.8).
 * - ITU-T Recommendation T.81 (1992) | ISO/IEC 10918-1, "Digital compression and coding of
 *   continuous-tone still images" (baseline JPEG): level shift by 128 and the 8 × 8 forward
 *   DCT (A.3.3), zigzag order (figure A.6), the example luminance quantisation table
 *   (Annex K, table K.1; Annex K tables are informative examples, not mandatory), DC
 *   difference and AC run/size coding (F.1.2.1 and F.1.2.2).
 * - Independent JPEG Group, libjpeg `jcparam.c` (`jpeg_quality_scaling`,
 *   `jpeg_add_quant_table`): the 1–100 "quality" setting. It is IJG's convention, used by most
 *   encoders, not part of the standard.
 */

// ===================================================================================== text

export interface SymbolStat {
	/** The symbol (one Unicode code point). */
	symbol: string;
	count: number;
	/** Probability: count / message length. */
	p: number;
	/** Surprisal in bits: −log₂ p. */
	bits: number;
}

/** The symbols of a message: one per Unicode code point, not per UTF-16 unit. */
export const symbolsOf = (msg: string): string[] => [...msg];

/**
 * Counts each distinct symbol of the message, most frequent first (ties: first appearance
 * first), with its probability and surprisal.
 */
export function symbolStats(msg: string): SymbolStat[] {
	const syms = symbolsOf(msg);
	const counts = new Map<string, number>();
	for (const s of syms) counts.set(s, (counts.get(s) ?? 0) + 1);
	const order = [...counts.keys()];
	const n = syms.length;
	return order
		.map((symbol, i) => ({ symbol, i, count: counts.get(symbol) ?? 0 }))
		.sort((a, b) => b.count - a.count || a.i - b.i)
		.map(({ symbol, count }) => ({ symbol, count, p: count / n, bits: -Math.log2(count / n) }));
}

/** Surprisal of an event of probability p, in bits. */
export const surprisal = (p: number): number => -Math.log2(p);

/** Shannon entropy in bits per symbol of a set of probabilities (terms with p = 0 add 0). */
export const entropy = (ps: number[]): number =>
	ps.reduce((h, p) => (p > 0 ? h + p * Math.log2(1 / p) : h), 0);

/** Entropy of a message's own symbol frequencies, in bits per symbol. */
export const messageEntropy = (msg: string): number => entropy(symbolStats(msg).map((s) => s.p));

/** The message's size as UTF-8 text, in bits (8 per byte; é takes 2 bytes, most emoji 4). */
export const utf8Bits = (msg: string): number => new TextEncoder().encode(msg).length * 8;

/** Bits per symbol of the shortest fixed-length code for k distinct symbols: ⌈log₂ k⌉ (≥ 1). */
export const fixedBits = (k: number): number => (k <= 1 ? 1 : Math.ceil(Math.log2(k)));

// ===================================================================================== Huffman

export interface HuffNode {
	id: number;
	weight: number;
	/** Leaf symbol, or undefined for an internal node. */
	symbol?: string;
	/** Children of an internal node: [bit 0, bit 1]. */
	children?: [number, number];
}

export interface Huffman {
	/** All nodes: the leaves first (in order of first appearance), then one per merge. */
	nodes: HuffNode[];
	/** Merge k joins merges[k][0] (bit 0) and merges[k][1] (bit 1) into node leaves + k. */
	merges: [number, number][];
	/** Id of the root, or −1 for an empty message. */
	root: number;
	/** Code word of each symbol, as a string of 0s and 1s. */
	codes: Map<string, string>;
}

/**
 * Builds a Huffman code from symbol counts given in a fixed order (that order breaks ties).
 * At each step the two lightest nodes are merged; between equal weights the older node (lower
 * id) goes first, so the result is deterministic. The first node taken gets bit 0.
 * A message with a single distinct symbol gets the one-bit code "0" (a code needs at least
 * one bit per symbol).
 */
export function huffman(weights: { symbol: string; count: number }[]): Huffman {
	const nodes: HuffNode[] = weights.map((w, id) => ({ id, weight: w.count, symbol: w.symbol }));
	const merges: [number, number][] = [];
	const pool = nodes.map((n) => n.id);
	const take = () => {
		let best = 0;
		for (let i = 1; i < pool.length; i++) {
			const a = nodes[pool[i]];
			const b = nodes[pool[best]];
			if (a.weight < b.weight || (a.weight === b.weight && a.id < b.id)) best = i;
		}
		return pool.splice(best, 1)[0];
	};
	while (pool.length > 1) {
		const a = take();
		const b = take();
		const id = nodes.length;
		nodes.push({ id, weight: nodes[a].weight + nodes[b].weight, children: [a, b] });
		merges.push([a, b]);
		pool.push(id);
	}
	const root = nodes.length ? nodes.length - 1 : -1;
	const codes = new Map<string, string>();
	const walk = (id: number, code: string) => {
		const node = nodes[id];
		if (node.children) {
			walk(node.children[0], code + '0');
			walk(node.children[1], code + '1');
		} else if (node.symbol !== undefined) codes.set(node.symbol, code || '0');
	};
	if (root >= 0) walk(root, '');
	return { nodes, merges, root, codes };
}

/** Huffman code for a message, built from its own symbol counts (in order of first appearance). */
export function huffmanFor(msg: string): Huffman {
	const counts = new Map<string, number>();
	for (const s of symbolsOf(msg)) counts.set(s, (counts.get(s) ?? 0) + 1);
	return huffman([...counts].map(([symbol, count]) => ({ symbol, count })));
}

/** The message as one string of bits, each symbol replaced by its code word. */
export const encode = (msg: string, h: Huffman): string =>
	symbolsOf(msg)
		.map((s) => h.codes.get(s) ?? '')
		.join('');

/**
 * Reads a bit string back with the tree: walk down from the root, 0 left and 1 right, and
 * emit a symbol on reaching a leaf. Works because no code word is the start of another.
 */
export function decode(bits: string, h: Huffman): string {
	if (h.root < 0) return '';
	const root = h.nodes[h.root];
	if (!root.children) return root.symbol!.repeat(bits.length);
	let out = '';
	let id = h.root;
	for (const b of bits) {
		id = h.nodes[id].children![b === '1' ? 1 : 0];
		const node = h.nodes[id];
		if (!node.children) {
			out += node.symbol;
			id = h.root;
		}
	}
	return out;
}

/** Total bits of a set of counts under a code: Σ count × code length. */
export function codedBits(weights: { symbol: string; count: number }[], h: Huffman): number {
	return weights.reduce((s, w) => s + w.count * (h.codes.get(w.symbol)?.length ?? 0), 0);
}

/** Kraft sum Σ 2^(−length) of a code; 1 for a complete prefix code such as Huffman's. */
export const kraftSum = (h: Huffman): number =>
	[...h.codes.values()].reduce((s, c) => s + 2 ** -c.length, 0);

/** Height of each node above the leaves (leaves 0, a merge 1 + its taller child). */
export function heights(h: Huffman): number[] {
	const out = h.nodes.map(() => 0);
	for (const node of h.nodes)
		if (node.children) out[node.id] = 1 + Math.max(out[node.children[0]], out[node.children[1]]);
	return out;
}

/** The leaves in the order a drawing of the tree puts them, left to right (bit 0 on the left). */
export function leafOrder(h: Huffman): number[] {
	const out: number[] = [];
	const walk = (id: number) => {
		const node = h.nodes[id];
		if (node.children) {
			walk(node.children[0]);
			walk(node.children[1]);
		} else out.push(id);
	};
	if (h.root >= 0) walk(h.root);
	return out;
}

// ===================================================================================== JPEG

export const N = 8;

/**
 * Example luminance quantisation table, ITU-T T.81 Annex K, table K.1 (row by row, the top
 * left is the DC term). Large numbers where the eye is least sensitive: fine, fast-changing
 * detail towards the bottom right.
 */
export const LUMA_Q: readonly number[] = [
	16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56,
	14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113,
	92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99
];

/**
 * The quantisation table for a quality of 1–100, as libjpeg does it (`jcparam.c`): a scale of
 * 5000/q % below 50 and 200 − 2q % from 50 up (integer arithmetic), applied to table K.1 with
 * rounding, then kept within 1–255 (baseline JPEG stores 8-bit entries). Quality 50 gives
 * table K.1 itself; quality 100 gives all 1s.
 */
export function qualityTable(quality: number): number[] {
	const q = Math.min(100, Math.max(1, Math.round(quality)));
	const scale = q < 50 ? Math.floor(5000 / q) : 200 - q * 2;
	return LUMA_Q.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
}

/** Zigzag order (T.81 figure A.6): zigzag position k → row-major index in the 8 × 8 block. */
export const ZIGZAG: readonly number[] = (() => {
	const out: number[] = [];
	for (let s = 0; s < 2 * N - 1; s++) {
		const cells: number[] = [];
		for (let r = 0; r < N; r++) {
			const c = s - r;
			if (c >= 0 && c < N) cells.push(r * N + c);
		}
		// Even diagonals run up and to the right (bottom-left first), odd ones down and left.
		out.push(...(s % 2 === 0 ? cells.reverse() : cells));
	}
	return out;
})();

const COS: number[][] = Array.from({ length: N }, (_, x) =>
	Array.from({ length: N }, (_, u) => Math.cos(((2 * x + 1) * u * Math.PI) / 16))
);
const C = (u: number) => (u === 0 ? Math.SQRT1_2 : 1);

/**
 * Forward DCT of an 8 × 8 block of pixel values 0–255, row-major (T.81 A.3.3, after the level
 * shift by 128): F(v,u) = ¼ C(u) C(v) Σ Σ (f(y,x) − 128) cos((2x+1)uπ/16) cos((2y+1)vπ/16),
 * C(0) = 1/√2, else 1. Index v·8 + u: u is the horizontal frequency, v the vertical one.
 */
export function dct(block: ArrayLike<number>): number[] {
	const out = new Array<number>(N * N).fill(0);
	for (let v = 0; v < N; v++)
		for (let u = 0; u < N; u++) {
			let s = 0;
			for (let y = 0; y < N; y++)
				for (let x = 0; x < N; x++) s += (block[y * N + x] - 128) * COS[x][u] * COS[y][v];
			out[v * N + u] = 0.25 * C(u) * C(v) * s;
		}
	return out;
}

/** Inverse DCT (T.81 A.3.3) back to pixel values, level shift undone (not rounded or clamped). */
export function idct(coef: ArrayLike<number>): number[] {
	const out = new Array<number>(N * N).fill(0);
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			let s = 0;
			for (let v = 0; v < N; v++)
				for (let u = 0; u < N; u++) s += C(u) * C(v) * coef[v * N + u] * COS[x][u] * COS[y][v];
			out[y * N + x] = 0.25 * s + 128;
		}
	return out;
}

/** The pattern of one DCT basis function (frequency u across, v down), values −1…1. */
export function basis(u: number, v: number): number[] {
	return Array.from({ length: N * N }, (_, i) => COS[i % N][u] * COS[Math.floor(i / N)][v]);
}

/** Quantises DCT coefficients: divide by the table entry and round to the nearest whole number. */
export const quantise = (coef: ArrayLike<number>, table: ArrayLike<number>): number[] =>
	Array.from(coef, (c, i) => Math.round(c / table[i]));

/** Undoes quantisation (as a decoder does): multiply back. The rounding error stays. */
export const dequantise = (q: ArrayLike<number>, table: ArrayLike<number>): number[] =>
	Array.from(q, (c, i) => c * table[i]);

/** Pixels 0–255 rounded and clamped, as a decoder outputs them. */
const toPixel = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

/** A grey image: width × height pixel values 0–255, row-major. */
export interface Grey {
	width: number;
	height: number;
	data: Uint8Array;
}

/** The 8 × 8 block at block column bx, block row by. */
export function blockAt(img: Grey, bx: number, by: number): number[] {
	const out: number[] = [];
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) out.push(img.data[(by * N + y) * img.width + bx * N + x]);
	return out;
}

/** SSSS of T.81 F.1.2.1: the number of bits needed for the magnitude of a value (0 for 0). */
export const category = (v: number): number =>
	v === 0 ? 0 : Math.floor(Math.log2(Math.abs(v))) + 1;

export interface JpegResult {
	/** The decoded image. */
	image: Grey;
	/** Quantised coefficients of each block (row-major within the block), blocks row by row. */
	blocks: number[][];
	/** Non-zero quantised coefficients over the whole image, and the total. */
	kept: number;
	total: number;
	/** Size of the coded coefficients in bits (see `jpegBits`). */
	bits: number;
}

/**
 * Compresses and decompresses a grey image whose sides are multiples of 8: DCT, quantisation
 * with the table for `quality`, then back. Also measures the coded size of the coefficients.
 */
export function jpeg(img: Grey, quality: number): JpegResult {
	const table = qualityTable(quality);
	const bw = img.width / N;
	const bh = img.height / N;
	const out = new Uint8Array(img.width * img.height);
	const blocks: number[][] = [];
	let kept = 0;
	for (let by = 0; by < bh; by++)
		for (let bx = 0; bx < bw; bx++) {
			const q = quantise(dct(blockAt(img, bx, by)), table);
			blocks.push(q);
			kept += q.filter((c) => c !== 0).length;
			const px = idct(dequantise(q, table));
			for (let y = 0; y < N; y++)
				for (let x = 0; x < N; x++)
					out[(by * N + y) * img.width + bx * N + x] = toPixel(px[y * N + x]);
		}
	return {
		image: { width: img.width, height: img.height, data: out },
		blocks,
		kept,
		total: img.width * img.height,
		bits: jpegBits(blocks)
	};
}

/**
 * The size in bits of quantised blocks after baseline JPEG's entropy coding (T.81 F.1.2): each
 * DC term is coded as the difference from the previous block's, as a category (SSSS) symbol
 * plus SSSS extra bits; the AC terms are read in zigzag order as (run of zeros, category)
 * symbols plus extra bits, with ZRL for 16 zeros and EOB once only zeros are left. The symbols
 * are Huffman-coded with tables built for this image (as libjpeg's "optimize" option does), one
 * for DC and one for AC. Headers and the tables themselves are not counted; the 16-bit limit
 * on code length (it never binds at these sizes) and the reserved all-ones code word are ignored.
 */
export function jpegBits(blocks: number[][]): number {
	const dc = new Map<string, number>();
	const ac = new Map<string, number>();
	const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
	let extra = 0;
	let prev = 0;
	for (const q of blocks) {
		const diff = q[0] - prev;
		prev = q[0];
		const s = category(diff);
		bump(dc, String(s));
		extra += s;
		let run = 0;
		let last = 0;
		for (let k = 1; k < N * N; k++) if (q[ZIGZAG[k]] !== 0) last = k;
		for (let k = 1; k <= last; k++) {
			const v = q[ZIGZAG[k]];
			if (v === 0) {
				run++;
				continue;
			}
			while (run > 15) {
				bump(ac, 'ZRL');
				run -= 16;
			}
			const c = category(v);
			bump(ac, `${run}/${c}`);
			extra += c;
			run = 0;
		}
		if (last < N * N - 1) bump(ac, 'EOB');
	}
	const size = (m: Map<string, number>) => {
		const w = [...m].map(([symbol, count]) => ({ symbol, count }));
		return w.length ? codedBits(w, huffman(w)) : 0;
	};
	return size(dc) + size(ac) + extra;
}

/** Peak signal-to-noise ratio in dB for 8-bit images: 10·log₁₀(255² / mean squared error). */
export function psnr(a: Grey, b: Grey): number {
	let se = 0;
	for (let i = 0; i < a.data.length; i++) se += (a.data[i] - b.data[i]) ** 2;
	const mse = se / a.data.length;
	return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

// ===================================================================================== images

/** A small seeded random generator (mulberry32), so the images are the same on every visit. */
function rng(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Smooth value noise on a grid of the given cell size (seeded), values 0–1. */
function valueNoise(w: number, h: number, cell: number, seed: number): Float64Array {
	const r = rng(seed);
	const gw = Math.ceil(w / cell) + 2;
	const gh = Math.ceil(h / cell) + 2;
	const grid = Array.from({ length: gw * gh }, () => r());
	const s = (x: number) => x * x * (3 - 2 * x);
	const out = new Float64Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const gx = x / cell;
			const gy = y / cell;
			const ix = Math.floor(gx);
			const iy = Math.floor(gy);
			const fx = s(gx - ix);
			const fy = s(gy - iy);
			const at = (i: number, j: number) => grid[(iy + j) * gw + ix + i];
			const top = at(0, 0) + (at(1, 0) - at(0, 0)) * fx;
			const bot = at(0, 1) + (at(1, 1) - at(0, 1)) * fx;
			out[y * w + x] = top + (bot - top) * fy;
		}
	return out;
}

export const SIZE = 96;

export type ImageId = 'landscape' | 'drawing' | 'noise';

/**
 * The three test images, all generated here from code (no photograph or outside artwork, so no
 * licence applies), 96 × 96 grey pixels:
 * - landscape: a sky that darkens upwards, a sun, two rolling hills and a field with a seeded
 *   texture: mostly smooth, which JPEG handles well;
 * - drawing: black lines, a ring and stripes on white: sharp edges, where JPEG's damage shows
 *   first (ringing);
 * - noise: every pixel random (seeded): nothing to predict, so little to save.
 */
export function makeImage(id: ImageId): Grey {
	const w = SIZE;
	const h = SIZE;
	const data = new Uint8Array(w * h);
	if (id === 'noise') {
		const r = rng(7);
		for (let i = 0; i < data.length; i++) data[i] = Math.floor(r() * 256);
	} else if (id === 'drawing') {
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				let v = 245;
				// a ring centred at (30, 32), radii 13–19
				const d = Math.hypot(x - 30, y - 32);
				if (d >= 13 && d <= 19) v = 20;
				// a filled square
				if (x >= 58 && x < 86 && y >= 12 && y < 40) v = 70;
				// a diagonal line, 3 px thick, in the lower left
				if (Math.abs(x - (y - 48)) < 1.6 && y >= 54 && y < 90) v = 20;
				// vertical stripes, 2 px wide, in the lower right
				if (x >= 56 && x < 88 && y >= 56 && y < 86 && Math.floor(x / 2) % 2 === 0) v = 30;
				data[y * w + x] = v;
			}
	} else {
		const tex = valueNoise(w, h, 3, 11);
		const soft = valueNoise(w, h, 16, 5);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				// sky: brighter towards the horizon
				let v = 120 + (y / h) * 140;
				// sun
				const ds = Math.hypot(x - 68, y - 24);
				if (ds < 10) v = 250;
				else if (ds < 16) v = Math.max(v, 250 - (ds - 10) * 8);
				// far hill, then near hill
				const far = 52 + 8 * Math.sin(x / 11) + 4 * Math.sin(x / 5 + 1);
				const near = 66 + 6 * Math.sin(x / 17 + 2);
				if (y > far) v = 110 + 30 * soft[y * w + x];
				if (y > near) v = 60 + 50 * tex[y * w + x] + 20 * soft[y * w + x];
				data[y * w + x] = Math.round(Math.min(255, Math.max(0, v)));
			}
	}
	return { width: w, height: h, data };
}

/**
 * A colour picture (RGBA bytes, as a canvas gives them) as grey: the brightness JPEG keeps,
 * Y = 0.299 R + 0.587 G + 0.114 B (the JFIF definition), rounded to 0–255.
 */
export function lumaOf(width: number, height: number, rgba: ArrayLike<number>): Grey {
	const data = new Uint8Array(width * height);
	for (let i = 0; i < data.length; i++)
		data[i] = Math.round(
			Math.min(255, 0.299 * rgba[4 * i] + 0.587 * rgba[4 * i + 1] + 0.114 * rgba[4 * i + 2])
		);
	return { width, height, data };
}

// ===================================================================================== drawing

/**
 * A grey image as an uncompressed 8-bit BMP data URL (a grey palette), so the stage can show
 * thousands of pixels as one `<image>` instead of one shape each.
 */
export function bmpDataUrl(img: Grey): string {
	const row = Math.ceil(img.width / 4) * 4;
	const pixels = row * img.height;
	const offset = 14 + 40 + 256 * 4;
	const buf = new Uint8Array(offset + pixels);
	const dv = new DataView(buf.buffer);
	buf[0] = 0x42; // 'B'
	buf[1] = 0x4d; // 'M'
	dv.setUint32(2, buf.length, true);
	dv.setUint32(10, offset, true);
	dv.setUint32(14, 40, true);
	dv.setInt32(18, img.width, true);
	dv.setInt32(22, -img.height, true); // negative: top row first
	dv.setUint16(26, 1, true);
	dv.setUint16(28, 8, true);
	dv.setUint32(34, pixels, true);
	dv.setUint32(46, 256, true);
	for (let i = 0; i < 256; i++) {
		buf[54 + i * 4] = i;
		buf[55 + i * 4] = i;
		buf[56 + i * 4] = i;
	}
	for (let y = 0; y < img.height; y++)
		buf.set(img.data.subarray(y * img.width, (y + 1) * img.width), offset + y * row);
	let bin = '';
	for (let i = 0; i < buf.length; i += 0x8000)
		bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return 'data:image/bmp;base64,' + btoa(bin);
}
