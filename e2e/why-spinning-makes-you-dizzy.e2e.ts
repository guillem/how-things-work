import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('chair: just after the stop the room is still and you feel yourself turning left', async ({
	page
}) => {
	await open(page, './why-spinning-makes-you-dizzy/#chair', 'Stopped 3 seconds ago');
	await expect(stage(page)).toContainText('the room is still');
	await expect(stage(page)).toContainText('turning left');
});

test('rings: a shake stirs the flat ring, a nod or a tilt the two upright rings', async ({
	page
}) => {
	await open(page, './why-spinning-makes-you-dizzy/#rings', 'Shaking “no” stirs the flat ring');
	await page.locator('[data-control=turn][data-value=nod]').click();
	await expect(stage(page)).toContainText('Nodding “yes” stirs the two upright rings');
	await page.locator('[data-control=turn][data-value=tilt]').click();
	await expect(stage(page)).toContainText('Tilting to a shoulder stirs the two upright rings');
});

test('start: pushing off bends the flap and you feel the turn as fast as the chair', async ({
	page
}) => {
	await open(page, './why-spinning-makes-you-dizzy/#start', 'bent: “turning right”');
	await expect(stage(page)).toContainText('as fast as the chair turns');
	// Slow or fast, the feeling keeps up with the chair at the start.
	const speed = page.locator('input[type=range][data-control=speed]');
	await speed.focus();
	await speed.press('Home');
	await expect(stage(page)).toContainText('1 turn in 10 seconds');
	await expect(stage(page)).toContainText('as fast as the chair turns');
});

test('steady: after half a minute the flap is straight and you feel nothing, though the chair turns', async ({
	page
}) => {
	await open(page, './why-spinning-makes-you-dizzy/#steady', '30 seconds of spinning');
	await expect(stage(page)).toContainText('straight: “not turning”');
	await expect(stage(page)).toContainText('turning right');
	await expect(stage(page)).toContainText('5 turns in 10 seconds');
});

test('stop: playing on, the chair stops and the feeling turns round', async ({ page }) => {
	await page.clock.install();
	await page.goto('./why-spinning-makes-you-dizzy/#stop');
	const s = stage(page);
	// Before the stop: the chair has turned long enough for the flap to stand straight.
	await playUntil(page, s, 'seconds of spinning', 5000);
	await expect(s).toContainText('straight: “not turning”');
	await expect(s).toContainText('turning right');
	await playUntil(page, s, 'Stopped', 10000);
	await playUntil(page, s, 'bent: “turning left”', 5000);
	await expect(s).toContainText('stopped');
});

test('long: a short spin makes a weak after-spin, a long one a full one', async ({ page }) => {
	await open(page, './why-spinning-makes-you-dizzy/#long', 'Just after the stop, you feel');
	const spinFor = page.locator('input[type=range][data-control=spinFor]');
	await spinFor.focus();
	await spinFor.press('Home');
	await expect(stage(page)).toContainText('about a quarter as fast as the chair spun');
	await spinFor.press('End');
	await expect(stage(page)).toContainText('Stopped 1 second ago');
	await expect(stage(page)).toContainText('as fast as the chair spun');
	await expect(stage(page)).not.toContainText('about a quarter');
});
