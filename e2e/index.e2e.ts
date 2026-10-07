import { expect, test } from '@playwright/test';

test('index lists the built explainers under their catalogue category', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
	const biology = page.getByRole('region', { name: 'Biology' });
	await expect(biology.getByRole('link', { name: /how photosynthesis works/i })).toBeVisible();
	// Categories without a built topic are not shown.
	await expect(page.getByRole('heading', { level: 2, name: 'Reserve' })).toHaveCount(0);
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

test('the 404 page is built and links back home', async ({ page }) => {
	await page.goto('/404.html');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/nothing here/i);
	await page.getByRole('link', { name: /back to all explainers/i }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
});

test('an explainer links to its catalogue neighbours, linking only built topics', async ({
	page
}) => {
	await page.goto('/photosynthesis/');
	await expect(page.locator('header.title .eyebrow')).toContainText('Biology');
	const links = page.getByRole('navigation', { name: 'Related topics' });
	await expect(links.getByRole('heading', { name: 'Read first' })).toBeVisible();
	// the-cell is a prerequisite that is not built yet: named, not linked.
	await expect(links.getByText('The cell')).toBeVisible();
	await expect(links.getByRole('link', { name: 'The cell' })).toHaveCount(0);
});
