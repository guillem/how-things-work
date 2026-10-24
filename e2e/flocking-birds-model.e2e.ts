import { expect, test } from '@playwright/test';
import {
	advance,
	displacement,
	initialFlock,
	simulate,
	steering,
	agreement,
	crowdedPairs,
	neighbourDistance,
	ALL_RULES,
	WIDTH,
	HEIGHT,
	SPEED,
	HAWK_START,
	HAWK_END,
	hawkAt,
	type Bird
} from '../src/routes/flocking-birds/model';

test('three local rules align a scattered hundred-bird flock', () => {
	const before = initialFlock();
	const after = simulate(ALL_RULES, 18);
	expect(agreement(before)).toBeLessThan(0.4);
	expect(agreement(after)).toBeGreaterThan(0.85);
	expect(after).toHaveLength(100);
	expect(crowdedPairs(after)).toBeLessThan(3);
});

test('without spacing, birds collapse into crowded clumps', () => {
	const flock = simulate({ ...ALL_RULES, separation: false }, 18);
	expect(crowdedPairs(flock)).toBeGreaterThan(100);
	expect(neighbourDistance(flock)).toBeLessThan(6);
});

test('without alignment, neighbouring birds do not agree on a direction', () => {
	const flock = simulate({ ...ALL_RULES, alignment: false }, 18);
	expect(agreement(flock)).toBeLessThan(0.35);
});

test('without attraction, the flock spreads farther apart', () => {
	const together = simulate(ALL_RULES, 18);
	const apart = simulate({ ...ALL_RULES, cohesion: false }, 18);
	// Measure the extent of each seven-neighbour group, beyond the short-range
	// spacing force. Nearest-neighbour distance alone mostly measures spacing.
	expect(neighbourDistance(apart, 7)).toBeGreaterThan(neighbourDistance(together, 7) * 1.4);
});

test('the bird reacts to seven neighbours, not to a leader or a destination', () => {
	const birds = initialFlock();
	const forward = advance(birds, ALL_RULES, 0);
	const reversed = advance([...birds].reverse(), ALL_RULES, 0).reverse();
	for (let i = 0; i < birds.length; i++) {
		expect(steering(birds, i, ALL_RULES, 0).neighbours).toHaveLength(7);
		expect(forward[i].x).toBeCloseTo(reversed[i].x, 10);
		expect(forward[i].vy).toBeCloseTo(reversed[i].vy, 10);
	}
});

test('a nearby hawk creates an escape turn but a distant one does not', () => {
	const birds: Bird[] = [
		{ x: 690, y: 180, vx: SPEED, vy: 0 },
		{ x: 690, y: 190, vx: SPEED, vy: 0 }
	];
	const flee = steering(birds, 0, { ...ALL_RULES, hawk: true }, 7).escape;
	expect(Math.hypot(flee.x, flee.y)).toBeGreaterThan(0);
	expect(flee.y).toBeLessThan(0);
	const ignored = steering(birds, 0, { ...ALL_RULES, hawk: true }, 3).escape;
	expect(ignored).toEqual({ x: 0, y: 0 });
});

test('long runs conserve bird count and speed while wrapping at the sky edges', () => {
	const flock = simulate({ ...ALL_RULES, hawk: true }, 30);
	expect(flock).toHaveLength(100);
	for (const b of flock) {
		expect(b.x).toBeGreaterThanOrEqual(0);
		expect(b.x).toBeLessThan(WIDTH);
		expect(b.y).toBeGreaterThanOrEqual(0);
		expect(b.y).toBeLessThan(HEIGHT);
		expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(SPEED, 9);
	}
});

/** Connected chains of nearby birds, measured in drawing units, not metres. */
function groups(birds: readonly Bird[]): number {
	const seen = new Set<number>();
	let count = 0;
	for (let i = 0; i < birds.length; i++) {
		if (seen.has(i)) continue;
		count++;
		const queue = [i];
		seen.add(i);
		while (queue.length) {
			const current = queue.pop()!;
			for (let j = 0; j < birds.length; j++) {
				if (seen.has(j)) continue;
				const d = displacement(birds[current], birds[j]);
				if (Math.hypot(d.x, d.y) < 70) {
					seen.add(j);
					queue.push(j);
				}
			}
		}
	}
	return count;
}

test('the passing hawk divides the seeded flock and the birds gather again afterwards', () => {
	const disturbed = simulate({ ...ALL_RULES, hawk: true }, 10);
	const undisturbed = simulate(ALL_RULES, 10);
	const reunited = simulate({ ...ALL_RULES, hawk: true }, 25);
	expect(groups(disturbed)).toBeGreaterThan(groups(undisturbed));
	expect(groups(reunited)).toBe(1);
	expect(agreement(reunited)).toBeGreaterThan(0.95);
});

test('a hawk outside the right edge does not invisibly scare birds at the left edge', () => {
	const birds: Bird[] = [
		{ x: 30, y: HEIGHT / 2, vx: SPEED, vy: 0 },
		{ x: 45, y: HEIGHT / 2, vx: SPEED, vy: 0 }
	];
	const response = steering(birds, 0, { ...ALL_RULES, hawk: true }, HAWK_START);
	expect(response.escape).toEqual({ x: 0, y: 0 });
});

test('the hawk flies completely across the sky rather than vanishing inside it', () => {
	expect(hawkAt(HAWK_START).x).toBeGreaterThan(WIDTH);
	expect(hawkAt(HAWK_END).x).toBeLessThan(-24);
});

test('the seventh-neighbour extent reaches the whole watched group, beyond nearest spacing', () => {
	// Eight birds in a straight line, ten drawing units apart. Each watches all
	// seven others: the farthest distances are70,60,50,40,40,50,60,70.
	const row = Array.from({ length: 8 }, (_, i) => ({
		x: 200 + i * 10,
		y: HEIGHT / 2,
		vx: SPEED,
		vy: 0
	}));
	expect(neighbourDistance(row)).toBeCloseTo(10, 10);
	expect(neighbourDistance(row, 7)).toBeCloseTo(55, 10);
});
