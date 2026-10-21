import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its text.
	await expect(stage(page)).toContainText(text);
}

test('pile: the marked messages, and another off the pile on request', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#pile', '561 messages, 74 marked spam');
	// Four messages on show, the oldest at the top.
	await expect(stage(page)).toContainText("Sorry, I'll call later");
	await expect(stage(page)).not.toContainText('WIN URGENT!');
	await page.locator('button[data-control=next]').click();
	await expect(stage(page)).toContainText('WIN URGENT!');
	await expect(stage(page)).not.toContainText("Sorry, I'll call later");
});

test('word: a word’s two counts, in spam and in ordinary messages', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#word', '“free” is much commoner in spam');
	await expect(stage(page)).toContainText('about 1 in 4');
	await expect(stage(page)).toContainText('about 1 in 100');
	await page.locator('button[data-control=word][data-value=home]').click();
	await expect(stage(page)).toContainText('“home” is much commoner in ordinary messages');
	await expect(stage(page)).toContainText('none of them');
	// Any word can be typed: "mum's" in a message counts as "mum"; a word never used has no counts.
	await page.locator('input[data-input=word]').fill('Mum');
	await expect(stage(page)).toContainText('1contain it, out of 487');
	await expect(stage(page)).toContainText('“mum” is about as common in both piles');
	await page.locator('input[data-input=word]').fill('giraffe');
	await expect(stage(page)).toContainText('“giraffe” is in no message of either pile');
	await page.locator('input[data-input=word]').fill('prize');
	await expect(stage(page)).toContainText('“prize” is much commoner in spam');
});

test('count: pressing the button counts every word', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#count', 'Press “Count every word”');
	await page.locator('button[data-control=count]').click();
	await expect(stage(page)).toContainText('2,075 different words counted');
	await expect(stage(page)).toContainText('prize');
});

test('vote: an advert goes to the spam folder, a friend’s message to the inbox', async ({
	page
}) => {
	await open(page, './spam-filter-word-counts/#vote', 'The votes send it to the spam folder');
	await page.locator('button[data-control=message]', { hasText: 'Are you free tonight?' }).click();
	await expect(stage(page)).toContainText('The votes let it into the inbox');
	// A message of the reader's own.
	await page.locator('input[data-input=message]').fill('Claim your cash prize now');
	await expect(stage(page)).toContainText('The votes send it to the spam folder');
	await expect(stage(page)).toContainText('prize');
});

test('rare: forgetting that spam is rare sends a friend’s question to spam', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#rare', 'The votes let it into the inbox');
	await page.locator('input[type=checkbox][data-control=rarity]').uncheck();
	await expect(stage(page)).toContainText('The votes send it to the spam folder');
});

test('sneak and report: a misspelling slips past until it is reported once', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#sneak', 'The votes send it to the spam folder');
	await page.locator('input[type=checkbox][data-control=misspell]').check();
	await expect(stage(page)).toContainText('The votes let it into the inbox');
	await expect(stage(page)).toContainText('never seen');

	await page.goto('./spam-filter-word-counts/#report');
	await expect(stage(page)).toContainText('The votes let it into the inbox');
	await page.locator('button[data-control=report]').click();
	await expect(stage(page)).toContainText('The votes send it to the spam folder');
	await expect(stage(page)).not.toContainText('never seen');

	// The reader's own message, reported: its new word is now counted once, in spam.
	await page.locator('input[data-input=mine]').fill('Zorblax sale now');
	await expect(stage(page)).toContainText('never seen');
	await page.locator('button[data-control=report]').click();
	await expect(stage(page)).toContainText('Reported 1 time');
	await expect(stage(page)).not.toContainText('never seen');
});

test('real: the filter is fooled both ways', async ({ page }) => {
	await open(page, './spam-filter-word-counts/#real', 'Before any report: fooled both ways');
	await expect(stage(page)).toContainText('an advert, let into the inbox');
	await expect(stage(page)).toContainText('a friend, sent to spam');
});
