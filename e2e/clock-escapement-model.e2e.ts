// A weight-driven pendulum clock with a dead-beat escapement: what sets its rate, and what doesn't.
import { expect, test } from '@playwright/test';
import {
	Clock,
	DEFAULTS,
	DEFAULT_SWING,
	DEFAULT_WEIGHT,
	Q,
	SECONDS_LENGTH,
	SINK_PER_HOUR,
	TEETH,
	beatTime,
	deg,
	gainPerDay,
	settledSwing,
	type Settings
} from '../src/routes/clock-escapement/model';

/** Average time between ticks over `n` ticks, after the first, s. */
function measuredBeat(s: Settings, n = 60): number {
	const c = new Clock(s);
	c.run(3);
	const t0 = c.state.lastTick;
	const k0 = c.state.ticks;
	c.run(3 + n * beatTime(s.length, settledSwing(s.weight, s.length)) + 0.5);
	return (c.state.lastTick - t0) / (c.state.ticks - k0);
}

test('a pendulum about a metre long ticks once a second', () => {
	expect(SECONDS_LENGTH).toBeGreaterThan(0.99);
	expect(SECONDS_LENGTH).toBeLessThan(1);
	const beat = measuredBeat(DEFAULTS);
	expect(beat).toBeGreaterThan(0.999);
	expect(beat).toBeLessThan(1.001);
});

test('a pendulum a quarter as long ticks twice as fast, and a heavier weight hardly changes that', () => {
	const quarter = measuredBeat({ ...DEFAULTS, length: SECONDS_LENGTH / 4 });
	expect(quarter / measuredBeat(DEFAULTS)).toBeCloseTo(0.5, 2);
	const heavy = measuredBeat({
		...DEFAULTS,
		length: SECONDS_LENGTH / 4,
		weight: 4 * DEFAULT_WEIGHT
	});
	// Four times the weight: a little slower (its swing is wider), by less than 0.2%.
	expect(heavy / quarter).toBeGreaterThan(1);
	expect(heavy / quarter).toBeLessThan(1.002);
});

test('the escape wheel lets on half a tooth a tick: 30 teeth turn once a minute', () => {
	const c = new Clock(DEFAULTS);
	c.run(60.05);
	expect(c.state.ticks).toBe(60);
	expect(c.state.wheel).toBe(TEETH);
});

test('the weight drives the clock: the swing it settles into is set by the weight', () => {
	// The clock is started at the swing the model says it settles into, and holds it.
	const c = new Clock(DEFAULTS);
	c.run(120);
	expect(deg(c.state.swing)).toBeCloseTo(deg(DEFAULT_SWING), 1);
	// Four times the weight: twice the swing (the pendulum's losses grow with the swing squared).
	expect(settledSwing(4 * DEFAULT_WEIGHT, SECONDS_LENGTH) / DEFAULT_SWING).toBeCloseTo(2, 5);
	const heavy = new Clock({ ...DEFAULTS, weight: 4 * DEFAULT_WEIGHT });
	heavy.run(120);
	expect(heavy.state.swing / DEFAULT_SWING).toBeCloseTo(2, 1);
	// Started with too small a swing, the kicks widen it, slowly.
	const small = new Clock(DEFAULTS, DEFAULT_SWING / 2);
	small.run(1);
	const before = small.state.swing;
	small.run(300);
	expect(small.state.swing).toBeGreaterThan(before * 1.03);
});

test('without the weight the pendulum swings on for hours, but nothing ticks', () => {
	const c = new Clock({ ...DEFAULTS, driven: false });
	c.run(60);
	expect(c.state.ticks).toBe(0);
	expect(c.state.wheel).toBe(0);
	// Its swing shrinks by a factor e every 2Q/π swings: nearly two hours for a seconds pendulum.
	const decay = (2 * Q) / Math.PI;
	expect(c.state.swing / DEFAULT_SWING).toBeCloseTo(Math.exp(-60 / decay), 3);
	expect(decay / 3600).toBeGreaterThan(1.7);
});

test('without the anchor the wheel runs away: thousands of teeth a minute instead of 30', () => {
	const c = new Clock({ ...DEFAULTS, anchor: false });
	c.run(60);
	expect(c.state.wheel).toBeGreaterThan(100 * TEETH);
	expect(c.state.ticks).toBe(0);
});

test('a wider swing is slightly slower, never faster: circular error', () => {
	// Wikipedia: a 3° swing each side runs about 15 seconds a day slower than a tiny one.
	const tiny = beatTime(1, 1e-4);
	expect(86_400 * (beatTime(1, (3 * Math.PI) / 180) / tiny - 1)).toBeCloseTo(15, 0);
	// Measured on the running clock: four times the weight, twice the swing, loses about half a
	// minute a day.
	const light = measuredBeat(DEFAULTS, 120);
	const heavy = measuredBeat({ ...DEFAULTS, weight: 4 * DEFAULT_WEIGHT }, 120);
	expect(heavy).toBeGreaterThan(light);
	const lost = 86_400 * (heavy / light - 1);
	expect(lost).toBeGreaterThan(25);
	expect(lost).toBeLessThan(37);
	expect(
		gainPerDay(SECONDS_LENGTH, DEFAULT_SWING) - gainPerDay(SECONDS_LENGTH, 2 * DEFAULT_SWING)
	).toBeCloseTo(lost, -1);
});

test('a millimetre longer and the clock loses about 43 seconds a day', () => {
	const s = DEFAULT_SWING;
	const lost = gainPerDay(SECONDS_LENGTH, s) - gainPerDay(SECONDS_LENGTH + 0.001, s);
	expect(lost).toBeGreaterThan(41);
	expect(lost).toBeLessThan(45);
});

test('an eight-day weight sinks about 5 mm an hour', () => {
	expect(SINK_PER_HOUR * 1000).toBeCloseTo(5, 0);
});
