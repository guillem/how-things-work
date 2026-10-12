import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}

test(
	'light aimed inside 2.6 r_s falls into the hole; aimed wider it is bent and flies on',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './black-holes/#horizon');
		await range(page, 'aim').fill('2.5');
		await expect(stage(page)).toContainText('falls into the hole');
		await range(page, 'aim').fill('3');
		await expect(stage(page)).toContainText(/flies on, bent \d+°/);
		await expect(stage(page)).not.toContainText('falls into the hole');
	}
);

test('the closer the aim to the critical value, the more loops round the photon sphere', async ({
	page
}) => {
	await open(page, './black-holes/#photon-sphere');
	await range(page, 'aimDigits').fill('2');
	await expect(stage(page)).toContainText(/Times round the hole\s*0\.8/);
	await range(page, 'aimDigits').fill('10');
	await expect(stage(page)).toContainText(/Times round the hole\s*3\.\d/);
	await toggle(page, 'aimInside').check({ force: true });
	await expect(stage(page)).toContainText(/Then\s*falls in/);
});

test('lowering the lamp shrinks the cone of light that escapes: half at 1.5 r_s', async ({
	page
}) => {
	await open(page, './black-holes/#no-way-out');
	await range(page, 'lampR').fill('1.5');
	await expect(stage(page)).toContainText(/Light that escapes\s*50%/);
	// Of all the directions round the lamp (the whole sky, not just this plane).
	await range(page, 'lampR').fill('1.02');
	await expect(stage(page)).toContainText(/Light that escapes\s*3%/);
});

test('squeezing the Sun into a black hole leaves the Earth’s orbit unchanged', async ({ page }) => {
	await open(page, './black-holes/#same-mass');
	await expect(stage(page)).toContainText('Round the Sun');
	await expect(stage(page)).toContainText('365.25 days');
	await toggle(page, 'squeeze').check({ force: true });
	await expect(stage(page)).toContainText('Round a black hole');
	await expect(stage(page)).toContainText('5.9 km across');
	await expect(stage(page)).toContainText('29.8 km/s');
	await expect(stage(page)).toContainText('365.25 days');
});

test('close to the hole a probe falls in where Newton predicts a safe ellipse', async ({
	page
}) => {
	await open(page, './black-holes/#close-orbits');
	await range(page, 'probeR').fill('40');
	await expect(stage(page)).toContainText(/Real path\s*stays in orbit/);
	await range(page, 'probeR').fill('4');
	await expect(stage(page)).toContainText(/Real path\s*falls into the hole/);
	await expect(stage(page)).toContainText(/Newton’s path\s*a closed ellipse/);
	// Launched at 4 r_s at Newton's circular speed, it still dives in; at 1.5× it escapes in both.
	await range(page, 'probeK').fill('1');
	await expect(stage(page)).toContainText(/Real path\s*falls into the hole/);
	await expect(stage(page)).toContainText(/Newton’s path\s*a circle/);
	await range(page, 'probeK').fill('1.5');
	await expect(stage(page)).toContainText(/Real path\s*flies off for good/);
	await expect(stage(page)).toContainText(/Newton’s path\s*escapes/);
});

test('circular orbits survive a nudge outside 3 r_s, not inside', async ({ page }) => {
	await open(page, './black-holes/#isco');
	await range(page, 'iscoR').fill('4');
	await expect(stage(page)).toContainText(/Result\s*stays in orbit/);
	await range(page, 'iscoR').fill('2.5');
	await expect(stage(page)).toContainText(/Result\s*falls into the hole/);
});

test('a clock lowered towards the horizon ticks slower and its light arrives redder', async ({
	page
}) => {
	await open(page, './black-holes/#clocks');
	await range(page, 'clockR').fill('2');
	await expect(stage(page)).toContainText(/Ticks per 100 far ticks\s*71/);
	await expect(stage(page)).toContainText('750 nm, red');
	// Dragging by keyboard: End raises it to 6 r_s.
	await page.getByRole('slider', { name: 'Height of the lowered clock' }).first().focus();
	await page.keyboard.press('End');
	await expect(range(page, 'clockR')).toHaveValue('6');
	await expect(stage(page)).toContainText(/Ticks per 100 far ticks\s*91/);
	await range(page, 'clockR').fill('1.1');
	await expect(stage(page)).toContainText(/Ticks per 100 far ticks\s*30/);
	await expect(stage(page)).toContainText('infrared');
});

test('a black hole in front of the stars bends them; moving it repaints the sky', async ({
	page
}) => {
	await open(page, './black-holes/#lensing');
	const sky = stage(page).locator('image');
	await expect(sky).toHaveAttribute('href', /^data:image\/png/);
	const before = await sky.getAttribute('href');
	await page.getByRole('slider', { name: /Black hole/ }).focus();
	await page.keyboard.press('Shift+ArrowRight');
	await expect(sky).not.toHaveAttribute('href', before ?? '');
	await expect(stage(page)).toContainText(/Images seen\s*(2|a ring)/);
	await toggle(page, 'unlensed').check({ force: true });
	await expect(stage(page)).toContainText(/Images seen\s*1 \(no hole\)/);
});
