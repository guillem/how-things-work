import { expect, test, type Page } from '@playwright/test';

// The ECG explainer: what a visitor reads on the stage as they change the sinus rate, weaken the
// AV node, slow the ventricles, shock a fibrillating sheet or a flat line, and the real records.
// Reduced motion shows each run at a fixed heart time (deterministic); the model tests check the
// physiology itself.
const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
/** The ventricles' rate on the stage, a minute. */
const ventricles = async (page: Page) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(/ventricles (\d+) a minute/);
	if (!m) throw new Error('no ventricular rate on the stage');
	return Number(m[1]);
};

// Each step simulates seconds of a 2D sheet of heart tissue as it opens (up to 13 s on CI's runner):
// run this file's tests one after another in one worker, so they don't starve each other and the
// rest of the suite of CPU.
test.describe.configure({ mode: 'default' });

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('the ventricles follow the sinus node one for one', { tag: '@smoke' }, async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#wave');
	await expect(stage(page)).toContainText('atria 75 a minute · ventricles 75 a minute');
	await expect(stage(page)).toContainText('PR 1');
	await range(page, 'rate').fill('120');
	await expect(stage(page)).toContainText('atria 120 a minute');
	await expect.poll(async () => Math.abs((await ventricles(page)) - 120)).toBeLessThan(3);
});

test('the three leads obey Einthoven’s law', async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#leads');
	const text = (await stage(page).textContent()) ?? '';
	const m = text.match(/I \+ III = (-?[\d.]+) mV, II = (-?[\d.]+) mV/);
	expect(m).not.toBeNull();
	expect(Math.abs(Number(m![1]) - Number(m![2]))).toBeLessThanOrEqual(0.011);
});

test('a weaker AV node drops beats, then leaves only the escape rhythm', async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#block');
	await expect(stage(page)).toContainText('ventricles 75 a minute');
	await range(page, 'av').fill('0.3');
	await expect(stage(page)).toContainText('atria 75 a minute');
	await expect(stage(page)).not.toContainText('ventricles 75 a minute');
	const half = await ventricles(page);
	expect(half).toBeGreaterThan(30);
	expect(half).toBeLessThan(45);
	await range(page, 'av').fill('0');
	// the escape pacemaker, every 1.5 s: about 40 a minute
	await expect.poll(async () => Math.abs((await ventricles(page)) - 40)).toBeLessThan(4);
});

test('an early beat into slowed, scarred ventricles starts a fast rhythm', async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#reentry');
	await expect(stage(page)).toContainText('atria 75 a minute');
	await expect.poll(() => ventricles(page)).toBeGreaterThan(150);
	// healthy ventricles: the same beat leaves nothing behind
	await toggle(page, 'slow').focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, 'slow')).not.toBeChecked();
	await expect.poll(() => ventricles(page)).toBeLessThan(100);
});

test('the shock clears fibrillation; a flat line stays flat', async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#shock');
	await expect(stage(page)).toContainText('after the shock');
	await expect(stage(page)).toContainText('shock');
	await page.goto('./ecg-arrhythmias/#flatline');
	await expect(stage(page)).toContainText('shocked: still no rhythm');
	await expect(stage(page)).toContainText('atria none · ventricles none');
});

test('the real recordings are listed with their records', async ({ page }) => {
	await page.goto('./ecg-arrhythmias/#records');
	for (const [title, rec] of [
		['Normal sinus rhythm', '100'],
		['Ventricular premature beats', '119'],
		['2:1 AV block', '231'],
		['Ventricular tachycardia', '205'],
		['Ventricular flutter', '207']
	]) {
		await expect(stage(page)).toContainText(title);
		await expect(stage(page)).toContainText(`MIT-BIH record ${rec},`);
	}
});

test('on a phone the rates are listed under the stage', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('./ecg-arrhythmias/#block');
	const panel = page.getByRole('group', { name: 'Readouts' });
	await expect(panel).toContainText('Atria · ventricles');
	await expect(panel).toContainText('75 a minute');
	await expect(panel).toContainText('MIT-BIH record 231');
});
