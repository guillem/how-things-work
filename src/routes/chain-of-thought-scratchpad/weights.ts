/**
 * The shipped weights are stored as half-precision floats (16 bits each), base64-encoded: half
 * the size of 32-bit floats. The accuracies the page quotes were measured with these rounded
 * weights, the ones the page runs.
 *
 * Kept free of TypeScript-only syntax that Node cannot strip (see `addition.ts`).
 */

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/** A half-precision float close to `v` (rounded through a 32-bit float), as its 16 bits. */
export function toHalf(v: number): number {
	f32[0] = v;
	const x = u32[0];
	const sign = (x >>> 16) & 0x8000;
	const exp = (x >>> 23) & 0xff;
	let mant = x & 0x7fffff;
	if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
	const e = exp - 127 + 15;
	if (e >= 0x1f) return sign | 0x7c00;
	if (e <= 0) {
		if (e < -10) return sign;
		mant |= 0x800000;
		const shift = 14 - e;
		let h = mant >>> shift;
		const rest = mant & ((1 << shift) - 1);
		const half = 1 << (shift - 1);
		if (rest > half || (rest === half && h & 1)) h++;
		return sign | h;
	}
	let h = (e << 10) | (mant >>> 13);
	const rest = mant & 0x1fff;
	if (rest > 0x1000 || (rest === 0x1000 && h & 1)) h++;
	return sign | h;
}

/** The value of a half-precision float given as its 16 bits. */
export function fromHalf(h: number): number {
	const sign = h & 0x8000 ? -1 : 1;
	const e = (h >>> 10) & 0x1f;
	const m = h & 0x3ff;
	if (e === 0) return sign * m * 2 ** -24;
	if (e === 0x1f) return m ? NaN : sign * Infinity;
	return sign * (1 + m / 1024) * 2 ** (e - 15);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Weights → base64 of their half-precision bits (little-endian). */
export function packWeights(w: ArrayLike<number>): string {
	const bytes = new Uint8Array(w.length * 2);
	for (let i = 0; i < w.length; i++) {
		const h = toHalf(w[i]);
		bytes[2 * i] = h & 0xff;
		bytes[2 * i + 1] = h >>> 8;
	}
	let s = '';
	for (let i = 0; i < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
		s += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
		s += i + 1 < bytes.length ? B64[(n >>> 6) & 63] : '=';
		s += i + 2 < bytes.length ? B64[n & 63] : '=';
	}
	return s;
}

/** The inverse of `packWeights`: the rounded weights as 64-bit floats. */
export function unpackWeights(s: string): Float64Array {
	const index = new Int16Array(128).fill(-1);
	for (let i = 0; i < 64; i++) index[B64.charCodeAt(i)] = i;
	const clean = s.replace(/=+$/, '');
	const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
	let j = 0;
	for (let i = 0; i < clean.length; i += 4) {
		const n =
			(index[clean.charCodeAt(i)] << 18) |
			(index[clean.charCodeAt(i + 1)] << 12) |
			(Math.max(0, index[clean.charCodeAt(i + 2)] ?? 0) << 6) |
			Math.max(0, index[clean.charCodeAt(i + 3)] ?? 0);
		if (j < bytes.length) bytes[j++] = (n >>> 16) & 0xff;
		if (j < bytes.length) bytes[j++] = (n >>> 8) & 0xff;
		if (j < bytes.length) bytes[j++] = n & 0xff;
	}
	const w = new Float64Array(bytes.length / 2);
	for (let i = 0; i < w.length; i++) w[i] = fromHalf(bytes[2 * i] | (bytes[2 * i + 1] << 8));
	return w;
}
