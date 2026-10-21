import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('lowering the stone: the balance drops by the water that spills', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#lower', 'balance: 324 g');
	await expect(stage(page)).toContainText('in the cup: 0 g');
	const slider = page.locator('input[type=range][data-control=lower]');
	await slider.focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('balance: 204 g');
	await expect(stage(page)).toContainText('in the cup: 120 g');
	// Pulled back out, the stone weighs its full weight again and the spilled water stays spilled.
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('balance: 324 g');
	await expect(stage(page)).toContainText('in the cup: 120 g');
});

test('sink or float: the apple floats and spills its own weight', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#objects', 'stone: sinks');
	await page.getByRole('radio', { name: 'an apple' }).click();
	await expect(stage(page)).toContainText('apple: floats');
	await expect(stage(page)).toContainText('balance: 0 g');
	await expect(stage(page)).toContainText('in the cup: 184 g');
});

test('the same clay sinks as a ball and floats as a bowl', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#bowl', 'clay ball');
	await expect(stage(page)).toContainText('98 g · sinks');
	await page.locator('input[type=checkbox][data-control=bowl]').check();
	await expect(stage(page)).toContainText('clay bowl');
	await expect(stage(page)).toContainText('98 g · floats');
});

test('the eighteenth marble sinks the bowl', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#marbles', 'bowl and 0 marbles');
	const slider = page.locator('input[type=range][data-control=marbles]');
	await slider.fill('17');
	await expect(stage(page)).toContainText('bowl and 17 marbles: 189 g · floats');
	await slider.fill('18');
	await expect(stage(page)).toContainText('bowl and 18 marbles: 195 g · sinks');
});

test('an egg sinks in water and floats in very salty water', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#liquids', 'in water');
	await expect(stage(page)).toContainText('61 g · sinks');
	await page.getByRole('radio', { name: 'very salty water' }).click();
	await expect(stage(page)).toContainText('in salty water');
	await expect(stage(page)).toContainText('61 g · floats');
});

test('the balloon lifts off once the air inside is hot enough', async ({ page }) => {
	await open(page, './floating-sinking-and-boats/#balloon', 'heavier: it stays down');
	const slider = page.locator('input[type=range][data-control=heat]');
	await slider.fill('80');
	await expect(stage(page)).toContainText('heavier: it stays down');
	await slider.fill('90');
	await expect(stage(page)).toContainText('lighter: it rises');
});
