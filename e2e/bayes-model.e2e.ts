// Checks the counting behind the bayes-theorem explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	EXAMPLE,
	counts,
	grid,
	ppv,
	runOutline,
	secondTest
} from '../src/routes/bayes-theorem/bayes';

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

test('in the grid the ill form one run and the positives the next', () => {
	const c = counts(EXAMPLE);
	const g = grid(c);
	const ill = g.slice(0, c.sick);
	const positives = g.slice(c.falseNeg, c.falseNeg + c.positives);
	expect(ill.every((x) => x === 'tp' || x === 'fn')).toBe(true);
	expect(positives.every((x) => x === 'tp' || x === 'fp')).toBe(true);
});

test('the outline of the positives runs only along their border', () => {
	const COLS = 40;
	const stray: string[] = [];
	for (let a = 0; a < 3 * COLS; a++)
		for (let b = a + 1; b <= a + 3 * COLS; b++) {
			const inside = (col: number, row: number) => {
				const i = row * COLS + col;
				return col >= 0 && col < COLS && row >= 0 && i >= a && i < b;
			};
			for (const poly of runOutline(a, b, COLS))
				poly.forEach(([x0, y0], k) => {
					const [x1, y1] = poly[(k + 1) % poly.length];
					// every unit piece of every edge has a cell of the run on exactly one side
					const len = Math.abs(x1 - x0) + Math.abs(y1 - y0);
					for (let u = 0; u < len; u++) {
						const x = x0 + Math.sign(x1 - x0) * (u + 0.5);
						const y = y0 + Math.sign(y1 - y0) * (u + 0.5);
						const sides =
							y0 === y1
								? [inside(Math.floor(x), y0 - 1), inside(Math.floor(x), y0)]
								: [inside(x0 - 1, Math.floor(y)), inside(x0, Math.floor(y))];
						if (sides[0] === sides[1]) stray.push(`run [${a}, ${b}), edge at (${x}, ${y})`);
					}
				});
		}
	expect(stray.slice(0, 3)).toEqual([]);
});

test('limiting cases: a perfect specificity, a useless test, a commoner disease', () => {
	// no false positives: every positive is real
	expect(ppv({ prevalence: 0.01, sensitivity: 0.9, specificity: 1 })).toBe(1);
	// a test that says "positive" as often for the healthy as for the ill tells you nothing
	expect(ppv({ prevalence: 0.03, sensitivity: 0.7, specificity: 0.3 })).toBeCloseTo(0.03, 12);
	// the commoner the disease, the likelier a positive is real
	const at = (prevalence: number) => ppv({ ...EXAMPLE, prevalence });
	for (let p = 0.001; p < 0.5; p += 0.01) expect(at(p + 0.01)).toBeGreaterThan(at(p));
});

test('the base rate decides: same test, common condition → most positives are real', () => {
	expect(counts({ ...EXAMPLE, prevalence: 0.3 }).ppv).toBeGreaterThan(0.8);
	// Even a 99% / 99% test: at 1 in 100, a positive is a coin toss.
	expect(ppv({ prevalence: 0.01, sensitivity: 0.99, specificity: 0.99 })).toBeCloseTo(0.5, 10);
});

test('a second, independent positive raises the chance to about a half', () => {
	expect(secondTest(EXAMPLE)).toBeCloseTo(0.5025, 3);
});
