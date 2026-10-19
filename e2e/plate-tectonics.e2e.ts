import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const plate = (page: Page) => page.getByRole('slider', { name: 'Right plate' });
const control = (page: Page, id: string) => page.locator(`[data-control=${id}]`);

// Reduced motion: the plates are drawn at the set distance at once (no 3 s build-up).
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page)).toBeAttached();
}

test('pushing an ocean plate under a continent: the volcanoes wait for it to get deep', async ({
	page
}) => {
	await open(page, './plate-tectonics/#subduction');
	await expect(stage(page)).toContainText('trench');
	await expect(stage(page)).toContainText('km from the trench');
	await expect(stage(page)).toContainText('14 million years at 5 cm a year');
	// Pull the plate back (to the right) with the keyboard: 12 × 50 km less convergence.
	await plate(page).focus();
	for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowRight');
	await expect(control(page, 'subClose')).toHaveValue('100');
	await expect(stage(page)).toContainText('Moved together 100 km');
	await expect(stage(page)).toContainText('no volcanoes yet');
	await expect(stage(page)).not.toContainText('km from the trench');
	await expect(page).toHaveURL(/#subduction$/);
});

test('two continents make mountains but no volcanoes', async ({ page }) => {
	await open(page, './plate-tectonics/#collision');
	await expect(stage(page)).toContainText('mountains');
	await expect(stage(page)).toContainText('no ocean floor sinking: no volcanoes');
	await expect(stage(page)).not.toContainText('trench');
});

test('the sandbox: the crust on each plate decides what forms', async ({ page }) => {
	await open(page, './plate-tectonics/#sandbox');
	await expect(stage(page)).toContainText('Plates at rest');
	await page.locator('[data-control=sbRight][data-value=continent]').click();
	await plate(page).focus();
	for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowLeft'); // 500 km together
	await expect(control(page, 'sbNormal')).toHaveValue('-500');
	await expect(stage(page)).toContainText('mountains');
	await page.locator('[data-control=sbRight][data-value=ocean]').click();
	await expect(stage(page)).toContainText('trench');
	await expect(stage(page)).toContainText('km from the trench');
	await expect(stage(page)).not.toContainText('mountains');
	// Up slides the plates past each other as well: a slanting boundary does both.
	await plate(page).focus();
	await page.keyboard.press('Shift+ArrowUp');
	await expect(control(page, 'sbSlide')).toHaveValue('50');
	await expect(stage(page)).toContainText('at a slant');
	await expect(stage(page)).toContainText('transform fault');
});

test('a ridge makes ocean floor, and faster plates make it sooner', async ({ page }) => {
	await open(page, './plate-tectonics/#ridge');
	await expect(stage(page)).toContainText('mid-ocean ridge · 2.6 km deep');
	await expect(stage(page)).toContainText('12 million years at 5 cm a year');
	await control(page, 'speed').fill('10');
	await expect(stage(page)).toContainText('6.0 million years at 10 cm a year');
});

test('a continent pulled far enough apart breaks into a new ocean', async ({ page }) => {
	await open(page, './plate-tectonics/#rift');
	// A young rift is a dry valley on its dome (East Africa); pulled further, the sea floods in.
	await expect(stage(page)).toContainText('rift valley');
	await expect(stage(page)).not.toContainText('flooded');
	await control(page, 'riftOpen').fill('220');
	await expect(stage(page)).toContainText('rift valley, flooded by the sea');
	await control(page, 'riftOpen').fill('600');
	await expect(stage(page)).toContainText('a new ocean · 360 km wide');
	await expect(stage(page)).toContainText('mid-ocean ridge');
});

test('sliding plates sideways only shifts them: a transform fault', async ({ page }) => {
	await open(page, './plate-tectonics/#transform');
	await expect(stage(page)).toContainText('Slid past 150 km');
	await plate(page).focus();
	await page.keyboard.press('ArrowUp');
	await expect(control(page, 'slide')).toHaveValue('160');
	await expect(stage(page)).toContainText('Slid past 160 km');
	await expect(stage(page)).not.toContainText('volcanoes');
});

test('thicker crust floats higher, over a deeper root', async ({ page }) => {
	await open(page, './plate-tectonics/#layers');
	await expect(stage(page)).toContainText('0.5 km above sea level');
	await control(page, 'crust').fill('70');
	await expect(stage(page)).toContainText('5.8 km above sea level');
	await expect(stage(page)).toContainText('root: 64 km down');
});

test('dragging the world map turns it, and the slider follows', async ({ page }) => {
	await open(page, './plate-tectonics/#plates');
	await expect(control(page, 'lon')).toHaveValue('150');
	await expect(stage(page)).toContainText('86% of these earthquakes struck within 200 km');
	const box = (await page.locator('.stage svg').boundingBox())!;
	const k = Math.min(box.width / 960, box.height / 600);
	const ox = box.x + (box.width - 960 * k) / 2;
	const oy = box.y + (box.height - 600 * k) / 2;
	await page.mouse.move(ox + 600 * k, oy + 250 * k);
	await page.mouse.down();
	await page.mouse.move(ox + 342 * k, oy + 250 * k, { steps: 6 }); // 258 px ≈ 100° west to east
	await page.mouse.up();
	await expect(control(page, 'lon')).toHaveValue('-110');
});
