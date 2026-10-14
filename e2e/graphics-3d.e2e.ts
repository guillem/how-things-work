import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);
const toggle = (page: Page, id: string) => page.locator(`input[type=checkbox][data-control=${id}]`);

async function open(page: Page, url: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	await expect(stage(page).locator('text').first()).toBeAttached();
}
async function switchOff(page: Page, id: string) {
	await toggle(page, id).focus();
	await page.keyboard.press('Space');
	await expect(toggle(page, id)).not.toBeChecked();
}

test(
	'the projection puts the distance in front of the camera into w, then divides by it',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './graphics-3d/#view');
		const ahead = /The corner is ([\d.]+) in front of the camera/;
		await expect(stage(page)).toContainText(ahead);
		const d = ahead.exec((await stage(page).textContent()) ?? '')![1];
		await page.keyboard.press('ArrowRight');
		await expect(page).toHaveURL(/#perspective/);
		await expect(stage(page)).toContainText(`w = ${d}: the distance in front`);
	}
);

test('dragging the camera round on the map turns the camera slider too', async ({ page }) => {
	await open(page, './graphics-3d/#triangles');
	const before = Number(await range(page, 'az').inputValue());
	await page.getByRole('slider', { name: /^Camera/ }).focus();
	await page.keyboard.press('ArrowRight');
	await expect(range(page, 'az')).toHaveValue(String(before + 2));
});

test('a triangle covers the pixel centres inside its edges', async ({ page }) => {
	await open(page, './graphics-3d/#coverage');
	await expect(stage(page)).toContainText('120 of 120 filled');
	await expect(stage(page)).toContainText('all three +: inside');
	// Moving the left corner further left makes the triangle bigger.
	await page.getByRole('slider', { name: 'Corner 1 of the triangle' }).focus();
	await page.keyboard.press('Shift+ArrowLeft');
	await expect(stage(page)).not.toContainText('120 of 120 filled');
});

test('switching the z-buffer off stops hidden surfaces being thrown away', async ({ page }) => {
	await open(page, './graphics-3d/#zbuffer');
	await expect(stage(page)).toContainText(/Hidden \(lost the depth test\)\s*1,\d{3}/);
	await switchOff(page, 'zbuffer');
	await expect(stage(page)).toContainText(/Hidden \(lost the depth test\)\s*depth test off/);
	await expect(stage(page)).toContainText('the last triangle painted');
});

test('without perspective correction the floor looks up the wrong place in its texture', async ({
	page
}) => {
	await open(page, './graphics-3d/#texture');
	await expect(stage(page)).toContainText('Perspective-correct: they agree.');
	await switchOff(page, 'perspectiveCorrect');
	await expect(stage(page)).toContainText('Blended evenly on the screen: they differ.');
});

test('shading: Lambert reads the cosine of the angle to the lamp', async ({ page }) => {
	await open(page, './graphics-3d/#shading');
	const m = /Lambert: n · l = cos (\d+)° = ([\d.]+)/.exec((await stage(page).textContent()) ?? '');
	expect(m).not.toBeNull();
	expect(Number(m![2])).toBeCloseTo(Math.cos((Number(m![1]) * Math.PI) / 180), 1);
	await page.locator('button[data-control=shading][data-value=none]').click();
	await expect(stage(page)).toContainText('No shading');
});

test('the bounce limit decides how many reflected and refracted rays are followed', async ({
	page
}) => {
	await open(page, './graphics-3d/#bounces');
	// The picked pixel is the middle of the glass ball: in, out, and on.
	await expect(stage(page)).toContainText('eye ray hits the glass ball');
	await expect(stage(page)).toContainText(/\d\. refracted ray/);
	await range(page, 'bounces').fill('0');
	await expect(stage(page)).toContainText(/Reflected and refracted rays\s*0(?![\d,])/);
	await expect(stage(page)).not.toContainText(/\d\. refracted ray/);
});

test('side by side, the ray tracer makes many times the rasteriser’s tests', async ({ page }) => {
	await open(page, './graphics-3d/#compare');
	const times = /here it makes (\d+) times as many tests/;
	await expect(stage(page)).toContainText(times);
	const at3 = Number(times.exec((await stage(page).textContent()) ?? '')![1]);
	expect(at3).toBeGreaterThan(20);
	await expect(stage(page)).toContainText('✓ light through glass');
	await range(page, 'bounces').fill('0');
	await expect(stage(page)).toContainText('✗ reflections');
	const at0 = Number(times.exec((await stage(page).textContent()) ?? '')![1]);
	expect(at0).toBeLessThan(at3);
});
