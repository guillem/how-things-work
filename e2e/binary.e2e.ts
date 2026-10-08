import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const bit = (page: Page, worth: string) =>
	page.getByRole('switch', { name: `Bit worth ${worth}`, exact: true });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.getByRole('switch').first()).toBeAttached();
}

test('a bit toggled with the keyboard changes the number', async ({ page }) => {
	await open(page, '/binary/#place');
	await expect(stage(page)).toContainText('64 + 1 = 65');
	await bit(page, '1').focus();
	await page.keyboard.press('Enter');
	await expect(bit(page, '1')).toHaveAttribute('aria-checked', 'false');
	await expect(stage(page)).toContainText('= 64');
	await bit(page, '2').focus();
	await page.keyboard.press(' ');
	await expect(bit(page, '2')).toHaveAttribute('aria-checked', 'true');
	await expect(stage(page)).toContainText('64 + 2 = 66');
	// The keys toggled bits; they did not change the step.
	await expect(page).toHaveURL(/#place$/);
});

test('Add 1 counts up, and 255 + 1 wraps round to 0', async ({ page }) => {
	await open(page, '/binary/#place');
	const plus1 = page.locator('button[data-control=plus1]');
	await plus1.click();
	await expect(stage(page)).toContainText('64 + 2 = 66');
	await plus1.click();
	await expect(stage(page)).toContainText('64 + 2 + 1 = 67');
	for (const v of ['128', '32', '16', '8', '4']) await bit(page, v).click();
	await expect(stage(page)).toContainText('= 255');
	await plus1.click();
	await expect(stage(page)).toContainText('all bits off = 0');
});

test('the signed reading shows −56 next to the unsigned 200', async ({ page }) => {
	await open(page, '/binary/#signed');
	await expect(stage(page)).toContainText('= −56');
	await expect(stage(page)).toContainText('= 200');
	await expect(bit(page, '−128')).toHaveAttribute('aria-checked', 'true');
});

test('a 32-bit word reads as four characters', async ({ page }) => {
	await open(page, '/binary/#text');
	await page.locator('button[data-control=width][data-value="32"]').click();
	await expect(page.getByRole('switch')).toHaveCount(32);
	for (const n of [1, 2, 3, 4]) await expect(stage(page)).toContainText(`byte ${n}`);
	// Each word size starts from its own pattern: "Bits" at 32 bits.
	await expect(stage(page)).toContainText('code 66');
	await expect(stage(page)).toContainText('code 115');
});

test('the 0.1 preset shows that 0.1 is not stored exactly', async ({ page }) => {
	await open(page, '/binary/#float');
	await expect(stage(page)).toContainText('= 0.15625');
	await page.getByRole('button', { name: 'Set the bits to 0.1', exact: true }).click();
	await expect(stage(page)).toContainText('0.100000001490116119384765625');
	await page.locator('button[data-control=fwidth][data-value="16"]').click();
	await expect(page.getByRole('switch')).toHaveCount(16);
	await expect(stage(page)).toContainText('0.0999755859375');
});
