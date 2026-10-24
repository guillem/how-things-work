import { expect, test, type Page } from '@playwright/test';
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
async function open(page: Page, step: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`./why-metal-feels-cold/#${step}`);
	await expect(stage(page)).toBeVisible();
}

test('equal thermometers but different first-touch skin temperatures; keyboard moves the finger', async ({
	page
}) => {
	await open(page, 'finger');
	await expect(stage(page)).toContainText('20.6 °C at the skin');
	const finger = page.getByRole('slider', { name: 'Move the finger' });
	await finger.focus();
	await finger.press('ArrowRight');
	await expect(finger).toHaveAttribute('aria-valuetext', 'wooden spoon');
	await expect(stage(page)).toContainText('28.2 °C at the skin');
	await finger.press('End');
	await expect(stage(page)).toContainText('32.6 °C at the skin');
	await expect(stage(page).getByText('20 °C', { exact: true })).toHaveCount(4);
});

test('warming the room through hand temperature stops then reverses the heat', async ({ page }) => {
	await open(page, 'room');
	const room = page.locator('input[data-control="room"]');
	await room.fill('33');
	await expect(stage(page)).toContainText('same temperature: no heat flows');
	await expect(stage(page)).toContainText('33.0 °C at the skin');
	await room.fill('40');
	await expect(stage(page)).toContainText('heat enters the finger');
	await expect(stage(page)).toContainText('39.7 °C at the skin');
});

test('touch readouts remain readable on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, 'compare');
	await expect(page.getByText('Skin at the contact', { exact: true })).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Move the finger' })).toBeVisible();
});
