// Checks the mathematics behind the differential-equations explainer against known results:
// traced solutions agree with the textbook solutions of growth, cooling and logistic growth;
// the fish stock's two equilibria merge and vanish at the harvest rK/4; solution curves of one
// equation do not cross. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	DEFAULTS,
	crossings,
	equilibria,
	gapToExact,
	riccatiDivider,
	rules,
	trace,
	valueAt
} from '../src/routes/differential-equations/ode';

const p = DEFAULTS;

test('a colony growing at r = 0.3 per hour doubles every ln 2 / 0.3 ≈ 2.31 hours', () => {
	const tr = trace(rules.growth, { ...p, r: 0.3 }, 0, 5);
	const doubling = Math.log(2) / 0.3;
	expect(valueAt(tr, doubling)).toBeCloseTo(10, 4);
	expect(valueAt(tr, 2 * doubling)).toBeCloseTo(20, 4);
	// and the trace matches y₀ e^(rt) everywhere in the window
	expect(gapToExact(rules.growth, { ...p, r: 0.3 }, tr)).toBeLessThan(1e-6);
});

test('coffee at 90 °C in a 20 °C room is halfway to room temperature after ln 2 / k minutes', () => {
	const tr = trace(rules.cooling, p, 0, 90);
	// k = 0.05 per minute: halfway (55 °C) after 13.86 min, three quarters (37.5 °C) after twice that
	expect(valueAt(tr, Math.log(2) / 0.05)).toBeCloseTo(55, 4);
	expect(valueAt(tr, (2 * Math.log(2)) / 0.05)).toBeCloseTo(37.5, 4);
	expect(gapToExact(rules.cooling, p, tr)).toBeLessThan(1e-6);
	// and a cold drink warms towards the same room temperature
	const cold = trace(rules.cooling, p, 0, 5);
	expect(valueAt(cold, 60)).toBeCloseTo(20 - 15 * Math.exp(-3), 4);
});

test('logistic growth rises fastest at half the carrying capacity and levels off at it', () => {
	const tr = trace(rules.logistic, p, 0, 5);
	expect(gapToExact(rules.logistic, p, tr)).toBeLessThan(1e-6);
	// steepest where N = K/2 = 50: compare the slope just below, at and above 50
	const tHalf = tr.t[tr.y.findIndex((y) => y >= 50)];
	const slope = (t: number) => (valueAt(tr, t + 0.01) - valueAt(tr, t - 0.01)) / 0.02;
	expect(slope(tHalf)).toBeGreaterThan(slope(tHalf - 1.5));
	expect(slope(tHalf)).toBeGreaterThan(slope(tHalf + 1.5));
	// the textbook time to reach K/2 from 5: ln(19)/r
	expect(tHalf).toBeCloseTo(Math.log(19) / 0.5, 1);
	expect(valueAt(tr, 25)).toBeGreaterThan(99.5);
	// from above the ceiling the stock falls back to it
	expect(valueAt(trace(rules.logistic, p, 0, 140), 25)).toBeCloseTo(100, 1);
});

test('equilibria and their stability: growth 0, cooling the room, logistic 0 and K', () => {
	expect(equilibria(rules.growth, p)).toEqual([{ y: 0, stability: 'unstable' }]);
	const cool = equilibria(rules.cooling, { ...p, room: 25 });
	expect(cool).toHaveLength(1);
	expect(cool[0].y).toBeCloseTo(25, 9);
	expect(cool[0].stability).toBe('stable');
	const log = equilibria(rules.logistic, p);
	expect(log.map((e) => e.stability)).toEqual(['unstable', 'stable']);
	expect(log[1].y).toBeCloseTo(100, 9);
});

test('a steady harvest gives two equilibria that merge at rK/4 and then vanish', () => {
	const rK4 = (0.5 * 100) / 4; // 12.5 per cent of K per year
	const at = (H: number) => equilibria(rules.harvest, { ...p, H });
	// H = 8: N = 50 ± 30, the lower one a threshold, the upper one where the stock settles
	expect(at(8).map((e) => e.stability)).toEqual(['unstable', 'stable']);
	expect(at(8)[0].y).toBeCloseTo(20, 6);
	expect(at(8)[1].y).toBeCloseTo(80, 6);
	// just below rK/4 the two are close to K/2 and to each other
	const near = at(rK4 * 0.999);
	expect(near).toHaveLength(2);
	expect(near[1].y - near[0].y).toBeLessThan(4);
	// at rK/4 they are one, at K/2, approached from above only
	const one = at(rK4);
	expect(one).toHaveLength(1);
	expect(one[0].y).toBeCloseTo(50, 3);
	expect(one[0].stability).toBe('semi-stable');
	// just above, none: every stock collapses
	expect(at(rK4 * 1.001)).toEqual([]);
	const crash = trace(rules.harvest, { ...p, H: 16 }, 0, 120);
	expect(crash.collapse).toBeDefined();
	expect(crash.y[crash.y.length - 1]).toBe(0);
	// just past rK/4 the stock lingers for decades near K/2 before it goes
	const slow = trace(rules.harvest, { ...p, H: 13 }, 0, 120);
	expect(slow.collapse).toBeUndefined();
	expect(valueAt(slow, 40)).toBeGreaterThan(0);
	expect(valueAt(slow, 40)).toBeLessThan(50);
	// below rK/4 a stock above the threshold survives, one below it collapses
	expect(trace(rules.harvest, p, 0, 30).collapse).toBeUndefined();
	expect(trace(rules.harvest, p, 0, 15).collapse).toBeDefined();
});

test('solution curves of one equation do not cross', () => {
	const cases = [
		{ rule: rules.growth, starts: [2, 10, 30, 60, 90] },
		{ rule: rules.cooling, starts: [0, 10, 20, 45, 70, 95] },
		{ rule: rules.logistic, starts: [0, 1, 20, 60, 100, 130, 150] },
		{ rule: rules.harvest, starts: [5, 19, 21, 50, 80, 110, 150] },
		{ rule: rules.riccati, starts: [-2.5, -1, -0.5, 0, 0.5, 1.5, 2.5] }
	];
	for (const { rule, starts } of cases) {
		// starts on a grid of times and values across the window
		const traces = starts.flatMap((y0, i) =>
			[0, 0.4, 0.7].map((u) => {
				const t0 = rule.t[0] + u * (rule.t[1] - rule.t[0]);
				const y = y0 + (i % 2 ? 0.37 : -0.21) * u;
				return trace(rule, p, t0, Math.max(rule.y[0], Math.min(rule.y[1], y)));
			})
		);
		expect(crossings(rule, traces), rule.id).toBe(0);
	}
	// and the check does find a crossing when one is there: two different rules' curves
	const a = trace(rules.cooling, p, 0, 90);
	const b = trace(rules.cooling, { ...p, room: 80 }, 0, 30);
	expect(crossings(rules.cooling, [a, b])).toBe(1);
});

test('dy/dt = t − y² has no formula, but the slope field still fixes each curve', () => {
	// Starting at y = 0, the traced curve rises and then follows close below √t.
	const tr = trace(rules.riccati, p, 0, 0);
	expect(valueAt(tr, 6)).toBeGreaterThan(Math.sqrt(6) - 0.3);
	expect(valueAt(tr, 6)).toBeLessThan(Math.sqrt(6));
	// Halving the step does not move it: the field, not the method, fixes the curve.
	const fine = trace(rules.riccati, p, 0, 0, 6000);
	expect(Math.abs(valueAt(fine, 6) - valueAt(tr, 6))).toBeLessThan(1e-9);
	// The dividing curve is Ai′(t)/Ai(t): at t = 0, Ai′(0)/Ai(0) = −0.258819/0.355028 (DLMF 9.2).
	const divider = riccatiDivider();
	expect(valueAt(divider, 0)).toBeCloseTo(-0.258819 / 0.355028, 3);
	// Starts just above it follow √t; starts just below it leave the plot downwards.
	expect(valueAt(trace(rules.riccati, p, 0, -0.7), 6)).toBeGreaterThan(2);
	expect(trace(rules.riccati, p, 0, -0.76).t.at(-1)).toBeLessThan(6);
	// Below a dividing curve the solutions run off to −∞ instead.
	const low = trace(rules.riccati, p, 0, -1.5);
	expect(low.t[low.t.length - 1]).toBeLessThan(6);
});
