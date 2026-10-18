import { expect, test, type Page } from '@playwright/test';

// The cerebellum explainer: what a visitor sees when reaching under a rotated or hidden cursor
// (with a pointer or the keyboard), as the recovery protocol moves from phase to phase, and on
// the model charts. The model tests check the numbers.
const stage = (page: Page) => page.locator('.stage svg > g');
const workspace = (page: Page) => page.getByRole('slider', { name: /Workspace/ });
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

test(
	'a straight reach under the rotation misses by 30°, and turning the hand hits',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./cerebellum-motor-learning/#rotate');
		await expect(stage(page)).toContainText('Reach: cursor rotated 30°');
		await workspace(page).focus();
		await page.keyboard.press('Enter');
		await expect(stage(page)).toContainText('missed by 30° counter-clockwise');
		await expect(stage(page)).toContainText('your reaches (1)');
		// 15 × 2° clockwise cancels the rotation
		for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
		await page.keyboard.press('Enter');
		await expect(stage(page)).toContainText('hit');
		await expect(stage(page)).toContainText('your reaches (2)');
	}
);

test('a pointer drag is a reach, its cursor turned by the rotation', async ({ page }) => {
	await page.goto('./cerebellum-motor-learning/#rotate');
	const box = await workspace(page).boundingBox();
	if (!box) throw new Error('no workspace');
	const k = box.width / 480; // pixels per scene unit
	const x = box.x + box.width / 2;
	const y = box.y + box.height * 0.8;
	await page.mouse.move(x, y);
	await page.mouse.down();
	// straight up, toward the first target, a little past the 280-unit ring
	for (let i = 1; i <= 10; i++) await page.mouse.move(x, y - (i / 10) * 300 * k);
	await page.mouse.up();
	await expect(stage(page)).toContainText('missed by 30° counter-clockwise');
	// a press without a movement to the ring is no reach
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x, y - 50 * k);
	await page.mouse.up();
	await expect(stage(page)).toContainText('your reaches (1)');
});

test('reaches carry across steps until cleared; the aftereffect block hides the cursor', async ({
	page
}) => {
	await page.goto('./cerebellum-motor-learning/#rotate');
	await workspace(page).focus();
	await page.keyboard.press('Enter');
	await page.getByRole('button', { name: 'Next' }).first().click();
	await expect(stage(page)).toContainText('rotation off, cursor hidden');
	await workspace(page).focus();
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('recorded (no cursor)');
	await expect(stage(page)).toContainText('your reaches (2)');
	// the chart doesn't give away the hidden reach until asked
	await expect(stage(page)).toContainText('kept hidden until you ask');
	await page.getByRole('button', { name: 'Show my hidden reaches' }).click();
	await expect(stage(page)).not.toContainText('kept hidden until you ask');
	await page.getByRole('button', { name: 'Clear my reaches' }).click();
	await expect(stage(page)).toContainText('your reaches (0)');
});

test('the recovery step: rotated, reversed until the hand is straight, then hidden', async ({
	page
}) => {
	await page.goto('./cerebellum-motor-learning/#recover');
	await expect(stage(page)).toContainText('rotated 30° again · 30 to go');
	await workspace(page).focus();
	for (let i = 0; i < 15; i++) await page.keyboard.press('ArrowRight');
	for (let i = 0; i < 30; i++) await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('rotated 30° the other way');
	// still turned against the first rotation: the reversal goes on
	await page.keyboard.press('Enter');
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('rotated 30° the other way');
	// back to straight
	await page.keyboard.press('Home');
	await page.keyboard.press('Enter');
	await expect(stage(page)).toContainText('Reach: cursor hidden');
});

test('the one-rate chart follows retention and error sensitivity', async ({ page }) => {
	await page.goto('./cerebellum-motor-learning/#error-rule');
	await expect(stage(page)).toContainText('time constant: 43 reaches');
	await expect(stage(page)).toContainText('plateau: 17° of 30°');
	// no error sensitivity, no learning, whatever the retention
	await range(page, 'B').focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('time constant: no learning');
	await expect(stage(page)).toContainText('plateau: 0° of 30°');
	await range(page, 'A').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('plateau: 0° of 30°');
	// perfect retention closes the whole gap
	await range(page, 'B').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('plateau: 30° of 30°');
});

test('the two-rate model rebounds when the errors are hidden; a patient learns less', async ({
	page
}) => {
	await page.goto('./cerebellum-motor-learning/#recovery');
	await expect(stage(page)).toContainText('reversed 4 reaches: sum crossed zero (−0.7°)');
	await expect(stage(page)).toContainText('rebound: 13°');
	await page.goto('./cerebellum-motor-learning/#patients');
	await expect(stage(page)).toContainText('patient: 14° after 150 reaches');
	await range(page, 'damage').focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('patient: 22° after 150 reaches');
});
