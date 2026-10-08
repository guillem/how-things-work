import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slot = (page: Page, pegs: string) =>
	page.getByRole('button', { name: new RegExp(`between pegs ${pegs}\\b`) });
const tool = (page: Page, value: string) =>
	page.locator(`button[data-control=part][data-value=${value}]`).click();

async function open(page: Page, hash: string) {
	await page.goto(`/electric-circuits/#${hash}`);
	await expect(page.getByRole('button', { name: /^Battery/ }).first()).toBeAttached();
}

test('clicking the switch opens the loop: no current, and the toggle follows', async ({ page }) => {
	await open(page, 'loop');
	await expect(stage(page)).toContainText('0.50 A');
	await page.getByRole('button', { name: /^Switch \(closed\)/ }).click();
	await expect(stage(page)).toContainText('0.00 A');
	await expect(stage(page)).toContainText('Switch open');
	await expect(page.locator('input[type=checkbox][data-control=closed]')).not.toBeChecked();
	// And back with the toggle.
	await page.locator('input[type=checkbox][data-control=closed]').check({ force: true });
	await expect(stage(page)).toContainText('0.50 A');
});

test('each bulb in the house wiring has its own switch', async ({ page }) => {
	await open(page, 'switches');
	await page
		.getByRole('button', { name: /^Switch \(closed\)/ })
		.first()
		.click();
	await expect(page.locator('input[type=checkbox][data-control=s1]')).not.toBeChecked();
	await expect(page.locator('input[type=checkbox][data-control=s2]')).toBeChecked();
	await expect(stage(page)).toContainText('left bulb: off');
	await expect(stage(page)).toContainText('right bulb: lit');
});

test('every ammeter in the loop reads the same current', async ({ page }) => {
	await open(page, 'current');
	const ammeters = page.getByRole('button', { name: /^Ammeter/ });
	await expect(ammeters).toHaveCount(3);
	for (const a of await ammeters.all())
		await expect(a).toHaveAttribute('aria-label', /0\.50 A through/);
});

test('a second bulb in series halves the current on the build board', async ({ page }) => {
	await open(page, 'build');
	await expect(stage(page)).toContainText('current from the battery');
	await expect(stage(page)).toContainText('0.50 A');
	await tool(page, 'bulb');
	await slot(page, 'C2 and D2').click();
	await expect(stage(page)).toContainText('0.25 A');
	await expect(slot(page, 'C2 and D2')).toHaveAttribute('aria-label', /^Bulb/);
	await expect(stage(page)).toContainText('2 of 2');
});

test('the eraser breaks the loop, and "Start again" restores it', async ({ page }) => {
	await open(page, 'build');
	await tool(page, 'erase');
	await slot(page, 'C2 and D2').click();
	await expect(slot(page, 'C2 and D2')).toHaveAttribute('aria-label', /^Gap between pegs/);
	await expect(stage(page)).toContainText('No complete loop');
	await expect(stage(page)).toContainText('0.00 A');
	await page.locator('.action button[data-control=resetBoard]').click();
	await expect(stage(page)).toContainText('0.50 A');
	await expect(slot(page, 'C2 and D2')).toHaveAttribute('aria-label', /^Wire/);
});

test('parts can be placed with the keyboard without leaving the step', async ({ page }) => {
	await open(page, 'build');
	await tool(page, 'wire');
	// A branch across the loop through E2–E3–E4, with a bulb on its lower half: parallel.
	await slot(page, 'E2 and E3').focus();
	await page.keyboard.press('Enter');
	await tool(page, 'bulb');
	await slot(page, 'E3 and E4').focus();
	await page.keyboard.press(' ');
	await expect(slot(page, 'E3 and E4')).toHaveAttribute('aria-label', /^Bulb/);
	await expect(stage(page)).toContainText('1.00 A');
	await expect(page).toHaveURL(/#build$/);
});

test('a switch flips and a battery turns round when clicked on the build board', async ({
	page
}) => {
	await open(page, 'build');
	await tool(page, 'switch');
	await slot(page, 'C2 and D2').click();
	await expect(slot(page, 'C2 and D2')).toHaveAttribute('aria-label', /^Switch \(closed\)/);
	await slot(page, 'C2 and D2').click();
	await expect(slot(page, 'C2 and D2')).toHaveAttribute('aria-label', /^Switch \(open\)/);
	await expect(stage(page)).toContainText('0.00 A');
	// With the switch tool still selected, a battery turns round rather than being replaced.
	const battery = page.getByRole('button', { name: /^Battery/ });
	await expect(battery).toHaveAttribute('aria-label', /Activate to turn the battery round/);
	await battery.click();
	await expect(battery).toHaveCount(1);
});

test('a wire straight across the battery is a short circuit', async ({ page }) => {
	await open(page, 'build');
	await tool(page, 'wire');
	for (const pegs of ['A2 and B2', 'A2 and A3', 'A3 and B3']) await slot(page, pegs).click();
	await expect(stage(page)).toContainText('Short circuit!');
	await expect(stage(page)).toContainText('0 of 1');
});
