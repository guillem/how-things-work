import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const control = (page: Page, id: string) => page.locator(`[data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

// Reduced motion: every wave has arrived at once (the whole ray fan is drawn).
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('triggered waves cross the planet: P reaches 90° in 13 minutes, the far side in 20', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./earthquakes/#trigger');
	await expect(stage(page)).toContainText('P reaches 90° round');
	await playUntil(page, stage(page), '12 min 59 s', 20_000);
	await playUntil(page, stage(page), '20 min 10 s', 20_000);
	await expect(page).toHaveURL(/#trigger$/);
});

test('S waves stop at the liquid core and leave a shadow beyond 100°', async ({ page }) => {
	await open(page, './earthquakes/#s-shadow');
	await expect(stage(page)).toContainText('S waves arrive from 0° to 100°');
	await expect(stage(page)).toContainText('no S from 100° to 180°');
});

test('without a solid inner core the P shadow zone goes silent', async ({ page }) => {
	await open(page, './earthquakes/#inner-core');
	await expect(stage(page)).toContainText('shadow zone: 100° – 143°');
	await expect(stage(page)).toContainText('faint waves from 115° on');
	await toggle(page, 'innerCore').focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, 'innerCore')).not.toBeChecked();
	await expect(stage(page)).toContainText('the shadow zone stays silent');
});

test('in an Earth of the same rock all through, the rays go straight and arrive later', async ({
	page
}) => {
	await open(page, './earthquakes/#bending');
	await expect(stage(page)).toContainText('12 min 59 s');
	await expect(stage(page)).toContainText('rays curved');
	await page.locator('[data-control=earth][data-value=uniform]').click();
	await expect(stage(page)).toContainText('25 min 52 s');
	await expect(stage(page)).toContainText('rays straight');
});

test('a liquid carries P waves but no S waves', async ({ page }) => {
	await open(page, './earthquakes/#waves');
	await expect(stage(page)).toContainText('S wave · 3.46 km/s');
	await page.locator('[data-control=medium][data-value=core]').click();
	await expect(stage(page)).toContainText('S wave · none');
	await expect(stage(page)).toContainText('no S wave in a liquid');
});

test('the seismometer: S lags further behind P with distance, and the shadow zone is silent', async ({
	page
}) => {
	await open(page, './earthquakes/#seismometer');
	await expect(stage(page)).toContainText('S comes 6 min 05 s after P');
	await control(page, 'station').fill('110');
	await expect(stage(page)).toContainText('Nothing arrives here: the shadow zone');
	// Drag it round with the keyboard, to the far side.
	await page.getByRole('slider', { name: 'Seismometer' }).focus();
	await page.keyboard.press('End');
	await expect(control(page, 'station')).toHaveValue('180');
	await expect(stage(page)).toContainText('P via the inner core');
	await expect(stage(page)).not.toContainText('S after');
});

test('S − P at Ankara gives its distance from the Nepal earthquake', async ({ page }) => {
	await open(page, './earthquakes/#s-minus-p');
	await expect(stage(page)).toContainText('5 min 00 s');
	await control(page, 'lagAnto').fill('392');
	await expect(stage(page)).toContainText('44° round the Earth: 4,891 km');
	// The S marker moves with the keyboard too.
	await page.getByRole('slider', { name: 'S arrival at Ankara' }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(control(page, 'lagAnto')).toHaveValue('393');
});

test('three S − P readings put the circles together over Nepal', async ({ page }) => {
	await open(page, './earthquakes/#locate');
	await expect(stage(page)).toContainText('Where do the three circles meet?');
	// The S waves as read on the three real seismograms.
	await control(page, 'lagAnto').fill('392');
	await control(page, 'lagTato').fill('316');
	await control(page, 'lagDgar').fill('347');
	await expect(stage(page)).toContainText('They meet: the epicentre, in Nepal');
	await expect(stage(page)).toContainText('km from the USGS location');
});

test('two steps of magnitude are 1,000 times the energy', async ({ page }) => {
	await open(page, './earthquakes/#magnitude');
	await expect(stage(page)).toContainText('M 7.8 releases 1,000 times the energy of M 5.8');
	await expect(stage(page)).toContainText('7.6 million tonnes of TNT');
	await control(page, 'magB').fill('6.8');
	await expect(stage(page)).toContainText('releases 32 times the energy of M 6.8');
	await expect(stage(page)).toContainText('10 times bigger');
});
