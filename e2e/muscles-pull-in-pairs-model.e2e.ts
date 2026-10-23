// The elbow as a lever with two pullers: the biceps' changing lever, the bag it holds, the triceps
// pressing on a table, and where the biceps grips.
import { expect, test } from '@playwright/test';
import {
	BICEPS_GRIP,
	FULLY_BENT,
	HAND,
	STRAIGHT,
	angleOf,
	bicepsLength,
	bicepsLever,
	bicepsPull,
	bicepsShortening,
	hand,
	load,
	restingPress,
	tricepsPull,
	tricepsStretch
} from '../src/routes/muscles-pull-in-pairs/model';

test("the biceps' lever matches measured arms: about 1.5 cm straight, 4.5 cm near a right angle", () => {
	// Murray, Delp & Buchanan (1995): about 1.5–2 cm at full extension, a peak of 4–5 cm near 90–100°.
	expect(bicepsLever(STRAIGHT)).toBeGreaterThan(1);
	expect(bicepsLever(STRAIGHT)).toBeLessThan(2.2);
	expect(bicepsLever(90)).toBeGreaterThan(4);
	expect(bicepsLever(90)).toBeLessThan(5);
	expect(bicepsLever(90)).toBeGreaterThan(bicepsLever(30));
	expect(bicepsLever(90)).toBeGreaterThan(bicepsLever(FULLY_BENT));
});

test('bending the elbow shortens the biceps by several centimetres and stretches the triceps', () => {
	let last = bicepsLength(STRAIGHT);
	for (let a = 10; a <= FULLY_BENT; a += 10) {
		expect(bicepsLength(a)).toBeLessThan(last);
		last = bicepsLength(a);
	}
	const shorter = bicepsShortening(STRAIGHT, FULLY_BENT);
	expect(shorter).toBeGreaterThan(6);
	expect(shorter).toBeLessThan(11);
	expect(tricepsStretch(FULLY_BENT)).toBeGreaterThan(tricepsStretch(90));
	expect(tricepsStretch(90)).toBeGreaterThan(tricepsStretch(STRAIGHT));
});

test('with the forearm level, the biceps pulls about 7–8 times a bag in the hand', () => {
	// The bag's own share: 35 cm against a lever of about 4.6 cm.
	const perKg = bicepsPull(90, 6) - bicepsPull(90, 5);
	expect(perKg).toBeGreaterThan(7);
	expect(perKg).toBeLessThan(8);
	// With a 5 kg bag, the forearm's weight adds a little: about 43 kg in all.
	expect(bicepsPull(90, 5)).toBeGreaterThan(40);
	expect(bicepsPull(90, 5)).toBeLessThan(47);
});

test('a hanging, straight arm needs no biceps: the bag hangs from the bones', () => {
	expect(bicepsPull(STRAIGHT, 5)).toBeCloseTo(0, 6);
});

test('a slow move is balanced: biceps pull times its shortening equals the work done lifting', () => {
	// Raising the elbow by 1°, the biceps' work (pull × shortening) equals the weights' turning
	// effect times the angle turned: energy is conserved through the lever, wherever the grip.
	for (const grip of [2, BICEPS_GRIP, 8]) {
		for (const a of [40, 90, 120]) {
			const d = 0.01;
			const work = bicepsPull(a, 5, grip) * bicepsShortening(a - d / 2, a + d / 2, grip);
			const lift = load(a, 5) * ((d * Math.PI) / 180);
			expect(work / lift).toBeCloseTo(1, 3);
		}
	}
});

test('a grip farther from the elbow needs less pull but much more shortening', () => {
	expect(bicepsPull(90, 5, 9)).toBeLessThan(bicepsPull(90, 5) * 0.6);
	expect(bicepsShortening(STRAIGHT, FULLY_BENT, 9)).toBeGreaterThan(
		1.6 * bicepsShortening(STRAIGHT, FULLY_BENT)
	);
});

test('pressing 10 kg on a scale takes about 160 kg of triceps pull; a limp hand rests at under 1 kg', () => {
	// 35 cm against the triceps' 2 cm, less the forearm's own weight, which helps press.
	expect(tricepsPull(10)).toBeGreaterThan(150);
	expect(tricepsPull(10)).toBeLessThan(170);
	expect(restingPress).toBeGreaterThan(0.5);
	expect(restingPress).toBeLessThan(1);
	expect(tricepsPull(restingPress)).toBeCloseTo(0, 6);
});

test('the hand is 35 cm from the elbow, and a dragged hand gives back its angle', () => {
	for (const a of [20, 60, 90, 125]) {
		const p = hand(a);
		expect(Math.hypot(p.x, p.y)).toBeCloseTo(HAND, 6);
		expect(angleOf(p)).toBeCloseTo(a, 6);
	}
	expect(angleOf({ x: -10, y: 30 })).toBe(STRAIGHT);
	expect(angleOf({ x: -10, y: -30 })).toBe(FULLY_BENT);
});
