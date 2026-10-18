// Checks the counting machine behind the n-gram explainer against Tiny Shakespeare, with
// independent counts (plain string searches) rather than the model's own sorted index. Runs in Node.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
	Alphabet,
	MAX_N,
	NgramModel,
	measure,
	realWordShare,
	split,
	unseenMarks,
	unseenProfile,
	words
} from '../src/routes/ngram-text-models/ngram';

const text = readFileSync(
	new URL('../src/routes/ngram-text-models/tinyshakespeare.txt', import.meta.url),
	'utf8'
);
const { train, heldOut } = split(text);
const alphabet = new Alphabet(text);
const model = new NgramModel(train, alphabet);
const small = new NgramModel(train.slice(0, 10_000), alphabet);
const medium = new NgramModel(train.slice(0, 100_000), alphabet);

/** Occurrences of `s` in `t` that have a character after them, counted with indexOf. */
function occurrences(t: string, s: string) {
	let n = 0;
	for (let i = t.indexOf(s); i !== -1 && i + s.length < t.length; i = t.indexOf(s, i + 1)) n++;
	return n;
}

/** Whether `s` occurs in `t` with a character after it. */
function seen(t: string, s: string) {
	const i = t.indexOf(s);
	return i !== -1 && (i + s.length < t.length || t.indexOf(s, i + 1) !== -1);
}

test.describe('the text', () => {
	test('Tiny Shakespeare: 1,115,394 characters of 65 kinds, split 90/10 as nanoGPT does', () => {
		expect(text.length).toBe(1_115_394);
		expect(alphabet.size).toBe(65);
		expect(train.length).toBe(1_003_854);
		expect(heldOut.length).toBe(111_540);
		expect(train + heldOut).toBe(text);
	});
});

test.describe('counting', () => {
	test('the counts after a window add up to its occurrences, found by plain search', () => {
		for (const w of ['th', 'e', 'king', 'To be', 'ROMEO:\n']) {
			const f = model.followers(w);
			expect(f.total).toBe(occurrences(train, w));
			expect(f.next.reduce((s, x) => s + x.count, 0)).toBe(f.total);
		}
		// what follows "th": e most often, then a space ("with", "doth", "both")
		const th = model.followers('th');
		expect(th.next[0]).toEqual({ char: 'e', count: occurrences(train, 'the') });
		expect(th.next[1].char).toBe(' ');
	});

	test('a window that never occurs has no counts', () => {
		expect(model.followers('qz').total).toBe(0);
		expect(model.followers('Ω').total).toBe(0);
	});

	test('distinct windows match a plain count; possible windows outgrow them from n = 4', () => {
		const t = train.slice(0, 10_000);
		for (const n of [1, 3, 6]) {
			const seen = new Set<string>();
			for (let i = 0; i + n < t.length; i++) seen.add(t.slice(i, i + n));
			expect(small.windows(n).distinct).toBe(seen.size);
		}
		// 65 × 65 × 65 × 65 ≈ 17.9 million possible windows of 4: more than the text has letters
		expect(65 ** 3).toBeLessThan(train.length);
		expect(65 ** 4).toBeGreaterThan(train.length);
		expect(model.windows(10).distinct).toBeLessThan(train.length);
	});
});

test.describe('writing', () => {
	test('a seed gives the same text every time; another seed a different one', () => {
		expect(model.sample(4, 300, 7, '\n\n').text).toBe(model.sample(4, 300, 7, '\n\n').text);
		expect(model.sample(4, 300, 7, '\n\n').text).not.toBe(model.sample(4, 300, 8, '\n\n').text);
	});

	test('letters are drawn in proportion to the counts', () => {
		// n = 0: plain letter counts. In a long sample, the space is as common as in the text.
		const s = model.sample(0, 40_000, 3).text;
		const share = (t: string, c: string) => t.split(c).length / t.length;
		expect(share(s, ' ')).toBeCloseTo(share(train, ' '), 2);
		expect(share(s, 'e')).toBeCloseTo(share(train, 'e'), 2);
	});

	test('every window the sampler uses was seen in the training text', () => {
		const s = model.sample(6, 400, 2, '\n\n');
		const cs = Array.from(s.text);
		s.draws.forEach((d, i) => {
			const at = s.prompt + i;
			expect(d.window).toBe(Math.min(6, at));
			const window = cs.slice(at - d.window, at + 1).join('');
			expect(train.includes(window)).toBe(true);
		});
	});

	test('longer windows: more real words, more forced choices, longer copies', () => {
		const avg = (n: number, f: (m: ReturnType<typeof measure>) => number) =>
			[1, 2, 3].reduce((s, seed) => s + f(measure(model, n, seed, 1000)), 0) / 3;
		const real = [1, 3, 5, 10].map((n) => avg(n, (m) => m.realWords));
		const forced = [1, 3, 5, 10].map((n) => avg(n, (m) => m.forced));
		const copy = [1, 3, 5, 10].map((n) => avg(n, (m) => m.copy.length));
		for (const series of [real, forced, copy])
			for (let i = 1; i < series.length; i++) expect(series[i]).toBeGreaterThan(series[i - 1]);
		expect(real[0]).toBeLessThan(0.4); // n = 1: gibberish
		expect(real[3]).toBeGreaterThan(0.97); // n = 10: nearly every word exists
		expect(forced[3]).toBeGreaterThan(0.8); // n = 10: most letters had only one choice
	});

	test('the longest copy is found word for word in the text, and is the longest', () => {
		const m = measure(model, 10, 1, 600);
		const { start, length, source } = m.copy;
		const copied = Array.from(m.sample.text)
			.slice(start, start + length)
			.join('');
		expect(length).toBeGreaterThan(40);
		expect(train.slice(source, source + length)).toBe(copied);
		expect(train.includes(copied)).toBe(true);
		// no stretch one character longer occurs anywhere
		const cs = Array.from(m.sample.text);
		for (let i = m.sample.prompt; i + length + 1 <= cs.length; i++)
			expect(train.includes(cs.slice(i, i + length + 1).join(''))).toBe(false);
	});

	test('real words: those of the training text', () => {
		expect(words("O'er the hill, KING!")).toEqual(["o'er", 'the', 'hill', 'king']);
		expect(realWordShare(model, 'the king said zzyzx and')).toBeCloseTo(3 / 4, 10);
		// a last word that ends in a space or punctuation is complete, and counts
		const pets = new NgramModel('cat dog');
		expect(realWordShare(pets, 'cat zzz ')).toBe(0.5);
		expect(realWordShare(pets, 'cat zzz.')).toBe(0.5);
		expect(realWordShare(pets, 'cat zzz')).toBe(1); // "zzz" may be cut off: left out
	});

	test('past the end of its text, the machine backs off to a shorter window', () => {
		const tiny = new NgramModel('abc');
		const s = tiny.sample(2, 12, 1);
		// "bc" ends the text and has no next letter: the machine drops to "c", then to nothing
		expect(s.draws.some((d) => d.window < Math.min(2, s.draws.indexOf(d)))).toBe(true);
		const cs = Array.from(s.text);
		s.draws.forEach((d, i) => {
			const window = cs.slice(i - d.window, i + 1).join('');
			expect('abc'.includes(window)).toBe(true);
		});
	});
});

test.describe('held-out text', () => {
	test('unseen windows: a plain search agrees', () => {
		const passage = heldOut.slice(5_000, 5_400);
		for (const n of [3, 6, 9]) {
			const marks = unseenMarks(model, passage, n);
			for (let j = n; j < passage.length; j++)
				expect(marks[j]).toBe(!seen(train, passage.slice(j - n, j)));
		}
	});

	test('the share never seen climbs with n towards all of them', () => {
		const p = unseenProfile(model, heldOut);
		for (let n = 1; n <= MAX_N; n++) expect(p[n]).toBeGreaterThanOrEqual(p[n - 1]);
		expect(p[2]).toBeLessThan(0.01);
		expect(p[10]).toBeGreaterThan(0.7);
	});

	test('ten times more text helps, but not against the explosion', () => {
		const p10k = unseenProfile(small, heldOut);
		const p100k = unseenProfile(medium, heldOut);
		const p1m = unseenProfile(model, heldOut);
		for (let n = 3; n <= MAX_N; n++) {
			expect(p100k[n]).toBeLessThan(p10k[n]);
			expect(p1m[n]).toBeLessThan(p100k[n]);
		}
		// a hundred times more text: at n = 10 still three windows in four never seen
		expect(p10k[10]).toBeGreaterThan(0.98);
		expect(p1m[10]).toBeGreaterThan(0.74);
	});
});
