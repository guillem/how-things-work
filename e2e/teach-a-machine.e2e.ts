import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its text.
	await expect(stage(page)).toContainText(text);
}

/** Draws a line on the pad with the mouse, between two points given in percent of the pad. */
async function draw(page: Page, from: [number, number], to: [number, number]) {
	const box = await stage(page).locator('[data-pad]').boundingBox();
	if (!box) throw new Error('no pad');
	const at = ([x, y]: [number, number]) =>
		[box.x + (box.width * x) / 100, box.y + (box.height * y) / 100] as const;
	await page.mouse.move(...at(from));
	await page.mouse.down();
	await page.mouse.move(...at(to), { steps: 12 });
	await page.mouse.up();
}

test('pile: sixteen labelled drawings', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './teach-a-machine/#pile', '16 drawings, each with its label');
	await expect(stage(page)).toContainText('8 cats and 8 houses');
});

test('squares: a ready cat inks 33 squares; a line drawn across the pad inks a row of 10', async ({
	page
}) => {
	await open(page, './teach-a-machine/#squares', 'squares inked');
	await expect(stage(page)).toContainText('33');
	await page.locator('button[data-control=doodle][data-value=house]').click();
	await expect(stage(page)).not.toContainText('33');
	// Drawing over a ready drawing starts the reader's own.
	await draw(page, [3, 55], [97, 55]);
	await expect(page.locator('button[data-control=doodle][data-value=mine]')).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(stage(page)).toContainText('10squares inked');
	await stage(page).locator('[data-button=clear]').click();
	await expect(stage(page)).toContainText('Draw here');
});

test('compare: a stored cat differs in 7 squares, the sitting cat in 33', async ({ page }) => {
	await open(page, './teach-a-machine/#compare', 'squares differ');
	await expect(stage(page)).toContainText('7squares differ');
	await page.locator('button[data-control=against][data-value=sitting]').click();
	await expect(stage(page)).toContainText('33squares differ');
	await page.locator('button[data-control=against][data-value=long]').click();
	await expect(stage(page)).toContainText('32squares differ');
});

test('vote: the three nearest vote cat for the cat, house for the house', async ({ page }) => {
	await open(page, './teach-a-machine/#vote', 'It says: cat');
	await expect(stage(page)).toContainText('Nearest three: 3 cats, 0 houses');
	await page.locator('button[data-control=doodle][data-value=chimney]').click();
	await expect(stage(page)).toContainText('It says: house');
});

test('few: one example of each gets 5 of 8 right, eight of each all 8', async ({ page }) => {
	await open(page, './teach-a-machine/#few', 'Right: 5 of 8');
	await page.locator('input[data-control=examples]').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('Right: 8 of 8');
	await expect(stage(page)).toContainText('8 cats and 8 houses');
});

test('teach: with the keyboard, teach it a cat and a house, then it guesses', async ({ page }) => {
	await open(page, './teach-a-machine/#teach', 'What you taught it: nothing yet');
	await page.locator('button[data-control=ready][data-value=cat]').click();
	await expect(stage(page)).toContainText('It has nothing to compare with yet');
	await stage(page).locator('[data-button=cat]').focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('What you taught it: 1 cat, 0 houses');
	// Labelling empties the pad.
	await expect(stage(page)).toContainText('Draw something');
	await page.locator('button[data-control=ready][data-value=house]').click();
	await stage(page).locator('[data-button=house]').focus();
	await page.keyboard.press(' ');
	await expect(stage(page)).toContainText('What you taught it: 1 cat, 1 house');
	// A new cat: with only two drawings stored, the nearer one decides.
	await page.locator('button[data-control=ready][data-value=round]').click();
	await expect(stage(page)).toContainText('Its nearest drawing is a');
	await stage(page).locator('[data-button=forget]').click();
	await expect(stage(page)).toContainText('What you taught it: nothing yet');
});

test('trap: a cat drawn low is called a house, until cats drawn low join the pile', async ({
	page
}) => {
	await open(page, './teach-a-machine/#trap', 'It says: house');
	await expect(stage(page)).toContainText('Nearest three: 0 cats, 3 houses');
	await page.locator('button[data-control=trial][data-value=houseHigh]').click();
	await expect(stage(page)).toContainText('It says: cat');

	await page.locator('button[data-control=trial][data-value=catLow]').click();
	await expect(stage(page)).toContainText('It says: house');

	await page.goto('./teach-a-machine/#varied');
	await expect(stage(page)).toContainText('It says: house');
	await page.locator('input[type=checkbox][data-control=mixed]').check();
	await expect(stage(page)).toContainText('It says: cat');
	await expect(stage(page)).toContainText('Nearest three: 2 cats, 1 house');
});

test('fish: something new still gets one of the two labels it knows', async ({ page }) => {
	await open(page, './teach-a-machine/#fish', 'It says: cat');
	await expect(stage(page)).toContainText('It only knows two labels');
});
