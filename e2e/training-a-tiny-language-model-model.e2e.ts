// Checks the tiny GPT the training page trains: its backward pass is the true gradient (central
// finite differences on a small model), an untrained model is no better than a uniform guess
// (ln 65 nats per character), gradient descent really drives the held-out loss below the
// smoothed bigram's in a few hundred steps, the Kneser–Ney baselines are proper distributions,
// and the stored runs are what the page's code produces from its seeds. The results the
// narrative quotes (who beats which line, and the small-data run memorising) are checked on the
// stored runs.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Alphabet, split } from '../src/routes/ngram-text-models/ngram';
import { KneserNey } from '../src/routes/training-a-tiny-language-model/baselines';
import {
	AdamW,
	evaluate,
	fillBatch,
	initWeights,
	TinyGPT,
	type Config
} from '../src/routes/training-a-tiny-language-model/tiny-gpt';
import {
	DEFAULT,
	Run,
	SETTINGS,
	segments,
	targets
} from '../src/routes/training-a-tiny-language-model/train';
import { rng } from '../src/lib/draw/math';
import { data } from '../src/routes/training-a-tiny-language-model/runs-data';
import {
	runOf,
	finalOf,
	minVal,
	perplexity
} from '../src/routes/training-a-tiny-language-model/runs';

const text = readFileSync(
	new URL('../src/routes/ngram-text-models/tinyshakespeare.txt', import.meta.url),
	'utf8'
);
const chars = new Alphabet(text).chars;
const index = new Map(chars.map((c, i) => [c, i]));
const enc = (s: string) => Int32Array.from(Array.from(s), (c) => index.get(c) ?? 0);
const parts = split(text);
const train = enc(parts.train);
const val = enc(parts.heldOut);

test('Tiny Shakespeare has 65 distinct characters', () => {
	expect(chars.length).toBe(65);
});

test('the backward pass is the gradient of the loss (finite differences)', () => {
	const c: Config = { vocab: 5, width: 8, context: 4, heads: 2, layers: 2 };
	const w = initWeights(c, 3);
	// larger weights than at initialisation, so every nonlinearity is exercised
	const r = rng(9);
	for (let i = 0; i < w.length; i++) w[i] += 0.4 * (r() - 0.5);
	const m = new TinyGPT(c, w, 2);
	const tokens = [0, 3, 1, 4, 2, 2, 4, 1];
	const next = [3, 1, 4, 2, 2, 0, 0, 3];
	m.forward(tokens, 2, 4);
	m.backward(tokens, next);
	const grad = m.grads.slice();
	let worst = 0;
	const h = 1e-5;
	for (let i = 0; i < w.length; i++) {
		const o = w[i];
		w[i] = o + h;
		m.forward(tokens, 2, 4);
		const up = m.loss(next);
		w[i] = o - h;
		m.forward(tokens, 2, 4);
		const down = m.loss(next);
		w[i] = o;
		const num = (up - down) / (2 * h);
		// relative error, with an absolute floor for gradients that are exactly zero (the key
		// biases: adding the same amount to every score of a softmax changes nothing)
		const err = Math.abs(num - grad[i]) / (1e-6 + Math.abs(num) + Math.abs(grad[i]));
		worst = Math.max(worst, err);
	}
	expect(worst).toBeLessThan(1e-4);
});

test('an untrained model guesses uniformly: ln 65 ≈ 4.17 nats per character', () => {
	const run = new Run(chars, train, val, DEFAULT.width, DEFAULT.context, DEFAULT.data);
	const first = run.progress.points[0];
	expect(first.step).toBe(0);
	expect(Math.abs(first.val - Math.log(65))).toBeLessThan(0.02);
	expect(Math.abs(first.train - Math.log(65))).toBeLessThan(0.02);
});

test('gradient descent drives the held-out loss below the smoothed bigram', () => {
	// a smaller model than the page's, for speed; same optimiser
	const c: Config = { vocab: 65, width: 16, context: 16, heads: 4, layers: 2 };
	const m = new TinyGPT(c, initWeights(c, 1), 64);
	const opt = new AdamW(m.L, { ...SETTINGS, steps: 300, lr: 0.01, minLr: 0.001, warmup: 30 });
	const random = rng(2);
	const B = 32;
	const tokens = new Int32Array(B * 16);
	const next = new Int32Array(B * 16);
	for (let s = 0; s < 300; s++) {
		fillBatch(train, B, 16, random, tokens, next);
		m.forward(tokens, B, 16);
		m.backward(tokens, next);
		opt.step(m.weights, m.grads);
	}
	const loss = evaluate(m, val, segments(val.length));
	const bigram = new KneserNey(train, 2, 65).crossEntropy(val, targets(val.length));
	expect(loss).toBeLessThan(bigram);
});

test('the Kneser–Ney baselines are distributions over the alphabet', () => {
	const t = train.subarray(0, 100_000);
	for (const n of [2, 3, 5]) {
		const m = new KneserNey(t, n, 65);
		for (const p of [1, 7, 500, 40_000]) {
			let sum = 0;
			for (let c = 0; c < 65; c++) {
				const q = m.prob(val, p, c);
				expect(q).toBeGreaterThan(0);
				sum += q;
			}
			expect(sum).toBeCloseTo(1, 10);
		}
	}
});

test('a longer smoothed n-gram scores lower on the held-out text, given enough data', () => {
	const at = targets(val.length);
	const ce = [2, 3, 5].map((n) => new KneserNey(train, n, 65).crossEntropy(val, at));
	expect(ce[0]).toBeGreaterThan(ce[1]);
	expect(ce[1]).toBeGreaterThan(ce[2]);
	// the shipped lines are these numbers
	expect(data.baselines.all.n2).toBeCloseTo(ce[0], 3);
	expect(data.baselines.all.n3).toBeCloseTo(ce[1], 3);
	expect(data.baselines.all.n5).toBeCloseTo(ce[2], 3);
});

test('the stored default run is what the page’s code computes from its seeds', () => {
	const run = new Run(chars, train, val, DEFAULT.width, DEFAULT.context, DEFAULT.data);
	for (let i = 0; i < 20; i++) run.advance();
	const stored = runOf(DEFAULT.width, DEFAULT.context, DEFAULT.data);
	for (const p of run.progress.points) {
		const s = stored.points.find((q) => q.step === p.step);
		expect(s, `step ${p.step}`).toBeDefined();
		expect(s?.train).toBeCloseTo(p.train, 4);
		expect(s?.val).toBeCloseTo(p.val, 4);
	}
	expect(run.progress.samples[0].text).toBe(stored.samples[0].text);
});

test('trained on all the text, the default run ends below the bigram and trigram lines', () => {
	const end = finalOf(runOf(DEFAULT.width, DEFAULT.context, DEFAULT.data));
	expect(end.val).toBeLessThan(data.baselines.all.n2);
	expect(end.val).toBeLessThan(data.baselines.all.n3);
	expect(perplexity(end.val)).toBeLessThan(Math.exp(data.baselines.all.n3));
});

test('a wider model and a longer context end lower', () => {
	const d = DEFAULT.data;
	const v = (w: number, c: number) => finalOf(runOf(w, c, d)).val;
	expect(v(16, 32)).toBeGreaterThan(v(32, 32));
	expect(v(32, 32)).toBeGreaterThan(v(64, 32));
	expect(v(32, 8)).toBeGreaterThan(v(32, 32));
});

test('with 10,000 characters the curves split: training loss falls as held-out loss rises', () => {
	const run = runOf(DEFAULT.width, DEFAULT.context, 10_000);
	const end = finalOf(run);
	expect(end.val - end.train).toBeGreaterThan(1);
	expect(end.val).toBeGreaterThan(minVal(run).val + 0.3);
	// on all the text the gap stays small and the held-out loss is still at its lowest
	const all = runOf(DEFAULT.width, DEFAULT.context, DEFAULT.data);
	const big = finalOf(all);
	expect(big.val - big.train).toBeLessThan(0.25);
	expect(big.val - minVal(all).val).toBeLessThan(0.01);
});
