// A nearest-neighbours machine on drawings shrunk to 10 × 10 squares: the three stored drawings
// with the fewest differing squares vote. More, and more varied, examples make it better; a pile
// where every cat sits at the top and every house at the bottom teaches it position, not shape.
import { expect, test } from '@playwright/test';
import {
	decode,
	encode,
	guess,
	inked,
	score,
	squares,
	differ
} from '../src/routes/teach-a-machine/model';
import {
	MIXED,
	PILE,
	TESTS,
	TRAP,
	TRAP_TESTS,
	cat,
	fish
} from '../src/routes/teach-a-machine/doodles';

const firstOfEach = (n: number) => PILE.slice(0, 2 * n);

test('a drawing becomes 100 squares, and the same drawing moved over is a different set of squares', () => {
	const c = cat({ x: 40, y: 50, s: 40, seed: 1 });
	expect(squares(c)).toHaveLength(100);
	expect(differ(squares(c), squares(c))).toBe(0);
	// The same cat (same wobble) drawn two squares to the right: more squares differ than half
	// the squares it inks.
	const moved = cat({ x: 60, y: 50, s: 40, seed: 1 });
	expect(differ(squares(c), squares(moved))).toBeGreaterThan(inked(squares(c)) / 2);
	// Kept as text and read back, a drawing gives the same squares.
	expect(squares(decode(encode(c)))).toEqual(squares(c));
});

test('the cat to try first inks 33 squares; a stored cat differs in 7, the sitting cat in more than the long house', () => {
	const mine = squares(TESTS[0].doodle);
	expect(inked(mine)).toBe(33);
	const vs = (i: number) => differ(mine, squares(PILE[i].doodle));
	expect(PILE[2].label).toBe('cat');
	expect(vs(2)).toBe(7);
	// Square by square, the sitting cat is less like it than the long, low house is.
	expect(PILE[0].label).toBe('cat');
	expect(PILE[1].label).toBe('house');
	expect(vs(0)).toBe(33);
	expect(vs(1)).toBe(32);
});

test('with the whole pile, the three nearest vote every ready drawing right', () => {
	for (const t of TESTS) expect(guess(t.doodle, PILE).label).toBe(t.label);
	const g = guess(TESTS[0].doodle, PILE);
	expect(g.voters).toHaveLength(3);
	expect(g.votes).toEqual({ cat: 3, house: 0 });
	// Nothing drawn, or nothing to compare with: no answer.
	expect(guess([], PILE).label).toBeNull();
	expect(guess(TESTS[0].doodle, []).label).toBeNull();
});

test('few examples: one of each gets 3 of 8 new drawings wrong, three of each gets all 8, and the votes firm up', () => {
	expect(score(firstOfEach(1), TESTS)).toEqual({ right: 5, of: 8 });
	expect(score(firstOfEach(2), TESTS).right).toBe(5);
	expect(score(firstOfEach(3), TESTS).right).toBe(8);
	expect(score(firstOfEach(8), TESTS).right).toBe(8);
	// With only two drawings stored, the nearer one decides alone.
	expect(guess(TESTS[0].doodle, firstOfEach(1)).voters).toHaveLength(1);
	const unanimous = (n: number) =>
		TESTS.filter((t) => {
			const v = guess(t.doodle, firstOfEach(n)).votes;
			return Math.max(v.cat, v.house) === 3;
		}).length;
	expect(unanimous(3)).toBe(2);
	expect(unanimous(8)).toBe(8);
});

test('the trap: shown cats only at the top and houses only at the bottom, it judges by place', () => {
	expect(TRAP.filter((e) => e.label === 'cat')).toHaveLength(4);
	expect(guess(TRAP_TESTS.catLow, TRAP)).toMatchObject({ label: 'house', votes: { house: 3 } });
	expect(guess(TRAP_TESTS.houseHigh, TRAP)).toMatchObject({ label: 'cat', votes: { cat: 3 } });
	expect(guess(TRAP_TESTS.catHigh, TRAP).label).toBe('cat');
	// Drawings the other way round fix it.
	const mixed = [...TRAP, ...MIXED];
	expect(guess(TRAP_TESTS.catLow, mixed).label).toBe('cat');
	expect(guess(TRAP_TESTS.houseHigh, mixed).label).toBe('house');
	expect(guess(TRAP_TESTS.catHigh, mixed).label).toBe('cat');
});

test('a fish still gets one of the two labels it knows', () => {
	expect(guess(fish(9), PILE).label).toBe('cat');
});
