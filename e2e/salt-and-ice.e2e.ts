import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('salt melts ice on the path while the thermometer stays at −5 °C', async ({ page }) => {
	await open(page, './salt-and-ice/#road', 'no salt: the ice stays hard');
	await expect(stage(page)).toContainText('ice melted: 0 g of 500 g');
	const slider = page.locator('input[type=range][data-control=spoons]');
	await slider.fill('1');
	await expect(stage(page)).toContainText('ice melted: 210 g of 500 g');
	await expect(stage(page)).toContainText('−5 °C');
	// Three spoonfuls melt the whole patch, and a fourth has nothing left to melt.
	await slider.fill('3');
	await expect(stage(page)).toContainText('all the ice has melted');
	await slider.fill('4');
	await expect(stage(page)).toContainText('ice melted: 500 g of 500 g');
});

test('below about −21 °C the salt melts nothing', async ({ page }) => {
	await open(page, './salt-and-ice/#weather', 'ice melted: 421 g of 500 g');
	const slider = page.locator('input[type=range][data-control=weather]');
	await slider.fill('-15');
	await expect(stage(page)).toContainText('ice melted: 155 g of 500 g');
	await slider.fill('-21');
	await expect(stage(page)).toContainText('ice melted: 119 g of 500 g');
	await slider.fill('-22');
	await expect(stage(page)).toContainText('too cold: the salt does nothing');
	await expect(stage(page)).toContainText('ice melted: 0 g of 500 g');
});

test('plain ice freezes below 0 °C and melts above it', async ({ page }) => {
	await open(page, './salt-and-ice/#stack', 'just as many join as break off');
	const slider = page.locator('input[type=range][data-control=water]');
	await slider.fill('-3');
	await expect(stage(page)).toContainText('joining wins: the water freezes');
	await slider.fill('3');
	await expect(stage(page)).toContainText('breaking off wins: the ice melts');
});

test('salt melts the ice at −5 °C until the water is just salty enough', async ({ page }) => {
	await open(page, './salt-and-ice/#salt', 'at −5 °C it all stays ice');
	await page.locator('input[type=checkbox][data-control=salted]').check();
	await expect(stage(page)).toContainText('balanced again: the melting stops');
	await expect(stage(page)).toContainText('8 g of salt in 100 g');
	await expect(stage(page)).toContainText('freezes at −5 °C');
});

test('the freezing line bottoms out at −21 °C', async ({ page }) => {
	await open(page, './salt-and-ice/#curve', 'freezes at 0 °C');
	const slider = page.locator('input[type=range][data-control=saltiness]');
	await slider.fill('10');
	await expect(stage(page)).toContainText('freezes at −7 °C');
	await slider.fill('26');
	await expect(stage(page)).toContainText('freezes at −21 °C');
	await expect(stage(page)).toContainText('extra salt comes out');
});

test('a spoonful of salt cools a bowl of ice; more than two cannot go below −21 °C', async ({
	page
}) => {
	await open(page, './salt-and-ice/#bowl', 'bowl: 0 °C');
	const slider = page.locator('input[type=range][data-control=bowlSalt]');
	await slider.fill('1');
	await expect(stage(page)).toContainText('bowl: −18 °C');
	await expect(stage(page)).toContainText('66 g of 500 g');
	await slider.fill('2');
	await expect(stage(page)).toContainText('bowl: −21 °C');
	await slider.fill('8');
	await expect(stage(page)).toContainText('bowl: −21 °C');
});

test('salt and ice freeze the cream in about five minutes; plain ice leaves it runny', async ({
	page
}) => {
	// Reduced motion shows the end of the ten minutes.
	await open(page, './salt-and-ice/#cream', 'soft ice cream');
	await expect(stage(page)).toContainText('frozen after 5 min');
	await page.getByRole('radio', { name: 'plain ice' }).click();
	await expect(stage(page)).toContainText('runny');
	await expect(stage(page)).toContainText('bowl: 0 °C');
	await expect(stage(page)).toContainText('cream: 0 °C');
	await page.getByRole('radio', { name: 'ice and 1 spoonful of salt' }).click();
	await expect(stage(page)).toContainText('frozen after 10 min');
});
