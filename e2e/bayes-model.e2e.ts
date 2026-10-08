// Checks the counting behind the bayes-theorem explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import { EXAMPLE, counts, grid, ppv, secondTest } from '../src/routes/bayes-theorem/bayes';

test('the example: 9 of the 98 positives are really ill (about 9%)', () => {
	const c = counts(EXAMPLE);
	expect([c.truePos, c.falseNeg, c.falsePos, c.trueNeg]).toEqual([9, 1, 89, 901]);
	expect(c.positives).toBe(98);
	expect(c.ppv).toBeCloseTo(9 / 98, 10);
	expect(ppv(EXAMPLE)).toBeCloseTo(0.0917, 4);
});

test('counting agrees with Bayes’ formula (up to rounding to whole people)', () => {
	for (const prevalence of [0.001, 0.01, 0.05, 0.2, 0.5])
		for (const sensitivity of [0.7, 0.9, 0.99])
			for (const specificity of [0.8, 0.95, 0.99]) {
				const t = { prevalence, sensitivity, specificity };
				const exact = ppv(t);
				const counted = counts(t, 1_000_000).ppv;
				expect(Math.abs(counted - exact)).toBeLessThan(0.002);
			}
});

test('the four groups always add up to everyone', () => {
	const c = counts({ prevalence: 0.137, sensitivity: 0.83, specificity: 0.77 });
	expect(c.truePos + c.falseNeg + c.falsePos + c.trueNeg).toBe(1000);
	expect(grid(c)).toHaveLength(1000);
});

test('the base rate decides: same test, common condition → most positives are real', () => {
	expect(counts({ ...EXAMPLE, prevalence: 0.3 }).ppv).toBeGreaterThan(0.8);
	// Even a 99% / 99% test: at 1 in 100, a positive is a coin toss.
	expect(ppv({ prevalence: 0.01, sensitivity: 0.99, specificity: 0.99 })).toBeCloseTo(0.5, 10);
});

test('a second, independent positive raises the chance to about a half', () => {
	expect(secondTest(EXAMPLE)).toBeCloseTo(0.5025, 3);
});
