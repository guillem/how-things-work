// Phone readouts (<Readout>, src/lib/explainer/readouts.svelte.ts): on screens
// ≤ 640 px a converted scene's readouts leave the drawing, where they would be
// ~5 px tall, and are listed as text under the stage. Wider screens keep them
// on the stage.
import { expect, test, type Page } from '@playwright/test';

const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });
const drawing = (page: Page) => page.locator('.stage svg');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });

	test('epidemics: the peak readouts are text under the stage and follow R₀', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		const panel = readouts(page);
		await expect(panel).toContainText('Effective R now');
		await expect(panel).toContainText(/Day\s*\d+/);
		await expect(panel).toContainText(/1\/R₀\s*33%/);
		await expect(drawing(page)).not.toContainText('Effective R');
		await expect(drawing(page)).not.toContainText(/Day \d+/);
		// Below the stage, not over it.
		const stageBox = (await page.locator('.stage').boundingBox())!;
		const panelBox = (await panel.boundingBox())!;
		expect(panelBox.y).toBeGreaterThanOrEqual(stageBox.y + stageBox.height - 1);

		await range(page, 'r0').fill('2');
		await expect(panel).toContainText(/1\/R₀\s*50%/);
	});

	test('photosynthesis: the lumen pH is text under the stage and follows the light', async ({
		page
	}) => {
		await page.goto('./photosynthesis/#atp');
		const panel = readouts(page);
		await expect(panel).toContainText(/Thylakoid lumen\s*pH ≈ 6\.2/);
		await expect(panel).toContainText(/Stroma\s*pH ≈ 8/);
		await expect(panel).toContainText('ATP synthase');
		await expect(drawing(page)).not.toContainText('pH ≈');

		await range(page, 'light').fill('0');
		await expect(panel).toContainText(/Thylakoid lumen\s*pH ≈ 8\.0/);
	});

	test('keyboard step changes update the list', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		await expect(readouts(page)).toContainText('Effective R now');
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#overshoot$/);
		await expect(readouts(page)).toContainText(/Peak\s*day \d+/);
		await expect(readouts(page)).not.toContainText('Effective R now');
		// A scene without readouts shows no list.
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#chance$/);
		await expect(readouts(page)).toHaveCount(0);
	});
});

test.describe('on a wide screen', () => {
	test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

	test('the readouts stay on the stage and there is no list', async ({ page }) => {
		await page.goto('./epidemics/#peak');
		await expect(drawing(page)).toContainText(/Day \d+/);
		await expect(drawing(page)).toContainText(/R = \d\.\d\d now: cases/);
		await page.goto('./photosynthesis/#atp');
		await expect(drawing(page)).toContainText('thylakoid lumen · pH ≈ 6.2');
		await expect(readouts(page)).toHaveCount(0);
	});
});
