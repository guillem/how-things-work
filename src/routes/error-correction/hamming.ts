/**
 * Error-correcting codes: the Hamming code, a single parity bit, and a noisy
 * channel to send text through.
 *
 * Hamming code. Bits are numbered from 1. The check (parity) bits sit at the
 * positions that are powers of two (1, 2, 4, 8…); the data bits fill the rest,
 * in order. Check bit k covers every position whose number has the binary
 * digit k set (check 1 covers 1, 3, 5, 7…; check 2 covers 2, 3, 6, 7…), and is
 * chosen so that the number of 1s among the positions it covers is even.
 * With r check bits the block is n = 2ʳ − 1 bits long and carries n − r data
 * bits: (7, 4), (15, 11), (31, 26)…
 *
 * Decoding: recompute every check. The checks that fail, read as a binary
 * number (check 4 fails, check 2 passes, check 1 fails → 101), are the
 * position of a single flipped bit — equivalently, the XOR of the positions of
 * all the 1s in the received block (the "syndrome"). 0 means every check
 * passes. The decoder flips that bit back. If two bits were flipped the
 * syndrome is not 0 but points at the wrong bit, and the decoder "repairs" a
 * correct bit: plain Hamming codes cannot tell one error from two. An extra
 * overall parity bit (the extended (8, 4) code, `decodeSecded`) can at least
 * detect the double error.
 *
 * Channel. A binary symmetric channel: every bit sent is flipped
 * independently with the same probability p. A fixed list of uniform random
 * numbers (from a seed) decides the flips: bit i is flipped if uᵢ < p, so
 * raising p only ever adds flips. Text is sent as 8-bit ASCII, most
 * significant bit first; with coding, each character is two 4-bit halves,
 * each sent as a 7-bit Hamming block.
 *
 * Simplifications: errors are independent (real channels often have bursts,
 * which real systems handle by interleaving); the coded and uncoded messages
 * face the same flip chance per bit even though the coded one sends 7/4 as
 * many bits (on a real link with a fixed power budget each coded bit would be
 * a little noisier).
 */

import { rng } from '#lib/draw/math.ts';

export type Bits = number[];

/** True if `pos` (1-based) is a check-bit position (a power of two). */
export const isCheck = (pos: number) => pos > 0 && (pos & (pos - 1)) === 0;

/** Block length of the Hamming code with r check bits. */
export const blockLength = (r: number) => 2 ** r - 1;
/** Number of data bits it carries. */
export const dataLength = (r: number) => 2 ** r - 1 - r;

/** Positions (1-based) covered by check bit `k` in a block of n bits. */
export function covered(k: number, n = 7) {
	const out: number[] = [];
	for (let p = 1; p <= n; p++) if (p & k) out.push(p);
	return out;
}

/** Data positions of an n-bit block, in order. */
export const dataPositions = (n = 7) =>
	Array.from({ length: n }, (_, i) => i + 1).filter((p) => !isCheck(p));

/** Check-bit positions of an n-bit block. */
export const checkPositions = (n = 7) => Array.from({ length: n }, (_, i) => i + 1).filter(isCheck);

/** Encodes data bits (length n − r for some r ≥ 2) into a Hamming block (index i = position i + 1). */
export function encode(data: Bits): Bits {
	let r = 2;
	while (dataLength(r) < data.length) r++;
	if (dataLength(r) !== data.length) throw new Error(`no Hamming code carries ${data.length} bits`);
	const n = blockLength(r);
	const word = new Array<number>(n).fill(0);
	dataPositions(n).forEach((p, i) => (word[p - 1] = data[i] & 1));
	for (const k of checkPositions(n)) {
		let s = 0;
		for (const p of covered(k, n)) if (p !== k) s ^= word[p - 1];
		word[k - 1] = s;
	}
	return word;
}

/** Whether check k passes (an even number of 1s among the positions it covers). */
export const checkPasses = (word: Bits, k: number) =>
	covered(k, word.length).reduce((s, p) => s ^ word[p - 1], 0) === 0;

/** The syndrome: XOR of the positions of all 1s, i.e. the failing checks read as a binary number. */
export function syndrome(word: Bits) {
	let s = 0;
	word.forEach((b, i) => {
		if (b) s ^= i + 1;
	});
	return s;
}

export const extractData = (word: Bits) => dataPositions(word.length).map((p) => word[p - 1]);

export interface Decoded {
	/** 0 if every check passed, else the position the decoder flips back. */
	position: number;
	corrected: Bits;
	data: Bits;
}

export function decode(word: Bits): Decoded {
	const position = syndrome(word);
	const corrected = word.slice();
	if (position > 0 && position <= word.length) corrected[position - 1] ^= 1;
	return { position, corrected, data: extractData(corrected) };
}

/** XOR of two equal-length bit lists. */
export const xor = (a: Bits, b: Bits) => a.map((x, i) => x ^ (b[i] ?? 0));
export const weight = (a: Bits) => a.reduce((s, b) => s + b, 0);
export const distance = (a: Bits, b: Bits) => weight(xor(a, b));

/** All 4-bit data words, most significant first. */
export const nibbles = () =>
	Array.from({ length: 16 }, (_, v) => [3, 2, 1, 0].map((i) => (v >> i) & 1));

// ------------------------------------------------------------- a single parity bit

/** Even parity: the bit that makes the number of 1s even. */
export const parityBit = (data: Bits) => data.reduce((s, b) => s ^ b, 0);
/** Data followed by its parity bit. */
export const withParity = (data: Bits) => [...data, parityBit(data)];
/** True if the block still has an even number of 1s. */
export const parityOk = (word: Bits) => parityBit(word) === 0;

// ------------------------------------------------------ extended Hamming (SECDED)

/** The (8, 4) code: the (7, 4) block followed by an overall parity bit. */
export const encodeSecded = (data: Bits) => withParity(encode(data));

export type SecdedStatus = 'ok' | 'corrected' | 'double';

/** Corrects one error, detects (without correcting) two. */
export function decodeSecded(word: Bits): { status: SecdedStatus; data: Bits | null } {
	const block = word.slice(0, 7);
	const s = syndrome(block);
	const overallOk = parityOk(word);
	if (s === 0 && overallOk) return { status: 'ok', data: extractData(block) };
	if (!overallOk) {
		// an odd number of flips: assume one, in the block (s ≠ 0) or in the overall bit (s = 0)
		return { status: 'corrected', data: decode(block).data };
	}
	return { status: 'double', data: null };
}

// ------------------------------------------------------------------- the channel

/** `n` uniform random numbers in [0, 1) from `seed`: the channel's fixed dice. */
export function dice(n: number, seed: number) {
	const next = rng(seed);
	return Array.from({ length: n }, () => next());
}

/** Which of the bits are flipped at flip probability p. */
export const flipsFor = (u: number[], p: number) => u.map((x) => (x < p ? 1 : 0));

export const charToBits = (c: string) => {
	const v = c.charCodeAt(0) & 0xff;
	return Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1);
};
export const bitsToChar = (b: Bits) => String.fromCharCode(b.reduce((v, x) => (v << 1) | x, 0));
export const textToBits = (s: string) => [...s].flatMap(charToBits);

export interface Transmission {
	/** The text as received (after decoding, with coding). */
	text: string;
	/** Per character: did it arrive intact? */
	intact: boolean[];
	/** Number of bits sent over the channel. */
	sent: number;
	/** Indices (into the bits sent) of the flipped bits. */
	flips: number[];
	/** With coding: flipped bits in blocks the decoder repaired (one flip). */
	repaired: number[];
	/** With coding: flipped bits in blocks with two or more flips (decoded wrongly). */
	failed: number[];
}

/** Sends text uncoded: 8 bits per character, each flipped if its die is below p. */
export function sendPlain(text: string, p: number, seed: number): Transmission {
	const bits = textToBits(text);
	const flip = flipsFor(dice(bits.length, seed), p);
	const got = xor(bits, flip);
	const chars = [...text].map((_, i) => bitsToChar(got.slice(i * 8, i * 8 + 8)));
	const flips = flip.flatMap((f, i) => (f ? [i] : []));
	return {
		text: chars.join(''),
		intact: chars.map((c, i) => c === text[i]),
		sent: bits.length,
		flips,
		repaired: [],
		failed: []
	};
}

/** Sends text with the (7, 4) Hamming code: two 7-bit blocks per character. */
export function sendCoded(text: string, p: number, seed: number): Transmission {
	const data = textToBits(text);
	const blocks: Bits[] = [];
	for (let i = 0; i < data.length; i += 4) blocks.push(encode(data.slice(i, i + 4)));
	const u = dice(blocks.length * 7, seed);
	const flips: number[] = [];
	const repaired: number[] = [];
	const failed: number[] = [];
	const out: number[] = [];
	blocks.forEach((b, j) => {
		const flip = flipsFor(u.slice(j * 7, j * 7 + 7), p);
		const idx = flip.flatMap((f, i) => (f ? [j * 7 + i] : []));
		flips.push(...idx);
		(idx.length === 1 ? repaired : failed).push(...(idx.length ? idx : []));
		out.push(...decode(xor(b, flip)).data);
	});
	const chars = [...text].map((_, i) => bitsToChar(out.slice(i * 8, i * 8 + 8)));
	return {
		text: chars.join(''),
		intact: chars.map((c, i) => c === text[i]),
		sent: blocks.length * 7,
		flips,
		repaired,
		failed
	};
}

// ------------------------------------------------------------------ the odds

/** Chance that n bits all arrive unflipped. */
export const allIntact = (p: number, n: number) => (1 - p) ** n;
/** Chance that a Hamming block of n bits has at most one flip (and so decodes correctly). */
export const blockOk = (p: number, n = 7) => (1 - p) ** n + n * p * (1 - p) ** (n - 1);
/** Chance an 8-bit character arrives intact without coding. */
export const charOkPlain = (p: number) => allIntact(p, 8);
/** Chance an 8-bit character (two (7, 4) blocks) arrives intact with coding. */
export const charOkCoded = (p: number) => blockOk(p, 7) ** 2;
