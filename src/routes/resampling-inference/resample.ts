/**
 * Resampling inference: the permutation test, the bootstrap, and a coverage experiment.
 *
 * 1. Permutation test. Two groups of penguins, a and b; the observed difference is
 *    mean(b) − mean(a). Under the null hypothesis the group labels are arbitrary, so shuffling
 *    them (keeping the group sizes) gives a difference chance alone could produce. Repeating it
 *    `shuffles` times builds the null distribution; the two-sided p-value counts the shuffles at
 *    least as far from 0 as the observed difference, with the +1 correction:
 *    p = (count + 1) / (shuffles + 1) (the observed labelling is itself one of the possible
 *    shuffles, so a Monte Carlo p-value is never 0).
 * 2. Bootstrap. Resample each group with replacement (same size), recompute the statistic, repeat;
 *    the spread of the bootstrap statistics estimates the standard error and their 2.5th and
 *    97.5th percentiles give the percentile interval. For a regression slope the (x, y) pairs are
 *    resampled together (the case bootstrap).
 * 3. Coverage. A simulated population of POP_SIZE values whose true mean and maximum are known;
 *    draw a sample of n, build its percentile interval, check whether it contains the truth, and
 *    repeat. The fraction caught is the interval's real coverage, which need not be 95%.
 *
 * Every random draw comes from a seeded generator, and shuffle / resample k has a stream of its
 * own (`stream(seed, k)`), so any one of them can be replayed for the drawing.
 */
import { rng } from '#lib/draw/math.ts';
import { PENGUINS_CSV } from './penguins-data';

// ------------------------------------------------------------ data

export type Species = 'Adelie' | 'Chinstrap' | 'Gentoo';

interface Penguin {
	species: Species;
	island: string;
	/** Flipper length, mm. */
	flipper: number;
	/** Body mass, g. */
	mass: number;
}

export const PENGUINS: readonly Penguin[] = PENGUINS_CSV.trim()
	.split('\n')
	.slice(1)
	.map((line) => {
		const [species, island, flipper, mass] = line.split(',');
		return { species: species as Species, island, flipper: Number(flipper), mass: Number(mass) };
	});

interface Group {
	name: string;
	/** Flipper lengths, mm, in the file's order. */
	values: number[];
}

/** The comparisons the reader can pick: the difference is mean(b) − mean(a). */
export const COMPARISONS: Record<string, { label: string; a: Group; b: Group }> = (() => {
	const flippers = (f: (p: Penguin) => boolean) => PENGUINS.filter(f).map((p) => p.flipper);
	return {
		species: {
			label: 'Adelie vs Chinstrap',
			a: { name: 'Adelie', values: flippers((p) => p.species === 'Adelie') },
			b: { name: 'Chinstrap', values: flippers((p) => p.species === 'Chinstrap') }
		},
		torgersen: {
			label: 'Adelie: Biscoe vs Torgersen island',
			a: {
				name: 'Biscoe',
				values: flippers((p) => p.species === 'Adelie' && p.island === 'Biscoe')
			},
			b: {
				name: 'Torgersen',
				values: flippers((p) => p.species === 'Adelie' && p.island === 'Torgersen')
			}
		},
		dream: {
			label: 'Adelie: Biscoe vs Dream island',
			a: {
				name: 'Biscoe',
				values: flippers((p) => p.species === 'Adelie' && p.island === 'Biscoe')
			},
			b: {
				name: 'Dream',
				values: flippers((p) => p.species === 'Adelie' && p.island === 'Dream')
			}
		}
	};
})();

/** Flipper length (x, mm) and body mass (y, g) of one species. */
export function massVsFlipper(species: Species) {
	const ps = PENGUINS.filter((p) => p.species === species);
	return { x: ps.map((p) => p.flipper), y: ps.map((p) => p.mass) };
}

// ------------------------------------------------------------ randomness

/** The seed of random stream k of a run seeded with `seed`. */
const stream = (seed: number, k: number) =>
	(Math.imul(seed + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0;

/**
 * `k` items of `values` drawn without replacement in a random order fixed by `seed` (all of
 * them, in their own order, when k covers the group): a smaller sample of the same penguins.
 */
export function pick(values: readonly number[], k: number, seed: number): number[] {
	if (k >= values.length) return values.slice();
	const idx = values.map((_, i) => i);
	const rand = rng(stream(seed, 999_983));
	for (let i = 0; i < k; i++) {
		const j = i + Math.floor(rand() * (idx.length - i));
		[idx[i], idx[j]] = [idx[j], idx[i]];
	}
	return idx.slice(0, k).map((i) => values[i]);
}

// ------------------------------------------------------------ summaries

export const meanOf = (x: ArrayLike<number>) => {
	let s = 0;
	for (let i = 0; i < x.length; i++) s += x[i];
	return s / x.length;
};

/** Sample standard deviation (n − 1 in the denominator). */
export const sdOf = (x: ArrayLike<number>) => {
	const m = meanOf(x);
	let s = 0;
	for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2;
	return Math.sqrt(s / (x.length - 1));
};

/** The q-quantile of sorted values (linear interpolation between order statistics). */
export function quantile(sorted: ArrayLike<number>, q: number) {
	const h = (sorted.length - 1) * q;
	const lo = Math.floor(h);
	const hi = Math.min(sorted.length - 1, lo + 1);
	return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** The central `level` percentile interval of a set of values (NaNs ignored). */
export function percentileInterval(values: ArrayLike<number>, level = 0.95): [number, number] {
	const s = Float64Array.from(values).filter((v) => !Number.isNaN(v));
	s.sort();
	return [quantile(s, (1 - level) / 2), quantile(s, (1 + level) / 2)];
}

// ------------------------------------------------------------ 1. permutation test

/**
 * Shuffle k of a permutation test: which of the pooled values (a first, then b) are labelled b.
 * The first `nB` places of a random permutation get the b label.
 */
export function shuffleLabels(nA: number, nB: number, seed: number, k: number) {
	const n = nA + nB;
	const idx = new Int32Array(n);
	for (let i = 0; i < n; i++) idx[i] = i;
	const rand = rng(stream(seed, k));
	const inB = new Uint8Array(n);
	for (let i = 0; i < nB; i++) {
		const j = i + Math.floor(rand() * (n - i));
		const t = idx[i];
		idx[i] = idx[j];
		idx[j] = t;
		inB[idx[i]] = 1;
	}
	return inB;
}

export function permutationTest(a: number[], b: number[], shuffles: number, seed: number) {
	const pooled = [...a, ...b];
	const total = pooled.reduce((s, v) => s + v, 0);
	const observed = meanOf(b) - meanOf(a);
	const diffs = new Float64Array(shuffles);
	let extreme = 0;
	for (let k = 0; k < shuffles; k++) {
		const inB = shuffleLabels(a.length, b.length, seed, k);
		let sB = 0;
		for (let i = 0; i < pooled.length; i++) if (inB[i]) sB += pooled[i];
		const d = sB / b.length - (total - sB) / a.length;
		diffs[k] = d;
		if (Math.abs(d) >= Math.abs(observed) - 1e-9) extreme++;
	}
	return { observed, diffs, extreme, p: (extreme + 1) / (shuffles + 1) };
}

/** Two-sided p-value, with the +1 correction, from the first `count` shuffles of a test. */
export function pAfter(diffs: Float64Array, observed: number, count: number) {
	let extreme = 0;
	for (let k = 0; k < count; k++) if (Math.abs(diffs[k]) >= Math.abs(observed) - 1e-9) extreme++;
	return { extreme, p: (extreme + 1) / (count + 1) };
}

// ------------------------------------------------------------ 2. bootstrap

/** Resample k of n items: how many times each index was drawn (n draws with replacement). */
export function resampleCounts(n: number, seed: number, k: number) {
	const rand = rng(stream(seed, k));
	const c = new Uint16Array(n);
	for (let i = 0; i < n; i++) c[Math.floor(rand() * n)]++;
	return c;
}

const meanOfResample = (x: ArrayLike<number>, c: Uint16Array) => {
	let s = 0;
	for (let i = 0; i < x.length; i++) s += c[i] * x[i];
	return s / x.length;
};

/** Bootstrap means of one sample. */
export function bootstrapMeans(x: number[], resamples: number, seed: number) {
	const out = new Float64Array(resamples);
	for (let k = 0; k < resamples; k++) out[k] = meanOfResample(x, resampleCounts(x.length, seed, k));
	return out;
}

/** Bootstrap differences mean(b*) − mean(a*), each group resampled separately (streams 2k, 2k+1). */
export function bootstrapDiffs(a: number[], b: number[], resamples: number, seed: number) {
	const out = new Float64Array(resamples);
	for (let k = 0; k < resamples; k++)
		out[k] =
			meanOfResample(b, resampleCounts(b.length, seed, 2 * k + 1)) -
			meanOfResample(a, resampleCounts(a.length, seed, 2 * k));
	return out;
}

/** Least-squares line through (x, y), with the textbook standard error of the slope. */
export function ols(x: ArrayLike<number>, y: ArrayLike<number>, c?: Uint16Array) {
	let n = 0;
	let sx = 0;
	let sy = 0;
	for (let i = 0; i < x.length; i++) {
		const w = c ? c[i] : 1;
		n += w;
		sx += w * x[i];
		sy += w * y[i];
	}
	const mx = sx / n;
	const my = sy / n;
	let sxx = 0;
	let sxy = 0;
	for (let i = 0; i < x.length; i++) {
		const w = c ? c[i] : 1;
		sxx += w * (x[i] - mx) ** 2;
		sxy += w * (x[i] - mx) * (y[i] - my);
	}
	const slope = sxx > 0 ? sxy / sxx : NaN;
	const intercept = my - slope * mx;
	let rss = 0;
	for (let i = 0; i < x.length; i++) {
		const w = c ? c[i] : 1;
		rss += w * (y[i] - intercept - slope * x[i]) ** 2;
	}
	return { slope, intercept, se: Math.sqrt(rss / (n - 2) / sxx) };
}

/** Bootstrap slopes: the (x, y) pairs resampled together. NaN when a resample has one x value. */
export function bootstrapSlopes(x: number[], y: number[], resamples: number, seed: number) {
	const out = new Float64Array(resamples);
	for (let k = 0; k < resamples; k++) out[k] = ols(x, y, resampleCounts(x.length, seed, k)).slope;
	return out;
}

// ------------------------------------------------------------ 3. coverage

export const POP_SIZE = 5000;

/**
 * A simulated population of POP_SIZE values, centred near 50 with spread 10. With skew 0 the
 * values are normal; with skew s > 0 they are lognormal (log-spread 0.9·s), shifted and scaled
 * to keep that centre and spread, so only the shape changes. The same normal draws are used for
 * every skew. Its exact mean and maximum are the truths the intervals try to catch.
 */
export function population(skew: number, seed = 7) {
	const rand = rng(stream(seed, 424_242));
	const s = 0.9 * Math.max(0, skew);
	const values = new Float64Array(POP_SIZE);
	const m = Math.exp((s * s) / 2);
	const sd = Math.sqrt((Math.exp(s * s) - 1) * Math.exp(s * s));
	const shape = (z: number) => 50 + 10 * (s < 1e-6 ? z : (Math.exp(s * z) - m) / sd);
	for (let i = 0; i < POP_SIZE; i += 2) {
		// Box–Muller: two standard normal values (POP_SIZE is even)
		const r = Math.sqrt(-2 * Math.log(1 - rand()));
		const v = 2 * Math.PI * rand();
		values[i] = shape(r * Math.cos(v));
		values[i + 1] = shape(r * Math.sin(v));
	}
	const mean = meanOf(values);
	let max = -Infinity;
	let min = Infinity;
	let m3 = 0;
	let m2 = 0;
	for (const v of values) {
		max = Math.max(max, v);
		min = Math.min(min, v);
		m2 += (v - mean) ** 2;
		m3 += (v - mean) ** 3;
	}
	m2 /= POP_SIZE;
	m3 /= POP_SIZE;
	return { values, mean, max, min, sd: Math.sqrt(m2), skewness: m3 / m2 ** 1.5 };
}

export type Statistic = 'mean' | 'max';

const statOf = (stat: Statistic, x: Float64Array) => {
	if (stat === 'mean') return meanOf(x);
	let m = -Infinity;
	for (const v of x) m = Math.max(m, v);
	return m;
};

/**
 * The coverage experiment: `repeats` times, draw a sample of n from the population (with
 * replacement), compute its statistic and its percentile interval from `resamples` bootstrap
 * resamples, and record whether the interval contains the population's true value.
 */
export function coverageRun(
	pop: Float64Array,
	n: number,
	stat: Statistic,
	repeats: number,
	resamples: number,
	seed: number
) {
	const truth = stat === 'mean' ? meanOf(pop) : statOf('max', pop);
	const lo = new Float64Array(repeats);
	const hi = new Float64Array(repeats);
	const est = new Float64Array(repeats);
	const caught = new Uint8Array(repeats);
	const sample = new Float64Array(n);
	const re = new Float64Array(n);
	const boot = new Float64Array(resamples);
	for (let r = 0; r < repeats; r++) {
		const rand = rng(stream(seed, r));
		for (let i = 0; i < n; i++) sample[i] = pop[Math.floor(rand() * pop.length)];
		est[r] = statOf(stat, sample);
		for (let k = 0; k < resamples; k++) {
			for (let i = 0; i < n; i++) re[i] = sample[Math.floor(rand() * n)];
			boot[k] = statOf(stat, re);
		}
		boot.sort();
		lo[r] = quantile(boot, 0.025);
		hi[r] = quantile(boot, 0.975);
		caught[r] = lo[r] <= truth && truth <= hi[r] ? 1 : 0;
	}
	return { truth, lo, hi, est, caught };
}
