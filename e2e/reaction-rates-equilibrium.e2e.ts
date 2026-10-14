import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const button = (page: Page, id: string, value?: string) =>
	page.locator(`button[data-control=${id}]${value ? `[data-value="${value}"]` : ''}`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

// Reduced motion: each step shows a fixed moment of its run (the half-life, or
// equilibrium), and a change the reader makes shows its settled outcome.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('only one collision in trillions gets over the barrier, and heat grows that share', async ({
	page
}) => {
	await open(page, './reaction-rates-equilibrium/#share');
	await expect(stage(page)).toContainText('1 in 6 × 10¹²');
	await range(page, 'tShare').fill('710');
	await expect(stage(page)).toContainText('1.5 × as many as at 700 K');
});

test('twice the hydrogen, twice the starting rate', async ({ page }) => {
	await open(page, './reaction-rates-equilibrium/#concentration');
	await expect(stage(page)).toContainText('at the start: 4.8 µmol');
	await button(page, 'h2Start', '60').click();
	await expect(stage(page)).toContainText('at the start: 9.6 µmol');
	await button(page, 'h2Start', '15').click();
	await expect(stage(page)).toContainText('at the start: 2.4 µmol');
});

test('a catalyst cuts the half-life from half an hour to milliseconds', async ({ page }) => {
	await open(page, './reaction-rates-equilibrium/#catalyst');
	await expect(stage(page)).toContainText('half of the H₂ gone after 31 min');
	await range(page, 'lowering').fill('78');
	await expect(stage(page)).toContainText('half of the H₂ gone after 2.8 ms');
	await expect(stage(page)).toContainText('catalyst: 93');
});

test(
	'a catalyst reaches the same equilibrium, only sooner',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './reaction-rates-equilibrium/#catalysteq');
		await expect(stage(page)).toContainText('iodine in HI: 78 %');
		await expect(stage(page)).toContainText('time in the flask: 7 h 30 min');
		await toggle(page, 'gold').focus();
		await page.keyboard.press('Space');
		await expect(toggle(page, 'gold')).toBeChecked();
		await expect(stage(page)).toContainText('gold catalyst');
		await expect(stage(page)).toContainText('time in the flask: 45 ms');
		await expect(stage(page)).toContainText('iodine in HI: 78 %');
		await expect(stage(page)).toContainText('at equilibrium');
	}
);

test('the same balance is reached from pure hydrogen iodide', async ({ page }) => {
	await open(page, './reaction-rates-equilibrium/#fromhi');
	await expect(stage(page)).toContainText('iodine in HI: 78 %');
	await button(page, 'from', 'hi').click();
	await expect(stage(page)).toContainText('iodine in HI: 78 %');
	await expect(stage(page)).toContainText(/K =\s*52/);
});

test('added hydrogen shifts the balance towards HI; removing it shifts it back', async ({
	page
}) => {
	await open(page, './reaction-rates-equilibrium/#add');
	await expect(stage(page)).toContainText('iodine in HI: 78 %');
	await button(page, 'addH2').click();
	await expect(stage(page)).toContainText('iodine in HI: 87 %');
	await expect(stage(page)).toContainText('at equilibrium');
	await button(page, 'restart').click();
	await button(page, 'removeH2').click();
	await expect(stage(page)).toContainText('iodine in HI: 70 %');
});

test('heating this exothermic equilibrium lowers K and shifts it only a little', async ({
	page
}) => {
	await open(page, './reaction-rates-equilibrium/#heat');
	await expect(stage(page)).toContainText(/K =\s*52/);
	await range(page, 'tHeat').fill('780');
	await expect(stage(page)).toContainText('780 K (507 °C)');
	await expect(stage(page)).toContainText(/K =\s*42/);
	await expect(stage(page)).toContainText('iodine in HI: 76 %');
});
