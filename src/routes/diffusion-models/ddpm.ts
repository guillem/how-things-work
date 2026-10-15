/**
 * A denoising diffusion probabilistic model (DDPM), in plain TypeScript (no inference library):
 * the noise schedule, the forward (noising) process, the denoising network and the reverse
 * (sampling) process. The 2-D model runs live on the page with this file; the MNIST model was
 * trained, and its sequences sampled, by `scripts/data/diffusion-models/train.mjs` with this
 * same file. It must stay importable by Node as-is (erasable TypeScript only, no imports).
 *
 * References
 * - Jonathan Ho, Ajay Jain & Pieter Abbeel, "Denoising Diffusion Probabilistic Models",
 *   NeurIPS 2020 (arXiv:2006.11239): the linear schedule β₁ = 10⁻⁴ … β_T = 0.02 with T = 1000,
 *   the closed-form forward process q(x_t | x₀) = N(√ᾱ_t x₀, (1 − ᾱ_t) I), the noise-prediction
 *   loss ‖ε − ε_θ(x_t, t)‖² and the ancestral sampler (their Algorithms 1 and 2).
 * - Alex Nichol & Prafulla Dhariwal, "Improved Denoising Diffusion Probabilistic Models",
 *   ICML 2021 (arXiv:2102.09672), section 4: sampling with fewer steps by taking a subsequence
 *   of the timesteps and recomputing β from ᾱ over it.
 * - Jonathan Ho & Tim Salimans, "Classifier-Free Diffusion Guidance" (arXiv:2207.12598): one
 *   network trained with and without the condition (the label is dropped at random), and
 *   ε̃ = ε_uncond + s · (ε_cond − ε_uncond) at sampling time. Here s = 0 is unconditional,
 *   s = 1 plain conditional and s > 1 guided (their w is s − 1).
 *
 * The network is a small residual multilayer perceptron, the same shape for both models:
 *
 *   c   = [sinusoidal embedding of t (E numbers), learned embedding of the label (E numbers)]
 *   h   = W_in · [x, c] + b_in                                    (H numbers)
 *   h  ← h + SiLU(W_k · h + U_k · c + b_k)       for each of the `blocks` blocks
 *   x̂₀  = W_out · h + b_out                                       (D numbers, one per coordinate)
 *
 * The network outputs its guess of the clean data x̂₀; its guess of the noise follows from it,
 * ε̂ = (x_t − √ᾱ_t x̂₀) / √(1 − ᾱ_t), so the two carry the same information (Ho et al. section
 * 3.2 discuss both). Guessing x̂₀ suits a narrow network: a clean digit is described by far fewer
 * than 784 numbers, while the noise needs all 784, more than 512 hidden units can pass through.
 * It is trained with the noise-prediction loss weighted by min(1, 5/SNR_t), where SNR_t =
 * ᾱ_t / (1 − ᾱ_t): the "min-SNR" weighting of Hang et al., "Efficient Diffusion Training via
 * Min-SNR Weighting Strategy", ICCV 2023 (as a loss on x̂₀ it is min(SNR_t, 5) · ‖x̂₀ − x₀‖²).
 *
 * The label embedding has one extra row, "no label" (index `classes`), used to train and run
 * the unconditional half of classifier-free guidance.
 */
import { rng } from '#lib/draw/math.ts';

/** Number of diffusion steps the models were trained with (Ho et al. 2020). */
export const T = 1000;
export const BETA_1 = 1e-4;
export const BETA_T = 0.02;

/** β_t, α_t = 1 − β_t and ᾱ_t = ∏ α_s, for t = 1 … T (index t − 1). */
export const BETAS = Float64Array.from(
	{ length: T },
	(_, i) => BETA_1 + ((BETA_T - BETA_1) * i) / (T - 1)
);
export const ALPHA_BAR = (() => {
	const a = new Float64Array(T);
	let p = 1;
	for (let i = 0; i < T; i++) a[i] = p *= 1 - BETAS[i];
	return a;
})();

/** ᾱ at step t (1 … T); ᾱ₀ = 1 (clean data). */
export const alphaBar = (t: number) => (t <= 0 ? 1 : ALPHA_BAR[Math.min(T, Math.round(t)) - 1]);

// ---------------------------------------------------------------------------- random numbers

/** Standard normal numbers (Box–Muller) from a seeded uniform generator. */
export function gaussian(seed: number): () => number {
	const u = rng(seed);
	let spare: number | null = null;
	return () => {
		if (spare !== null) {
			const s = spare;
			spare = null;
			return s;
		}
		const r = Math.sqrt(-2 * Math.log(1 - u()));
		const a = 2 * Math.PI * u();
		spare = r * Math.sin(a);
		return r * Math.cos(a);
	};
}

// ---------------------------------------------------------------------------- forward process

/** x_t = √ᾱ_t · x₀ + √(1 − ᾱ_t) · ε, element by element. */
export function noisy(x0: ArrayLike<number>, eps: ArrayLike<number>, t: number): Float32Array {
	const ab = alphaBar(t);
	const a = Math.sqrt(ab);
	const b = Math.sqrt(1 - ab);
	return Float32Array.from({ length: x0.length }, (_, i) => a * x0[i] + b * eps[i]);
}

/** How much of the signal is left at step t: √ᾱ_t (1 at t = 0, about 0.006 at t = T). */
export const signalLeft = (t: number) => Math.sqrt(alphaBar(t));

// ---------------------------------------------------------------------------- the network

export interface NetConfig {
	/** coordinates of a data point: 2 for the plane, 784 for a 28 × 28 image */
	D: number;
	/** width of the hidden layers */
	H: number;
	/** size of each of the two condition embeddings (time, label) */
	E: number;
	blocks: number;
	/** number of labels; the label embedding has one more row, "no label" */
	classes: number;
}

/** The digit model's size (trained by scripts/data/diffusion-models/train.mjs; not shipped). */
export const MNIST_NET: NetConfig = { D: 784, H: 512, E: 32, blocks: 3, classes: 10 };

export interface Weights {
	cfg: NetConfig;
	/** [H][D + 2E] */
	win: Float32Array;
	bin: Float32Array;
	/** [classes + 1][E] */
	emb: Float32Array;
	/** per block: [H][H], [H][2E], [H] */
	w: Float32Array[];
	u: Float32Array[];
	b: Float32Array[];
	/** [D][H] */
	wout: Float32Array;
	bout: Float32Array;
}

/** Names and sizes of the weight tensors, in the order they are stored. */
export function shapes(cfg: NetConfig): [string, number][] {
	const { D, H, E, blocks, classes } = cfg;
	const s: [string, number][] = [
		['win', H * (D + 2 * E)],
		['bin', H],
		['emb', (classes + 1) * E]
	];
	for (let k = 0; k < blocks; k++) s.push([`w${k}`, H * H], [`u${k}`, H * 2 * E], [`b${k}`, H]);
	s.push(['wout', D * H], ['bout', D]);
	return s;
}

export const paramCount = (cfg: NetConfig) => shapes(cfg).reduce((n, [, s]) => n + s, 0);

/** Builds the weights from one flat array of all the tensors, in the order of `shapes`. */
export function unflatten(cfg: NetConfig, flat: Float32Array): Weights {
	const parts: Record<string, Float32Array> = {};
	let o = 0;
	for (const [name, size] of shapes(cfg)) {
		parts[name] = flat.subarray(o, o + size);
		o += size;
	}
	if (o !== flat.length) throw new Error(`expected ${o} weights, got ${flat.length}`);
	const k = Array.from({ length: cfg.blocks }, (_, i) => i);
	return {
		cfg,
		win: parts.win,
		bin: parts.bin,
		emb: parts.emb,
		w: k.map((i) => parts[`w${i}`]),
		u: k.map((i) => parts[`u${i}`]),
		b: k.map((i) => parts[`b${i}`]),
		wout: parts.wout,
		bout: parts.bout
	};
}

/** Decodes weights stored as little-endian float32, base64. */
export function decodeWeights(cfg: NetConfig, base64: string): Weights {
	const bin = atob(base64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	const view = new DataView(bytes.buffer);
	const n = paramCount(cfg);
	if (bytes.length !== n * 4) throw new Error(`expected ${n * 4} bytes, got ${bytes.length}`);
	const flat = new Float32Array(n);
	for (let i = 0; i < n; i++) flat[i] = view.getFloat32(4 * i, true);
	return unflatten(cfg, flat);
}

/** The sinusoidal embedding of the step t (as in the Transformer and in Ho et al.'s network). */
export function timeEmbedding(t: number, E: number, out: Float32Array, o = 0) {
	const half = E / 2;
	for (let i = 0; i < half; i++) {
		const f = Math.exp((-Math.log(10000) * i) / half);
		out[o + i] = Math.sin(t * f);
		out[o + half + i] = Math.cos(t * f);
	}
}

export const silu = (z: number) => z / (1 + Math.exp(-z));

/** What the forward pass keeps for backpropagation (used by the training script). */
export interface Activations {
	/** [B][D + 2E]: the input and the condition */
	inp: Float32Array;
	/** [blocks + 1][B][H]: h before each block, and after the last one */
	h: Float32Array[];
	/** [blocks][B][H]: each block's sum before the SiLU */
	z: Float32Array[];
	/** [B][D] */
	out: Float32Array;
}

/**
 * The network's guess of the clean data x̂₀ for a batch of B noisy points `x` ([B][D]), at steps
 * `ts` (1 … T), with labels `labels` (0 … classes − 1, or `classes` for "no label").
 */
export function forward(
	wt: Weights,
	x: ArrayLike<number>,
	ts: ArrayLike<number>,
	labels: ArrayLike<number>,
	keep = false
): Activations {
	const { D, H, E, blocks } = wt.cfg;
	const B = ts.length;
	const I = D + 2 * E;
	const C = 2 * E;
	const inp = new Float32Array(B * I);
	for (let n = 0; n < B; n++) {
		const o = n * I;
		for (let i = 0; i < D; i++) inp[o + i] = x[n * D + i];
		timeEmbedding(ts[n], E, inp, o + D);
		const eo = labels[n] * E;
		for (let i = 0; i < E; i++) inp[o + D + E + i] = wt.emb[eo + i];
	}
	let h = new Float32Array(B * H);
	matmulT(inp, B, I, 0, I, wt.win, H, h, wt.bin);
	const hs = keep ? [h] : [];
	const zs: Float32Array[] = [];
	for (let k = 0; k < blocks; k++) {
		const z = new Float32Array(B * H);
		matmulT(h, B, H, 0, H, wt.w[k], H, z, wt.b[k]);
		addMatmulT(inp, B, I, D, C, wt.u[k], H, z);
		const next = keep ? new Float32Array(h) : h;
		for (let i = 0; i < B * H; i++) next[i] += silu(z[i]);
		h = next;
		if (keep) {
			hs.push(h);
			zs.push(z);
		}
	}
	const out = new Float32Array(B * D);
	matmulT(h, B, H, 0, H, wt.wout, D, out, wt.bout);
	return { inp, h: hs, z: zs, out };
}

/**
 * y[n][j] = Σ_i a[n][off + i] · w[j][i] + bias[j], for n < B, i < len, j < J: a batch times the
 * transpose of a weight table stored one row per output. `stride` is a's row length.
 */
function matmulT(
	a: Float32Array,
	B: number,
	stride: number,
	off: number,
	len: number,
	w: Float32Array,
	J: number,
	y: Float32Array,
	bias: Float32Array
) {
	for (let n = 0; n < B; n++) {
		const ao = n * stride + off;
		for (let j = 0; j < J; j++) {
			const wo = j * len;
			let s = bias[j];
			for (let i = 0; i < len; i++) s += a[ao + i] * w[wo + i];
			y[n * J + j] = s;
		}
	}
}

function addMatmulT(
	a: Float32Array,
	B: number,
	stride: number,
	off: number,
	len: number,
	w: Float32Array,
	J: number,
	y: Float32Array
) {
	for (let n = 0; n < B; n++) {
		const ao = n * stride + off;
		for (let j = 0; j < J; j++) {
			const wo = j * len;
			let s = 0;
			for (let i = 0; i < len; i++) s += a[ao + i] * w[wo + i];
			y[n * J + j] += s;
		}
	}
}

// ---------------------------------------------------------------------------- reverse process

/** The timesteps a sampler with `steps` steps visits, from T down to 1, evenly spaced. */
export function schedule(steps: number): number[] {
	const n = Math.max(1, Math.min(T, Math.round(steps)));
	const out: number[] = [];
	for (let k = 0; k < n; k++) out.push(Math.round(T - (k * (T - 1)) / Math.max(1, n - 1)));
	if (n === 1) return [T];
	return out;
}

export interface SampleOptions {
	/** sampling steps (1 … T); T is Ho et al.'s full sampler */
	steps: number;
	/** seed of the starting noise and of the noise added at each step */
	seed: number;
	/** the label to aim for, or null for none */
	label: number | null;
	/** guidance scale s: 0 unconditional, 1 conditional, > 1 guided */
	guidance: number;
	/** clip the predicted clean data to [−1, 1] (images; Ho et al.'s sampler does) */
	clip?: boolean;
	/** how many points or images to sample at once */
	count: number;
	/** called with the starting noise x_T */
	onStart?: (x: Float32Array) => void;
	/**
	 * called after step k (0-based) with the timestep reached (0 at the end), the new x and the
	 * clean data x̂₀ predicted during the step
	 */
	onStep?: (k: number, t: number, x: Float32Array, x0: Float32Array) => void;
}

/**
 * The clean data x̂₀ the network guesses for x at step t, with classifier-free guidance:
 * x̂₀ = x̂₀(no label) + s · (x̂₀(label) − x̂₀(no label)), which is the same as guiding the noise
 * guess, ε̃ = ε_uncond + s · (ε_cond − ε_uncond), since ε̂ is a fixed linear function of x̂₀ at a
 * given x and t. `label` null (or s = 0) asks for the unconditional guess.
 */
export function predict(
	wt: Weights,
	x: Float32Array,
	t: number,
	label: number | null,
	guidance: number
): Float32Array {
	const { D, classes } = wt.cfg;
	const B = x.length / D;
	const tArr = new Array<number>(B).fill(t);
	const nullLabels = new Array<number>(B).fill(classes);
	if (label === null || guidance === 0) return forward(wt, x, tArr, nullLabels).out;
	const pc = forward(wt, x, tArr, new Array<number>(B).fill(label)).out;
	if (guidance === 1) return pc;
	const pu = forward(wt, x, tArr, nullLabels).out;
	for (let i = 0; i < pc.length; i++) pc[i] = pu[i] + guidance * (pc[i] - pu[i]);
	return pc;
}

/** The noise the network sees in x at step t, given its guess of the clean data. */
export function noiseGuess(x: ArrayLike<number>, x0: ArrayLike<number>, t: number): Float32Array {
	const ab = alphaBar(t);
	return Float32Array.from(
		{ length: x.length },
		(_, i) => (x[i] - Math.sqrt(ab) * x0[i]) / Math.sqrt(1 - ab)
	);
}

/**
 * The reverse process: start from pure noise x_T ~ N(0, I) and take `steps` denoising steps.
 * Each step guesses the clean data x̂₀ (with classifier-free guidance when there is a label) and
 * draws x_{t′} (t′ the next timestep of the schedule) from the Gaussian q(x_{t′} | x_t, x̂₀) of
 * Ho et al.'s eq. 6–7: mean √ᾱ_{t′} β x̂₀ / (1 − ᾱ_t) + √(1 − β) (1 − ᾱ_{t′}) x_t / (1 − ᾱ_t),
 * variance β (1 − ᾱ_{t′}) / (1 − ᾱ_t), with β = 1 − ᾱ_t / ᾱ_{t′} recomputed over the
 * subsequence (Nichol & Dhariwal 2021; with all T steps β is Ho et al.'s β_t). The last step
 * returns x̂₀. Returns x₀ ([count][D]).
 */
export function sample(wt: Weights, o: SampleOptions): Float32Array {
	const { D } = wt.cfg;
	const B = o.count;
	const rnd = gaussian(o.seed);
	let x: Float32Array = Float32Array.from({ length: B * D }, () => rnd());
	o.onStart?.(x);
	const ts = schedule(o.steps);
	for (let k = 0; k < ts.length; k++) {
		const t = ts[k];
		const tPrev = k + 1 < ts.length ? ts[k + 1] : 0;
		const x0 = predict(wt, x, t, o.label, o.guidance);
		if (o.clip) for (let i = 0; i < x0.length; i++) x0[i] = Math.max(-1, Math.min(1, x0[i]));
		const ab = alphaBar(t);
		const abPrev = alphaBar(tPrev);
		let next: Float32Array;
		if (tPrev === 0) next = x0;
		else {
			const beta = 1 - ab / abPrev;
			const c0 = (Math.sqrt(abPrev) * beta) / (1 - ab);
			const ct = (Math.sqrt(1 - beta) * (1 - abPrev)) / (1 - ab);
			const sd = Math.sqrt(((1 - abPrev) / (1 - ab)) * beta);
			next = new Float32Array(B * D);
			for (let i = 0; i < next.length; i++) next[i] = c0 * x0[i] + ct * x[i] + sd * rnd();
		}
		x = next;
		o.onStep?.(k, tPrev, x, x0);
	}
	return x;
}
