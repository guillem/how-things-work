// Checks the resampling page's model against known results: the permutation p-value against an
// exact enumeration and against the large-sample normal approximation; the bootstrap standard
// error of a mean against s/√n and of a slope against the least-squares formula; and the real
// coverage of the percentile interval (near 95% for a large normal sample, clearly short for a
// small skewed one, and near zero for the maximum). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	COMPARISONS,
	PENGUINS,
	bootstrapDiffs,
	bootstrapMeans,
	bootstrapSlopes,
	coverageRun,
	massVsFlipper,
	meanOf,
	ols,
	percentileInterval,
	permutationTest,
	pick,
	population,
	sdOf
} from '../src/routes/resampling-inference/resample';

/** Standard normal CDF (Abramowitz & Stegun 26.2.17, error below 7.5·10⁻⁸). */
function phi(z: number) {
	const t = 1 / (1 + 0.2316419 * Math.abs(z));
	const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
	const q =
		d *
		t *
		(0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
	return z >= 0 ? 1 - q : q;
}

const coverage = (c: Uint8Array) => c.reduce((s, v) => s + v, 0) / c.length;

test('the data: 342 measured penguins, 151 Adelie and 68 Chinstrap, flippers 5.9 mm apart on average', () => {
	expect(PENGUINS).toHaveLength(342);
	const { a, b } = COMPARISONS.species;
	expect(a.values).toHaveLength(151);
	expect(b.values).toHaveLength(68);
	expect(meanOf(a.values)).toBeCloseTo(189.95, 2);
	expect(meanOf(b.values)).toBeCloseTo(195.82, 2);
});

test('permutation p-value: matches the exact enumeration of every relabelling of a small sample', () => {
	const { a, b } = COMPARISONS.species;
	const xa = pick(a.values, 4, 3);
	const xb = pick(b.values, 4, 3);
	const pooled = [...xa, ...xb];
	const obs = Math.abs(meanOf(xb) - meanOf(xa));
	// all C(8, 4) = 70 ways to choose which four values are labelled b
	let extreme = 0;
	let all = 0;
	for (let m = 0; m < 256; m++) {
		if (m.toString(2).split('1').length - 1 !== 4) continue;
		const inB = pooled.filter((_, i) => m & (1 << i));
		const inA = pooled.filter((_, i) => !(m & (1 << i)));
		all++;
		if (Math.abs(meanOf(inB) - meanOf(inA)) >= obs - 1e-9) extreme++;
	}
	expect(all).toBe(70);
	const exact = extreme / all;
	const mc = permutationTest(xa, xb, 20_000, 5).p;
	// Monte Carlo error with 20,000 shuffles: at most √(0.25 / 20,000) ≈ 0.0035
	expect(Math.abs(mc - exact)).toBeLessThan(0.012);
});

test('permutation p-value: agrees with the large-sample normal approximation (Torgersen vs Biscoe)', () => {
	const { a, b } = COMPARISONS.torgersen;
	const r = permutationTest(a.values, b.values, 9999, 1);
	const se = Math.sqrt(
		sdOf(a.values) ** 2 / a.values.length + sdOf(b.values) ** 2 / b.values.length
	);
	const pNormal = 2 * (1 - phi(Math.abs(r.observed) / se));
	expect(pNormal).toBeGreaterThan(0.05);
	expect(Math.abs(r.p - pNormal)).toBeLessThan(0.01);
});

test('with all the penguins no shuffle reaches 5.9 mm: p = 1 / (9,999 + 1), never 0', () => {
	const { a, b } = COMPARISONS.species;
	const r = permutationTest(a.values, b.values, 9999, 1);
	expect(r.extreme).toBe(0);
	expect(r.p).toBeCloseTo(1e-4, 10);
});

test('a real difference can still give a large p-value when the sample is small', () => {
	const { a, b } = COMPARISONS.species;
	const r = permutationTest(pick(a.values, 5, 1), pick(b.values, 5, 1), 9999, 1);
	expect(r.p).toBeGreaterThan(0.05);
});

test('bootstrap standard error of a mean ≈ s/√n', () => {
	const x = COMPARISONS.species.a.values;
	const boot = bootstrapMeans(x, 4000, 3);
	const formula = sdOf(x) / Math.sqrt(x.length);
	expect(Math.abs(sdOf(boot) / formula - 1)).toBeLessThan(0.05);
});

test('bootstrap interval of the difference: about ±1.96 standard errors around it for large samples', () => {
	const { a, b } = COMPARISONS.species;
	const d = meanOf(b.values) - meanOf(a.values);
	const se = Math.sqrt(
		sdOf(a.values) ** 2 / a.values.length + sdOf(b.values) ** 2 / b.values.length
	);
	const [lo, hi] = percentileInterval(bootstrapDiffs(a.values, b.values, 4000, 2));
	expect(Math.abs(lo - (d - 1.96 * se))).toBeLessThan(0.25 * se);
	expect(Math.abs(hi - (d + 1.96 * se))).toBeLessThan(0.25 * se);
});

test('bootstrap slope: body mass rises about 33 g per mm of flipper in Adelie penguins, with the textbook standard error', () => {
	const { x, y } = massVsFlipper('Adelie');
	const fit = ols(x, y);
	expect(fit.slope).toBeGreaterThan(30);
	expect(fit.slope).toBeLessThan(36);
	const boot = bootstrapSlopes(x, y, 3000, 1);
	expect(Math.abs(sdOf(boot) / fit.se - 1)).toBeLessThan(0.12);
	const [lo, hi] = percentileInterval(boot);
	expect(lo).toBeGreaterThan(0);
	expect(lo).toBeLessThan(fit.slope);
	expect(hi).toBeGreaterThan(fit.slope);
});

test('the simulated population keeps its centre and spread while the skew changes its shape', () => {
	const normal = population(0);
	const skewed = population(1);
	expect(normal.mean).toBeCloseTo(50, 0);
	expect(skewed.mean).toBeCloseTo(50, 0);
	expect(Math.abs(normal.skewness)).toBeLessThan(0.1);
	expect(skewed.skewness).toBeGreaterThan(2);
});

test('coverage: near 95% for a large sample from a normal population', () => {
	const pop = population(0);
	const run = coverageRun(pop.values, 100, 'mean', 1000, 1000, 1);
	// Monte Carlo error with 1,000 repeats: about 0.7 percentage points
	expect(coverage(run.caught)).toBeGreaterThan(0.925);
	expect(coverage(run.caught)).toBeLessThan(0.965);
});

test('coverage: clearly below 95% for a small sample from a skewed population', () => {
	const pop = population(1);
	const run = coverageRun(pop.values, 10, 'mean', 1000, 1000, 1);
	expect(coverage(run.caught)).toBeLessThan(0.88);
	// the misses are lopsided: the interval falls short of the truth far more often than above it
	let below = 0;
	let above = 0;
	run.caught.forEach((c, r) => {
		if (!c && run.hi[r] < run.truth) below++;
		if (!c && run.lo[r] > run.truth) above++;
	});
	expect(below).toBeGreaterThan(3 * above);
});

test('coverage: badly off for the maximum, because no resample exceeds the sample’s largest value', () => {
	const pop = population(0);
	const run = coverageRun(pop.values, 50, 'max', 300, 500, 1);
	expect(coverage(run.caught)).toBeLessThan(0.1);
	run.hi.forEach((h, r) => expect(h).toBeLessThanOrEqual(run.est[r]));
});
