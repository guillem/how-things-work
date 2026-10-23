import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('sun: dragged from dawn to the afternoon, the land warms far more than the sea', async ({
	page
}) => {
	await open(page, './sea-breeze/#sun', '6 am: the land cooler than the sea');
	await expect(stage(page)).toContainText('17 °C');
	await expect(stage(page)).toContainText('22 °C');
	const sun = page.getByRole('slider', { name: 'The Sun' });
	await sun.focus();
	// Shift moves the Sun two hours at a time: 6 am to 2 pm, then four quarter-hours to 3 pm.
	for (let i = 0; i < 4; i++) await sun.press('Shift+ArrowRight');
	for (let i = 0; i < 4; i++) await sun.press('ArrowRight');
	await expect(stage(page)).toContainText('3 pm: the land warmer than the sea');
	await expect(stage(page)).toContainText('31 °C');
	await expect(stage(page)).toContainText('22 °C');
	// The keys moved the Sun, not the step; the slider followed.
	await expect(page).toHaveURL(/#sun$/);
	await expect(page.locator('input[type=range][data-control=morning]')).toHaveValue('15');
});

test('rise: at 3 pm the land’s air is pushed up, and a cubic metre of it is 35 g lighter', async ({
	page
}) => {
	await open(page, './sea-breeze/#rise', '3 pm: the air over the land is pushed up');
	await expect(stage(page)).toContainText('a cubic metre: 35 g lighter');
	await page.locator('input[type=range][data-control=hour]').fill('3');
	await expect(stage(page)).toContainText('3 am: the air over the sea is pushed up');
	await expect(stage(page)).toContainText('a cubic metre: 20 g heavier');
});

test('breeze: a sea breeze in the afternoon, none before the land has warmed past the sea', async ({
	page
}) => {
	await open(page, './sea-breeze/#breeze', '3 pm: a sea breeze, 23 km/h');
	const hour = page.locator('input[type=range][data-control=hour]');
	await hour.fill('11');
	await expect(stage(page)).toContainText('11 am: a sea breeze');
	await hour.fill('9');
	await expect(stage(page)).toContainText('9 am: no breeze');
	await hour.fill('7');
	await expect(stage(page)).toContainText('7 am: a land breeze');
});

test('night: at 3 am the land is cooler than the sea and the breeze blows out to sea', async ({
	page
}) => {
	await open(page, './sea-breeze/#night', '3 am: a land breeze, 11 km/h');
	await expect(stage(page)).toContainText('18 °C');
	await expect(stage(page)).toContainText('22 °C');
	await expect(page.getByRole('slider', { name: 'The Moon' })).toBeVisible();
});

test('whole day: the marker reads the two temperatures and the breeze at any time', async ({
	page
}) => {
	await open(page, './sea-breeze/#whole-day', '3 pm: land 31 °C, sea 22 °C');
	await expect(stage(page)).toContainText('sea breeze, 23 km/h');
	const marker = page.getByRole('slider', { name: 'Time of day' });
	await marker.focus();
	await marker.press('Home');
	await expect(stage(page)).toContainText('midnight: land 19 °C, sea 22 °C');
	await expect(stage(page)).toContainText('land breeze, 8 km/h');
	await expect(page.locator('input[type=range][data-control=hour]')).toHaveValue('0');
});
