import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its finished, frozen frame.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const button = (page: Page, id: string) => page.locator(`button[data-control=${id}]`).first();
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'NGC 3198 turns at 149 km/s at 44 kpc, where Kepler and the visible mass give 57',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './dark-matter/#curve');
		await expect(stage(page)).toContainText('149 km/s');
		await expect(stage(page)).toContainText('57 km/s');
		await expect(stage(page)).toContainText('= 6.8 ×');
	}
);

test('the outer stars should take 4.2 billion years to go round; they take 1.8', async ({
	page
}) => {
	await open(page, './dark-matter/#expect');
	await expect(stage(page)).toContainText('edge: 65 km/s · one turn in 4.2 billion years');
	await expect(stage(page)).toContainText('edge: 149 km/s · one turn in 1.8 billion years');
});

test('no amount of stars fits the curve without a halo', async ({ page }) => {
	await open(page, './dark-matter/#visible');
	await expect(stage(page)).toContainText(/χ² per point\s*777/);
	await range(page, 'ml').fill('1.2');
	await expect(stage(page)).toContainText(/χ² per point\s*245/);
	await expect(stage(page)).toContainText('a poor fit');
});

test(
	'the best halo fits NGC 3198 with about 5.6 times the visible mass',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './dark-matter/#halo');
		await expect(stage(page)).toContainText('a poor fit');
		await button(page, 'fitHalo').click();
		await expect(stage(page)).toContainText('fits within the errors');
		await expect(stage(page)).toContainText('5.6 ×');
		await expect(range(page, 'ratio')).toHaveValue('5.6');
	}
);

test('the halo handle on the chart moves the halo-mass slider', async ({ page }) => {
	await open(page, './dark-matter/#halo');
	const handle = page.getByRole('slider', { name: 'Mass of the dark halo' });
	await handle.focus();
	await page.keyboard.press('ArrowUp');
	await page.keyboard.press('ArrowUp');
	await expect(range(page, 'ratio')).toHaveValue('0.2');
	await page.keyboard.press('End');
	await expect(range(page, 'ratio')).toHaveValue('20');
});

test('the dwarf DDO 154 needs a halo nearly eight times its gas and stars', async ({ page }) => {
	await open(page, './dark-matter/#others');
	await choose(page, 'galaxy', 'DDO154');
	await expect(stage(page)).toContainText('DDO 154: rotation curve');
	await button(page, 'fitHalo').click();
	await expect(stage(page)).toContainText('7.8 ×');
});

test('Bullet Cluster: visible matter alone is too light and peaks on the gas', async ({ page }) => {
	await open(page, './dark-matter/#lensing');
	await expect(stage(page)).toContainText('too light for the lensing');
	await expect(stage(page)).toContainText(/mass peaks\s*on the gas/);
	await range(page, 'dark').fill('77');
	await expect(stage(page)).toContainText('matches the lensing');
	await expect(stage(page)).toContainText(/your model’s mass peaks\s*on the galaxies/);
	await expect(stage(page)).toContainText('5.4 ×');
});

test('three measurements agree: about five times more dark than visible matter', async ({
	page
}) => {
	await open(page, './dark-matter/#budget');
	for (const r of ['5.6 ×', '5.3 ×', '5.4 ×', '26.4%', '4.9%']) {
		await expect(stage(page)).toContainText(r);
	}
});
