import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

/** Turns a switch on (clicking it only if it is off). */
async function switchOn(page: Page, label: string) {
	const sw = page.getByRole('switch', { name: `Switch ${label}` });
	if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
	await expect(sw).toHaveAttribute('aria-checked', 'true');
}

test('turning both inputs of an AND gate on lights the lamp', async ({ page }) => {
	await page.goto('./logic-gates/#gates');
	await expect(stage(page)).toContainText('Out = A AND B');
	await switchOn(page, 'A');
	await switchOn(page, 'B');
	await expect(page.getByRole('img', { name: 'Lamp Out: on' })).toBeVisible();
	await expect(stage(page)).toContainText('Out = 1');
});

test('the 4-bit adder adds 11 + 6 = 17', async ({ page }) => {
	await page.goto('./logic-gates/#four');
	await expect(stage(page)).toContainText('11 + 6 = 17');
	await expect(stage(page)).toContainText('1011 + 0110 = 10001 in binary');
});

test('switching the challenge clears a canvas message', async ({ page }) => {
	await page.goto('./logic-gates/#build');
	await expect(page.getByRole('switch', { name: 'Switch A' })).toBeAttached();
	// Click empty canvas near switch A: too close to it to add a gate.
	const box = await page.locator('.stage svg').boundingBox();
	if (!box) throw new Error('stage not drawn');
	await page.mouse.click(box.x + (130 / 960) * box.width, box.y + (210 / 600) * box.height);
	await expect(stage(page)).toContainText('Too close to another part');
	await page.locator('button[data-control=challenge][data-value=half]').click();
	await expect(stage(page)).toContainText('Sum = 0');
	await expect(stage(page)).not.toContainText('Too close to another part');
});
