import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

// Reduced motion shows each step's finished picture, so the verdicts are final.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('turning insulin production off gives a diabetic fasting glucose', async ({ page }) => {
	await open(page, './homeostasis/#type1');
	await expect(stage(page)).toContainText('normal (under 100)');
	await page.locator('input[type=range][data-control=production]').fill('0');
	await expect(stage(page)).toContainText('diabetes (126 or more)');
});

test('too much injected insulin causes dangerous hypoglycaemia', async ({ page }) => {
	await open(page, './homeostasis/#dosing');
	// No injection: the meal sends glucose very high.
	await expect(stage(page)).toContainText('very high');
	await page.locator('input[type=range][data-control=dose]').fill('20');
	await expect(stage(page)).toContainText('level 2 hypoglycaemia: dangerous');
});

test('a healthy adult passes the glucose tolerance test', async ({ page }) => {
	await open(page, './homeostasis/#meal');
	await expect(stage(page)).toContainText(/2 hours after: \d+ mg\/dL/);
	await expect(stage(page)).toContainText('normal (under 140)');
});
