/**
 * Counting the work of serving a real model, and the roofline that turns it into time.
 *
 * Conventions:
 * - FLOPs count the matrix multiplications only, a multiply-add being 2 operations: the weight
 *   matrices (2 per weight per token) and attention (each query scores every key it can see and
 *   mixes as many values: 2 × head width multiply-adds per head per key). Norms, softmax and the
 *   MLP's activation are under 1% and left out.
 * - Bytes count what must come from the GPU's main memory (HBM or GDDR) in one forward pass: every
 *   weight except the embedding table (only one row of it per token is read), once per pass
 *   however many tokens share it; every cached key and value the pass reads; and the new keys and
 *   values it writes. Activations are left out: they are small and mostly stay on chip.
 * - Time follows the roofline (Williams, Waterman and Patterson 2009, as on the gpu page): a pass
 *   takes at least FLOPs ÷ peak rate and at least bytes ÷ bandwidth; the longer of the two is the
 *   bound. Real kernels reach perhaps 50–80% of either.
 */
import { BYTES_16, type Gpu, type ModelShape } from './specs.ts';

export const headDim = (m: ModelShape) => m.dModel / m.heads;

/** Weights inside matrix multiplications: per layer Q, K, V, O and the gated MLP; the read-out. */
export function matmulWeights(m: ModelShape): number {
	const d = m.dModel;
	const kv = m.kvHeads * headDim(m);
	const perLayer = 2 * d * d + 2 * d * kv + 3 * d * m.ffn;
	return m.layers * perLayer + m.vocab * d;
}

/** Every weight, from the shape: the matrices, the embedding table and the RMS-norm gains. */
export const weightsFromShape = (m: ModelShape) =>
	matmulWeights(m) + m.vocab * m.dModel + (2 * m.layers + 1) * m.dModel;

/** Bytes of all the weights (what memory must hold). */
export const weightBytes = (m: ModelShape, bytes = BYTES_16) => m.params * bytes;
/** Bytes of weights a forward pass reads: all but the embedding table. */
export const weightBytesRead = (m: ModelShape, bytes = BYTES_16) =>
	(m.params - m.vocab * m.dModel) * bytes;

/** Bytes of keys and values one token leaves in the cache: 2 × layers × KV heads × head dim × bytes. */
export const kvBytesPerToken = (m: ModelShape, bytes = BYTES_16) =>
	2 * m.layers * m.kvHeads * headDim(m) * bytes;

/** The cache of `batch` sequences of `context` tokens each. */
export const cacheBytes = (m: ModelShape, context: number, batch = 1) =>
	batch * context * kvBytesPerToken(m);

export interface Pass {
	flops: number;
	bytes: number;
	/** Of the bytes, those of cached keys and values (read and written). */
	cacheBytes: number;
	/** Tokens this pass produces or takes in. */
	tokens: number;
}

/** Attention FLOPs of one query that sees `keys` keys, over all layers. */
const attentionFlops = (m: ModelShape, keys: number) => 4 * m.layers * m.dModel * keys;

/**
 * One decode step with the cache: `batch` sequences each add one token, having `context` tokens
 * so far (the new one included in what it attends to).
 */
export function decodeStep(m: ModelShape, context: number, batch = 1): Pass {
	const flops = batch * (2 * matmulWeights(m) + attentionFlops(m, context));
	const cache = batch * (context - 1) * kvBytesPerToken(m) + batch * kvBytesPerToken(m);
	return { flops, bytes: weightBytesRead(m) + cache, cacheBytes: cache, tokens: batch };
}

/**
 * One decode step without a cache: the whole sequence of `context` tokens goes through the model
 * again to produce the next one (the read-out only at the last position).
 */
export function recomputeStep(m: ModelShape, context: number, batch = 1): Pass {
	const p = prefill(m, context, batch);
	return { ...p, bytes: weightBytesRead(m), cacheBytes: 0, tokens: batch };
}

/**
 * Prefill: `batch` prompts of `prompt` tokens go through the model in one pass, causally (token i
 * attends to i keys), filling the cache; the read-out runs at the last position only.
 */
export function prefill(m: ModelShape, prompt: number, batch = 1): Pass {
	const readOut = m.vocab * m.dModel;
	const body = matmulWeights(m) - readOut;
	const attention = 2 * m.layers * m.dModel * prompt * (prompt + 1);
	const flops = batch * (2 * body * prompt + 2 * readOut + attention);
	const cache = batch * prompt * kvBytesPerToken(m);
	return { flops, bytes: weightBytesRead(m) + cache, cacheBytes: cache, tokens: batch * prompt };
}

/** FLOPs per byte moved. */
export const intensity = (p: Pass) => p.flops / p.bytes;
/** The intensity at which a GPU's two limits meet. */
export const ridge = (g: Gpu) => g.peak / g.bandwidth;
/** FLOP/s the roofline allows at an intensity. */
export const attainable = (g: Gpu, i: number) => Math.min(g.peak, g.bandwidth * i);

export interface Timing {
	/** Seconds the arithmetic needs at peak rate. */
	compute: number;
	/** Seconds the memory traffic needs at full bandwidth. */
	memory: number;
	/** The bound: the longer of the two. */
	seconds: number;
	memoryBound: boolean;
}

export function timing(g: Gpu, p: Pass): Timing {
	const compute = p.flops / g.peak;
	const memory = p.bytes / g.bandwidth;
	return { compute, memory, seconds: Math.max(compute, memory), memoryBound: memory > compute };
}

/** Whether the weights and the cache of `batch` sequences of `context` tokens fit in memory. */
export const fits = (g: Gpu, m: ModelShape, context: number, batch: number) =>
	weightBytes(m) + cacheBytes(m, context, batch) <= g.memory;

/** The largest batch whose caches fit beside the weights (0 if the weights alone don't fit). */
export const maxBatch = (g: Gpu, m: ModelShape, context: number) =>
	Math.max(0, Math.floor((g.memory - weightBytes(m)) / cacheBytes(m, context, 1)));

/**
 * The intensity decode tends to as the batch grows without limit at a given context: the
 * weights' bytes are shared, the cache's are not, so it levels off.
 */
export function decodeIntensityLimit(m: ModelShape, context: number): number {
	const perSeq = decodeStep(m, context, 1);
	const shared = weightBytesRead(m);
	return perSeq.flops / (perSeq.bytes - shared);
}
