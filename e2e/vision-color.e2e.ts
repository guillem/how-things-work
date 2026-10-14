import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const option = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`);

test('rounding the lens brings a near object into focus', async ({ page }) => {
	await page.goto('./vision-color/#focus');
	await expect(stage(page)).toContainText('on the retina');
	// An object at 25 cm, relaxed lens: the light meets behind the retina.
	await slider(page, 'near').fill('4');
	await expect(stage(page)).toContainText('25 cm');
	await expect(stage(page)).toContainText('behind');
	// About half-rounded focuses it.
	await slider(page, 'shape').fill('0.48');
	await expect(stage(page)).toContainText('on the retina');
	// Fully rounded (the handle on the lens, with the keyboard) overshoots.
	await page.getByRole('slider', { name: 'Shape of the lens' }).focus();
	await page.keyboard.press('End');
	await expect(slider(page, 'shape')).toHaveValue('1');
	await expect(stage(page)).toContainText('in front');
});

test('the cornea stops focusing under water', async ({ page }) => {
	await page.goto('./vision-color/#cornea');
	await expect(stage(page)).toContainText('42.7 D');
	await expect(stage(page)).toContainText('60.5 D');
	await toggle(page, 'water').check({ force: true });
	await expect(stage(page)).toContainText('0.0 D');
	await expect(stage(page)).toContainText('21.8 D');
});

test('−3.00 D glasses make a short-sighted eye see far away sharply', async ({ page }) => {
	await page.goto('./vision-color/#short');
	await expect(stage(page)).toContainText('in front');
	await slider(page, 'glassesShort').fill('-3');
	await expect(stage(page)).toContainText('on the retina');
	await expect(stage(page)).toContainText('glasses −3.00 D');
});

test('a long-sighted eye cannot focus at 20 cm without glasses', async ({ page }) => {
	await page.goto('./vision-color/#long');
	await slider(page, 'near').fill('5');
	await slider(page, 'shape').fill('1');
	await expect(stage(page)).toContainText('behind');
	await slider(page, 'glassesLong').fill('4');
	await slider(page, 'shape').fill('0.67');
	await expect(stage(page)).toContainText('on the retina');
});

test('one kind of cone: a matched brightness looks identical, three kinds tell them apart', async ({
	page
}) => {
	await page.goto('./vision-color/#one-cone');
	await expect(stage(page)).toContainText('one is brighter than the other');
	// M signal of 600 nm (0.33) = M of 500 nm (0.43) × 0.78.
	await slider(page, 'powerB').fill('0.78');
	await expect(stage(page)).toContainText('same signal: identical to this eye');
	await option(page, 'cone', 'all').click();
	await expect(stage(page)).toContainText('two different colours');
	await expect(stage(page)).not.toContainText('the same');
	// The right lamp set to the left one's light: the same to every eye.
	await slider(page, 'nmB').fill('600');
	await slider(page, 'powerB').fill('1');
	await expect(stage(page)).toContainText('the same');
	await slider(page, 'powerB').fill('2');
	await expect(stage(page)).toContainText('same colour, different brightness');
});

test('red and green lasers match the sodium lamp; nothing matches the 490 nm laser', async ({
	page
}) => {
	await page.goto('./vision-color/#match');
	await expect(stage(page)).toContainText('L cones get too little from the mix');
	await slider(page, 'r').fill('0.75');
	await slider(page, 'g').fill('0.33');
	await expect(stage(page)).toContainText('match: all three cone signals within 2%');
	// Sunlight needs all three.
	await option(page, 'target', 'sun').click();
	await expect(stage(page)).not.toContainText('match: all three');
	await slider(page, 'r').fill('0.7');
	await slider(page, 'g').fill('0.75');
	await slider(page, 'b').fill('0.74');
	await expect(stage(page)).toContainText('match: all three cone signals within 2%');
	// On the next step, the blue-green laser is out of reach.
	await page.goto('./vision-color/#screens');
	await option(page, 'target', 'cyan').click();
	await expect(stage(page)).toContainText('closest the three lasers can get: 5% off');
});

test('the chessboard illusion’s reveal says squares A and B are the same grey', async ({
	page
}) => {
	await page.goto('./vision-color/#illusions');
	await option(page, 'illusion', 'shadow').click();
	await expect(stage(page)).toContainText('Which is lighter, square A or square B?');
	await toggle(page, 'reveal').check({ force: true });
	await expect(stage(page)).toContainText('A and B are the same grey');
});
