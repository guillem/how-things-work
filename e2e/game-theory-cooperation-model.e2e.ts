// Checks the game-theory model against what is known about the prisoner's dilemma: in a single
// game cheating pays whatever the other does, for any valid payoffs; tit for tat never outscores
// the player it meets, yet comes at or near the top of Axelrod's (1984) round robin; games that
// are too short, or too few cooperators, favour always-cheat; mistaken moves start echoes of
// retaliation between tit for tats that generous tit for tat avoids (Nowak & Sigmund 1992); and on
// Nowak & May's (1992) grid, cooperators and cheats coexist at about 32 % cooperators for
// 1.8 < b < 2. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	ALL_IDS,
	CLASSIC,
	bestReply,
	cooperatorShare,
	evolve,
	generosity,
	gridRun,
	isDilemma,
	oneDefector,
	playMatch,
	randomGrid,
	rng,
	rewardsCooperation,
	tournament,
	type Payoffs,
	type StrategyId
} from '../src/routes/game-theory-cooperation/model';

const share = (ids: readonly StrategyId[], shares: readonly number[], id: StrategyId) =>
	shares[ids.indexOf(id)];

test('in a single game, cheating pays more whatever the other player does', () => {
	const rand = rng(7);
	let checked = 0;
	while (checked < 500) {
		const [S, P, R, T] = Array.from({ length: 4 }, () => Math.round(rand() * 10)).sort(
			(a, b) => a - b
		);
		const p: Payoffs = { T, R, P, S };
		if (!isDilemma(p)) continue;
		expect(bestReply(p, 'C')).toBe('D');
		expect(bestReply(p, 'D')).toBe('D');
		// ...yet both cooperating beats both cheating, for both players: the dilemma
		expect(p.R).toBeGreaterThan(p.P);
		checked++;
	}
	// Axelrod's payoffs are a dilemma in which steady cooperation beats taking turns
	expect(isDilemma(CLASSIC)).toBe(true);
	expect(rewardsCooperation(CLASSIC)).toBe(true);
	expect(rewardsCooperation({ T: 9, R: 3, P: 1, S: 0 })).toBe(false);
	// without the order T > R > P > S it isn't a dilemma: cooperating can be the best reply
	expect(bestReply({ T: 3, R: 5, P: 1, S: 0 }, 'C')).toBe('C');
});

test('ten rounds against tit for tat: always cheating scores 14, always cooperating 30', () => {
	expect(playMatch('alld', 'tft', { rounds: 10 }).scoreA).toBe(14);
	expect(playMatch('allc', 'tft', { rounds: 10 }).scoreA).toBe(30);
	// in one game, cheating pays: 5 against tit for tat's 0 in the first round
	expect(playMatch('alld', 'tft', { rounds: 1 }).scoreA).toBe(5);
});

test('tit for tat never outscores the player it meets', () => {
	for (const other of ALL_IDS) {
		for (const rounds of [1, 5, 50, 200]) {
			for (let seed = 1; seed <= 5; seed++) {
				const m = playMatch('tft', other, { rounds, seed });
				expect(m.scoreA).toBeLessThanOrEqual(m.scoreB);
			}
		}
	}
	const t = tournament(ALL_IDS, { rounds: 200 });
	expect(t.wins[t.ids.indexOf('tft')]).toBe(0);
	// always-cheat wins every game it plays except against its twin...
	expect(t.wins[t.ids.indexOf('alld')]).toBe(10 * (ALL_IDS.length - 1));
});

test("in Axelrod's round robin of long games, tit for tat finishes at the top; always-cheat last", () => {
	const t = tournament(ALL_IDS, { rounds: 200 });
	const rank = (id: StrategyId) => t.ranking.indexOf(t.ids.indexOf(id));
	const best = t.score[t.ranking[0]];
	expect(rank('tft')).toBeLessThanOrEqual(1);
	expect(t.score[t.ids.indexOf('tft')]).toBeGreaterThan(0.95 * best);
	expect(rank('alld')).toBe(ALL_IDS.length - 1);
	// grudger edges ahead only by punishing Random for ever; without Random, tit for tat ties first
	const pool = ALL_IDS.filter((id) => id !== 'random');
	const u = tournament(pool, { rounds: 200 });
	expect(u.score[u.ids.indexOf('tft')]).toBeCloseTo(u.score[u.ranking[0]], 9);
});

test('which strategy wins depends on who else is playing', () => {
	// among the naive, always-cheat comes first
	const t = tournament(['tft', 'alld', 'allc', 'allc', 'allc'], { rounds: 200 });
	expect(t.ids[t.ranking[0]]).toBe('alld');
});

test('short games favour cheating', () => {
	for (const rounds of [1, 2, 3]) {
		const t = tournament(ALL_IDS, { rounds });
		expect(t.ids[t.ranking[0]]).toBe('alld');
	}
	// with three-round games, an equal mix evolves into a population of cheats
	const t3 = tournament(ALL_IDS, { rounds: 3 });
	const ev = evolve(
		t3,
		ALL_IDS.map(() => 1),
		100
	);
	expect(share(ev.ids, ev.shares[100], 'alld')).toBeGreaterThan(0.99);
});

test('too few cooperators, or games too short, and cheats keep the population', () => {
	const start = ALL_IDS.map((id) => (id === 'alld' ? 0.9 : 0.1 / (ALL_IDS.length - 1)));
	const long = tournament(ALL_IDS, { rounds: 200 });
	const evLong = evolve(long, start, 100);
	expect(share(evLong.ids, evLong.shares[100], 'alld')).toBeLessThan(0.01);
	const short = tournament(ALL_IDS, { rounds: 10 });
	const evShort = evolve(short, start, 100);
	expect(share(evShort.ids, evShort.shares[100], 'alld')).toBeGreaterThan(0.99);
	// with an equal start, the same ten-round games let the nice strategies take over
	const evEqual = evolve(
		short,
		ALL_IDS.map(() => 1),
		100
	);
	expect(share(evEqual.ids, evEqual.shares[100], 'alld')).toBeLessThan(0.01);
});

test('with mistakes, generous tit for tat does better than tit for tat', () => {
	expect(generosity(CLASSIC)).toBeCloseTo(1 / 3, 9);
	const pair = (noise: number) => tournament(['tft', 'gtft'], { rounds: 200, noise, repeats: 20 });
	// without mistakes the two can't be told apart...
	const quiet = pair(0);
	expect(quiet.score[0]).toBeCloseTo(quiet.score[1], 9);
	// ...with them, two tit for tats fall into echoes of retaliation and generosity breaks them
	const noisy = pair(0.05);
	expect(noisy.perRound[1][1]).toBeGreaterThan(noisy.perRound[0][0] + 0.4);
	expect(noisy.score[1]).toBeGreaterThan(noisy.score[0]);
	// and an evolving population with mistakes ends with more generous tit for tat
	const t = tournament(ALL_IDS, { rounds: 200, noise: 0.05, repeats: 20 });
	const ev = evolve(
		t,
		ALL_IDS.map(() => 1),
		100
	);
	const end = ev.shares[100];
	expect(share(ev.ids, end, 'gtft')).toBeGreaterThan(2 * share(ev.ids, end, 'tft'));
	// grudger, which never forgives a slip, dies out
	expect(share(ev.ids, end, 'grim')).toBeLessThan(0.01);
});

test("Nowak & May's grid: cooperators and cheats coexist for 1.8 < b < 2", () => {
	const mean = (b: number, from: number, to: number) => {
		const run = gridRun(randomGrid(60, 0.9), b, to);
		const xs = run.slice(from).map(cooperatorShare);
		return { mean: xs.reduce((a, x) => a + x, 0) / xs.length, min: Math.min(...xs) };
	};
	for (const b of [1.85, 1.95]) {
		const r = mean(b, 50, 200);
		// Nowak & May: the fraction of cooperators fluctuates around 12 ln 2 − 8 ≈ 0.318
		expect(r.mean).toBeGreaterThan(0.26);
		expect(r.mean).toBeLessThan(0.38);
		expect(r.min).toBeGreaterThan(0.2);
	}
	// weaker temptation: cooperators hold most of the grid; stronger: cheats take almost all of it
	expect(mean(1.7, 50, 100).mean).toBeGreaterThan(0.6);
	expect(mean(2.1, 50, 100).mean).toBeLessThan(0.1);
	// a single cheat in a sea of cooperators grows into a symmetric, ever-changing pattern
	const k = gridRun(oneDefector(59), 1.85, 120);
	const g = k[120];
	expect(cooperatorShare(g)).toBeLessThan(0.6);
	const n = g.size;
	for (let y = 0; y < n; y++)
		for (let x = 0; x < n; x++) expect(g.cells[y * n + x]).toBe(g.cells[y * n + (n - 1 - x)]);
});
