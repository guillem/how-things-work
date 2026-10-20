// Shadows and pinholes: straight-line light, blocked or let through.
import { expect, test } from '@playwright/test';
import {
	blur,
	brightness,
	enlargement,
	imageOf,
	lit,
	shadow,
	softEdge,
	wallLight
} from '../src/routes/shadows-and-pinholes/model';

const toy = { x: 2, bottom: 0, top: 0.3 };
const bulb = { x: 1, y: 0.15, size: 0 };

test('a tiny bulb gives a sharp shadow: dark inside, fully lit outside', () => {
	const s = shadow(bulb, toy, 4);
	expect(lit(bulb, toy, 4, (s.bottom + s.top) / 2)).toBe(0);
	expect(lit(bulb, toy, 4, s.top + 0.01)).toBe(1);
	expect(lit(bulb, toy, 4, s.bottom - 0.01)).toBe(1);
});

test('lamp 1 m from the toy, wall 2 m behind it: the shadow is three times as tall as the toy', () => {
	expect(enlargement(bulb, toy, 4)).toBeCloseTo(3, 12);
	expect(shadow(bulb, toy, 4).height).toBeCloseTo(0.9, 12);
});

test('bring the lamp closer and the shadow grows; bring the wall closer and it shrinks', () => {
	const near = enlargement({ ...bulb, x: 1.5 }, toy, 4);
	const far = enlargement({ ...bulb, x: 0 }, toy, 4);
	expect(near).toBeGreaterThan(far);
	expect(enlargement(bulb, toy, 2.5)).toBeLessThan(enlargement(bulb, toy, 4));
	// With the wall right behind the toy the shadow is the toy's own size.
	expect(enlargement(bulb, toy, 2)).toBeCloseTo(1, 12);
});

test('a wide lampshade softens the edge, over the width the straight lines predict', () => {
	const shade = { x: 1, y: 0.15, size: 0.2 };
	const edge = softEdge(shade, toy, 4);
	expect(edge).toBeCloseTo(0.4, 12);
	// Across the soft edge the light rises from none to full.
	const samples = wallLight([shade], toy, 4, -1, 2, 3000);
	const partial = samples.filter(([, l]) => l > 0.001 && l < 0.999);
	const ys = partial.map(([y]) => y);
	// Two soft edges (top and bottom), each about 0.4 m wide.
	expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.9 + 0.4 - 0.01);
});

test('two lamps make two shadows: half-dark where one lamp is hidden, dark where both are', () => {
	const a = { x: 1, y: 0.1, size: 0 };
	const b = { x: 1, y: 0.25, size: 0 };
	const light = wallLight([a, b], toy, 4, -1.5, 1.5, 600).map(([, l]) => l);
	expect(Math.max(...light)).toBe(2);
	expect(light.some((l) => l === 1)).toBe(true);
	expect(Math.min(...light)).toBe(0);
});

test('a pinhole makes an upside-down picture, scaled by the box depth over the distance', () => {
	const p = { front: 2, back: 0.3, hole: 0.001 };
	expect(imageOf(p, 0.5)).toBeCloseTo(-0.075, 12);
	expect(imageOf(p, -0.5)).toBeGreaterThan(0);
});

test('a bigger hole: a brighter but blurrier picture', () => {
	const small = { front: 2, back: 0.3, hole: 0.001 };
	const big = { front: 2, back: 0.3, hole: 0.004 };
	expect(blur(big)).toBeCloseTo(4 * blur(small), 12);
	expect(brightness(big)).toBeCloseTo(16 * brightness(small), 9);
});
