import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseCatalog } from '../src/lib/catalog-parse';
import { assertPaths, parsePaths, stops, place, neighbours } from '../src/lib/paths-parse';

const catalog = parseCatalog(readFileSync('docs/TOPICS.md', 'utf8'));
const source = readFileSync('docs/PATHS.md', 'utf8');
const paths = parsePaths(source);
const expected = [
	'learning-from-data',
	'ngram-text-models',
	'gradient-descent',
	'neural-networks',
	'embeddings',
	'language-models',
	'transformers',
	'tokenization',
	'positional-encoding',
	'residual-stream-logit-lens',
	'training-a-tiny-language-model',
	'scaling-laws',
	'rlhf-alignment',
	'chain-of-thought-scratchpad',
	'kv-cache-inference',
	'speculative-decoding'
];

const reading = (slugs: string) => `## example
- **Title:** An example
- **Promise:** Learn by reading.
- **Chapters:**
  - First: ${slugs}`;

test('the published language-model reading has sixteen built stops in prerequisite order', () => {
	expect(() => assertPaths(paths, catalog)).not.toThrow();
	expect(paths.map((p) => p.id)).toEqual(['language-models']);
	expect(stops(paths[0])).toEqual(expected);
	expect(paths[0].chapters.map((c) => c.title)).toEqual([
		'Counting',
		'The network',
		'The model',
		'Training and serving'
	]);
});

test('unknown stops and prerequisites placed later are actionable authoring errors', () => {
	expect(() => assertPaths(parsePaths(reading('unknown-topic')), catalog)).toThrow(
		/example.*unknown-topic/
	);
	expect(() =>
		assertPaths(parsePaths(reading('ngram-text-models, learning-from-data')), catalog)
	).toThrow(/example.*ngram-text-models.*learning-from-data.*earlier/);
	// Off-path prerequisites are allowed, without being silently added to the reading.
	const offPath = parsePaths(reading('gradient-descent'));
	expect(() => assertPaths(offPath, catalog)).not.toThrow();
	expect(stops(offPath[0])).toEqual(['gradient-descent']);
});

test('empty input is allowed and multiple paths retain their independent order', () => {
	expect(parsePaths('')).toEqual([]);
	const multiple = parsePaths(
		reading('learning-from-data') +
			'\n' +
			reading('gradient-descent').replace('## example', '## other')
	);
	expect(multiple.map((p) => p.id)).toEqual(['example', 'other']);
	expect(() => assertPaths(multiple, catalog)).not.toThrow();
});

for (const [name, input] of [
	['missing title', reading('learning-from-data').replace('- **Title:** An example', '')],
	[
		'missing promise',
		reading('learning-from-data').replace('- **Promise:** Learn by reading.', '')
	],
	['empty chapter', reading('')],
	['missing chapters', reading('learning-from-data').split('- **Chapters:**')[0]],
	['invalid slug', reading('Learning From Data')],
	[
		'repeated stop across chapters',
		reading('learning-from-data') + '\n  - Second: learning-from-data'
	],
	['repeated path id', reading('learning-from-data') + '\n' + reading('gradient-descent')]
]) {
	test(`rejects ${name}`, () => {
		expect(() => parsePaths(input)).toThrow(/PATHS.md.*example/);
	});
}

test('positions and navigation cross chapters and stop at the ends', () => {
	const path = paths[0];
	expect(place(path, 'gradient-descent')).toMatchObject({
		index: 3,
		chapter: { title: 'The network' }
	});
	expect(neighbours(path, 'gradient-descent')).toEqual({
		previous: 'ngram-text-models',
		next: 'neural-networks'
	});
	expect(neighbours(path, expected[0])).toEqual({ previous: undefined, next: expected[1] });
	expect(neighbours(path, expected[15])).toEqual({ previous: expected[14], next: undefined });
	expect(place(path, 'photosynthesis')).toBeUndefined();
	expect(neighbours(path, 'photosynthesis')).toEqual({ previous: undefined, next: undefined });
});
