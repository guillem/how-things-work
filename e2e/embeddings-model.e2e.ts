// Checks the GloVe word vectors and the arithmetic behind the embeddings explainer: the
// similarities, neighbours, analogies and sentence comparisons the page quotes. Runs in Node.
import { expect, test } from '@playwright/test';
import * as data from '../src/routes/embeddings/glove-data';
import { Embeddings, angleDeg, cosine, tokens } from '../src/routes/embeddings/embeddings';
import { FLOAT_VECTORS } from './fixtures/glove-float-sample';

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

	test('8-bit storage moves similarities by less than 0.01, as the page says', () => {
		// The original GloVe vectors (32-bit text) of 32 words against the page's 8-bit copy.
		const words = Object.keys(FLOAT_VECTORS);
		expect(words.length).toBeGreaterThan(30);
		const float = (w: string) => FLOAT_VECTORS[w].split(' ').map(Number);
		let worst = 0;
		for (const a of words)
			for (const b of words) {
				if (a >= b) continue;
				const moved = Math.abs(e.similarity(a, b)! - cosine(float(a), float(b)));
				worst = Math.max(worst, moved);
			}
		expect(worst).toBeLessThan(0.01);
		expect(worst).toBeGreaterThan(0); // the stored vectors really are rounded
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
		expect(e.similarity('good', 'bad')).toBeCloseTo(0.77, 2);
		expect(e.similarity('happy', 'sad')).toBeCloseTo(0.68, 2);
	});

	test('two random words have a cosine of about 0.3: the vectors share a lean', () => {
		let sum = 0;
		let n = 0;
		for (let i = 0; i < e.size; i += 13)
			for (let j = i + 5; j < e.size; j += 211, n++) sum += e.similarity(e.words[i], e.words[j])!;
		expect(sum / n).toBeCloseTo(0.3, 1);
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
		expect(share('pca')).toBeLessThan(0.03);
		// On t-SNE king's dot sits among prince, queen and princess; on PCA it does not.
		expect(e.mapNeighbours('tsne', 'king', 3)).toContain('queen');
		expect(e.kept('pca', 'king')).toBeLessThan(0.2);
	});
});

test.describe('analogies: b − a + c', () => {
	test('king − man + woman: queen once the three input words are left out', () => {
		const queen = e.analogy('man', 'king', 'woman')!.results[0];
		expect(queen.word).toBe('queen');
		expect(queen.cos).toBeCloseTo(0.77, 2);
		// The pitfall: with the inputs allowed, the closest word is king itself.
		const king = e.analogy('man', 'king', 'woman', { excludeInputs: false })!.results[0];
		expect(king.word).toBe('king');
		expect(king.cos).toBeCloseTo(0.84, 2);
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
		const brother = top(e.analogy('man', 'brother', 'woman', { k: 10 })!.results);
		expect(brother[0]).toBe('daughter');
		expect(brother.indexOf('sister')).toBe(5); // sixth
		// big → bigger, small → … larger (smaller is second).
		expect(top(e.analogy('big', 'bigger', 'small')!.results).slice(0, 2)).toEqual([
			'larger',
			'smaller'
		]);
	});

	test('stereotypes in the text show up in the vectors', () => {
		expect(e.analogy('man', 'doctor', 'woman')!.results[0].word).toBe('nurse');
		expect(e.analogy('woman', 'nurse', 'man')!.results[0].word).toBe('doctor');
		// Part of it is the rule: with the inputs allowed, doctor − man + woman is closest to doctor.
		expect(e.analogy('man', 'doctor', 'woman', { excludeInputs: false })!.results[0].word).toBe(
			'doctor'
		);
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

	test('measured against man → woman: king → queen 0.44, brother → sister 0.59, random steps 0', () => {
		const step = (a: string, b: string) => Array.from(e.vector(b)!, (v, j) => v - e.vector(a)![j]);
		const mw = step('man', 'woman');
		expect(cosine(step('king', 'queen'), mw)).toBeCloseTo(0.44, 2);
		expect(cosine(step('brother', 'sister'), mw)).toBeCloseTo(0.59, 2);
		// The baseline the directions panel prints.
		expect(Math.abs(e.randomStepCosine())).toBeLessThan(0.05);
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
		// The two pairs the page quotes.
		expect(
			e.sentenceSimilarity('Shares fell sharply on Wall Street', 'the stock market dropped')
		).toBeCloseTo(0.89, 2);
		expect(
			e.sentenceSimilarity('The team won the match', 'the bank raised interest rates')
		).toBeCloseTo(0.41, 2);
	});

	test('an average forgets word order: who bit whom is lost', () => {
		expect(e.sentenceSimilarity('the dog bit the man', 'the man bit the dog')).toBeCloseTo(1, 6);
	});

	test('no known word, no vector', () => {
		expect(e.sentence('the of and').vector).toBeNull();
		expect(e.sentenceSimilarity('the of and', 'dog')).toBeNull();
	});
});
