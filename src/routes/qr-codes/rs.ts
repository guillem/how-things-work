/**
 * Reed-Solomon codes over GF(256), as QR codes use them (ISO/IEC 18004): the field built on the
 * polynomial x⁸ + x⁴ + x³ + x² + 1 (0x11D) with generator α = 2, and the generator polynomial
 * (x − α⁰)(x − α¹)…(x − αⁿ⁻¹). `rsEncode` computes a block's error-correction codewords;
 * `rsDecode` finds and repairs up to ⌊n/2⌋ wrong codewords (Berlekamp-Massey, Chien search and
 * Forney's formula), or reports that it can't.
 *
 * A block is a list of codewords, the first being the coefficient of the highest power.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
	let x = 1;
	for (let i = 0; i < 255; i++) {
		EXP[i] = x;
		LOG[x] = i;
		x <<= 1;
		if (x & 0x100) x ^= 0x11d;
	}
	for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export function gfMul(a: number, b: number): number {
	return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function gfDiv(a: number, b: number): number {
	if (b === 0) throw new Error('division by zero in GF(256)');
	return a === 0 ? 0 : EXP[(LOG[a] + 255 - LOG[b]) % 255];
}

/** α to the power n (n may be negative). */
export function gfPow2(n: number): number {
	return EXP[((n % 255) + 255) % 255];
}

/** Generator polynomial of degree n, highest power first (leading 1). */
export function generator(n: number): number[] {
	let g = [1];
	for (let i = 0; i < n; i++) {
		const next = new Array<number>(g.length + 1).fill(0);
		for (let j = 0; j < g.length; j++) {
			next[j] ^= g[j];
			next[j + 1] ^= gfMul(g[j], gfPow2(i));
		}
		g = next;
	}
	return g;
}

/** The n error-correction codewords of a block of data codewords: the remainder of data·xⁿ ÷ g. */
export function rsEncode(data: readonly number[], n: number): number[] {
	const g = generator(n);
	const rem = new Array<number>(n).fill(0);
	for (const d of data) {
		const factor = d ^ rem[0];
		rem.shift();
		rem.push(0);
		for (let j = 0; j < n; j++) rem[j] ^= gfMul(g[j + 1], factor);
	}
	return rem;
}

/** Evaluates a polynomial (highest power first) at x. */
function evalHigh(p: readonly number[], x: number): number {
	let y = 0;
	for (const c of p) y = gfMul(y, x) ^ c;
	return y;
}

/** Evaluates a polynomial given lowest power first at x. */
function evalLow(p: readonly number[], x: number): number {
	let y = 0;
	for (let i = p.length - 1; i >= 0; i--) y = gfMul(y, x) ^ p[i];
	return y;
}

export interface RsResult {
	/** The repaired block, or null when there were too many errors to repair. */
	block: number[] | null;
	/** How many codewords were repaired (when it worked). */
	fixed: number;
}

/**
 * Repairs a received block (data + n error-correction codewords). Works when at most ⌊n/2⌋
 * codewords are wrong; with more, it usually notices and returns null (and, rarely, "repairs" the
 * block into a different valid one, as any real decoder can).
 */
export function rsDecode(received: readonly number[], n: number): RsResult {
	const len = received.length;
	// Syndromes S_i = r(αⁱ), i = 0..n−1.
	const S: number[] = [];
	let clean = true;
	for (let i = 0; i < n; i++) {
		const s = evalHigh(received, gfPow2(i));
		S.push(s);
		if (s !== 0) clean = false;
	}
	if (clean) return { block: [...received], fixed: 0 };

	// Berlekamp-Massey: the error locator Λ(x), lowest power first.
	const C = [1];
	let B = [1];
	let L = 0;
	let m = 1;
	let b = 1;
	for (let k = 0; k < n; k++) {
		let d = S[k];
		for (let i = 1; i <= L; i++) d ^= gfMul(C[i] ?? 0, S[k - i]);
		if (d === 0) {
			m++;
			continue;
		}
		const coef = gfDiv(d, b);
		const T = [...C];
		const need = B.length + m;
		while (C.length < need) C.push(0);
		for (let i = 0; i < B.length; i++) C[i + m] ^= gfMul(coef, B[i]);
		if (2 * L <= k) {
			L = k + 1 - L;
			B = T;
			b = d;
			m = 1;
		} else m++;
	}
	while (C.length > 1 && C[C.length - 1] === 0) C.pop();
	const degree = C.length - 1;
	if (degree !== L || L > Math.floor(n / 2)) return { block: null, fixed: 0 };

	// Chien search: position k (0 = first codeword) has locator X = α^(len−1−k); Λ(X⁻¹) = 0.
	const positions: number[] = [];
	for (let k = 0; k < len; k++) {
		if (evalLow(C, gfPow2(-(len - 1 - k))) === 0) positions.push(k);
	}
	if (positions.length !== L) return { block: null, fixed: 0 };

	// Forney: Ω(x) = S(x)Λ(x) mod x^n; error value e = X · Ω(X⁻¹) / Λ'(X⁻¹) (first root α⁰).
	const omega = new Array<number>(n).fill(0);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j <= Math.min(i, degree); j++) omega[i] ^= gfMul(S[i - j], C[j]);
	}
	// Formal derivative of Λ: odd powers survive (characteristic 2).
	const dC: number[] = [];
	for (let i = 1; i < C.length; i++) dC.push(i % 2 === 1 ? C[i] : 0);
	const out = [...received];
	for (const k of positions) {
		const X = gfPow2(len - 1 - k);
		const Xinv = gfPow2(-(len - 1 - k));
		const den = evalLow(dC, Xinv);
		if (den === 0) return { block: null, fixed: 0 };
		out[k] ^= gfMul(X, gfDiv(evalLow(omega, Xinv), den));
	}
	// Check: a repaired block has all syndromes zero.
	for (let i = 0; i < n; i++) if (evalHigh(out, gfPow2(i)) !== 0) return { block: null, fixed: 0 };
	return { block: out, fixed: positions.length };
}
