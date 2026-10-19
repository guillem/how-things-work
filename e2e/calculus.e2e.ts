import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);
const point = (page: Page) => page.getByRole('slider', { name: 'Point on the curve' });

async function open(page: Page, url: string, text: string) {
	// Reduced motion freezes the scenes on one complete frame.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('the point slides along the curve by keyboard and the tangent slope follows', async ({
	page
}) => {
	await open(page, './calculus/#tangent', 'f′(x) = 2.00');
	await point(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(range(page, 'x')).toHaveValue('1.05');
	await expect(stage(page)).toContainText('f′(x) = 2.10');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('f′(x) = 6.00');
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('flat');
	await expect(page).toHaveURL(/#tangent$/);
});

test('dragging the point moves it along the curve and the slider follows', async ({ page }) => {
	await open(page, './calculus/#tangent', 'f′(x) = 2.00');
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	const handle = (await point(page).boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	// x = 2 is two thirds of the way across the plot (84 … 676 on the 960-wide stage).
	await page.mouse.move(ox + (84 + (592 * 2) / 3) * k, oy + 300 * k, { steps: 8 });
	await page.mouse.up();
	await expect(range(page, 'x')).toHaveValue('2');
	await expect(stage(page)).toContainText('f′(x) = 4.00');
});

test('shrinking the run brings the chord slope to the derivative', async ({ page }) => {
	await open(page, './calculus/#chord', 'rise ÷ run = 3.00');
	await range(page, 'h').fill('0.1');
	await expect(stage(page)).toContainText('rise ÷ run = 2.10');
	await range(page, 'h').fill('0.01');
	await expect(stage(page)).toContainText('rise ÷ run = 2.01');
});

test('dragging a knot by keyboard turns the curve into your own', async ({ page }) => {
	await open(page, './calculus/#your-curve', 'y = x²');
	const knot = page.getByRole('slider', { name: /Knot 3 of the curve/ });
	await knot.focus();
	await page.keyboard.press('Shift+ArrowUp');
	await expect(option(page, 'curve', 'custom')).toHaveAttribute('aria-checked', 'true');
	await expect(stage(page)).toContainText('your own curve');
	// The knot at x = 1.2 sat on y = x² at 1.44 and went up by 2.5.
	await expect(knot).toHaveAttribute('aria-valuetext', 'height 3.94');
	// Back to the parabola, the knot sits on it again.
	await option(page, 'curve', 'parabola').click();
	await expect(knot).toHaveAttribute('aria-valuetext', 'height 1.44');
});

test('more rectangles bring the total to the exact area', async ({ page }) => {
	await open(page, './calculus/#converge', '5.91');
	await expect(stage(page)).toContainText('exact area = 9.00');
	await range(page, 'n').fill('100');
	await expect(stage(page)).toContainText('8.87');
	await expect(stage(page)).toContainText('double n: error ÷ 2.0');
	await option(page, 'rule', 'mid').click();
	await expect(stage(page)).toContainText('double n: error ÷ 4.0');
});

test('area below the axis counts as negative', async ({ page }) => {
	await open(page, './calculus/#integral', '∫₀³ f(x) dx = 9.00');
	await option(page, 'curve', 'wave').click();
	await expect(stage(page)).toContainText('−2.86');
	await expect(stage(page)).toContainText('∫₀³ f(x) dx = 0.00');
});

test('the slope of the running area is the height of the curve', async ({ page }) => {
	await open(page, './calculus/#area-slope', 'f(x) = 1.00');
	await range(page, 'x').fill('1.5');
	await expect(stage(page)).toContainText(/slope of A at x\s*2\.25/);
	await expect(stage(page)).toContainText('f(x) = 2.25');
});

test('the thrown ball: slope of height is velocity, area under velocity is height', async ({
	page
}) => {
	await open(page, './calculus/#motion', 'v = 4.90 m/s');
	await point(page).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('v = −14.70 m/s');
	await expect(stage(page)).toContainText('= 0.00 m');
});
