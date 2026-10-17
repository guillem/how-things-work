import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, reduced = true) {
	if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'a heavier star is far brighter and lives far shorter: 10 billion years for the Sun, 4 million for 60 M☉',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './stars/#main-sequence');
		await expect(stage(page)).toContainText('9.9 billion years');
		await range(page, 'msMass').fill('60');
		await expect(stage(page)).toContainText('A new star of 60 M☉');
		await expect(stage(page)).toContainText('3.9 million years');
		await expect(stage(page)).toContainText('luminosity: 530,000 × the Sun');
		await range(page, 'msMass').fill('0.1');
		await expect(stage(page)).toContainText('luminosity: 0.00099 × the Sun');
		await expect(stage(page)).toContainText('3 trillion years');
	}
);

test('the starting mass decides the end: white dwarf, neutron star, black hole, or not yet', async ({
	page
}) => {
	await open(page, './stars/#run');
	await expect(stage(page)).toContainText('ends as a white dwarf of 0.54 M☉');
	await range(page, 'mass').fill('5');
	await expect(stage(page)).toContainText('ends as a white dwarf of 0.90 M☉');
	await expect(stage(page)).not.toContainText('dashed: the');
	await range(page, 'mass').fill('15');
	await expect(stage(page)).toContainText('leaving a neutron star');
	// the cutaway marks what the remnant is made of
	await expect(stage(page)).toContainText(
		'dashed: the 1.4 M☉ that will collapse to a neutron star'
	);
	await range(page, 'mass').fill('30');
	await expect(stage(page)).toContainText('a black hole');
	await expect(stage(page)).toContainText('dashed: the 11 M☉ that will fall into a black hole');
	await range(page, 'mass').fill('0.5');
	await expect(stage(page)).toContainText('still on the main sequence after 96 billion years');
	await expect(stage(page)).toContainText('age of the universe');
});

test('running the Sun’s life takes it from the main sequence through the giant stages', async ({
	page
}) => {
	await page.clock.install();
	await open(page, './stars/#run', false);
	await expect(stage(page)).toContainText('main sequence');
	await playUntil(page, stage(page), 'red giant', 20_000);
	await playUntil(page, stage(page), 'giant, burning helium', 20_000);
	await playUntil(page, stage(page), 'ends as a white dwarf', 20_000);
});

test('the periodic table picks out one source of the elements', async ({ page }) => {
	await open(page, './stars/#origins');
	await expect(stage(page)).toContainText('each square: where its atoms were made');
	await page.locator('button[data-control=source][data-value=mergers]').click();
	await expect(stage(page)).toContainText('merging neutron stars:');
	await expect(stage(page)).toContainText(/main source of \d+ elements/);
});

test('about nine-tenths of your body was made in stars', async ({ page }) => {
	await open(page, './stars/#stardust');
	await expect(stage(page)).toContainText('made in stars: 89%');
	await expect(stage(page)).toContainText('Big Bang: 10%');
});
