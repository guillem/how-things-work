import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its frozen, complete frame.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('silicon absorbs green light and lets 1200 nm infrared through', async ({ page }) => {
	await open(page, './solar-cells/#absorb');
	await expect(stage(page)).toContainText('absorbed: one electron–hole pair');
	await range(page, 'nm').fill('1200');
	await expect(stage(page)).toContainText('passes through: 0.09 eV too weak');
});

test('a violet photon loses most of its energy as heat', async ({ page }) => {
	await open(page, './solar-cells/#heat');
	await range(page, 'nm').fill('400');
	await expect(stage(page)).toContainText('heat: 1.98 eV, 64% of the photon');
});

test(
	'one electron per photon: at the same power red light gives more current than green, infrared none',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './solar-cells/#sweep');
		await expect(stage(page)).toContainText('current: 26.6 mA per cm²');
		await range(page, 'nm').fill('700');
		await expect(stage(page)).toContainText('current: 33.9 mA per cm²');
		await range(page, 'power').fill('300');
		await expect(stage(page)).toContainText('current: 16.9 mA per cm²');
		await range(page, 'nm').fill('1200');
		await expect(stage(page)).toContainText('current: 0.0 mA per cm²');
	}
);

test('the ideal silicon cell: 43.8 mA/cm² at short circuit, 0.877 V open', async ({ page }) => {
	await open(page, './solar-cells/#iv');
	await expect(stage(page)).toContainText('Jsc 43.8 mA/cm²');
	await expect(stage(page)).toContainText('Voc 0.877 V');
	const handle = page.getByRole('slider', { name: 'Operating point (voltage)' });
	await handle.focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('short circuit: all the current, no voltage');
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('open circuit: no current flows');
	await expect(range(page, 'v')).toHaveValue('0.875');
});

test('more light: ten times the current, only 60 mV more voltage', async ({ page }) => {
	await open(page, './solar-cells/#voc');
	await range(page, 'suns').fill('1');
	await expect(stage(page)).toContainText('Jsc 438 mA/cm²');
	await expect(stage(page)).toContainText('Voc 0.936 V');
	await range(page, 'suns').fill('3');
	await expect(stage(page)).toContainText('Voc 1.055 V');
});

test('the maximum power point: 33.4 mW/cm² at 0.785 V, fill factor 87%', async ({ page }) => {
	await open(page, './solar-cells/#mpp');
	await range(page, 'v').fill('0.785');
	await expect(stage(page)).toContainText('power 33.4 mW per cm²');
	await expect(stage(page)).toContainText('fill factor 87.0%');
	await range(page, 'v').fill('0.5');
	await expect(stage(page)).toContainText('power 21.9 mW per cm²');
});

test('a hotter cell gives less', async ({ page }) => {
	await open(page, './solar-cells/#temperature');
	await range(page, 'temp').fill('50');
	await expect(stage(page)).toContainText('vs 25 °C: Voc −23 mV');
	await expect(stage(page)).toContainText('(32.2% efficient)');
});

test(
	'the band gap divides sunlight: 49% kept at silicon’s gap, 33.7% output at 1.34 eV',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './solar-cells/#gap');
		await expect(stage(page)).toContainText('kept: 49.0%');
		const handle = page.getByRole('slider', { name: 'Band gap' });
		await handle.focus();
		await page.keyboard.press('End');
		await expect(range(page, 'gap')).toHaveValue('3');
		// The gap keeps its value on the next step.
		await page.goto('./solar-cells/#slices');
		await expect(stage(page)).toContainText('efficiency 4.6%');
		await range(page, 'gap').fill('1.12');
		await expect(stage(page)).toContainText('efficiency 33.4%');
		await range(page, 'gap').fill('1.34');
		await expect(stage(page)).toContainText('efficiency 33.7%');
		await expect(stage(page)).toContainText('voltage loss');
	}
);

test('records sit below the single-junction limit; stacked junctions beat it', async ({ page }) => {
	await open(page, './solar-cells/#records');
	await expect(stage(page)).toContainText('33.7% at 1.34 eV');
	await expect(stage(page)).toContainText('silicon 28.1%');
	await expect(stage(page)).toContainText('gallium arsenide 29.1%');
	await expect(stage(page)).toContainText('47.6% 4 junctions, 665 suns');
});
