import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const control = (page: Page, id: string) => page.locator(`[data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

// Reduced motion shows each run finished, so the verdicts are final.
async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'a pulse past threshold fires a full spike; below it, nothing',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './neurons/#threshold');
		await expect(stage(page)).toContainText('no spike');
		await control(page, 'amp').fill('20');
		await expect(stage(page)).toContainText(/a spike: peak \+4\d mV/);
		// Far stronger: the same spike (all or nothing).
		await control(page, 'amp').fill('60');
		await expect(stage(page)).toContainText(/a spike: peak \+4\d mV/);
	}
);

test('tetrodotoxin blocks the spike; blocking potassium makes it long', async ({ page }) => {
	await open(page, './neurons/#channels');
	await expect(stage(page)).toContainText('a spike: peak');
	await toggle(page, 'ttx').check({ force: true });
	await expect(stage(page)).toContainText('no sodium channels, no spike');
	await toggle(page, 'ttx').uncheck({ force: true });
	await toggle(page, 'tea').check({ force: true });
	await expect(stage(page)).toContainText('it ends slowly with most K⁺ channels blocked');
});

test('a second pulse too soon after a spike fires nothing', async ({ page }) => {
	await open(page, './neurons/#refractory');
	await expect(stage(page)).toContainText('2 pulses, 1 spike');
	await control(page, 'gap').fill('25');
	await expect(stage(page)).toContainText('2 pulses, 2 spikes');
});

test('a stronger steady current means more spikes per second', async ({ page }) => {
	await open(page, './neurons/#rate');
	await control(page, 'steady').fill('7');
	await expect(stage(page)).toContainText(/(5|6)\d spikes per second/);
	await control(page, 'steady').fill('30');
	await expect(stage(page)).toContainText(/(9\d|1\d\d) spikes per second/);
	await control(page, 'steady').fill('3');
	await expect(stage(page)).toContainText('1 spike, then silence');
});

test('potassium channels alone give −89 mV, sodium channels alone +47 mV', async ({ page }) => {
	await open(page, './neurons/#battery');
	await expect(stage(page)).toContainText('voltage inside');
	await expect(stage(page)).toContainText('−89 mV');
	await control(page, 'ion').and(page.locator('[data-value=Na]')).click();
	await expect(stage(page)).toContainText('channels open for Na⁺ only');
	await expect(stage(page).locator('text', { hasText: /^\+47 mV$/ })).toBeAttached();
});

test('raising the sodium permeability flips the resting −60 mV to +38 mV', async ({ page }) => {
	await open(page, './neurons/#mix');
	await expect(stage(page)).toContainText('potassium wins');
	await expect(stage(page).locator('text', { hasText: /^−60 mV$/ })).toBeAttached();
	await control(page, 'pna').fill('1.3'); // log₁₀ 20
	await expect(stage(page)).toContainText('sodium wins');
	await expect(stage(page).locator('text', { hasText: /^\+38 mV$/ })).toBeAttached();
});

test('the squid axon conducts at about 18.5 m/s, a thinner one more slowly', async ({ page }) => {
	await open(page, './neurons/#travel');
	await expect(stage(page)).toContainText(/speed: 18\.\d m\/s/);
	await expect(stage(page)).toContainText('measured 21.2 m/s');
	await control(page, 'diameter').and(page.locator('[data-value="60"]')).click();
	await expect(stage(page)).toContainText(/speed: [67]\.\d m\/s/);
});

test('myelin makes a 10 µm fibre twenty times faster', async ({ page }) => {
	await open(page, './neurons/#myelin');
	await expect(stage(page)).toContainText('60 m/s');
	await expect(stage(page)).toContainText('slowed down 36,000 times');
	await toggle(page, 'myelin').uncheck({ force: true });
	await expect(stage(page)).toContainText('3.1 m/s');
	// The bare fibre is slowed down less, so its creeping front still visibly moves.
	await expect(stage(page)).toContainText('slowed down 3,000 times');
	await expect(stage(page)).toContainText('the front creeps along');
});

test('three coincident excitatory inputs fire the cell; inhibition or spreading them out stops it', async ({
	page
}) => {
	await open(page, './neurons/#adding');
	await expect(stage(page)).toContainText('no spike');
	await control(page, 'exc').fill('3');
	await expect(stage(page)).toContainText('it fires: a full spike');
	await control(page, 'inh').fill('2');
	await expect(stage(page)).toContainText('no spike');
	await control(page, 'inh').fill('0');
	await control(page, 'spread').fill('8');
	await expect(stage(page)).toContainText('no spike');
});

test('the spike appears as the trace reaches it', async ({ page }) => {
	await page.clock.install();
	await page.goto('./neurons/#adding');
	await control(page, 'exc').fill('4');
	await playUntil(page, stage(page), 'it fires: a full spike', 10_000);
});

test('each receiving cell answers its own pattern, and a stronger connection changes it', async ({
	page
}) => {
	await open(page, './neurons/#circuit');
	// Inputs 1 and 2: A fires, B is held down.
	await expect(stage(page)).toContainText('A fires');
	await expect(stage(page)).toContainText('B silent');
	// Inputs 2 and 3: B fires.
	await toggle(page, 'in1').uncheck({ force: true });
	await toggle(page, 'in3').check({ force: true });
	await expect(stage(page)).toContainText('B fires');
	await expect(stage(page)).toContainText('A silent');
	// Inputs 1 and 3 fire A only once 3 → A is strengthened.
	await toggle(page, 'in1').check({ force: true });
	await toggle(page, 'in2').uncheck({ force: true });
	await expect(stage(page)).toContainText('A silent');
	await control(page, 'w3a').fill('2');
	await expect(stage(page)).toContainText('A fires');
});
