import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

// With reduced motion the meadow is shown after a minute of simulated time.
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

test('meadow: with no hurrying the fireflies stay out of step', async ({ page }) => {
	await open(page, './fireflies-in-sync/#meadow', 'no hurrying: each keeps its own time');
	await expect(stage(page)).not.toContainText('100%');
});

test('together: after a minute the whole field flashes as one', async ({ page }) => {
	await open(page, './fireflies-in-sync/#together', 'each flash seen: 6% of a turn');
	await expect(stage(page)).toContainText('100%');
});

test('nudge: the hurrying control decides whether they fall into step', async ({ page }) => {
	await open(page, './fireflies-in-sync/#nudge', 'each flash seen: 3% of a turn');
	await expect(stage(page)).not.toContainText('100%');
	await page.locator('input[type=range][data-control=nudge]').fill('0.06');
	await expect(stage(page)).toContainText('each flash seen: 6% of a turn');
	await expect(stage(page)).toContainText('100%');
});

test('scramble: a scrambled patch is out of step', async ({ page }) => {
	await open(page, './fireflies-in-sync/#scramble', '100%');
	await page.getByRole('button', { name: 'Scramble a patch' }).click();
	await expect(stage(page)).not.toContainText('100%');
});
