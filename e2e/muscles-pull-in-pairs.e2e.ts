import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('arm: dragging the hand up shortens the biceps and stretches the triceps', async ({
	page
}) => {
	await open(page, './muscles-pull-in-pairs/#arm', 'biceps: 3 cm shorter, and fatter');
	const hand = page.getByRole('slider', { name: 'Hand' });
	await hand.focus();
	await hand.press('End');
	await expect(stage(page)).toContainText('biceps: 9 cm shorter, and fatter');
	await expect(stage(page)).toContainText('triceps: 5 cm longer');
	await expect(page.locator('input[type=range][data-control=elbow]')).toHaveValue('130');
	await hand.press('Home');
	await expect(stage(page)).toContainText('biceps: 1 cm shorter');
	// The keys moved the hand, not the step.
	await expect(page).toHaveURL(/#arm$/);
});

test('squeeze: the biceps bends the arm, the triceps straightens it, neither lets it flop', async ({
	page
}) => {
	await open(page, './muscles-pull-in-pairs/#squeeze', 'the biceps pulls: the elbow bends');
	await page.locator('[data-control=squeeze][data-value=triceps]').click();
	await expect(stage(page)).toContainText('the triceps pulls: the arm goes straight');
	await expect(stage(page)).toContainText('the triceps gets shorter');
	await page.locator('[data-control=squeeze][data-value=none]').click();
	await expect(stage(page)).toContainText('neither pulls: the forearm flops down');
	await expect(stage(page)).toContainText('it can’t push');
});

test('press: 10 kg on the scale takes a 162 kg triceps pull, 16 times as much', async ({
	page
}) => {
	await open(page, './muscles-pull-in-pairs/#press', 'the triceps pulls like a 162 kg weight');
	await expect(stage(page)).toContainText('16 times what the scale reads');
	await page.locator('input[type=range][data-control=press]').fill('20');
	await expect(stage(page)).toContainText('the triceps pulls like a 337 kg weight');
});

test('bag: the biceps pulls 8 times the bag, plus the forearm', async ({ page }) => {
	await open(page, './muscles-pull-in-pairs/#bag', 'the biceps pulls like a 43 kg weight');
	await expect(stage(page)).toContainText(
		'38 kg of it for the 5 kg bag: nearly 8 times its weight'
	);
	await page.locator('input[type=range][data-control=bag]').fill('10');
	await expect(stage(page)).toContainText('the biceps pulls like an 81 kg weight');
});

test('lower: the biceps keeps pulling while it lowers the bag; relaxed, the bag drops', async ({
	page
}) => {
	await open(
		page,
		'./muscles-pull-in-pairs/#lower',
		'lowering: the biceps still pulls, and gets longer'
	);
	await page.locator('input[type=checkbox][data-control=relax]').check();
	await expect(stage(page)).toContainText('biceps relaxed: nothing brakes the bag');
});

test('bigger: a bigger biceps still pulls as hard, from the same spot', async ({ page }) => {
	await open(page, './muscles-pull-in-pairs/#bigger', 'the biceps still pulls like a 43 kg weight');
	await page.locator('input[type=checkbox][data-control=bigger]').check();
	await expect(stage(page)).toContainText('a bigger muscle, gripping the same spot');
	await expect(stage(page)).toContainText('the biceps still pulls like a 43 kg weight');
});

test('grip: gripping farther out needs less pull but much more shortening', async ({ page }) => {
	await open(page, './muscles-pull-in-pairs/#grip', 'it shortens 8 cm');
	await page.locator('input[type=range][data-control=grip]').fill('9');
	await expect(stage(page)).toContainText(
		'gripping 9 cm from the elbow: it pulls like a 22 kg weight'
	);
	await expect(stage(page)).toContainText('it shortens 15 cm');
});
