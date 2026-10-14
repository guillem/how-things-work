import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

// Reduced motion shows each flight's finished frame, so the verdicts are final.
test.use({ reducedMotion: 'reduce' });

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('one kerosene stage falls back; split into two stages, the same rocket reaches orbit', async ({
	page
}) => {
	await open(page, './rockets/#staging');
	await expect(stage(page)).toContainText('Falls back to Earth');
	await slider(page, 'stages').fill('2');
	await expect(stage(page)).toContainText(/In orbit, \d+ × \d+ km/);
	await expect(stage(page)).toContainText('km/s of Δv left in the tanks');
});

test(
	'a faster exhaust gets a design into orbit that a slower one cannot',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './rockets/#design');
		await slider(page, 'stages').fill('2');
		await slider(page, 'fuel').fill('300');
		await slider(page, 'veDesign').fill('2.5');
		await expect(stage(page)).toContainText('Falls back to Earth');
		await slider(page, 'veDesign').fill('4.4');
		await expect(stage(page)).toContainText(/In orbit/);
	}
);

test("Apollo 11's Saturn V reaches its parking orbit", async ({ page }) => {
	await open(page, './rockets/#losses');
	await expect(stage(page)).toContainText("Apollo 11's Saturn V");
	await expect(stage(page)).toContainText(/In orbit, 1\d\d × 1\d\d km/);
	await expect(stage(page)).toContainText('km/s of Δv left in the tanks');
});

test('the rocket equation: 9.4 km/s on a 3 km/s exhaust means starting 23 times heavier', async ({
	page
}) => {
	await open(page, './rockets/#tyranny');
	await expect(stage(page)).toContainText('23.0 t on the pad');
	await slider(page, 've').fill('4.4');
	await expect(stage(page)).toContainText('8.47 t on the pad');
});

test('two forward burns of 2.45 and 1.48 km/s reach geostationary orbit; one alone falls back', async ({
	page
}) => {
	await open(page, './rockets/#raise');
	await slider(page, 'burn1').fill('2.45');
	await expect(stage(page)).toContainText('No second burn: it falls back to the low point');
	await slider(page, 'burn2').fill('1.48');
	await expect(stage(page)).toContainText('Geostationary: round, one turn a day');
	await expect(stage(page)).toContainText('3.93 km/s');
});

test('the Hohmann trip only meets Mars when Mars starts 44° ahead', async ({ page }) => {
	await open(page, './rockets/#hohmann');
	await expect(stage(page)).toContainText('Missed!');
	await slider(page, 'lead').fill('44');
	await expect(stage(page)).toContainText('Mars is there: arrival!');
});

test('November 2026 is in a launch window to Mars; a year later costs several times more', async ({
	page
}) => {
	await open(page, './rockets/#window');
	await slider(page, 'depart').fill('310'); // 7 November 2026
	await expect(stage(page)).toContainText('In a launch window');
	await slider(page, 'depart').fill('680'); // November 2027
	await expect(stage(page)).toContainText(/\d\.\d times the cheapest/);
	// Each window is judged on its own: on a 200-day trip the 2026 window costs 1.15 times the
	// 2031 one, and its cheapest date is still in a window.
	await slider(page, 'flight').fill('200');
	await slider(page, 'depart').fill('340');
	await expect(stage(page)).toContainText('In a launch window');
});

test('a closer pass of Jupiter turns the craft more and leaves it faster round the Sun', async ({
	page
}) => {
	await open(page, './rockets/#flyby');
	await slider(page, 'closest').fill('40');
	await expect(stage(page)).toContainText('7.4 → 12.4 km/s');
	await slider(page, 'closest').fill('1.1');
	await expect(stage(page)).toContainText('157°');
	await expect(stage(page)).toContainText('7.4 → 18.4 km/s');
});

test('the budget step adds up the legs of the chosen mission', async ({ page }) => {
	await open(page, './rockets/#budget');
	await expect(stage(page)).toContainText('15.1 km/s');
	await page.locator('button[data-control=mission][data-value=leo]').click();
	await expect(stage(page)).toContainText('9.4 km/s');
	await expect(stage(page)).not.toContainText('into Mars orbit');
});
