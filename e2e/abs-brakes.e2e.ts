import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('curve: the slip sets the friction, and each road has its own peak', async ({ page }) => {
	await open(page, './abs-brakes/#curve', 'peak 1.17 at 17%');
	await page.locator('input[type=range][data-control=slip]').fill('1');
	await expect(stage(page)).toContainText('locked: the tyre slides');
	await expect(stage(page)).toContainText('μ = 0.76');
	await page.locator('[data-control=surface][data-value=snow]').click();
	await expect(stage(page)).toContainText('peak 0.19 at 6%');
});

test('lock: a full press without ABS locks the wheel and stops in 52 m on dry asphalt', async ({
	page
}) => {
	await open(page, './abs-brakes/#lock', 'stopped in 52 m');
	await expect(stage(page)).toContainText('wheel locked');
});

test('threshold: the dry-road pedal locks the wheel on snow', async ({ page }) => {
	await open(page, './abs-brakes/#threshold', 'stopped in');
	await page.locator('input[type=range][data-control=pedal]').fill('0.53');
	await expect(stage(page)).toContainText('stopped in 36 m');
	await expect(stage(page)).not.toContainText('wheel locked');
	await page.locator('[data-control=surface][data-value=snow]').click();
	await expect(stage(page)).toContainText('wheel locked');
});

test('abs: the same full press stops in 40 m with ABS and locks the wheel without it', async ({
	page
}) => {
	await open(page, './abs-brakes/#abs', 'stopped in 40 m');
	await expect(stage(page)).not.toContainText('wheel locked');
	await page.locator('input[type=checkbox][data-control=abs]').uncheck();
	await expect(stage(page)).toContainText('stopped in 52 m');
	await expect(stage(page)).toContainText('wheel locked');
});

test('compare: ABS stops shorter than a locked wheel but not shorter than the floor', async ({
	page
}) => {
	await open(page, './abs-brakes/#compare', 'Wheel locked');
	await expect(stage(page)).toContainText('52 m');
	await expect(stage(page)).toContainText('40 m');
	await expect(stage(page)).toContainText('34 m');
});

test('steer: with ABS the car swerves past; without, it slides straight into the stopped car', async ({
	page
}) => {
	await open(page, './abs-brakes/#steer', 'swerves past');
	await page.locator('input[type=checkbox][data-control=abs]').uncheck();
	await expect(stage(page)).toContainText('hits the stopped car');
	await expect(stage(page)).toContainText('wheels locked: steering does nothing');
	// On wet asphalt even ABS can't get round a car this close.
	await page.locator('input[type=checkbox][data-control=abs]').check();
	await page.locator('[data-control=surface][data-value=wet]').click();
	await expect(stage(page)).toContainText('hits the stopped car');
	await expect(stage(page)).toContainText('steering works');
});
