import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('orbit: frozen far beyond Neptune in 1960, a tail only near the Sun in 1986', async ({
	page
}) => {
	await open(page, './comet-tails/#orbit', 'Jan 1960');
	await expect(stage(page)).toContainText('beyond Neptune');
	await expect(stage(page)).toContainText('frozen: no tail, no fuzz');
	await page.locator('input[type=range][data-control=year]').fill('1986.1');
	await expect(stage(page)).toContainText('Feb 1986');
	await expect(stage(page)).toContainText('inside Earth’s path');
	await expect(stage(page)).toContainText('speed: 54 km a second');
	await expect(stage(page)).toContainText('ice turning to gas: it has a tail');
});

test('orbit: dragging the comet by keyboard moves the year slider with it', async ({ page }) => {
	await open(page, './comet-tails/#orbit', 'Jan 1960');
	const comet = page.getByRole('slider', { name: 'Halley’s comet' });
	await comet.focus();
	await comet.press('End');
	await expect(stage(page)).toContainText('Feb 2024');
	await expect(stage(page)).toContainText('beyond Neptune');
	await expect(page.locator('input[type=range][data-control=year]')).toHaveValue('2024.1');
	await expect(page).toHaveURL(/#orbit$/);
});

test('warming: frozen far out, the ice turning to gas fastest at the closest point', async ({
	page
}) => {
	await open(page, './comet-tails/#warming', '35 times as far as Earth');
	await expect(stage(page)).toContainText('sunlight 1,250 times weaker than on Earth');
	await expect(stage(page)).toContainText('frozen solid');
	await page.locator('input[type=range][data-control=reach]').fill('8');
	await expect(stage(page)).toContainText('closest to the Sun');
	await expect(stage(page)).toContainText('ice turning to gas fastest');
	await expect(stage(page)).toContainText('nothing is burning');
});

test('away and tail-first: the tail trails the comet coming in and leads it going out', async ({
	page
}) => {
	await open(page, './comet-tails/#away', '1 Dec 1985');
	await expect(stage(page)).toContainText('heading in towards the Sun');
	await expect(stage(page)).toContainText('tail streaming out behind it');
	await page.locator('input[type=range][data-control=dayIn]').fill('0');
	await expect(stage(page)).toContainText('9 Feb 1986');
	await expect(stage(page)).toContainText('tail sticking out sideways');

	await page.goto('./comet-tails/#tail-first');
	await expect(stage(page)).toContainText('10 Apr 1986');
	await expect(stage(page)).toContainText('tail in front: going tail-first');
	const comet = page.getByRole('slider', { name: 'Halley’s comet' });
	await comet.focus();
	await comet.press('Home');
	await expect(stage(page)).toContainText('heading in towards the Sun');
	await expect(stage(page)).toContainText('tail streaming out behind it');
	await expect(page.locator('input[type=range][data-control=dayOut]')).toHaveValue('-120');
});
