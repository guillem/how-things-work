import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scan is shown complete, so readouts are final.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const errorPct = async (page: Page) => {
	const text = await stage(page)
		.locator('text', { hasText: /difference from the true slice: [\d.]+%/ })
		.textContent();
	return Number(text?.match(/([\d.]+)%/)?.[1]);
};

test('the X-ray source turns with the arrow keys, and past 180° the shadow is the mirror', async ({
	page
}) => {
	await page.goto('./medical-imaging/#rotate');
	await expect(stage(page)).toContainText('beam direction 30°');
	const source = page.getByRole('slider', { name: 'X-ray source' });
	await source.focus();
	await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('beam direction 31°');
	await expect(range(page, 'angle')).toHaveValue('31');
	await range(page, 'angle').fill('200');
	await expect(stage(page)).toContainText('(same as 20°, mirrored)');
	await expect(page).toHaveURL(/#rotate$/);
});

test('the ramp filter brings the computed slice close to the true one', async ({ page }) => {
	await page.goto('./medical-imaging/#filter');
	await expect(stage(page)).toContainText('180 of 180 · filtered');
	const filtered = await errorPct(page);
	expect(filtered).toBeLessThan(8);
	await toggle(page, 'filter').uncheck({ force: true });
	await expect(stage(page)).toContainText('180 of 180 · not filtered');
	expect(await errorPct(page)).toBeGreaterThan(3 * filtered);
});

test('more directions, fewer streaks: the difference falls', async ({ page }) => {
	await page.goto('./medical-imaging/#angles');
	await range(page, 'angles').fill('4');
	await expect(stage(page)).toContainText('4 directions, 45° apart');
	const few = await errorPct(page);
	await range(page, 'angles').fill('32');
	await expect(stage(page)).toContainText('32 directions');
	const some = await errorPct(page);
	await range(page, 'angles').fill('180');
	await expect(stage(page)).toContainText('180 directions');
	const all = await errorPct(page);
	expect(few).toBeGreaterThan(some);
	expect(some).toBeGreaterThan(all);
});

test('the probe reads soft tissue in the heart, a negative CT number in the lung and over +1000 in bone', async ({
	page
}) => {
	await page.goto('./medical-imaging/#hounsfield');
	const hu = async () => {
		const text = await stage(page)
			.locator('text', { hasText: /probe: [+−]?\d+ HU/ })
			.textContent();
		const m = text?.match(/probe: ([+−]?)(\d+)/);
		return m ? (m[1] === '−' ? -1 : 1) * Number(m[2]) : NaN;
	};
	await expect(stage(page)).toContainText('heart');
	const heart = await hu();
	expect(heart).toBeGreaterThan(30);
	expect(heart).toBeLessThan(80);
	const probe = page.getByRole('slider', { name: 'CT number probe' });
	await probe.focus();
	for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
	await expect(stage(page)).toContainText('right lung');
	expect(await hu()).toBeLessThan(-400);
	// down the picture (towards the back) to the spine
	for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowRight');
	for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowDown');
	await expect(stage(page)).toContainText('spine');
	expect(await hu()).toBeGreaterThan(1000);
});

test('lower dose, more noise', async ({ page }) => {
	await page.goto('./medical-imaging/#dose');
	const noise = async () =>
		Number(
			(
				await stage(page)
					.locator('text', { hasText: /noise in the heart/ })
					.textContent()
			)?.match(/± (\d+)/)?.[1]
		);
	const standard = await noise();
	await range(page, 'dose').fill('0.25');
	await expect(stage(page)).toContainText('0.25 × standard');
	const quarter = await noise();
	// a quarter of the photons: twice the noise (measured against a noise-free reconstruction,
	// so the ratio is the 1/√dose rule itself)
	expect(quarter / standard).toBeGreaterThan(1.85);
	expect(quarter / standard).toBeLessThan(2.15);
});

test('lower down, the CT slice finds the fluid the X-ray cannot see', async ({ page }) => {
	await page.goto('./medical-imaging/#compare');
	await expect(stage(page)).toContainText('nodule');
	await range(page, 'slice').fill('13');
	await expect(stage(page)).toContainText('13 cm lower');
	await expect(stage(page)).toContainText('cyst (fluid)');
	// Both numbers are read off the reconstructed slice: fluid near water's 0, about 55 HU below
	// the liver round it (as the narrative says).
	const label = stage(page).locator('text', { hasText: /^fluid: / });
	const m = (await label.textContent())?.match(/fluid: ([+−]?\d+) HU, liver ([+−]?\d+) HU/);
	expect(m).toBeTruthy();
	const num = (v: string) => Number(v.replace('−', '-'));
	const fluid = num(m![1]);
	const liver = num(m![2]);
	expect(Math.abs(fluid)).toBeLessThan(10);
	expect(liver - fluid).toBeGreaterThan(45);
	expect(liver - fluid).toBeLessThan(65);
});

test('without gel the sound bounces straight back', async ({ page }) => {
	await page.goto('./medical-imaging/#ultrasound');
	await expect(stage(page)).toContainText('fat → muscle: echo after 25.5 μs, drawn at 1.96 cm');
	await toggle(page, 'gel').uncheck({ force: true });
	await expect(stage(page)).toContainText('probe → air: 99.89% reflected');
});

test('the Larmor frequency follows the field: 42.58 MHz per tesla', async ({ page }) => {
	await page.goto('./medical-imaging/#larmor');
	await expect(stage(page)).toContainText('f = 63.9 MHz');
	await range(page, 'field').fill('3');
	await expect(stage(page)).toContainText('f = 127.7 MHz');
});

test('long TR and TE give a T2-weighted image in which blood is brightest', async ({ page }) => {
	await page.goto('./medical-imaging/#relaxation');
	await expect(stage(page)).toContainText('T1-weighted: brightest is fat');
	await range(page, 'tr').fill('4000');
	await range(page, 'te').fill('100');
	await expect(stage(page)).toContainText('T2-weighted: brightest is blood');
});
