import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const handle = (page: Page) => page.getByRole('slider', { name: 'Point on the circle' });
const slider = (page: Page) => page.locator('input[type=range][data-control=angle]');

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(handle(page)).toBeAttached();
}

test('dragging the point sets the angle and the slider follows', async ({ page }) => {
	await open(page, '/unit-circle/#circle');
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
	await open(page, '/unit-circle/#coordinates');
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
	await open(page, '/unit-circle/#quadrants');
	await page.locator('input[type=checkbox][data-control=snap]').check({ force: true });
	await handle(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page)).toHaveValue('45');
	await expect(stage(page)).toContainText('√2/2');
});
