// Hydraulics: Pascal's principle in a two-piston press, the work traded for push, air in the pipe,
// and a digger's arm moved by its three cylinders, checked against real-world values.
import { expect, test } from '@playwright/test';
import {
	CYLINDERS,
	DIGGER_MASS,
	HAND,
	LOADS,
	SCOOP,
	airShrink,
	cylinderLengths,
	cylinderPushKg,
	geometry,
	oilShrink,
	press,
	scoopAt,
	widthToLift
} from '../src/routes/hydraulics-digger-arm/model';

test('two pistons of the same size: the far one moves as far as the near one (to within a millimetre), with the same push', () => {
	const s = press({ big: HAND.width, push: 0.2, loadKg: 20 });
	expect(s.rise).toBeLessThanOrEqual(0.2);
	expect(s.rise).toBeGreaterThan(0.199);
	expect(s.bigKg).toBeCloseTo(s.handKg, 6);
});

test('a piston with ten times the area gets ten times the push and moves a tenth as far', () => {
	const big = HAND.width * Math.sqrt(10);
	const s = press({ big, push: 0.1, loadKg: LOADS.crate });
	expect(s.ratio).toBeCloseTo(10, 6);
	expect(s.handKg).toBeCloseTo(10, 3);
	expect(s.rise).toBeCloseTo(0.01, 4);
});

test('twice as wide is four times the area, and so four times the push', () => {
	expect(press({ big: 2 * HAND.width, push: 0 }).ratio).toBeCloseTo(4, 6);
	expect(press({ big: 3 * HAND.width, push: 0 }).ratio).toBeCloseTo(9, 6);
});

test('no energy is made: the work the hand does equals the work done lifting the load', () => {
	// The oil squashes a hair, storing a sliver of the work like a spring: under 1 % even here.
	for (const big of [0.04, 0.1, 0.2]) {
		const s = press({ big, push: 0.25, loadKg: 600 });
		expect(s.workOut / s.workIn).toBeGreaterThan(0.99);
		expect(s.workOut / s.workIn).toBeLessThanOrEqual(1);
	}
});

test('a car of 1,200 kg needs a big piston about 15.5 cm across; a 3-tonne boulder about 24.5 cm', () => {
	expect(widthToLift(LOADS.car)).toBeCloseTo(0.155, 3);
	expect(widthToLift(LOADS.boulder)).toBeCloseTo(0.245, 3);
	// One full 30 cm push lifts the car on a 16 cm piston by under half a centimetre.
	const s = press({ big: 0.16, push: HAND.stroke, loadKg: LOADS.car });
	expect(s.handKg).toBeLessThan(HAND.pushKg);
	expect(s.rise * 100).toBeGreaterThan(0.45);
	expect(s.rise * 100).toBeLessThan(0.48);
});

test('oil barely squashes: at a digger’s 343 bar it gets about 2 % smaller, where air would shrink to a 340th', () => {
	expect(oilShrink(34.3e6)).toBeGreaterThan(0.02);
	expect(oilShrink(34.3e6)).toBeLessThan(0.025);
	expect(1 - airShrink(34.3e6)).toBeCloseTo(1 / 339.5, 4);
});

test('with no air, the oil’s own squash wastes well under a millimetre of the push', () => {
	const s = press({ big: 0.16, push: HAND.stroke, loadKg: LOADS.car });
	expect(s.wasted).toBeLessThan(0.001);
});

test('air in the pipe makes the press spongy: the push squashes the bubble before the car moves', () => {
	const clean = press({ big: 0.16, push: HAND.stroke, loadKg: LOADS.car });
	const air = press({ big: 0.16, push: HAND.stroke, loadKg: LOADS.car, air: 45e-6 });
	// The pressure needs to rise to about 6 times air pressure: the bubble shrinks to about a seventh.
	expect(air.bubble / 45e-6).toBeCloseTo(1 / 6.8, 1);
	expect(air.wasted * 100).toBeGreaterThan(12);
	expect(air.wasted * 100).toBeLessThan(12.6);
	expect(air.rise).toBeLessThan(clean.rise * 0.62);
	// Halfway through the squash the car has not moved and the hand pushes softer than it needs to.
	const early = press({ big: 0.16, push: 0.06, loadKg: LOADS.car, air: 45e-6 });
	expect(early.rise).toBe(0);
	expect(early.handKg).toBeLessThan(clean.handKg);
	expect(early.handKg).toBeGreaterThan(1);
	// The work squashing the bubble is not lost for good: it is stored in the air, like a spring.
	expect(air.workIn).toBeGreaterThan(air.workOut);
});

test('one digger boom cylinder, 12 cm across at 343 bar, pushes like lifting about 40 tonnes', () => {
	expect(cylinderPushKg() / 1000).toBeGreaterThan(38);
	expect(cylinderPushKg() / 1000).toBeLessThan(41);
	// Two of them: about four times the weight of the whole 20-tonne digger.
	expect((2 * cylinderPushKg()) / DIGGER_MASS).toBeGreaterThan(3.8);
});

test('the scoop: each move is made by one cylinder alone', () => {
	for (let i = 1; i < SCOOP.length; i++) {
		const a = cylinderLengths(SCOOP[i - 1].pose);
		const b = cylinderLengths(SCOOP[i].pose);
		const changed = CYLINDERS.filter((c) => Math.abs(a[c] - b[c]) > 0.01);
		expect(changed).toEqual([SCOOP[i].by]);
	}
});

test('the scoop digs below the ground, curls the dirt in, lifts it high, and tips it out', () => {
	const at = (what: string) => geometry(SCOOP.find((s) => s.what.startsWith(what))!.pose);
	expect(at('drag').teeth.y).toBeLessThan(-1);
	expect(at('curl').teeth.y).toBeGreaterThan(at('drag').teeth.y + 1);
	expect(at('lift').armTip.y).toBeGreaterThan(3.5);
	// Dumping turns the bucket's teeth out and down, away from the digger.
	expect(at('open').teeth.x).toBeGreaterThan(at('lift').teeth.x + 2);
	expect(scoopAt(0).pose).toEqual(SCOOP[0].pose);
	expect(scoopAt(1).pose).toEqual(SCOOP[SCOOP.length - 1].pose);
});

test('cylinders stretch and shrink by sensible amounts: under a metre and a half, never inside out', () => {
	for (const c of CYLINDERS) {
		const ls = Array.from({ length: 61 }, (_, i) => cylinderLengths(scoopAt(i / 60).pose)[c]);
		const lo = Math.min(...ls);
		const hi = Math.max(...ls);
		expect(hi - lo).toBeLessThan(1.5);
		expect(lo).toBeGreaterThan(hi - lo);
	}
});
