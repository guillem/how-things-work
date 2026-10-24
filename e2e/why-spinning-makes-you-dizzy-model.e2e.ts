// Spinning and dizziness at level 0: the semicircular canal as a torsion pendulum plus the
// brain's velocity storage, checked against measured behaviour and the numbers the page quotes.
import { expect, test } from '@playwright/test';
import {
	TAU_CANAL,
	chairAngle,
	feelWords,
	feeling,
	flap,
	speedOf,
	spin
} from '../src/routes/why-spinning-makes-you-dizzy/model';

const W = speedOf(5); // 5 turns in 10 seconds: 180 °/s

test('starting to spin: the flap reports the head’s speed, at once', () => {
	const s = spin(W, 0);
	// Just after the push (1 s), the report is close to the chair's real speed.
	expect(flap(s, 1) / W).toBeGreaterThan(0.85);
	expect(feeling(s, 1) / W).toBeGreaterThan(0.85);
	// Within a hundredth of a second of a sudden start the fluid has already caught up with the
	// walls' speed: what is left is its small slip, which the flap holds.
	const sudden = [
		{ t: 0, speed: 0 },
		{ t: 0.001, speed: W }
	];
	expect(flap(sudden, 0.03) / W).toBeGreaterThan(0.99);
});

test('keeping a steady speed: the flap springs back in about 15 to 20 seconds', () => {
	const s = spin(W, 0);
	// After one canal time constant the report has fallen to about 1/e.
	expect(flap(s, 1 + TAU_CANAL) / flap(s, 1)).toBeCloseTo(Math.exp(-1), 1);
	expect(flap(s, 15) / W).toBeLessThan(0.07);
	expect(flap(s, 20) / W).toBeLessThan(0.03);
});

test('the feeling fades more slowly than the flap: a quarter after 10 s, under a tenth after 20 s', () => {
	const s = spin(W, 0);
	for (const t of [5, 10, 15, 20]) expect(feeling(s, t)).toBeGreaterThan(flap(s, t));
	expect(feeling(s, 10) / W).toBeGreaterThan(0.2);
	expect(feeling(s, 10) / W).toBeLessThan(0.3);
	expect(feeling(s, 20) / W).toBeLessThan(0.1);
	expect(feelWords(feeling(s, 30), W)).toBe('not turning');
});

test('stopping after a long spin: you feel turning the other way, nearly as fast, for about 20 s', () => {
	const s = spin(W, 0, 30);
	const after = feeling(s, 30.5);
	expect(after).toBeLessThan(0);
	expect(-after / W).toBeGreaterThan(0.85);
	expect(flap(s, 30.5)).toBeLessThan(0);
	expect(feelWords(after, W)).toBe('turning left, as fast as the chair spun');
	// It fades: a quarter of the speed 10 s later, almost nothing 20 s later.
	expect(-feeling(s, 40) / W).toBeGreaterThan(0.15);
	expect(-feeling(s, 40) / W).toBeLessThan(0.3);
	expect(-feeling(s, 50) / W).toBeLessThan(0.1);
	// The chair itself is still.
	expect(chairAngle(s, 40)).toBeCloseTo(chairAngle(s, 50), 6);
});

test('a short spin makes a weaker dizziness than a long one', () => {
	const after = (d: number) => -feeling(spin(W, 0, d), d + 0.5) / W;
	expect(after(2)).toBeLessThan(0.3);
	expect(after(5)).toBeGreaterThan(0.4);
	expect(after(5)).toBeLessThan(0.6);
	expect(after(10)).toBeGreaterThan(after(5));
	expect(after(30)).toBeGreaterThan(after(10));
});

test('the sensor is linear: twice the speed, twice the bend and twice the feeling', () => {
	const a = spin(W, 0, 20);
	const b = spin(2 * W, 0, 20);
	for (const t of [0.5, 3, 12, 20.5, 26]) {
		expect(flap(b, t)).toBeCloseTo(2 * flap(a, t), 6);
		expect(feeling(b, t)).toBeCloseTo(2 * feeling(a, t), 6);
	}
});

test('the chair turns as many times as its speed says', () => {
	// 5 turns in 10 s for 10 s after a 1 s push: 5 turns, plus a quarter turn from the push.
	expect(chairAngle(spin(W, 0), 11) / 360).toBeCloseTo(5.25, 6);
});
