import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');

test('the natural frequency halves when the mass is four times larger', async ({ page }) => {
	await page.goto('./oscillations-resonance/#spring');
	await expect(stage(page)).toContainText('natural frequency');
	await expect(stage(page)).toContainText('0.99 Hz');
	await page.locator('input[type=range][data-control=mass]').fill('4');
	await expect(stage(page)).toContainText('0.50 Hz');
	await expect(stage(page)).toContainText('4.00 kg');
});

test('the resonance curve peaks at the natural frequency', async ({ page }) => {
	await page.goto('./oscillations-resonance/#curve');
	await expect(stage(page)).toContainText('steady swing against push frequency');
	await expect(stage(page)).toContainText('peak at 0.99 Hz');
	// More friction lowers the peak and moves it a little below f₀.
	await page.locator('input[type=range][data-control=damping]').fill('3');
	await expect(stage(page)).toContainText('peak at 0.93 Hz');
	// Strong friction (damping ratio above 1/√2) removes the peak, as the narrative says.
	await page.locator('input[type=range][data-control=damping]').fill('15');
	await expect(stage(page)).toContainText('no peak');
});

const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('the curve: "right on it" only when the swing is near its peak size', async ({ page }) => {
	await page.goto('./oscillations-resonance/#curve');
	await expect(stage(page)).toContainText('peak at 0.99 Hz');
	await range(page, 'pushFreq').fill('0.99');
	await expect(stage(page)).toContainText('your push is right on it');
	// 0.1 Hz off: the steady swing is about a fifth of the peak's
	await range(page, 'pushFreq').fill('0.89');
	await expect(stage(page)).toContainText('your push');
	await expect(stage(page)).not.toContainText('right on it');
});

test('the curve without friction: the push marker says it never settles', async ({ page }) => {
	await page.goto('./oscillations-resonance/#curve');
	await expect(stage(page)).toContainText('peak at 0.99 Hz');
	await range(page, 'damping').fill('0');
	await expect(stage(page)).toContainText('your push: never settles');
});

test('damping: mass and stiffness can be set on the step, so "no swing" is always reachable', async ({
	page
}) => {
	await page.goto('./oscillations-resonance/#spring');
	await range(page, 'mass').fill('4');
	await range(page, 'stiffness').fill('160');
	await page.goto('./oscillations-resonance/#damping');
	await expect(stage(page)).toContainText('damping ratio');
	await range(page, 'mass').fill('1');
	await range(page, 'stiffness').fill('39');
	await range(page, 'damping').fill('15');
	await expect(stage(page)).toContainText('creeps back, no swing');
});

test('light friction: the swing keeps dying away after the first two minutes', async ({ page }) => {
	await page.clock.install();
	await page.goto('./oscillations-resonance/#damping');
	await expect(stage(page)).toContainText('damping ratio');
	await range(page, 'mass').fill('4');
	await range(page, 'damping').fill('0.05');
	await page
		.getByRole('radiogroup', { name: 'Playback speed' })
		.getByRole('radio', { name: '2×' })
		.click();
	// Energy halves about every 55 s: about 22% is left at two minutes, under 10% after ~3.
	// The stage clock takes at most 0.1 s per frame, so jump the fake clock 100 ms at a time
	// (one frame each) rather than playing every 16 ms frame.
	const single = /energy left\s*\d%/;
	for (let i = 0; i < 1200 && !single.test((await stage(page).textContent()) ?? ''); i++) {
		for (let j = 0; j < 20; j++) await page.clock.fastForward(100);
	}
	await expect(stage(page)).toContainText(single);
});

test('the resonance curve: each push tried leaves a dot, and a stiffer spring moves the peak', async ({
	page
}) => {
	await page.goto('./oscillations-resonance/#push');
	await expect(stage(page)).toContainText('1 kg on 39 N/m');
	for (const f of ['0.8', '0.99', '1.2']) await range(page, 'pushFreq').fill(f);
	await page.goto('./oscillations-resonance/#curve');
	await expect(stage(page)).toContainText('pushes tried, as simulated');
	// the first push (0.6 Hz) and the three tried; trying one again adds nothing
	await expect(stage(page).locator('circle.tried')).toHaveCount(4);
	await range(page, 'pushFreq').fill('0.99');
	await expect(stage(page).locator('circle.tried')).toHaveCount(4);
	// a different spring has a different curve: the dots start again
	await range(page, 'stiffness').fill('100');
	await expect(stage(page)).toContainText('1 kg on 100 N/m');
	await expect(stage(page)).toContainText('peak at 1.59 Hz');
	await expect(stage(page).locator('circle.tried')).toHaveCount(1);
	// the push step runs on the same spring, with the control there to show it
	await page.goto('./oscillations-resonance/#push');
	await expect(range(page, 'stiffness')).toHaveValue('100');
	await expect(stage(page)).toContainText('1.59 Hz');
});
