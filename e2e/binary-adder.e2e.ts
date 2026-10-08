import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page)).toContainText('carries');
}

test('200 + 100 overflows a byte and leaves 44', async ({ page }) => {
	await open(page, '/binary/#overflow');
	await expect(stage(page)).toContainText('200 + 100 = 300');
	await expect(stage(page)).toContainText("300 doesn't fit in 8 bits → 300 − 256 = 44");
});

test('read as signed, 100 + 100 overflows to −56', async ({ page }) => {
	await open(page, '/binary/#overflow');
	await slider(page, 'oa').fill('100');
	await page.locator('button[data-control=view][data-value=signed]').click();
	await expect(stage(page)).toContainText('100 + 100 = 200');
	await expect(stage(page)).toContainText('→ −56');
	await expect(stage(page)).toContainText('signed overflow: two positives gave a negative');
});

test('−1 + 1 loses a carry but the signed answer is right', async ({ page }) => {
	await open(page, '/binary/#overflow');
	await slider(page, 'oa').fill('255');
	await slider(page, 'ob').fill('1');
	await page.locator('button[data-control=view][data-value=signed]').click();
	await expect(stage(page)).toContainText('−1 + 1 = 0');
	await expect(stage(page)).toContainText('carry lost, but the signed answer is right');
});
