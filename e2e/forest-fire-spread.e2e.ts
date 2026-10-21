import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Reduced motion shows each fire finished. */
async function open(page: Page, step: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./forest-fire-spread/#${step}`);
	await expect(stage(page)).toContainText(text);
}

test('the first forest burns right across', async ({ page }) => {
	await open(page, 'forest', 'the fire crossed the whole forest');
});

test('close-up: trees touching the fire only at a corner stay green', async ({ page }) => {
	await open(page, 'rule', 'stayed green');
	await expect(stage(page)).toContainText('touched the fire only at a corner');
});

test('density: at half the fire dies near the edge, at 65 it crosses', async ({ page }) => {
	await open(page, 'density', 'the fire went out');
	await page.locator('input[type=range][data-control=density]').fill('0.65');
	await expect(stage(page)).toContainText('the fire crossed the whole forest');
});

test('tally: none of 30 forests crossed at half density, most at two-thirds', async ({ page }) => {
	await open(page, 'many', 'of 30 forests');
	await page.locator('input[type=range][data-control=tally]').fill('0.5');
	await expect(stage(page)).toContainText('the fire crossed 0 of 30 forests');
	await page.locator('input[type=range][data-control=tally]').fill('0.67');
	await expect(stage(page)).toContainText(/the fire crossed (28|29|30) of 30 forests/);
});

test('chart: the jump for 50 by 50 forests runs from 56 to 63, narrower for big ones', async ({
	page
}) => {
	await open(page, 'flip', '1 in 10 crossed at 56 trees, 9 in 10 at 63');
	await page.locator('button[data-control=size][data-value="200"]').click();
	await expect(stage(page)).toContainText('200 by 200 forests');
	await expect(stage(page)).toContainText('1 in 10 crossed at 57 trees, 9 in 10 at 61');
});

test('a one-square firebreak stops the fire; wind carries it over', async ({ page }) => {
	await open(page, 'firebreak', 'the fire crossed the whole forest');
	await page.locator('input[type=range][data-control=firebreak]').fill('1');
	await expect(stage(page)).toContainText('the fire went out 24 squares in');
	await page.goto('./forest-fire-spread/#wind');
	await expect(stage(page)).toContainText('the fire went out 24 squares in');
	await page.locator('input[type=checkbox][data-control=wind]').check();
	await expect(stage(page)).toContainText('the fire crossed the whole forest');
});

test('corners: the same half-planted forest burns across when corners count', async ({ page }) => {
	await open(page, 'corners', 'the fire went out');
	await page.locator('input[type=checkbox][data-control=corners]').check();
	await expect(stage(page)).toContainText('the fire crossed the whole forest');
});
