// The ABS model: a quarter car braking on Burckhardt friction curves, with and without ABS.
import { expect, test } from '@playwright/test';
import { at, brake, ideal, mu, peak, type Surface } from '../src/routes/abs-brakes/model';

const surfaces: Surface[] = ['dry', 'wet', 'snow'];
const V0 = 100 / 3.6;

test('the friction curves peak at 17%, 13% and 6% slip, and a locked wheel grips less', () => {
	const p = surfaces.map(peak);
	expect(p.map((q) => +q.slip.toFixed(2))).toEqual([0.17, 0.13, 0.06]);
	expect(p.map((q) => +q.mu.toFixed(2))).toEqual([1.17, 0.8, 0.19]);
	expect(surfaces.map((s) => +mu(1, s).toFixed(2))).toEqual([0.76, 0.51, 0.13]);
	for (const s of surfaces) {
		// It is a peak: lower on both sides.
		const { slip, mu: top } = peak(s);
		expect(mu(slip - 0.01, s)).toBeLessThan(top);
		expect(mu(slip + 0.01, s)).toBeLessThan(top);
	}
});

test('no stop is shorter than braking at the peak friction the whole way', () => {
	for (const s of surfaces) {
		const floor = ideal(V0, peak(s).mu);
		for (const abs of [false, true])
			for (const pedal of [0.1, 0.3, 0.5, 1])
				expect(brake({ surface: s, pedal, abs }).distance).toBeGreaterThan(floor);
	}
});

test('a full press without ABS locks the wheel within a third of a second; the car then slides on the locked friction', () => {
	for (const s of surfaces) {
		const run = brake({ surface: s, pedal: 1, abs: false });
		expect(run.lockedAt).not.toBeNull();
		expect(run.lockedAt!).toBeLessThan(0.33);
		// Sliding at mu(1) almost all the way: the distance is close to v² / (2 mu(1) g).
		expect(run.distance / ideal(V0, mu(1, s))).toBeGreaterThan(0.97);
		expect(run.distance / ideal(V0, mu(1, s))).toBeLessThan(1.0);
	}
});

test('a gentle press keeps the wheel turning, with the slip below the peak', () => {
	const run = brake({ surface: 'dry', pedal: 0.3, abs: false });
	expect(run.lockedAt).toBeNull();
	const mid = at(run, run.time / 2);
	expect(mid.slip).toBeGreaterThan(0);
	expect(mid.slip).toBeLessThan(peak('dry').slip);
});

test('ABS releases and reapplies the brake several times a second and stops shorter than a locked wheel', () => {
	for (const s of surfaces) {
		const locked = brake({ surface: s, pedal: 1, abs: false });
		const abs = brake({ surface: s, pedal: 1, abs: true });
		expect(abs.lockedAt).toBeNull();
		const hz = abs.releases / abs.time;
		expect(hz).toBeGreaterThan(4);
		expect(hz).toBeLessThan(15);
		expect(abs.distance).toBeLessThan(locked.distance);
	}
});

test('on dry asphalt a driver holding exactly the right pressure stops about as short as ABS', () => {
	let best = Infinity;
	for (let pedal = 0.3; pedal <= 0.8; pedal += 0.01)
		best = Math.min(best, brake({ surface: 'dry', pedal, abs: false }).distance);
	const abs = brake({ surface: 'dry', pedal: 1, abs: true }).distance;
	expect(Math.abs(abs - best) / best).toBeLessThan(0.15);
	// The right pressure for dry asphalt locks the wheel on snow.
	expect(brake({ surface: 'snow', pedal: 0.53, abs: false }).lockedAt).not.toBeNull();
});

test('a locked wheel cannot steer: the heading stops changing once it locks', () => {
	const run = brake({ surface: 'dry', pedal: 1, abs: false, steer: 4 });
	const after = run.samples.filter((p) => p.t > run.lockedAt! + 0.01 && p.v > 1.5);
	expect(after.length).toBeGreaterThan(10);
	const h = after.map((p) => p.heading);
	expect(Math.max(...h) - Math.min(...h)).toBeLessThan(1e-9);
	// With ABS the same steering turns the car well away from a straight line.
	const abs = brake({ surface: 'dry', pedal: 1, abs: true, steer: 4 });
	expect(at(abs, 1.5).y).toBeGreaterThan(at(run, 1.5).y + 2);
});

test('brake first, steer half a second later: without ABS the car goes straight on, with ABS it swerves', () => {
	for (const s of surfaces) {
		const locked = brake({ surface: s, pedal: 1, abs: false, steer: 8, steerAt: 0.5 });
		expect(Math.abs(locked.samples[locked.samples.length - 1].y)).toBeLessThan(0.01);
	}
	const abs = brake({ surface: 'dry', pedal: 1, abs: true, steer: 8, steerAt: 0.5 });
	// Past an obstacle 30 m ahead, the car is more than a car's width to the side.
	const pass = abs.samples.find((p) => p.x >= 30)!;
	expect(pass.y).toBeGreaterThan(2.5);
});
