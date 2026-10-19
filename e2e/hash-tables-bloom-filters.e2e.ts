// Browser tests of the hash-tables-bloom-filters page: a word's bucket follows the number of
// buckets; chaining and linear probing measured against Knuth's expected probes as the table
// fills, and another hash seed giving another sample of the same expectation; a table that
// doubles and rehashes with under two re-insertions per word; a Bloom filter's false positive and its
// "definitely absent"; the measured false-positive rate beside the formula and its best k; tiny
// filters above the formula; and a hash that reads only the first letter clustering both
// structures. Reduced motion (complete frames), keyboard and buttons, the fake clock for the
// Bloom filter's sequence of queries.
import { expect, test, type Page } from '@playwright/test';
import { playUntil } from './play';

const stage = (page: Page) => page.locator('.stage svg > g:not([data-leaving])');
const range = (page: Page, id: string) => page.locator(`input[type=range][data-control="${id}"]`);
async function key(page: Page, id: string, k: string) {
	await range(page, id).focus();
	await page.keyboard.press(k);
}

test.use({ reducedMotion: 'reduce' });

test('a word’s bucket is its hash mod the number of buckets', async ({ page }) => {
	await page.goto('./hash-tables-bloom-filters/#buckets');
	await expect(stage(page)).toContainText(/h = 0x[0-9a-f]{8}/);
	await expect(stage(page)).toContainText(/[0-9,]+ mod 12 = \d+/);
	await key(page, 'm', 'Home');
	await expect(stage(page)).toContainText(/[0-9,]+ mod 5 = [0-4]bucket/);
});

test(
	'chaining: the probes follow 1 + α/2 and α as the table fills',
	{ tag: '@smoke' },
	async ({ page }) => {
		await page.goto('./hash-tables-bloom-filters/#chaining');
		await expect(stage(page)).toContainText('chaining: 64 slots, 48 words, load factor α = 0.75');
		await expect(stage(page)).toContainText('found: 1.29 probes');
		await expect(stage(page)).toContainText('expected 1.37 (1 + α/2 ≈ 1.38)');
		await expect(stage(page)).toContainText('not found: 0.71 probes');
		await key(page, 'chainKeys', 'End');
		await expect(stage(page)).toContainText('128 words, load factor α = 2.00');
		await expect(stage(page)).toContainText('found: 1.96 probes');
		await expect(stage(page)).toContainText('expected 1.99 (1 + α/2 ≈ 2.00)');
	}
);

test('linear probing: misses climb steeply as the table fills; another seed is another sample', async ({
	page
}) => {
	await page.goto('./hash-tables-bloom-filters/#probing');
	await expect(stage(page)).toContainText('found: 1.30 probes');
	await expect(stage(page)).toContainText('expected 1.72');
	await expect(stage(page)).toContainText('not found: 3.27 probes');
	await expect(stage(page)).toContainText('expected 3.53');
	// another hash seed: the expectation stays, the measurement changes
	await page.locator('button[data-control="reseed"]').click();
	await expect(stage(page)).toContainText('expected 1.72');
	await expect(stage(page)).not.toContainText('found: 1.30 probes');
	await page.locator('button[data-control="reseed"]').click();
	await key(page, 'probeKeys', 'End');
	await expect(stage(page)).toContainText('63 words, load factor α = 0.98');
	await expect(stage(page)).toContainText('(off the chart)');
	await expect(stage(page)).toContainText('expected 32.50');
});

test('a table that doubles past α = 0.75 re-inserts fewer than two words per word inserted', async ({
	page
}) => {
	await page.goto('./hash-tables-bloom-filters/#resize');
	// 8 → 16 → … → 512 slots: rehashes at the 7th, 13th, 25th, 49th, 97th and 193rd word
	await expect(stage(page)).toContainText('linear probing: 200 words in 512 slots, α = 0.39');
	await expect(stage(page)).toContainText('6 doublings so far');
	await expect(stage(page)).toContainText('378 words reinserted in all, 1.89 per word inserted');
	await page.locator('button[data-control="growScheme"][data-value="chaining"]').click();
	await expect(stage(page)).toContainText('chaining: 200 words in 512 slots');
});

test('a Bloom filter can be wrong about “maybe”, never about “absent”', async ({ page }) => {
	await page.goto('./hash-tables-bloom-filters/#bloom');
	await expect(stage(page)).toContainText('a Bloom filter: 32 bits, k = 3 hash functions');
	await expect(stage(page)).toContainText(
		'all 3 bits are 1: maybe present, but it was never added: a false positive'
	);
	await expect(stage(page)).toContainText('bits set: 8 of 32');
});

test('the measured false-positive rate tracks the formula; it is lowest near k = (m/n) ln 2', async ({
	page
}) => {
	await page.goto('./hash-tables-bloom-filters/#false-positives');
	await expect(stage(page)).toContainText('1,000 words in 8,000 bits (8 per word), k = 3');
	await expect(stage(page)).toContainText(
		'measured: 60 of 2,000 never-added words said “maybe”, 3.0%'
	);
	await expect(stage(page)).toContainText('3.1%');
	await expect(stage(page)).toContainText('best k = (m/n) ln 2 = 5.5');
	await range(page, 'fpK').fill('6');
	await expect(stage(page)).toContainText('formula (1 − e^(−kn/m))^k: 2.2%');
	// fewer false positives at k = 6, near the best k, than at k = 3
	await expect(stage(page)).toContainText(
		'measured: 55 of 2,000 never-added words said “maybe”, 2.8%'
	);
	await key(page, 'bitsPerKey', 'End');
	await expect(stage(page)).toContainText('20,000 bits (20 per word)');
	await expect(stage(page)).toContainText('best k = (m/n) ln 2 = 13.9, off the chart');
});

test('a tiny filter does worse than the formula', async ({ page }) => {
	await page.goto('./hash-tables-bloom-filters/#tiny');
	await expect(stage(page)).toContainText('16 bits: measured 3.3%, formula 2.2%');
	await key(page, 'tinyK', 'End');
	await expect(stage(page)).toContainText(/16 bits: measured 6\.\d%, formula 3\.4%/);
});

test('a hash that reads only the first letter clusters the table and the filter', async ({
	page
}) => {
	await page.goto('./hash-tables-bloom-filters/#bad-hash');
	await expect(stage(page)).toContainText('the hash reads the whole word');
	await expect(stage(page)).toContainText('mean probes to find a word: 1.51');
	await expect(stage(page)).toContainText('false positives: 2.8% of 2,000 never-added words');
	await key(page, 'letters', 'Home');
	await expect(stage(page)).toContainText('the hash reads only the first letter');
	await expect(stage(page)).toContainText('longest chain: 128 words, all starting ‘s’');
	await expect(stage(page)).toContainText('false positives: 100% of 2,000 never-added words');
	await expect(stage(page)).toContainText('bits set: 144 of 8,000');
});

test.describe('in motion', () => {
	test.use({ reducedMotion: 'no-preference' });

	test('the Bloom filter adds four words, then rules one out and lets a false positive in', async ({
		page
	}) => {
		await page.clock.install();
		await page.goto('./hash-tables-bloom-filters/#bloom');
		await playUntil(page, stage(page), 'added: its 3 bits set to 1', 5_000);
		await playUntil(page, stage(page), /bit \d+ is 0: definitely never added/, 15_000);
		await playUntil(page, stage(page), 'maybe present (it was added)', 10_000);
		await playUntil(page, stage(page), 'a false positive', 10_000);
	});

	test('a long linear-probing search is drawn to its end', async ({ page }) => {
		await page.clock.install();
		await page.goto('./hash-tables-bloom-filters/#probing');
		await range(page, 'probeKeys').fill('63');
		// with one empty slot left, a missing word walks a run of dozens of slots to it
		await playUntil(page, stage(page), /not there, [1-9]\d probes \(an empty slot\)/, 30_000);
	});
});
