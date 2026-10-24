import { expect, test } from '@playwright/test';
test.use({ reducedMotion: 'reduce' });
test('shortening the ruler quadruples its note, and the handle keeps the slider in step', async ({
	page
}) => {
	await page.goto('./vibrations-and-sound/#pitch');
	const handle = page.getByRole('slider', { name: 'Length of free ruler' });
	await expect(page.locator('.stage')).toContainText('10 cm: 82 wobbles each second');
	await handle.focus();
	await handle.press('Home');
	await expect(page.locator('input[data-control=length]')).toHaveValue('5');
	await expect(page.locator('.stage')).toContainText('5 cm: 326 wobbles each second');
});
test('moving the ear away reduces arriving energy without changing the ruler', async ({ page }) => {
	await page.goto('./vibrations-and-sound/#distance');
	await expect(page.locator('.stage')).toContainText('2 metres away: 25%');
	await page.locator('input[data-control=distance]').fill('8');
	await expect(page.locator('.stage')).toContainText('8 metres away: 2%');
});
test('pumping all the air out keeps the bell but stops its airborne sound', async ({ page }) => {
	await page.goto('./vibrations-and-sound/#jar');
	await expect(page.locator('.stage')).toContainText('100% of the air remains');
	await page.locator('input[data-control=air]').fill('0');
	await expect(page.locator('.stage')).toContainText('No air: no airborne sound');
	await expect(page.locator('.stage')).toContainText('The bell still vibrates');
	await page.getByRole('button', { name: 'Ring and hear' }).click();
	await expect(page.locator('.stage')).toContainText('No airborne sound reaches the ear');
	await page.evaluate(() => {
		location.hash = '#next';
	});
	await expect(page.locator('.stage')).toContainText('A ruler, a wobble, a travelling push');
	await expect(page.locator('.stage')).toContainText('Sound plays only when you press the button');
	await expect(page.locator('.stage')).not.toContainText('No airborne sound reaches the ear');
});

test('the twang button reports the note it plays, then that it has finished', async ({ page }) => {
	// Under browser automation the page stays silent (navigator.webdriver); the status line is
	// what the visitor reads.
	await page.clock.install();
	await page.goto('./vibrations-and-sound/#pitch');
	const stage = page.locator('.stage');
	await expect(stage).toContainText('Sound plays only when you press the button');
	await page.locator('input[data-control=length]').fill('5');
	await expect(stage).toContainText('5 cm: 326 wobbles each second');
	await page.getByRole('button', { name: 'Twang and hear' }).click();
	await expect(stage).toContainText('Playing the model’s note');
	await page.clock.runFor(1500);
	await expect(stage).toContainText('Note finished — press to play again');
	await page.getByRole('button', { name: 'Twang and hear' }).press('Enter');
	await expect(stage).toContainText('Playing the model’s note');
});

test('one push crosses steel first, then water, while it has barely entered the air', async ({
	page
}) => {
	await page.goto('./vibrations-and-sound/#materials');
	const stage = page.locator('.stage');
	await expect(stage).toContainText('Water carries the push along');
	// The frozen frame of reduced motion: the three fronts at very different distances.
	await expect(stage).toContainText('1.7 m');
	await expect(stage).toContainText('7.4 m');
	await expect(stage).toContainText('arrived');
	await expect(stage).toContainText('crosses 10 m in 29 thousandths of a second');
	await expect(stage).toContainText('crosses 10 m in 2 thousandths of a second');
	await page.locator('button[data-control=material][data-value=steel]').click();
	await expect(stage).toContainText('Steel carries the push along');
});

test('the loudness readout distinguishes Medium, Strong and Strongest twangs', async ({ page }) => {
	await page.goto('./vibrations-and-sound/#louder');
	await expect(page.locator('.stage')).toContainText('Medium twang: the same note');
	await page.locator('input[data-control=strength]').fill('3');
	await expect(page.locator('.stage')).toContainText('Strong twang: the same note');
	await page.locator('input[data-control=strength]').fill('4');
	await expect(page.locator('.stage')).toContainText('Strongest twang: the same note');
});
