import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

// Reduced motion shows each run finished: the cursor has reached the end.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'weathering balances the volcanoes at 280 ppm: more CO₂ falls, less climbs',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './carbonate-silicate-thermostat/#balance');
		await expect(stage(page)).toContainText('560 ppm · 18 °C');
		await expect(stage(page)).toContainText('CO₂ falls');
		await slider(page, 'co2').fill('-1');
		await expect(stage(page)).toContainText('140 ppm · 12 °C');
		await expect(stage(page)).toContainText('CO₂ rises');
		await slider(page, 'co2').fill('0');
		await expect(stage(page)).toContainText('280 ppm · 15 °C');
		await expect(stage(page)).toContainText('CO₂ in balance');
	}
);

test('knocked off balance, the CO₂ returns to 280 ppm within a few million years', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#pulse');
	await expect(stage(page)).toContainText('3.0 million years');
	await expect(stage(page)).toContainText('average 15 °C');
	// from twice the CO₂, back to within a few percent of 280 ppm, from above
	const high = await finalPPM(page);
	expect(high).toBeGreaterThan(280);
	expect(high).toBeLessThan(295);
	// from half, back from below
	await slider(page, 'start').fill('-1');
	await expect(stage(page)).toContainText('CO₂ 2');
	const low = await finalPPM(page);
	expect(low).toBeLessThan(280);
	expect(low).toBeGreaterThan(265);
});

/** The CO₂ the run reports at its end, in ppm. */
async function finalPPM(page: Page) {
	const text = (await stage(page).textContent()) ?? '';
	const m = /CO₂ (\d+) ppm/.exec(text);
	expect(m, 'the planet shows its CO₂').not.toBeNull();
	return Number(m![1]);
}

test('a 10 % dimmer Sun is caught by the thermostat; 15 % at once freezes the planet', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#dimmer');
	await expect(stage(page)).toContainText('Sun 90 %');
	await expect(stage(page)).toContainText('average 8 °C');
	await expect(stage(page)).toContainText('open: weathering');
	await slider(page, 'sun').fill('85');
	await expect(stage(page)).toContainText('frozen over: no weathering');
	await expect(stage(page)).toContainText('frozen');
});

test('under the young Sun the box stays open only with livelier early volcanoes', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#young-sun');
	await expect(stage(page)).toContainText('one model’s history, not a measured one');
	await expect(stage(page)).toContainText('today');
	await expect(stage(page)).toContainText('280 ppm');
	await expect(stage(page)).not.toContainText('no steady open balance');
	await slider(page, 'early').fill('1');
	await expect(stage(page)).toContainText('no steady open balance');
});

test('a snowball thaws once the volcanoes’ CO₂ builds up, even with half the volcanoes', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#snowball');
	await expect(stage(page)).toContainText('20.0 million years');
	await expect(stage(page)).toContainText('open: weathering');
	await expect(stage(page)).toContainText('frozen');
	await slider(page, 'snowVolc').fill('0.5');
	await expect(stage(page)).toContainText('Sun 94 %');
	await expect(stage(page)).toContainText('open: weathering');
});

test('moving the planet outward loses the balance beyond about 1.13 × Earth’s distance', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#outward');
	await expect(stage(page)).toContainText('1.10 × Earth’s distance');
	await expect(stage(page)).toContainText('4,700 ppm');
	const planet = page.getByRole('slider', { name: 'Distance from the Sun' });
	await planet.focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('1.30 × Earth’s distance');
	await expect(stage(page)).toContainText('the planet freezes');
	await expect(slider(page, 'au')).toHaveValue('1.3');
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('0.95 × Earth’s distance');
	await slider(page, 'zoneVolc').fill('0');
	await expect(stage(page)).toContainText('no volcanoes: no balance anywhere');
});

test('without volcanoes the planet freezes for good; with more it settles warmer', async ({
	page
}) => {
	await open(page, './carbonate-silicate-thermostat/#no-volcanoes');
	await expect(stage(page)).toContainText('frozen over: no weathering');
	await expect(stage(page)).toContainText('no open balance exists');
	await slider(page, 'volc').fill('2');
	await expect(stage(page)).toContainText('open: weathering');
	await expect(stage(page)).toContainText('average 20 °C');
});
