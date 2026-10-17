// Checks the diffusion-models model: Ho et al.'s noise schedule and the numbers the page quotes
// from it; the step-by-step noising chain has the closed-form marginal and forgets where it
// started; the trained 2-D network guesses the data's middle from pure noise and the nearest
// moon from little noise; sampling lands on the moons, better with more steps; guidance sends
// the points to the moon asked for and too much of it overshoots; the shipped digit runs are
// read as the digit asked for by the convolution-vision page's network; and their finished digits
// are as far from the training digits as real test digits are. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	BETAS,
	MNIST_NET,
	T,
	alphaBar,
	decodeWeights,
	gaussian,
	noisy,
	paramCount,
	predict,
	sample,
	schedule
} from '../src/routes/diffusion-models/ddpm';
import { rng } from '../src/lib/draw/math';
import { MOONS, WEIGHTS } from '../src/routes/diffusion-models/moons-model';
import { moon, onMoons } from '../src/routes/diffusion-models/moons';
import { CHECK, SEQUENCES, TRAIN } from '../src/routes/diffusion-models/mnist-sequences';
import { NEAREST, TEST } from '../src/routes/diffusion-models/mnist-nearest';
import { decodeWeights as cnnWeights, forward as cnn } from '../src/routes/convolution-vision/cnn';
import { WEIGHTS as CNN_WEIGHTS } from '../src/routes/convolution-vision/mnist-cnn';

const wt = decodeWeights(MOONS, WEIGHTS);
const pct = (v: number) => Math.round(v * 100);
const moons = (n: number, seed: number) => {
	const r = rng(seed);
	const g = gaussian(seed + 1);
	const xy = new Float32Array(2 * n);
	for (let i = 0; i < n; i++) xy.set(moon(r, g, i % 2), 2 * i);
	return xy;
};

test('the schedule is Ho et al.’s, and the quoted signal and noise fractions follow from it', () => {
	expect(BETAS[0]).toBeCloseTo(1e-4, 10);
	expect(BETAS[T - 1]).toBeCloseTo(0.02, 10);
	const s = (t: number) => Math.sqrt(alphaBar(t));
	const n = (t: number) => Math.sqrt(1 - alphaBar(t));
	expect(s(100)).toBeCloseTo(0.95, 2);
	expect(n(100)).toBeCloseTo(0.32, 2);
	expect(s(500)).toBeCloseTo(0.28, 2);
	expect(s(1000)).toBeCloseTo(0.006, 3);
	// the curves cross "around step 260"
	let cross = 0;
	while (s(cross) > n(cross)) cross++;
	expect(cross).toBe(260);
});

test('step-by-step noising has the one-go distribution, and forgets its start', () => {
	const g = gaussian(4);
	const N = 20000;
	for (const start of [
		[1.2, 0.6],
		[5, -3]
	]) {
		const at300 = { m: 0, v: 0 };
		const atT = { m: 0, v: 0 };
		for (let k = 0; k < N; k++) {
			let x = start[0];
			for (let t = 1; t <= T; t++) {
				const b = 1 - alphaBar(t) / alphaBar(t - 1);
				x = Math.sqrt(1 - b) * x + Math.sqrt(b) * g();
				if (t === 300) {
					at300.m += x / N;
					at300.v += (x * x) / N;
				}
			}
			atT.m += x / N;
			atT.v += (x * x) / N;
		}
		const sd = (o: { m: number; v: number }) => Math.sqrt(o.v - o.m * o.m);
		expect(at300.m).toBeCloseTo(Math.sqrt(alphaBar(300)) * start[0], 1);
		expect(sd(at300)).toBeCloseTo(Math.sqrt(1 - alphaBar(300)), 1);
		// at T, a standard normal whatever the start
		// (the mean is √ᾱ_T · x₀, under 1% of the start)
		expect(Math.abs(atT.m)).toBeLessThan(0.01 * Math.abs(start[0]) + 0.02);
		expect(sd(atT)).toBeCloseTo(1, 1);
	}
});

test('a sampler with fewer steps visits evenly spaced steps from T down to 1', () => {
	expect(schedule(T)).toEqual(Array.from({ length: T }, (_, i) => T - i));
	expect(schedule(1)).toEqual([T]);
	const s5 = schedule(5);
	expect(s5[0]).toBe(T);
	expect(s5[s5.length - 1]).toBe(1);
	expect(s5).toHaveLength(5);
});

test('the moon data are on the moons', () => {
	expect(onMoons(moons(4000, 9)).any).toBeGreaterThan(0.99);
});

test('from pure noise the network guesses the middle; from little noise, the nearest moon', () => {
	const x0 = moons(400, 21);
	const e = gaussian(5);
	const eps = Float32Array.from({ length: 800 }, () => e());
	const spread = (p: Float32Array) => {
		let mx = 0;
		let my = 0;
		for (let i = 0; i < 400; i++) {
			mx += p[2 * i] / 400;
			my += p[2 * i + 1] / 400;
		}
		let v = 0;
		for (let i = 0; i < 400; i++) v += ((p[2 * i] - mx) ** 2 + (p[2 * i + 1] - my) ** 2) / 400;
		return { mx, my, sd: Math.sqrt(v) };
	};
	// the data have spread about 1.2 around the origin; the t = 1000 guesses huddle near it
	const far = spread(predict(wt, noisy(x0, eps, 1000), 1000, null, 0));
	expect(far.sd).toBeLessThan(0.35);
	expect(Math.hypot(far.mx, far.my)).toBeLessThan(0.35);
	expect(spread(x0).sd).toBeGreaterThan(1);
	// "by step 50, nine in ten of them lie on a moon"
	expect(onMoons(predict(wt, noisy(x0, eps, 50), 50, null, 0)).any).toBeGreaterThan(0.85);
});

test('the denoise step’s own readout at t = 50: nine in ten guesses on a moon', () => {
	// the 120 arrows of the scene: its data (seeds 2024/2025, alternating moons) and noise (31)
	const r = rng(2024);
	const g = gaussian(2025);
	const xy = new Float32Array(120 * 2);
	for (let i = 0; i < 120; i++) xy.set(moon(r, g, i % 2), 2 * i);
	const n = gaussian(31);
	const eps = Float32Array.from({ length: 120 * 2 }, () => n());
	expect(pct(onMoons(predict(wt, noisy(xy, eps, 50), 50, null, 0)).any)).toBeGreaterThanOrEqual(90);
});

test('sampling lands on the moons, better with more steps (the page’s numbers)', () => {
	const on = (steps: number) =>
		onMoons(sample(wt, { steps, seed: 1, label: null, guidance: 0, count: 400 }));
	const full = on(1000);
	expect(pct(full.any)).toBe(92);
	// both moons, in roughly equal parts
	expect(full.upper).toBeGreaterThan(0.35);
	expect(full.lower).toBeGreaterThan(0.35);
	expect(pct(on(100).any)).toBe(87);
	expect(pct(on(10).any)).toBe(62);
	expect(on(1).any).toBeLessThan(0.5);
});

test('guidance sends the points to the moon asked for; too much overshoots', () => {
	const run = (label: number | null, s: number) =>
		onMoons(sample(wt, { steps: 100, seed: 1, label, guidance: s, count: 400 }));
	const none = run(0, 0);
	expect(none.upper).toBeGreaterThan(0.3);
	expect(none.lower).toBeGreaterThan(0.3);
	expect(run(0, 1).upper).toBe(1);
	expect(run(1, 1).lower).toBe(1);
	expect(pct(run(0, 3).upper)).toBe(92);
	const s7 = run(0, 7);
	// the page quotes the share on the moon asked for (the upper one)
	expect(pct(s7.upper)).toBe(60);
	expect(s7.lower).toBeLessThan(0.01);
});

// ---- the precomputed digit runs ---------------------------------------------------------------

const unpack4 = (b64: string) => {
	const b = Buffer.from(b64, 'base64');
	const out = new Float32Array(b.length * 2);
	for (let i = 0; i < b.length; i++) {
		out[2 * i] = (b[i] >> 4) / 15;
		out[2 * i + 1] = (b[i] & 15) / 15;
	}
	return out; // 0 = paper, 1 = ink, as the digit reader expects
};
const reader = cnnWeights(CNN_WEIGHTS);
const reads = (b64: string) => cnn(reader, unpack4(b64)).digit;

test('the network diagram’s digit model is the one that was trained', () => {
	expect(paramCount(MNIST_NET)).toBe(TRAIN.params);
});

test('every stored run starts from noise and ends at a digit that is read as stored', () => {
	for (const s of SEQUENCES) {
		const last = s.frames[s.frames.length - 1];
		expect(last.t).toBe(0);
		expect(last.k).toBe(s.steps);
		expect(reads(last.x)).toBe(s.reads);
	}
});

test('guided runs (s = 3, 1000 steps) are read as the digit asked for', () => {
	const main = SEQUENCES.filter((s) => s.guidance === 3 && s.steps === T);
	expect(main).toHaveLength(30);
	const right = main.filter((s) => s.reads === s.digit).length;
	expect(right).toBeGreaterThanOrEqual(27);
});

test('guidance raises how often a generated digit is read as the one asked for', () => {
	const rate = (g: number) => {
		const c = CHECK.find((x) => x.guidance === g);
		if (!c) throw new Error(`no check for ${g}`);
		return c.right / c.of;
	};
	// unguided, a digit matches the prompt only by chance (about 1 in 10)
	expect(rate(0)).toBeLessThan(0.2);
	expect(rate(1)).toBeGreaterThan(rate(0) + 0.4);
	expect(rate(3)).toBeGreaterThan(0.9);
});

test('the digit runs the page describes', () => {
	const run = (digit: number, guidance: number, steps = T) => {
		const s = SEQUENCES.find(
			(x) => x.digit === digit && x.seed === 1 && x.guidance === guidance && x.steps === steps
		);
		if (!s) throw new Error(`no run ${digit} ${guidance} ${steps}`);
		return s;
	};
	// guidance: the same noise, "4" and "7" at 0, 1, 3, 7
	expect(run(4, 0).reads).toBe(7);
	expect(run(7, 0).reads).toBe(7);
	expect(run(4, 1).reads).toBe(9);
	expect(run(4, 3).reads).toBe(4);
	// steps: every step count gives a 2
	for (const n of [1, 5, 20, 100, T]) expect(run(2, 3, n).reads).toBe(2);
	// the guess takes shape early: at t = 700 it already resembles the final digit, x_t does not
	const corr = (a: Float32Array, b: Float32Array) => {
		const n = a.length;
		let ma = 0;
		let mb = 0;
		for (let i = 0; i < n; i++) {
			ma += a[i] / n;
			mb += b[i] / n;
		}
		let s = 0;
		let sa = 0;
		let sb = 0;
		for (let i = 0; i < n; i++) {
			s += (a[i] - ma) * (b[i] - mb);
			sa += (a[i] - ma) ** 2;
			sb += (b[i] - mb) ** 2;
		}
		return s / Math.sqrt(sa * sb);
	};
	const three = run(3, 3);
	const at700 = three.frames.find((f) => f.t === 700);
	if (!at700) throw new Error('no frame at t = 700');
	const final = unpack4(three.frames[three.frames.length - 1].x);
	expect(corr(unpack4(at700.x0), final)).toBeGreaterThan(0.7);
	expect(corr(unpack4(at700.x), final)).toBeLessThan(0.2);
});

// ---- generated, not copied ----------------------------------------------------------------
// The page's notes on the digit step: "Generated, not copied: the 30 finished digits stored here
// are on average as far (in pixel distance) from their nearest training digit as real test
// digits, which the network never saw, are from theirs, and none is a near-copy."
// mnist-nearest.ts holds, for every stored run, its nearest training digit (found over all 60,000
// by scripts/data/diffusion-models/nearest.mjs), and the same distance for the 10,000 test digits.

/** Euclidean distance on the network's scale (−1 = paper, 1 = ink), from two 4-bit images. */
const distance = (a: string, b: string) => {
	const x = unpack4(a);
	const y = unpack4(b);
	let s = 0;
	for (let i = 0; i < x.length; i++) s += (2 * (x[i] - y[i])) ** 2;
	return Math.sqrt(s);
};
const finished = (s: (typeof SEQUENCES)[number]) => s.frames[s.frames.length - 1].x;
const testOf = (digit: number) => {
	const t = TEST.find((x) => x.digit === digit);
	if (!t) throw new Error(`no test digits of ${digit}`);
	return t;
};
/** Percentile rank (0 … 100) of a distance among the test digits of the same class. */
const rank = (digit: number, d: number) => testOf(digit).percentiles.filter((p) => p < d).length;

test('the nearest-training-digit record is of the digits shipped', () => {
	expect(NEAREST).toHaveLength(SEQUENCES.length);
	SEQUENCES.forEach((s, i) => {
		const n = NEAREST[i];
		expect([n.digit, n.seed, n.guidance, n.steps]).toEqual([s.digit, s.seed, s.guidance, s.steps]);
		// the stored distance is the one between the finished digit and the stored training digit
		expect(distance(finished(s), n.pixels)).toBeCloseTo(n.distance, 2);
	});
	expect(TEST.reduce((a, t) => a + t.n, 0)).toBe(10000);
});

test('generated, not copied: as far from the training digits as unseen test digits', () => {
	const main = SEQUENCES.map((s, i) => ({ s, n: NEAREST[i] })).filter(
		({ s }) => s.guidance === 3 && s.steps === T
	);
	expect(main).toHaveLength(30);
	// "on average as far": 3 runs per digit, so compare with the test digits' mean taken digit
	// by digit (1s are close to other 1s, 8s far from other 8s)
	const mean = main.reduce((a, { n }) => a + n.distance, 0) / main.length;
	const testMean = TEST.reduce((a, t) => a + t.mean, 0) / TEST.length;
	expect(mean / testMean).toBeGreaterThan(0.9);
	expect(mean / testMean).toBeLessThan(1.1);
	// and among the test digits of their own class they sit in the middle, not at the near end
	const ranks = main.map(({ s, n }) => rank(s.digit, n.distance));
	const meanRank = ranks.reduce((a, r) => a + r, 0) / ranks.length;
	expect(meanRank).toBeGreaterThan(35);
	expect(meanRank).toBeLessThan(65);
	// "none is a near-copy": each is further from its nearest training digit than the closest of
	// the test digits of its class, real digits written by other people (at present the closest
	// generated digit is still further than about 1 in 10 of them)
	for (const { s, n } of main) expect(n.distance).toBeGreaterThan(testOf(s.digit).percentiles[0]);
});
