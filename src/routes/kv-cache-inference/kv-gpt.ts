/**
 * The tiny GPT of training-a-tiny-language-model, run one character at a time with a KV cache.
 *
 * `KvDecoder.step(token)` runs only the newest position through the model: its query, key and
 * value in every layer, attention of that one query over the keys and values kept from the
 * earlier positions (the cache), the MLP and the read-out. The arithmetic is the same as
 * `TinyGPT.forward` (the same kernels, in the same order), so a cached decode gives the very same
 * probabilities as recomputing every earlier position, as the model tests check.
 *
 * It also counts what each step does: multiply-adds, added up inside the kernels as they run,
 * and the bytes the step must read from memory (every weight it multiplies by once, and the
 * cache) or write (the new key and value). The page's model keeps its numbers in float64, so a
 * number is 8 bytes. Activations (a few hundred numbers per position) are not counted: on a GPU
 * they stay in fast on-chip memory.
 *
 * Without the cache, generating the character at position t means running all t + 1 positions
 * through the model again, as `TinyGPT.next` does (a batch of rows, each weight read once for all
 * of them). `recomputeCost` counts that by running a fresh decoder over the whole window.
 */
import { layout, type Config, type Layout } from '../training-a-tiny-language-model/tiny-gpt.ts';
import { rng } from '#lib/draw/math.ts';

export const BYTES = 8;

export interface Cost {
	/** Multiply-adds, each 2 floating-point operations. */
	macs: number;
	/** Bytes of weights read. */
	weightBytes: number;
	/** Bytes of cached keys and values read. */
	cacheBytes: number;
	/** Bytes of new keys and values written to the cache. */
	writeBytes: number;
}

export const flops = (c: Cost) => 2 * c.macs;
export const bytesMoved = (c: Cost) => c.weightBytes + c.cacheBytes + c.writeBytes;

const EPS = 1e-5;
const GELU_C = Math.sqrt(2 / Math.PI);

/** Weights multiplied by when one position goes through the model (embeddings are looked up). */
export function weightsUsed(L: Layout): number {
	let n = L.lnfg.size + L.lnfb.size + L.wout.size + L.bout.size;
	for (const s of L.layers)
		for (const slot of Object.values(s) as { size: number }[]) n += slot.size;
	return n;
}

export class KvDecoder {
	readonly config: Config;
	readonly L: Layout;
	readonly w: Float64Array;
	/** Per layer: the keys and the values of every position so far, position-major. */
	readonly keys: Float64Array[];
	readonly values: Float64Array[];
	/** Positions in the cache. */
	length = 0;
	/** What the last `step` did. */
	cost: Cost = { macs: 0, weightBytes: 0, cacheBytes: 0, writeBytes: 0 };
	readonly probs: Float64Array;
	private readonly x: Float64Array;
	private readonly ln: Float64Array;
	private readonly qkv: Float64Array;
	private readonly att: Float64Array;
	private readonly attout: Float64Array;
	private readonly x1: Float64Array;
	private readonly h: Float64Array;
	private readonly gh: Float64Array;

	constructor(config: Config, weights: Float64Array) {
		this.config = config;
		this.L = layout(config);
		if (weights.length !== this.L.total) throw new Error('weights do not fit the config');
		this.w = weights;
		const d = config.width;
		const f = (n: number) => new Float64Array(n);
		this.keys = Array.from({ length: config.layers }, () => f(config.context * d));
		this.values = Array.from({ length: config.layers }, () => f(config.context * d));
		this.probs = f(config.vocab);
		this.x = f(d);
		this.ln = f(d);
		this.qkv = f(3 * d);
		this.att = f(config.context);
		this.attout = f(d);
		this.x1 = f(d);
		this.h = f(4 * d);
		this.gh = f(4 * d);
	}

	reset() {
		this.length = 0;
	}

	private linear(out: Float64Array, x: Float64Array, wo: number, bo: number, I: number, O: number) {
		const w = this.w;
		for (let o = 0; o < O; o++) out[o] = w[bo + o];
		for (let i = 0; i < I; i++) {
			const xi = x[i];
			if (xi === 0) continue;
			const rw = wo + i * O;
			for (let o = 0; o < O; o++) out[o] += xi * w[rw + o];
		}
		this.cost.macs += I * O;
	}

	private layerNorm(out: Float64Array, x: Float64Array, go: number, bo: number) {
		const w = this.w;
		const D = this.config.width;
		let mean = 0;
		for (let i = 0; i < D; i++) mean += x[i];
		mean /= D;
		let v = 0;
		for (let i = 0; i < D; i++) {
			const e = x[i] - mean;
			v += e * e;
		}
		const s = 1 / Math.sqrt(v / D + EPS);
		for (let i = 0; i < D; i++) out[i] = (x[i] - mean) * s * w[go + i] + w[bo + i];
	}

	/**
	 * Runs the character `token` at the next position and returns the probabilities of the
	 * character after it. Throws when the context is full (positions are learnt, so a window
	 * cannot slide without recomputing everything).
	 */
	step(token: number): Float64Array {
		const c = this.config;
		const L = this.L;
		const w = this.w;
		const d = c.width;
		const H = c.heads;
		const hs = d / H;
		const scale = 1 / Math.sqrt(hs);
		const t = this.length;
		if (t >= c.context) throw new Error('context full');
		this.cost = {
			macs: 0,
			weightBytes: weightsUsed(L) * BYTES,
			cacheBytes: 2 * c.layers * t * d * BYTES,
			writeBytes: 2 * c.layers * d * BYTES
		};
		const x = this.x;
		const te = L.wte.offset + token * d;
		const pe = L.wpe.offset + t * d;
		for (let i = 0; i < d; i++) x[i] = w[te + i] + w[pe + i];
		for (let l = 0; l < c.layers; l++) {
			const s = L.layers[l];
			const K = this.keys[l];
			const V = this.values[l];
			this.layerNorm(this.ln, x, s.ln1g.offset, s.ln1b.offset);
			this.linear(this.qkv, this.ln, s.wqkv.offset, s.bqkv.offset, d, 3 * d);
			// the new key and value join the cache
			for (let i = 0; i < d; i++) {
				K[t * d + i] = this.qkv[d + i];
				V[t * d + i] = this.qkv[2 * d + i];
			}
			for (let h = 0; h < H; h++) {
				const qo = h * hs;
				let max = -Infinity;
				for (let j = 0; j <= t; j++) {
					const ko = j * d + h * hs;
					let sc = 0;
					for (let i = 0; i < hs; i++) sc += this.qkv[qo + i] * K[ko + i];
					sc *= scale;
					this.att[j] = sc;
					if (sc > max) max = sc;
				}
				let sum = 0;
				for (let j = 0; j <= t; j++) {
					const e = Math.exp(this.att[j] - max);
					this.att[j] = e;
					sum += e;
				}
				for (let i = 0; i < hs; i++) this.attout[qo + i] = 0;
				for (let j = 0; j <= t; j++) {
					const p = this.att[j] / sum;
					const vo = j * d + h * hs;
					for (let i = 0; i < hs; i++) this.attout[qo + i] += p * V[vo + i];
				}
				this.cost.macs += 2 * (t + 1) * hs;
			}
			this.linear(this.x1, this.attout, s.wo.offset, s.bo.offset, d, d);
			for (let i = 0; i < d; i++) this.x1[i] += x[i];
			this.layerNorm(this.ln, this.x1, s.ln2g.offset, s.ln2b.offset);
			this.linear(this.h, this.ln, s.w1.offset, s.b1.offset, d, 4 * d);
			for (let i = 0; i < 4 * d; i++) {
				const v = this.h[i];
				this.gh[i] = 0.5 * v * (1 + Math.tanh(GELU_C * (v + 0.044715 * v * v * v)));
			}
			this.linear(x, this.gh, s.w2.offset, s.b2.offset, 4 * d, d);
			for (let i = 0; i < d; i++) x[i] += this.x1[i];
		}
		this.layerNorm(this.ln, x, L.lnfg.offset, L.lnfb.offset);
		const P = this.probs;
		const Vn = c.vocab;
		this.linear(P, this.ln, L.wout.offset, L.bout.offset, d, Vn);
		let max = -Infinity;
		for (let v = 0; v < Vn; v++) if (P[v] > max) max = P[v];
		let sum = 0;
		for (let v = 0; v < Vn; v++) {
			const e = Math.exp(P[v] - max);
			P[v] = e;
			sum += e;
		}
		for (let v = 0; v < Vn; v++) P[v] /= sum;
		this.length = t + 1;
		return P;
	}
}

/**
 * What it costs to produce the probabilities after `tokens` without a cache: every position of
 * the window goes through the model again (counted by running a fresh decoder over them all),
 * with each weight read once for the whole batch of positions and nothing kept between steps.
 */
export function recomputeCost(dec: KvDecoder, tokens: ArrayLike<number>): Cost {
	dec.reset();
	let macs = 0;
	for (let i = 0; i < tokens.length; i++) {
		dec.step(tokens[i]);
		macs += dec.cost.macs;
	}
	return { macs, weightBytes: weightsUsed(dec.L) * BYTES, cacheBytes: 0, writeBytes: 0 };
}

/** Draws the index of a character from probabilities `p` with one uniform number `u`. */
export function draw(p: ArrayLike<number>, u: number): number {
	let pick = p.length - 1;
	for (let v = 0; v < p.length; v++) {
		u -= p[v];
		if (u < 0) {
			pick = v;
			break;
		}
	}
	return pick;
}

export interface Generated {
	/** Characters written after the prompt. */
	tokens: number[];
	/** Cost of producing each written character with the cache (the prompt's last included). */
	cached: Cost[];
}

/**
 * Writes characters after `prompt` with the cache until the context is full: the prompt goes in
 * one position at a time, then each drawn character is fed back. Draws come from `seed`, as in
 * `sample` of the training page (the same uniform number per character).
 */
export function generateCached(dec: KvDecoder, prompt: number[], seed: number): Generated {
	const random = rng(seed);
	dec.reset();
	let p: Float64Array = dec.probs;
	for (const tok of prompt) p = dec.step(tok);
	const tokens: number[] = [];
	const cached: Cost[] = [dec.cost];
	while (dec.length < dec.config.context) {
		const next = draw(p, random());
		tokens.push(next);
		p = dec.step(next);
		cached.push(dec.cost);
	}
	tokens.push(draw(p, random()));
	return { tokens, cached };
}
