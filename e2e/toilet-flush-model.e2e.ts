// A gravity toilet: the tank's rush fills the bend behind a siphonic bowl and starts a siphon; a
// slow pour, or a washdown bowl's wide bend, never does; the float shuts its own valve.
import { expect, test } from '@playwright/test';
import {
	BOWL_FULL,
	DEFAULTS,
	FLUSH_LITRES,
	OUTLET_DROP,
	SEAL,
	Toilet,
	outcome,
	siphonFlow,
	type Settings
} from '../src/routes/toilet-flush/model';

const flush: Settings = { ...DEFAULTS, lever: 1 };
const bucket = (seconds: number): Settings => ({
	...DEFAULTS,
	pours: [{ start: 0.5, litres: FLUSH_LITRES, seconds }]
});

test('at rest, and after a jug of water, the bowl stands level with the top of the bend', () => {
	const rest = outcome(DEFAULTS, 10);
	expect(rest.highest).toBe(0);
	expect(rest.end.drained).toBe(0);
	// A litre poured in over 3 s lifts it under 2 cm; it all spills over and the level settles back.
	const jug = outcome({ ...DEFAULTS, pours: [{ start: 0.5, litres: 1, seconds: 3 }] }, 120);
	expect(jug.siphoned).toBe(false);
	expect(jug.highest).toBeGreaterThan(0.005);
	expect(jug.highest).toBeLessThan(0.02);
	expect(jug.lowest).toBe(0);
	expect(jug.end.drained).toBeGreaterThan(0.98);
	expect(new Toilet({ ...DEFAULTS, bowlStart: jug.end.bowl }).level).toBeLessThan(0.002);
});

test('a flush: the tank empties in about 3 seconds, the bend fills and the bowl siphons down to its seal', () => {
	const o = outcome(flush, 60);
	expect(o.tankEmptyAt! - 1).toBeGreaterThan(2.5);
	expect(o.tankEmptyAt! - 1).toBeLessThan(3.5);
	expect(o.siphoned).toBe(true);
	// The siphon starts about two seconds after the lever, before the tank is empty.
	expect(o.primedAt! - 1).toBeGreaterThan(1.5);
	expect(o.primedAt! - 1).toBeLessThan(2.5);
	expect(o.primedAt!).toBeLessThan(o.tankEmptyAt!);
	// Once running it drains faster than the tank is still pouring in, peaking near 2.5 litres a
	// second, as measured 6-litre siphonic bowls do.
	const running = new Toilet(flush);
	running.run(o.primedAt! + 0.05);
	expect(running.state.siphonFlow).toBeGreaterThan(running.state.tankFlow);
	expect(o.peakDrain).toBeGreaterThan(2.0);
	expect(o.peakDrain).toBeLessThan(2.6);
	// It runs until the bowl's water is down to the bend's inlet, then air gets in: the gurgle.
	expect(o.lowest).toBeCloseTo(-SEAL, 3);
	expect(o.brokeAt! - o.primedAt!).toBeGreaterThan(1.5);
	expect(o.brokeAt! - 1).toBeLessThan(5);
	expect(o.overRim).toBe(false);
});

test('after a flush the tank refills in about half a minute, the float shuts the valve, the bowl is topped up', () => {
	const o = outcome(flush, 60);
	expect(o.valveShutAt! - 1).toBeGreaterThan(25);
	expect(o.valveShutAt! - 1).toBeLessThan(40);
	expect(o.end.valve).toBe(0);
	expect(o.end.fillFlow).toBe(0);
	expect(o.end.tank).toBeCloseTo(FLUSH_LITRES, 1);
	expect(new Toilet({ ...DEFAULTS, bowlStart: o.end.bowl }).level).toBeGreaterThanOrEqual(0);
	expect(new Toilet({ ...DEFAULTS, bowlStart: o.end.bowl }).level).toBeLessThan(0.003);
	// The tank's 6 litres went down the drain with the bowl's own 1.4, and the refill tube topped
	// the bowl up again.
	expect(o.end.drained).toBeGreaterThan(FLUSH_LITRES + BOWL_FULL);
});

test('a bucket poured in quickly flushes; the same bucket poured slowly only spills over the top', () => {
	for (const seconds of [1, 2, 3]) {
		const o = outcome(bucket(seconds), 40);
		expect(o.siphoned, `${seconds} s`).toBe(true);
		expect(o.lowest).toBeCloseTo(-SEAL, 3);
		expect(o.overRim).toBe(false);
	}
	for (const seconds of [4, 10, 20]) {
		const o = outcome(bucket(seconds), 60);
		expect(o.siphoned, `${seconds} s`).toBe(false);
		// The bowl never drops below its usual level: it stays full, and all 6 litres trickle over.
		expect(o.lowest).toBe(0);
		expect(o.end.drained).toBeGreaterThan(FLUSH_LITRES - 0.05);
	}
});

test('a bucket flush leaves the bowl low: no tank refills it', () => {
	const o = outcome(bucket(2), 60);
	expect(new Toilet({ ...DEFAULTS, bowlStart: o.end.bowl }).level).toBeCloseTo(-SEAL, 3);
	expect(o.end.tank).toBe(FLUSH_LITRES);
});

test('a washdown bowl never siphons: the rush only pushes the extra water over the top', () => {
	const o = outcome({ ...flush, bowl: 'washdown' }, 60);
	expect(o.siphoned).toBe(false);
	expect(o.lowest).toBe(0);
	expect(o.highest).toBeGreaterThan(0.03);
	expect(o.peakDrain).toBeLessThan(o.peakTank);
	// Even the fastest bucket doesn't make it siphon.
	expect(outcome({ ...bucket(1), bowl: 'washdown' }, 30).siphoned).toBe(false);
});

test('the siphon runs on gravity: no drop to the outlet, no flow; a longer drop, a faster flow', () => {
	expect(siphonFlow(-OUTLET_DROP, 0.05)).toBe(0);
	expect(siphonFlow(0, 0.05)).toBeGreaterThan(siphonFlow(-SEAL, 0.05));
	// Water from 30 cm up runs at about 1.1 m/s through the full bend (with its losses).
	const speed = siphonFlow(0, 0.05) / 1000 / ((Math.PI * 0.05 ** 2) / 4);
	expect(speed).toBeGreaterThan(1.0);
	expect(speed).toBeLessThan(1.3);
});

test('with the float held down the valve never shuts: water runs on through the overflow pipe', () => {
	const o = outcome({ ...flush, floatHeld: true }, 180);
	expect(o.end.fillFlow).toBeCloseTo(0.3, 2);
	expect(o.end.overflow).toBeGreaterThan(0.2);
	// The bowl stays full, a couple of centimetres up, and spills, but never siphons again.
	const later = new Toilet({ ...flush, floatHeld: true });
	later.run(60);
	const primed = later.state.primedAt;
	later.run(180);
	expect(later.state.primedAt).toBe(primed);
	expect(later.state.primed).toBe(false);
	expect(later.level).toBeGreaterThan(0);
	expect(later.level).toBeLessThan(0.03);
	// About 18 litres a minute go down the drain.
	const before = later.state.drained;
	later.run(240);
	expect(later.state.drained - before).toBeCloseTo(18, 0);
});
