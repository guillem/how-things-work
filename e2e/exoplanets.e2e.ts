import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its finished, frozen frame.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** Picks an option of a select control (a row of radio buttons). */
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'a transit dims the star by (Rp/R★)²: an Earth across the Sun is an 84 ppm dip',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './exoplanets/#transit');
		await expect(stage(page)).toContainText(/Dip\s*1\.0%/);
		await range(page, 'size').fill('1');
		await expect(stage(page)).toContainText('84 ppm');
	}
);

test('the same planet makes a far deeper dip in front of a small red dwarf', async ({ page }) => {
	await open(page, './exoplanets/#transit');
	await range(page, 'size').fill('1');
	await choose(page, 'star', 'proxima');
	await expect(stage(page)).toContainText(/Dip\s*0\.42%/);
});

test('the period follows Kepler’s third law: 1 AU round the Sun is a year', async ({ page }) => {
	await open(page, './exoplanets/#period');
	await expect(stage(page)).toContainText(/Gap between dips\s*4\.08 days/);
	await range(page, 'dist').fill('0');
	await expect(stage(page)).toContainText(/Gap between dips\s*365 days/);
});

test('at 1 AU, tilting the orbit by 0.3° makes the transit disappear', async ({ page }) => {
	await open(page, './exoplanets/#tilt');
	await range(page, 'dist').fill('0');
	await expect(stage(page)).toContainText('a full transit');
	await expect(stage(page)).toContainText('1 in 195');
	await range(page, 'tilt').fill('15'); // 0.30° from edge-on
	await expect(stage(page)).toContainText('no transit: it misses the star');
});

test('the Earth moves the Sun at 9 cm/s; a hot Jupiter swings it at over 100 m/s', async ({
	page
}) => {
	await open(page, './exoplanets/#wobble');
	await expect(stage(page)).toContainText(/± 127 m\/s/);
	await range(page, 'mass').fill('0');
	await range(page, 'dist').fill('0');
	await expect(stage(page)).toContainText(/± 8\.9 cm\/s/);
});

test('seen face-on the star still moves, but none of it is towards us', async ({ page }) => {
	await open(page, './exoplanets/#tilt-wobble');
	await range(page, 'tilt').fill('100');
	await expect(stage(page)).toContainText(/± 0 cm\/s/);
	await expect(stage(page)).toContainText(/Star’s real speed\s*127 m\/s/);
	await expect(stage(page)).toContainText('no shift: seen face-on');
	await expect(stage(page)).not.toContainText('redder by');
});

test('tilting the orbit flattens the velocity curve', async ({ page }) => {
	await open(page, './exoplanets/#tilt-wobble');
	const curve = stage(page).locator('path[stroke="var(--ex-rv)"]').last();
	const height = async () => (await curve.boundingBox())?.height ?? 0;
	await range(page, 'tilt').fill('0');
	const edgeOn = await height();
	await range(page, 'tilt').fill('90'); // 66° from edge-on: sin i = 0.41
	await expect.poll(height).toBeLessThan(edgeOn * 0.5);
	expect(await height()).toBeGreaterThan(edgeOn * 0.3);
});

test('both curves give size, mass and density; tilting loses the dip and the density', async ({
	page
}) => {
	await open(page, './exoplanets/#both');
	await expect(stage(page)).toContainText(/11\.0 × Earth/);
	await expect(stage(page)).toContainText(/318 Earths/);
	await expect(stage(page)).toContainText('1.3 g/cm³');
	await range(page, 'tilt').fill('50'); // 11° from edge-on
	await expect(stage(page)).toContainText('no dip: unknown');
	await expect(stage(page)).toContainText('needs both curves');
});

test('reading a mystery planet back from its curves, then revealing it', async ({ page }) => {
	await open(page, './exoplanets/#mystery');
	await range(page, 'measDepth').fill('1.44');
	await range(page, 'measK').fill('85');
	await expect(stage(page)).toContainText(/15\.\d × Earth/);
	await expect(stage(page)).toContainText(/2[23]\d Earths/);
	const reveal = page.locator('input[type=checkbox][data-control=reveal]');
	await reveal.focus();
	await page.keyboard.press('Space');
	await expect(reveal).toBeChecked();
	await expect(stage(page)).toContainText('HD 209458 b');
	// The dip handle is keyboard accessible too.
	const handle = page.getByRole('slider', { name: 'Depth of the dip' });
	await handle.focus();
	await page.keyboard.press('Home');
	await expect(range(page, 'measDepth')).toHaveValue('0');
});

test('a planet that never transits gives only its minimum mass', async ({ page }) => {
	await open(page, './exoplanets/#mystery');
	await choose(page, 'mystery', 'peg51');
	await range(page, 'measK').fill('56');
	await expect(stage(page)).toContainText('no dip: unknown');
	await expect(stage(page)).toContainText(/Wobble → at least\s*14\d Earths/);
});

test('the habitable zone: the Earth and Mars are in it, Venus is not; a red dwarf’s is close in', async ({
	page
}) => {
	await open(page, './exoplanets/#zone');
	await expect(stage(page)).toContainText('too close: too hot');
	await range(page, 'dist').fill('0');
	await expect(stage(page)).toContainText('in the habitable zone');
	await range(page, 'dist').fill('0.18'); // 1.51 AU, Mars
	await expect(stage(page)).toContainText('in the habitable zone');
	await range(page, 'dist').fill('-0.14'); // 0.72 AU, Venus
	await expect(stage(page)).toContainText('too close: too hot');
	await choose(page, 'star', 'proxima');
	await range(page, 'dist').fill('-1.3'); // 0.05 AU
	await expect(stage(page)).toContainText('in the habitable zone');
	// Dragging the planet's handle from the keyboard moves it.
	await page.getByRole('slider', { name: 'Planet’s distance from its star' }).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('too far: too cold');
});

test('the census: fewer than 2 in 100 known planets have been photographed', async ({ page }) => {
	await open(page, './exoplanets/#census');
	await expect(stage(page)).toContainText(/Known exoplanets\s*\d,\d{3}/);
	await expect(stage(page)).toContainText(/Photographed \(imaging\)\s*\d+ planets · 1\.\d%/);
});
