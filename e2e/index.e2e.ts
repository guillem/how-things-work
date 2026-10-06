import { expect, test } from '@playwright/test';

test('index lists the published explainers', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
	const card = page.getByRole('link', { name: /how photosynthesis works/i });
	await expect(card).toBeVisible();
	await card.click();
	await expect(page).toHaveURL(/\/photosynthesis\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/photosynthesis/i);
});

test('theme toggle switches and persists the theme', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	const html = page.locator('html');
	await expect(html).toHaveAttribute('data-theme', 'light');
	await page.getByRole('button', { name: /toggle dark mode/i }).click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await page.reload();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
});

test('follows the operating system preference by default', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
