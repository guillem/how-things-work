// Checks the models behind the chaos-fractals explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	CHAOS_ONSET,
	DOUBLINGS,
	FEIGENBAUM,
	energy,
	escape,
	inSet,
	lyapunov,
	orbit,
	period,
	separation,
	swing
} from '../src/routes/chaos-fractals/chaos';

test('double pendulum: energy is conserved', () => {
	const run = swing(120, 120, 20);
	const e0 = energy(run[0]);
	for (const s of run) expect(Math.abs(energy(s) - e0)).toBeLessThan(1e-3 * Math.abs(e0));
});

test('double pendulum: small swings stay small and regular', () => {
	const run = swing(5, 5, 10);
	const max = Math.max(...run.map((s) => Math.abs(s.a1))) * (180 / Math.PI);
	expect(max).toBeLessThan(5.01);
	// Two nearby small swings stay close (no chaos at small angles).
	const other = swing(5.001, 5, 10);
	expect(separation(run.at(-1)!, other.at(-1)!)).toBeLessThan(1e-3);
});

test('double pendulum: a thousandth of a degree grows to a completely different swing', () => {
	const a = swing(120, 120, 20);
	const b = swing(120.001, 120, 20);
	expect(separation(a[0], b[0])).toBeLessThan(1e-4);
	expect(separation(a[60 * 4], b[60 * 4])).toBeLessThan(1e-2); // still together after 4 s
	expect(
		Math.max(...a.slice(60 * 10).map((s, i) => separation(s, b[60 * 10 + i])))
	).toBeGreaterThan(1);
	// Roughly exponential growth early on: the gap multiplies by a similar factor every 2 s.
	const g = [1, 2, 3].map((k) => separation(a[120 * k], b[120 * k]));
	expect(g[1] / g[0]).toBeGreaterThan(2);
	expect(g[2] / g[1]).toBeGreaterThan(2);
});

test('logistic map: steady state, then the period-doubling cascade, then chaos', () => {
	expect(period(2.8)).toBe(1);
	expect(orbit(2.8, 0.2, 3000).at(-1)).toBeCloseTo(1 - 1 / 2.8, 6); // fixed point 1 − 1/r
	expect(period(3.2)).toBe(2);
	expect(period(3.5)).toBe(4);
	expect(period(3.55)).toBe(8);
	expect(period(3.7)).toBe(Infinity);
	expect(period(3.83)).toBe(3); // the period-3 window inside chaos
	expect(lyapunov(3.2)).toBeLessThan(0);
	expect(lyapunov(3.9)).toBeGreaterThan(0.3);
	expect(lyapunov(4)).toBeCloseTo(Math.LN2, 1); // exactly ln 2 at r = 4
});

test('the doublings close in at Feigenbaum’s ratio', () => {
	const gaps = DOUBLINGS.slice(1).map((r, i) => r - DOUBLINGS[i]);
	const ratios = gaps.slice(1).map((g, i) => gaps[i] / g);
	expect(ratios.at(-1)!).toBeCloseTo(FEIGENBAUM, 1);
	expect(DOUBLINGS.at(-1)!).toBeLessThan(CHAOS_ONSET);
	// Just either side of each doubling the period really does double.
	expect(period(DOUBLINGS[1] - 0.005)).toBe(2);
	expect(period(DOUBLINGS[1] + 0.005)).toBe(4);
});

test('Mandelbrot: known points in and out of the set', () => {
	expect(inSet(0, 0)).toBe(true);
	expect(inSet(-1, 0)).toBe(true);
	expect(inSet(-2, 0)).toBe(true); // the tip
	expect(inSet(0.3, 0)).toBe(false);
	expect(inSet(-1.75488, 0, 2000)).toBe(true); // centre of the big "minibrot" (period 3)
	expect(inSet(0, 1)).toBe(true); // c = i: z cycles −1+i, −i, …
	expect(escape(1, 1, 100)).toBeLessThan(3);
});
