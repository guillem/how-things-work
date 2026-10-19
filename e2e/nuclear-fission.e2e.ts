import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, reduced = true) {
	if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('each split releases the energy its masses give', async ({ page }) => {
	await open(page, './nuclear-fission/#fire');
	await expect(stage(page)).toContainText('barium-141 + krypton-92 + 3 n');
	await expect(stage(page)).toContainText('173.3 MeV');
	await page.getByRole('radio', { name: 'Xenon + strontium' }).click();
	await expect(stage(page)).toContainText('xenon-140 + strontium-94 + 2 n');
	await expect(stage(page)).toContainText('184.7 MeV');
});

test('the energy budget ends at about 200 MeV of heat per fission', async ({ page }) => {
	await open(page, './nuclear-fission/#energy');
	await expect(stage(page)).toContainText('+ 26.0 → 199.2');
	await expect(stage(page)).toContainText('202.4 MeV');
	await expect(stage(page)).toContainText('Mass turned into energy: 0.091%');
});

test('k below, at and above 1 make the chain die, hold or grow', async ({ page }) => {
	await open(page, './nuclear-fission/#k');
	await expect(stage(page)).toContainText('k = 1.00 · critical');
	await slider(page, 'k').fill('0.9');
	await expect(stage(page)).toContainText('k = 0.90 · subcritical');
	await slider(page, 'k').fill('1.1');
	await expect(stage(page)).toContainText('k = 1.10 · supercritical');
	await expect(stage(page)).toContainText('off the chart');
});

test('the rods hold the core critical; pulling them out makes it supercritical', async ({
	page
}) => {
	await open(page, './nuclear-fission/#core');
	await expect(stage(page)).toContainText('k = 1.000');
	await expect(stage(page)).toContainText('critical');
	await slider(page, 'rods').fill('40');
	await expect(stage(page)).toContainText('supercritical');
	await slider(page, 'rods').fill('60');
	await expect(stage(page)).toContainText('subcritical');
	// Less enriched fuel needs the rods further out to be critical again.
	await slider(page, 'enrichment').fill('3');
	await slider(page, 'rods').fill('41.4');
	await expect(stage(page)).toContainText('k = 1.000');
});

test('natural uranium cannot keep the chain going in water', async ({ page }) => {
	await open(page, './nuclear-fission/#fuel');
	await slider(page, 'enrichment').fill('0.7');
	await expect(stage(page)).toContainText('subcritical');
	await expect(stage(page)).toContainText('0.7% (natural)');
});

test('losing water lowers k', async ({ page }) => {
	await open(page, './nuclear-fission/#void');
	await expect(stage(page)).toContainText('k = 1.000');
	await slider(page, 'water').fill('60');
	await expect(stage(page)).toContainText('k = 0.855');
	await expect(stage(page)).toContainText('subcritical');
});

test('without delayed neutrons the power would run away in under a second', async ({ page }) => {
	await open(page, './nuclear-fission/#delayed');
	await expect(stage(page)).toContainText('With delayed neutrons');
	await expect(stage(page)).toContainText('every 55 s');
	await page.getByRole('switch', { name: 'Delayed neutrons' }).click({ force: true });
	await expect(stage(page)).toContainText('If every neutron were prompt');
	await expect(stage(page)).toContainText('×22,026');
});

test('pulling the rods raises the power slowly; a scram drops it at once', async ({ page }) => {
	await page.clock.install();
	await open(page, './nuclear-fission/#operate', false);
	await expect(stage(page)).toContainText('100.0%');
	await slider(page, 'bank').fill('48');
	await playUntil(page, stage(page), 'rising', 3000);
	await page.clock.runFor(5000);
	const power = async () =>
		Number(/(\d+\.\d)%/.exec((await stage(page).textContent()) ?? '')?.[1] ?? NaN);
	// Delayed neutrons: seconds later the power has grown, but not run away.
	const p = await power();
	expect(p).toBeGreaterThan(101);
	expect(p).toBeLessThan(118);
	await page.getByRole('button', { name: 'Scram: drop all rods' }).click();
	await playUntil(page, stage(page), 'shut down', 3000);
	await page.clock.runFor(3000);
	expect(await power()).toBeLessThan(15);
	await slider(page, 'bank').fill('50');
	await page.getByRole('button', { name: 'Start again at 100%' }).click();
	await playUntil(page, stage(page), 'steady', 3000);
});

test('pulling every rod out trips the reactor before the power runs away', async ({ page }) => {
	await page.clock.install();
	await open(page, './nuclear-fission/#operate', false);
	await slider(page, 'bank').fill('0');
	await playUntil(page, stage(page), 'automatic trip at 118%', 30_000);
});
