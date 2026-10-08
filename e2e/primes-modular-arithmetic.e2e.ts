import { expect, test } from '@playwright/test';

const stage = (page: import('@playwright/test').Page) => page.locator('.stage svg > g');

test('stepping the sieve to the end leaves only primes; 25 of them up to 100', async ({ page }) => {
	await page.goto('/primes-modular-arithmetic/#sieve');
	await expect(stage(page)).toContainText('49 multiples, all new');
	const next = page.locator('.action button[data-control=nextPrime]');
	for (let i = 0; i < 3; i++) await next.click();
	await expect(page.locator('input[type=range][data-control=sieve]')).toHaveValue('4');
	await expect(stage(page)).toContainText('every number left is prime.');
	await expect(stage(page)).toContainText('Still standing: 25 numbers');
	await page.goto('/primes-modular-arithmetic/#survivors');
	await expect(stage(page)).toContainText('25 primes up to 100');
});

test('the number grid picks numbers from the keyboard', async ({ page }) => {
	await page.goto('/primes-modular-arithmetic/#primes');
	await expect(stage(page)).toContainText('= 2² × 3 × 5');
	const grid = page.getByRole('slider', { name: /Number grid/ });
	await grid.focus();
	await page.keyboard.press('End');
	await expect(stage(page)).toContainText('= 2² × 5²');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect(grid).toHaveAttribute('aria-valuetext', '97: prime');
	await expect(stage(page)).toContainText('Only 1 and itself: a prime.');
});

test('clock arithmetic: 9 + 5 is 2 on 12 hours; powers fill a prime clock but not 12', async ({
	page
}) => {
	await page.goto('/primes-modular-arithmetic/#clock');
	await expect(stage(page)).toContainText(/9 \+ 5 ≡ 2\s+\(mod 12\)/);
	await page.goto('/primes-modular-arithmetic/#powers');
	await expect(stage(page)).toContainText('every nonzero hour visited once');
	await page.locator('input[type=range][data-control=powHours]').fill('12');
	await expect(stage(page)).toContainText('Never back to 1');
	await expect(stage(page)).toContainText('4, 8, 4, 8, …');
});
