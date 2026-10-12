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
	await expect(stage(page)).toContainText('edge of normal (under 100)');
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

test('settings suggested on one step do not carry into the next', async ({ page }) => {
	await open(page, './homeostasis/#type1');
	await page.locator('input[type=range][data-control=production]').fill('0');
	await expect(stage(page)).toContainText('diabetes (126 or more)');
	// Type 2 has its own production slider: the pancreas still works there.
	await page.goto('./homeostasis/#type2');
	await expect(stage(page)).toContainText('edge of normal (under 100)');
	// The run step suggests skipping the meal; the dosing step still serves 75 g.
	await page.goto('./homeostasis/#run');
	await page.locator('input[type=range][data-control=carbs]').fill('0');
	// With no meal the time axis is not counted from one.
	await expect(stage(page)).not.toContainText('time after the meal');
	await page.goto('./homeostasis/#dosing');
	await expect(stage(page)).toContainText('meal: 75 g');
});
