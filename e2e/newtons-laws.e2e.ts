import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, text: string) {
	// Reduced motion freezes the scenes on one complete frame.
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('force: the push and the mass set the acceleration readout', async ({ page }) => {
	await open(page, './newtons-laws/#force', 'a = F ÷ m = 6 ÷ 2 = 3 m/s²');
	await range(page, 'force').fill('10');
	await expect(stage(page)).toContainText('a = F ÷ m = 10 ÷ 2 = 5 m/s²');
	await expect(stage(page)).toContainText('speed 5.0 m/s');
	await range(page, 'mass').fill('4');
	await expect(stage(page)).toContainText('a = F ÷ m = 10 ÷ 4 = 2.5 m/s²');
});

test('inertia: friction slows the cart down', async ({ page }) => {
	await open(page, './newtons-laws/#inertia', 'Friction off');
	await expect(stage(page)).toContainText('No force → constant speed');
	await page.locator('input[type=checkbox][data-control=friction]').check({ force: true });
	await expect(stage(page)).toContainText('Friction on (μ = 0.05)');
	await expect(stage(page)).toContainText('Friction force → slows down');
	await expect(stage(page)).toContainText('the speed drops by 0.49 m/s every second');
});

test('projectile: the launch angle changes range, peak and flight time', async ({ page }) => {
	await open(page, './newtons-laws/#projectile', 'Launched at 18 m/s, 45°');
	await expect(stage(page)).toContainText('range33.0 m');
	await range(page, 'angle').fill('30');
	await expect(stage(page)).toContainText('Launched at 18 m/s, 30°');
	await expect(stage(page)).toContainText('range28.6 m');
	await expect(stage(page)).toContainText('peak height4.1 m');
	await expect(stage(page)).toContainText('flight time1.8 s');
});

test('range: arrow keys on the angle slider change the angle, not the step', async ({ page }) => {
	await open(page, './newtons-laws/#range', 'Launched at 18 m/s, 45°');
	await range(page, 'angle').focus();
	await page.keyboard.press('ArrowRight');
	await expect(range(page, 'angle')).toHaveValue('46');
	await expect(stage(page)).toContainText('Launched at 18 m/s, 46°');
	await expect(page).toHaveURL(/#range$/);
});

test('momentum: a sticky crash loses energy, and the bounciness carries over', async ({ page }) => {
	await open(page, './newtons-laws/#momentum', 'Bounciness 1 (perfectly elastic)');
	await expect(stage(page)).toContainText('The left cart stops dead');
	await range(page, 'bounce').fill('0');
	await expect(stage(page)).toContainText('They stick together and move right at 1.0 m/s.');
	await expect(stage(page)).toContainText(
		'1.00 J of kinetic energy went into denting, heat and sound'
	);
	await page.getByRole('button', { name: 'Next step' }).click();
	await expect(page).toHaveURL(/#bounce$/);
	await expect(range(page, 'bounce')).toHaveValue('0');
	await expect(stage(page)).toContainText('Bounciness 0 (they stick)');
	await page.getByRole('button', { name: 'Previous step' }).click();
	await expect(page).toHaveURL(/#momentum$/);
	await expect(range(page, 'bounce')).toHaveValue('0');
	await expect(stage(page)).toContainText('They stick together');
});
