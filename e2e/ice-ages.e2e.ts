import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test.describe('settled frames (reduced motion)', () => {
	test.use({ reducedMotion: 'reduce' });

	test(
		'a bigger tilt brings more summer sunshine to 65° N',
		{ tag: '@smoke' },
		async ({ page }) => {
			await open(page, './ice-ages/#tilt');
			await expect(stage(page)).toContainText('478 W/m²');
			await range(page, 'tilt').fill('24.5');
			await expect(stage(page)).toContainText('496 W/m²');
			await range(page, 'tilt').fill('22.1');
			await expect(stage(page)).toContainText('457 W/m²');
		}
	);

	test('moving the close pass to late June strengthens northern summers; on a circle the wobble does nothing', async ({
		page
	}) => {
		await open(page, './ice-ages/#wobble');
		await expect(stage(page)).toContainText('closest to the Sun: 3 Jan');
		await range(page, 'closest').fill('176');
		await expect(stage(page)).toContainText('closest to the Sun: 26 Jun');
		await expect(stage(page)).toContainText('511 W/m²');
		await range(page, 'ecc').fill('0');
		await expect(stage(page)).toContainText('no closest point');
		await expect(stage(page)).toContainText('494 W/m²');
		await range(page, 'closest').fill('10');
		await expect(stage(page)).toContainText('494 W/m²');
	});

	test('stretching the orbit hardly changes the sunlight of the whole Earth over a year', async ({
		page
	}) => {
		await open(page, './ice-ages/#stretch');
		await expect(stage(page)).toContainText('whole Earth, whole year: 340.30 W/m²');
		await range(page, 'ecc').fill('0.05');
		await expect(stage(page)).toContainText('whole Earth, whole year: 340.68 W/m²');
		await expect(stage(page)).toContainText('22.2% more sunlight at the closest point');
	});

	test('the record reads 9 °C colder 21,000 years ago, warmer than today 129,000 years ago', async ({
		page
	}) => {
		await open(page, './ice-ages/#record');
		await expect(stage(page)).toContainText('21,000 years ago: −9.4 °C');
		await range(page, 'look').fill('129');
		await expect(stage(page)).toContainText('129,000 years ago: +3.8 °C');
	});

	test('the time slider moves the cursor through all the rows', async ({ page }) => {
		await open(page, './ice-ages/#cycles');
		await expect(stage(page)).toContainText('today');
		await range(page, 'ka').fill('21');
		await expect(stage(page)).toContainText('21,000 years ago');
		await expect(stage(page)).toContainText('22.96°');
		await expect(stage(page)).toContainText('470 W/m²');
		await expect(stage(page)).toContainText('−9.4 °C');
	});

	test('the temperature record beats at 100,000 years; the summer sunshine hardly does', async ({
		page
	}) => {
		await open(page, './ice-ages/#beats');
		await expect(stage(page)).toContainText(/100,000 yr ±2\.7/);
		await page.locator('select[data-control=series]').selectOption('summer');
		await expect(stage(page)).toContainText(/100,000 yr ±[0-2] .*W\/m²/);
		await expect(stage(page)).toContainText(/41,000 yr ±14/);
	});

	test('CO₂ tracked Antarctic temperature; today it is far above the record', async ({ page }) => {
		await open(page, './ice-ages/#co2');
		await expect(stage(page)).toContainText(/correlation 0\.(89|90)/);
		await expect(stage(page)).toContainText('190 ppm 21,000 years ago: −2.2 W/m²');
		await expect(stage(page)).toContainText(/20\d\d: 4\d\d ppm/);
		await expect(stage(page)).toContainText('highest in 800,000 years: 299');
	});

	test('the orbit grows rounder ahead; the next deep low in summer sunshine is 54,000 years away', async ({
		page
	}) => {
		await open(page, './ice-ages/#next');
		await expect(stage(page)).toContainText('next deep low: 54,000 years from now');
		await expect(stage(page)).toContainText('nearly round: e = 0.002');
	});
});

test('playing the cycles runs the cursor forward to today; moving the slider stops it', async ({
	page
}) => {
	await page.clock.install();
	await open(page, './ice-ages/#cycles');
	await expect(toggle(page, 'play')).toBeChecked();
	await playUntil(page, stage(page), '400,000 years ago', 30_000);
	// 800,000 years at 20,000 a second: today after 40 s, where it stays
	await page.clock.runFor(30_000);
	await expect(stage(page)).not.toContainText(/\d,000 years ago/);
	await range(page, 'ka').fill('300');
	await expect(toggle(page, 'play')).not.toBeChecked();
	await expect(stage(page)).toContainText('300,000 years ago');
});
