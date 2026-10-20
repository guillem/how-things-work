// Fireflies as pulse-coupled clocks (Mirollo and Strogatz's concave charge, local coupling).
import { expect, test } from '@playwright/test';
import {
	advance,
	charge,
	inStep,
	phaseOf,
	run,
	scramble,
	scrambleSpot,
	swarm,
	type Swarm
} from '../src/routes/fireflies-in-sync/model';

test('the charge rises along a concave curve, so the same pulse hurries a clock more when it is nearly due', () => {
	expect(charge(0)).toBe(0);
	expect(charge(1)).toBeCloseTo(1, 12);
	expect(phaseOf(charge(0.37))).toBeCloseTo(0.37, 12);
	const jump = (p: number) => phaseOf(charge(p) + 0.05) - p;
	expect(jump(0.8)).toBeGreaterThan(jump(0.2));
});

test('alone, each firefly flashes exactly once per period', () => {
	const s = swarm(40, 2);
	const first = Array.from(s.phase, (p, i) => (1 - p) * s.period[i]);
	const flashes = advance(s, 0, 10);
	// Each flashes floor((10 - first) / period) + 1 times in ten seconds.
	const expected = first.reduce((a, f, i) => a + Math.floor((10 - f) / s.period[i]) + 1, 0);
	expect(flashes).toBe(expected);
});

test('the result does not depend on the time step of the simulation', () => {
	const a = run(swarm(), 0.01, 30, 1 / 60);
	const b = run(swarm(), 0.01, 30, 1 / 600);
	for (let i = 0; i < a.phase.length; i++) expect(a.phase[i]).toBeCloseTo(b.phase[i], 9);
});

test('two identical clocks half a turn apart fall into step', () => {
	const s: Swarm = {
		x: Float64Array.from([0, 10]),
		y: Float64Array.from([0, 0]),
		phase: Float64Array.from([0, 0.5]),
		period: Float64Array.from([1, 1]),
		last: Float64Array.from([-9, -9]),
		near: [[1], [0]],
		time: 0
	};
	run(s, 0.05, 20);
	expect(inStep(s)).toBeGreaterThan(0.999);
});

test('with no coupling the meadow stays out of step', () => {
	expect(inStep(run(swarm(), 0, 60))).toBeLessThan(0.3);
});

test('a weak coupling only makes patches within a minute; a stronger one brings the whole field into step', () => {
	expect(inStep(run(swarm(), 0.002, 60))).toBeLessThan(0.7);
	const s = swarm();
	expect(inStep(s)).toBeLessThan(0.3);
	run(s, 0.01, 60);
	expect(inStep(s)).toBeGreaterThan(0.95);
});

test('a scrambled patch falls back into step', () => {
	const s = run(swarm(), 0.01, 60);
	const spot = scrambleSpot(1);
	scramble(s, spot.x, spot.y, 120, 1);
	expect(inStep(s)).toBeLessThan(0.95);
	run(s, 0.01, 30);
	expect(inStep(s)).toBeGreaterThan(0.95);
});

test('the same start always ends the same way', () => {
	const a = run(swarm(), 0.01, 20);
	const b = run(swarm(), 0.01, 20);
	expect([...a.phase]).toEqual([...b.phase]);
});
