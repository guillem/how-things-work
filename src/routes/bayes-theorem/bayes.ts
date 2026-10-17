/**
 * Bayes' theorem with natural frequencies: a population of N people, some
 * with a condition (the base rate); a test that is positive for a fraction of
 * the sick (sensitivity) and negative for a fraction of the healthy
 * (specificity). Counting the four groups gives the chance that a positive
 * result is real (positive predictive value), which is Bayes' theorem:
 *   P(sick | positive) = P(positive | sick) · P(sick) / P(positive).
 */

export interface Test {
	/** Fraction of people who have the condition (0–1). */
	prevalence: number;
	/** Fraction of sick people who test positive (0–1). */
	sensitivity: number;
	/** Fraction of healthy people who test negative (0–1). */
	specificity: number;
}

interface Counts {
	truePos: number;
	falseNeg: number;
	falsePos: number;
	trueNeg: number;
	sick: number;
	healthy: number;
	positives: number;
	/** Chance a positive is real: truePos / positives (NaN with no positives). */
	ppv: number;
	/** Chance a negative is real: trueNeg / negatives. */
	npv: number;
}

/**
 * Whole-number counts for a population of `n` (rounded so the four groups add
 * up to n exactly, as on the page's grid of people).
 */
export function counts({ prevalence, sensitivity, specificity }: Test, n = 1000): Counts {
	const sick = Math.round(n * prevalence);
	const healthy = n - sick;
	const truePos = Math.round(sick * sensitivity);
	const falseNeg = sick - truePos;
	const trueNeg = Math.round(healthy * specificity);
	const falsePos = healthy - trueNeg;
	const positives = truePos + falsePos;
	return {
		truePos,
		falseNeg,
		falsePos,
		trueNeg,
		sick,
		healthy,
		positives,
		ppv: truePos / positives,
		npv: trueNeg / (trueNeg + falseNeg)
	};
}

/** The exact chance a positive is real, from Bayes' theorem (no rounding). */
export function ppv({ prevalence: p, sensitivity: se, specificity: sp }: Test) {
	const pos = se * p + (1 - sp) * (1 - p);
	return pos === 0 ? NaN : (se * p) / pos;
}

/** After a second, independent positive test, the first result's PPV becomes the new base rate. */
export const secondTest = (t: Test) => ppv({ ...t, prevalence: ppv(t) });

/**
 * Which group each of the n people in the grid belongs to, in a fixed order
 * that keeps the groups in solid blocks: the ill first (false negatives, then
 * true positives), then the healthy (false positives, then true negatives). So
 * the ill are one run (the first `sick` cells) and the positives are the next.
 */
export function grid(c: Counts): ('tp' | 'fn' | 'fp' | 'tn')[] {
	return [
		...Array<'fn'>(c.falseNeg).fill('fn'),
		...Array<'tp'>(c.truePos).fill('tp'),
		...Array<'fp'>(c.falsePos).fill('fp'),
		...Array<'tn'>(c.trueNeg).fill('tn')
	];
}

/**
 * The outline of the cells [a, b) of a grid filled row by row, `cols` wide:
 * closed polygons with corners on grid lines, as (column, row) points.
 */
export function runOutline(a: number, b: number, cols: number): [number, number][][] {
	if (b <= a) return [];
	const ra = Math.floor(a / cols);
	const ca = a % cols;
	const rb = Math.floor((b - 1) / cols);
	const cb = ((b - 1) % cols) + 1;
	const box = (c0: number, r0: number, c1: number, r1: number): [number, number][] => [
		[c0, r0],
		[c1, r0],
		[c1, r1],
		[c0, r1]
	];
	if (ra === rb) return [box(ca, ra, cb, ra + 1)];
	// two rows that don't overlap: two separate pieces
	if (rb === ra + 1 && cb <= ca) return [box(ca, ra, cols, ra + 1), box(0, rb, cb, rb + 1)];
	return [
		[
			[ca, ra],
			[cols, ra],
			[cols, rb],
			[cb, rb],
			[cb, rb + 1],
			[0, rb + 1],
			[0, ra + 1],
			[ca, ra + 1]
		]
	];
}

/** The example on the page: 1% have it, the test catches 90% and clears 91% of the healthy. */
export const EXAMPLE: Test = { prevalence: 0.01, sensitivity: 0.9, specificity: 0.91 };
