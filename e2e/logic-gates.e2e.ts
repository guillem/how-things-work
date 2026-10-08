import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

/** Turns a switch on (clicking it only if it is off). */
async function switchOn(page: Page, label: string) {
	const sw = page.getByRole('switch', { name: `Switch ${label}` });
	if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
	await expect(sw).toHaveAttribute('aria-checked', 'true');
}

test('turning both inputs of an AND gate on lights the lamp', async ({ page }) => {
	await page.goto('/logic-gates/#gates');
	await expect(stage(page)).toContainText('Out = A AND B');
	await switchOn(page, 'A');
	await switchOn(page, 'B');
	await expect(page.getByRole('img', { name: 'Lamp Out: on' })).toBeVisible();
	await expect(stage(page)).toContainText('Out = 1');
});

test('the 4-bit adder adds 11 + 6 = 17', async ({ page }) => {
	await page.goto('/logic-gates/#four');
	await expect(stage(page)).toContainText('11 + 6 = 17');
	await expect(stage(page)).toContainText('1011 + 0110 = 10001 in binary');
});
