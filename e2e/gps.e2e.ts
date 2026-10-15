import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
async function switchOn(page: Page, id: string) {
	await toggle(page, id).focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, id)).toBeChecked();
}
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'a receiver clock error stops the circles meeting; solving for it puts the fix back',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './gps/#solve');
		await range(page, 'clockErr').fill('6');
		await expect(stage(page)).toContainText('Clock wrong: no common point');
		await expect(stage(page)).toContainText(/Trusting its clock\s*\d[\d,]* km off/);
		await switchOn(page, 'solveClock');
		await expect(stage(page)).toContainText('Clock solved: they meet again');
		await expect(stage(page)).toContainText(/Solving for its clock\s*on the spot/);
		await expect(stage(page)).toContainText('+6.0 ms');
	}
);

test('two distances leave two points, three leave one', async ({ page }) => {
	await open(page, './gps/#trilateration');
	await range(page, 'nsat').fill('2');
	await expect(stage(page)).toContainText(/Circles meet at\s*2 points/);
	await range(page, 'nsat').fill('3');
	await expect(stage(page)).toContainText(/Circles meet at\s*one point/);
});

test('dragging the receiver with the keyboard changes the measured distance', async ({ page }) => {
	await open(page, './gps/#timing');
	await expect(stage(page)).toContainText('4,754 km');
	const rx = page.getByRole('slider', { name: 'Receiver' });
	await rx.focus();
	await page.keyboard.press('Shift+ArrowRight');
	await expect(stage(page)).not.toContainText('4,754 km');
	await expect(page).toHaveURL(/#timing$/);
});

test('in three dimensions four satellites fix position and clock; three cannot', async ({
	page
}) => {
	await open(page, './gps/#four');
	await range(page, 'clockErr').fill('6');
	await expect(stage(page)).toContainText('4 satellites used: enough');
	await expect(stage(page)).toContainText('start: Earth’s centre');
	await expect(stage(page)).toContainText('+6.000 ms');
	await range(page, 'used').fill('3');
	await expect(stage(page)).toContainText('3 satellites used: not enough');
});

test('the real sky changes with the place, and height is the weaker direction', async ({
	page
}) => {
	await open(page, './gps/#real-sky');
	await expect(stage(page)).toContainText(/10 above 10° now/);
	const dops = await stage(page)
		.getByText(/HDOP [\d.]+ across · VDOP [\d.]+ in height/)
		.textContent();
	const [h, v] = (dops ?? '').match(/[\d.]+/g)!.map(Number);
	expect(v).toBeGreaterThan(h);
	await page.locator('button[data-control=place][data-value=mcmurdo]').click();
	await expect(stage(page)).toContainText(/11 above 10° now/);
});

test('bunching the satellites together raises the PDOP', async ({ page }) => {
	await open(page, './gps/#geometry');
	await expect(stage(page)).toContainText(/PDOP\s*4\.1/);
	// Drag satellites 3 and 4 next to satellite 1, high in the north.
	const box = async (n: number) =>
		(await page.getByRole('slider', { name: `Satellite ${n} in the sky` }).boundingBox())!;
	const target = await box(1);
	for (const [n, dx] of [
		[3, 30],
		[4, -30]
	]) {
		const b = await box(n);
		await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
		await page.mouse.down();
		await page.mouse.move(target.x + target.width / 2 + dx, target.y + target.height / 2 + 20, {
			steps: 5
		});
		await page.mouse.up();
	}
	await expect(stage(page)).toContainText(/(poor|very poor)/);
});

test('relativity: GPS clocks gain 38.6 µs a day; the effects cancel 3 170 km up', async ({
	page
}) => {
	await open(page, './gps/#relativity');
	await expect(stage(page)).toContainText(/Weaker gravity\s*\+45\.8 µs\/day/);
	await expect(stage(page)).toContainText(/Speed\s*−7\.2 µs\/day/);
	await expect(stage(page)).toContainText(/Net\s*\+38\.6 µs\/day/);
	await expect(stage(page)).toContainText('11.6 km');
	await range(page, 'alt').fill('3170');
	await expect(stage(page)).toContainText(/Net\s*[+−]0\.0 µs\/day/);
	await range(page, 'alt').fill('400');
	await expect(stage(page)).toContainText(/Net\s*−2\d\.\d µs\/day/);
});

test('without the correction, the trusting receiver drifts and the solving one keeps its place', async ({
	page
}) => {
	await open(page, './gps/#uncorrected');
	await expect(stage(page)).toContainText('38.6 µs fast');
	await expect(stage(page)).toContainText('every range 11.6 km short');
	await expect(stage(page)).toContainText(/position: 19\.\d km off/);
	await expect(stage(page)).toContainText('position: on the spot');
	await expect(stage(page)).toContainText('time: 38.6 µs ahead');
	await switchOn(page, 'ecc');
	await expect(stage(page)).toContainText(/position: \d+(\.\d)? m off/);
	await switchOn(page, 'corrected');
	await expect(stage(page)).toContainText('corrected: on time');
	await expect(stage(page)).not.toContainText('km off');
});
