import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const scrubber = (page: Page) => page.getByRole('slider', { name: 'Replay position' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(scrubber(page)).toBeAttached();
}

test('the replay plays by itself and finishes sorted', async ({ page }) => {
	await open(page, '/sorting/#bubble');
	await page.locator('input[type=range][data-control=size]').fill('6');
	await page.locator('input[type=range][data-control=pace]').fill('60');
	await expect(stage(page)).toContainText('Sorted!', { timeout: 10_000 });
});

test('the scrubber pauses the replay and steps one operation at a time', async ({ page }) => {
	await open(page, '/sorting/#insertion');
	await scrubber(page).focus();
	await page.keyboard.press('Home');
	await expect(page.locator('input[type=checkbox][data-control=play]')).not.toBeChecked();
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '0');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', '2');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Sorted!');
	// Still on the same step: the keys belong to the scrubber.
	await expect(page).toHaveURL(/#insertion$/);
});

test('turning "Run by itself" off freezes the replay where it is', async ({ page }) => {
	await open(page, '/sorting/#merge');
	await page.waitForTimeout(1500);
	await page.locator('input[type=checkbox][data-control=play]').uncheck({ force: true });
	const at = Number(await scrubber(page).getAttribute('aria-valuenow'));
	expect(at).toBeGreaterThan(0);
	await page.waitForTimeout(800);
	await expect(scrubber(page)).toHaveAttribute('aria-valuenow', String(at));
});
