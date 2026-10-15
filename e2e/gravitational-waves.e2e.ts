import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const choice = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);

async function open(page: Page, url: string) {
	// reduced motion: a complete, frozen frame
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}
async function switchOn(page: Page, id: string) {
	await toggle(page, id).focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, id)).toBeChecked();
}

test(
	'the quadrupole formula: 200 W from the Earth, and the Hulse–Taylor orbit shrinking as predicted',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './gravitational-waves/#power');
		await expect(stage(page)).toContainText(/Power in waves\s*200 W/);
		await choice(page, 'source', 'pulsar').click();
		await expect(stage(page)).toContainText('76 µs a year');
		await expect(stage(page)).toContainText('0.9983');
		await choice(page, 'source', 'bbh').click();
		await expect(stage(page)).toContainText(/Power in waves\s*1\.8 × 10⁴⁸ W/);
	}
);

test('a plus wave stretches one arm and squeezes the other; a cross wave leaves both alone', async ({
	page
}) => {
	await open(page, './gravitational-waves/#stretch');
	await switchOn(page, 'arms');
	await expect(stage(page)).toContainText('x arm +25%');
	await expect(stage(page)).toContainText('y arm −25%');
	await choice(page, 'pol', 'cross').click();
	// measured along each arm: a cross wave leaves both lengths unchanged
	await expect(stage(page)).toContainText('x arm +0%');
	await expect(stage(page)).toContainText('y arm +0%');
	await expect(stage(page)).toContainText('no change');
});

test('lighter black holes chirp longer and end higher; the ISCO is 4400 Hz over the total mass', async ({
	page
}) => {
	await open(page, './gravitational-waves/#chirp-mass');
	await expect(stage(page)).toContainText(/Ends at the ISCO\s*67\.6 Hz/);
	await range(page, 'm1').fill('10');
	await range(page, 'm2').fill('10');
	await expect(stage(page)).toContainText(/Ends at the ISCO\s*220 Hz/);
	await expect(stage(page)).toContainText(/From 30 Hz to the ISCO\s*2\.0 s/);
	await range(page, 'm1').fill('80');
	await range(page, 'm2').fill('80');
	await expect(stage(page)).toContainText(/Ends at the ISCO\s*27\.5 Hz/);
});

test('a pair with the same chirp mass follows the same track', async ({ page }) => {
	await open(page, './gravitational-waves/#chirp-mass');
	await switchOn(page, 'sameMc');
	// 36 + 29 suns has a chirp mass of 28.1: the equal-mass pair is 32.3 + 32.3
	await expect(stage(page)).toContainText(/Same chirp mass\s*32\.3 \+ 32\.3 suns/);
});

test('36 + 29 suns merge into 61.9, radiating about 3 suns, and ring at 275 Hz', async ({
	page
}) => {
	await open(page, './gravitational-waves/#merger');
	await expect(stage(page)).toContainText(/Final black hole\s*61\.9 suns/);
	await expect(stage(page)).toContainText('3.08 suns');
	await expect(stage(page)).toContainText('275 Hz');
});

test('ten times farther, ten times weaker', async ({ page }) => {
	await open(page, './gravitational-waves/#arrival');
	await expect(stage(page)).toContainText(/overhead\)\s*1\.2 × 10⁻²¹/);
	await range(page, 'dist').fill('4000');
	await expect(stage(page)).toContainText(/overhead\)\s*1\.3 × 10⁻²²/);
});

test('the interferometer’s output stays dark until a wave passes', async ({ page }) => {
	await open(page, './gravitational-waves/#interferometer');
	await expect(stage(page)).toContainText(/\d+% bright/);
	await toggle(page, 'wave').focus();
	await page.keyboard.press('Space');
	await expect(stage(page)).toContainText('dark: the beams cancel');
});

test('to scale, the change in the arms is a dot inside a proton, 421 times smaller', async ({
	page
}) => {
	await open(page, './gravitational-waves/#to-scale');
	await expect(stage(page)).toContainText('a proton');
	await expect(stage(page)).toContainText('421 times wider');
	await expect(stage(page)).toContainText('ΔL: this dot');
	await range(page, 'zoom').fill('21');
	await expect(stage(page)).toContainText('inside a proton');
	await expect(stage(page)).toContainText('ΔL = 4.0 am');
	await range(page, 'zoom').fill('0');
	await expect(stage(page)).toContainText('LIGO arm, 4 km');
});

test('the real data: Hanford, shifted 6.9 ms and flipped, lies on Livingston', async ({ page }) => {
	await open(page, './gravitational-waves/#two-detectors');
	await expect(stage(page)).toContainText('Hanford, Washington');
	await switchOn(page, 'align');
	await expect(stage(page)).toContainText('+ Hanford, 6.9 ms earlier and flipped');
});

test('fitting the chirp to the data: about 36 suns at leading order', async ({ page }) => {
	await open(page, './gravitational-waves/#measure');
	await expect(stage(page)).not.toContainText('best fit');
	await range(page, 'fitMc').fill('36');
	await expect(stage(page)).toContainText('best fit ≈ 36');
});
