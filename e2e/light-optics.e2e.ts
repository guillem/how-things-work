import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);

test("Snell's law: the angle in the glass follows the refractive index", async ({ page }) => {
	await page.goto('./light-optics/#snell');
	// 40° from air into crown glass (n = 1.52): 25.0° inside, and the sines match.
	await expect(stage(page)).toContainText('25.0°');
	await expect(stage(page)).toContainText('1.52 × sin 25.0° = 0.643');
	// With n = 1 nothing bends.
	await slider(page, 'n').fill('1');
	await expect(stage(page)).toContainText('1.00 × sin 40.0° = 0.643');
	// Diamond bends it most.
	await slider(page, 'n').fill('2.42');
	await expect(stage(page)).toContainText('15.4°');
});

test('past the critical angle all the light is reflected', async ({ page }) => {
	await page.goto('./light-optics/#tir');
	await expect(stage(page)).toContainText('critical angle 41.1°');
	await expect(stage(page)).not.toContainText('Total internal reflection');
	// Drag the lamp (here with the keyboard) out to 85° from the normal.
	await page.getByRole('slider', { name: 'Lamp' }).focus();
	await page.keyboard.press('End');
	await expect(slider(page, 'inside')).toHaveValue('85');
	await expect(stage(page)).toContainText('Total internal reflection');
	await expect(stage(page)).toContainText('100%');
	// Water (n = 1.33 on the slider) has a larger critical angle.
	await slider(page, 'n').fill('1.33');
	await expect(stage(page)).toContainText('critical angle 48.8°');
});

test('the mirror reflects at the angle the light arrives at', async ({ page }) => {
	await page.goto('./light-optics/#mirror');
	const cells = stage(page).locator('text');
	const angles = async () => {
		const all = await cells.allTextContents();
		return all.filter((s) => /^\s*\d+\.\d°\s*$/.test(s)).map((s) => s.trim());
	};
	await expect(stage(page)).toContainText('Angle of reflection');
	const before = await angles();
	expect(before).toHaveLength(2);
	expect(before[0]).toBe(before[1]);
	await page.getByRole('slider', { name: 'Turn the mirror' }).focus();
	await page.keyboard.press('Shift+ArrowRight');
	await expect(slider(page, 'mirror')).toHaveValue('10');
	const after = await angles();
	expect(after[0]).toBe(after[1]);
	expect(after[0]).not.toBe(before[0]);
});

test('a fibre bent too tightly leaks', async ({ page }) => {
	await page.goto('./light-optics/#fibre');
	await expect(stage(page)).toContainText('Trapped');
	await slider(page, 'bend').fill('5');
	await expect(stage(page)).toContainText('Too tight: light escapes at the bend');
});

test('curvier faces and higher index shorten the focal length', async ({ page }) => {
	await page.goto('./light-optics/#lens');
	await expect(stage(page)).toContainText('144 mm');
	await slider(page, 'radius').fill('150');
	await expect(stage(page)).toContainText('72 mm');
	await option(page, 'lens', 'concave').click();
	await expect(stage(page)).toContainText('−72 mm');
});

test('an object at twice the focal length makes a same-size image; inside f, a virtual one', async ({
	page
}) => {
	await page.goto('./light-optics/#image');
	await expect(stage(page)).toContainText('real image');
	await slider(page, 'u').fill('327');
	await expect(stage(page)).toContainText('× 1.00');
	await expect(stage(page)).toContainText('upside down');
	// The object can be moved with the keyboard too: End brings it closest to the lens.
	await page.getByRole('slider', { name: 'Object' }).focus();
	await page.keyboard.press('End');
	await expect(slider(page, 'u')).toHaveValue('90');
	await expect(stage(page)).toContainText('virtual image');
});

test('a prism spreads white light; diamond traps it', async ({ page }) => {
	await page.goto('./light-optics/#prism');
	await expect(stage(page)).toContainText('1.776');
	await expect(stage(page)).toContainText('1.842');
	await expect(stage(page)).toContainText('violet bent most');
	await option(page, 'material', 'diamond').click();
	await expect(stage(page)).toContainText('the light cannot get out through the far face');
});

test('the rainbow: red at 42.3°, violet at 40.6°', async ({ page }) => {
	await page.goto('./light-optics/#rainbow');
	await expect(stage(page)).toContainText('42.3°');
	await expect(stage(page)).toContainText('40.6°');
	await page.getByRole('switch', { name: 'White light (all colours)' }).uncheck({ force: true });
	await slider(page, 'nm').fill('450');
	await expect(stage(page)).toContainText('The bow for 450 nm');
});

test('parts on the bench move with the keyboard', async ({ page }) => {
	await page.goto('./light-optics/#bench');
	const lens = page.getByRole('button', { name: /^Lens/ });
	const box = async () => (await lens.boundingBox())!;
	const x0 = (await box()).x;
	await lens.focus();
	await page.keyboard.press('Shift+ArrowRight');
	await expect.poll(async () => (await box()).x).toBeGreaterThan(x0 + 5);
	await page.locator('.action button[data-control=reset]').click();
	await expect.poll(async () => (await box()).x).toBeCloseTo(x0, 0);
});
