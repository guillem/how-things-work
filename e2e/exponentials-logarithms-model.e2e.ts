// Checks the arithmetic behind the exponentials-and-logarithms explainer against known results:
// a fixed factor outruns a fixed amount, a log axis straightens the curve with a slope of
// log(factor), doubling counts are logarithms base 2, the paper-folding numbers the page quotes,
// how good the rules of 70 and 72 are, and a slide rule that multiplies by adding lengths.
// Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	arithmetic,
	crossover,
	doublings,
	doublingTime,
	fitLine,
	geometric,
	logBase,
	logistic,
	ruleOf,
	scaleTicks,
	slideRule
} from '../src/routes/exponentials-logarithms/explog';

const steps = (n: number) => Array.from({ length: n + 1 }, (_, k) => k);

test('on a log axis, repeated multiplication is a straight line whose slope is log of the factor', () => {
	for (const f of [0.5, 0.9, 1.01, 1.05, 1.5, 2, 3]) {
		const ys = geometric(100, f, 40).map(Math.log10);
		const line = fitLine(steps(40), ys);
		expect(line.slope, `factor ${f}`).toBeCloseTo(Math.log10(f), 10);
		expect(line.residual, `factor ${f}`).toBeLessThan(1e-9);
	}
	// Repeated addition is not straight on a log axis: it bends over.
	const lin = arithmetic(100, 10, 40).map(Math.log10);
	expect(fitLine(steps(40), lin).residual).toBeGreaterThan(0.05);
	// …and a growth that slows (a culture running out of food) bends over too.
	const slowing = logistic(1, 1.5, 1e6, 60).map(Math.log10);
	expect(fitLine(steps(60), slowing).residual).toBeGreaterThan(0.5);
});

test('doubling counts are logarithms base 2', () => {
	expect(doublings(1, 1024)).toEqual({ whole: 10, exact: 10 });
	expect(doublings(1, 16).whole).toBe(4); // sorting: halving 16 takes 4 levels
	const ten = doublings(1, 10);
	expect(ten.whole).toBe(3);
	expect(ten.exact).toBeCloseTo(3.32, 2);
	for (const x of [3, 100, 1000, 1e6]) {
		const d = doublings(1, x);
		expect(2 ** d.whole).toBeLessThanOrEqual(x);
		expect(2 ** (d.whole + 1)).toBeGreaterThan(x);
		expect(d.exact).toBeCloseTo(Math.log2(x), 12);
		expect(logBase(2, x)).toBeCloseTo(Math.log2(x), 12);
	}
	// Base 10 counts the zeros.
	expect(logBase(10, 1e6)).toBeCloseTo(6, 12);
});

test('folding 0.1 mm paper: 27 folds pass Everest, 42 pass the Moon', () => {
	const mm = 0.1;
	const fold = (n: number) => geometric(mm, 2, n)[n];
	expect(fold(42) / 1e6).toBeGreaterThan(384_400); // km to the Moon (mean distance)
	expect(fold(41) / 1e6).toBeLessThan(384_400);
	expect(doublings(mm, 384_400 * 1e6).whole + 1).toBe(42);
	expect(doublings(mm, 8_849 * 1e3).whole + 1).toBe(27); // Everest, 8,849 m
	expect(fold(7)).toBeCloseTo(12.8, 1); // 128 layers: about a notebook
});

test('multiplying overtakes adding at any factor above 1, but late when the factor is small', () => {
	// The page's default race: 100 plus 10 a step against 5 % a step.
	const k = crossover(100, 10, 1.05);
	expect(k).toBe(27);
	const lin = arithmetic(100, 10, 60);
	const geo = geometric(100, 1.05, 60);
	expect(geo[k! - 1]).toBeLessThanOrEqual(lin[k! - 1]);
	expect(geo[k!]).toBeGreaterThan(lin[k!]);
	expect(geo[60] / lin[60]).toBeGreaterThan(2.5);
	// A factor just above 1 trails for a long time, then wins anyway.
	expect(crossover(100, 10, 1.01)!).toBeGreaterThan(300);
	expect(crossover(100, 10, 0.99)).toBeNull();
});

test('the rule of 72 is within 3.5 % from 1 % to 14 % growth, the rule of 70 within 3 % up to 8 %', () => {
	for (let p = 1; p <= 14; p++) {
		const exact = doublingTime(p);
		expect(Math.abs(ruleOf(72, p) / exact - 1), `72 at ${p} %`).toBeLessThan(0.035);
	}
	for (let p = 1; p <= 8; p++) {
		expect(Math.abs(ruleOf(70, p) / doublingTime(p) - 1), `70 at ${p} %`).toBeLessThan(0.03);
	}
	// Exact at about 8 %, and far off for big factors: doubling at 100 % takes 1 step, not 0.72.
	expect(doublingTime(8)).toBeCloseTo(9.0, 1);
	expect(doublingTime(100)).toBeCloseTo(1, 12);
	expect(ruleOf(72, 100) / doublingTime(100)).toBeCloseTo(0.72, 12);
	// Compound interest at 5 %: doubles in a little over 14 years.
	expect(doublingTime(5)).toBeCloseTo(14.2, 1);
	expect(geometric(100, 1.05, 15)[15]).toBeGreaterThan(200);
	expect(geometric(100, 1.05, 14)[14]).toBeLessThan(200);
});

test('the slide rule multiplies by adding lengths, to its reading precision', () => {
	let worst = 0;
	for (let a = 1; a <= 10; a += 0.37) {
		for (let b = 1; b <= 10; b += 0.29) {
			const r = slideRule(a, b);
			expect(Math.abs(r.reading - a * b), `${a} × ${b}`).toBeLessThanOrEqual(r.precision + 1e-9);
			worst = Math.max(worst, Math.abs(r.reading / (a * b) - 1));
			// past 10 the slide's other end is used, and the reading gains a zero
			expect(r.wrapped).toBe(a * b > 10);
		}
	}
	// About three figures: never more than 0.7 % off.
	expect(worst).toBeLessThan(0.007);
	expect(slideRule(2, 3).reading).toBe(6);
	expect(slideRule(4, 5).reading).toBe(20);
	expect(slideRule(3.7, 2.4).reading).toBeCloseTo(8.88, 1);
});

test('the scale is graduated like a 25 cm rule, from 1 to 10', () => {
	const ticks = scaleTicks();
	expect(ticks[0].x).toBe(1);
	expect(ticks.at(-1)!.x).toBe(10);
	expect(ticks.filter((t) => t.kind === 'major').map((t) => t.x)).toEqual([
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10
	]);
	expect(ticks.length).toBe(100 + 100 + 120 + 1);
});
