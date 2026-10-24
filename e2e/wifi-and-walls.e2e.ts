import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Opens a step on its reduced-motion frame and waits for the lazily loaded scene. */
async function open(page: Page, url: string, text: string | RegExp) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

test('radio: with no inside walls the laptop keeps full speed all the way', async ({ page }) => {
	await open(page, './wifi-and-walls/#radio', 'laptop’s speed');
	await expect(stage(page)).toContainText('130 Mbit/s');
	await page.getByRole('slider', { name: 'Laptop' }).press('End');
	await expect(stage(page)).toContainText('130 Mbit/s');
});

test('walls: walking the laptop behind three brick walls slows it to 39, without cutting it off', async ({
	page
}) => {
	await open(page, './wifi-and-walls/#walls', '130 Mbit/s');
	await expect(stage(page)).toContainText('walls and things in the way: none');
	await page.getByRole('slider', { name: 'Laptop' }).press('End');
	await expect(stage(page)).toContainText('39 Mbit/s');
	await expect(stage(page)).toContainText('walls and things in the way: 3');
	// The slider in the panel follows the dragged laptop.
	await expect(page.locator('input[type=range][data-control=spot]')).toHaveValue('100');
});

test('things in the way: a brick wall slows the laptop on the bed, a fridge cuts it off', async ({
	page
}) => {
	await open(page, './wifi-and-walls/#things', '130 Mbit/s');
	await page.getByRole('radio', { name: 'A glass door' }).click();
	await expect(stage(page)).toContainText('117 Mbit/s');
	await page.getByRole('radio', { name: 'A brick wall' }).click();
	await expect(stage(page)).toContainText('52 Mbit/s');
	await page.getByRole('radio', { name: 'A fridge' }).click();
	await expect(stage(page)).toContainText('no link');
});

test('band: 5 GHz is faster in the kitchen, and has no link in the bedroom', async ({ page }) => {
	await open(page, './wifi-and-walls/#band', '130 Mbit/s');
	await page.locator('input[type=checkbox][data-control=fast]').check();
	await expect(stage(page)).toContainText('351 Mbit/s');
	await expect(stage(page)).toContainText('ways of sending, 5 GHz');
	await page.goto('./wifi-and-walls/#reach');
	await expect(stage(page)).toContainText('780 Mbit/s');
	await page.locator('input[type=range][data-control=spot]').fill('70');
	await expect(stage(page)).toContainText('no link');
});

test('neighbour: on the same channel the two take turns; on another, the air is ours', async ({
	page
}) => {
	await open(page, './wifi-and-walls/#neighbour', 'the air is all ours');
	await page.getByRole('radio', { name: 'On the same channel as ours' }).click();
	await expect(stage(page)).toContainText('taking turns: half the time each');
	await expect(stage(page)).toContainText('65 Mbit/s');
	await page.getByRole('radio', { name: 'On a channel that doesn’t overlap' }).click();
	await expect(stage(page)).toContainText('channels apart: no waiting');
	await expect(stage(page)).toContainText('130 Mbit/s');
});

test('internet: a download gets the slower of the Wi-Fi and the line', async ({ page }) => {
	await open(page, './wifi-and-walls/#internet', 'a download gets: 30 Mbit/s');
	await expect(stage(page)).toContainText('the line is the slower part');
	await page.locator('input[type=range][data-control=line]').fill('4');
	await expect(stage(page)).toContainText('a download gets: 130 Mbit/s');
	await expect(stage(page)).toContainText('the Wi-Fi is the slower part');
});
