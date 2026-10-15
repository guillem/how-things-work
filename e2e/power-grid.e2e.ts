import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
/** Switch a toggle off from the keyboard (a key press is queued even while the scene is busy). */
async function switchOff(page: Page, id: string) {
	await toggle(page, id).focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, id)).not.toBeChecked();
}

async function open(page: Page, url: string, reduced = true) {
	if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'losing the reference incident: the governors hold the frequency at a lowest point of 49.71 Hz',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './power-grid/#primary');
		await expect(stage(page)).toContainText('lowest 49.71 Hz');
		await expect(stage(page)).toContainText('49.83 Hz');
		// without governors the frequency keeps falling, to the edge of load shedding
		await switchOff(page, 'fcr');
		await expect(stage(page)).not.toContainText('lowest 49.71 Hz');
		await expect(stage(page)).toContainText('governors');
	}
);

test('more solar and wind, less spinning mass: the first fall is 3.5 times as steep', async ({
	page
}) => {
	await open(page, './power-grid/#inertia');
	await expect(stage(page)).toContainText('falling at first 0.071 Hz/s');
	await range(page, 'share').fill('80');
	await expect(stage(page)).toContainText('falling at first 0.250 Hz/s');
});

test('secondary control brings the frequency back to 50 Hz; without it, it stays low', async ({
	page
}) => {
	await open(page, './power-grid/#secondary');
	await expect(stage(page)).toContainText('50.00 Hz');
	await expect(stage(page)).toContainText('on target');
	await switchOff(page, 'afrr');
	await expect(stage(page)).toContainText('49.83 Hz');
});

test('a huge loss: load shedding saves the grid, and without it comes a blackout', async ({
	page
}) => {
	await open(page, './power-grid/#shedding');
	await expect(stage(page)).toContainText('22,500 MW of customers cut off');
	await switchOff(page, 'ufls');
	await expect(stage(page)).toContainText('blackout');
});

test('the real day: demand peaks at 31,333 MW at 9 p.m.; the mix reads off the hour', async ({
	page
}) => {
	await open(page, './power-grid/#demand');
	await expect(stage(page)).toContainText('peak 31,333 MW');
	await expect(stage(page)).toContainText('lowest 21,332 MW');
	await page.goto('./power-grid/#mix');
	await range(page, 'hour').fill('12');
	await expect(stage(page)).toContainText('Solar PV 15.8 GW');
	await expect(stage(page)).toContainText('Exports −4.2 GW');
});

test('the game: the day runs, and leaving the plants alone pushes the frequency out of the band', async ({
	page
}) => {
	await page.clock.install();
	await open(page, './power-grid/#dispatch', false);
	await expect(stage(page)).toContainText('03:0');
	await expect(stage(page)).toContainText('inside the band');
	// demand climbs from 6 a.m. while gas, hydro and storage stay put
	await playUntil(page, stage(page), 'MW of customers cut off', 60_000);
});

test('the autopilot follows the real plants through the evening ramp, inside the band', async ({
	page
}) => {
	await page.clock.install();
	await open(page, './power-grid/#dispatch', false);
	await range(page, 'start').fill('17');
	await page.locator('button[data-control=pilot][data-value=auto]').click();
	await playUntil(page, stage(page), '21:3', 40_000);
	await expect(stage(page)).toContainText('outside the band: 0 min');
	await expect(stage(page)).toContainText('customers cut off: 0 min');
});

test('tripping the reactor uses up the primary reserve: 49.81 Hz', async ({ page }) => {
	await open(page, './power-grid/#trip');
	await page.locator('button[data-control=pilot][data-value=auto]').click();
	await expect(stage(page)).toContainText('50.00 Hz');
	await page.locator('.action button[data-control=tripPlant]').click();
	await expect(stage(page)).toContainText('reactor tripped at 10:00');
	await expect(stage(page)).toContainText('49.81 Hz');
	await expect(stage(page)).toContainText(/primary reserve in use: 9\d\d of 1,000 MW/);
});

test('high voltage: 1,000 MW over 200 km loses 2.4% at 400 kV, 22% at 132 kV', async ({ page }) => {
	await open(page, './power-grid/#losses');
	await expect(stage(page)).toContainText('lost as heat: 24 MW (2.4%)');
	await page.locator('button[data-control=kv][data-value="132"]').click();
	await expect(stage(page)).toContainText('lost as heat: 216 MW (22%)');
	await expect(stage(page)).toContainText('these wires would overheat');
	await page.locator('button[data-control=kv][data-value="20"]').click();
	await expect(stage(page)).toContainText('more than half');
});
