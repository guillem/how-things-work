/**
 * A tiny character-level GPT, written out by hand so that it can train in a browser tab and in
 * Node with the same code: token and position embeddings, `LAYERS` pre-LN transformer blocks
 * (multi-head causal self-attention, then a GELU MLP four times as wide, each added back to the
 * residual stream), a final layer norm and a linear read-out to one score per character. It is
 * nanoGPT's model (Karpathy, MIT) at a few tens of thousands of weights instead of ten million,
 * without dropout and with an untied read-out.
 *
 * Training: the loss is the mean cross-entropy (in nats) of the next character over every
 * position of a batch of windows of the training text; the gradient is computed by an explicit
 * backward pass (checked against finite differences in the model tests) and applied by AdamW
 * with warm-up, cosine decay and gradient clipping, as nanoGPT does.
 *
 * Everything is deterministic: the weights, the batches and the samples come from seeded
 * mulberry32 generators (`rng` in `#lib/draw/math.ts`), and the arithmetic is float64, so the
 * same seed gives the same run in the page's Web Worker and in the offline script that built
 * `runs.ts` (both run on V8).
 *
 * Kept free of TypeScript-only syntax that Node cannot strip (no enums, no parameter
 * properties), so `scripts/data/training-a-tiny-language-model/build.ts` imports it directly.
 */
import { rng } from '#lib/draw/math.ts';

export const LAYERS = 2;

export interface Config {
	/** Characters in the alphabet. */
	vocab: number;
	/** Width of the residual stream (the embedding size). */
	width: number;
	/** Context length: the most characters the model can look back over. */
	context: number;
	/** Attention heads per block (the width must divide by it). */
	heads: number;
	layers: number;
}

/** One named weight tensor: a slice of the flat parameter vector. */
interface Slot {
	name: string;
	offset: number;
	size: number;
	/** A matrix (decayed by AdamW) rather than a bias or a layer-norm gain. */
	matrix: boolean;
}

interface LayerSlots {
	ln1g: Slot;
	ln1b: Slot;
	wqkv: Slot;
	bqkv: Slot;
	wo: Slot;
	bo: Slot;
	ln2g: Slot;
	ln2b: Slot;
	w1: Slot;
	b1: Slot;
	w2: Slot;
	b2: Slot;
}

export interface Layout {
	wte: Slot;
	wpe: Slot;
	layers: LayerSlots[];
	lnfg: Slot;
	lnfb: Slot;
	wout: Slot;
	bout: Slot;
	slots: Slot[];
	total: number;
}

/** Where every weight lives in the flat parameter vector. */
export function layout(c: Config): Layout {
	const slots: Slot[] = [];
	let offset = 0;
	const add = (name: string, size: number, matrix: boolean): Slot => {
		const s = { name, offset, size, matrix };
		offset += size;
		slots.push(s);
		return s;
	};
	const d = c.width;
	const wte = add('wte', c.vocab * d, true);
	const wpe = add('wpe', c.context * d, true);
	const layers: LayerSlots[] = [];
	for (let l = 0; l < c.layers; l++) {
		layers.push({
			ln1g: add(`h${l}.ln1.g`, d, false),
			ln1b: add(`h${l}.ln1.b`, d, false),
			wqkv: add(`h${l}.attn.wqkv`, d * 3 * d, true),
			bqkv: add(`h${l}.attn.bqkv`, 3 * d, false),
			wo: add(`h${l}.attn.wo`, d * d, true),
			bo: add(`h${l}.attn.bo`, d, false),
			ln2g: add(`h${l}.ln2.g`, d, false),
			ln2b: add(`h${l}.ln2.b`, d, false),
			w1: add(`h${l}.mlp.w1`, d * 4 * d, true),
			b1: add(`h${l}.mlp.b1`, 4 * d, false),
			w2: add(`h${l}.mlp.w2`, 4 * d * d, true),
			b2: add(`h${l}.mlp.b2`, d, false)
		});
	}
	const lnfg = add('lnf.g', d, false);
	const lnfb = add('lnf.b', d, false);
	const wout = add('wout', d * c.vocab, true);
	const bout = add('bout', c.vocab, false);
	return { wte, wpe, layers, lnfg, lnfb, wout, bout, slots, total: offset };
}

/** Number of weights of a configuration. */
export const countWeights = (c: Config) => layout(c).total;

/** A standard normal number from a uniform generator (Box–Muller). */
function gaussian(random: () => number) {
	const u = 1 - random();
	const v = random();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Fresh weights, nanoGPT's way: matrices and embeddings from N(0, 0.02²), the two projections
 * that write into the residual stream scaled down by √(2 × layers), biases 0, gains 1.
 */
export function initWeights(c: Config, seed: number): Float64Array {
	const L = layout(c);
	const w = new Float64Array(L.total);
	const random = rng(seed);
	const fill = (s: Slot, std: number) => {
		for (let i = 0; i < s.size; i++) w[s.offset + i] = std * gaussian(random);
	};
	const ones = (s: Slot) => w.fill(1, s.offset, s.offset + s.size);
	const std = 0.02;
	fill(L.wte, std);
	fill(L.wpe, std);
	for (const ls of L.layers) {
		ones(ls.ln1g);
		fill(ls.wqkv, std);
		fill(ls.wo, std / Math.sqrt(2 * c.layers));
		ones(ls.ln2g);
		fill(ls.w1, std);
		fill(ls.w2, std / Math.sqrt(2 * c.layers));
	}
	ones(L.lnfg);
	fill(L.wout, std);
	return w;
}

// ----------------------------------------------------------------------------- kernels

/** out[n, :] = b + x[n, :] · W, for n < N (x is N × I, W is I × O). */
function linear(
	out: Float64Array,
	x: Float64Array,
	w: Float64Array,
	wo: number,
	bo: number,
	N: number,
	I: number,
	O: number
) {
	for (let n = 0; n < N; n++) {
		const ro = n * O;
		for (let o = 0; o < O; o++) out[ro + o] = w[bo + o];
		const rx = n * I;
		for (let i = 0; i < I; i++) {
			const xi = x[rx + i];
			if (xi === 0) continue;
			const rw = wo + i * O;
			for (let o = 0; o < O; o++) out[ro + o] += xi * w[rw + o];
		}
	}
}

/**
 * Backward of `linear`: adds x ᵀ · dout to dW and the column sums of dout to db, and writes
 * dout · Wᵀ to dx (when given).
 */
function linearBack(
	dx: Float64Array | null,
	g: Float64Array,
	dout: Float64Array,
	x: Float64Array,
	w: Float64Array,
	wo: number,
	bo: number,
	N: number,
	I: number,
	O: number
) {
	for (let n = 0; n < N; n++) {
		const rd = n * O;
		for (let o = 0; o < O; o++) g[bo + o] += dout[rd + o];
		const rx = n * I;
		for (let i = 0; i < I; i++) {
			const xi = x[rx + i];
			const rw = wo + i * O;
			let s = 0;
			for (let o = 0; o < O; o++) {
				const d = dout[rd + o];
				g[rw + o] += xi * d;
				s += d * w[rw + o];
			}
			if (dx) dx[rx + i] = s;
		}
	}
}

const EPS = 1e-5;

/** Layer norm of each row: out = (x − mean) / √(var + ε) · g + b; keeps x̂ and 1/σ. */
function layerNorm(
	out: Float64Array,
	xhat: Float64Array,
	rstd: Float64Array,
	x: Float64Array,
	w: Float64Array,
	go: number,
	bo: number,
	N: number,
	D: number
) {
	for (let n = 0; n < N; n++) {
		const r = n * D;
		let mean = 0;
		for (let i = 0; i < D; i++) mean += x[r + i];
		mean /= D;
		let v = 0;
		for (let i = 0; i < D; i++) {
			const e = x[r + i] - mean;
			v += e * e;
		}
		const s = 1 / Math.sqrt(v / D + EPS);
		rstd[n] = s;
		for (let i = 0; i < D; i++) {
			const h = (x[r + i] - mean) * s;
			xhat[r + i] = h;
			out[r + i] = h * w[go + i] + w[bo + i];
		}
	}
}

/** Backward of `layerNorm`: adds to the gain and bias gradients, ADDS dx into `dx`. */
function layerNormBack(
	dx: Float64Array,
	g: Float64Array,
	dout: Float64Array,
	xhat: Float64Array,
	rstd: Float64Array,
	w: Float64Array,
	go: number,
	bo: number,
	N: number,
	D: number
) {
	for (let n = 0; n < N; n++) {
		const r = n * D;
		let m1 = 0;
		let m2 = 0;
		for (let i = 0; i < D; i++) {
			const d = dout[r + i];
			g[go + i] += d * xhat[r + i];
			g[bo + i] += d;
			const dh = d * w[go + i];
			m1 += dh;
			m2 += dh * xhat[r + i];
		}
		m1 /= D;
		m2 /= D;
		const s = rstd[n];
		for (let i = 0; i < D; i++) {
			const dh = dout[r + i] * w[go + i];
			dx[r + i] += s * (dh - m1 - xhat[r + i] * m2);
		}
	}
}

const GELU_C = Math.sqrt(2 / Math.PI);

/** GELU, tanh form (GPT-2's): ½x(1 + tanh(√(2/π)(x + 0.044715x³))). */
function gelu(out: Float64Array, x: Float64Array, n: number) {
	for (let i = 0; i < n; i++) {
		const v = x[i];
		out[i] = 0.5 * v * (1 + Math.tanh(GELU_C * (v + 0.044715 * v * v * v)));
	}
}

function geluBack(dx: Float64Array, dout: Float64Array, x: Float64Array, n: number) {
	for (let i = 0; i < n; i++) {
		const v = x[i];
		const th = Math.tanh(GELU_C * (v + 0.044715 * v * v * v));
		const dth = (1 - th * th) * GELU_C * (1 + 3 * 0.044715 * v * v);
		dx[i] = dout[i] * (0.5 * (1 + th) + 0.5 * v * dth);
	}
}

// ----------------------------------------------------------------------------- the model

interface LayerActs {
	/** The residual stream entering the block. */
	x: Float64Array;
	ln1: Float64Array;
	ln1hat: Float64Array;
	ln1r: Float64Array;
	qkv: Float64Array;
	/** Attention weights, B × H × T × T (row t uses columns ≤ t). */
	att: Float64Array;
	attout: Float64Array;
	/** The stream after attention has been added. */
	x1: Float64Array;
	ln2: Float64Array;
	ln2hat: Float64Array;
	ln2r: Float64Array;
	h: Float64Array;
	gh: Float64Array;
}

/**
 * The model with working buffers for batches of up to `batch` windows of `context` characters.
 * `weights` is the flat parameter vector (shared, not copied).
 */
export class TinyGPT {
	readonly config: Config;
	readonly L: Layout;
	weights: Float64Array;
	readonly grads: Float64Array;
	readonly batch: number;
	private readonly acts: LayerActs[];
	private readonly xf: Float64Array;
	private readonly lnf: Float64Array;
	private readonly lnfhat: Float64Array;
	private readonly lnfr: Float64Array;
	/** Scores, then probabilities, N × vocab. */
	readonly logits: Float64Array;
	// scratch for the backward pass
	private readonly dx: Float64Array;
	private readonly dA: Float64Array;
	private readonly dB: Float64Array;
	private readonly dqkv: Float64Array;
	private readonly dH: Float64Array;
	private readonly dlogits: Float64Array;
	private B = 0;
	private T = 0;

	constructor(config: Config, weights: Float64Array, batch: number) {
		if (config.width % config.heads !== 0) throw new Error('width must divide by heads');
		this.config = config;
		this.L = layout(config);
		if (weights.length !== this.L.total) throw new Error('weights do not fit the config');
		this.weights = weights;
		this.grads = new Float64Array(this.L.total);
		this.batch = batch;
		const N = batch * config.context;
		const d = config.width;
		const T = config.context;
		const f = (n: number) => new Float64Array(n);
		this.acts = [];
		for (let l = 0; l < config.layers; l++) {
			this.acts.push({
				x: f(N * d),
				ln1: f(N * d),
				ln1hat: f(N * d),
				ln1r: f(N),
				qkv: f(N * 3 * d),
				att: f(batch * config.heads * T * T),
				attout: f(N * d),
				x1: f(N * d),
				ln2: f(N * d),
				ln2hat: f(N * d),
				ln2r: f(N),
				h: f(N * 4 * d),
				gh: f(N * 4 * d)
			});
		}
		this.xf = f(N * d);
		this.lnf = f(N * d);
		this.lnfhat = f(N * d);
		this.lnfr = f(N);
		this.logits = f(N * config.vocab);
		this.dx = f(N * d);
		this.dA = f(N * 4 * d);
		this.dB = f(N * 4 * d);
		this.dqkv = f(N * 3 * d);
		this.dH = f(N * 4 * d);
		this.dlogits = f(N * config.vocab);
	}

	/**
	 * Runs `B` windows of `T` characters (row-major in `tokens`) through the model, leaving the
	 * probabilities of the next character at every position in `logits`.
	 */
	forward(tokens: ArrayLike<number>, B: number, T: number) {
		const c = this.config;
		if (B > this.batch || T > c.context) throw new Error('batch too large');
		this.B = B;
		this.T = T;
		const w = this.weights;
		const L = this.L;
		const d = c.width;
		const N = B * T;
		const H = c.heads;
		const hs = d / H;
		const scale = 1 / Math.sqrt(hs);
		const V = c.vocab;
		const Tc = c.context;
		// embeddings
		let x = this.acts[0].x;
		for (let b = 0; b < B; b++)
			for (let t = 0; t < T; t++) {
				const n = b * T + t;
				const te = L.wte.offset + tokens[n] * d;
				const pe = L.wpe.offset + t * d;
				for (let i = 0; i < d; i++) x[n * d + i] = w[te + i] + w[pe + i];
			}
		for (let l = 0; l < c.layers; l++) {
			const a = this.acts[l];
			const s = L.layers[l];
			if (a.x !== x) a.x.set(x.subarray(0, N * d));
			layerNorm(a.ln1, a.ln1hat, a.ln1r, a.x, w, s.ln1g.offset, s.ln1b.offset, N, d);
			linear(a.qkv, a.ln1, w, s.wqkv.offset, s.bqkv.offset, N, d, 3 * d);
			// causal self-attention, head by head
			const q3 = 3 * d;
			for (let b = 0; b < B; b++)
				for (let h = 0; h < H; h++) {
					const ab = (b * H + h) * Tc * Tc;
					for (let t = 0; t < T; t++) {
						const qo = (b * T + t) * q3 + h * hs;
						const row = ab + t * Tc;
						let max = -Infinity;
						for (let j = 0; j <= t; j++) {
							const ko = (b * T + j) * q3 + d + h * hs;
							let sc = 0;
							for (let i = 0; i < hs; i++) sc += a.qkv[qo + i] * a.qkv[ko + i];
							sc *= scale;
							a.att[row + j] = sc;
							if (sc > max) max = sc;
						}
						let sum = 0;
						for (let j = 0; j <= t; j++) {
							const e = Math.exp(a.att[row + j] - max);
							a.att[row + j] = e;
							sum += e;
						}
						const oo = (b * T + t) * d + h * hs;
						for (let i = 0; i < hs; i++) a.attout[oo + i] = 0;
						for (let j = 0; j <= t; j++) {
							const p = a.att[row + j] / sum;
							a.att[row + j] = p;
							const vo = (b * T + j) * q3 + 2 * d + h * hs;
							for (let i = 0; i < hs; i++) a.attout[oo + i] += p * a.qkv[vo + i];
						}
					}
				}
			// x1 = x + attout · Wo + bo
			linear(a.x1, a.attout, w, s.wo.offset, s.bo.offset, N, d, d);
			for (let i = 0; i < N * d; i++) a.x1[i] += a.x[i];
			layerNorm(a.ln2, a.ln2hat, a.ln2r, a.x1, w, s.ln2g.offset, s.ln2b.offset, N, d);
			linear(a.h, a.ln2, w, s.w1.offset, s.b1.offset, N, d, 4 * d);
			gelu(a.gh, a.h, N * 4 * d);
			const next = l + 1 < c.layers ? this.acts[l + 1].x : this.xf;
			linear(next, a.gh, w, s.w2.offset, s.b2.offset, N, 4 * d, d);
			for (let i = 0; i < N * d; i++) next[i] += a.x1[i];
			x = next;
		}
		layerNorm(this.lnf, this.lnfhat, this.lnfr, this.xf, w, L.lnfg.offset, L.lnfb.offset, N, d);
		linear(this.logits, this.lnf, w, L.wout.offset, L.bout.offset, N, d, V);
		// softmax
		for (let n = 0; n < N; n++) {
			const r = n * V;
			let max = -Infinity;
			for (let v = 0; v < V; v++) if (this.logits[r + v] > max) max = this.logits[r + v];
			let sum = 0;
			for (let v = 0; v < V; v++) {
				const e = Math.exp(this.logits[r + v] - max);
				this.logits[r + v] = e;
				sum += e;
			}
			for (let v = 0; v < V; v++) this.logits[r + v] /= sum;
		}
	}

	/** Mean cross-entropy (nats) of `targets` under the last forward pass. */
	loss(targets: ArrayLike<number>) {
		const N = this.B * this.T;
		const V = this.config.vocab;
		let s = 0;
		for (let n = 0; n < N; n++) s -= Math.log(this.logits[n * V + targets[n]]);
		return s / N;
	}

	/** Gradient of `loss(targets)` with respect to every weight, written to `grads`. */
	backward(tokens: ArrayLike<number>, targets: ArrayLike<number>) {
		const c = this.config;
		const w = this.weights;
		const g = this.grads;
		const L = this.L;
		const B = this.B;
		const T = this.T;
		const d = c.width;
		const N = B * T;
		const V = c.vocab;
		const H = c.heads;
		const hs = d / H;
		const scale = 1 / Math.sqrt(hs);
		const Tc = c.context;
		g.fill(0);
		const dl = this.dlogits;
		for (let n = 0; n < N; n++) {
			const r = n * V;
			for (let v = 0; v < V; v++) dl[r + v] = this.logits[r + v] / N;
			dl[r + targets[n]] -= 1 / N;
		}
		// read-out and final layer norm
		const dLn = this.dA;
		linearBack(dLn, g, dl, this.lnf, w, L.wout.offset, L.bout.offset, N, d, V);
		const dx = this.dx; // gradient of the residual stream, carried down
		dx.fill(0, 0, N * d);
		layerNormBack(dx, g, dLn, this.lnfhat, this.lnfr, w, L.lnfg.offset, L.lnfb.offset, N, d);
		for (let l = c.layers - 1; l >= 0; l--) {
			const a = this.acts[l];
			const s = L.layers[l];
			// MLP branch: dx flows to x1 directly and through w2 · gelu · w1 · ln2
			const dgh = this.dH;
			linearBack(dgh, g, dx, a.gh, w, s.w2.offset, s.b2.offset, N, 4 * d, d);
			const dh = this.dB;
			geluBack(dh, dgh, a.h, N * 4 * d);
			const dln2 = this.dA;
			linearBack(dln2, g, dh, a.ln2, w, s.w1.offset, s.b1.offset, N, d, 4 * d);
			layerNormBack(dx, g, dln2, a.ln2hat, a.ln2r, w, s.ln2g.offset, s.ln2b.offset, N, d);
			// attention branch
			const dattout = this.dA;
			linearBack(dattout, g, dx, a.attout, w, s.wo.offset, s.bo.offset, N, d, d);
			const dqkv = this.dqkv;
			dqkv.fill(0, 0, N * 3 * d);
			const q3 = 3 * d;
			for (let b = 0; b < B; b++)
				for (let h = 0; h < H; h++) {
					const ab = (b * H + h) * Tc * Tc;
					for (let t = 0; t < T; t++) {
						const row = ab + t * Tc;
						const oo = (b * T + t) * d + h * hs;
						const qo = (b * T + t) * q3 + h * hs;
						// d(att_j) = dout_t · v_j, and dv_j += att_j dout_t
						let dot = 0;
						const datt = this.dB; // reuse as a T-long scratch row
						for (let j = 0; j <= t; j++) {
							const vo = (b * T + j) * q3 + 2 * d + h * hs;
							const p = a.att[row + j];
							let s2 = 0;
							for (let i = 0; i < hs; i++) {
								s2 += dattout[oo + i] * a.qkv[vo + i];
								dqkv[vo + i] += p * dattout[oo + i];
							}
							datt[j] = s2;
							dot += p * s2;
						}
						for (let j = 0; j <= t; j++) {
							const ds = a.att[row + j] * (datt[j] - dot) * scale;
							if (ds === 0) continue;
							const ko = (b * T + j) * q3 + d + h * hs;
							for (let i = 0; i < hs; i++) {
								dqkv[qo + i] += ds * a.qkv[ko + i];
								dqkv[ko + i] += ds * a.qkv[qo + i];
							}
						}
					}
				}
			const dln1 = this.dA;
			linearBack(dln1, g, dqkv, a.ln1, w, s.wqkv.offset, s.bqkv.offset, N, d, 3 * d);
			layerNormBack(dx, g, dln1, a.ln1hat, a.ln1r, w, s.ln1g.offset, s.ln1b.offset, N, d);
		}
		// embeddings
		for (let b = 0; b < B; b++)
			for (let t = 0; t < T; t++) {
				const n = b * T + t;
				const te = L.wte.offset + tokens[n] * d;
				const pe = L.wpe.offset + t * d;
				for (let i = 0; i < d; i++) {
					g[te + i] += dx[n * d + i];
					g[pe + i] += dx[n * d + i];
				}
			}
	}

	/** Probability of each next character after `context` (its last `config.context` chars). */
	next(context: ArrayLike<number>): Float64Array {
		const T = Math.min(this.config.context, context.length);
		const start = context.length - T;
		const toks = new Array<number>(T);
		for (let t = 0; t < T; t++) toks[t] = context[start + t];
		this.forward(toks, 1, T);
		const V = this.config.vocab;
		return this.logits.slice((T - 1) * V, T * V);
	}
}

// ----------------------------------------------------------------------------- training

export interface TrainSettings {
	steps: number;
	/** Peak learning rate (after warm-up). */
	lr: number;
	/** Learning rate at the end of the cosine decay. */
	minLr: number;
	warmup: number;
	weightDecay: number;
	beta1: number;
	beta2: number;
	/** Gradient norm clip. */
	clip: number;
}

/** AdamW over the flat parameter vector (decoupled weight decay on the matrices only). */
export class AdamW {
	private readonly m: Float64Array;
	private readonly v: Float64Array;
	private readonly decay: Uint8Array;
	private t = 0;
	readonly s: TrainSettings;

	constructor(L: Layout, s: TrainSettings) {
		this.m = new Float64Array(L.total);
		this.v = new Float64Array(L.total);
		this.decay = new Uint8Array(L.total);
		for (const slot of L.slots)
			if (slot.matrix) this.decay.fill(1, slot.offset, slot.offset + slot.size);
		this.s = s;
	}

	/** Learning rate at step `it` (0-based): linear warm-up, then cosine decay to `minLr`. */
	rate(it: number) {
		const s = this.s;
		if (it < s.warmup) return (s.lr * (it + 1)) / s.warmup;
		const u = Math.min(1, (it - s.warmup) / Math.max(1, s.steps - s.warmup));
		return s.minLr + 0.5 * (1 + Math.cos(Math.PI * u)) * (s.lr - s.minLr);
	}

	/** One update of `w` with gradient `g`; returns the gradient norm before clipping. */
	step(w: Float64Array, g: Float64Array) {
		const s = this.s;
		let norm = 0;
		for (let i = 0; i < g.length; i++) norm += g[i] * g[i];
		norm = Math.sqrt(norm);
		const k = norm > s.clip ? s.clip / norm : 1;
		const lr = this.rate(this.t);
		this.t++;
		const b1 = s.beta1;
		const b2 = s.beta2;
		const c1 = 1 - Math.pow(b1, this.t);
		const c2 = 1 - Math.pow(b2, this.t);
		for (let i = 0; i < w.length; i++) {
			const gi = g[i] * k;
			this.m[i] = b1 * this.m[i] + (1 - b1) * gi;
			this.v[i] = b2 * this.v[i] + (1 - b2) * gi * gi;
			if (this.decay[i]) w[i] -= lr * s.weightDecay * w[i];
			w[i] -= (lr * (this.m[i] / c1)) / (Math.sqrt(this.v[i] / c2) + 1e-8);
		}
		return norm;
	}
}

/** Fills `tokens` and `targets` with `B` random windows of `T` characters of `data`. */
export function fillBatch(
	data: ArrayLike<number>,
	B: number,
	T: number,
	random: () => number,
	tokens: Int32Array,
	targets: Int32Array
) {
	const span = data.length - T - 1;
	for (let b = 0; b < B; b++) {
		const start = Math.floor(random() * (span + 1));
		for (let t = 0; t < T; t++) {
			tokens[b * T + t] = data[start + t];
			targets[b * T + t] = data[start + t + 1];
		}
	}
}

/**
 * Mean cross-entropy (nats per character) of the model on `text` (codes), read in consecutive
 * windows of the model's context: the model predicts every character after the first, seeing
 * only the characters before it in the same window, as in training.
 */
export function evaluate(model: TinyGPT, text: ArrayLike<number>, segments: number[][]): number {
	const T = model.config.context;
	let total = 0;
	let count = 0;
	const toks: number[] = [];
	const tgts: number[] = [];
	const flush = () => {
		if (!toks.length) return;
		const B = toks.length / T;
		model.forward(toks, B, T);
		total += model.loss(tgts) * toks.length;
		count += toks.length;
		toks.length = 0;
		tgts.length = 0;
	};
	for (const [start, len] of segments) {
		for (let p = start; p + T < start + len + 1 && p + T < text.length; p += T) {
			for (let t = 0; t < T; t++) {
				toks.push(text[p + t]);
				tgts.push(text[p + t + 1]);
			}
			if (toks.length / T === model.batch) flush();
		}
	}
	flush();
	return total / count;
}

/** Writes `length` characters after `prompt`, each drawn from the model's probabilities. */
export function sample(model: TinyGPT, prompt: number[], length: number, seed: number): number[] {
	const random = rng(seed);
	const out = prompt.slice();
	for (let i = 0; i < length; i++) {
		const p = model.next(out);
		let u = random();
		let pick = p.length - 1;
		for (let v = 0; v < p.length; v++) {
			u -= p[v];
			if (u < 0) {
				pick = v;
				break;
			}
		}
		out.push(pick);
	}
	return out.slice(prompt.length);
}
