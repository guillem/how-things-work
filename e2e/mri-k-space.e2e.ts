// Browser tests of the MRI k-space page: k-space and the image are drawn; the slice is
// bandwidth / (γG) thick and moves with the pulse's frequency; k-space fills to 128 lines in
// 8.5 minutes; the 180° pulse makes an echo of e^(−TE/T2) and without it the signal is gone; the
// centre of k-space sets the fluid's brightness; skipping lines gives folded copies; a field of
// view under 19 cm wraps the head. Reduced motion gives each step's complete frame.
import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test('k-space and the image computed from it are drawn', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./mri-k-space/#measure');
	await expect(stage(page)).toContainText('k-space: what the coil records');
	for (const id of ['kspace', 'image']) {
		await expect(page.getByTestId(id)).toHaveAttribute('href', /^data:image\/png/);
	}
});

test('the slice is bandwidth / (γ G) thick and moves with the pulse', async ({ page }) => {
	await page.goto('./mri-k-space/#slice');
	await expect(stage(page)).toContainText('slice 2.35 mm thick, at +0.0 mm');
	await key(page, 'gz', 'End'); // 40 mT/m: four times thinner
	await expect(stage(page)).toContainText('slice 0.59 mm thick');
	await key(page, 'offset', 'End'); // +4 kHz / (42.58 MHz/T × 40 mT/m) = 2.35 mm
	await expect(stage(page)).toContainText('at +2.3 mm');
});

test('k-space fills to 128 lines in 8.5 minutes', async ({ page }) => {
	await page.goto('./mri-k-space/#fill');
	await expect(stage(page)).toContainText('40 of 128 lines recorded');
	await key(page, 'lines', 'End');
	await expect(stage(page)).toContainText('128 of 128 lines recorded');
	await expect(stage(page)).toContainText('8 min 32 s');
});

test('the 180° pulse brings the signal back as an echo', async ({ page }) => {
	await page.goto('./mri-k-space/#echo');
	// the reduced-motion frame is the echo, at TE = 50 ms: e^(−50/100)
	await expect(stage(page)).toContainText('t = 50 ms');
	await expect(stage(page)).toContainText('signal 0.61');
	await toggle(page, 'refocus').uncheck({ force: true });
	await expect(stage(page)).toContainText(/signal 0\.0[0-2]/); // e^(−t/T2*) with T2* = 7.4 ms: gone
});

test('the centre of k-space sets the fluid’s brightness', async ({ page }) => {
	await page.goto('./mri-k-space/#contrast');
	await expect(stage(page)).toContainText('in the full T2 scan 0.57 · in the T1 scan 0.11');
	await expect(stage(page)).toContainText('fluid (ventricle): 0.59');
	await choose(page, 'centreFrom', 't1');
	await expect(stage(page)).toContainText('fluid (ventricle): 0.09');
});

test('skipping lines folds the head into copies', async ({ page }) => {
	await page.goto('./mri-k-space/#skip');
	await expect(stage(page)).toContainText('2 copies, 12 cm apart');
	await choose(page, 'every', '4');
	await expect(stage(page)).toContainText('32 of 128 lines');
	await expect(stage(page)).toContainText('4 copies, 6 cm apart');
});

test('a field of view smaller than the head wraps it round', async ({ page }) => {
	await page.goto('./mri-k-space/#fov');
	await expect(stage(page)).toContainText('85 lines');
	await expect(stage(page)).toContainText('sticks out by 3 cm and wraps round');
	// 19 cm: the head fits exactly
	for (let i = 0; i < 3; i++) await key(page, 'fovY', 'ArrowRight');
	await expect(stage(page)).toContainText('the 19 cm head fits');
	await key(page, 'fovY', 'ArrowLeft');
	await expect(stage(page)).toContainText('sticks out by 1 cm');
});

test('one sample of k-space follows its handle', async ({ page }) => {
	await page.goto('./mri-k-space/#point');
	await expect(stage(page)).toContainText('sample: 6 turns left to right, 3 top to bottom');
	await page.getByRole('slider', { name: 'Point in k-space' }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('sample: 7 turns left to right');
	await expect(range(page, 'kx')).toHaveValue('7');
});
