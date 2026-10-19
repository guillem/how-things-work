import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const slider = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test(
	'the speed slider drives the Lorentz factor on the stage',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./special-relativity/#gamma');
		await expect(stage(page)).toContainText('0.6 c → γ = 1.25');
		await slider(page, 'beta').fill('0.8');
		await expect(stage(page)).toContainText('0.8 c → γ = 1.667');
		await slider(page, 'beta').focus();
		await page.keyboard.press('End');
		await expect(stage(page)).toContainText('0.99 c → γ = 7.089');
		// The step did not change.
		await expect(page).toHaveURL(/#gamma$/);
	}
);

test('each frame times the other frame’s clock as slow, except at rest', async ({ page }) => {
	await page.goto('./special-relativity/#time-dilation');
	await expect(stage(page)).toContainText('platform clock 10.0 ns · train clock 12.5 ns');
	await expect(stage(page)).toContainText('train clock 10.0 ns · platform clock 12.5 ns');
	// The light-clock step holds the train at rest whatever the slider says.
	await page.goto('./special-relativity/#light-clock');
	await expect(stage(page)).toContainText('platform clock 10.0 ns · train clock 10.0 ns');
});

test('the moving train measures shorter, and so does the platform from the train', async ({
	page
}) => {
	await page.goto('./special-relativity/#length');
	await expect(stage(page)).toContainText('the train is 160 m long');
	await expect(stage(page)).toContainText('the platform is 160 m long');
	await slider(page, 'beta').fill('0.8');
	await expect(stage(page)).toContainText('the train is 120 m long');
});

test('strikes simultaneous on the platform are front-first on the train', async ({ page }) => {
	await page.goto('./special-relativity/#train-view');
	await expect(stage(page)).toContainText(
		'strikes: back at t = 0, front at t = 0 — the same moment'
	);
	await expect(stage(page)).toContainText(
		'strikes: front at t′ = −200 ns, back at t′ = 200 ns — front first'
	);
	await slider(page, 'beta').fill('0');
	await expect(stage(page)).toContainText('strikes: both at t′ = 0 — the same moment');
});

test('the interval of the dragged event is the same in both frames', async ({ page }) => {
	await page.goto('./special-relativity/#interval');
	await expect(stage(page)).toContainText('c·t′ = 175 m, x′ = −25 m');
	await expect(stage(page)).toContainText('s² = 175² − (−25)² = 30000 m²');
	// A faster train: new train coordinates, the same interval.
	await slider(page, 'beta').fill('0.8');
	await expect(stage(page)).toContainText('c·t′ = 200 m, x′ = −100 m');
	await expect(stage(page)).toContainText('s² = 200² − (−100)² = 30000 m²');
	// Moving the event with the keyboard changes the interval, equally in both frames.
	await page.getByRole('slider', { name: 'The event' }).focus();
	await page.keyboard.press('ArrowUp');
	await expect(slider(page, 'ect')).toHaveValue('210');
	await expect(stage(page)).toContainText('s² = 210² − 100² = 34100 m²');
	await expect(stage(page).getByText(/= 34100 m²/)).toHaveCount(2);
	await expect(stage(page)).toContainText('timelike');
});
