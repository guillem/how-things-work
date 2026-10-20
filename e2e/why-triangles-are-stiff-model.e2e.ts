// Pin-jointed frames: counting the ways they can wobble, and pushing them for real.
import { expect, test } from '@playwright/test';
import {
	gate,
	moved,
	push,
	rank,
	square,
	stretch,
	tower,
	triangle,
	wobbles
} from '../src/routes/why-triangles-are-stiff/model';

test('rank of a small matrix', () => {
	expect(
		rank([
			[1, 2],
			[2, 4]
		])
	).toBe(1);
	expect(
		rank([
			[1, 0],
			[0, 1]
		])
	).toBe(2);
});

test('a square can wobble one way; a triangle cannot; a diagonal stops the square', () => {
	expect(wobbles(square())).toBe(1);
	expect(wobbles(triangle())).toBe(0);
	expect(wobbles(square(true))).toBe(0);
});

test('pushed, the square leans over into a diamond with every stick its own length', () => {
	const s = square();
	const p = push(s, 3, 0.4);
	expect(stretch(s, p)).toBeLessThan(1e-4);
	expect(moved(s, p, 3)).toBeGreaterThan(0.3);
	// The top corners dropped: the square leaned over.
	expect(p.pts[3].y).toBeLessThan(0.97);
});

test('pushed the same way, a triangle and a braced square hardly move', () => {
	for (const f of [triangle(), square(true)]) {
		const top = f.pts.length - 1;
		const p = push(f, top, 0.4);
		expect(moved(f, p, top)).toBeLessThan(0.02);
	}
});

test('a tower of four panels wobbles four ways; each diagonal takes one away', () => {
	expect(wobbles(tower(4))).toBe(4);
	expect(wobbles(tower(4, [true]))).toBe(3);
	expect(wobbles(tower(4, [true, true, true]))).toBe(1);
	expect(wobbles(tower(4, [true, true, true, true]))).toBe(0);
});

test('the fewest sticks: a stiff tower of 10 joints standing on 2 needs 2 x 8 = 16 sticks', () => {
	const t = tower(4, [true, true, true, true]);
	expect(t.pts.length).toBe(10);
	expect(t.sticks.length).toBe(2 * (t.pts.length - t.pinned.length));
});

test('a garden gate on two hinges sags one way; one brace stops it', () => {
	expect(wobbles(gate())).toBe(1);
	expect(wobbles(gate(true))).toBe(0);
	const g = gate();
	const sagged = push(g, 1, 0.3, { down: true });
	expect(sagged.pts[1].y).toBeLessThan(-0.01);
});
