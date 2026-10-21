import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test(
	'sunset: moving the Sun to the horizon makes its light cross 38 times the air',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './blue-sky-red-sunset/#sunset', '12:00 · the Sun is 50° up');
		await expect(stage(page)).toContainText('1.3 times as much air');
		await page.locator('input[type=range][data-control=time]').press('End');
		await expect(stage(page)).toContainText('18:00 · the Sun is 0° up');
		await expect(stage(page)).toContainText('38 times as much air');
		await expect(stage(page)).toContainText('blue almost none · red 25 in 100');
	}
);

test('bounce: blue light bounces off air about six times as often as red', async ({ page }) => {
	await open(page, './blue-sky-red-sunset/#bounce', 'blue light: 20 in 100 bits bounce off');
	await expect(stage(page)).toContainText('6.1 times as often as red light');
	await page.locator('input[type=range][data-control=nm]').fill('700');
	await expect(stage(page)).toContainText('red light: 4 in 100 bits bounce off');
	await page.locator('input[type=range][data-control=nm]').fill('400');
	await expect(stage(page)).toContainText('violet light: 30 in 100 bits bounce off');
});

test('air: with no air the sky is black and the Sun white', async ({ page }) => {
	await open(page, './blue-sky-red-sunset/#air', 'the Earth’s air');
	const black = stage(page).locator('circle[fill="rgb(0, 0, 0)"]');
	await expect(black).toHaveCount(0);
	await page.locator('input[type=range][data-control=air]').fill('0');
	await expect(stage(page)).toContainText('no air at all, as on the Moon');
	await expect(stage(page)).toContainText('all of the Sun’s light gets through');
	// Both swatches of the sky overhead (now and at noon) are black; the Sun's is white.
	await expect(black).toHaveCount(2);
	await expect(stage(page).locator('circle[fill="rgb(255, 255, 255)"]').first()).toBeVisible();
});

test('smoke: heavy smoke lets almost none of the low Sun’s light through', async ({ page }) => {
	await open(page, './blue-sky-red-sunset/#smoke', 'clean air');
	await expect(stage(page)).toContainText('of the low Sun’s light, 24 in 100 get through');
	await page.locator('input[type=range][data-control=smoke]').fill('1');
	await expect(stage(page)).toContainText('heavy smoke');
	await expect(stage(page)).toContainText('almost none gets through');
});

test('violet: weighing by the eye shrinks the violet', async ({ page }) => {
	await open(page, './blue-sky-red-sunset/#violet', 'more violet than blue comes down');
	await page.locator('input[type=checkbox][data-control=eye]').check();
	await expect(stage(page)).toContainText('the eye hardly notices violet');
});
