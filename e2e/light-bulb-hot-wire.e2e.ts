import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('dimmer: turned up from off, the wire goes from cold to orange to white-hot', async ({
	page
}) => {
	await open(page, './light-bulb-hot-wire/#dimmer', 'Dimmer: off');
	await expect(stage(page)).toContainText('20 °C');
	await page.locator('input[type=range][data-control=up]').fill('0.2');
	await expect(stage(page)).toContainText('1,300 °C');
	await expect(stage(page)).toContainText('the wire glows orange');
	// The knob under the bulb is a slider too, and the panel's slider follows it.
	const knob = page.getByRole('slider', { name: 'Dimmer' });
	await knob.focus();
	await knob.press('End');
	await expect(stage(page)).toContainText('2,450 °C');
	await expect(stage(page)).toContainText('the wire glows white');
	await expect(page.locator('input[type=range][data-control=up]')).toHaveValue('1');
	await expect(page).toHaveURL(/#dimmer$/);
});

test('steep: at half the bulb takes a third of the electricity and gives 7% of the light', async ({
	page
}) => {
	await open(page, './light-bulb-hot-wire/#steep', 'Dimmer 50%: electricity 33%, light 7%');
	await page.locator('input[type=range][data-control=half]').fill('0.9');
	await expect(stage(page)).toContainText('Dimmer 90%: electricity 85%, light 69%');
});

test('split: at full, 1.1 W of light and 59 W of heat; dimmed, the light shrinks faster', async ({
	page
}) => {
	await open(page, './light-bulb-hot-wire/#split', 'Electricity in: 60 W');
	await expect(stage(page)).toContainText('light, to your eyes: 1.1 W');
	await expect(stage(page)).toContainText('heat: 59 W');
	await expect(stage(page)).toContainText('the heat is 54 times the light');
	await page.locator('input[type=range][data-control=level]').fill('0.5');
	await expect(stage(page)).toContainText('Electricity in: 20 W');
	await expect(stage(page)).toContainText('light, to your eyes: 0.1 W');
	await expect(stage(page)).toContainText('the heat is 257 times the light');
});

test('infrared: at full nine tenths of the glow is invisible infrared', async ({ page }) => {
	await open(page, './light-bulb-hot-wire/#infrared', 'the wire at 2,450 °C');
	await expect(stage(page)).toContainText('92%');
	await page.locator('input[type=range][data-control=glow]').fill('0.35');
	await expect(stage(page)).toContainText('the wire at 1,600 °C');
	await expect(stage(page)).toContainText('99%');
});

test('burn: with air let in, the hot wire burns and snaps', async ({ page }) => {
	await open(page, './light-bulb-hot-wire/#burn', 'No air inside the bulb');
	await page.locator('input[type=checkbox][data-control=air]').check();
	await expect(stage(page)).toContainText('The wire has snapped');
	await page.locator('input[type=checkbox][data-control=air]').uncheck();
	await expect(stage(page)).toContainText('No air inside the bulb');
});

test('led: the LED bulb gives the same light from 7.4 W, with a ninth of the heat', async ({
	page
}) => {
	await open(page, './light-bulb-hot-wire/#led', 'Old-style bulb: 60 W');
	await page.locator('[data-control=kind][data-value=led]').click();
	await expect(stage(page)).toContainText('LED bulb: 7.4 W');
	await expect(stage(page)).toContainText('light to your eyes 1.1 W · heat 6.3 W');
	await expect(stage(page)).toContainText('about 9 times smaller');
});
