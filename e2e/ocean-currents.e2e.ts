import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('the gyre squeezes against the west only when the Coriolis effect grows northwards', async ({
	page
}) => {
	await page.goto('./ocean-currents/#gulf-stream');
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
	await page.clock.install();
	await page.goto('./ocean-currents/#tipping');
	await expect(stage(page)).toContainText('17.0 Sv');
	await expect(stage(page)).toContainText('1.39 PW');
	await range(page, 'fresh').fill('2.5');
	// 25 model years a second: collapsed within a few hundred years
	await playUntil(page, stage(page), 'reversed, weak', 20_000);
	// …and the weather far away changes with it
	await expect(stage(page)).toContainText('colder winters');
});

test('a lull in the trade winds sets off an El Niño, then a La Niña', async ({ page }) => {
	await page.clock.install();
	await page.goto('./ocean-currents/#pacific');
	await expect(stage(page)).toContainText('193 → 47 m');
	await range(page, 'pacTrades').fill('0');
	await expect(stage(page)).toContainText('120 → 120 m');
	await page.goto('./ocean-currents/#el-nino');
	// the weather far away: drought in the west during El Niño, heavy rain there in La Niña
	await playUntil(page, stage(page), 'drought, bushfires', 10_000);
	await playUntil(page, stage(page), 'extra-heavy rain', 30_000);
});

test('without the Bjerknes feedback the lull brings only a brief warm spell, not an El Niño', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('./ocean-currents/#el-nino');
	// the frozen frame is the peak, with the weather far away
	await expect(stage(page)).toContainText('drought, bushfires');
	await range(page, 'feedback').fill('0');
	await expect(stage(page)).toContainText('brief warm spell');
	await expect(stage(page)).not.toContainText('drought, bushfires');
});
