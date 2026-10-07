import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('"Run again" restarts the crowd with different luck', async ({ page }) => {
	await open(page, '/epidemics/#outbreak');
	await page.getByRole('button', { name: /pause animation/i }).click();
	const firstPerson = stage(page).locator('g[clip-path] circle').first();
	const before = await firstPerson.getAttribute('cx');
	await page.getByRole('button', { name: 'Run again' }).click();
	await expect(firstPerson).not.toHaveAttribute('cx', before!);
});

test('with R₀ below 1 the outbreak dies out', async ({ page }) => {
	await open(page, '/epidemics/#curves');
	await page.locator('input[type=range][data-control=r0]').fill('0.5');
	await expect(stage(page)).toContainText(/Died out on day \d+/, { timeout: 15_000 });
});

test('controls only affect the steps that show them', async ({ page }) => {
	await open(page, '/epidemics/#vaccination');
	await page.locator('input[type=range][data-control=vaccinated]').fill('80');
	await expect(stage(page)).toContainText('Vaccinated');
	// The last step offers the vaccination slider too, and keeps its value.
	await page.keyboard.press('End');
	await expect(page).toHaveURL(/#realworld$/);
	await expect(stage(page)).toContainText('Vaccinated');
	// "Rise, peak and fall" has no vaccination slider: nobody there is vaccinated.
	await page.getByRole('navigation', { name: 'Steps' }).locator('summary').click();
	await page.getByRole('button', { name: /Rise, peak and fall/ }).click();
	await expect(page).toHaveURL(/#curves$/);
	await expect(stage(page)).toContainText('People in each state');
	await expect(stage(page)).not.toContainText('Vaccinated');
});
