// Checks the probability model behind the central-limit-theorem explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	SHAPES,
	binomial,
	galton,
	mean,
	meanBars,
	normalChance,
	sampleMeans,
	sd
} from '../src/routes/central-limit-theorem/clt';

const avg = (a: ArrayLike<number>) => Array.from(a).reduce((s, v) => s + v, 0) / a.length;
const spread = (a: ArrayLike<number>) => {
	const m = avg(a);
	return Math.sqrt(Array.from(a).reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

test('Galton board: the bins follow the binomial chances', () => {
	let total = 0;
	for (let k = 0; k <= 10; k++) total += binomial(10, k);
	expect(total).toBeCloseTo(1, 12);
	expect(binomial(10, 5)).toBeCloseTo(252 / 1024, 12);
	const { bins } = galton(10, 20000, 3);
	bins.forEach((c, k) => expect(Math.abs(c / 20000 - binomial(10, k))).toBeLessThan(0.01));
});

test('sample means centre on the mean, with spread σ/√n', () => {
	for (const shape of Object.values(SHAPES)) {
		for (const n of [1, 4, 16]) {
			const m = sampleMeans(shape, n, 20000, 7);
			expect(Math.abs(avg(m) - mean(shape))).toBeLessThan(0.01);
			expect(spread(m) / (sd(shape) / Math.sqrt(n))).toBeCloseTo(1, 1);
		}
	}
});

test('even from two humps, averages of 30 make one bell: most within ±2σ/√n', () => {
	const shape = SHAPES.twoHumps;
	const n = 30;
	const m = sampleMeans(shape, n, 20000, 11);
	const s = sd(shape) / Math.sqrt(n);
	const inside = Array.from(m).filter((v) => Math.abs(v - mean(shape)) < 2 * s).length / m.length;
	expect(inside).toBeGreaterThan(0.93); // a bell curve has 95% within ±2σ
	expect(inside).toBeLessThan(0.97);
	// …whereas single draws from two humps are mostly far from the middle.
	const singles = sampleMeans(shape, 1, 20000, 11);
	const near =
		Array.from(singles).filter((v) => Math.abs(v - mean(shape)) < 0.1).length / singles.length;
	expect(near).toBeLessThan(0.1);
});

/** Exact chances of each sum of n bar indices (0 … 19n) for draws from w. */
function sumChances(w: number[], n: number) {
	const p = w.map((v) => Math.max(0, v));
	const s = p.reduce((a, b) => a + b, 0);
	const q = p.map((v) => v / s);
	let dist = [1];
	for (let k = 0; k < n; k++) {
		const next = new Array<number>(dist.length + q.length - 1).fill(0);
		dist.forEach((a, i) => q.forEach((b, j) => (next[i + j] += a * b)));
		dist = next;
	}
	return dist;
}
test('the histogram of averages of 30 or more is a smooth bell, for every starting shape', () => {
	for (const [name, shape] of Object.entries(SHAPES)) {
		for (const n of [29, 30, 31, 50]) {
			const mu = mean(shape);
			const s = sd(shape) / Math.sqrt(n);
			const bars = meanBars(shape, n);
			const share = new Map<number, number>();
			sumChances(shape, n).forEach((pr, sum) => {
				if (pr === 0) return;
				const b = bars.barOf((sum + n / 2) / (20 * n));
				share.set(b, (share.get(b) ?? 0) + pr);
			});
			let within = 0;
			for (const [b, pr] of share) {
				const a = bars.left(b);
				const c = a + bars.width / 2;
				if (Math.abs(c - mu) > s) continue;
				within++;
				// the share in each bar near the centre is what the bell curve predicts
				const bell = normalChance(a, a + bars.width, mu, s);
				expect(pr / bell, `${name}, n = ${n}, bar at ${c.toFixed(3)}`).toBeGreaterThan(0.85);
				expect(pr / bell, `${name}, n = ${n}, bar at ${c.toFixed(3)}`).toBeLessThan(1.15);
			}
			// fine enough to show a bell: several bars across ±σ/√n
			expect(within, `${name}, n = ${n}`).toBeGreaterThanOrEqual(4);
		}
	}
});
