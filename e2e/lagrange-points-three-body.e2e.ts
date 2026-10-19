// Browser tests of the lagrange-points-three-body page: the five points of a chosen pair (Sun–Earth
// L1 and L2 1.5 million km from Earth), the pulls at L1 and L2 against a one-year circle, the
// gates the energy slider opens, a probe drifting off L1 by a factor e every 23 days, a
// Sun–Jupiter tadpole with its 148-year swing, Routh's limit, the drop handle, and two probes a
// nudge apart splitting. Reduced motion (each run shown whole), keyboard and select controls.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control="${id}"][data-value="${value}"]`).click();
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test(
	'the five points move with the pair: Sun–Earth L1 and L2 lie 1.5 million km from Earth',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./lagrange-points-three-body/#points');
		await expect(stage(page)).toContainText('L1: 58,000 km from the Moon');
		await expect(stage(page)).toContainText('L2: 64,500 km beyond it');
		await choose(page, 'system', 'sun-earth');
		await expect(stage(page)).toContainText('L1: 1.50 million km from Earth');
		await expect(stage(page)).toContainText('L2: 1.51 million km beyond it');
		// a preset drives the (disabled) mass-ratio slider
		await expect(range(page, 'logmu')).toBeDisabled();
		await expect(range(page, 'logmu')).toHaveValue('-5.52');
		await choose(page, 'system', 'custom');
		await expect(range(page, 'logmu')).toBeEnabled();
		await key(page, 'logmu', 'End');
		await expect(stage(page)).toContainText('L4, L5: 60° ahead and behind, unstable');
	}
);

test('L1 is where the pulls give a one-year orbit, not where they cancel', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#balance');
	await expect(stage(page)).toContainText('260,400 km from Earth');
	await expect(stage(page)).toContainText('Sun’s pull 6.051');
	await expect(stage(page)).toContainText('a one-year circle here needs 5.871');
	await expect(stage(page)).toContainText('the Sun alone: a circle here takes 0.985 yr');
	await expect(stage(page)).toContainText('with Earth’s pull: 1.000 yr, in step with Earth');
});

test('raising the energy opens the gates at L1, L2 and L3 in turn', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#gates');
	await expect(stage(page)).toContainText('every gate shut');
	await expect(stage(page)).toContainText('C at L1 = 3.2003 · shut');
	// exactly at the mark the gate is still shut; just past it, open
	await range(page, 'energy').fill('1');
	await expect(stage(page)).toContainText('every gate shut');
	await range(page, 'energy').fill('1.5');
	await expect(stage(page)).toContainText('gate at L1 open');
	await expect(stage(page)).toContainText('C at L1 = 3.2003 · open');
	await range(page, 'energy').fill('2.5');
	await expect(stage(page)).toContainText('gates at L1 and L2 open');
	await key(page, 'energy', 'End');
	await expect(stage(page)).toContainText('no forbidden region left');
});

test('a probe dropped off Sun–Earth L1 drifts away, by e every 23 days', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#knife-edge');
	await choose(page, 'system', 'sun-earth');
	await expect(stage(page)).toContainText('dropped 1,000 km off L1, at rest');
	await expect(stage(page)).toContainText('×e every 23.0 days');
	await expect(stage(page)).toContainText(/after [0-9.]+ months/);
	await expect(stage(page)).toContainText(/[0-9.,]+ (million )?km from L1/);
});

test('near L4 a probe swings in a tadpole; Jupiter’s takes about 147 years', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#tadpole');
	await choose(page, 'system', 'sun-jupiter');
	await expect(stage(page)).toContainText('one small swing ≈ 147 years');
	await expect(stage(page)).toContainText('still circling L4');
	// the drop handle follows the keyboard and moves the slider
	await page.getByRole('slider', { name: 'Drop point along the orbit' }).focus();
	await page.keyboard.press('End');
	await expect(range(page, 'lead')).toHaveValue('175');
	await expect(stage(page)).toContainText('a horseshoe: past L3 to L5 and back');
	// Pluto and Charon are above Routh's limit: no tadpole
	await choose(page, 'system', 'pluto-charon');
	await key(page, 'lead', 'Home');
	await expect(stage(page)).toContainText('above Routh’s limit');
	await expect(stage(page)).toContainText(/it (left the orbit|hit)/);
});

test('past Routh’s limit, about 1 in 26, the same probe escapes', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#routh');
	await expect(stage(page)).toContainText('L4 is stable (linear theory)');
	await expect(stage(page)).toContainText('still circling L4');
	await key(page, 'routhMu', 'End');
	await expect(stage(page)).toContainText('27μ(1 − μ) = 1.523 > 1');
	await expect(stage(page)).toContainText('L4 is unstable (linear theory)');
	await expect(stage(page)).toContainText('it left L4 after');
});

test('two probes a nudge apart split; a smaller nudge only delays it', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#split');
	await expect(stage(page)).toContainText('day 365');
	await expect(stage(page)).toContainText(/10,000 km apart on day 2[0-9]{2}/);
	await key(page, 'nudge', 'Home');
	await expect(stage(page)).toContainText('B started 1 m from A');
	await expect(stage(page)).toContainText(/10,000 km apart on day 3[0-9]{2}/);
});

test('the turning frame can be switched off', async ({ page }) => {
	await page.goto('./lagrange-points-three-body/#frame');
	await expect(stage(page)).toContainText('turning with the two bodies: they stand still');
	await expect(stage(page)).toContainText('one turn: 27.3 days');
	await page.locator('input[type=checkbox][data-control="rotating"]').focus();
	await page.keyboard.press('Space');
	await expect(stage(page)).toContainText('from the stars: the two circle their centre of mass');
});

test.describe('in motion', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('a Jupiter tadpole goes on for as long as the reader waits', async ({ page }) => {
		await page.clock.install();
		await page.goto('./lagrange-points-three-body/#tadpole');
		await choose(page, 'system', 'sun-jupiter');
		// one stretch of the run is about 660 years; it goes on past it, still circling
		await playUntil(page, stage(page), /after 1,[0-9]{3} years/, 90_000);
		await expect(stage(page)).toContainText('still circling L4');
	});
});
