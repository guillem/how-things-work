// Checks the kv-cache-inference page's model: decoding the tiny GPT with a KV cache gives exactly
// what recomputing the whole window gives (the training page's own model), while the counted
// arithmetic per character grows with the window only without the cache; the real models' shapes
// add up to their published weight counts; the cache sizes match published figures (Kwon et al.
// 2023 for OPT-13B, 0.5 MiB per token for Llama 2 7B); and on an H100 the roofline puts decode
// at batch 1 on the memory slope (about 4 ms a token for Llama 2 7B, 13.5 GB over 3.35 TB/s),
// prefill on the compute roof, and shows batching raising decode's intensity until the cache
// caps it. The numbers the narrative quotes are checked here too.
import { expect, test } from '@playwright/test';
import { sample } from '../src/routes/training-a-tiny-language-model/tiny-gpt';
import { generateCached } from '../src/routes/kv-cache-inference/kv-gpt';
import {
	bytesMoved,
	decode,
	encode,
	flops,
	generation,
	makeDecoder,
	makeTinyGpt,
	PROMPT,
	SEEDS
} from '../src/routes/kv-cache-inference/tiny';
import {
	attainable,
	cacheBytes,
	decodeIntensityLimit,
	decodeStep,
	fits,
	intensity,
	kvBytesPerToken,
	maxBatch,
	prefill,
	recomputeStep,
	ridge,
	timing,
	weightBytes,
	weightsFromShape
} from '../src/routes/kv-cache-inference/serving';
import {
	H100,
	LLAMA2_7B,
	MISTRAL_7B,
	RTX_4090,
	type ModelShape
} from '../src/routes/kv-cache-inference/specs';

test.describe('the tiny GPT with and without a cache', () => {
	test('a cached decode writes exactly what full recomputation writes', () => {
		for (const seed of SEEDS) {
			const rows = generation(seed);
			const cached = rows.map((r) => r.char).join('');
			const recomputed = decode(sample(makeTinyGpt(), encode(PROMPT), rows.length, seed));
			expect(cached).toBe(recomputed);
		}
	});

	test('the probabilities agree to the last bit at every position', () => {
		const dec = makeDecoder();
		const gpt = makeTinyGpt();
		const text = encode(PROMPT + 'But soft, what light through yonder window breaks?');
		dec.reset();
		for (let t = 0; t < text.length; t++) {
			const a = dec.step(text[t]);
			const b = gpt.next(text.slice(0, t + 1));
			let worst = 0;
			for (let v = 0; v < a.length; v++) worst = Math.max(worst, Math.abs(a[v] - b[v]));
			expect(worst).toBeLessThanOrEqual(1e-15);
		}
	});

	test('the cache stops at the end of the 64-character window', () => {
		const dec = makeDecoder();
		const g = generateCached(dec, encode(PROMPT), 11);
		expect(PROMPT.length + g.tokens.length).toBe(65);
		expect(() => dec.step(0)).toThrow();
	});

	test('without the cache the arithmetic per character grows with the window; with it, barely', () => {
		const rows = generation(11);
		const first = rows[0];
		const last = rows[rows.length - 1];
		// recomputation: proportional to the positions run again (7 → 64), plus attention
		const grow = flops(last.recompute) / flops(first.recompute);
		expect(grow).toBeGreaterThan(64 / 7);
		expect(grow).toBeLessThan(1.25 * (64 / 7));
		// cached: one position each time; only attention over the longer cache grows
		expect(flops(last.cached) / flops(first.cached)).toBeLessThan(1.3);
		// over the whole generation, recomputing costs ~30 times the arithmetic
		const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);
		const ratio = sum((r) => flops(r.recompute)) / sum((r) => flops(r.cached));
		expect(ratio).toBeGreaterThan(25);
		expect(ratio).toBeLessThan(40);
	});

	test('the bytes read are about the weights either way; the cache adds a growing share', () => {
		const rows = generation(11);
		const last = rows[rows.length - 1];
		expect(last.recompute.weightBytes).toBe(last.cached.weightBytes);
		expect(last.cached.cacheBytes).toBeGreaterThan(rows[0].cached.cacheBytes * 9);
		// the cache of 64 positions is under a third of the 27,617 float64 weights
		expect(last.cached.cacheBytes / last.cached.weightBytes).toBeGreaterThan(0.25);
		expect(last.cached.cacheBytes / last.cached.weightBytes).toBeLessThan(1 / 3);
		expect(bytesMoved(last.cached)).toBeGreaterThan(bytesMoved(last.recompute));
	});
});

test.describe('real models', () => {
	test('the configurations add up to the published weight counts', () => {
		expect(weightsFromShape(LLAMA2_7B)).toBe(6_738_415_616);
		expect(weightsFromShape(MISTRAL_7B)).toBe(7_241_732_096);
	});

	test('KV-cache sizes match published figures', () => {
		// Kwon et al. 2023 (PagedAttention): OPT-13B needs about 800 KB per token
		const opt13b: ModelShape = {
			...LLAMA2_7B,
			layers: 40,
			dModel: 5120,
			heads: 40,
			kvHeads: 40
		};
		expect(kvBytesPerToken(opt13b) / 1000).toBeCloseTo(819.2, 1);
		// Llama 2 7B: half a mebibyte per token, 2 GiB for a full 4,096-token context
		expect(kvBytesPerToken(LLAMA2_7B)).toBe(2 ** 19);
		expect(cacheBytes(LLAMA2_7B, 4096)).toBe(2 * 2 ** 30);
		// grouped-query attention with 8 KV heads for 32 query heads: a quarter of that
		expect(kvBytesPerToken(LLAMA2_7B) / kvBytesPerToken(MISTRAL_7B)).toBe(4);
	});

	test('at long contexts and batches the cache outgrows the weights', () => {
		// Llama 2 7B: 13.5 GB of weights; 8 sequences of 4,096 tokens hold 17.2 GB of cache
		expect(weightBytes(LLAMA2_7B) / 1e9).toBeCloseTo(13.5, 1);
		expect(cacheBytes(LLAMA2_7B, 4096, 8) / 1e9).toBeCloseTo(17.2, 1);
		expect(cacheBytes(LLAMA2_7B, 4096, 8)).toBeGreaterThan(weightBytes(LLAMA2_7B));
		expect(cacheBytes(MISTRAL_7B, 4096, 8)).toBeLessThan(weightBytes(MISTRAL_7B));
		// how many 4,096-token sequences fit beside the weights in an H100's 80 GB
		expect(maxBatch(H100, LLAMA2_7B, 4096)).toBe(30);
		expect(maxBatch(H100, MISTRAL_7B, 4096)).toBe(122);
		expect(fits(RTX_4090, LLAMA2_7B, 4096, 4)).toBe(true);
		expect(fits(RTX_4090, LLAMA2_7B, 4096, 5)).toBe(false);
	});
});

test.describe('the roofline', () => {
	test('an H100 needs about 295 operations per byte to reach its peak', () => {
		expect(ridge(H100)).toBeCloseTo(295.4, 1);
		expect(ridge(RTX_4090)).toBeCloseTo(163.9, 1);
	});

	test('decode at batch 1 is memory-bound: about 4 ms a token for Llama 2 7B on an H100', () => {
		const d = decodeStep(LLAMA2_7B, 1024, 1);
		expect(intensity(d)).toBeGreaterThan(0.95);
		expect(intensity(d)).toBeLessThan(1.05);
		const tm = timing(H100, d);
		expect(tm.memoryBound).toBe(true);
		expect(tm.seconds * 1000).toBeCloseTo(4.1, 1);
		// the arithmetic alone would take under a hundredth of that
		expect(tm.compute / tm.seconds).toBeLessThan(0.01);
		// at most ~250 tokens a second for one conversation (13.2 GB read per token)
		expect(1 / timing(H100, decodeStep(LLAMA2_7B, 1, 1)).seconds).toBeGreaterThan(245);
		expect(1 / timing(H100, decodeStep(LLAMA2_7B, 1, 1)).seconds).toBeLessThan(260);
	});

	test('prefill of a 1,024-token prompt is compute-bound', () => {
		const p = prefill(LLAMA2_7B, 1024, 1);
		expect(intensity(p)).toBeGreaterThan(ridge(H100));
		const tm = timing(H100, p);
		expect(tm.memoryBound).toBe(false);
		expect(tm.seconds * 1000).toBeCloseTo(13.7, 1);
		// so a prompt goes in at ~75,000 tokens a second, and the reply comes out at ~250
		expect(p.tokens / tm.seconds).toBeGreaterThan(70_000);
	});

	test('without a cache each new token costs a whole prefill', () => {
		const withCache = decodeStep(LLAMA2_7B, 4096, 1);
		const without = recomputeStep(LLAMA2_7B, 4096, 1);
		expect(without.flops / withCache.flops).toBeGreaterThan(3000);
		expect(timing(H100, without).memoryBound).toBe(false);
	});

	test('batching raises decode intensity, until the cache caps it', () => {
		const i = (b: number, c: number, m = LLAMA2_7B) => intensity(decodeStep(m, c, b));
		expect(i(32, 512)).toBeGreaterThan(15 * i(1, 512));
		// 32 sequences share each weight read: the step takes far less than 32 times as long
		const t1 = timing(H100, decodeStep(LLAMA2_7B, 512, 1)).seconds;
		const t32 = timing(H100, decodeStep(LLAMA2_7B, 512, 32)).seconds;
		expect(t32 / t1).toBeLessThan(2);
		// Llama 2 7B at 4,096 tokens: however large the batch, about 7 operations per byte
		expect(decodeIntensityLimit(LLAMA2_7B, 4096)).toBeCloseTo(7.2, 1);
		expect(i(maxBatch(H100, LLAMA2_7B, 4096), 4096)).toBeLessThan(ridge(H100) / 40);
		// Mistral 7B's smaller cache lets a short-context batch reach the compute roof
		const b = maxBatch(H100, MISTRAL_7B, 128);
		expect(i(b, 128, MISTRAL_7B)).toBeGreaterThan(ridge(H100));
		expect(timing(H100, decodeStep(MISTRAL_7B, 128, b)).memoryBound).toBe(false);
		expect(attainable(H100, i(b, 128, MISTRAL_7B))).toBe(H100.peak);
	});
});
