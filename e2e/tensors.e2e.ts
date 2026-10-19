import { expect, test, type Page } from '@playwright/test';
import { get, macaw, meanOver, num, principal, stress } from '../src/routes/tensors/tensor';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();

test.beforeEach(async ({ page }) => {
	// A frozen, complete frame: no tweens, no cursor walking.
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'growing the block: the count of numbers is the product of the axis lengths',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./tensors/#block');
		await expect(stage(page)).toContainText('2 × 3 × 4 = 24 numbers');
		// The handle at the end of the columns axis: End makes it 5 long.
		await page.getByRole('slider', { name: 'Length of the columns axis' }).focus();
		await page.keyboard.press('End');
		await expect(slider(page, 'n2')).toHaveValue('5');
		await expect(stage(page)).toContainText('2 × 3 × 5 = 30 numbers');
		// Shrink to one axis: a vector of 5, one index to pick a number.
		await slider(page, 'axes').fill('1');
		await expect(stage(page)).toContainText('a vector');
		await expect(stage(page)).toContainText('1 index: column');
		await slider(page, 'axes').fill('0');
		await expect(stage(page)).toContainText('no index needed');
		await expect(page).toHaveURL(/#block$/);
	}
);

test('picking a pixel reads its three numbers from the photo', async ({ page }) => {
	const img = macaw();
	await page.goto('./tensors/#image');
	await slider(page, 'row').fill('10');
	await slider(page, 'col').fill('3');
	await expect(stage(page)).toContainText('img[10, 3] =');
	await expect(stage(page)).toContainText(`red: ${get(img, [10, 3, 0])}`);
	await expect(stage(page)).toContainText(`blue: ${get(img, [10, 3, 2])}`);
	// The marker on the photo moves along the row with the arrow keys.
	await page.getByRole('slider', { name: 'Pixel' }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page, 'col')).toHaveValue('4');
	await expect(stage(page)).toContainText(`green: ${get(img, [10, 4, 1])}`);
	await page.keyboard.press('ArrowUp');
	await expect(slider(page, 'row')).toHaveValue('9');
	await expect(stage(page)).toContainText(`green: ${get(img, [9, 4, 1])}`);
});

test('a slice drops the axis it fixes', async ({ page }) => {
	await page.goto('./tensors/#slice');
	await expect(stage(page)).toContainText('img[:, :, 0]');
	await expect(stage(page)).toContainText('(48, 36)');
	await choose(page, 'sliceAxis', 'width');
	await slider(page, 'sliceAt').fill('12');
	await expect(stage(page)).toContainText('img[:, 12, :]');
	await expect(stage(page)).toContainText('(48, 3)');
	await choose(page, 'sliceAxis', 'height');
	await expect(stage(page)).toContainText('(36, 3)');
	// Only 3 channels: index 12 is out of range, so the slice is the last channel.
	await choose(page, 'sliceAxis', 'channel');
	await expect(slider(page, 'sliceAt')).toHaveAttribute('max', '2');
	await expect(stage(page)).toContainText('img[:, :, 2]');
	await expect(stage(page)).toContainText('the blue layer');
});

test('reshaping keeps the list; transposing moves the numbers', async ({ page }) => {
	await page.goto('./tensors/#reshape');
	await expect(stage(page)).toContainText('(1728, 3)');
	await expect(stage(page)).toContainText('same list, same order');
	await choose(page, 'shape', 'reshape3');
	await expect(stage(page)).toContainText('= numbers 0–1727');
	await expect(stage(page)).toContainText('right shape, wrong picture');
	await choose(page, 'shape', 'transpose');
	await expect(stage(page)).toContainText('= the red channel');
	await expect(stage(page)).toContainText('numbers moved');
});

test('matrix times vector: the shared axis must match', async ({ page }) => {
	await page.goto('./tensors/#matvec');
	// Row 0 of M against v: 1×2 + 2×1 + 0×(−1) + (−1)×3 = 1.
	await expect(stage(page)).toContainText('= 1');
	await expect(stage(page)).toContainText('the shared axis (4) is summed away');
	await choose(page, 'vlen', 'short');
	await expect(stage(page)).toContainText('error: shapes (3, 4) and (3,) not aligned');
});

test('grey from the channel weights: with weights 1, 0, 0 it is the red channel', async ({
	page
}) => {
	const img = macaw();
	await page.goto('./tensors/#grey');
	await slider(page, 'wr').fill('1');
	await slider(page, 'wg').fill('0');
	await slider(page, 'wb').fill('0');
	// The reduced-motion frame probes pixel [24, 7].
	await expect(stage(page)).toContainText('grey[24, 7] =');
	await expect(stage(page)).toContainText(`= ${get(img, [24, 7, 0])}`);
	await expect(stage(page)).toContainText('so white stays white');
});

test('averaging away height and width leaves the photo’s average colour', async ({ page }) => {
	const avg = Array.from(meanOver(macaw(), [0, 1]).data).map((v) => num(v, 1));
	await page.goto('./tensors/#average');
	await expect(stage(page)).toContainText(`(${avg.join(', ')})`);
	await choose(page, 'combine', 'hwc');
	await expect(stage(page)).toContainText('3 axes combined');
	await choose(page, 'combine', 'c');
	await expect(stage(page)).toContainText('(48, 36)');
});

test('turning the axes: the stress components change, the invariants and the pixel don’t', async ({
	page
}) => {
	const p = principal(stress(80, 20, 30));
	await page.goto('./tensors/#rotate');
	await expect(stage(page)).toContainText('σ′xx + σ′yy = 100 MPa');
	await slider(page, 'theta').fill('22.5');
	await expect(stage(page)).toContainText('No shear: these are the principal axes');
	await expect(stage(page)).toContainText(p.s1.toFixed(1));
	await expect(stage(page)).toContainText(p.s2.toFixed(1));
	await expect(stage(page)).toContainText('σ′xx σ′yy − τ′xy² = 700 MPa²');
	// The x′ handle turns the axes by 1° per key press.
	await page.getByRole('slider', { name: 'End of the x′ axis' }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page, 'theta')).toHaveValue('23.5');
	await expect(stage(page)).not.toContainText('No shear');
	await expect(stage(page)).toContainText('σ′xx + σ′yy = 100 MPa');

	const img = macaw();
	await page.goto('./tensors/#meanings');
	await expect(stage(page)).toContainText(
		`(red ${get(img, [24, 22, 0])}, green ${get(img, [24, 22, 1])}, blue ${get(img, [24, 22, 2])})`
	);
});

test('the traction on a cut is σ n: a cut facing y gets the second column', async ({ page }) => {
	await page.goto('./tensors/#stress');
	await expect(stage(page)).toContainText('t = σ n = (80, 30) MPa');
	await slider(page, 'cut').fill('90');
	await expect(stage(page)).toContainText('t = σ n = (30, 20) MPa');
});

test('the force keeps its 5 N length in turned axes', async ({ page }) => {
	await page.goto('./tensors/#axes-turn');
	await slider(page, 'theta').fill('90');
	// Axes turned a quarter turn: x′ points up, y′ left, so F = (4, 3) reads (3, −4).
	await expect(stage(page)).toContainText('F′ = (3, −4) N');
	await expect(stage(page)).toContainText('= 5 N');
});
