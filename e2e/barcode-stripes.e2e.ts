import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('scan: once the red line has crossed, the scanner reads the number', async ({ page }) => {
	await open(page, './barcode-stripes/#scan', 'reads 0 36000 29145 2');
	await page.locator('input[type=range][data-control=scan]').fill('0.5');
	await expect(stage(page)).not.toContainText('reads 0 36000 29145 2');
});

test('marks: each group is one digit of two bars and two gaps', async ({ page }) => {
	await open(page, './barcode-stripes/#marks', 'group 2 is the digit 3: widths 1 · 4 · 1 · 1');
	await page.locator('input[type=range][data-control=group]').fill('1');
	await expect(stage(page)).toContainText('group 1 is the digit 0: widths 3 · 2 · 1 · 1');
});

test('speed: a faster sweep shortens the recording, the digits stay the same', async ({ page }) => {
	await open(page, './barcode-stripes/#speed', 'reads 0 36000 29145 2');
	await page.locator('input[type=range][data-control=speed]').fill('2');
	await expect(stage(page)).toContainText('50% as long');
	await expect(stage(page)).toContainText('reads 0 36000 29145 2');
});

test('upside down: read backwards, flipped round, same number', async ({ page }) => {
	await open(page, './barcode-stripes/#upside', 'reads 0 36000 29145 2');
	await page.locator('input[type=checkbox][data-control=flip]').check();
	await expect(stage(page)).toContainText('read backwards');
	await expect(stage(page)).toContainText('reads 0 36000 29145 2');
});

test('check: a misprinted bar reads as another digit and the check digit catches it', async ({
	page
}) => {
	await open(page, './barcode-stripes/#check', 'reads 0 36000 29145 2');
	await page.locator('input[type=checkbox][data-control=misprint]').check();
	await expect(stage(page)).toContainText('reads 0 36100 29145 2: the check digit doesn’t match');
});

test('price: the price changes, the barcode does not', async ({ page }) => {
	await open(page, './barcode-stripes/#price', '$2.49');
	await page.locator('input[type=checkbox][data-control=sale]').check();
	await expect(stage(page)).toContainText('$1.99');
	await expect(stage(page)).toContainText('reads 0 36000 29145 2');
});
