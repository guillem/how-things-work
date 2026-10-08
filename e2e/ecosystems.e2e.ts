import { expect, test, type Page } from '@playwright/test';

// The web scene runs about one simulated year per second; the deer take ~45 years to push
// the elk out, so these tests play at 2× and wait generously for the summary to settle.

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
	await page
		.getByRole('radiogroup', { name: 'Playback speed' })
		.getByRole('radio', { name: '2×' })
		.click();
}

test('without wolves the elk multiply', async ({ page }) => {
	await open(page, '/ecosystems/#web');
	await expect(stage(page)).toContainText('In balance');
	await page.getByRole('switch', { name: 'Wolves' }).uncheck({ force: true });
	await expect(stage(page)).toContainText('Following the ripples');
	await expect(stage(page)).toContainText(/Without wolves: .*elk \+\d+%/, { timeout: 20_000 });
	await expect(stage(page)).toContainText(/beavers −\d+%/);
});

test('deer arriving push the elk out', async ({ page }) => {
	test.setTimeout(90_000);
	await open(page, '/ecosystems/#newcomer');
	await expect(stage(page)).toContainText('not here yet');
	await page.getByRole('switch', { name: 'Deer (newcomers)' }).check({ force: true });
	await expect(stage(page)).toContainText(/With deer: .*elk gone/, { timeout: 60_000 });
});
