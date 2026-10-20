import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('square: pushed, it leans over', async ({ page }) => {
	await open(page, './why-triangles-are-stiff/#square', 'wobbly: it can lean one way');
	await page.getByRole('button', { name: 'Push the top corner' }).click();
	await expect(stage(page)).toContainText('pushed: it leaned over');
});

test('triangle: pushed, it does not move', async ({ page }) => {
	await open(page, './why-triangles-are-stiff/#triangle', 'stiff: it cannot wobble');
	await page.getByRole('button', { name: 'Push the top corner' }).click();
	await expect(stage(page)).toContainText('pushed: it did not move');
});

test('diagonal: one diagonal stiffens the square', async ({ page }) => {
	await open(page, './why-triangles-are-stiff/#diagonal', 'wobbly');
	await page.locator('input[type=checkbox][data-control=diagonal]').check();
	await expect(stage(page)).toContainText('stiff: it cannot wobble');
});

test('tower: each box clicked takes away one way to wobble', async ({ page }) => {
	await open(page, './why-triangles-are-stiff/#tower', 'it can lean 4 ways');
	for (let k = 1; k <= 4; k++)
		await page.getByRole('button', { name: `Box ${k}: add a diagonal` }).click();
	await expect(stage(page)).toContainText('stiff: it cannot wobble');
	await expect(stage(page)).toContainText('16 sticks');
	await page.getByRole('button', { name: 'Box 2: take out its diagonal' }).press('Enter');
	await expect(stage(page)).toContainText('wobbly: it can lean one way');
});

test('gate: a brace stops the sag', async ({ page }) => {
	await open(page, './why-triangles-are-stiff/#gate', 'wobbly');
	await page.locator('input[type=checkbox][data-control=brace]').check();
	await expect(stage(page)).toContainText('stiff: it cannot wobble');
});
