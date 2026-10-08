/**
 * Randomness piling up into bell curves.
 *
 * 1. The Galton board: a ball falls through `rows` rows of pins, bouncing
 *    left or right with equal chance at each; the bin it lands in is the
 *    number of rightward bounces, which follows the binomial distribution.
 * 2. The central limit theorem: draw `n` independent values from a starting
 *    distribution and average them; repeat, and the averages pile up in a bell
 *    curve whose centre is the starting distribution's mean and whose width is
 *    its standard deviation divided by √n.
 *
 * Distributions are discrete on a grid of BINS values over [0, 1] (a
 * histogram the reader can draw), so their mean and spread are exact sums.
 * Random numbers come from a seeded generator, so replays are identical.
 */
import { rng } from '#lib/draw/math.ts';

export const BINS = 20;

/** Centre of bin i on [0, 1]. */
export const binValue = (i: number, bins = BINS) => (i + 0.5) / bins;

// ------------------------------------------------------------ 1. Galton board

/** Exact chance of landing in bin k after `rows` fair bounces: C(rows, k) / 2^rows. */
export function binomial(rows: number, k: number) {
	let c = 1;
	for (let i = 0; i < k; i++) c = (c * (rows - i)) / (i + 1);
	return c / 2 ** rows;
}

/**
 * The paths of `count` balls through `rows` rows: path[b][r] = 1 if ball b
 * bounces right at row r. Reproducible from `seed`.
 */
export function galton(rows: number, count: number, seed = 1) {
	const rand = rng(seed);
	const paths: Uint8Array[] = [];
	const bins = new Array(rows + 1).fill(0);
	for (let b = 0; b < count; b++) {
		const p = new Uint8Array(rows);
		let k = 0;
		for (let r = 0; r < rows; r++) {
			p[r] = rand() < 0.5 ? 1 : 0;
			k += p[r];
		}
		paths.push(p);
		bins[k]++;
	}
	return { paths, bins };
}

// ------------------------------------------------------------ 2. sample means

/** A distribution: weights per bin (need not be normalised). */
export type Shape = number[];

export const normalise = (w: Shape) => {
	const s = w.reduce((a, b) => a + Math.max(0, b), 0);
	return w.map((v) => (s > 0 ? Math.max(0, v) / s : 1 / w.length));
};

export function mean(w: Shape) {
	const p = normalise(w);
	return p.reduce((m, pi, i) => m + pi * binValue(i, p.length), 0);
}

export function sd(w: Shape) {
	const p = normalise(w);
	const mu = mean(p);
	return Math.sqrt(p.reduce((s, pi, i) => s + pi * (binValue(i, p.length) - mu) ** 2, 0));
}

/** Draws one value from a shape (the centre of a bin chosen with the shape's chances). */
export function sampler(w: Shape, seed = 1) {
	const p = normalise(w);
	const cum: number[] = [];
	p.reduce((s, v) => (cum.push(s + v), s + v), 0);
	const rand = rng(seed);
	return () => {
		const u = rand();
		let i = cum.findIndex((c) => u < c);
		if (i < 0) i = p.length - 1;
		return binValue(i, p.length);
	};
}

/** `count` sample means, each the average of `n` draws. */
export function sampleMeans(w: Shape, n: number, count: number, seed = 1) {
	const draw = sampler(w, seed);
	const out = new Float64Array(count);
	for (let k = 0; k < count; k++) {
		let s = 0;
		for (let j = 0; j < n; j++) s += draw();
		out[k] = s / n;
	}
	return out;
}

/** The normal (bell) curve's density at x for a mean and standard deviation. */
export const normalDensity = (x: number, mu: number, sigma: number) =>
	Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

/** Starting shapes the reader can pick (or draw their own). */
export const SHAPES: Record<string, Shape> = {
	flat: new Array(BINS).fill(1),
	skewed: Array.from({ length: BINS }, (_, i) => Math.exp(-i / 3)),
	twoHumps: Array.from({ length: BINS }, (_, i) => (i < 4 || i > 15 ? 5 : 0.2)),
	dice: Array.from({ length: BINS }, (_, i) => (i % 3 === 1 && i < 18 ? 1 : 0))
};
