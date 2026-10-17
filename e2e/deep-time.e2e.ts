import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its finished, frozen frame.
test.use({ reducedMotion: 'reduce' });

const EARTH = 4567;
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`).click();
/** Sets a timeline scrubber to `age` million years ago (its value is the time since 4,567 Ma). */
const setAge = (page: Page, id: string, age: number) => range(page, id).fill(String(EARTH - age));

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'scrubbing the timeline moves through the eons, down to today',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './deep-time/#whole');
		await expect(stage(page)).toContainText('3.00 billion years ago');
		await expect(stage(page)).toContainText('Mesoarchean era · Archean eon');
		await setAge(page, 'tWhole', 0);
		await expect(stage(page)).toContainText('Quaternary period · Cenozoic era');
		await range(page, 'tWhole').press('Home');
		await expect(stage(page)).toContainText('4.57 billion years ago');
		await expect(stage(page)).toContainText('Hadean eon');
	}
);

test('clicking on the tracks puts the cursor there', async ({ page }) => {
	await open(page, './deep-time/#whole');
	const scrub = page.locator('rect.scrub');
	const box = (await scrub.boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	// the middle of the window: half of 4,567 million years ago
	await expect(stage(page)).toContainText('2.28 billion years ago');
});

test('a zircon’s lead-to-uranium ratio gives its age back', async ({ page }) => {
	await open(page, './deep-time/#dating');
	await expect(stage(page)).toContainText('Lead per uranium atom: 0.98');
	await expect(stage(page)).toContainText('Age from the ratio: 4,404 million years');
	await setAge(page, 'tDating', 0);
	await expect(stage(page)).toContainText('Uranium-238 left: 100.0%');
	await expect(stage(page)).toContainText('Lead per uranium atom: 0.00');
});

test('the map is solid for the young sea floor, rougher before, blank beyond a billion years', async ({
	page
}) => {
	await open(page, './deep-time/#drift');
	await expect(stage(page)).toContainText('250 million years ago');
	await expect(stage(page)).toContainText('latitudes from rock magnetism; longitudes guessed');
	await setAge(page, 'tDrift', 100);
	await expect(stage(page)).toContainText('well known: the ocean floor records it');
	await open(page, './deep-time/#before');
	await expect(stage(page)).toContainText('positions unknown');
	await expect(stage(page)).toContainText('no reliable map this far back');
});

test('temperature: the Cretaceous hothouse, and no record before 487 Ma', async ({ page }) => {
	await open(page, './deep-time/#temperature');
	await expect(stage(page)).toContainText('Since the Cambrian');
	await expect(stage(page)).toContainText('Global temperature: 35.6 °C (31–44)');
	await choose(page, 'tempZoom', 'all');
	await expect(stage(page)).toContainText('All of Earth’s history');
	await setAge(page, 'tTemp', 717);
	await expect(stage(page)).toContainText('Global temperature: no record');
	await expect(stage(page)).toContainText('The Sun: 94% as bright');
});

test('oxygen: almost none before 2,430 Ma, then the Phanerozoic curve', async ({ page }) => {
	await open(page, './deep-time/#oxygen');
	await setAge(page, 'tO2', 3000);
	await expect(stage(page)).toContainText('less than 0.001% of today’s level');
	await setAge(page, 'tO2', 1400);
	await expect(stage(page)).toContainText('disputed');
	await setAge(page, 'tO2', 0);
	await expect(stage(page)).toContainText('Oxygen: 21% of the air');
});

test('life: one group 3.48 billion years ago; humans are a fraction of a pixel', async ({
	page
}) => {
	await open(page, './deep-time/#life');
	await expect(stage(page)).toContainText('Groups alive: 1 of 11');
	await expect(stage(page)).toContainText('Homo sapiens: 0.04 px of this bar');
	await setAge(page, 'tLife', 100);
	await expect(stage(page)).toContainText('Groups alive: 9 of 11');
});

test('zooming down to the time since farming shows 0.0003% of the history', async ({ page }) => {
	await open(page, './deep-time/#zoom');
	await choose(page, 'zoom', 'holocene');
	await expect(stage(page)).toContainText('Since farming began · 12,000 years');
	await expect(stage(page)).toContainText('Window: 0.0003% of Earth’s history');
	await expect(stage(page)).toContainText('steam engines');
	// the cursor was 315,000 years ago: it is pulled into the window
	await expect(stage(page)).toContainText('12,000 years ago');
});

test('one calendar year: the dinosaurs die out on 26 December, humans at 23:23', async ({
	page
}) => {
	await open(page, './deep-time/#year');
	await expect(stage(page)).toContainText('First large animals: 16 November');
	await choose(page, 'calEvent', 'kpg');
	await expect(stage(page)).toContainText('Asteroid ends the dinosaurs: 26 December');
	await open(page, './deep-time/#midnight');
	await expect(stage(page)).toContainText('Homo sapiens · 23:23');
	await expect(stage(page)).toContainText('Industrial Revolution · 23:59:58');
	await expect(stage(page)).toContainText('the last 0.55 s');
});

test.describe('with motion', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('while the drift plays, the time slider follows the globe; switched off, it takes over there', async ({
		page
	}) => {
		await page.clock.install();
		await open(page, './deep-time/#drift');
		// time moves only when the test says so
		await page.clock.pauseAt(Date.now() + 1000);
		const slider = range(page, 'tDrift');
		const readout = page.locator('label:has(input[data-control=tDrift]) output');
		await expect(readout).toHaveText('250 million years ago');
		const play = page.locator('input[type=checkbox][data-control=driftPlay]');
		await play.focus();
		await page.keyboard.press('Space');
		await expect(play).toBeChecked();
		await expect(slider).toBeDisabled();

		await page.clock.runFor(5_000);
		const first = await readout.textContent();
		expect(first).toMatch(/million years ago/);
		expect(first).not.toBe('250 million years ago');
		await expect(stage(page)).toContainText(first!);
		await page.clock.runFor(5_000);
		const later = await readout.textContent();
		expect(later).not.toBe(first);
		await expect(stage(page)).toContainText(later!);

		await page.keyboard.press('Space');
		await expect(play).not.toBeChecked();
		await expect(slider).toBeEnabled();
		await page.clock.runFor(2_000);
		await expect(readout).toHaveText(later!);
		await expect(stage(page)).toContainText(later!);
	});
});
