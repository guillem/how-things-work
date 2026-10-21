// Bar magnets as charged end faces: pull and push, how fast the pull fades, compass, cut magnets,
// and a paper clip that becomes a magnet.
import { expect, test } from '@playwright/test';
import {
	BR,
	EARTH,
	MAGNET_LENGTH,
	POLE,
	SIDE,
	clipJumpGap,
	clipLift,
	compass,
	cut,
	doublingRatio,
	ends,
	field,
	force,
	grams,
	inLine,
	inducedNearPole,
	magnitude,
	moment,
	poles,
	pulls,
	type Magnet
} from '../src/routes/magnets-and-poles/model';

const MU0 = 4e-7 * Math.PI;

test('a ferrite bar with a 1 cm square end carries about 31 A·m at each end', () => {
	expect(POLE).toBeGreaterThan(30);
	expect(POLE).toBeLessThan(32);
});

test('on its axis, the field matches the exact formula for an evenly magnetised block', () => {
	// B(z) = (Br/π)[atan(ab / (2z√(4z² + a² + b²))) − the same at z + L], z from the end face.
	const f = (z: number) =>
		Math.atan((SIDE * SIDE) / (2 * z * Math.sqrt(4 * z * z + 2 * SIDE * SIDE)));
	const exact = (z: number) => (BR / Math.PI) * (f(z) - f(z + MAGNET_LENGTH));
	const [a] = inLine(2);
	const [n] = ends(a);
	for (const z of [0.5, 1, 2, 5]) {
		const B = magnitude(field({ x: n.x + z, y: n.y }, poles(a)));
		expect(B / exact(z)).toBeGreaterThan(0.97);
		expect(B / exact(z)).toBeLessThan(1.03);
	}
});

test('far apart, two magnets in line pull like two tiny ones: 3μ0m²/(2πr⁴)', () => {
	const [a, b] = inLine(300);
	const r = (b.x - a.x) / 100;
	const m = moment(a);
	const dipoles = (3 * MU0 * m * m) / (2 * Math.PI * r ** 4);
	expect(magnitude(force(a, b)) / dipoles).toBeCloseTo(1, 2);
	// So doubling a large gap makes the pull 16 times weaker.
	expect(doublingRatio(2000)).toBeCloseTo(16, 0);
});

test('unlike ends pull together; like ends push apart', () => {
	const [a, b] = inLine(2);
	expect(pulls(a, b)).toBe(true);
	const [c, d] = inLine(2, true);
	expect(pulls(c, d)).toBe(false);
	// Same size either way round.
	expect(magnitude(force(a, b))).toBeCloseTo(magnitude(force(c, d)), 10);
});

test('side by side, both pointing the same way, two magnets push apart', () => {
	const a: Magnet = { x: 0, y: 0, angle: 0, length: MAGNET_LENGTH };
	const b: Magnet = { x: 0, y: 2, angle: 0, length: MAGNET_LENGTH };
	expect(pulls(a, b)).toBe(false);
	expect(pulls(a, { ...b, angle: Math.PI })).toBe(true);
});

test('each magnet pulls the other just as hard (equal and opposite)', () => {
	const a: Magnet = { x: 5, y: 5, angle: 0.3, length: MAGNET_LENGTH };
	const b: Magnet = { x: 14, y: 9, angle: 2.1, length: MAGNET_LENGTH };
	const ab = force(a, b);
	const ba = force(b, a);
	expect(ab.x).toBeCloseTo(-ba.x, 12);
	expect(ab.y).toBeCloseTo(-ba.y, 12);
});

test('the numbers the page quotes: 65 g at 1 cm, under a third at 2 cm, ~150 times weaker at 10 cm', () => {
	const at = (gap: number) => grams(magnitude(force(...inLine(gap))));
	expect(Math.round(at(1))).toBe(65);
	expect(Math.round(at(2))).toBe(19);
	expect(at(2)).toBeLessThan(at(1) / 3);
	expect(at(1) / at(10)).toBeGreaterThan(140);
	expect(at(1) / at(10)).toBeLessThan(170);
	// The pull keeps falling faster as the gap widens.
	expect(doublingRatio(1)).toBeGreaterThan(2);
	expect(doublingRatio(1)).toBeLessThan(doublingRatio(4));
});

test('the field points away from the north end and into the south end', () => {
	const [a] = inLine(2);
	const [n, s] = ends(a);
	expect(field({ x: n.x + 1, y: n.y }, poles(a)).x).toBeGreaterThan(0);
	expect(field({ x: s.x - 1, y: s.y }, poles(a)).x).toBeGreaterThan(0);
});

test('near the magnet a compass follows the magnet; far away it follows the Earth', () => {
	const [a] = inLine(2);
	expect(magnitude(field({ x: 15, y: 7.5 }, poles(a)))).toBeGreaterThan(10 * EARTH);
	expect(magnitude(field({ x: 80, y: 7.5 }, poles(a)))).toBeLessThan(EARTH);
	// A needle 33 cm beyond the north end turns nearly to the Earth's north (up the board).
	const needle = compass({ x: 43, y: 7.5 }, poles(a));
	expect(needle.vsEarth).toBeLessThan(0.5);
	expect(Math.abs(needle.angle + Math.PI / 2)).toBeLessThan(0.5);
	// Beside the magnet, a needle points from its north end back towards its south end.
	const beside = compass({ x: a.x, y: a.y - 3 }, poles(a));
	expect(beside.vsEarth).toBeGreaterThan(10);
	expect(Math.cos(beside.angle)).toBeLessThan(-0.9);
});

test('cut in pieces, every piece is a magnet with two ends, and the pieces pull together', () => {
	const [a] = inLine(2);
	for (const n of [2, 4, 8]) {
		const pieces = cut(a, n);
		expect(pieces).toHaveLength(n);
		for (const p of pieces) {
			const ps = poles(p);
			const north = ps.filter((q) => q.q > 0);
			const south = ps.filter((q) => q.q < 0);
			expect(north.reduce((t, q) => t + q.q, 0)).toBeCloseTo(POLE, 9);
			expect(south.reduce((t, q) => t + q.q, 0)).toBeCloseTo(-POLE, 9);
			// Each piece's north end faces the same way as the whole magnet's.
			expect(north[0].x).toBeGreaterThan(south[0].x);
		}
		// The pieces together are exactly as strong a magnet as the whole bar.
		expect(pieces.reduce((t, p) => t + moment(p), 0)).toBeCloseTo(moment(a), 12);
		expect(pulls(pieces[0], pieces[1])).toBe(true);
	}
});

test('a clip below either end becomes the opposite pole there, so it is always pulled', () => {
	const [a] = inLine(2);
	const [n, s] = ends(a);
	expect(inducedNearPole(a, { x: n.x + 0.1, y: n.y }, { x: n.x + 3.4, y: n.y })).toBe('S');
	expect(inducedNearPole(a, { x: s.x - 0.1, y: s.y }, { x: s.x - 3.4, y: s.y })).toBe('N');
});

test('a paper clip jumps up to the magnet from a centimetre or two away, not from far off', () => {
	const jump = clipJumpGap();
	expect(jump).toBeGreaterThan(0.5);
	expect(jump).toBeLessThan(3);
	// Closer than that, the pull is many times the clip's weight; a few centimetres off, a fraction.
	expect(clipLift(0.5)).toBeGreaterThan(5);
	expect(clipLift(4)).toBeLessThan(0.1);
});
