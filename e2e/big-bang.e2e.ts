import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its frozen frame (the grid's film stops at today).
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'every galaxy recedes at H0 × distance: 67.4 km/s per megaparsec today',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './big-bang/#receding');
		await expect(stage(page)).toContainText('Milky Way (you)');
		await expect(stage(page)).toContainText('67.4 km/s per megaparsec');
		await expect(stage(page)).toContainText('as measured from the Milky Way');
	}
);

test('any galaxy can be the viewpoint, from the buttons or by clicking it', async ({ page }) => {
	await open(page, './big-bang/#any-galaxy');
	await page.locator('button[data-control=view][data-value=b]').click();
	await expect(stage(page)).toContainText('B (you)');
	await expect(stage(page)).toContainText('as measured from galaxy B');
	// the same law from there
	await expect(stage(page)).toContainText('67.4 km/s per megaparsec');
	// click near the top-left corner of the map: some other galaxy becomes "you"
	const box = (await stage(page).boundingBox())!;
	await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.15);
	await expect(stage(page)).toContainText('as measured from the galaxy you picked');
	await expect(page.locator('button[data-control=view][aria-checked=true]')).toHaveCount(0);
});

test('running the film backward: denser and hotter, and slowing before 7.7 Gyr', async ({
	page
}) => {
	await open(page, './big-bang/#backward');
	await expect(stage(page)).toContainText('2.73 K');
	await range(page, 'time').press('Home');
	await expect(stage(page)).toContainText('3.00 billion years after the Big Bang');
	await expect(stage(page)).toContainText('× 0.31');
	await expect(stage(page)).toContainText('8.67 K');
	await open(page, './big-bang/#friedmann');
	await expect(stage(page)).toContainText('slowing down');
	await range(page, 'time').fill('13.8');
	await expect(stage(page)).toContainText('speeding up');
	await expect(stage(page)).toContainText('68.5%');
});

test('light from z = 1 arrives at twice its wavelength', async ({ page }) => {
	await open(page, './big-bang/#stretched-light');
	await expect(stage(page)).toContainText('681 nm');
	await range(page, 'zLight').fill('1');
	await expect(stage(page)).toContainText('972 nm (infrared)');
	await expect(stage(page)).toContainText('stretched × 2.00');
	await expect(stage(page)).toContainText('Sent 7.95 billion years ago');
});

test('timeline: helium appears after the deuterium bottleneck, about a quarter of the mass', async ({
	page
}) => {
	await open(page, './big-bang/#helium');
	await expect(stage(page)).toContainText('5.0 minutes');
	await expect(stage(page)).toContainText('24.5%');
	await expect(stage(page)).toContainText('1 for every 7.1 protons');
	await range(page, 'tHelium').press('Home');
	await expect(stage(page)).toContainText('0.010 s');
	await expect(stage(page)).toContainText('not yet');
});

test('timeline: the CMB at 371,000 years and 2,970 K, cooled to 2.73 K today', async ({ page }) => {
	await open(page, './big-bang/#cmb');
	await expect(stage(page)).toContainText('371,000 years');
	await expect(stage(page)).toContainText('2,970 K');
	await expect(stage(page)).toContainText('974 nm');
	// the opaque-to-transparent switch is schematic: it reads as escaped light, not bound electrons
	await expect(stage(page)).toContainText('Light that has escaped for good');
	await range(page, 'tCmb').press('End');
	await expect(stage(page)).toContainText('13.8 billion years');
	await expect(stage(page)).toContainText('2.73 K');
	await expect(stage(page)).toContainText('1.06 mm');
});

test('dragging along the timeline moves through time', async ({ page }) => {
	await open(page, './big-bang/#first-second');
	await expect(stage(page)).toContainText('1.0 seconds');
	const box = (await page.locator('rect.scrub').boundingBox())!;
	await page.mouse.click(box.x + box.width - 3, box.y + box.height / 2);
	await expect(stage(page)).toContainText('Today: 2.7 K, still expanding');
});

test('distances: the z = 14.18 galaxy is now 33.7 billion light years away', async ({ page }) => {
	await open(page, './big-bang/#distances');
	await expect(stage(page)).toContainText('JADES-GS-z14-0');
	await expect(stage(page)).toContainText('Now: 33.7 billion light years');
	await expect(stage(page)).toContainText('When the light left: 2.22 billion light years');
	await range(page, 'zFar').press('End');
	await expect(stage(page)).toContainText('Now: 45.2 billion light years');
	// 41.46 million: rounded once to 41 (it used to be rounded twice, to 42)
	await expect(stage(page)).toContainText('When the light left: 41 million light years');
});
