import { expect, test, type Page } from '@playwright/test';

// The chemotaxis explainer: what a visitor sees when they flood the dish, change the
// concentration and gradient of the Berg–Purcell comparison, and switch the methylation off in
// the dish. Reduced motion shows each scene's complete, settled frame. The model tests check the
// numbers themselves.
const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
/** The number after `prefix` in the stage's text. */
const read = async (page: Page, prefix: string) => {
	const text = (await stage(page).textContent()) ?? '';
	const m = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*([\\d.]+)`).exec(text);
	if (!m) throw new Error(`no "${prefix}" in the stage`);
	return Number(m[1]);
};

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('flooding the dish: the activity returns exactly to rest, whatever the dose', async ({
	page
}) => {
	await page.goto('./bacterial-chemotaxis/#flood');
	await expect(stage(page)).toContainText('flooded to 40 µM');
	await expect(stage(page)).toContainText('activity 0.33');
	await range(page, 'dose').fill('200');
	await expect(stage(page)).toContainText('flooded to 200 µM');
	await expect(stage(page)).toContainText('activity 0.33');
	expect(await read(page, 'methyl')).toBeGreaterThan(1.8);
});

test('across the body the change is lost in the noise; along a run it is clear', async ({
	page
}) => {
	await page.goto('./bacterial-chemotaxis/#too-small');
	await expect(stage(page)).toContainText('ratio 0.8: lost in the noise');
	await expect(stage(page)).toContainText('ratio 11: clear');
	await range(page, 'glen').fill('5');
	await expect(stage(page)).toContainText('changing e-fold over 5.0 mm');
	await expect(stage(page)).toContainText('ratio 0.2: lost in the noise');
});

test(
	'the swarm gathers at the drop, with longer runs towards it',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./bacterial-chemotaxis/#drop');
		await expect(stage(page)).toContainText('5 min 00 s after release');
		expect(await read(page, 'within 0.3 mm of the drop:')).toBeGreaterThan(75);
		await page.goto('./bacterial-chemotaxis/#runs');
		await expect(stage(page)).toContainText('runs starting towards the drop:');
		const toward = await read(page, 'runs starting towards the drop:');
		const away = await read(page, 'away:');
		expect(toward).toBeGreaterThan(1.5 * away);
	}
);

test('without methylation the cells stay spread out', async ({ page }) => {
	await page.goto('./bacterial-chemotaxis/#no-adapt');
	await expect(stage(page)).toContainText('methylation on');
	const toggle = page.locator('input[type=checkbox][data-control=adapt]');
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).not.toBeChecked();
	await expect(stage(page)).toContainText('methylation off');
	expect(await read(page, 'within 0.3 mm of the drop:')).toBeLessThan(30);
});

test('the drop can be moved from the keyboard, and the cells follow it', async ({ page }) => {
	await page.goto('./bacterial-chemotaxis/#drop');
	await page.getByRole('slider', { name: 'Drop of attractant' }).press('Home');
	await expect(range(page, 'dropX')).toHaveValue('200');
	await expect(stage(page)).toContainText('5 min 00 s after release');
	expect(await read(page, 'within 0.3 mm of the drop:')).toBeGreaterThan(60);
});
