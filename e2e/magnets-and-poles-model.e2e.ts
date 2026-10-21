// Bar magnets as pairs of poles: pull and push, how fast the pull fades, compass, cut magnets.
import { expect, test } from '@playwright/test';
import {
	EARTH,
	MAGNET_LENGTH,
	POLE,
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
	poles,
	pulls,
	type Magnet
} from '../src/routes/magnets-and-poles/model';

test('a ferrite bar with a 1 cm square end carries about 31 A·m at each pole', () => {
	expect(POLE).toBeGreaterThan(30);
	expect(POLE).toBeLessThan(32);
});

test('unlike ends pull together; like ends push apart', () => {
	const [a, b] = inLine(2);
	expect(pulls(a, b)).toBe(true);
	const [c, d] = inLine(2, true);
	expect(pulls(c, d)).toBe(false);
	// Same size either way round.
	expect(magnitude(force(a, b))).toBeCloseTo(magnitude(force(c, d)), 10);
});

test('each magnet pulls the other just as hard (equal and opposite)', () => {
	const a: Magnet = { x: 5, y: 5, angle: 0.3, length: MAGNET_LENGTH };
	const b: Magnet = { x: 14, y: 9, angle: 2.1, length: MAGNET_LENGTH };
	const ab = force(a, b);
	const ba = force(b, a);
	expect(ab.x).toBeCloseTo(-ba.x, 12);
	expect(ab.y).toBeCloseTo(-ba.y, 12);
});

test('the pull fades fast: doubling a large gap makes it about 16 times weaker', () => {
	expect(doublingRatio(1)).toBeGreaterThan(2);
	expect(doublingRatio(1)).toBeLessThan(doublingRatio(4));
	// Far apart, a pair of magnets behaves like two tiny ones: force falls as distance to the 4th.
	expect(doublingRatio(2000)).toBeCloseTo(16, 0);
	// Close up, from 1 cm to 8 cm apart, the pull falls about 45 times.
	const near = magnitude(force(...inLine(1)));
	const far = magnitude(force(...inLine(8)));
	expect(near / far).toBeGreaterThan(35);
	expect(near / far).toBeLessThan(55);
});

test('two school magnets 1 cm apart pull like a 21 g weight; 2 cm apart, less than half that', () => {
	const at1 = grams(magnitude(force(...inLine(1))));
	const at2 = grams(magnitude(force(...inLine(2))));
	expect(Math.round(at1)).toBe(21);
	expect(Math.round(at2)).toBe(8);
	expect(at2).toBeLessThan(at1 / 2);
});

test('the field points away from the north end and into the south end', () => {
	const [a] = inLine(2);
	const [n, s] = ends(a);
	expect(field({ x: n.x + 1, y: n.y }, poles(a)).x).toBeGreaterThan(0);
	expect(field({ x: s.x - 1, y: s.y }, poles(a)).x).toBeGreaterThan(0);
});

test('near the magnet a compass follows the magnet; far away it follows the Earth', () => {
	const [a] = inLine(2);
	const near = field({ x: 15, y: 7.5 }, poles(a));
	expect(magnitude(near)).toBeGreaterThan(10 * EARTH);
	const far = field({ x: 80, y: 7.5 }, poles(a));
	expect(magnitude(far)).toBeLessThan(EARTH);
	// A needle 33 cm beyond the north end turns nearly to the Earth's north (up the board).
	const needle = compass({ x: 43, y: 7.5 }, poles(a));
	expect(needle.vsEarth).toBeLessThan(0.5);
	expect(Math.abs(needle.angle + Math.PI / 2)).toBeLessThan(0.5);
	// Beside the magnet, a needle points from its north end back towards its south end.
	const beside = compass({ x: a.x, y: a.y - 3 }, poles(a));
	expect(beside.vsEarth).toBeGreaterThan(10);
	expect(Math.cos(beside.angle)).toBeLessThan(-0.9);
});

test('cut in pieces, every piece is a magnet with two ends that pull on each other', () => {
	const [a] = inLine(2);
	for (const n of [2, 4, 8]) {
		const pieces = cut(a, n);
		expect(pieces).toHaveLength(n);
		for (const p of pieces) {
			const [north, south] = poles(p);
			expect(north.q).toBeGreaterThan(0);
			expect(south.q).toBeLessThan(0);
			// Each piece's north end faces the same way as the whole magnet's.
			expect(north.x).toBeGreaterThan(south.x);
		}
		expect(pulls(pieces[0], pieces[1])).toBe(true);
	}
});

test('a clip touching either end becomes the opposite pole there, so it is always pulled', () => {
	const [a] = inLine(2);
	const [n, s] = ends(a);
	expect(inducedNearPole(a, { x: n.x + 0.1, y: n.y }, { x: n.x + 3.4, y: n.y })).toBe('S');
	expect(inducedNearPole(a, { x: s.x - 0.1, y: s.y }, { x: s.x - 3.4, y: s.y })).toBe('N');
});
