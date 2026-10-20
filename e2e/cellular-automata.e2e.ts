import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('table: clicking a box flips one bit of the rule', async ({ page }) => {
	await open(page, './cellular-automata/#table', 'rule 90 = 01011010');
	// The 111 box is bit 7: flipping it turns rule 90 into rule 218.
	await page.getByRole('button', { name: 'Neighbourhood 111: next state 0' }).click();
	await expect(stage(page)).toContainText('rule 218 = 11011010');
	await expect(page.locator('input[type=range][data-control=rule]')).toHaveValue('218');
});

test('rule 90 always starts from one cell, even after choosing a random start', async ({
	page
}) => {
	await open(page, './cellular-automata/#table', 'rule 90');
	await page.locator('[data-control=start][data-value=random]').click();
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#rule90$/);
	// From one live cell, rule 90's live-cell count after 49 generations is 2^(bits of 49) = 8.
	await expect(stage(page)).toContainText('8 now');
});

test('rule 30 keeps changing on a random ring; its table is 00011110', async ({ page }) => {
	await open(page, './cellular-automata/#rule30', 'rule 30 = 00011110');
	await expect(stage(page)).toContainText('keeps changing for 1,000 generations');
});

test('families: rule 110’s family is 110, 124, 137 and 193', async ({ page }) => {
	await open(page, './cellular-automata/#families', 'family');
	await page.locator('input[type=range][data-control=rule]').fill('110');
	await expect(stage(page)).toContainText('110 · 124 · 137 · 193');
});

test('survey: 28 die out, 200 repeat, 28 keep changing; the arrow keys pick a rule', async ({
	page
}) => {
	await open(page, './cellular-automata/#survey', 'dies out: 28');
	await expect(stage(page)).toContainText('repeats: 200');
	await expect(stage(page)).toContainText('keeps changing: 28');
	await page.locator('input[type=range][data-control=rule]').fill('4');
	await expect(stage(page)).toContainText('rule 4: repeats');
	// The grid is grouped: after rule 4 among the rules that repeat comes rule 5.
	await page.getByRole('slider', { name: /Choose a rule/ }).press('ArrowRight');
	await expect(stage(page)).toContainText('rule 5: repeats');
});

test('traffic: free flow below half full, jams above', async ({ page }) => {
	await open(page, './cellular-automata/#traffic', '100% of cars moving');
	await page.locator('input[type=range][data-control=density]').fill('0.75');
	await expect(stage(page)).toContainText('90 cars');
	await expect(stage(page)).toContainText('jammed: waves drift backwards');
	await expect(stage(page)).toContainText('33% of cars moving');
	// Just over half full (61 cars on 120 cells) is already jammed, picture and label agreeing.
	await page.locator('input[type=range][data-control=density]').fill('0.51');
	await expect(stage(page)).toContainText('61 cars');
	await expect(stage(page)).toContainText('jammed: waves drift backwards');
});
