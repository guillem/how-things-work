import { expect, test, type Page } from '@playwright/test';

// The game-theory explainer: what a visitor sees when they play against the page, change the
// payoffs, run and shape the tournament, shorten the games, switch on mistakes and change the
// temptation on the grid. Reduced motion shows each scene complete. The model tests check the
// numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const control = (page: Page, id: string) => page.locator(`[data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'cheating against tit for tat pays once; over ten rounds cooperating pays more',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./game-theory-cooperation/#play');
		await expect(stage(page)).toContainText('You against Tit for tat · round 1 of 10');
		await control(page, 'cheat').click();
		await expect(stage(page)).toContainText('round 2 of 10');
		// tit for tat cooperated in the first round: 5 points to the cheat, 0 to it
		await expect(stage(page)).toContainText('+5');
		for (let k = 0; k < 9; k++) await control(page, 'cheat').click();
		await expect(stage(page)).toContainText('game over');
		await expect(control(page, 'cheat')).toBeDisabled();
		expect(await read(page, 'always cheating')).toBe(14);
		expect(await read(page, 'always cooperating')).toBe(30);
		expect(await read(page, 'your play')).toBe(14);
		// a new game against a different opponent
		await option(page, 'opponent', 'allc').click();
		await expect(stage(page)).toContainText('You against Always cooperate · round 1 of 10');
	}
);

test('payoffs out of the order T > R > P > S are not a dilemma', async ({ page }) => {
	await page.goto('./game-theory-cooperation/#dilemma');
	await expect(stage(page)).toContainText('→ a prisoner’s dilemma');
	await control(page, 'R').fill('6');
	await expect(stage(page)).toContainText('✗ temptation 5 > reward 6');
	await expect(stage(page)).toContainText('→ not a dilemma');
});

test('in the round robin always cheat wins every game and comes last; tit for tat wins none', async ({
	page
}) => {
	await page.goto('./game-theory-cooperation/#tournament');
	await expect(stage(page)).toContainText('7. Always cheat');
	await expect(stage(page)).toContainText('won 60 of 60 games');
	const text = (await stage(page).textContent()) ?? '';
	expect(text).toMatch(/[12]\. Tit for tat\s*won 0 of 60 games/);
	// with one-round games, the tournament is the one-shot game: cheating comes first
	await control(page, 'rounds').press('Home');
	await expect(stage(page)).toContainText('games of 1 round');
	await expect(stage(page)).toContainText('1. Always cheat');
});

test('without strategies that hit back, always cheat wins the tournament', async ({ page }) => {
	await page.goto('./game-theory-cooperation/#no-best');
	await expect(stage(page)).toContainText('7 strategies');
	for (const id of ['tft', 'grim', 'tf2t'])
		await control(page, `in_${id}`).uncheck({ force: true });
	await expect(stage(page)).toContainText('4 strategies');
	await expect(stage(page)).toContainText('1. Always cheat');
});

test('short games let a population of cheats hold out; long ones do not', async ({ page }) => {
	await page.goto('./game-theory-cooperation/#few');
	await expect(stage(page)).toContainText('start: 90 % always cheat · games of 200 rounds');
	await expect(stage(page)).not.toContainText('Always cheat100 %');
	await control(page, 'rounds').fill('10');
	await expect(stage(page)).toContainText('games of 10 rounds');
	await expect(stage(page)).toContainText('Always cheat100 %');
});

test('with mistakes, generous tit for tats lose less to feuds than tit for tats', async ({
	page
}) => {
	await page.goto('./game-theory-cooperation/#echo');
	await expect(stage(page)).toContainText('5 % of moves come out wrong');
	const tft = await read(page, 'a pair of tit for tat scores');
	await option(page, 'echo', 'gtft').click();
	await expect(stage(page)).toContainText('Generous tit for tat vs Generous tit for tat');
	expect(await read(page, 'a pair of generous tit for tat scores')).toBeGreaterThan(tft + 0.4);
});

test('on the grid, the temptation decides whether cooperators hold out', async ({ page }) => {
	await page.goto('./game-theory-cooperation/#grid');
	await expect(stage(page)).toContainText('b = 1.85 · generation 200');
	const mid = await read(page, 'cooperators now:');
	expect(mid).toBeGreaterThan(20);
	expect(mid).toBeLessThan(45);
	await control(page, 'b').press('End');
	await expect(stage(page)).toContainText('b = 2.5');
	expect(await read(page, 'cooperators now:')).toBeLessThan(5);
	await control(page, 'b').press('Home');
	await expect(stage(page)).toContainText('b = 1.2');
	expect(await read(page, 'cooperators now:')).toBeGreaterThan(80);
});
