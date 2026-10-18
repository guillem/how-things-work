// Checks the positional-encoding explainer's model against the mathematical facts the page rests
// on: attention without a mask cannot see order (and with the causal mask it can), the sinusoids'
// frequencies run from one radian per position to 1/10000, a fixed offset is a linear map that does
// not depend on the position, and RoPE scores depend only on the distance between query and key,
// to floating-point precision, while added sinusoids do not. Checked on many random vectors, not
// only on the ones the page draws.
import { expect, test } from '@playwright/test';
import {
	apply,
	attention,
	frequencies,
	HEAD,
	offsetMap,
	order,
	outsideTraining,
	PAIR,
	pairOf,
	random,
	rope,
	sinusoid,
	sweep,
	unfinished,
	wavelengths,
	WORDS,
	embed,
	type Vec
} from '../src/routes/positional-encoding/position';

const maxDiff = (a: readonly Vec[], b: readonly Vec[]) =>
	Math.max(...a.flatMap((row, i) => row.map((x, j) => Math.abs(x - b[i][j]))));

test.describe('attention and order', () => {
	test('without a mask, shuffling the tokens only shuffles the outputs', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const r = random(seed);
			const head = { wq: r.matrix(8), wk: r.matrix(8), wv: r.matrix(8) };
			const xs = Array.from({ length: 7 }, () => r.vector(8));
			const perm = xs.map((_, i) => i).sort(() => r.uniform() - 0.5);
			const out = attention(xs, head).out;
			const shuffled = attention(
				perm.map((i) => xs[i]),
				head
			).out;
			expect(
				maxDiff(
					shuffled,
					perm.map((i) => out[i])
				)
			).toBeLessThan(1e-12);
		}
	});

	test('with the causal mask, the order changes the outputs', () => {
		const xs = WORDS.map(embed);
		const perm = order(1); // the man bit the dog
		const out = attention(xs, HEAD, true).out;
		const shuffled = attention(
			perm.map((i) => xs[i]),
			HEAD,
			true
		).out;
		expect(
			maxDiff(
				shuffled,
				perm.map((i) => out[i])
			)
		).toBeGreaterThan(0.5);
		// The first token can only attend to itself.
		expect(attention(xs, HEAD, true).weights[0][0]).toBe(1);
	});

	test('with the mask, a token that sees the same set of tokens keeps its output', () => {
		const xs = WORDS.map(embed);
		const open = attention(xs, HEAD).out;
		for (let n = 1; n < 10; n++) {
			const perm = order(n);
			const out = attention(
				perm.map((i) => xs[i]),
				HEAD,
				true
			).out;
			// the word in the last place sees the whole sentence: the same output as with no mask
			expect(maxDiff([out[4]], [open[perm[4]]])).toBeLessThan(1e-12);
		}
	});

	test('every shuffle the page offers is a permutation of the sentence', () => {
		for (let n = 0; n < 30; n++) expect([...order(n)].sort()).toEqual([0, 1, 2, 3, 4]);
		expect(
			order(1)
				.map((i) => WORDS[i])
				.join(' ')
		).toBe('the man bit the dog');
	});
});

test.describe('the sinusoidal encoding', () => {
	test('wavelengths run from 2π to nearly 10000 · 2π, in a geometric progression', () => {
		for (const d of [16, 64, 512]) {
			const w = wavelengths(d);
			expect(w[0]).toBeCloseTo(2 * Math.PI, 12);
			const ratios = w.slice(1).map((x, i) => x / w[i]);
			for (const q of ratios) expect(q).toBeCloseTo(ratios[0], 9);
			// the slowest pair: 10000^((d − 2)/d) · 2π, which tends to 10000 · 2π as d grows
			expect(w.at(-1)! / (2 * Math.PI)).toBeCloseTo(10000 ** ((d - 2) / d), 6);
		}
		expect(wavelengths(512).at(-1)! / (2 * Math.PI * 10000)).toBeGreaterThan(0.96);
	});

	test('each pair is a point on the unit circle', () => {
		for (const pos of [0, 1, 17, 1000]) {
			const pe = sinusoid(pos, 16);
			for (let i = 0; i < 8; i++) expect(pe[2 * i] ** 2 + pe[2 * i + 1] ** 2).toBeCloseTo(1, 12);
		}
		// position 0: every angle is 0, so every sine is 0 and every cosine 1
		expect(sinusoid(0, 6)).toEqual([0, 1, 0, 1, 0, 1]);
	});

	test('a fixed offset is the same linear map at every position', () => {
		for (const k of [1, 5, 40]) {
			const m = offsetMap(k, 16);
			for (const pos of [0, 3, 100, 5000]) {
				const moved = apply(m, sinusoid(pos, 16));
				expect(maxDiff([moved], [sinusoid(pos + k, 16)])).toBeLessThan(1e-9);
			}
		}
	});

	test('fast pairs tell neighbours apart, slow pairs tell far positions apart', () => {
		const angle = (pos: number, i: number) => {
			const pe = sinusoid(pos, 16);
			return Math.atan2(pe[2 * i], pe[2 * i + 1]);
		};
		const gap = (a: number, b: number) => {
			const d = Math.abs(a - b) % (2 * Math.PI);
			return Math.min(d, 2 * Math.PI - d);
		};
		// neighbours: the fastest pair moves a whole radian, the slowest almost nothing
		expect(gap(angle(10, 0), angle(11, 0))).toBeCloseTo(1, 9);
		expect(gap(angle(10, 7), angle(11, 7))).toBeLessThan(0.001);
		// 0 and 44: the fastest pair is back where it started within 0.02 rad (44 ≈ 7 turns),
		// the slowest pair is still clearly apart from 0
		expect(gap(angle(0, 0), angle(44, 0))).toBeLessThan(0.02);
		expect(gap(angle(0, 4), angle(44, 4))).toBeGreaterThan(0.4);
	});

	test('the dot product of two encodings depends only on their distance', () => {
		for (const k of [0, 3, 30]) {
			const ref = sinusoid(0, 16).reduce((s, x, i) => s + x * sinusoid(k, 16)[i], 0);
			for (const pos of [5, 77, 2000]) {
				const a = sinusoid(pos, 16);
				const b = sinusoid(pos + k, 16);
				expect(a.reduce((s, x, i) => s + x * b[i], 0)).toBeCloseTo(ref, 9);
			}
		}
	});
});

test.describe('rotary position embedding', () => {
	test('a RoPE score depends only on the distance, to floating-point precision', () => {
		for (let seed = 1; seed <= 20; seed++) {
			const p = pairOf(16, seed);
			for (const [m, n] of [
				[0, 0],
				[9, 3],
				[3, 9],
				[40, 1]
			])
				for (const s of [1, 17, 1000, 100000])
					expect(Math.abs(p.rope(m + s, n + s) - p.rope(m, n))).toBeLessThan(1e-9);
		}
	});

	test('at distance 0 the rotation changes nothing: the plain q·k score', () => {
		for (const pos of [0, 12, 999]) expect(PAIR.rope(pos, pos)).toBeCloseTo(PAIR.plain(), 12);
	});

	test('it rotates: lengths are kept', () => {
		const r = random(9);
		const v = r.vector(16);
		const len = (x: Vec) => Math.hypot(...x);
		for (const pos of [1, 50, 4096]) expect(len(rope(v, pos))).toBeCloseTo(len(v), 12);
	});

	test('the distance still matters: different distances give different scores', () => {
		for (let seed = 1; seed <= 10; seed++) {
			const p = pairOf(16, seed);
			const scores = Array.from({ length: 40 }, (_, d) => p.rope(30 + d, 30));
			expect(Math.max(...scores) - Math.min(...scores)).toBeGreaterThan(0.2);
		}
	});

	test('with added sinusoids, the score drifts with where the pair stands', () => {
		for (let seed = 1; seed <= 10; seed++) {
			const p = pairOf(16, seed);
			const at = [0, 7, 19, 33].map((s) => p.sinusoid(s + 5, s));
			expect(Math.max(...at) - Math.min(...at)).toBeGreaterThan(0.05);
		}
	});
});

test.describe('past the training length', () => {
	test('16 dimensions trained on 64 positions: five of the eight pairs never complete a turn', () => {
		expect(unfinished(64, 16)).toBe(5);
		const a = sweep(64, 16);
		expect(a[0]).toBeCloseTo(63, 9); // the fastest pair turns ten times
		expect(a[2]).toBeGreaterThan(2 * Math.PI); // the third just completes one
		expect(a[7]).toBeLessThan(0.05); // the slowest, little more than a degree
		expect(sweep(1024, 16)[7]).toBeGreaterThan(16 * a[7]); // a longer text reaches new angles
	});

	test('a hand that has gone round past its trained arc can point back inside it', () => {
		// pair 4 swept 114° over positions 0–63
		expect(outsideTraining(63, 3, 64, 16)).toBe(false);
		expect(outsideTraining(100, 3, 64, 16)).toBe(true); // 181°
		expect(outsideTraining(1023, 3, 64, 16)).toBe(false); // 32.3 rad, 54° round the circle
		// a pair that completed a turn in training is never outside
		expect(outsideTraining(1023, 0, 64, 16)).toBe(false);
	});

	test('a head of 128 dimensions trained on 4,096 tokens: 18 of its 64 pairs never turn once', () => {
		expect(frequencies(128)).toHaveLength(64);
		expect(unfinished(4096, 128)).toBe(18);
	});
});
