// Checks the tokenization explainer's models: byte-pair encoding learned from a small text (against
// the worked examples of the Hugging Face course and of Gage's 1994 article, and the rules the page
// states), and GPT-2's real tokenizer on the examples the page quotes. That tokenizer is checked
// against GPT-2's own Python tokenizer in language-models-model.e2e.ts.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { Training } from '../src/routes/tokenization/bpe-train';
import { Gpt2, LANGUAGES } from '../src/routes/tokenization/gpt2';
import { DEFAULT_CORPUS, SAMPLE } from '../src/routes/tokenization/steps';

const gpt2 = new Gpt2(
	new Uint8Array(
		readFileSync(new URL('../src/routes/language-models/gpt2-merges.bin', import.meta.url))
	)
);
const pieces = (ids: number[]) => ids.map((i) => gpt2.bpe.text(i));
const cut = (s: string) => pieces(gpt2.bpe.encode(s));
const merged = (t: Training) => t.merges.map((m) => `${t.text(m.a)}+${t.text(m.b)}=${m.count}`);

test.describe('learning merges from a text', () => {
	test('the Hugging Face course’s example: ug, then un, then hug', () => {
		// hug ×10, pug ×5, pun ×12, bun ×4, hugs ×5, one word per line (no leading space)
		const corpus = ['hug', 10, 'pug', 5, 'pun', 12, 'bun', 4, 'hugs', 5] as const;
		let text = '';
		for (let i = 0; i < corpus.length; i += 2) text += `${corpus[i]}\n`.repeat(+corpus[i + 1]);
		const t = new Training(text);
		expect(merged(t).slice(0, 3)).toEqual(['u+g=20', 'u+n=16', 'h+ug=15']);
	});

	test('Gage’s example: aaabdaaabac becomes five tokens after three merges', () => {
		const t = new Training('aaabdaaabac');
		expect(t.merges).toHaveLength(3);
		expect(t.text(t.merges[0].id)).toBe('aa');
		expect(t.total).toEqual([11, 9, 7, 5]);
		expect(pieces2(t, 'aaabdaaabac')).toEqual(['aaab', 'd', 'aaab', 'a', 'c']);
	});

	test('a tie goes to the pair that comes first in the text', () => {
		expect(merged(new Training('xyzw xyzw'))[0]).toBe('x+y=2');
		expect(merged(new Training('zwxy zwxy'))[0]).toBe('z+w=2');
	});

	test('each merge adds one token to the vocabulary and shortens the text', () => {
		const t = new Training(DEFAULT_CORPUS);
		for (let k = 0; k < t.merges.length; k++) {
			expect(t.vocabulary(k + 1)).toBe(t.vocabulary(k) + 1);
			expect(t.total[k + 1]).toBeLessThan(t.total[k]);
			expect(t.count(SAMPLE, k + 1)).toBeLessThanOrEqual(t.count(SAMPLE, k));
			// the text cut with the first k merges is the text as it stood during training
			const all = t.words.reduce((s, w) => s + w.count * t.tokensOf(w, k).length, 0);
			expect(t.count(DEFAULT_CORPUS, k)).toBe(all);
		}
		// it stops when no pair occurs twice
		expect(t.merges.at(-1)!.count).toBeGreaterThanOrEqual(2);
		expect(t.pairs(t.merges.length)[0].count).toBe(1);
	});

	test('the numbers the page quotes for Hamlet', () => {
		const t = new Training(DEFAULT_CORPUS);
		expect(t.total[0]).toBe(384); // bytes
		expect(t.merges).toHaveLength(49);
		expect(t.total.at(-1)).toBe(196);
		expect(t.count(SAMPLE, 0)).toBe(49);
		expect(t.count(SAMPLE)).toBe(33);
		// the first two merges are GPT-2's own first and third
		expect(merged(t).slice(0, 2)).toEqual([' +t=19', 'h+e=11']);
		expect(t.merges.slice(0, 8).map((m) => t.text(m.id))).toEqual([
			' t',
			'he',
			' a',
			' to',
			'nd',
			' s',
			' o',
			' the'
		]);
		expect(gpt2.bpe.text(256)).toBe(' t');
		expect(gpt2.bpe.text(258)).toBe('he');
	});

	test('bytes cover any text: nothing is ever unknown', () => {
		const t = new Training(DEFAULT_CORPUS);
		const ids = t.encode('naïve 東京 🙂').flatMap((p) => p.tokens);
		const bytes = ids.flatMap((i) => t.tokenBytes[i]);
		expect(new TextDecoder().decode(Uint8Array.from(bytes))).toBe('naïve 東京 🙂');
	});
});

/** The tokens of a text cut with all the merges learned, as text. */
function pieces2(t: Training, s: string) {
	return t.encode(s).flatMap((p) => p.tokens.map((i) => t.text(i)));
}

test.describe('GPT-2’s tokenizer', () => {
	test('its first merges are ␣t, ␣a, he, in, re, on, ␣the', () => {
		expect(Array.from({ length: 7 }, (_, r) => gpt2.bpe.text(256 + r))).toEqual([
			' t',
			' a',
			'he',
			'in',
			're',
			'on',
			' the'
		]);
	});

	test('merges in the order learned, not the longest token first', () => {
		expect(cut(' doth')).toEqual([' d', 'oth']);
		expect(pieces(gpt2.longestMatch(' doth'))).toEqual([' dot', 'h']);
		expect(cut(' thine')).toEqual([' th', 'ine']);
		expect(pieces(gpt2.longestMatch(' thine'))).toEqual([' thin', 'e']);
		// the ranks the page quotes: ␣d (33rd merge), ot (58th), oth (594th), ␣dot (16,350th)
		const [p] = gpt2.bpe.pieces(' doth');
		expect(p.merges.map((m) => m.rank + 1)).toEqual([33, 58, 594]);
		expect(gpt2.bpe.encode(' dot')).toEqual([256 + 16_349]);
		expect(cut('Doth')).toEqual(['D', 'oth']);
		expect(pieces(gpt2.longestMatch('Doth'))).toEqual(['Do', 'th']);
		expect(cut(' Doth')).toEqual([' D', 'oth']);
		// on common text the two rules usually agree
		const s = 'To be, or not to be, that is the question';
		expect(gpt2.longestMatch(s)).toEqual(gpt2.bpe.encode(s));
	});

	test('the pre-split uses Unicode whitespace, as Python’s regex and tiktoken do', () => {
		// U+0085 (next line) is whitespace there but not in JavaScript's \s; U+FEFF is the reverse
		expect(gpt2.bpe.pieces(' \u0085!').map((p) => p.text)).toEqual([' ', '\u0085', '!']);
		expect(gpt2.bpe.pieces(' \ufeff!').map((p) => p.text)).toEqual([' \ufeff!']);
	});

	test('common words are one token, rare ones several', () => {
		expect(cut(' the')).toEqual([' the']);
		expect(cut(' unbelievable')).toEqual([' unbelievable']);
		expect(cut(' tokenization')).toEqual([' token', 'ization']);
		expect(cut(' antidisestablishmentarianism')).toEqual([
			' ant',
			'idis',
			'establishment',
			'arian',
			'ism'
		]);
	});

	test('numbers: single tokens up to 361, then fewer and fewer; years are uneven', () => {
		const n = gpt2.numberTokens(1000);
		expect(n.indexOf(2)).toBe(362);
		const perHundred = (h: number) => n.slice(100 * h, 100 * h + 100).filter((k) => k === 1).length;
		expect(perHundred(4)).toBe(52);
		expect([5, 6, 7, 8, 9].map(perHundred)).toEqual([18, 15, 12, 6, 9]);
		expect(n.filter((k) => k === 1)).toHaveLength(505);
		expect(Math.max(...n)).toBe(2);
		expect(cut(' 777')).toEqual([' 777']);
		expect(cut(' 778')).toEqual([' 7', '78']);
		expect(cut(' 2025')).toEqual([' 2025']);
		expect(cut(' 2026')).toEqual([' 20', '26']);
		expect(cut(' 1234567')).toEqual([' 123', '45', '67']);
		expect(cut(' 3.14159')).toEqual([' 3', '.', '14', '159']);
	});

	test('the same request costs from 10 to 47 tokens depending on the language', () => {
		const counts = Object.fromEntries(
			LANGUAGES.map((l) => [l.lang, gpt2.bpe.encode(l.text).length])
		);
		expect(counts).toEqual({
			English: 10,
			Spanish: 13,
			German: 19,
			French: 21,
			Japanese: 13,
			Chinese: 17,
			Korean: 22,
			Arabic: 27,
			Russian: 40,
			Greek: 44,
			Hindi: 47
		});
	});

	test('a word is one token, its letters spelled out are ten', () => {
		expect(gpt2.bpe.encode(' strawberry')).toHaveLength(1);
		expect(cut('strawberry')).toEqual(['st', 'raw', 'berry']);
		expect(cut(' s t r a w b e r r y')).toHaveLength(10);
		// single letters are tokens too
		expect(gpt2.bpe.encode(' r')).toEqual([374]);
	});
});
