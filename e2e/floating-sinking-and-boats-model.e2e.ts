// Archimedes' principle for kitchen objects in a brim-full tank, and a hot-air balloon.
import { expect, test } from '@playwright/test';
import {
	DENSITY,
	MARBLE,
	airDensity,
	apple,
	balloon,
	clayBall,
	clayBowl,
	egg,
	liftOffTemperature,
	lowered,
	marblesToSink,
	settle,
	smallSteelBall,
	solidVolume,
	steelBall,
	steelPan,
	stone,
	woodBlock
} from '../src/routes/floating-sinking-and-boats/model';

test('a stone lowered under water feels lighter by exactly the water that spilled', () => {
	expect(stone.mass).toBeCloseTo(324, 6);
	const under = lowered(stone, DENSITY.water, 10);
	expect(under.spilled).toBeCloseTo(120, 6);
	expect(under.balance).toBeCloseTo(stone.mass - under.spilled, 6);
	// Halfway in, half as much has spilled.
	expect(lowered(stone, DENSITY.water, 2).spilled).toBeCloseTo(60, 6);
});

test('a floating thing spills its own weight of water and the balance reads nothing', () => {
	for (const b of [apple, woodBlock]) {
		const r = settle(b, DENSITY.water);
		expect(r.floats).toBe(true);
		expect(r.displaced).toBeCloseTo(b.mass, 6);
		const l = lowered(b, DENSITY.water, 99);
		expect(l.balance).toBeCloseTo(0, 6);
		expect(l.slack).toBe(true);
	}
	// Wood half as dense as water floats half under.
	expect(settle(woodBlock, DENSITY.water).depth).toBeCloseTo(2.5, 6);
});

test('stone, steel and a clay ball sink; apple and wood float', () => {
	expect(settle(stone, DENSITY.water).floats).toBe(false);
	expect(settle(steelBall, DENSITY.water).floats).toBe(false);
	expect(settle(clayBall, DENSITY.water).floats).toBe(false);
	expect(settle(apple, DENSITY.water).floats).toBe(true);
	expect(settle(woodBlock, DENSITY.water).floats).toBe(true);
});

test('a heavy steel pan floats while a light steel ball sinks', () => {
	expect(steelPan.mass).toBeGreaterThan(15 * smallSteelBall.mass);
	expect(settle(steelPan, DENSITY.water).floats).toBe(true);
	expect(settle(smallSteelBall, DENSITY.water).floats).toBe(false);
});

test('the same clay sinks as a ball and floats as a bowl', () => {
	const bowl = clayBowl();
	expect(solidVolume(bowl.shape)).toBeCloseTo(solidVolume(clayBall.shape), 6);
	expect(bowl.mass).toBeCloseTo(clayBall.mass, 6);
	expect(settle(clayBall, DENSITY.water).floats).toBe(false);
	expect(settle(bowl, DENSITY.water).floats).toBe(true);
});

test('marbles push the bowl deeper until the 18th sinks it', () => {
	expect(marblesToSink()).toBe(18);
	const d0 = settle(clayBowl(0), DENSITY.water).depth;
	const d10 = settle(clayBowl(10), DENSITY.water).depth;
	expect(d10).toBeGreaterThan(d0);
	expect(settle(clayBowl(17), DENSITY.water).floats).toBe(true);
	expect(settle(clayBowl(18), DENSITY.water).floats).toBe(false);
});

test('an egg sinks in fresh water and in oil but floats in very salty water', () => {
	expect(settle(egg, DENSITY.water).floats).toBe(false);
	expect(settle(egg, DENSITY.oil).floats).toBe(false);
	expect(settle(egg, DENSITY.saltyWater).floats).toBe(true);
	// The apple floats in all three, highest in salty water and lowest in oil.
	const depth = (rho: number) => settle(apple, rho).depth;
	expect(depth(DENSITY.saltyWater)).toBeLessThan(depth(DENSITY.water));
	expect(depth(DENSITY.water)).toBeLessThan(depth(DENSITY.oil));
});

test('air at 15 °C weighs about 1.225 kg per cubic metre and gets lighter when warmed', () => {
	expect(airDensity(15)).toBeCloseTo(1.225, 3);
	expect(airDensity(100) / airDensity(15)).toBeCloseTo(288.15 / 373.15, 6);
});

test('the balloon stays down with outside-temperature air and rises above about 85 °C', () => {
	expect(balloon(15).rises).toBe(false);
	expect(balloon(100).rises).toBe(true);
	expect(liftOffTemperature()).toBeGreaterThan(80);
	expect(liftOffTemperature()).toBeLessThan(90);
});

test('a sunken, flooded bowl pushes aside only its clay and marbles', () => {
	const sunk = clayBowl(18);
	const r = settle(sunk, DENSITY.water);
	expect(r.floats).toBe(false);
	// 65.4 cm³ of clay and 18 marbles of 2.14 cm³: about 104 g of water.
	expect(r.displaced).toBeCloseTo(solidVolume(clayBall.shape) + 18 * (MARBLE / DENSITY.glass), 6);
	expect(r.displaced).toBeGreaterThan(103);
	expect(r.displaced).toBeLessThan(105);
	expect(lowered(sunk, DENSITY.water, 99).spilled).toBeCloseTo(r.displaced, 6);
});

test('a thing exactly as dense as the liquid neither floats nor sinks', () => {
	const cube = { name: 'cube', shape: { kind: 'box', w: 1, d: 1, h: 1 } as const, mass: 1 };
	const r = settle(cube, DENSITY.water);
	expect(r.neutral).toBe(true);
	expect(r.displaced).toBeCloseTo(1, 9);
});
