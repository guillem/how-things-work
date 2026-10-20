import { expect, test, type Page } from '@playwright/test';

// Reduced motion: every scene shows its complete run, so the readouts are final.
test.use({ reducedMotion: 'reduce' });

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

test('cruise control: P alone settles short of 90 km/h; a bigger gain gets closer', async ({
	page
}) => {
	await page.goto('./feedback-control/#offset');
	await expect(stage(page)).toContainText('settles at');
	await expect(stage(page)).toContainText('87.4 km/h');
	await expect(stage(page)).toContainText('error 2.6 km/h, for good');
	await range(page, 'carKp').fill('20');
	await expect(stage(page)).toContainText('88.7 km/h');
});

test('windup: anti-windup keeps the integral from piling up on the climb', async ({ page }) => {
	await page.goto('./feedback-control/#windup');
	const largest = async () =>
		Number(/largest (\d+)%/.exec((await stage(page).textContent()) ?? '')?.[1]);
	await expect(stage(page)).toContainText('largest');
	const wound = await largest();
	expect(wound).toBeGreaterThan(200);
	await toggle(page, 'antiWindup').check();
	await expect.poll(largest).toBeLessThan(150);
});

test('Ziegler–Nichols: the rule turns the ultimate gain into PID gains', async ({ page }) => {
	await page.goto('./feedback-control/#ziegler-nichols');
	await expect(stage(page)).toContainText('Ku ≈ 133, Tu ≈ 2.1 s');
	await range(page, 'znKp').fill('60');
	await expect(stage(page)).toContainText('dying');
	await range(page, 'znKp').fill('180');
	await expect(stage(page)).not.toContainText('dying');
	await toggle(page, 'useZn').check();
	await expect(stage(page)).toContainText('Ziegler–Nichols PID');
	await expect(stage(page)).toContainText('Kp 80');
});

test('drone: the damping ratio follows Kd, and at ζ = 1 there is no overshoot', async ({
	page
}) => {
	await page.goto('./feedback-control/#derivative');
	await expect(stage(page)).toContainText('ζ = 0.50');
	await range(page, 'droneKd').fill('4');
	await expect(stage(page)).toContainText('ζ = 1.00');
	await expect(stage(page)).toContainText('none');
});

test('drone: too much delay makes the loop unstable', async ({ page }) => {
	await page.goto('./feedback-control/#delay');
	await expect(stage(page)).toContainText('delay it survives');
	await expect(stage(page)).toContainText('329 ms');
	await range(page, 'delay').fill('400');
	await expect(stage(page)).toContainText('too late: unstable');
	await range(page, 'delay').fill('100');
	await expect(stage(page)).toContainText(/settl/);
});

test('balancing: below Kp = g the pole falls, above it stands', async ({ page }) => {
	await page.goto('./feedback-control/#balance');
	await expect(stage(page)).toContainText('stands');
	await range(page, 'poleKp').fill('8');
	await expect(stage(page)).toContainText('fell over');
	await range(page, 'poleKp').fill('15');
	await range(page, 'poleKd').fill('0');
	await expect(stage(page)).toContainText('wobbles');
});

test('arm: the hand reaches the target, sags without the integral, and the handle moves it', async ({
	page
}) => {
	await page.goto('./feedback-control/#arm');
	await expect(stage(page)).toContainText('on it');
	await range(page, 'armKi').fill('0');
	await expect(stage(page)).toContainText('sagging: no integral');
	const handle = page.getByRole('slider', { name: 'Target for the hand' });
	await handle.focus();
	await page.keyboard.press('End');
	await expect(range(page, 'armX')).toHaveValue('0.85');
});
