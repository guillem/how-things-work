import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('lap: after 365 days Earth has not quite finished its lap', async ({ page }) => {
	await open(page, './leap-years/#lap', 'Day 365: the calendar’s year is over');
	await expect(stage(page)).toContainText('almost 6 hours to go');
	await page.locator('input[type=range][data-control=days]').fill('366');
	await expect(stage(page)).toContainText('Earth has finished its lap');
});

test('short: four New Years add up to almost a whole day', async ({ page }) => {
	await open(page, './leap-years/#short', 'After 4 New Years: almost a whole day short');
	await page.locator('input[type=range][data-control=years4]').fill('2');
	await expect(stage(page)).toContainText('After 2 New Years: half a day short');
});

test('slide: with no leap days the longest day slides into July, then December', async ({
	page
}) => {
	await open(page, './leap-years/#slide', 'longest day: July 15');
	await page.locator('input[type=range][data-control=centuries]').fill('750');
	await expect(stage(page)).toContainText('longest day: December 19');
	await expect(stage(page)).toContainText('in the calendar’s winter');
});

test('leap: one extra day every four years almost stops the slide', async ({ page }) => {
	await open(page, './leap-years/#leap', 'longest day: January 1');
	await page.locator('input[type=checkbox][data-control=julian]').check();
	await expect(stage(page)).toContainText('longest day: June 15');
});

test('thousand and skip: a week off in 1,000 years; skipping hundreds years fixes it', async ({
	page
}) => {
	await open(page, './leap-years/#thousand', 'After 1,000 years: June 13');
	await page.goto('./leap-years/#skip');
	await expect(stage(page)).toContainText('After 2,000 years: June 5');
	await page.locator('input[type=checkbox][data-control=gregorian]').check();
	await expect(stage(page)).toContainText('After 2,000 years: June 20');
});

test('which: 1900 was not a leap year, 2000 was', async ({ page }) => {
	await open(page, './leap-years/#which', '2024: a leap year');
	await expect(stage(page)).toContainText('February 2024: 29 days');
	await page.locator('input[type=range][data-control=year]').fill('1900');
	await expect(stage(page)).toContainText('1900: not a leap year');
	await expect(stage(page)).toContainText('February 1900: 28 days');
	await page.locator('input[type=range][data-control=year]').fill('2000');
	await expect(stage(page)).toContainText('2000: a leap year');
});
