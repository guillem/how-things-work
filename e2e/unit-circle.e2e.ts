import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const handle = (page: Page) => page.getByRole('slider', { name: 'Point on the circle' });
const slider = (page: Page) => page.locator('input[type=range][data-control=angle]');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(handle(page)).toBeAttached();
}

test('dragging the point sets the angle and the slider follows', async ({ page }) => {
	await open(page, './unit-circle/#circle');
	const svg = page.locator('.stage svg');
	const box = (await svg.boundingBox())!;
	// Scene coordinates → screen: the stage is 960 × 600 units, letterboxed.
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	const at = (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
	// The circle is centred at (312, 300) with radius 210; the point starts at 30°.
	const start = at(312 + 210 * Math.cos(Math.PI / 6), 300 - 210 * Math.sin(Math.PI / 6));
	const top = at(312, 300 - 210);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(top.x, top.y, { steps: 8 });
	await page.mouse.up();
	await expect(slider(page)).toHaveValue('90');
	await expect(stage(page)).toContainText('θ = 90°');
});

test('the point can be moved with the keyboard without changing the step', async ({ page }) => {
	await open(page, './unit-circle/#coordinates');
	await handle(page).focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Shift+ArrowRight');
	await expect(slider(page)).toHaveValue('41');
	await page.keyboard.press('End');
	await expect(slider(page)).toHaveValue('360');
	await expect(page).toHaveURL(/#coordinates$/);
	await expect(handle(page)).toHaveAttribute('aria-valuetext', /360°/);
});

test('snap visits the special angles', async ({ page }) => {
	await open(page, './unit-circle/#quadrants');
	await page.locator('input[type=checkbox][data-control=snap]').check();
	await handle(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page)).toHaveValue('45');
	await expect(stage(page)).toContainText('√2/2');
});

test('the angle slider snaps pointer input and visits special angles with the keyboard', async ({
	page
}) => {
	await open(page, './unit-circle/#quadrants');
	const snap = page.locator('input[type=checkbox][data-control=snap]');
	await snap.check();
	await slider(page).evaluate((input: HTMLInputElement) => {
		input.value = '43';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await expect(slider(page)).toHaveValue('45');
	await expect(handle(page)).toHaveAttribute('aria-valuetext', /45°/);
	await slider(page).press('ArrowRight');
	await expect(slider(page)).toHaveValue('60');
	await slider(page).press('ArrowLeft');
	await expect(slider(page)).toHaveValue('45');
	await expect(page).toHaveURL(/#quadrants$/);
	await snap.uncheck();
	await slider(page).evaluate((input: HTMLInputElement) => {
		input.value = '43';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await expect(slider(page)).toHaveValue('43');
});

for (const [set, shown, step] of [
	['-30', '330', 'coordinates'],
	['600', '240', 'radians']
]) {
	test(`an angle of ${set}° set on "periodic" reads ${shown}° on "${step}"`, async ({ page }) => {
		const readout = page.locator('label.control.range', { has: slider(page) }).locator('output');
		await open(page, './unit-circle/#periodic');
		await slider(page).evaluate((input: HTMLInputElement, v) => {
			input.value = v;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		}, set);
		await expect(readout).toContainText(`${set.replace('-', '−')}°`);
		await page.evaluate((h) => (location.hash = h), `#${step}`);
		await expect(page).toHaveURL(new RegExp(`#${step}$`));
		// The slider's readout names the angle the point is drawn at. (The wave scene
		// writes the wrapped angle back as the step changes, before it is replaced.)
		await expect(readout).toHaveText(new RegExp(`^${shown}° `));
	});
}

test('coming back to a circle step after setting −30° on "periodic" reads 330°', async ({
	page
}) => {
	const readout = page.locator('label.control.range', { has: slider(page) }).locator('output');
	await open(page, './unit-circle/#coordinates');
	await page.evaluate(() => (location.hash = '#periodic'));
	await expect(page).toHaveURL(/#periodic$/);
	await slider(page).evaluate((input: HTMLInputElement) => {
		input.value = '-30';
		input.dispatchEvent(new Event('input', { bubbles: true }));
	});
	await expect(readout).toContainText('−30°');
	await page.evaluate(() => (location.hash = '#coordinates'));
	await expect(page).toHaveURL(/#coordinates$/);
	await expect(readout).toHaveText(/^330° /);
});
