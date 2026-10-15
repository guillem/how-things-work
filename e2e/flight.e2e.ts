import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const choice = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value=${value}]`);

async function open(page: Page, url: string) {
	// reduced motion: a complete, frozen frame
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'tilting the wing raises the lift; a cambered wing lifts at zero angle',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './flight/#wing');
		await expect(stage(page)).toContainText(/Lift coefficient \(ideal\)\s*0\.87/);
		await range(page, 'angle').fill('10');
		await expect(stage(page)).toContainText(/Lift coefficient \(ideal\)\s*1\.46/);
		await range(page, 'angle').fill('0');
		await expect(stage(page)).toContainText(/Lift coefficient \(ideal\)\s*0\.27/);
	}
);

test('the air leaves the trailing edge heading down', async ({ page }) => {
	await open(page, './flight/#turning');
	await expect(stage(page)).toContainText(/Air leaves the trailing edge\s*8\.0° down/);
});

test('no equal transit time: the air over the top reaches the trailing edge first', async ({
	page
}) => {
	await open(page, './flight/#transit');
	const text = (await stage(page).textContent()) ?? '';
	const top = Number(/edge, top\s*([\d.]+) ms/.exec(text)?.[1]);
	const bottom = Number(/Underneath\s*([\d.]+) ms/.exec(text)?.[1]);
	expect(top).toBeGreaterThan(0);
	expect(top).toBeLessThan(bottom * 0.9);
});

test('a symmetric wing at zero angle makes no lift', async ({ page }) => {
	await open(page, './flight/#shape');
	await range(page, 'camber').fill('0');
	await range(page, 'angle').fill('0');
	await expect(stage(page)).toContainText(/Lift coefficient \(ideal\)\s*0\.00/);
	await expect(stage(page)).toContainText(/Zero-lift angle\s*0\.0°/);
});

test('the measured wing stalls past 17°', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './flight/#stall');
	await range(page, 'angle').fill('17');
	await expect(stage(page)).toContainText(/Flow over the top\s*attached/);
	await range(page, 'angle').fill('18');
	await expect(stage(page)).toContainText(/Flow over the top\s*separated: stalled/);
	await expect(stage(page)).toContainText(/Lift coefficient\s*1\.01/);
});

test('the lift equation: thinner air higher up lifts less', async ({ page }) => {
	await open(page, './flight/#lift-equation');
	await expect(stage(page)).toContainText(/Lift on S = 16\.2 m²\s*14\.0 kN/);
	await range(page, 'altitude').fill('10000');
	await expect(stage(page)).toContainText('74% of sea level');
	await expect(stage(page)).toContainText(/Lift on S = 16\.2 m²\s*10\.4 kN/);
});

test('the least drag is at the handbook’s best-glide speed', async ({ page }) => {
	await open(page, './flight/#drag');
	await expect(stage(page)).toContainText('least drag: 68 kt');
	await expect(stage(page)).toContainText(/Total drag\s*1\.63 kN/);
	await choice(page, 'view', 'polar').click();
	await expect(stage(page)).toContainText('best glide: lift/drag = 9.1');
});

test('lift equals weight: slower needs more lift coefficient, until the stall', async ({
	page
}) => {
	await open(page, './flight/#cessna');
	await expect(stage(page)).toContainText(/Lift coefficient needed\s*0\.43/);
	await expect(stage(page)).toContainText(/Most the wing can give\s*1\.54/);
	await range(page, 'speed').fill('50');
	await expect(stage(page)).toContainText('STALL: below 53 kt');
});

test('higher up the stall comes at a faster true airspeed', async ({ page }) => {
	await open(page, './flight/#altitude');
	await range(page, 'altitude').fill('10000');
	await expect(stage(page)).toContainText(/Stall, true airspeed\s*62 kt/);
	await expect(stage(page)).toContainText(/Indicated airspeed\s*86 kt/);
});

test('thrust equal to drag flies level; more thrust climbs, less descends', async ({ page }) => {
	await open(page, './flight/#balance');
	await expect(stage(page)).toContainText(/Climb rate\s*level/);
	await range(page, 'thrust').fill('2500');
	await expect(stage(page)).toContainText(/Climb rate\s*\+\d+ ft\/min/);
	await range(page, 'thrust').fill('800');
	await expect(stage(page)).toContainText(/Climb rate\s*−\d+ ft\/min/);
});
