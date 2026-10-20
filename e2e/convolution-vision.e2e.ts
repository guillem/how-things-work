import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const pick = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();

/** Reduced motion: the scenes show their complete, still frame. */
async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toContainText(text);
}

/** Draws a stroke on the pad through the given points (0–1 across the pad). */
async function stroke(page: Page, pts: [number, number][]) {
	const box = (await page.locator('[data-pad]').boundingBox())!;
	const at = ([x, y]: [number, number]) => [box.x + x * box.width, box.y + y * box.height] as const;
	await page.mouse.move(...at(pts[0]));
	await page.mouse.down();
	for (const p of pts.slice(1))
		for (let k = 1; k <= 8; k++) {
			const [x0, y0] = at(pts[pts.indexOf(p) - 1]);
			const [x1, y1] = at(p);
			await page.mouse.move(x0 + ((x1 - x0) * k) / 8, y0 + ((y1 - y0) * k) / 8);
		}
	await page.mouse.up();
}

test('the network reads real MNIST test digits', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './convolution-vision/#predict', 'MNIST test digit #1: a 2 · right');
	await expect(stage(page)).toContainText('It reads 2, with probability > 99%');
	await pick(page, 'digit', '0'); // the first 7 of the test set
	await expect(stage(page)).toContainText('MNIST test digit #0: a 7 · right');
	await expect(stage(page)).toContainText('It reads 7');
});

test('a digit drawn on the pad is read, and Clear empties the pad', async ({ page }) => {
	await open(page, './convolution-vision/#predict', 'It reads 2');
	await stroke(page, [
		[0.25, 0.2],
		[0.75, 0.2],
		[0.45, 0.85]
	]);
	await expect(stage(page)).toContainText('your drawing, centred and scaled like MNIST');
	await expect(stage(page)).toContainText('It reads');
	await expect(page.locator('button[data-control=digit][data-value=drawn]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await page.locator('button[data-control=clear]').click();
	await expect(stage(page)).toContainText('Draw a digit in the box');
});

test('the test digits it gets wrong, and a drawing that is not a digit', async ({ page }) => {
	await open(page, './convolution-vision/#mistakes', 'MNIST test digit #259: a 6 · wrong');
	await expect(stage(page)).toContainText('It reads 0');
	// a cross is not a digit, but the softmax still picks one
	await stroke(page, [
		[0.2, 0.2],
		[0.8, 0.8]
	]);
	await stroke(page, [
		[0.8, 0.2],
		[0.2, 0.8]
	]);
	await expect(stage(page)).toContainText(/It reads \d, with probability/);
	await page.locator('input[type=checkbox][data-control=centre]').uncheck();
	await expect(stage(page)).toContainText('your drawing, not centred or scaled');
});

test('switching the centring off on “Where it goes wrong” leaves the other steps centred', async ({
	page
}) => {
	await open(page, './convolution-vision/#predict', 'It reads 2');
	// a small 1 in the top-left corner: read differently with and without the centring
	await stroke(page, [
		[0.15, 0.08],
		[0.15, 0.3]
	]);
	const reading = async () =>
		(await stage(page).textContent())!.match(/It reads \d, with probability[^%]*%/)![0];
	await expect(stage(page)).toContainText('your drawing, centred and scaled like MNIST');
	const centred = await reading();
	await page.evaluate(() => (location.hash = '#mistakes'));
	await pick(page, 'wrong', 'drawn');
	await page.locator('input[type=checkbox][data-control=centre]').uncheck();
	await expect(stage(page)).toContainText('your drawing, not centred or scaled');
	expect(await reading()).not.toBe(centred);
	await page.evaluate(() => (location.hash = '#predict'));
	await expect(stage(page)).toContainText('your drawing, centred and scaled like MNIST');
	expect(await reading()).toBe(centred);
});

test('the filter can be picked and edited, and its divisor follows', async ({ page }) => {
	await open(page, './convolution-vision/#filters', 'filter: Vertical edges');
	await expect(stage(page)).toContainText('sum not divided');
	await pick(page, 'preset', 'blur');
	await expect(stage(page)).toContainText('sum ÷ 9');
	const centre = page.getByRole('slider', { name: 'Weight, middle centre' });
	await centre.focus();
	await page.keyboard.press('ArrowUp');
	await expect(centre).toHaveAttribute('aria-valuenow', '2');
	await expect(stage(page)).toContainText('filter: Blur (edited)');
	await expect(stage(page)).toContainText('sum ÷ 10');
	await page.locator('button[data-control=reset]').click();
	await expect(stage(page)).toContainText('sum ÷ 9');
	await expect(stage(page)).not.toContainText('(edited)');
});

test('moving the digit moves its feature map by the same amount', async ({ page }) => {
	await open(page, './convolution-vision/#shared', 'move the digit with the slider');
	await page.locator('input[type=range][data-control=shift]').fill('-4');
	await expect(stage(page)).toContainText('both moved 4 px left');
	await expect(stage(page)).toContainText('784 × 784 = 614,656');
});

test('the digit stops where its map would run off the grid', async ({ page }) => {
	// the default 2 has 1 px of paper on its right: its edge map already reaches the last column
	await open(page, './convolution-vision/#shared', 'move the digit with the slider');
	await page.locator('input[type=range][data-control=shift]').fill('6');
	await expect(stage(page)).toContainText('no room: the map already touches the right edge');
	await expect(stage(page)).not.toContainText('6 px right');
});

test('the filter slides over every position, then the map is complete', async ({ page }) => {
	await page.clock.install();
	await page.goto('./convolution-vision/#slide');
	await expect(stage(page)).toContainText('one output pixel');
	await page.clock.runFor(14_000);
	await expect(stage(page)).toContainText('every position, row by row');
});

test('a picked or edited filter makes its map again, row by row', async ({ page }) => {
	await page.clock.install();
	await page.goto('./convolution-vision/#filters');
	const sliding = 'the filter slides over every position';
	const complete = 'map complete: the filter has visited all 784 positions';
	await expect(stage(page)).toContainText(sliding);
	await playUntil(page, stage(page), complete, 6000);
	await pick(page, 'preset', 'blur');
	await expect(stage(page)).toContainText(sliding);
	await playUntil(page, stage(page), complete, 6000);
	// one weight changed: the sweep starts again
	const centre = page.getByRole('slider', { name: 'Weight, middle centre' });
	await centre.focus();
	await page.keyboard.press('ArrowUp');
	await expect(stage(page)).toContainText('filter: Blur (edited)');
	await expect(stage(page)).toContainText(sliding);
	await playUntil(page, stage(page), complete, 6000);
});

test('clicking a second-layer map shows what excites that filter', async ({ page }) => {
	await open(page, './convolution-vision/#layer2', 'excite filter 13 most');
	await page.getByRole('button', { name: 'Show second-layer filter 5' }).click();
	await expect(stage(page)).toContainText('excite filter 5 most');
	await expect(page.locator('input[type=range][data-control=f2]')).toHaveValue('5');
});
