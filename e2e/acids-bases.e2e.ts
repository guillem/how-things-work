import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const button = (page: Page, id: string, value?: string) =>
	page.locator(`button[data-control=${id}]${value ? `[data-value=${value}]` : ''}`);

// Reduced motion: no tweens, each step's finished picture.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('each step down the pH scale is ten times more H⁺ in the zoomed cube', async ({ page }) => {
	await open(page, './acids-bases/#ph');
	await range(page, 'ph').fill('7');
	await expect(stage(page)).toContainText('H⁺ (H₃O⁺): 60');
	await expect(stage(page)).toContainText('each dot is one ion');
	await range(page, 'ph').fill('6');
	await expect(stage(page)).toContainText('H⁺ (H₃O⁺): 600');
	await range(page, 'ph').fill('5');
	await expect(stage(page)).toContainText('H⁺ (H₃O⁺): 6 000');
	await expect(stage(page)).toContainText('each dot is 10 ions');
	await expect(stage(page)).toContainText('acidic');
});

test('a weak acid splits far less than a strong one at the same concentration', async ({
	page
}) => {
	await open(page, './acids-bases/#weak');
	await expect(stage(page)).toContainText('2.88');
	await button(page, 'acidD', 'hcl').click();
	await expect(stage(page)).toContainText('all of them');
	await expect(stage(page)).toContainText('1.00');
});

test('the scale compares a liquid with pure water in powers of ten', async ({ page }) => {
	await open(page, './acids-bases/#scale');
	await expect(stage(page)).toContainText('50 000 times as many H⁺ as pure water');
	await range(page, 'liquid').fill('12');
	await expect(stage(page)).toContainText('1 million times fewer H⁺ than pure water');
	// Clicking a liquid on the scale picks it too.
	await stage(page).getByRole('button', { name: 'Compare milk' }).click();
	await expect(stage(page)).toContainText('milk: pH 6.4–6.8');
});

test(
	'two drops around equivalence move the pH from 4 to 10',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './acids-bases/#jump');
		await expect(stage(page)).toContainText('24.85 mL');
		const drop = button(page, 'drop');
		await drop.click();
		await drop.click();
		await expect(stage(page)).toContainText('24.95 mL');
		await expect(stage(page)).toContainText('4.00');
		await drop.click();
		await expect(stage(page)).toContainText('equivalence: the base matches the acid');
		await expect(stage(page)).toContainText('7.00');
		await drop.click();
		await expect(stage(page)).toContainText('base in excess: 0.05 mL');
		await expect(stage(page)).toContainText('10.00');
	}
);

test('a weak acid reaches equivalence above pH 7', async ({ page }) => {
	await open(page, './acids-bases/#equivalence');
	await expect(stage(page)).toContainText('equivalence: pH 8.73');
	await button(page, 'acidEq', 'hcl').click();
	await expect(stage(page)).toContainText('equivalence: pH 7.00');
	await button(page, 'acidEq', 'hocl').click();
	await expect(stage(page)).toContainText('equivalence: pH 10.05');
});

test('methyl orange changes colour far too early for acetic acid', async ({ page }) => {
	await open(page, './acids-bases/#choose');
	await button(page, 'ml').click();
	await expect(stage(page)).toContainText('1.00 mL');
	await range(page, 'addedC').fill('10');
	// Half the dye has switched after about 2 mL, and all of it by 8 mL: 25 mL are needed.
	await expect(stage(page)).toContainText(/colour changed at [12]\.\d\d mL/);
	await expect(stage(page)).toContainText('colour: yellow');
	// Phenolphthalein turns at the equivalence point instead.
	await button(page, 'indicatorC', 'phenolphthalein').click();
	await expect(stage(page)).toContainText('colour: colourless');
	await range(page, 'addedC').fill('26');
	await expect(stage(page)).toContainText(/colour changed at 2[45]\.\d\d mL/);
	await expect(stage(page)).toContainText('colour: pink');
	// Emptying the flask starts again from nothing.
	await button(page, 'restart').click();
	await expect(stage(page)).toContainText('0.00 mL');
});
