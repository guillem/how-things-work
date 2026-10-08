import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('the product: lengths multiply and angles add', async ({ page }) => {
	await page.goto('/complex-numbers/#multiply');
	await expect(stage(page)).toContainText('1.40 × 1.25 = 1.75');
	await expect(stage(page)).toContainText('20° + 45° = 65°');
	await slider(page, 'zLen').fill('1.5');
	await slider(page, 'zAng').fill('30');
	await slider(page, 'wLen').fill('1.2');
	await slider(page, 'wAng').fill('60');
	await expect(stage(page)).toContainText('1.50 × 1.20 = 1.80');
	await expect(stage(page)).toContainText('30° + 60° = 90°');
	// zw = 1.8 i, straight up
	await expect(stage(page)).toContainText('zw = 1.8i');
	// Past a full turn.
	await slider(page, 'wAng').fill('350');
	await expect(stage(page)).toContainText('30° + 350° = 380°');
	await expect(stage(page)).toContainText('the same direction as 20°');
});

test('multiplying by i turns z a quarter turn; the arrow keys move z', async ({ page }) => {
	await page.goto('/complex-numbers/#times-i');
	await expect(stage(page)).toContainText('= −1 + 2i');
	const z = page.getByRole('slider', { name: 'The point z' });
	await z.focus();
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowLeft');
	// z = 1.9 + 1.1i, so iz = −1.1 + 1.9i; the step did not change.
	await expect(stage(page)).toContainText('= −1.1 + 1.9i');
	await expect(page.locator('aside h2')).toHaveText('Multiplying by i is a quarter turn');
	await expect(slider(page, 'zRe')).toHaveValue('1.9');
});

test("Euler's formula: e^(iθ) at 180° is −1", async ({ page }) => {
	await page.goto('/complex-numbers/#euler');
	await expect(stage(page)).toContainText('0.50 + 0.87i');
	await slider(page, 'theta').fill('180');
	await expect(stage(page)).toContainText('−1.00 + 0.00i');
	await page.goto('/complex-numbers/#compound');
	await slider(page, 'theta').fill('180');
	await slider(page, 'n').fill('10');
	await expect(stage(page)).toContainText('−1.59 + 0.16i');
});
