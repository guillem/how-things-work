import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string) {
	// reduced motion: a complete, frozen frame
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test('the wind carries eight times the power at twice the speed', async ({ page }) => {
	await open(page, './wind-turbine-aerodynamics/#wind');
	await expect(stage(page)).toContainText(/Power per m²\s*613 W/);
	await expect(stage(page)).toContainText(/Through the 126 m rotor\s*7\.64 MW/);
	await range(page, 'v').fill('20');
	await expect(stage(page)).toContainText(/Power per m²\s*4\.9 kW/);
	await expect(stage(page)).toContainText(/Through the 126 m rotor\s*61\.1 MW/);
});

test(
	'the actuator disc takes at most 16/27 of the power, at a third',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './wind-turbine-aerodynamics/#betz');
		await range(page, 'a').fill('0.335');
		await expect(stage(page)).toContainText(/Power coefficient CP\s*0\.593/);
		await expect(stage(page)).toContainText(/Air in the far wake\s*0\.330 V/);
		await expect(stage(page)).toContainText(/100% of the Betz limit/);
		// Slowing the air harder (with the handle on the disc) takes less.
		const handle = page.getByRole('slider', { name: 'Speed of the air at the disc' });
		await handle.focus();
		await handle.press('End');
		await expect(range(page, 'a')).toHaveValue('0.5');
		await expect(stage(page)).toContainText(/Power coefficient CP\s*0\.500/);
		await expect(stage(page)).toContainText(/far wake: stopped \(theory fails\)/);
		await handle.press('Home');
		await expect(stage(page)).toContainText(/Power coefficient CP\s*0\.000/);
	}
);

test('above a = 0.4 the measured thrust leaves momentum theory', async ({ page }) => {
	await open(page, './wind-turbine-aerodynamics/#thrust');
	await range(page, 'a').fill('0.3');
	await expect(stage(page)).toContainText(/Thrust coefficient CT\s*0\.840/);
	await range(page, 'a').fill('0.45');
	await expect(stage(page)).toContainText(/CT theory \/ empirical\s*0\.99 \/ 1\.00/);
});

test('a blade section stalls at a low tip-speed ratio', async ({ page }) => {
	await open(page, './wind-turbine-aerodynamics/#section');
	await expect(stage(page)).toContainText(/Angle of attack α\s*4\.2°/);
	await range(page, 'lambda').fill('2');
	await expect(stage(page)).toContainText(/Angle of attack α\s*31\.2° · stalled/);
	// Pitching the blade toward feather lowers the angle of attack by as much.
	await range(page, 'lambda').fill('7.5');
	await range(page, 'pitch').fill('3');
	await expect(stage(page)).toContainText(/Twist \+ pitch\s*3\.1° \+ 3\.0°/);
});

test('along the blade: stalled at λ = 3, none stalled at 7.5; tip loss costs power', async ({
	page
}) => {
	await open(page, './wind-turbine-aerodynamics/#span');
	await expect(stage(page)).toContainText(/Elements stalled\s*0 of 13/);
	await expect(stage(page)).toContainText(/Rotor CP\s*0\.492/);
	await range(page, 'lambda').fill('3');
	await expect(stage(page)).toContainText(/Elements stalled\s*13 of 13/);
	await range(page, 'lambda').fill('7.5');
	await page.locator('input[type=checkbox][data-control=tipLoss]').uncheck({ force: true });
	await expect(stage(page)).toContainText(/Rotor CP\s*0\.52\d/);
});

test('the rotor peaks below the Betz limit near λ = 7.7', async ({ page }) => {
	await open(page, './wind-turbine-aerodynamics/#cp-lambda');
	await expect(stage(page)).toContainText(/peak 0\.493 at λ = 7\.7/);
	const handle = page.getByRole('slider', { name: 'Tip-speed ratio' });
	await handle.focus();
	await handle.press('End');
	await expect(range(page, 'lambda')).toHaveValue('14');
	await range(page, 'pitch').fill('5');
	await expect(stage(page)).toContainText(/peak 0\.\d+ at λ/);
	const text = (await stage(page).textContent()) ?? '';
	const peak = Number(/peak (0\.\d+) at/.exec(text)?.[1]);
	expect(peak).toBeLessThan(0.45);
});

test('the power curve: cube law, 5 MW held by pitch, parked past cut-out', async ({ page }) => {
	await open(page, './wind-turbine-aerodynamics/#power-curve');
	await expect(stage(page)).toContainText(/Electrical output\s*3\.55 MW/);
	await expect(stage(page)).toContainText(/Controller\s*holding the best λ/);
	await range(page, 'v').fill('7');
	await expect(stage(page)).toContainText(/Electrical output\s*1\.22 MW/);
	await range(page, 'v').fill('25');
	await expect(stage(page)).toContainText(/Electrical output\s*5\.00 MW/);
	await expect(stage(page)).toContainText(/Blade pitch\s*23\.2°/);
	const handle = page.getByRole('slider', { name: 'Wind speed' });
	await handle.focus();
	await handle.press('ArrowRight');
	await expect(stage(page)).toContainText(/Controller\s*parked/);
	await expect(stage(page)).toContainText(/Electrical output\s*0 W/);
});
