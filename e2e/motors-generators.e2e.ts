import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');

test('holding the coil: the torque is zero at the dead points and largest along the field', async ({
	page
}) => {
	await page.goto('./motors-generators/#force');
	await page.locator('input[type=range][data-control=current]').fill('1');
	await expect(stage(page)).toContainText('5.00 N');
	const crank = page.getByRole('slider', { name: /Coil angle/ });
	await crank.focus();
	await page.keyboard.press('Home');
	await expect(stage(page)).toContainText('0°');
	await expect(stage(page)).toContainText('dead point: no torque');
	await expect(stage(page)).toContainText('0.00 N·m');
	// 18 presses of 5°: the coil lies along the field, and the torque is N·B·I·A = 0.50 N·m.
	for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowRight');
	await expect(stage(page)).toContainText('90°');
	await expect(stage(page)).toContainText('0.50 N·m ↺');
	// Past 180° the same current turns it backwards.
	await page.locator('input[type=range][data-control=angle]').fill('270');
	await expect(stage(page)).toContainText('0.50 N·m ↻');
});

test('without a commutator the motor stops at a dead point; with one it keeps turning', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./motors-generators/#stuck');
	await playUntil(page, stage(page), 'dead point: no torque', 15000);
	await expect(stage(page)).toContainText('0.00 turns/s');

	await page.goto('./motors-generators/#commutator');
	await page.clock.runFor(8000);
	await expect(stage(page)).toContainText(/0\.[6-9]\d turns\/s/);
	// Started across the field, it never moves.
	await page.locator('button[data-control=start][data-value=upright]').click();
	await page.clock.runFor(3000);
	await expect(stage(page)).toContainText('0.00 turns/s');
	await expect(stage(page)).toContainText('dead point: no torque');
});

test('the commutator gives a voltage that never reverses; slip rings an alternating one', async ({
	page
}) => {
	await page.clock.install();
	await page.goto('./motors-generators/#dc');
	const voltage = stage(page).getByText(/ V$/).nth(0);
	const readings = async () => {
		const seen: string[] = [];
		for (let i = 0; i < 12; i++) {
			await page.clock.runFor(90);
			seen.push((await voltage.textContent()) ?? '');
		}
		return seen;
	};
	const dc = await readings();
	expect(dc.some((v) => v.startsWith('−'))).toBe(false);
	await page.locator('button[data-control=connection][data-value=slip]').click();
	const ac = await readings();
	expect(ac.some((v) => v.startsWith('−'))).toBe(true);
});
