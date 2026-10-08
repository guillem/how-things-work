// Checks the oscillator model behind the oscillations-resonance explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEFAULT_SPRING,
	dampedFrequency,
	dampingRatio,
	measuredPeriod,
	naturalFrequency,
	pendulumMotion,
	pendulumPeriod,
	peakFrequency,
	springEnergy,
	springMotion,
	steadyAmplitude
} from '../src/routes/oscillations-resonance/oscillator';

const S = 1 / 240;

test('a spring oscillates at (1/2π)·√(k/m): 1 Hz for the default', () => {
	expect(naturalFrequency(DEFAULT_SPRING)).toBeCloseTo(1, 10);
	const free = { ...DEFAULT_SPRING, c: 0 };
	const m = springMotion(free, 0.1, 0, 10, undefined, S);
	expect(measuredPeriod(m.x, S)).toBeCloseTo(1, 3);
	// Four times the mass → half the frequency.
	const heavy = springMotion({ ...free, m: 4 }, 0.1, 0, 20, undefined, S);
	expect(measuredPeriod(heavy.x, S)).toBeCloseTo(2, 3);
});

test('without friction the energy stays; with friction it drains away', () => {
	const free = springMotion({ ...DEFAULT_SPRING, c: 0 }, 0.1, 0, 10);
	const e0 = springEnergy(DEFAULT_SPRING, 0.1, 0);
	expect(springEnergy(DEFAULT_SPRING, free.x.at(-1)!, free.v.at(-1)!) / e0).toBeCloseTo(1, 6);
	const damped = springMotion(DEFAULT_SPRING, 0.1, 0, 10);
	expect(springEnergy(DEFAULT_SPRING, damped.x.at(-1)!, damped.v.at(-1)!)).toBeLessThan(0.1 * e0);
	expect(dampedFrequency(DEFAULT_SPRING)).toBeLessThan(1);
	expect(dampingRatio({ ...DEFAULT_SPRING, c: 2 * Math.sqrt(DEFAULT_SPRING.k) })).toBeCloseTo(
		1,
		10
	);
});

test('pendulum: period 2π√(L/g), the same for small swings of any size; longer for big ones', () => {
	expect(pendulumPeriod(1)).toBeCloseTo(2.006, 3);
	for (const a of [2, 5, 10])
		expect(measuredPeriod(pendulumMotion(1, a, 20, 0, S), S)).toBeCloseTo(2.006, 1);
	expect(measuredPeriod(pendulumMotion(1, 90, 20, 0, S), S)).toBeGreaterThan(2.006 * 1.15); // +18% at 90°
});

test('resonance: the steady amplitude peaks near the natural frequency', () => {
	const drive = (f: number) => ({ F0: 1, f });
	const at = (f: number) => steadyAmplitude(DEFAULT_SPRING, drive(f));
	expect(at(1)).toBeGreaterThan(10 * at(0.5));
	expect(at(1)).toBeGreaterThan(10 * at(2));
	expect(peakFrequency(DEFAULT_SPRING)).toBeCloseTo(1, 2);
	// Less friction → a taller, narrower peak.
	expect(steadyAmplitude({ ...DEFAULT_SPRING, c: 0.1 }, drive(1))).toBeCloseTo(3 * at(1), 6);
});

test('the simulation settles to the predicted amplitude', () => {
	for (const f of [0.6, 1, 1.5]) {
		const m = springMotion(DEFAULT_SPRING, 0, 0, 60, { F0: 1, f }, S);
		const tail = m.x.slice(m.x.length - Math.round(5 / S));
		const amp = Math.max(...tail.map(Math.abs));
		expect(amp / steadyAmplitude(DEFAULT_SPRING, { F0: 1, f })).toBeCloseTo(1, 2);
	}
});
