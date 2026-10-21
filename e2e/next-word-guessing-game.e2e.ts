import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its first text.
	await expect(stage(page)).toContainText(text);
}

test('guess: picking a card reveals the book’s word and the machine’s cards', async ({ page }) => {
	await open(page, './next-word-guessing-game/#guess', 'When she reached the top of the');
	await page.getByRole('button', { name: 'Guess hill' }).click();
	await expect(stage(page)).toContainText('The book says “hill”. You got it!');
	// The machine looks only at "the", and its biggest card there is a fable's lion.
	await expect(stage(page)).toContainText('what came next after “the”');
	await expect(stage(page)).toContainText('lion');
	await page.getByRole('button', { name: 'Another sentence' }).click();
	await expect(stage(page)).toContainText('always found and carried');
	await expect(stage(page)).toContainText('Pick a card');
});

test('cards: after “Mr.” only a few names can come', async ({ page }) => {
	await open(page, './next-word-guessing-game/#cards', 'followed by 56 different words');
	await page.locator('select[data-control=word]').selectOption('mr');
	await expect(stage(page)).toContainText(
		'Seen 36 times in the books, followed by 6 different words'
	);
	await expect(stage(page)).toContainText('McGregor');
});

test('spinner: each spin lands on a word and is tallied', async ({ page }) => {
	await open(page, './next-word-guessing-game/#spinner', 'Press Spin');
	await page.getByRole('button', { name: 'Spin', exact: true }).click();
	await expect(stage(page)).toContainText('It landed on');
	await expect(stage(page)).toContainText('1 spins');
});

test('write: each press adds one word to the story', async ({ page }) => {
	await open(page, './next-word-guessing-game/#write', '0 of 24 spins');
	const add = page.getByRole('button', { name: 'Add a word' });
	await add.click();
	await add.click();
	await expect(stage(page)).toContainText('2 of 24 spins');
});

test('more books: the first guess gets better as the machine reads more', async ({ page }) => {
	await open(page, './next-word-guessing-game/#more-books', 'Books read: 1 of 7');
	await expect(stage(page)).toContainText('about 1 word in 29');
	const more = page.getByRole('button', { name: 'Read more books' });
	for (let k = 0; k < 6; k++) await more.click();
	await expect(stage(page)).toContainText('Books read: 7 of 7');
	await expect(stage(page)).toContainText('about 1 word in 10');
});

test('likely: a written sentence is checked against the books', async ({ page }) => {
	await open(page, './next-word-guessing-game/#likely', 'of its books');
});
