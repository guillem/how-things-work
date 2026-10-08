import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('clicking a link on the map makes it the one that fails', async ({ page }) => {
	await page.goto('/internet/#reroute');
	await expect(page.locator('button[data-control="cut"][data-value="D-G"]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.getByRole('button', { name: 'Cut link A–B' }).click();
	await expect(page.locator('button[data-control="cut"][data-value="A-B"]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Repair link A–B' })).toBeVisible();
	// Keyboard: repair it again.
	await page.getByRole('button', { name: 'Repair link A–B' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.locator('button[data-control="cut"][data-value="none"]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('clicking a router shows its own forwarding table', async ({ page }) => {
	await page.goto('/internet/#routers');
	await expect(stage(page)).toContainText("Router D's own table");
	await page.getByRole('button', { name: "Show router F's table" }).click();
	await expect(stage(page)).toContainText("Router F's own table");
	await expect(page.locator('button[data-control="router"][data-value="F"]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
});

test('a cached name saves the lookup: 380 ms becomes 260 ms', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/internet/#web');
	await expect(stage(page)).toContainText('Page arrives after 380 ms');
	await page.getByText('Resolver already knows the address').click();
	await expect(stage(page)).toContainText('Page arrives after 260 ms');
});
