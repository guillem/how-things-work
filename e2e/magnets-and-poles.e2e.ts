import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('pull: unlike ends pull; dragged alongside, red beside red, the magnets push', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#pull', 'pulling together');
	const magnet = page.getByRole('slider', { name: 'Right magnet' });
	await magnet.focus();
	// 2 cm up, then left until it lies alongside the other magnet.
	for (let i = 0; i < 4; i++) await magnet.press('ArrowUp');
	for (let i = 0; i < 18; i++) await magnet.press('ArrowLeft');
	await expect(stage(page)).toContainText('pushing apart');
	// The keys moved the magnet, not the step.
	await expect(page).toHaveURL(/#pull$/);
});

test('pull: the left magnet can be dragged too', async ({ page }) => {
	await open(page, './magnets-and-poles/#pull', 'pulling together');
	const magnet = page.getByRole('slider', { name: 'Left magnet' });
	await magnet.focus();
	// 2 cm down, then right until it lies alongside the other magnet, red beside red.
	for (let i = 0; i < 4; i++) await magnet.press('ArrowDown');
	for (let i = 0; i < 18; i++) await magnet.press('ArrowRight');
	await expect(stage(page)).toContainText('pushing apart');
});

test('push: turning one magnet round turns the pull into a push', async ({ page }) => {
	await open(page, './magnets-and-poles/#push', 'pulling together');
	const flip = page.locator('input[type=checkbox][data-control=flip]');
	await flip.check();
	await expect(stage(page)).toContainText('pushing apart');
	await expect(stage(page)).toContainText('red faces red');
	await flip.uncheck();
	await expect(stage(page)).toContainText('pulling together');
});

test('fade: 1 cm apart the pull is 65 g; 2 cm apart, under a third; 10 cm, about 150 times weaker', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#fade', '1 cm apart: they pull like a 65 g weight');
	const gap = page.locator('input[type=range][data-control=gap]');
	await gap.fill('2');
	await expect(stage(page)).toContainText('2 cm apart: they pull like a 19 g weight');
	await gap.fill('10');
	await expect(stage(page)).toContainText('157 times weaker than 1 cm apart');
});

test('compass: near the magnet the needle follows it; far away it points north', async ({
	page
}) => {
	await open(
		page,
		'./magnets-and-poles/#compass',
		'near the magnet: the needle follows the magnet'
	);
	const compass = page.getByRole('slider', { name: 'Compass' });
	await compass.focus();
	for (let i = 0; i < 40; i++) await compass.press('ArrowRight');
	await expect(stage(page)).toContainText('far away: the Earth wins, and the needle points north');
});

test('filings: pulling magnets join their lines across the gap, pushing ones do not', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#filings', 'loop from one end to the other');
	await page.locator('[data-control=filings][data-value=pull]').click();
	await expect(stage(page)).toContainText('pulling: the lines run across the gap');
	await page.locator('[data-control=filings][data-value=push]').click();
	await expect(stage(page)).toContainText('none cross the gap');
});

test('clips: lowered close, a clip jumps up; lifted, it holds a chain of clips', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#clips', 'too far: the pull is too weak');
	const height = page.locator('input[type=range][data-control=height]');
	await height.fill('1');
	await expect(stage(page)).toContainText('a clip jumped up: it is a magnet now');
	await height.fill('8');
	await expect(stage(page)).toContainText('a chain of 3 clips: each one is a magnet now');
});

test('clips: the magnet can be lowered with the keyboard', async ({ page }) => {
	await open(page, './magnets-and-poles/#clips', 'too far');
	const magnet = page.getByRole('slider', { name: 'Magnet height' });
	await magnet.focus();
	await magnet.press('Home');
	await expect(page.locator('input[type=range][data-control=height]')).toHaveValue('0');
	await expect(stage(page)).toContainText('touching the clips');
	await expect(stage(page)).toContainText('it is a magnet now');
});

test('metals: the magnet picks up iron, steel and nickel but ignores a stainless spoon, aluminium, copper and gold', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#metals', 'iron nail: the magnet picks it up');
	const next = page.locator('button[data-control=material]');
	for (const text of [
		'18/8 stainless-steel spoon: the magnet ignores it',
		'steel paper clip: the magnet picks it up',
		'aluminium foil: the magnet ignores it',
		'nickel strip: the magnet picks it up',
		'copper wire: the magnet ignores it',
		'gold ring: the magnet ignores it',
		'iron nail: the magnet picks it up'
	]) {
		await next.click();
		await expect(stage(page)).toContainText(text);
	}
});

test('cut: every piece of a cut magnet has a red and a blue end', async ({ page }) => {
	await open(page, './magnets-and-poles/#cut', 'one magnet: a red end and a blue end');
	await page.locator('input[type=range][data-control=pieces]').fill('4');
	await expect(stage(page)).toContainText('4 pieces: 4 magnets, each with a red and a blue end');
	await expect(stage(page).getByText('N', { exact: true })).toHaveCount(4);
	await expect(stage(page).getByText('S', { exact: true })).toHaveCount(4);
});

// On a phone the readouts are text under the stage, so the table fills the stage, zoomed in.
test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' });
	const readouts = (page: Page) => page.getByRole('group', { name: 'Readouts' });

	test('pull: each magnet is a finger-sized target, and dragging one alongside the other makes them push', async ({
		page
	}) => {
		await page.goto('./magnets-and-poles/#pull');
		await expect(readouts(page)).toContainText('pulling together');
		const left = await page.getByRole('slider', { name: 'Left magnet' }).boundingBox();
		const right = await page.getByRole('slider', { name: 'Right magnet' }).boundingBox();
		const svg = await page.locator('.stage svg').boundingBox();
		if (!left || !right || !svg) throw new Error('magnets or stage not drawn');
		expect(right.height).toBeGreaterThanOrEqual(40);
		expect(right.width).toBeGreaterThanOrEqual(120);
		// Drag the right magnet onto the left one, 2 cm higher (50 stage units per cm on a phone).
		const cm = (50 * svg.width) / 960;
		await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2);
		await page.mouse.down();
		await page.mouse.move(left.x + left.width / 2, left.y + left.height / 2 - 2 * cm, {
			steps: 8
		});
		await page.mouse.up();
		await expect(readouts(page)).toContainText('pushing apart');
	});

	test('compass: the zoomed-in table still reaches far enough for the Earth to win', async ({
		page
	}) => {
		await page.goto('./magnets-and-poles/#compass');
		await expect(readouts(page)).toContainText('near the magnet: the needle follows the magnet');
		const compass = page.getByRole('slider', { name: 'Compass' });
		await compass.focus();
		for (let i = 0; i < 40; i++) await compass.press('ArrowRight');
		await expect(readouts(page)).toContainText(
			'far away: the Earth wins, and the needle points north'
		);
	});
});
