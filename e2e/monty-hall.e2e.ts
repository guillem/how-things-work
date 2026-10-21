import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('play: pick a door, the host shows a goat, switch, and the game is counted', async ({
	page
}) => {
	await open(page, './monty-hall/#play', 'Pick a door');
	const door = (n: number) => stage(page).getByRole('button', { name: `Door ${n}` });
	await door(1).click();
	await expect(stage(page)).toContainText('a goat! Stay with door 1 or switch to door');
	// Switch: the message names the door to switch to.
	const text = (await stage(page).textContent()) ?? '';
	const other = Number(/switch to door (\d)/.exec(text)?.[1]);
	await door(other).click();
	await expect(stage(page)).toContainText('You switched and won');
	await expect(stage(page)).toContainText(/Switched\s*[01] cars? in 1 game\b/);
	// Keyboard: a new game, picking with Enter.
	await door(2).click();
	await expect(stage(page)).toContainText('Pick a door');
	await door(3).focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('Stay with door 3');
	// "New game" abandons it; the tally keeps the one finished game.
	await page.getByRole('button', { name: 'New game' }).click();
	await expect(stage(page)).toContainText('Pick a door');
	await expect(stage(page)).toContainText(/Switched\s*[01] cars? in 1 game\b/);
});

test('tally: over 300 games each, switching wins about twice as often', async ({ page }) => {
	await open(page, './monty-hall/#tally', 'Always switch');
	await page.locator('input[type=range][data-control=games]').fill('300');
	const text = (await stage(page).textContent()) ?? '';
	const stay = Number(/(\d+) cars in 300 games/.exec(text)?.[1]);
	const sw = Number(/Always switch\s*(\d+) cars in 300 games/.exec(text)?.[1]);
	expect(stay).toBeGreaterThan(80);
	expect(stay).toBeLessThan(120);
	expect(sw).toBeGreaterThan(180);
	expect(sw).toBeLessThan(220);
});

test('cases: whichever door you pick, staying wins one row and switching two', async ({ page }) => {
	await open(page, './monty-hall/#cases', 'Staying wins in 1 row, switching in 2');
	for (const n of [1, 2, 3]) {
		await page.getByRole('radio', { name: `Door ${n}` }).click();
		await expect(stage(page).getByText('Stay: you win the car')).toHaveCount(1);
		await expect(stage(page).getByText(/^Switch to door \d: you win the car$/)).toHaveCount(2);
	}
});

test('ten doors: the host opens eight; three doors: back to the classic game', async ({ page }) => {
	await open(page, './monty-hall/#ten', '10 doors: you pick one, the host opens 8 goat doors');
	await page.locator('input[type=range][data-control=doors]').fill('3');
	await expect(stage(page)).toContainText('3 doors: you pick one, the host opens 1 goat door');
});

test('random host: a third of games spoiled, the rest about even', async ({ page }) => {
	await open(page, './monty-hall/#random', 'The host knows where the car is');
	await page.locator('input[type=checkbox][data-control=knows]').uncheck();
	await expect(stage(page)).toContainText('The host opens a door at random');
	await expect(stage(page)).toContainText('games with a goat shown: about even');
});
