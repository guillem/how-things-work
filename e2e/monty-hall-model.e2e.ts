// The Monty Hall game: staying wins one time in three, switching two in three, if the host knows.
import { expect, test } from '@playwright/test';
import { cases, play, playMany, rng, tally } from '../src/routes/monty-hall/model';

test('the host never opens the player’s door, and with three doors opens exactly one', () => {
	const r = rng(7);
	for (let i = 0; i < 2000; i++) {
		const g = play(r);
		expect(g.opened).toHaveLength(1);
		expect(g.opened).not.toContain(g.pick);
		expect(g.other).not.toBe(g.pick);
		// The knowing host never shows the car.
		expect(g.opened).not.toContain(g.prize);
		// Exactly one of the two strategies wins.
		expect(Number(g.stayWins) + Number(g.switchWins)).toBe(1);
	}
});

test('over many games staying wins about 1/3 and switching about 2/3', () => {
	const t = tally(playMany(30000, 1));
	expect(t.stayWins / t.games).toBeCloseTo(1 / 3, 1);
	expect(t.switchWins / t.games).toBeCloseTo(2 / 3, 1);
	expect(Math.abs(t.switchWins / t.games - 2 / 3)).toBeLessThan(0.01);
});

test('the three places the prize could be: staying wins in one, switching in two', () => {
	for (const pick of [0, 1, 2]) {
		const c = cases(pick);
		expect(c.filter((g) => g.stayWins)).toHaveLength(1);
		expect(c.filter((g) => g.switchWins)).toHaveLength(2);
	}
});

test('with ten doors and eight opened, switching wins about 9 times in 10', () => {
	const t = tally(playMany(30000, 2, { doors: 10 }));
	expect(Math.abs(t.stayWins / t.games - 0.1)).toBeLessThan(0.01);
	expect(Math.abs(t.switchWins / t.games - 0.9)).toBeLessThan(0.01);
	for (const g of playMany(100, 3, { doors: 10 })) expect(g.opened).toHaveLength(8);
});

test('a host who opens a door at random spoils a third of games; otherwise it is 50–50', () => {
	const t = tally(playMany(60000, 4, { hostKnows: false }));
	expect(Math.abs(t.spoiled / t.games - 1 / 3)).toBeLessThan(0.01);
	const shown = t.games - t.spoiled;
	expect(Math.abs(t.stayWins / shown - 0.5)).toBeLessThan(0.01);
	expect(Math.abs(t.switchWins / shown - 0.5)).toBeLessThan(0.01);
});
