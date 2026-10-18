// Browser tests of the aperture-synthesis page: a dish's first dark ring shrinks as 1.22 λ/D; an
// equal double's fringes vanish at λ/(2s); one pair samples a point and its mirror, and a dish
// moved with the keys lengthens the baseline; the Earth's turn traces ellipses of ratio |sin δ|
// and a southern source sets below 8°; a dozen VLA dishes make 66 pairs, the full D configuration
// 351; dishes can be added and removed; the dirty image adds up to zero; CLEAN recovers point
// sources; shrinking the array merges a double and spreading it loses a disc; the array has under
// 1% of the area of the dish it matches in sharpness. Reduced motion gives each step's complete
// frame.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);
const choose = (page: Page, id: string, value: string) =>
	page.locator(`button[data-control=${id}][data-value="${value}"]`).click();
const press = (page: Page, id: string) => page.locator(`button[data-control=${id}]`).click();
async function key(page: Page, id: string, k: string, times = 1) {
	await range(page, id).focus();
	for (let i = 0; i < times; i++) await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test(
	'a dozen dishes make 66 pairs, and the images are drawn',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./aperture-synthesis/#array');
		await expect(stage(page)).toContainText('12 dishes, 66 pairs');
		await expect(stage(page)).toContainText('4,818 samples, and their mirrors');
		await expect(page.getByTestId('img-dirty')).toHaveAttribute('href', /^data:image\/png/);
		await expect(page.getByTestId('img-beam')).toHaveAttribute('href', /^data:image\/png/);
		await choose(page, 'layout', 'vla27');
		await expect(stage(page)).toContainText('27 dishes, 351 pairs');
		await expect(stage(page)).toContainText('spacings 39–1,031 m');
	}
);

test('a bigger dish blurs less: the first dark ring at 1.22 λ/D', async ({ page }) => {
	await page.goto('./aperture-synthesis/#dish');
	await expect(stage(page)).toContainText('lies 1.22 λ/D = 35.2′ out');
	await key(page, 'diameter', 'End'); // 1 km
	await expect(stage(page)).toContainText('lies 1.22 λ/D = 53″ out');
	await expect(stage(page)).toContainText('collecting area π D²/4 = 785,398 m²');
});

test('an equal double’s fringes vanish at a baseline of λ/(2s)', async ({ page }) => {
	await page.goto('./aperture-synthesis/#double');
	await expect(stage(page)).toContainText('|V| = 1.73 Jy');
	await key(page, 'baseline', 'ArrowLeft', 8); // 200 → 120 m
	await expect(stage(page)).toContainText('|V| = 0.01 Jy');
	await expect(stage(page)).toContainText('first null (▲) at λ/(2s) = 120 m');
});

test('one pair samples one point and its mirror; moving a dish lengthens the baseline', async ({
	page
}) => {
	await page.goto('./aperture-synthesis/#snapshot');
	await expect(stage(page)).toContainText('1 sample, and their mirrors');
	await expect(stage(page)).toContainText('stripes 1.0′ apart');
	await page.getByRole('slider', { name: 'Dish 2' }).focus();
	await page.keyboard.press('Shift+ArrowRight'); // 50 m east
	await expect(stage(page)).toContainText('750 m apart');
});

test('the Earth’s turn traces ellipses |sin δ| as tall as wide', async ({ page }) => {
	await page.goto('./aperture-synthesis/#rotation');
	await expect(stage(page)).toContainText('ellipse 0.64 times as tall as wide');
	await key(page, 'dec', 'End'); // the pole: a circle
	await expect(stage(page)).toContainText('ellipse 1.00 times as tall as wide');
	await key(page, 'dec', 'Home'); // −30°: below 8° for part of a 12-hour track
	await key(page, 'hours', 'End');
	await expect(stage(page)).toContainText('12 h · δ = −30° (part below 8°)');
});

test.describe('in motion', () => {
	test.use({ reducedMotion: 'no-preference' });
	test('turning the Earth sweeps the hours', async ({ page }) => {
		await page.clock.install();
		await page.goto('./aperture-synthesis/#rotation');
		await toggle(page, 'play').check({ force: true });
		await playUntil(page, stage(page), '12 h of the Earth’s turn', 20000);
		await expect(range(page, 'hours')).toHaveValue('12');
	});
});

test('dishes can be added and removed', async ({ page }) => {
	await page.goto('./aperture-synthesis/#build');
	await expect(stage(page)).toContainText('12 dishes, 66 pairs');
	await press(page, 'add');
	await expect(stage(page)).toContainText('13 dishes, 78 pairs');
	await press(page, 'remove');
	await press(page, 'remove');
	await expect(stage(page)).toContainText('11 dishes, 55 pairs');
	// a click on an empty part of the map puts a dish there
	await page.getByTestId('map').click({ position: { x: 20, y: 60 } });
	await expect(stage(page)).toContainText('12 dishes, 66 pairs');
});

test('the dirty image adds up to zero: the zero spacing is never measured', async ({ page }) => {
	await page.goto('./aperture-synthesis/#dirty');
	await expect(stage(page)).toContainText('the dirty image adds up to 0.000');
	await choose(page, 'sky', 'disc');
	await expect(stage(page)).toContainText('the dirty image adds up to 0.000');
	await expect(stage(page)).toContainText('a disc and a point, 4.0 Jy');
});

test('CLEAN recovers the point sources', async ({ page }) => {
	await page.goto('./aperture-synthesis/#clean');
	await choose(page, 'sky', 'points');
	await expect(stage(page)).toContainText('0 CLEAN iterations: the components hold 0.00');
	await key(page, 'cleanStep', 'End');
	await expect(stage(page)).toContainText(
		'3,000 CLEAN iterations: the components hold 2.80 of the sky’s 2.80 Jy'
	);
});

test('shrinking the array merges the double; spreading it loses the disc', async ({ page }) => {
	await page.goto('./aperture-synthesis/#shrink');
	await expect(stage(page)).toContainText('double 1.5′ apart: one blob');
	await key(page, 'shrink', 'End');
	await expect(stage(page)).toContainText('double 1.5′ apart: two points');

	await page.goto('./aperture-synthesis/#spread');
	await expect(stage(page)).toContainText('shortest spacing 125 m');
	await expect(stage(page)).toContainText('keeps 11% of the brightness');
	await key(page, 'spread', 'Home');
	await expect(stage(page)).toContainText('shortest spacing 30 m');
	await expect(stage(page)).toContainText(/keeps [4-9]\d% of the brightness/);
});

test('the array matches a 1 km dish’s sharpness with under 1% of its area', async ({ page }) => {
	await page.goto('./aperture-synthesis/#area');
	await expect(stage(page)).toContainText('with 0.7% of its collecting area');
	await expect(stage(page)).toContainText('takes the array 14 days');
});
