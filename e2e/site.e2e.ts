import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

// Site-level behaviour, checked on the production build served under the
// /how-things-work/ sub-path the way GitHub Pages serves it.

const BASE = '/how-things-work/';
const slugs = [
	...fs.readFileSync('src/lib/topics.ts', 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)
].map((m) => m[1]);

/** Same-origin requests that failed or answered with an error status. */
function watchRequests(page: Page) {
	const failed: string[] = [];
	page.on('requestfailed', (r) => failed.push(`failed: ${r.url()}`));
	page.on('response', (r) => {
		if (
			r.url().startsWith('http://localhost') &&
			r.status() >= 400 &&
			r.request().resourceType() !== 'document'
		)
			failed.push(`${r.status()}: ${r.url()}`);
	});
	return failed;
}

test('the index has one card per built topic and counts them against the catalogue', async ({
	page
}) => {
	await page.goto('./');
	for (const slug of slugs) {
		await expect(page.locator(`main a[href$="${slug}/"]`)).toHaveCount(1);
	}
	await expect(page.locator('main .grid > *')).toHaveCount(slugs.length);
	await expect(page.locator('.progress')).toContainText(
		`${slugs.length} of the 100 planned topics are written so far`
	);
});

for (const slug of slugs) {
	test(`${slug}: title, assets and links to other topics all resolve`, async ({ page }) => {
		const failed = watchRequests(page);
		await page.goto(`./${slug}/`);
		await expect(page.locator('.stage svg > g')).toBeAttached();
		const h1 = await page.getByRole('heading', { level: 1 }).textContent();
		await expect(page).toHaveTitle(`${h1?.trim()} — How Things Work`);
		const links = page.getByRole('navigation', { name: 'Related topics' }).getByRole('link');
		for (const href of await links.evaluateAll((as) =>
			as.map((a) => (a as HTMLAnchorElement).href)
		)) {
			expect(new URL(href).pathname.startsWith(BASE), href).toBe(true);
			const res = await page.request.get(href);
			expect(res.status(), href).toBe(200);
		}
		await page.waitForLoadState('networkidle');
		expect(failed).toEqual([]);
	});
}

test('an unknown URL one level down gets the 404 page, and its home link works', async ({
	page
}) => {
	const failed = watchRequests(page);
	const res = await page.goto('./no-such-topic');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/nothing here/i);
	await page.getByRole('link', { name: /back to all explainers/i }).click();
	await expect(page).toHaveURL(new RegExp(`${BASE}$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/how things work/i);
	expect(failed).toEqual([]);
});

// Current behaviour, recorded as-is (suspected bug, reported, not fixed): the
// 404 page uses relative URLs (./_app/…, ./), so at a nested unknown URL its
// styles and scripts don't load and "Back to all explainers" points at the
// missing URL itself. If this test starts failing, the bug may have been fixed:
// update it to the new behaviour.
test('an unknown nested URL: the 404 text shows, but assets and home link resolve under the missing path', async ({
	page
}) => {
	const failed = watchRequests(page);
	const res = await page.goto('./no/such/page/');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(/nothing here/i);
	const home = await page
		.getByRole('link', { name: /back to all explainers/i })
		.evaluate((a) => (a as HTMLAnchorElement).href);
	expect(new URL(home).pathname).toBe(`${BASE}no/such/page/`);
	await page.waitForLoadState('networkidle');
	expect(failed.length).toBeGreaterThan(0);
	expect(failed.every((f) => f.includes(`${BASE}no/such/page/_app/`))).toBe(true);
});

test.describe('theme', () => {
	test('follows a live change of the OS preference while no theme is saved', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('./');
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
		await page.emulateMedia({ colorScheme: 'dark' });
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	});

	test('a saved theme wins over a live change of the OS preference', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.goto('./');
		await page.getByRole('button', { name: /toggle dark mode/i }).click();
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await page.emulateMedia({ colorScheme: 'light' });
		await page.emulateMedia({ colorScheme: 'dark' });
		await page.emulateMedia({ colorScheme: 'light' });
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	});

	test('a saved theme is applied before the page body is parsed (no flash)', async ({ page }) => {
		await page.emulateMedia({ colorScheme: 'light' });
		await page.addInitScript(() => {
			localStorage.setItem('theme', 'dark');
			const seen = window as unknown as { themeAtBody?: string };
			new MutationObserver((_, observer) => {
				if (document.body) {
					seen.themeAtBody = document.documentElement.dataset.theme ?? 'unset';
					observer.disconnect();
				}
			}).observe(document, { childList: true, subtree: true });
		});
		await page.goto('./');
		expect(
			await page.evaluate(() => (window as unknown as { themeAtBody?: string }).themeAtBody)
		).toBe('dark');
	});
});
