// Checks the scaling-laws page's model against its sources: the compute-optimal split of the
// Chinchilla parametric law reproduces what Hoffmann et al. 2022 and Besiroglu et al. 2024 report
// (the size exponent a, 40B parameters for Gopher's budget, about 20 tokens per parameter for the
// refit and far more for Hoffmann's fit), the optimum really is the lowest point of its IsoFLOP
// slice, the loss never falls below the floor E, and Kaplan et al.'s law gives the losses of
// its range. The page's own sweep: the stored runs are what the tiny GPT's code produces, and the
// numbers the narrative quotes (the slopes, the flat small-data line) hold.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Alphabet, split } from '../src/routes/ngram-text-models/ngram';
import { runOf } from '../src/routes/training-a-tiny-language-model/runs';
import { Run } from '../src/routes/training-a-tiny-language-model/train';
import {
	BESIROGLU,
	computeOf,
	FITS,
	GOPHER_BUDGET,
	HOFFMANN,
	HOFFMANN_TEX,
	isoFlop,
	kaplanLossN,
	lossOf,
	MODELS,
	optimum,
	sizeExponent
} from '../src/routes/scaling-laws/laws';
import {
	blockWeights,
	bySize,
	byWidth,
	curveOf,
	fitPowerLaw,
	pointOf,
	powerLaw,
	totalWeights
} from '../src/routes/scaling-laws/sweep';

test.describe('the Chinchilla parametric law', () => {
	test('the optimal model size grows as C^a with the exponents both papers report', () => {
		// Hoffmann et al. Table 2, approach 3: a = 0.46; Besiroglu et al. Table 1, their refit: 0.5126
		expect(sizeExponent(HOFFMANN_TEX)).toBeCloseTo(0.46, 2);
		expect(sizeExponent(BESIROGLU)).toBeCloseTo(0.5126, 3);
		expect(sizeExponent(HOFFMANN)).toBeCloseTo(0.45, 2);
		// and the solver's N_opt follows that exponent over ten orders of magnitude of compute
		for (const f of FITS) {
			const a = Math.log10(optimum(f, 1e28).N / optimum(f, 1e18).N) / 10;
			expect(a).toBeCloseTo(sizeExponent(f), 6);
		}
	});

	test("Hoffmann et al.'s fit puts Gopher's budget at a 40B model (their section 3.3)", () => {
		const o = optimum(HOFFMANN_TEX, GOPHER_BUDGET);
		expect(o.N / 1e9).toBeGreaterThan(39);
		expect(o.N / 1e9).toBeLessThan(41.5);
		// the rounded constants printed in the paper move it by a fifth
		expect(optimum(HOFFMANN, GOPHER_BUDGET).N / 1e9).toBeLessThan(34);
	});

	test('the refit gives about 20 tokens per parameter, as Chinchilla was trained', () => {
		// Besiroglu et al.: "around 20 tokens per parameter"; Hoffmann et al.'s fit: "approximately 70"
		for (const C of [1e21, GOPHER_BUDGET, 1e25]) {
			const r = optimum(BESIROGLU, C).tokensPerParameter;
			expect(r).toBeGreaterThan(15);
			expect(r).toBeLessThan(26);
		}
		const h = optimum(HOFFMANN_TEX, GOPHER_BUDGET).tokensPerParameter;
		expect(h).toBeGreaterThan(45);
		expect(h).toBeLessThan(90);
		// the refit's optimum at Chinchilla's budget is close to Chinchilla itself (70B, 1.4T)
		const chinchilla = MODELS.find((m) => m.id === 'chinchilla')!;
		const o = optimum(BESIROGLU, computeOf(chinchilla.N, chinchilla.D));
		expect(o.N / 1e9).toBeGreaterThan(60);
		expect(o.N / 1e9).toBeLessThan(85);
	});

	test('the optimum is the lowest point of its IsoFLOP slice and uses the whole budget', () => {
		for (const f of FITS)
			for (const C of [1e19, 1e23, 1e26]) {
				const o = optimum(f, C);
				expect(computeOf(o.N, o.D)).toBeCloseTo(C, -Math.log10(C) + 6);
				const lg = Math.log10(o.N);
				const slice = isoFlop(f, C, [lg - 0.3, lg - 0.01, lg + 0.01, lg + 0.3]);
				for (const p of slice) expect(p.loss).toBeGreaterThan(o.loss);
			}
	});

	test('the loss falls towards the floor E and never below it', () => {
		for (const f of FITS) {
			let prev = Infinity;
			for (let lc = 18; lc <= 30; lc++) {
				const l = optimum(f, 10 ** lc).loss;
				expect(l).toBeLessThan(prev);
				expect(l).toBeGreaterThan(f.E);
				prev = l;
			}
			expect(lossOf(f, 1e30, 1e30) - f.E).toBeLessThan(1e-5);
		}
	});

	test('a model trained far past the optimum has a higher loss for its compute', () => {
		const llama = MODELS.find((m) => m.id === 'llama3-8b')!;
		const C = computeOf(llama.N, llama.D);
		for (const f of FITS) {
			const o = optimum(f, C);
			expect(lossOf(f, llama.N, llama.D)).toBeGreaterThan(o.loss);
			expect(llama.D / llama.N).toBeGreaterThan(10 * o.tokensPerParameter);
		}
	});
});

test('Kaplan et al.: L(N) falls from about 6.9 to 2.3 nats per token over their model sizes', () => {
	// eq. 1.1 at the ends of their range, 768 and 1.5 billion non-embedding parameters (the
	// numbers the page quotes)
	expect(kaplanLossN(768)).toBeCloseTo(6.9, 1);
	expect(kaplanLossN(1.5e9)).toBeCloseTo(2.3, 1);
});

test.describe("the page's own sweep", () => {
	test('it is what the tiny GPT trains: the shared runs match, and a fresh run retraces one', () => {
		// the training page's stored runs come from the same code and seeds: where the sweep and
		// they overlap (widths 16, 32, 64 on 10,000, 100,000 and all the characters), they agree
		for (const w of [16, 32, 64])
			for (const d of [10_000, 100_000, Infinity]) {
				const theirs = runOf(w, 32, d).points;
				expect(curveOf(w, d)).toEqual(theirs);
			}
		// and a fresh run of the smallest model on 30,000 characters retraces its first 100 steps
		const text = readFileSync(
			new URL('../src/routes/ngram-text-models/tinyshakespeare.txt', import.meta.url),
			'utf8'
		);
		const chars = new Alphabet(text).chars;
		const index = new Map(chars.map((c, i) => [c, i]));
		const enc = (s: string) => Int32Array.from(Array.from(s), (c) => index.get(c) ?? 0);
		const { train, heldOut } = split(text);
		const run = new Run(chars, enc(train), enc(heldOut), 8, 32, 30_000);
		while (run.step < 100) run.advance();
		const stored = curveOf(8, 30_000).filter((p) => p.step <= 100);
		expect(run.progress.points.length).toBe(stored.length);
		run.progress.points.forEach((p, i) => {
			expect(p.val).toBeCloseTo(stored[i].val, 4);
			expect(p.train).toBeCloseTo(stored[i].train, 4);
		});
	});

	test('sizes are counted without the embeddings, as Kaplan et al. count them', () => {
		// width 32: 30,721 weights in all (the training page's count), 25,472 in its blocks
		expect(totalWeights(32)).toBe(30_721);
		expect(blockWeights(32)).toBe(25_472);
		expect(blockWeights(8)).toBe(1_760);
		expect(blockWeights(96)).toBe(223_872);
	});

	test('with all the text the loss falls as a power law in size, then bends', () => {
		const pts = bySize(Infinity);
		const law = fitPowerLaw(pts.slice(0, 4).map((p) => ({ x: p.N, y: p.loss })));
		expect(law.alpha).toBeCloseTo(0.067, 3);
		expect(law.worst).toBeLessThan(0.005); // the four points lie on the line
		expect((1 - 2 ** -law.alpha) * 100).toBeCloseTo(4.5, 1);
		// the two largest end about 0.1 nats above it
		for (const p of pts.slice(5)) expect(p.loss - powerLaw(law, p.N)).toBeCloseTo(0.1, 1);
	});

	test('with 10,000 characters the size makes no difference: the text is the bottleneck', () => {
		const pts = bySize(10_000);
		const law = fitPowerLaw(pts.slice(0, 4).map((p) => ({ x: p.N, y: p.loss })));
		expect(law.alpha).toBeLessThan(0.01);
		for (const p of pts) {
			expect(p.loss).toBeGreaterThan(2.72);
			expect(p.loss).toBeLessThan(2.83);
		}
	});

	test('more text helps a wide model far more than a narrow one', () => {
		const slope = (w: number) => fitPowerLaw(byWidth(w).map((p) => ({ x: p.D, y: p.loss }))).alpha;
		expect(slope(96)).toBeCloseTo(0.095, 3);
		expect(slope(8)).toBeCloseTo(0.041, 3);
		const w96 = byWidth(96);
		const w8 = byWidth(8);
		expect(w96[0].loss).toBeCloseTo(2.76, 2);
		expect(w96[4].loss).toBeCloseTo(1.76, 2);
		expect(w8[0].loss).toBeCloseTo(2.83, 2);
		expect(w8[4].loss).toBeCloseTo(2.31, 2);
		// the point the page retrains: width 8 on all the text, lowest at the last step
		const live = pointOf(8, Infinity);
		expect(live.loss).toBe(2.3092);
		expect(live.step).toBe(3000);
	});
});
