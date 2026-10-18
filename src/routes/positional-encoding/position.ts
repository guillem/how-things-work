/**
 * The positional-encoding explainer's model: exact mathematics, no data.
 *
 * - Attention (one head, softmax(q·kᵀ / √d) v) on a few token vectors, with or without the causal
 *   mask, to show that without the mask it cannot see the order of its input.
 * - The sinusoidal encoding of Vaswani et al. (2017), "Attention is all you need", §3.5:
 *   PE(pos, 2i) = sin(pos · ωᵢ), PE(pos, 2i + 1) = cos(pos · ωᵢ), ωᵢ = 10000^(−2i/d).
 *   It is added to the token's embedding.
 * - Rotary position embedding, RoPE, of Su et al. (2021), "RoFormer", §3.4: each pair of
 *   dimensions (2i, 2i + 1) of a query or key at position m is rotated by the angle m · θᵢ, with
 *   θᵢ = 10000^(−2i/d), the same frequencies. Values and embeddings are left alone.
 *
 * The token vectors and weight matrices of the toy examples are drawn at random once, from a
 * fixed seed: the properties the page shows hold for any vectors (the Node tests check them on
 * many random ones).
 */

export const BASE = 10000;

// ------------------------------------------------------------------------------- vectors

export type Vec = number[];
export type Mat = number[][];

export const dot = (a: readonly number[], b: readonly number[]) => {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
};
export const add = (a: readonly number[], b: readonly number[]) => a.map((x, i) => x + b[i]);
/** M · v, for M given as rows. */
export const apply = (m: Mat, v: readonly number[]) => m.map((row) => dot(row, v));

/** A small seeded generator (mulberry32), so the toy vectors are the same on every visit. */
export function random(seed: number) {
	let s = seed >>> 0;
	const uniform = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let r = Math.imul(s ^ (s >>> 15), 1 | s);
		r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
		return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
	};
	/** A standard normal number (Box–Muller). */
	const normal = () => {
		const u = 1 - uniform();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
	};
	const vector = (d: number, scale = 1) => Array.from({ length: d }, () => normal() * scale);
	const matrix = (d: number, scale = 1) => Array.from({ length: d }, () => vector(d, scale));
	return { uniform, normal, vector, matrix };
}

// ------------------------------------------------------------------------------- attention

export interface Head {
	wq: Mat;
	wk: Mat;
	wv: Mat;
}

export function softmax(scores: readonly number[]): number[] {
	const m = Math.max(...scores);
	const e = scores.map((s) => Math.exp(s - m));
	const sum = e.reduce((a, b) => a + b, 0);
	return e.map((x) => x / sum);
}

/**
 * One attention head over the token vectors `xs`: every token's output is the average of all the
 * values, weighted by softmax(q·k / √d). With `causal`, token i only sees tokens 0…i.
 */
export function attention(xs: readonly Vec[], head: Head, causal = false) {
	const d = head.wq.length;
	const q = xs.map((x) => apply(head.wq, x));
	const k = xs.map((x) => apply(head.wk, x));
	const v = xs.map((x) => apply(head.wv, x));
	const weights = q.map((qi, i) => {
		const seen = causal ? i + 1 : xs.length;
		const w = softmax(k.slice(0, seen).map((kj) => dot(qi, kj) / Math.sqrt(d)));
		return xs.map((_, j) => (j < seen ? w[j] : 0));
	});
	const out = weights.map((w) => v[0].map((_, c) => w.reduce((s, wj, j) => s + wj * v[j][c], 0)));
	return { weights, out };
}

// ------------------------------------------------------------------------------- frequencies

/** ωᵢ = base^(−2i/d) for the d/2 pairs: one turn every 2π/ωᵢ positions. */
export const frequencies = (d: number, base = BASE) =>
	Array.from({ length: d / 2 }, (_, i) => base ** ((-2 * i) / d));

/** The number of positions after which pair i's angle has gone once round: 2π/ωᵢ. */
export const wavelengths = (d: number, base = BASE) =>
	frequencies(d, base).map((w) => (2 * Math.PI) / w);

// ------------------------------------------------------------------------------- sinusoids

/** The sinusoidal encoding of a position: (sin pos·ωᵢ, cos pos·ωᵢ) for each pair i. */
export function sinusoid(pos: number, d: number, base = BASE): Vec {
	const out: Vec = [];
	for (const w of frequencies(d, base)) out.push(Math.sin(pos * w), Math.cos(pos * w));
	return out;
}

/**
 * The linear map that moves any position's encoding k places on: in each pair it is the rotation
 * by k·ωᵢ (in the pair's (sin, cos) coordinates, [[cos, sin], [−sin, cos]]). It is built from k
 * and the frequencies alone, never from the position it is applied to.
 */
export function offsetMap(k: number, d: number, base = BASE): Mat {
	const m: Mat = Array.from({ length: d }, () => Array<number>(d).fill(0));
	frequencies(d, base).forEach((w, i) => {
		const c = Math.cos(k * w);
		const s = Math.sin(k * w);
		m[2 * i][2 * i] = c;
		m[2 * i][2 * i + 1] = s;
		m[2 * i + 1][2 * i] = -s;
		m[2 * i + 1][2 * i + 1] = c;
	});
	return m;
}

// ------------------------------------------------------------------------------- RoPE

/** Turns each pair (v₂ᵢ, v₂ᵢ₊₁) of `v` by the angle anglesᵢ (counter-clockwise). */
export function rotatePairs(v: readonly number[], angles: readonly number[]): Vec {
	const out: Vec = [];
	angles.forEach((a, i) => {
		const x = v[2 * i];
		const y = v[2 * i + 1];
		out.push(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
	});
	return out;
}

/** RoPE: a query or key at position `pos`, each pair turned by pos·θᵢ. */
export const rope = (v: readonly number[], pos: number, base = BASE) =>
	rotatePairs(
		v,
		frequencies(v.length, base).map((w) => pos * w)
	);

/** Each pair's share of q·k (before the 1/√d), so the shares add up to the dot product. */
export const pairShares = (q: readonly number[], k: readonly number[]) =>
	Array.from({ length: q.length / 2 }, (_, i) => q[2 * i] * k[2 * i] + q[2 * i + 1] * k[2 * i + 1]);

// ------------------------------------------------------------------------------- a toy layer

/**
 * One query token and one key token, with their embeddings and one head's weights: the score of
 * the query at position m for the key at position n, with each scheme. Same vectors, same
 * weights; only the way position enters differs.
 */
export function pairOf(d: number, seed: number) {
	const r = random(seed);
	const xq = r.vector(d);
	const xk = r.vector(d);
	const wq = r.matrix(d, 1 / Math.sqrt(d));
	const wk = r.matrix(d, 1 / Math.sqrt(d));
	const q = apply(wq, xq);
	const k = apply(wk, xk);
	const scale = 1 / Math.sqrt(d);
	return {
		d,
		q,
		k,
		/** RoPE: rotate the query by m·θ and the key by n·θ, then q·k / √d. */
		rope: (m: number, n: number) => dot(rope(q, m), rope(k, n)) * scale,
		/** Added sinusoids: the encoding is added to each embedding before the weights. */
		sinusoid: (m: number, n: number) =>
			dot(apply(wq, add(xq, sinusoid(m, d))), apply(wk, add(xk, sinusoid(n, d)))) * scale,
		/** No position at all: the same score wherever the two tokens stand. */
		plain: () => dot(q, k) * scale
	};
}

/** The pair the RoPE scenes show: 16 dimensions, 8 pairs. */
export const D = 16;
export const PAIR = pairOf(D, 4);

/** The training length the scenes mark (positions 0 … L − 1). */
export const TRAIN = 64;

/**
 * How far each pair turns while the position runs from 0 to L − 1: (L − 1)·ωᵢ radians. A pair
 * whose angle stays under one turn (2π) has only met part of its circle in training.
 */
export const sweep = (L: number, d: number, base = BASE) =>
	frequencies(d, base).map((w) => (L - 1) * w);

/** The pairs that never complete a turn over positions 0 … L − 1. */
export const unfinished = (L: number, d: number, base = BASE) =>
	sweep(L, d, base).filter((a) => a < 2 * Math.PI).length;

/**
 * Does pair i of position `pos` point outside the arc it swept over positions 0 … L − 1? (Never,
 * for a pair that completed a turn; for the others, its angle taken round the circle.)
 */
export function outsideTraining(pos: number, i: number, L: number, d: number, base = BASE) {
	const swept = sweep(L, d, base)[i];
	if (swept >= 2 * Math.PI) return false;
	const a = (pos * frequencies(d, base)[i]) % (2 * Math.PI);
	return a > swept;
}

// ------------------------------------------------------------------------------- the sentence

/** The sentence the first chapter shuffles; repeated words get the same vector. */
export const WORDS = ['the', 'dog', 'bit', 'the', 'man'];
const vocab = [...new Set(WORDS)];
const toy = random(5);
const embedding = new Map(vocab.map((w) => [w, toy.vector(6)]));
/** The head of the shuffle demo: 6 dimensions, sharp enough to make the outputs differ. */
export const HEAD: Head = {
	wq: toy.matrix(6, 0.5),
	wk: toy.matrix(6, 0.5),
	wv: toy.matrix(6, 0.6)
};
export const embed = (w: string) => embedding.get(w) ?? Array<number>(6).fill(0);

/**
 * The order shown after `n` presses of "Shuffle": 0 is the sentence as written, 1 swaps dog and
 * man, after that a fixed pseudo-random shuffle per press. `order[p]` is the index in `WORDS` of
 * the word now at place p.
 */
export function order(n: number): number[] {
	const ids = WORDS.map((_, i) => i);
	if (n <= 0) return ids;
	if (n === 1) return [0, 4, 2, 3, 1];
	const r = random(1000 + n);
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(r.uniform() * (i + 1));
		[ids[i], ids[j]] = [ids[j], ids[i]];
	}
	return ids;
}
