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

test('push: turning one magnet round turns the pull into a push', async ({ page }) => {
	await open(page, './magnets-and-poles/#push', 'pulling together');
	const flip = page.locator('input[type=checkbox][data-control=flip]');
	await flip.check();
	await expect(stage(page)).toContainText('pushing apart');
	await expect(stage(page)).toContainText('red faces red');
	await flip.uncheck();
	await expect(stage(page)).toContainText('pulling together');
});

test('fade: 1 cm apart the pull is 21 g; 2 cm apart, less than half; 10 cm, about 80 times weaker', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#fade', '1 cm apart: they pull like a 21 g weight');
	const gap = page.locator('input[type=range][data-control=gap]');
	await gap.fill('2');
	await expect(stage(page)).toContainText('2 cm apart: they pull like a 8.4 g weight');
	await gap.fill('10');
	await expect(stage(page)).toContainText('79 times weaker than 1 cm apart');
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

test('metals: the magnet picks up iron and nickel but ignores a stainless spoon and gold', async ({
	page
}) => {
	await open(page, './magnets-and-poles/#metals', 'iron nail: the magnet picks it up');
	await page.locator('[data-control=material][data-value=spoon]').click();
	await expect(stage(page)).toContainText('stainless-steel spoon: the magnet ignores it');
	await page.locator('[data-control=material][data-value=nickel]').click();
	await expect(stage(page)).toContainText('nickel strip: the magnet picks it up');
	await page.locator('[data-control=material][data-value=gold]').click();
	await expect(stage(page)).toContainText('gold ring: the magnet ignores it');
});

test('cut: every piece of a cut magnet has a red and a blue end', async ({ page }) => {
	await open(page, './magnets-and-poles/#cut', 'one magnet: a red end and a blue end');
	await page.locator('input[type=range][data-control=pieces]').fill('4');
	await expect(stage(page)).toContainText('4 pieces: 4 magnets, each with a red and a blue end');
	await expect(stage(page).getByText('N', { exact: true })).toHaveCount(4);
	await expect(stage(page).getByText('S', { exact: true })).toHaveCount(4);
});
