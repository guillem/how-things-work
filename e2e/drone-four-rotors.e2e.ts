import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

/** Opens a step on its reduced-motion frame: the drone flown for 2.5 seconds. */
async function open(page: Page, url: string, text: string | RegExp) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control=${id}]`);

test('drone: four rotors at about 280 turns a second hold it up', async ({ page }) => {
	await open(page, './drone-four-rotors/#drone', '278 turns a second');
	await expect(stage(page)).toContainText('hold up the weight');
	await expect(stage(page)).toContainText('1.5 m');
	await expect(stage(page)).toContainText('seen from above');
});

test('throttle: below 278 turns a second it sits on the pad; above, it climbs', async ({
	page
}) => {
	await open(page, './drone-four-rotors/#throttle', 'rotors stopped');
	await expect(stage(page)).toContainText('sitting on the pad');
	await range(page, 'throttle').fill('200');
	await expect(stage(page)).toContainText('less than the weight');
	await expect(stage(page)).toContainText('on the ground');
	await range(page, 'throttle').fill('290');
	await expect(stage(page)).toContainText('more than the weight');
	await expect(stage(page)).toContainText(/climbing at \d\.\d m a second/);
});

test('twist: two each way cancel; all four clockwise, the body whirls anticlockwise', async ({
	page
}) => {
	await open(page, './drone-four-rotors/#twist', 'two each way: they cancel');
	await expect(stage(page)).toContainText('not turning');
	await page.locator('input[type=checkbox][data-control=sameWay]').check();
	await expect(stage(page)).toContainText('all four the same way');
	await expect(stage(page)).toContainText(/whirling anticlockwise, \d+ turns a second/);
});

test('forward: the back pair speeds up, it tips nose down and flies forward; back, the other way', async ({
	page
}) => {
	await open(page, './drone-four-rotors/#forward', 'standing still');
	await range(page, 'forward').fill('1');
	await expect(stage(page)).toContainText('10° nose down');
	await expect(stage(page)).toContainText(/\d+ km\/h forward/);
	await expect(stage(page)).toContainText('back pair 5 turns a second faster');
	await range(page, 'forward').fill('-1');
	await expect(stage(page)).toContainText('10° nose up');
	await expect(stage(page)).toContainText(/\d+ km\/h backwards/);
	await expect(stage(page)).toContainText('front pair 5 turns a second faster');
});

test('sideways: the left pair speeds up, it tips and slides right', async ({ page }) => {
	await open(page, './drone-four-rotors/#sideways', 'standing still');
	await range(page, 'right').fill('1');
	await expect(stage(page)).toContainText('10° to the right');
	await expect(stage(page)).toContainText(/\d+ km\/h to the right/);
	await expect(stage(page)).toContainText('left pair 5 turns a second faster');
});

test('turn: the clockwise pair speeds up and it turns left on the spot, holding its height', async ({
	page
}) => {
	await open(page, './drone-four-rotors/#turn', 'not turning');
	await range(page, 'turn').fill('-1');
	await expect(stage(page)).toContainText('left, 90° a second');
	await expect(stage(page)).toContainText('the same: it holds its height');
	await expect(stage(page)).toContainText('clockwise pair 24 turns a second faster');
	await range(page, 'turn').fill('1');
	await expect(stage(page)).toContainText('right, 90° a second');
	await expect(stage(page)).toContainText('anticlockwise pair 24 turns a second faster');
});

test('hands: even speeds keep it level; one turn a second more on the back pair and it crashes', async ({
	page
}) => {
	await open(page, './drone-four-rotors/#hands', 'level, sinking');
	await range(page, 'br').fill('279');
	await range(page, 'bl').fill('279');
	await expect(stage(page)).toContainText('crashed! back on its feet in a moment');
});
