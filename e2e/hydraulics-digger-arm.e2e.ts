import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const control = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('squeeze: pushed all the way with the keyboard, the other piston rises exactly as far', async ({
	page
}) => {
	await open(page, './hydraulics-digger-arm/#squeeze', 'pushed down 0 cm');
	const handle = page.getByRole('slider', { name: 'Small piston' });
	await handle.focus();
	await handle.press('End');
	await expect(stage(page)).toContainText('pushed down 30 cm');
	await expect(stage(page)).toContainText('pushed up 30 cm');
	await expect(page).toHaveURL(/#squeeze$/);
	await expect(control(page, 'push')).toHaveValue('30');
});

test('bigger: ten times the face, ten times the push, a tenth of the distance', async ({
	page
}) => {
	await open(page, './hydraulics-digger-arm/#bigger', 'your push: 10 kg');
	await control(page, 'push').fill('10');
	await expect(stage(page)).toContainText('down 10 cm');
	await expect(stage(page)).toContainText('push on the crate: 100 kg');
	await expect(stage(page)).toContainText('up 1 cm');
	await expect(stage(page)).toContainText('10 times the push');
	await expect(stage(page)).toContainText('the same push on every square');
});

test('trade: three times as wide is nine times the push; twice as wide is too little for the crate', async ({
	page
}) => {
	await open(page, './hydraulics-digger-arm/#trade', 'push on the crate: 100 kg');
	await control(page, 'big').fill('6');
	await expect(stage(page)).toContainText('9 times the push');
	await expect(stage(page)).toContainText('9 times less far');
	await control(page, 'big').fill('4');
	await expect(stage(page)).toContainText('the crate doesn’t move');
	await expect(stage(page)).toContainText('only 80 kg: too little');
	await control(page, 'big').fill('13');
	await expect(stage(page)).toContainText('42 times the push');
	await expect(stage(page)).toContainText('42 times less far');
});

test('car: too narrow a piston can’t lift it; at 16 cm one full push lifts it under half a centimetre', async ({
	page
}) => {
	await open(page, './hydraulics-digger-arm/#car', 'car: 1,200 kg');
	await control(page, 'big').fill('10');
	await expect(stage(page)).toContainText('the car doesn’t move');
	await expect(stage(page)).toContainText('about 15.5 cm lifts it');
	await control(page, 'big').fill('16');
	await expect(stage(page)).toContainText('one full push lifts the car 4.7 mm');
});

test('boulder: a 25 cm piston lifts 3 tonnes, about 2 mm a push', async ({ page }) => {
	await open(page, './hydraulics-digger-arm/#boulder', 'boulder: 3,000 kg');
	await control(page, 'big').fill('20');
	await expect(stage(page)).toContainText('about 24.5 cm lifts it');
	await control(page, 'big').fill('25');
	await expect(stage(page)).toContainText('one full push lifts the boulder 1.9 mm');
});

test('air: a bubble in the pipe swallows the first part of each push, and the car rises less', async ({
	page
}) => {
	await open(page, './hydraulics-digger-arm/#air', 'no air: each push lifts the car 4.7 mm');
	await control(page, 'air').fill('3');
	await expect(stage(page)).toContainText(
		'the first 12 cm of each push only squash the air: the car rises 2.8 mm, not 4.7 mm'
	);
	await expect(stage(page)).toContainText('air: squeezed to a 7th of its size');
});

test('scoop: each move is one cylinder, from ready to dumped', async ({ page }) => {
	await open(page, './hydraulics-digger-arm/#scoop', 'now: ready to dig');
	await control(page, 'scoop').fill('50');
	await expect(stage(page)).toContainText('now: curl the bucket: scoop');
	await expect(stage(page)).toContainText('the bucket cylinder pushes its rod out');
	await control(page, 'scoop').fill('10');
	await expect(stage(page)).toContainText('now: reach out');
	await expect(stage(page)).toContainText('the arm cylinder pulls its rod in');
	await control(page, 'scoop').fill('100');
	await expect(stage(page)).toContainText('now: dumped');
	await expect(stage(page)).toContainText('each boom cylinder pushes like lifting about 40 tonnes');
});
