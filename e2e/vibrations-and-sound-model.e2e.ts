import { expect, test } from '@playwright/test';
import {
	receivedPower,
	rulerFrequency,
	rulerMode,
	waveDisplacement
} from '../src/routes/vibrations-and-sound/model';
test('a ten-centimetre steel ruler has a low audible note; halving the length raises it by two octaves', () => {
	expect(rulerFrequency(10)).toBeGreaterThan(80);
	expect(rulerFrequency(10)).toBeLessThan(83);
	expect(rulerFrequency(5) / rulerFrequency(10)).toBeCloseTo(4, 10);
});
test('the clamped end cannot move or turn, while the free tip has the full displacement', () => {
	expect(rulerMode(0)).toBe(0);
	expect(rulerMode(0.00001)).toBeLessThan(1e-8);
	expect(rulerMode(1)).toBeCloseTo(1, 8);
	// A free end has vanishing curvature: no bending moment at the tip.
	const h = 0.0001;
	expect(
		Math.abs((rulerMode(1) - 2 * rulerMode(1 - h) + rulerMode(1 - 2 * h)) / h ** 2)
	).toBeLessThan(0.001);
});
test('a parcel waits for sound to arrive and moves back and forth, not steadily toward the ear', () => {
	expect(waveDisplacement(3.43, 0.009, 100, 1)).toBe(0);
	expect(waveDisplacement(3.43, 0.0125, 100, 1)).toBeGreaterThan(0.9);
	expect(waveDisplacement(3.43, 0.0175, 100, 1)).toBeLessThan(-0.9);
});
test('doubling distance quarters arriving energy, a stronger twang adds energy, and no air stops this path', () => {
	expect(receivedPower(1, 2)).toBeCloseTo(0.25);
	expect(receivedPower(1, 8)).toBeCloseTo(1 / 64);
	expect(receivedPower(2, 1)).toBeCloseTo(4);
	expect(receivedPower(1, 1, 0)).toBe(0);
	expect(receivedPower(1, 1, 0.5)).toBeCloseTo(0.5);
});
