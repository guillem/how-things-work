import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const bit = (page: Page, worth: string) =>
	page.getByRole('switch', { name: `Bit worth ${worth}`, exact: true });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(page.getByRole('switch').first()).toBeAttached();
}

test('a bit toggled with the keyboard changes the number', async ({ page }) => {
	await open(page, './binary/#place');
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
	await open(page, './binary/#place');
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
	await open(page, './binary/#signed');
	await expect(stage(page)).toContainText('= −56');
	await expect(stage(page)).toContainText('= 200');
	await expect(bit(page, '−128')).toHaveAttribute('aria-checked', 'true');
});

test('a 32-bit word reads as four characters', async ({ page }) => {
	await open(page, './binary/#text');
	await page.locator('button[data-control=width][data-value="32"]').click();
	await expect(page.getByRole('switch')).toHaveCount(32);
	for (const n of [1, 2, 3, 4]) await expect(stage(page)).toContainText(`byte ${n}`);
	// Each word size starts from its own pattern: "Bits" at 32 bits.
	await expect(stage(page)).toContainText('code 66');
	await expect(stage(page)).toContainText('code 115');
});

test('the 0.1 preset shows that 0.1 is not stored exactly', async ({ page }) => {
	await open(page, './binary/#float');
	await expect(stage(page)).toContainText('= 0.15625');
	await page.getByRole('button', { name: 'Set the bits to 0.1', exact: true }).click();
	await expect(stage(page)).toContainText('0.100000001490116119384765625');
	await page.locator('button[data-control=fwidth][data-value="16"]').click();
	await expect(page.getByRole('switch')).toHaveCount(16);
	await expect(stage(page)).toContainText('0.0999755859375');
});

const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function openAdder(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page)).toContainText('carries');
}

test('200 + 100 overflows a byte and leaves 44', async ({ page }) => {
	await openAdder(page, './binary/#overflow');
	await expect(stage(page)).toContainText('200 + 100 = 300');
	await expect(stage(page)).toContainText("300 doesn't fit in 8 bits → 300 − 256 = 44");
});

test('read as signed, 100 + 100 overflows to −56', async ({ page }) => {
	await openAdder(page, './binary/#overflow');
	await slider(page, 'oa').fill('100');
	await page.locator('button[data-control=view][data-value=signed]').click();
	await expect(stage(page)).toContainText('100 + 100 = 200');
	await expect(stage(page)).toContainText('→ −56');
	await expect(stage(page)).toContainText('signed overflow: two positives gave a negative');
});

test('−1 + 1 loses a carry but the signed answer is right', async ({ page }) => {
	await openAdder(page, './binary/#overflow');
	await slider(page, 'oa').fill('255');
	await slider(page, 'ob').fill('1');
	await page.locator('button[data-control=view][data-value=signed]').click();
	await expect(stage(page)).toContainText('−1 + 1 = 0');
	await expect(stage(page)).toContainText('carry lost, but the signed answer is right');
});
