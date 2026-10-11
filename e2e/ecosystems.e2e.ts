import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

// The web scene runs about one simulated year per second; the deer take ~45 years to push
// the elk out. The tests play at 2× on Playwright's fake clock, which drives the animation
// frames, so simulated time doesn't depend on how busy the machine is.

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.clock.install();
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
	await page
		.getByRole('radiogroup', { name: 'Playback speed' })
		.getByRole('radio', { name: '2×' })
		.click();
}

test('without wolves the elk multiply', async ({ page }) => {
	await open(page, './ecosystems/#web');
	await expect(stage(page)).toContainText('In balance');
	await page.getByRole('switch', { name: 'Wolves' }).uncheck({ force: true });
	await expect(stage(page)).toContainText('Following the ripples');
	await playUntil(page, stage(page), /Without wolves: .*elk \+\d+%/, 20_000);
	await expect(stage(page)).toContainText(/beavers −\d+%/);
});

test('deer arriving push the elk out', async ({ page }) => {
	await open(page, './ecosystems/#newcomer');
	await expect(stage(page)).toContainText('not here yet');
	await page.getByRole('switch', { name: 'Deer (newcomers)' }).check({ force: true });
	await playUntil(page, stage(page), /With deer: .*elk gone/, 60_000);
});
