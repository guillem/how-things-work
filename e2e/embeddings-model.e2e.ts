// Checks the GloVe word vectors and the arithmetic behind the embeddings explainer: the
// similarities, neighbours, analogies and sentence comparisons the page quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import * as data from '../src/routes/embeddings/glove-data';
import { Embeddings, angleDeg, cosine, tokens } from '../src/routes/embeddings/embeddings';

const e = new Embeddings(data);
const top = (r: { word: string }[]) => r.map((n) => n.word);

test.describe('the vectors', () => {
	test('a few thousand words, 100 numbers each, all unit length', () => {
		expect(e.size).toBeGreaterThan(3000);
		expect(e.size).toBeLessThan(4000);
		expect(e.dims).toBe(100);
		for (const w of ['king', 'queen', 'cat', 'paris', 'guitar']) {
			const v = e.vector(w)!;
			expect(v).toHaveLength(100);
			expect(Math.hypot(...v)).toBeCloseTo(1, 5);
		}
		// Stop words such as "the" are not in the subset.
		expect(e.has('the')).toBe(false);
		expect(e.vector('the')).toBeNull();
	});

	test('cosine: 1 for the same direction, 0 at right angles, −1 opposite', () => {
		expect(cosine([1, 0], [3, 0])).toBeCloseTo(1, 12);
		expect(cosine([1, 0], [0, 2])).toBeCloseTo(0, 12);
		expect(cosine([1, 1], [-2, -2])).toBeCloseTo(-1, 12);
		expect(angleDeg([1, 0], [1, 1])).toBeCloseTo(45, 10);
	});

	test('related words point in similar directions, unrelated ones do not', () => {
		expect(e.similarity('king', 'queen')).toBeCloseTo(0.75, 2);
		expect(e.similarity('cat', 'dog')).toBeCloseTo(0.88, 2);
		expect(e.similarity('king', 'banana')!).toBeLessThan(0.2);
		expect(e.similarity('cat', 'dog')!).toBeGreaterThan(e.similarity('cat', 'car')!);
		// Opposites share contexts, so they are close too.
		expect(e.similarity('good', 'bad')!).toBeGreaterThan(0.7);
	});
});

test.describe('nearest neighbours, in the full 100-D space', () => {
	test('cat, red, paris and apple', () => {
		expect(top(e.neighbours('cat', 3))).toEqual(['dog', 'rabbit', 'monkey']);
		expect(top(e.neighbours('red', 3))).toEqual(['yellow', 'blue', 'green']);
		expect(top(e.neighbours('paris', 3))).toEqual(['france', 'london', 'french']);
		// News text: "apple" is the company.
		expect(top(e.neighbours('apple', 2))).toEqual(['microsoft', 'software']);
	});

	test('the 2-D maps distort: t-SNE keeps about 4 in 10 true neighbours close, PCA almost none', () => {
		// Over every 7th word: the share of its 10 true neighbours among its 10 closest dots.
		const share = (kind: 'tsne' | 'pca') => {
			let sum = 0;
			let n = 0;
			for (let i = 0; i < e.size; i += 7, n++) sum += e.kept(kind, e.words[i]);
			return sum / n;
		};
		const tsne = share('tsne');
		expect(tsne).toBeGreaterThan(0.35);
		expect(tsne).toBeLessThan(0.5);
		expect(share('pca')).toBeLessThan(0.1);
		// On t-SNE king's dot sits among prince, queen and princess; on PCA it does not.
		expect(e.mapNeighbours('tsne', 'king', 3)).toContain('queen');
		expect(e.kept('pca', 'king')).toBeLessThan(0.2);
	});
});

test.describe('analogies: b − a + c', () => {
	test('king − man + woman: queen once the three input words are left out', () => {
		expect(top(e.analogy('man', 'king', 'woman')!.results)[0]).toBe('queen');
		// The pitfall: with the inputs allowed, the closest word is king itself.
		expect(top(e.analogy('man', 'king', 'woman', { excludeInputs: false })!.results)[0]).toBe(
			'king'
		);
	});

	test('capitals, tenses and comparatives', () => {
		expect(e.analogy('france', 'paris', 'italy')!.results[0].word).toBe('rome');
		expect(e.analogy('japan', 'tokyo', 'germany')!.results[0].word).toBe('berlin');
		expect(e.analogy('walk', 'walked', 'swim')!.results[0].word).toBe('swam');
		expect(e.analogy('man', 'actor', 'woman')!.results[0].word).toBe('actress');
		expect(e.analogy('man', 'uncle', 'woman')!.results[0].word).toBe('aunt');
	});

	test('and where they fail', () => {
		// brother − man + woman: daughter, not sister.
		expect(e.analogy('man', 'brother', 'woman')!.results[0].word).toBe('daughter');
		// big → bigger, small → … larger (smaller is second).
		expect(top(e.analogy('big', 'bigger', 'small')!.results).slice(0, 2)).toEqual([
			'larger',
			'smaller'
		]);
	});

	test('stereotypes in the text show up in the vectors', () => {
		expect(e.analogy('man', 'doctor', 'woman')!.results[0].word).toBe('nurse');
		expect(e.analogy('woman', 'nurse', 'man')!.results[0].word).toBe('doctor');
	});

	test('the man → woman differences point roughly the same way', () => {
		const pairs: [string, string][] = [
			['man', 'woman'],
			['king', 'queen'],
			['actor', 'actress'],
			['uncle', 'aunt']
		];
		const axes = e.pairAxes(pairs)!;
		for (const [a, b] of pairs) {
			const d = Array.from(e.vector(b)!, (v, j) => v - e.vector(a)![j]);
			expect(cosine(d, axes.x)).toBeGreaterThan(0.5);
		}
		expect(cosine(axes.x, axes.y)).toBeCloseTo(0, 5);
	});
});

test.describe('sentences as averages', () => {
	test('words are letters only, lower-cased', () => {
		expect(tokens("The King's dog!")).toEqual(['the', 'king', 's', 'dog']);
	});

	test('similar sentences score high, unrelated ones low; unknown words are skipped', () => {
		const s = e.sentence('the stock market fell sharply');
		expect(s.known).toEqual(['stock', 'market', 'fell', 'sharply']);
		expect(s.unknown).toEqual(['the']);
		expect(
			e.sentenceSimilarity('the stock market fell sharply', 'shares dropped on wall street')!
		).toBeGreaterThan(0.85);
		expect(
			e.sentenceSimilarity('the stock market fell sharply', 'my cat sat in the garden')!
		).toBeLessThan(0.4);
	});

	test('an average forgets word order: who bit whom is lost', () => {
		expect(e.sentenceSimilarity('the dog bit the man', 'the man bit the dog')).toBeCloseTo(1, 6);
	});

	test('no known word, no vector', () => {
		expect(e.sentence('the of and').vector).toBeNull();
		expect(e.sentenceSimilarity('the of and', 'dog')).toBeNull();
	});
});
