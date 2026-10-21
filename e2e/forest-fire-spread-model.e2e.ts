// A forest fire on a square grid (the NetLogo Fire model): site percolation, its tipping density
// (Newman & Ziff 2000; Malarz & Galam 2005 with the corners), firebreaks and wind.
import { expect, test } from '@playwright/test';
import {
	atShare,
	burn,
	carried,
	CHART_FORESTS,
	chanceToCross,
	CLOSE,
	cornerSafe,
	PAGE,
	coinToss,
	plant,
	reachByTick,
	tally,
	threshold,
	thresholds,
	type Forest
} from '../src/routes/forest-fire-spread/model';

/** A forest drawn as text: '#' a tree, '.' bare ground. */
function draw(rows: string[]): Forest {
	const h = rows.length;
	const w = rows[0].length;
	return { w, h, trees: Uint8Array.from(rows.join(''), (c) => (c === '#' ? 1 : 0)) };
}

test('the fire passes one tree per tick to the trees touching its sides, never across a corner', () => {
	const f = draw(['####.', '...#.', '...##']);
	const fire = burn(f);
	const at = (x: number, y: number) => fire.lit[y * f.w + x];
	expect([at(0, 0), at(1, 0), at(2, 0), at(3, 0), at(3, 1), at(3, 2), at(4, 2)]).toEqual([
		0, 1, 2, 3, 4, 5, 6
	]);
	expect(fire.crossed).toBe(true);
	// Two trees touching only at a corner: the fire stops, unless corners count.
	const corner = draw(['#..', '.#.', '..#']);
	expect(burn(corner).crossed).toBe(false);
	expect(burn(corner).burnt).toBe(1);
	expect(burn(corner, { corners: true }).crossed).toBe(true);
});

test('wind carries the fire over a gap of one square downwind, not two, and not upwind', () => {
	expect(burn(draw(['#.#'])).crossed).toBe(false);
	const windy = burn(draw(['#.#']), { jump: 1 });
	expect(windy.crossed).toBe(true);
	expect(carried(windy, 3, 2)).toBe(true);
	expect(burn(draw(['#..#']), { jump: 1 }).crossed).toBe(false);
	// The wind blows from the left: a tree the fire could reach only by jumping back stays green.
	const back = burn(draw(['####', '...#', '.#.#']), { jump: 1 });
	expect(back.lit[2 * 4 + 3]).toBe(4);
	expect(back.lit[2 * 4 + 1]).toBe(-1);
});

test('planting more densely adds trees to the same forest instead of reshuffling it', () => {
	const thin = plant(50, 50, 0.5, 1);
	const thick = plant(50, 50, 0.6, 1);
	thin.trees.forEach((t, i) => t && expect(thick.trees[i]).toBe(1));
	const share = thick.trees.reduce((a, b) => a + b, 0) / thick.trees.length;
	expect(share).toBeGreaterThan(0.57);
	expect(share).toBeLessThan(0.63);
});

test('the tipping density of a forest is where the fire itself first gets across', () => {
	for (let seed = 1; seed <= 20; seed++) {
		const p = threshold(30, seed);
		expect(burn(plant(30, 30, p + 1e-9, seed)).crossed).toBe(true);
		expect(burn(plant(30, 30, p - 1e-9, seed)).crossed).toBe(false);
	}
});

test('in a 50 by 50 forest: at half density the fire never crosses, at two-thirds nearly always, at six in ten it is a coin toss', () => {
	const half = tally(50, 0.5, 100);
	expect(half.filter((f) => f.crossed).length).toBe(0);
	// It gets a short way in and dies: on average less than a third of the way across.
	expect(half.reduce((a, f) => a + f.reach, 0) / half.length).toBeLessThan(50 / 3);
	expect(tally(50, 2 / 3, 100).filter((f) => f.crossed).length).toBeGreaterThanOrEqual(97);
	const six = tally(50, 0.6, 100).filter((f) => f.crossed).length;
	expect(six).toBeGreaterThan(30);
	expect(six).toBeLessThan(75);
});

test('the coin toss of a big square forest is at 59 trees in every 100 squares (Newman & Ziff 2000: 0.592746)', () => {
	const big = thresholds(128, 160);
	expect(coinToss(big)).toBeGreaterThan(0.5927 - 0.006);
	expect(coinToss(big)).toBeLessThan(0.5927 + 0.006);
});

test('the bigger the forest, the narrower the band of density where the fire goes from never to always crossing', () => {
	const band = (size: number, forests: number) => {
		const sorted = thresholds(size, forests);
		const at = (q: number) => sorted[Math.round(q * (sorted.length - 1))];
		return at(0.9) - at(0.1);
	};
	const small = band(10, 400);
	const page = band(50, 200);
	const huge = band(200, 40);
	expect(small).toBeGreaterThan(0.15);
	expect(page).toBeLessThan(small / 2);
	expect(huge).toBeLessThan(page / 2);
	expect(huge).toBeLessThan(0.04);
});

test('when the corner trees count too, the coin toss moves to 41 trees in every 100 squares (Malarz & Galam 2005: 0.407)', () => {
	const big = thresholds(128, 160, true);
	expect(coinToss(big)).toBeGreaterThan(0.407 - 0.008);
	expect(coinToss(big)).toBeLessThan(0.407 + 0.008);
	// In the page's forest, half density is then nearly always enough.
	expect(chanceToCross(thresholds(50, 200, true), 0.5)).toBeGreaterThan(0.95);
});

test('a firebreak one square wide stops the fire; with wind it takes two', () => {
	const runs = (width: number, jump: number) =>
		Array.from(
			{ length: 50 },
			(_, k) => burn(plant(50, 50, 0.7, k + 1, { from: 24, width }), { jump }).crossed
		).filter(Boolean).length;
	expect(runs(0, 0)).toBe(50);
	expect(runs(1, 0)).toBe(0);
	expect(runs(1, 1)).toBeGreaterThanOrEqual(48);
	expect(runs(2, 1)).toBe(0);
});

test('wind lets the fire cross a forest too thin to carry it without', () => {
	expect(tally(50, 0.5, 100).filter((f) => f.crossed).length).toBe(0);
	expect(tally(50, 0.5, 100, { jump: 1 }).filter((f) => f.crossed).length).toBeGreaterThan(95);
});

test('the page’s 30 forests: none crossed at 50 in every 100 squares, about half at 59, nearly all at 67', () => {
	const crossed = (p: number) => tally(50, p, 30).filter((f) => f.crossed).length;
	expect(crossed(0.5)).toBe(0);
	expect(crossed(0.59)).toBeGreaterThanOrEqual(12);
	expect(crossed(0.59)).toBeLessThanOrEqual(18);
	expect(crossed(0.67)).toBeGreaterThanOrEqual(28);
});

test('the page’s chart: for 50 by 50 forests the jump runs from 56 (1 in 10 crossed) to 63 (9 in 10)', () => {
	const sorted = thresholds(50, CHART_FORESTS[50]);
	expect(Math.round(atShare(sorted, 0.1) * 100)).toBe(56);
	expect(Math.round(atShare(sorted, 0.9) * 100)).toBe(63);
	expect(chanceToCross(sorted, atShare(sorted, 0.1) + 1e-9)).toBeGreaterThanOrEqual(0.1);
	expect(Math.round(coinToss(sorted) * 100)).toBe(59);
	expect(Math.round(coinToss(thresholds(50, CHART_FORESTS[50], true)) * 100)).toBe(41);
});

test('the page’s own forest does what the narrative says', () => {
	const run = (p: number, width = 0, rule = {}) =>
		burn(plant(PAGE.size, PAGE.size, p, PAGE.seed, { from: PAGE.firebreakFrom, width }), rule);
	expect(run(0.62).crossed).toBe(true);
	// Half density: the fire gets only a few squares in.
	expect(run(0.5).reach).toBeLessThan(10);
	expect(run(0.65).crossed).toBe(true);
	expect(run(0.7).crossed).toBe(true);
	expect(run(0.7, 1).crossed).toBe(false);
	expect(run(0.7, 1, { jump: 1 }).crossed).toBe(true);
	expect(run(0.7, 2, { jump: 1 }).crossed).toBe(false);
	expect(run(0.5, 0, { corners: true }).crossed).toBe(true);
});

test('the close-up: the fire crosses, yet trees touching it only at a corner stay green', () => {
	const f = plant(CLOSE.w, CLOSE.h, CLOSE.density, CLOSE.seed);
	const fire = burn(f);
	expect(fire.crossed).toBe(true);
	expect(fire.burnt).toBeLessThan(fire.trees);
	expect(cornerSafe(f, fire).length).toBeGreaterThan(0);
	expect(cornerSafe(f, burn(f, { corners: true })).length).toBe(0);
});

test('the reach bars grow with the fire and end where it went out', () => {
	const fire = burn(plant(50, 50, 0.59, 1));
	const reach = reachByTick(fire, 50);
	expect(reach[0]).toBe(0);
	for (let k = 1; k < reach.length; k++) expect(reach[k]).toBeGreaterThanOrEqual(reach[k - 1]);
	expect(reach[reach.length - 1]).toBe(fire.reach);
});
