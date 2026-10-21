import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('rise: dragged up 500 m with the keyboard, the bubble is 5 degrees colder and has swollen', async ({
	page
}) => {
	await open(page, './cloud-base/#rise', 'a bubble of warm air on the ground');
	await expect(stage(page)).toContainText('25 °C');
	const bubble = page.getByRole('slider', { name: 'Bubble of air' });
	await bubble.focus();
	for (let i = 0; i < 10; i++) await bubble.press('ArrowUp');
	await expect(stage(page)).toContainText('500 m up');
	await expect(stage(page)).toContainText('20 °C');
	await expect(stage(page)).toContainText('clear: its water is invisible vapour');
	await expect(stage(page)).toContainText('swollen: 4 % bigger than on the ground');
	// The keys moved the bubble, not the step; the slider followed.
	await expect(page).toHaveURL(/#rise$/);
	await expect(page.locator('input[type=range][data-control=height]')).toHaveValue('500');
});

test('cloud: the bubble turns white just above 1,200 m, at 13 °C', async ({ page }) => {
	await open(page, './cloud-base/#cloud', 'on the ground');
	const height = page.locator('input[type=range][data-control=height]');
	await height.fill('1200');
	await expect(stage(page)).toContainText('13 °C');
	await expect(stage(page)).toContainText('clear: its water is invisible vapour');
	await expect(stage(page)).toContainText('inside: water vapour, too small to see');
	await height.fill('1300');
	await expect(stage(page)).toContainText('white: its water has turned to droplets');
	await expect(stage(page)).toContainText('turned white here: 1,200 m');
	await expect(stage(page)).toContainText('inside: tiny droplets of water');
});

test('flat: every bubble turns white at the same height', async ({ page }) => {
	await open(page, './cloud-base/#flat', 'every bubble turns white about 1,200 m up');
	await expect(stage(page)).toContainText('cloud base');
});

test('humid: damper air lowers the cloud base; dry air leaves the sky clear', async ({ page }) => {
	await open(page, './cloud-base/#humid', '55 % damp: clouds start about 1,200 m up');
	const humid = page.locator('input[type=range][data-control=humid]');
	await humid.fill('70');
	await expect(stage(page)).toContainText('70 % damp: clouds start about 750 m up');
	await humid.fill('90');
	await expect(stage(page)).toContainText('90 % damp: clouds start about 200 m up');
	await humid.fill('40');
	await expect(stage(page)).toContainText('40 % damp: clouds start about 1,850 m up');
	await humid.fill('30');
	await expect(stage(page)).toContainText('too dry: no clouds today');
	await expect(stage(page)).toContainText('bubbles stop here');
});

test('mountain: blown up the slope the bubble rains; on the far plain it is warmer and drier', async ({
	page
}) => {
	await open(page, './cloud-base/#mountain', 'on the plain, with the wind behind it');
	await expect(stage(page)).toContainText('it still has all its water');
	await page.locator('input[type=range][data-control=along]').fill('45');
	await expect(stage(page)).toContainText('inside the cloud: its water falls as rain');
	const bubble = page.getByRole('slider', { name: 'Bubble of air' });
	await bubble.focus();
	await bubble.press('End');
	await expect(stage(page)).toContainText('on the far plain: warmer and drier');
	await expect(stage(page)).toContainText('26 °C · humidity 36 %');
	await expect(stage(page)).toContainText('it has lost 24 % of its water as rain');
});

test('far side: the bubble set off at 20 °C and 70 %, and arrives at 26 °C and 36 %', async ({
	page
}) => {
	await open(page, './cloud-base/#far-side', 'on the far plain: warmer and drier');
	await expect(stage(page)).toContainText('20 °C · humidity 70 %');
	await expect(stage(page)).toContainText('26 °C · humidity 36 %');
});
