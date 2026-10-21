import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its readout.
	await expect(stage(page)).toContainText(text);
}

test('ear: sliding the pitch changes how fast the note shakes and what it sounds like', async ({
	page
}) => {
	await open(page, './hearing-and-the-ear/#ear', 'A note shaking 1,000 times a second');
	const pitch = page.locator('input[type=range][data-control=pitch]');
	await pitch.focus();
	await pitch.press('Home');
	await expect(stage(page)).toContainText('A note shaking 31 times a second');
	await expect(stage(page)).toContainText('deep rumble');
	await pitch.press('End');
	await expect(stage(page)).toContainText('A note shaking 16,000 times a second');
});

test('window: the big eardrum gives most of the boost, the bones only a third', async ({
	page
}) => {
	await open(page, './hearing-and-the-ear/#window', 'pushed about 22 times harder');
	await page.locator('[data-control=middle][data-value=small]').click();
	await expect(stage(page)).toContainText('pushed only a third harder');
	await page.locator('[data-control=middle][data-value=none]').click();
	await expect(stage(page)).toContainText('Most of the sound bounces off the fluid');
	await expect(stage(page)).toContainText('like a whisper does');
});

test('pitch: a high note peaks near the entrance, a low note near the far end', async ({
	page
}) => {
	await open(page, './hearing-and-the-ear/#pitch', 'The peak is about 2 cm in');
	const pitch = page.locator('input[type=range][data-control=pitch]');
	await pitch.focus();
	await pitch.press('End');
	await expect(stage(page)).toContainText('The peak is just inside the entrance');
	await pitch.press('Home');
	await expect(stage(page)).toContainText('The peak is about 3.5 cm in');
});

test('two: notes far apart make two bumps; a semitone apart, one blurred bump', async ({
	page
}) => {
	await open(page, './hearing-and-the-ear/#two', 'Two notes, two bumps');
	await expect(stage(page)).toContainText('8,000 times a second');
	// Down from 8,000 a second to a semitone above the first note (1,000): 35 semitones.
	const second = page.locator('input[type=range][data-control=second]');
	await second.focus();
	for (let i = 0; i < 35; i++) await second.press('ArrowLeft');
	await expect(stage(page)).toContainText('1,060 times a second');
	await expect(stage(page)).toContainText('Too close: the two bumps blur into one');
	await expect(stage(page)).toContainText('one blurred bump');
});

test('loud: turning it up grows the bump and lights more sensors, at about the same spot', async ({
	page
}) => {
	await open(page, './hearing-and-the-ear/#loud', 'As loud as a quiet library');
	await expect(stage(page)).toContainText('the bump is about 2 cm in; about 1,100 sensors signal');
	const loud = page.locator('input[type=range][data-control=loud]');
	await loud.focus();
	await loud.press('End');
	await expect(stage(page)).toContainText('As loud as a lawnmower');
	await expect(stage(page)).toContainText('the bump is about 2 cm in; about 2,100 sensors signal');
});
