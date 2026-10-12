import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** A text of the stage that reads exactly `text`. */
const reading = (page: Page, text: string) =>
	stage(page)
		.locator('text')
		.filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });

/** Scene coordinates (960 × 600, letterboxed) → screen. */
async function scene(page: Page) {
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	return (x: number, y: number) => ({ x: ox + x * k, y: oy + y * k });
}

test('more half-wavelengths between the sources give more calm lines', async ({ page }) => {
	await page.goto('./waves-interference/#ripple-tank');
	// 6 cm apart, 2 cm wavelength: 3 wavelengths, 6 calm lines.
	await expect(stage(page)).toContainText('= 3.00 wavelengths apart');
	await expect(reading(page, '6')).toBeVisible();
	await slider(page, 'spacing').fill('12');
	await slider(page, 'lambda').fill('1');
	await expect(stage(page)).toContainText('= 12.00 wavelengths apart');
	await expect(reading(page, '24')).toBeVisible();
	// Closer than half a wavelength: no calm line at all.
	await slider(page, 'spacing').fill('1');
	await slider(page, 'lambda').fill('4');
	await expect(reading(page, '0')).toBeVisible();
});

test('a source can be dragged with the keyboard, and the spacing slider follows', async ({
	page
}) => {
	await page.goto('./waves-interference/#ripple-tank');
	const source = page.getByRole('slider', { name: 'Source 1 (sets the spacing)' });
	await source.focus();
	await page.keyboard.press('ArrowRight');
	await expect(slider(page, 'spacing')).toHaveValue('6.5');
	await page.keyboard.press('End');
	await expect(slider(page, 'spacing')).toHaveValue('12');
	await expect(stage(page)).toContainText('12.0 cm');
});

test('the probe reads cancellation on a calm line and reinforcement on the centre line', async ({
	page
}) => {
	await page.goto('./waves-interference/#path-difference');
	const probe = page.getByRole('slider', { name: 'Probe' });
	await expect(probe).toBeAttached();
	// It starts on the first calm line: half a wavelength of path difference.
	await expect(stage(page)).toContainText('0.50 λ');
	await expect(stage(page)).toContainText('crest meets trough');
	// Drag it onto the line straight ahead, level with the midpoint of the sources (y = 300).
	const at = await scene(page);
	const box = (await probe.boundingBox())!;
	const to = at(480, 300);
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await page.mouse.up();
	await expect(stage(page)).toContainText('0.00 λ');
	await expect(stage(page)).toContainText('crest meets crest');
});

test('the n-th harmonic of the A string is n × 110 Hz', async ({ page }) => {
	await page.goto('./waves-interference/#harmonics');
	await expect(stage(page)).toContainText('330 Hz');
	await slider(page, 'harmonic').fill('5');
	await expect(stage(page)).toContainText('550 Hz');
	await expect(stage(page)).toContainText('26.0 cm'); // λ = 2 × 65 cm ÷ 5
	await expect(page.getByRole('button', { name: '▶ Hear this note' })).toBeVisible();
});

test('a string plucked in the middle has no even harmonics', async ({ page }) => {
	await page.goto('./waves-interference/#pluck');
	await expect(stage(page)).toContainText('5th, 10th'); // plucked at 20%
	await slider(page, 'pluckAt').fill('50');
	await expect(stage(page)).toContainText('2nd, 4th, 6th, 8th, 10th, 12th');
});

test('a source moving at 30 m/s is heard higher ahead and lower behind', async ({ page }) => {
	await page.goto('./waves-interference/#doppler');
	await expect(stage(page)).toContainText('482 Hz');
	await expect(stage(page)).toContainText('405 Hz');
	await slider(page, 'speed').fill('0');
	await expect(stage(page)).not.toContainText('482 Hz');
	await expect(stage(page)).not.toContainText('405 Hz');
	await expect(stage(page)).toContainText('no shift when still');
});
