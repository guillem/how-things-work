import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('the gyre squeezes against the west only when the Coriolis effect grows northwards', async ({
	page
}) => {
	await page.goto('/ocean-currents/#gulf-stream');
	await expect(stage(page)).toContainText('20 Sv');
	await expect(stage(page)).toContainText('46× faster');
	await page.locator('button[data-control=spin][data-value=uniform]').click();
	await expect(stage(page)).toContainText('1.0× faster');
	await expect(stage(page)).toContainText('the same on both sides');
	// no wind, no gyre
	await page.locator('button[data-control=spin][data-value=earth]').click();
	await range(page, 'trades').fill('0');
	await range(page, 'westerlies').fill('0');
	await expect(stage(page)).toContainText('no wind to drive it');
});

test('freshening the far north past the tipping point collapses the overturning', async ({
	page
}) => {
	await page.goto('/ocean-currents/#tipping');
	await expect(stage(page)).toContainText('17.0 Sv');
	await expect(stage(page)).toContainText('1.39 PW');
	await range(page, 'fresh').fill('2.5');
	// 25 model years a second: collapsed within a few hundred years
	await expect(stage(page)).toContainText('reversed, weak', { timeout: 20_000 });
});

test('a lull in the trade winds sets off an El Niño, then a La Niña', async ({ page }) => {
	await page.goto('/ocean-currents/#pacific');
	await expect(stage(page)).toContainText('193 → 47 m');
	await range(page, 'pacTrades').fill('0');
	await expect(stage(page)).toContainText('120 → 120 m');
	await page.goto('/ocean-currents/#el-nino');
	// the weather far away: drought in the west during El Niño, heavy rain there in La Niña
	await expect(stage(page)).toContainText('drought, bushfires', { timeout: 10_000 });
	await expect(stage(page)).toContainText('extra-heavy rain', { timeout: 30_000 });
});
