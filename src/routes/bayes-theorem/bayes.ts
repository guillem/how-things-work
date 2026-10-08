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

export interface Counts {
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
 * that keeps the groups in solid blocks: sick first (true positives, then false
 * negatives), then healthy (false positives, then true negatives).
 */
export function grid(c: Counts): ('tp' | 'fn' | 'fp' | 'tn')[] {
	return [
		...Array(c.truePos).fill('tp'),
		...Array(c.falseNeg).fill('fn'),
		...Array(c.falsePos).fill('fp'),
		...Array(c.trueNeg).fill('tn')
	];
}

/** The example on the page: 1% have it, the test catches 90% and clears 91% of the healthy. */
export const EXAMPLE: Test = { prevalence: 0.01, sensitivity: 0.9, specificity: 0.91 };
