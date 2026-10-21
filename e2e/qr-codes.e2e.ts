import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const MESSAGE = 'Hello from a QR code';

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('the phone reads back the message the reader types', async ({ page }) => {
	await open(page, './qr-codes/#square', MESSAGE);
	await page.locator('input[data-input=msg]').fill('Meet at 4');
	await expect(stage(page)).toContainText('Reads:Meet at 4');
	await expect(stage(page)).not.toContainText(MESSAGE);
});

test('turning the phone: the corner squares are found and the message still reads', async ({
	page
}) => {
	await open(page, './qr-codes/#corners', MESSAGE);
	await page.locator('input[type=range][data-control=turn]').fill('137');
	await expect(stage(page)).toContainText('phone turned 137°');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
});

test('changing one letter changes every spare piece', async ({ page }) => {
	await open(page, './qr-codes/#spare', '16 spare pieces, worked out from the 28 message pieces');
	await page.locator('input[type=checkbox][data-control=swap]').check();
	await expect(stage(page)).toContainText('“H” → “h”: 16 of 16 spare pieces changed');
});

test('painting: a little paint is repaired, a corner square painted over is fatal, wiping restores it', async ({
	page
}) => {
	await open(page, './qr-codes/#paint', '0 cells painted over');
	const box = (await page.locator('.qr-canvas').boundingBox())!;
	// 25 cells plus a 4-cell margin each side across the paper: one cell is box.width / 33.
	const at = (row: number, col: number) => ({
		x: box.x + ((col + 4.5) / 33) * box.width,
		y: box.y + ((row + 4.5) / 33) * box.height
	});
	// A short stroke along the bottom-right message cells.
	let p = at(22, 14);
	await page.mouse.move(p.x, p.y);
	await page.mouse.down();
	p = at(22, 16);
	await page.mouse.move(p.x, p.y, { steps: 4 });
	await page.mouse.up();
	await expect(stage(page)).not.toContainText('0 cells painted over');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
	// A blob over the middle of the top-left corner square.
	p = at(2, 1);
	await page.mouse.move(p.x, p.y);
	await page.mouse.down();
	for (const [r, c] of [
		[2, 5],
		[4, 5],
		[4, 1],
		[3, 3]
	]) {
		p = at(r, c);
		await page.mouse.move(p.x, p.y, { steps: 4 });
	}
	await page.mouse.up();
	await expect(stage(page)).toContainText('Can’t read it');
	await expect(stage(page)).toContainText('it can’t find three corner squares');
	await page.locator('button[data-control=wipe]').click();
	await expect(stage(page)).toContainText('0 cells painted over');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
});

test('the brush works from the keyboard', async ({ page }) => {
	await open(page, './qr-codes/#paint', '0 cells painted over');
	await page.locator('.qr-canvas').focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).not.toContainText('0 cells painted over');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
});

test('the same number of cells: one blot reads, scattered specks do not', async ({ page }) => {
	await open(page, './qr-codes/#specks', '9 cells painted over');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
	await page.locator('button[data-control=spread][data-value=specks]').click();
	await expect(stage(page)).toContainText('9 spoiled pieces · it can repair 8');
	await expect(stage(page)).toContainText('too many pieces are spoiled to repair');
});

test('covering a corner square spoils no piece but stops the reading', async ({ page }) => {
	await open(page, './qr-codes/#corner', `Reads:${MESSAGE}`);
	await page.locator('input[type=checkbox][data-control=cover]').check();
	await expect(stage(page)).toContainText('0 spoiled pieces');
	await expect(stage(page)).toContainText('it can’t find three corner squares');
});

test('a higher level makes a bigger square', async ({ page }) => {
	await open(page, './qr-codes/#levels', '25 × 25 cells, 16 spare pieces');
	await page.locator('button[data-control=level][data-value=H]').click();
	await expect(stage(page)).toContainText('29 × 29 cells, 44 spare pieces');
	await expect(stage(page)).toContainText(`Reads:${MESSAGE}`);
});
