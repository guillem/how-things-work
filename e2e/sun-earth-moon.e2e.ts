import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, text: string) {
	// Reduced motion freezes the scenes on one complete frame.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('day length: latitude and date change the daylight readout', async ({ page }) => {
	await open(page, './sun-earth-moon/#daylength', '40° N on 21 Jun: 14 h 51 min of daylight');
	await expect(stage(page)).toContainText('Sunrise 4:35 · sunset 19:25');
	await range(page, 'latitude').fill('0');
	await expect(stage(page)).toContainText('The equator on 21 Jun: 12 h of daylight');
	await expect(stage(page)).toContainText('Sunrise 6:00 · sunset 18:00');
	await range(page, 'day').fill('355');
	await expect(stage(page)).toContainText('The equator on 22 Dec: 12 h of daylight');
	await expect(stage(page)).toContainText('The southern half leans towards the Sun');
});

test('the latitude is kept when moving to the next step and back', async ({ page }) => {
	await open(page, './sun-earth-moon/#daylength', '40° N on 21 Jun');
	await range(page, 'latitude').fill('0');
	await expect(stage(page)).toContainText('The equator on 21 Jun');
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#angle$/);
	await expect(range(page, 'latitude')).toHaveValue('0');
	await expect(stage(page)).not.toContainText('40° N');
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page).toHaveURL(/#daylength$/);
	await expect(range(page, 'latitude')).toHaveValue('0');
	await expect(stage(page)).toContainText('The equator on 21 Jun: 12 h of daylight');
});

test('orbit: arrow keys on the date slider change the date, not the step', async ({ page }) => {
	await open(page, './sun-earth-moon/#orbit', '21 Jun');
	await range(page, 'day').focus();
	await page.keyboard.press('ArrowRight');
	await expect(range(page, 'day')).toHaveValue('172');
	await expect(stage(page)).toContainText('22 Jun');
	await expect(page).toHaveURL(/#orbit$/);
});

test('tilt: with no tilt there are no seasons', async ({ page }) => {
	await open(page, './sun-earth-moon/#tilt', 'Daily sunshine at 40° N with the axis tilted 23.4°');
	await expect(stage(page)).toContainText('Sunniest day ÷ darkest: 3.3×');
	// The June-solstice sketch and the chart footer agree on the day length
	// (recorded mismatch: the footer rounded the slider's 23.4° to 14 h 50 min
	// while the sketch used the exact 23.44° tilt for 14 h 51 min).
	await expect(stage(page)).toContainText('14 h 51 min of daylight');
	await expect(stage(page)).not.toContainText('14 h 50 min');
	await range(page, 'tilt').fill('0');
	await expect(stage(page)).toContainText('Daily sunshine at 40° N with no tilt');
	await expect(stage(page)).toContainText(
		'No seasons: every day like an equinox, with 12 hours of daylight everywhere'
	);
	await expect(stage(page)).toContainText(
		'21 Jun: 0.77 × the equator at an equinox · 12 h of daylight'
	);
});

test('phases: half a month after new Moon the Moon is full and eclipsed', async ({ page }) => {
	await open(page, './sun-earth-moon/#phases', 'Waxing crescent');
	await expect(stage(page)).toContainText('No eclipse now');
	await range(page, 'moon').fill('14.75');
	await expect(stage(page)).toContainText('Full Moon');
	await expect(stage(page)).toContainText('100% of the face lit');
	await expect(stage(page)).toContainText('14.8 days since new Moon');
	await expect(stage(page)).toContainText('Lunar eclipse');
	await expect(stage(page)).not.toContainText('No eclipse now');
});

test('tilt: the reader picks the date and sees the noon Sun at any tilt', async ({ page }) => {
	await open(page, './sun-earth-moon/#tilt', '21 Jun:');
	await range(page, 'day').fill('355');
	// 40° N at the December solstice: the noon Sun is 90 − 40 − 23.4 ≈ 27° high
	await expect(stage(page)).toContainText('22 Dec:');
	await expect(stage(page)).toContainText('noon Sun 27°');
	await range(page, 'tilt').fill('0');
	await expect(stage(page)).toContainText('noon Sun 50°');
});
