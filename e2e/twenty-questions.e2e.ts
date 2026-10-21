import { expect, test, type Page } from '@playwright/test';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');

async function open(page: Page, url: string, text: string | RegExp) {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(url);
	// The scene is loaded lazily: wait for its text.
	await expect(stage(page)).toContainText(text);
}

/** Answers the page's questions truthfully for `secret` until it names the number. */
async function play(page: Page, secret: number) {
	for (let i = 0; i < 10; i++) {
		const yes = stage(page).getByRole('button', { name: /^Yes, bigger than \d+$/ });
		if (!(await yes.isVisible())) return;
		const mid = Number((await yes.getAttribute('aria-label'))!.match(/\d+/)![0]);
		const answer = secret > mid ? yes : stage(page).getByRole('button', { name: /^No, not/ });
		await answer.click();
		await expect(stage(page)).toContainText(`Questions asked: ${i + 1}`);
	}
}

test(
	'number: answering the questions finds the number in seven or fewer',
	{ tag: '@smoke' },
	async ({ page }) => {
		await open(page, './twenty-questions/#number', 'Is your number bigger than 50?');
		await play(page, 37);
		await expect(stage(page)).toContainText(/Your number, found with [67] questions/);
		await expect(stage(page)).toContainText('would take 37 questions');
		await page.getByRole('button', { name: 'Start again' }).click();
		await expect(stage(page)).toContainText('Is your number bigger than 50?');
		await play(page, 2);
		await expect(stage(page)).toContainText('Your number, found with 7 questions');
		await expect(stage(page)).toContainText('would take 2 questions');
	}
);

test('doubling: a million numbers take twenty questions', async ({ page }) => {
	await open(page, './twenty-questions/#doubling', '100 numbers: 7 questions');
	await page.getByRole('radio', { name: '200' }).click();
	await expect(stage(page)).toContainText('200 numbers: 8 questions');
	await page.getByRole('radio', { name: 'a million' }).click();
	await expect(stage(page)).toContainText('A million numbers: 20 questions');
});

test('dictionary: opening in the middle finds a word in ten opens or fewer', async ({ page }) => {
	await open(page, './twenty-questions/#dictionary', 'Found on page 428 after 10 opens.');
	await page.getByRole('radio', { name: 'zebra' }).click();
	await expect(stage(page)).toContainText('Found on page 997 after 8 opens.');
});

test('flipping: page by page takes hundreds of looks', async ({ page }) => {
	await open(page, './twenty-questions/#flipping', 'Pages looked at: 428');
	await page.getByRole('radio', { name: 'apple' }).click();
	await expect(stage(page)).toContainText('Pages looked at: 48');
	await expect(stage(page)).toContainText('Found on page 48');
});

test('shuffled: halving a shuffled pile throws the page away', async ({ page }) => {
	await open(page, './twenty-questions/#shuffled', 'Found on page 428');
	await page.locator('input[type=checkbox][data-control=shuffle]').check();
	await expect(stage(page)).toContainText('Not found! Its page was thrown away');
	await page.locator('input[type=checkbox][data-control=shuffle]').uncheck();
	await expect(stage(page)).toContainText('Found on page 428');
});

test('animals: questions hide animals, and guessing by name finds the secret', async ({ page }) => {
	await open(page, './twenty-questions/#animals', 'Questions: 0 · 99 left');
	await stage(page).getByRole('button', { name: 'Does it have feathers?' }).click();
	// 20 of the 99 have feathers: one answer leaves 20, the other 79.
	await expect(stage(page)).toContainText(/Questions: 1 · (20|79) left/);
	const ask = [
		'Does it lay eggs?',
		'Can it fly?',
		'Does it live in water?',
		'Does it hunt other animals?',
		'Does it have six legs or more?',
		'Does it have four legs?',
		'Does it have a tail?',
		'Is it bigger than a cat?'
	];
	for (const q of ask) {
		const chip = stage(page).getByRole('button', { name: q, exact: true });
		if ((await chip.getAttribute('aria-disabled')) === 'true') break;
		await chip.click();
	}
	// Then guess by name until it is found.
	const guesses = stage(page).getByRole('button', { name: /^Guess: is it an? /i });
	for (let i = 0; i < 99; i++) {
		if (
			await stage(page)
				.getByText(/^It’s the /)
				.isVisible()
		)
			break;
		await guesses.first().click();
	}
	await expect(stage(page)).toContainText(/It’s the .+! Found in \d+ questions\./);
	await page.getByRole('button', { name: 'New secret animal' }).click();
	await expect(stage(page)).toContainText('Questions: 0 · 99 left');
});

test('penguin: "Is it a penguin?" hides one animal, a good question about half', async ({
	page
}) => {
	await open(page, './twenty-questions/#penguin', '98 animals left');
	await expect(stage(page)).toContainText('1 animal left');
	await page.getByRole('radio', { name: 'Does it hunt other animals?' }).click();
	await expect(stage(page)).toContainText('54 animals left');
	await expect(stage(page)).toContainText('45 animals left');
	await expect(stage(page)).toContainText('About half are gone');
});

test.describe('on a phone', () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	/** The rendered height of an element's text, in CSS pixels. */
	const height = async (page: Page, name: string | RegExp) =>
		(await stage(page).getByText(name, { exact: true }).first().boundingBox())?.height ?? 0;

	/** Each of the `n` animals the reader can still guess shows its name, big enough to read. */
	async function namesReadable(page: Page, n: number) {
		const guesses = stage(page).getByRole('button', { name: /^Guess: is it an? /i });
		await expect(guesses).toHaveCount(n);
		const names = await guesses.evaluateAll((els) =>
			els.map((e) => /^Guess: Is it an? (.+)\?$/.exec(e.getAttribute('aria-label') ?? '')?.[1])
		);
		for (const name of names) {
			await expect(stage(page).getByText(name ?? '?', { exact: true })).toBeVisible();
			expect(await height(page, name ?? '?')).toBeGreaterThanOrEqual(10);
		}
	}

	test('animals: every animal left is named on the board, and the questions read', async ({
		page
	}) => {
		const panel = page.getByRole('group', { name: 'Readouts' });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./twenty-questions/#animals');
		await expect(panel).toContainText('99 of 99, after 0 questions');
		await namesReadable(page, 99);

		await stage(page).getByRole('button', { name: 'Ask a question' }).click();
		const feathers = stage(page).getByRole('button', { name: 'Does it have feathers?' });
		await expect(feathers).toBeVisible();
		expect(await height(page, 'Feathers?')).toBeGreaterThanOrEqual(11);
		await feathers.click();
		await expect(panel).toContainText(/(20|79) of 99, after 1 question/);
		const left = Number(/(\d+) of 99/.exec((await panel.textContent()) ?? '')?.[1]);
		await namesReadable(page, left);

		// Guess by name until it is found.
		const guesses = stage(page).getByRole('button', { name: /^Guess: is it an? /i });
		const found = stage(page).getByText(/^It’s the .+!$/);
		for (let i = 0; i < 99 && !(await found.isVisible()); i++) await guesses.first().click();
		await expect(found).toBeVisible();
		await expect(panel).toContainText(/Found\s*the .+, in \d+ questions/);
	});

	test('penguin: the split board names every animal', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('./twenty-questions/#penguin');
		await expect(stage(page).getByText('penguin', { exact: true })).toBeVisible();
		expect(await height(page, 'penguin')).toBeGreaterThanOrEqual(10);
		for (const name of ['aardvark', 'vampire bat', 'wren'])
			await expect(stage(page).getByText(name, { exact: true })).toBeVisible();
	});
});
