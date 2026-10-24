import { expect, test } from '@playwright/test';
import {
	receivedPower,
	rulerFrequency,
	rulerMode,
	waveDisplacement,
	parcelDisplacements
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

test('magnified parcels remain separated even for the highest notes and strongest twangs', () => {
	let smallestOrdinaryGap = Infinity,
		smallestMarkedGap = Infinity;
	for (const frequency of [36, 82, 326, 440])
		for (const strength of [0.5, 1, 2])
			for (const distance of [1, 4, 8])
				for (let k = 0; k < 80; k++) {
					const shifts = parcelDisplacements(k / 1000, frequency, strength, distance);
					for (let i = 1; i < shifts.length; i++) {
						const gap = 19 + shifts[i] - shifts[i - 1];
						if (i === 20 || i === 21) smallestMarkedGap = Math.min(smallestMarkedGap, gap);
						else smallestOrdinaryGap = Math.min(smallestOrdinaryGap, gap);
					}
				}
	expect(smallestOrdinaryGap).toBeGreaterThan(10);
	expect(smallestMarkedGap).toBeGreaterThan(13);
});
