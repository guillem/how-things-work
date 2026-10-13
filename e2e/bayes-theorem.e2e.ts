import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the positives step counts 9 ill among 98 positives', async ({ page }) => {
	await page.goto('./bayes-theorem/#positives');
	await expect(stage(page)).toContainText('9 of 98');
	await expect(stage(page)).toContainText('≈ 9%');
});

test('a common disease makes most positives real', async ({ page }) => {
	await page.goto('./bayes-theorem/#sliders');
	await expect(stage(page)).toContainText('9 of 98');
	await page.locator('input[type=range][data-control=prevalence]').fill('0.3');
	await expect(stage(page)).toContainText('270 of 333');
	const share = await stage(page)
		.locator('text', { hasText: /^≈ \d+%$/ })
		.textContent();
	expect(Number(share?.match(/\d+/)?.[0])).toBeGreaterThan(80);
});

test('a prevalence of 1.5% reads 1.5%, matching the 15 ill people in the grid', async ({
	page
}) => {
	await page.goto('./bayes-theorem/#sliders');
	await page.locator('input[type=range][data-control=prevalence]').fill('0.015');
	await expect(page.locator('body')).toContainText('1.5% (15 in 1,000)');
	await expect(stage(page)).toContainText('1.5% ill');
});
