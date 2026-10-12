import { expect, test, type Page } from '@playwright/test';
import { diffieHellman } from '../src/routes/cryptography/crypto';

const stage = (page: Page) => page.locator('.stage svg > g');

test('typing in the hash box changes the digest and never triggers the keyboard shortcuts', async ({
	page
}) => {
	await page.goto('./cryptography/#hash');
	await expect(stage(page)).toContainText('17068498 7e2ca424'); // SHA-256("Meet me at noon")
	const box = page.getByRole('textbox', { name: 'Text to hash' });
	await box.fill('');
	// Letters that are shortcuts elsewhere (restart, auto-advance, full screen, next/previous
	// step, help), a space and the navigation keys.
	await box.pressSequentially('rafjk? ');
	await box.press('ArrowLeft');
	await box.press('Home');
	await box.press('End');
	await expect(box).toHaveValue('rafjk? ');
	await expect(page).toHaveURL(/#hash$/);
	await expect(page.locator('aside h2')).toHaveText('A hash: the fingerprint of a text');
	await expect(page.getByRole('dialog')).toHaveCount(0);
	await expect(stage(page)).not.toContainText('17068498 7e2ca424');
	// FIPS 180-4's example: SHA-256("abc").
	await box.fill('abc');
	await expect(stage(page)).toContainText('ba7816bf 8f01cfea');
	await expect(stage(page)).toContainText('In: 3 characters = 24 bits');
});

test('one letter changed flips about half of the 256 bits', async ({ page }) => {
	await page.goto('./cryptography/#avalanche');
	await expect(stage(page)).toContainText('1 character apart');
	const count = stage(page).locator('text', { hasText: / of 256$/ });
	const flipped = Number((await count.textContent())?.match(/(\d+) of 256/)?.[1]);
	expect(flipped).toBeGreaterThan(100);
	expect(flipped).toBeLessThan(156);
	await page.getByRole('textbox', { name: 'Second text' }).fill('Meet me at noon');
	await expect(stage(page)).toContainText('0 characters apart');
	await expect(count).toHaveText('0 of 256');
	// One character inserted at the front is one edit, not a shift of every position.
	await page.getByRole('textbox', { name: 'Second text' }).fill('XMeet me at noon');
	await expect(stage(page)).toContainText('1 character apart');
});

test('both sides of the key exchange derive the same key', async ({ page }) => {
	await page.goto('./cryptography/#dh-shared');
	await page.locator('input[type=range][data-control=a]').fill('6');
	await page.locator('input[type=range][data-control=b]').fill('15');
	const { aliceKey } = diffieHellman(6, 15);
	await expect(stage(page).locator('text', { hasText: new RegExp(`^= ${aliceKey}$`) })).toHaveCount(
		2
	);
	await expect(stage(page)).toContainText(`key = ${diffieHellman(6, 15).B}⁶ mod 101`);
});

test('a tampered message fails the signature check; the untouched one passes', async ({ page }) => {
	await page.goto('./cryptography/#sign');
	await expect(stage(page)).toContainText('valid');
	await expect(stage(page)).not.toContainText('invalid');

	const bob = page.getByRole('textbox', { name: 'The message Bob received' });
	await bob.fill('Pay Bob 90 €');
	await expect(stage(page)).toContainText('invalid');
	await expect(stage(page)).toContainText('Eve changed it to “Pay Bob 90 €”');

	await page.locator('.action button[data-control=resend]').click();
	await expect(bob).toHaveValue('Pay Bob 10 €');
	await expect(stage(page)).not.toContainText('invalid');

	// Alice signs a new message: Bob's copy follows and still verifies.
	await page.getByRole('textbox', { name: 'Alice’s message' }).fill('Pay Bob 20 €');
	await expect(bob).toHaveValue('Pay Bob 20 €');
	await expect(stage(page)).toContainText('valid');
	await expect(stage(page)).not.toContainText('invalid');
});
