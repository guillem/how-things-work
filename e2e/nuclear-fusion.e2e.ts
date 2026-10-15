import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('heating the plasma brings the average nucleus closer to the top of the barrier', async ({
	page
}) => {
	await open(page, './nuclear-fusion/#repel');
	await expect(stage(page)).toContainText('Coulomb barrier: 444 keV');
	await expect(stage(page)).toContainText('average energy 15 keV = 1/30 of the barrier');
	await range(page, 'temp').fill('100');
	await expect(stage(page)).toContainText('average energy 150 keV = 1/3 of the barrier');
	await expect(stage(page)).toContainText('to climb it on average: 3.4 billion K');
});

test('at 10 keV most fusions come from pairs at about 35 keV; hotter, the peak moves up', async ({
	page
}) => {
	await open(page, './nuclear-fusion/#tunnel');
	await expect(stage(page)).toContainText('most fusions at 35 keV');
	await range(page, 'temp').fill('20');
	await expect(stage(page)).toContainText('most fusions at 49 keV');
	await expect(stage(page)).toContainText(/fusion rate × 3\.8 compared with 10 keV/);
});

test(
	'the power balance: gain 2.4 at the defaults; longer confinement at 15 keV ignites',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './nuclear-fusion/#balance');
		await expect(stage(page)).toContainText('gain Q = fusion ÷ heaters = 2.4');
		await range(page, 'temp').fill('15');
		await range(page, 'logTau').fill('0.3');
		await expect(stage(page)).toContainText('∞ (ignited)');
		await expect(stage(page)).toContainText('none needed');
	}
);

test('on the Lawson diagram the plasma sits below the line until the triple product is enough', async ({
	page
}) => {
	await open(page, './nuclear-fusion/#lawson');
	await expect(stage(page)).toContainText('below the line: gain Q = 2.4');
	await expect(stage(page)).toContainText('lowest: 3 × 10²¹ at 14 keV');
	await range(page, 'temp').fill('15');
	await range(page, 'logTau').fill('0.3');
	await expect(stage(page)).toContainText('above the line: it ignites');
	// Below the ideal ignition temperature no confinement is enough.
	await range(page, 'temp').fill('4');
	await expect(stage(page)).toContainText('ignition at 4 keV: impossible, too cold');
});

test('with the heaters off, a plasma below the line cools; above it, it burns', async ({
	page
}) => {
	await page.clock.install();
	await open(page, './nuclear-fusion/#ignite');
	await playUntil(page, stage(page), 'cools: fusion fizzles out', 20_000);
	await range(page, 'temp').fill('15');
	await range(page, 'logTau').fill('0.3');
	await playUntil(page, stage(page), /ignites: burns steadily at \d+ keV/, 20_000);
});

test('reduced motion shows the finished run at once', async ({ browser }) => {
	const context = await browser.newContext({ reducedMotion: 'reduce' });
	const page = await context.newPage();
	await open(page, './nuclear-fusion/#ignite');
	await expect(stage(page)).toContainText('cools: fusion fizzles out');
	await context.close();
});

test('the gain scorecard places the reader’s own plasma among the milestones', async ({ page }) => {
	await open(page, './nuclear-fusion/#gain');
	await expect(stage(page)).toContainText('NIF 2022: Q ≈ 1.5');
	await expect(stage(page)).toContainText('ITER, design goal: Q ≈ 10');
	await expect(stage(page)).toContainText('your plasma: Q ≈ 2.4');
});
