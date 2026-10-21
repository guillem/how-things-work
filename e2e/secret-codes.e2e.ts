import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its text.
	await expect(stage(page)).toContainText(text);
}

test('wheel: turning the ring changes the secret message', { tag: '@smoke' }, async ({ page }) => {
	await open(page, './secret-codes/#wheel', 'PHHWDWWKH');
	await page.locator('input[type=range][data-control=turn]').fill('1');
	await expect(stage(page)).toContainText('NFFUBUUIF');
});

test('message: a typed message is coded with the same turn', async ({ page }) => {
	await open(page, './secret-codes/#message', 'PHHW');
	await page.getByRole('textbox', { name: 'Your message' }).fill('hello');
	await expect(stage(page)).toContainText('KHOOR');
});

test('friend: the message reads only at the right turn', async ({ page }) => {
	await open(page, './secret-codes/#friend', 'Still nonsense');
	await page.locator('input[type=range][data-control=back]').fill('2');
	await expect(stage(page)).toContainText('Still nonsense');
	await page.locator('input[type=range][data-control=back]').fill('3');
	await expect(stage(page)).toContainText('It reads!');
	await expect(stage(page)).toContainText('MEETATTHEOLDOAKATNOON');
});

test('spy: trying all 25 turns finds the one that makes words', async ({ page }) => {
	await open(page, './secret-codes/#spy', 'Turn 3 makes words!');
	await page.getByRole('button', { name: 'Pick a new secret turn' }).click();
	await expect(stage(page)).not.toContainText('Turn 3 makes words!');
	await expect(stage(page)).toContainText(/Turn \d+ makes words!/);
});

test('count: lined up by height, a long letter’s tallest bars are E, T and A', async ({ page }) => {
	await open(page, './secret-codes/#count', 'Line the bars up');
	await page.locator('input[type=checkbox][data-control=lineup]').check();
	await expect(stage(page)).toContainText('The spy’s guesses');
	await expect(stage(page).getByText('✓ right')).toHaveCount(3);
});

test('short: counting fails on the one-line note and works on the long letter', async ({
	page
}) => {
	await open(page, './secret-codes/#short', 'The secret note: 21 letters');
	await expect(stage(page)).toContainText('✗ it is');
	await page.getByRole('radio', { name: 'the long letter' }).click();
	await expect(stage(page)).toContainText('The secret letter: 289 letters');
	await expect(stage(page).getByText('✓ right')).toHaveCount(3);
});

test('solve: a guess typed for a secret letter shows, and hints finish the letter', async ({
	page
}) => {
	await open(page, './secret-codes/#solve', 'words read right');
	const blank = stage(page)
		.getByRole('button', { name: /no guess yet/ })
		.first();
	const name = await blank.getAttribute('aria-label');
	const letter = name!.match(/^Secret letter ([A-Z])/)![1];
	await blank.click();
	await page.keyboard.press('h');
	await expect(
		stage(page).getByRole('button', { name: `Secret letter ${letter}: guessed as H` })
	).toBeVisible();
	const fix = page.getByRole('button', { name: 'Fix one letter for me' });
	for (let i = 0; i < 23; i++) await fix.click();
	await expect(stage(page)).toContainText('The whole letter reads!');
	await expect(stage(page)).toContainText('DEARSAM,THETREASURE');
});
