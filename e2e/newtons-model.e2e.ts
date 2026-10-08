// Checks the mechanics behind the Newton's-laws explainer against analytic
// results. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	G,
	bestAngle,
	collide,
	flight,
	kinetic,
	push,
	ride,
	summary,
	trackThrough
} from '../src/routes/newtons-laws/physics';

test('without air resistance the flight matches the textbook formulas', () => {
	for (const [v, a] of [
		[20, 30],
		[20, 45],
		[15, 70]
	]) {
		const r = (a * Math.PI) / 180;
		const s = summary(flight(v, a, 0, 0.001));
		expect(s.range).toBeCloseTo((v * v * Math.sin(2 * r)) / G, 2);
		expect(s.height).toBeCloseTo((v * Math.sin(r)) ** 2 / (2 * G), 2);
		expect(s.time).toBeCloseTo((2 * v * Math.sin(r)) / G, 2);
	}
	// Complementary angles give the same range; 45° is the best.
	expect(summary(flight(20, 30, 0, 0.001)).range).toBeCloseTo(
		summary(flight(20, 60, 0, 0.001)).range,
		2
	);
	expect(bestAngle(20, 0)).toBe(45);
	// The horizontal speed never changes without drag.
	for (const p of flight(20, 40, 0))
		expect(p.vx).toBeCloseTo(20 * Math.cos((40 * Math.PI) / 180), 9);
});

test('air resistance shortens the flight and lowers the best angle', () => {
	const k = 0.02;
	expect(summary(flight(30, 45, k)).range).toBeLessThan(summary(flight(30, 45, 0)).range * 0.8);
	expect(bestAngle(30, k)).toBeLessThan(45);
	// Energy only decreases with drag.
	const path = flight(30, 45, k);
	const e = path.map((p) => 0.5 * (p.vx ** 2 + p.vy ** 2) + G * p.y);
	for (let i = 1; i < e.length; i++) expect(e[i]).toBeLessThanOrEqual(e[i - 1] + 1e-9);
});

test('collisions conserve momentum; elastic ones conserve kinetic energy too', () => {
	for (const [m1, u1, m2, u2] of [
		[1, 3, 1, 0],
		[2, 1, 1, -2],
		[1, 4, 5, 0]
	]) {
		for (const e of [0, 0.5, 1]) {
			const { v1, v2 } = collide(m1, u1, m2, u2, e);
			expect(m1 * v1 + m2 * v2).toBeCloseTo(m1 * u1 + m2 * u2, 10);
			const before = kinetic(m1, u1) + kinetic(m2, u2);
			const after = kinetic(m1, v1) + kinetic(m2, v2);
			if (e === 1) expect(after).toBeCloseTo(before, 10);
			else expect(after).toBeLessThan(before);
			// Restitution: separation speed = e × approach speed.
			expect(v2 - v1).toBeCloseTo(e * (u1 - u2), 10);
		}
	}
	// Equal masses, elastic: they swap velocities.
	const swap = collide(1, 3, 1, 0, 1);
	expect(swap.v1).toBeCloseTo(0, 10);
	expect(swap.v2).toBeCloseTo(3, 10);
});

test('a push follows F = m·a, and without friction the cart keeps going', () => {
	const p = push(2, 10, 1);
	expect(p.a).toBeCloseTo(5, 10);
	expect(p.v(1)).toBeCloseTo(5, 10);
	expect(p.v(10)).toBeCloseTo(5, 10); // no force, no change in speed
	expect(p.x(3)).toBeCloseTo(0.5 * 5 + 5 * 2, 10);
	const f = push(2, 10, 1, 0.1);
	expect(f.a).toBeCloseTo((10 - 0.1 * 2 * G) / 2, 10);
	expect(f.v(100)).toBe(0); // friction stops it
});

test('on a frictionless track energy is conserved; with friction the loss is heat', () => {
	const track = trackThrough([10, 2, 6, 1, 4, 3], 40);
	const m = 1;
	const free = ride(track, m, 0, 20);
	const e0 = free[0].kinetic + free[0].potential;
	for (const s of free) expect((s.kinetic + s.potential) / e0).toBeCloseTo(1, 2); // within 0.5%
	const rough = ride(track, m, 0.05, 20);
	for (const s of rough) expect((s.kinetic + s.potential + s.dissipated) / e0).toBeCloseTo(1, 2);
	expect(rough[rough.length - 1].dissipated).toBeGreaterThan(0.2 * e0);
	// The track passes through its control heights.
	expect(track.h(0)).toBeCloseTo(10, 10);
	expect(track.h(16)).toBeCloseTo(6, 10);
});
