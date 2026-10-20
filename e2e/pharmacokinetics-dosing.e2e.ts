// Browser tests of the pharmacokinetics page: the half-life follows clearance and volume; a drip's
// plateau follows its rate while the time to reach it does not; a doubled digoxin dose doubles
// the plateau and reaches 90% of it on the same day; a loading dose gets there on day one;
// failing kidneys double lithium's level and its half-life; phenytoin's level jumps far more
// than its dose; and the palette adds and removes doses where the cursor says. Reduced motion
// shows each regimen whole.
import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
async function key(page: Page, id: string, k: string, times = 1) {
	await range(page, id).focus();
	for (let i = 0; i < times; i++) await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test(
	'one injection: the half-life is 0.693 × V / CL, and says so',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./pharmacokinetics-dosing/#one-dose');
		await expect(stage(page)).toContainText('half-life = 0.693 × V / CL = 8.0 hours');
		await expect(stage(page)).toContainText('starts at 10 mcg/mL');
		await expect(page.getByText('It is not dosing advice').first()).toBeVisible();
		// twice the clearance: half the half-life
		await key(page, 'cl1', 'End');
		await expect(stage(page)).toContainText('CL = 5.5 L/h');
		await expect(stage(page)).toContainText('= 4.0 hours');
		// and half the volume on top: a quarter, starting twice as high
		await key(page, 'v1', 'Home');
		await expect(stage(page)).toContainText('= 2.0 hours');
		await expect(stage(page)).toContainText('starts at 20 mcg/mL');
	}
);

test('a drip: the rate sets the plateau, the half-life sets the time', async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#drip');
	await expect(stage(page)).toContainText('plateau = rate ÷ CL = 10 mcg/mL');
	await expect(stage(page)).toContainText('94% of the plateau after 4 half-lives, 32 hours');
	await key(page, 'rate4', 'End');
	await expect(stage(page)).toContainText('drip of 56 mg/h: plateau = rate ÷ CL = 21 mcg/mL');
	await expect(stage(page)).toContainText('94% of the plateau after 4 half-lives, 32 hours');
	await key(page, 'rate4', 'Home');
	await key(page, 'rate4', 'ArrowRight', 2);
	await toggle(page, 'load4').check();
	// the label's loading dose: about 10 mcg/mL once it is in
	await expect(stage(page)).toContainText('320 mg loading dose: 10 mcg/mL after 30 minutes');
});

test('doubling digoxin doubles the plateau but reaches it no sooner', async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#double');
	await expect(stage(page)).toContainText('digoxin 250 mcg a day: steady average 0.90 ng/mL');
	await expect(stage(page)).toContainText('90% of its own plateau after 6.0 days');
	await toggle(page, 'dbl5').check();
	await expect(stage(page)).toContainText('digoxin 500 mcg a day: steady average 1.8 ng/mL');
	await expect(stage(page)).toContainText('90% of its own plateau after 6.0 days');
});

test('a loading dose of digoxin is near the plateau after one day', async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#loading');
	await expect(stage(page)).toContainText('after day 1: 36% of the plateau');
	await toggle(page, 'load6').check();
	await expect(stage(page)).toContainText(
		/after day 1: (9\d|1[01]\d)% of the plateau \(without loading: 36%\)/
	);
});

test('kidneys at half: lithium’s level and half-life double', async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#kidney');
	await expect(stage(page)).toContainText('kidneys at 100%: average 1.0 mEq/L');
	await expect(stage(page)).toContainText('half-life 30 hours');
	await key(page, 'kid7', 'ArrowLeft', 2);
	await expect(stage(page)).toContainText('kidneys at 50%: average 2.1 mEq/L');
	await expect(stage(page)).toContainText('half-life 2.5 days: 94% of the way after 10 days');
});

test('phenytoin: a third more drug, more than twice the level', async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#saturable');
	await expect(stage(page)).toContainText(
		'phenytoin 300 mg a day (saturable): steady average 5.2 mcg/mL'
	);
	await key(page, 'dose9', 'ArrowRight', 2);
	await expect(stage(page)).toContainText(
		'phenytoin 400 mg a day (saturable): steady average 12 mcg/mL'
	);
	// a linear drug that matches it at 300 mg would rise by a third only
	await toggle(page, 'sat9').uncheck();
	await expect(stage(page)).toContainText(
		'phenytoin 400 mg a day (linear): steady average 6.9 mcg/mL'
	);
});

test('the palette places and removes doses at the cursor', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./pharmacokinetics-dosing/#build');
	await expect(stage(page)).toContainText('theophylline (asthma): 9 doses');
	// remove the dose at hour 8 (a missed dose)
	await page.getByRole('button', { name: /Remove the tablet of 300 mg at hour 8$/ }).click();
	await expect(stage(page)).toContainText('theophylline (asthma): 8 doses');
	// move the cursor to the end with the keyboard, add a drip there
	await page.getByRole('slider', { name: 'Cursor: where the next dose goes' }).focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('cursor at hour 71');
	await page.getByRole('button', { name: 'Add a drip, 24 h at hour 71' }).click();
	await expect(stage(page)).toContainText('theophylline (asthma): 9 doses');
	// vancomycin is not absorbed by mouth and has no target range on its label
	await choose(page, 'drug8', 'vancomycin');
	await expect(stage(page)).toContainText('vancomycin (antibiotic, IV): 6 doses');
	await expect(stage(page)).toContainText('the label gives no target range');
	await expect(page.getByRole('button', { name: /tablet: not absorbed by mouth/ })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await page.getByRole('button', { name: 'Remove every dose' }).click();
	await expect(stage(page)).toContainText('vancomycin (antibiotic, IV): 0 doses');
	await page.getByRole('button', { name: 'Restore the usual regimen' }).click();
	await expect(stage(page)).toContainText('vancomycin (antibiotic, IV): 6 doses');
});
