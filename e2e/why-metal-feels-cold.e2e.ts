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
	await expect(stage(page)).toContainText('28.2 °C at the skin');
	await expect(stage(page)).toContainText('32.6 °C at the skin');
	await room.fill('33');
	await expect(stage(page)).toContainText('same temperature: no heat flows');
	await expect(stage(page)).toContainText('33.0 °C at the skin');
	await room.fill('40');
	await expect(stage(page)).toContainText('heat enters the finger');
	await expect(stage(page)).toContainText('39.7 °C at the skin');
	await expect(stage(page)).toContainText('35.6 °C at the skin');
	await expect(stage(page)).toContainText('35.0 °C at the skin');
	await expect(stage(page)).toContainText('33.2 °C at the skin');
});

test('touch readouts remain readable on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await open(page, 'compare');
	await expect(page.getByText('Skin at the contact', { exact: true })).toBeVisible();
	await expect(page.getByRole('slider', { name: 'Move the finger' })).toBeVisible();
	await expect(page.getByText('all four read 20 °C', { exact: true })).toBeVisible();
	await expect(
		page.getByText('metal 100% · wood 39% · plastic 29% · wool 3%', { exact: true })
	).toBeVisible();
	await open(page, 'room');
	await page.locator('input[data-control="room"]').fill('40');
	for (const value of ['39.7', '35.6', '35.0', '33.2'])
		await expect(page.getByText(`${value} °C at the skin`, { exact: true })).toBeVisible();
});

test('dragging the finger with the pointer moves it onto another object', async ({ page }) => {
	await open(page, 'finger');
	const finger = page.getByRole('slider', { name: 'Move the finger' });
	const from = await finger.boundingBox();
	const cup = await stage(page).getByText('plastic cup', { exact: true }).boundingBox();
	if (!from || !cup) throw new Error('finger or cup not drawn');
	const y = from.y + from.height / 2;
	await page.mouse.move(from.x + from.width / 2, y);
	await page.mouse.down();
	await page.mouse.move(cup.x + cup.width / 2, y, { steps: 5 });
	await page.mouse.up();
	await expect(finger).toHaveAttribute('aria-valuetext', 'plastic cup');
	await expect(stage(page)).toContainText('Ideal first touch · pvc plastic');
});

test('the compare bars rank heat taken: metal, then wood, plastic and wool', async ({ page }) => {
	await open(page, 'compare');
	const share = async (object: string) => {
		const label = await stage(page)
			.getByRole('img', { name: new RegExp(`^${object}: `) })
			.getAttribute('aria-label');
		return Number(/(\d+)%/.exec(label ?? '')?.[1]);
	};
	const metal = await share('metal spoon');
	const wood = await share('wooden spoon');
	const plastic = await share('plastic cup');
	const wool = await share('woollen glove');
	expect(metal).toBe(100);
	expect(metal).toBeGreaterThan(wood);
	expect(wood).toBeGreaterThan(plastic);
	expect(plastic).toBeGreaterThan(wool);
});
