import { expect, test, type Page } from '@playwright/test';

// The tsunami explainer: what a visitor reads on the stage as the 2011 wave crosses the slice of
// the Pacific (arrival times beside the real records), the speed gauge, the shelf and the ridge
// they reshape, the wind wave they compare, and the real records. Reduced motion shows each run at
// a fixed model time (deterministic); the model tests check the physics itself.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
/** The highest the sea has been at the coast, m, as the shelf step shows it. */
const coastHeight = async (page: Page) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(/at the coast\s*highest so far ([\d.]+) m/);
	if (!m) throw new Error('no coast height on the stage');
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'the wave reaches the buoys and California when the real one did',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./tsunamis/#cross');
		await expect(stage(page)).toContainText('10 h 20 min');
		await expect(stage(page)).toContainText('model 1 h 29 min · real 1 h 29 min');
		await expect(stage(page)).toContainText('model 10 h 06 min · real 10 h 05 min');
		await expect(stage(page)).toContainText('upper bound');
	}
);

test('the speed gauge follows the depth; a wind wave stays slow', async ({ page }) => {
	await page.goto('./tsunamis/#speed');
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(/([\d,]+) km\/h\s*over ([\d,]+) m of water/);
	expect(m).not.toBeNull();
	const speed = Number(m![1].replace(',', ''));
	const depth = Number(m![2].replace(',', ''));
	// √(g h), in km/h, to the rounding of the read-out
	expect(Math.abs(speed - Math.sqrt(9.81 * depth) * 3.6)).toBeLessThan(1.5);
	await expect(stage(page)).toContainText('crests 10 s apart: 56 km/h');
});

test('under a tsunami the whole column moves; under a wind wave only the top', async ({ page }) => {
	await page.goto('./tsunamis/#long');
	await expect(stage(page)).toContainText('as far at the floor as at the surface');
	await page.locator('button[data-control=wave][data-value=wind]').click();
	await expect(stage(page)).toContainText('half a wavelength down (75 m) almost nothing moves');
});

test('a long gentle slope raises the coast more than a steep one', async ({ page }) => {
	await page.goto('./tsunamis/#shelf');
	await expect(stage(page)).toContainText('the real shelf off Crescent City');
	await toggle(page, 'reshape').focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, 'reshape')).toBeChecked();
	await range(page, 'ramp').fill('10');
	await expect(stage(page)).toContainText('foot of the slope, 10 km out');
	const steep = await coastHeight(page);
	await range(page, 'ramp').fill('300');
	await expect(stage(page)).toContainText('foot of the slope, 300 km out');
	const gentle = await coastHeight(page);
	expect(gentle).toBeGreaterThan(steep);
});

test('a ridge near the surface sends part of the wave back; an island stops it', async ({
	page
}) => {
	await page.goto('./tsunamis/#ridge');
	await expect(stage(page)).toContainText('past the ridge');
	await range(page, 'ridgeTop').fill('0');
	await expect(stage(page)).toContainText('an island: in a slice, a wall');
	await expect(stage(page)).toContainText('past the ridge: 0 m high');
});

test('the real records sit beside the model', async ({ page }) => {
	await page.goto('./tsunamis/#records');
	for (const name of ['DART 21401', 'DART 21419', 'DART 46402', 'Crescent City']) {
		await expect(stage(page)).toContainText(name);
	}
	await expect(stage(page)).toContainText('real: first crest 10 h 05 min, 95 cm');
	await expect(stage(page)).toContainText('model: 10 h 06 min');
});

test('on a phone the arrival times are listed under the stage', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./tsunamis/#cross');
	const panel = page.getByRole('group', { name: 'Readouts' });
	await expect(panel).toContainText('Crescent City');
	await expect(panel).toContainText('model 10 h 06 min · real 10 h 05 min');
});
