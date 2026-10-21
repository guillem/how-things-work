// The guessing machine of next-word-guessing-game, checked against the books themselves with
// plain string searches rather than the model's own counts. Runs in Node.
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { rng } from '../src/lib/draw/math';
import {
	guess,
	hits,
	learn,
	prose,
	spin,
	STOP,
	tokens,
	write,
	type Book
} from '../src/routes/next-word-guessing-game/model';

const books = JSON.parse(
	readFileSync(new URL('../src/routes/next-word-guessing-game/books.json', import.meta.url), 'utf8')
) as Book[];
const library = books.slice(0, 7);
const story = books[7];
const all = learn(library);

test('the books are the public-domain tales the page names, and the story is kept apart', () => {
	expect(books.map((b) => b.title)).toEqual([
		'The Tale of Peter Rabbit',
		'The Tale of Benjamin Bunny',
		'The Tale of Squirrel Nutkin',
		'The Tale of Timmy Tiptoes',
		'Aesop’s Fables, part 1',
		'Aesop’s Fables, part 2',
		'Aesop’s Fables, part 3',
		'The Tale of Jemima Puddle-Duck'
	]);
	expect(books[0].text).toMatch(/^Once upon a time there were four little Rabbits/);
	expect(books[0].text).toMatch(/blackberries for supper\.$/);
	expect(story.text).toContain('He had black prick ears and sandy coloured whiskers.');
	// The machine never reads the guessing game's story.
	expect(all.books).not.toContain(story.title);
});

test('words: lower case, sentence ends kept, Mr. and Mrs. not taken for sentence ends', () => {
	expect(tokens("'Now my dears,' said old Mrs. Rabbit. Don't go!")).toEqual([
		'now',
		'my',
		'dears',
		'said',
		'old',
		'mrs',
		'rabbit',
		STOP,
		"don't",
		'go',
		STOP
	]);
});

test('a card counts how often that word came next in the books', () => {
	const peter = learn(library.slice(0, 1));
	const text = library[0].text.toLowerCase();
	// "little" followed by "rabbits" and by "jacket", counted by searching the book itself.
	const count = (s: string) => text.split(s).length - 1;
	const cards = guess(peter, ['little']).cards;
	expect(cards.find((c) => c.word === 'jacket')?.count).toBe(count('little jacket'));
	expect(cards.find((c) => c.word === 'rabbits')?.count).toBe(count('little rabbits'));
	// Peter Rabbit: four little rabbits; looking back two words, only one card.
	expect(guess(peter, ['four', 'little'], 2).cards).toEqual([{ word: 'rabbits', count: 1 }]);
});

test('the cards cover every time the word was seen, most common first', () => {
	const g = guess(all, ['the']);
	const seen = library.flatMap((b) => tokens(b.text)).filter((w) => w === 'the').length;
	expect(g.total).toBe(seen);
	for (let i = 1; i < g.cards.length; i++)
		expect(g.cards[i - 1].count).toBeGreaterThanOrEqual(g.cards[i].count);
	// In these books "the" is most often followed by the fables' animals.
	expect(g.cards.slice(0, 3).map((c) => c.word)).toEqual(['lion', 'ass', 'fox']);
});

test('a word the machine never read gets no cards', () => {
	expect(guess(all, ['poke']).cards).toEqual([]);
});

test('the spinner lands on each card about as often as its count says', () => {
	const cards = guess(all, ['little']).cards;
	const random = rng(11);
	const tally = new Array<number>(cards.length).fill(0);
	const n = 40_000;
	for (let k = 0; k < n; k++) tally[spin(cards, random())]++;
	const total = cards.reduce((s, c) => s + c.count, 0);
	for (let i = 0; i < 3; i++) expect(tally[i] / n).toBeCloseTo(cards[i].count / total, 2);
	// The commonest card does not always win: the spinner picks others most of the time.
	expect(tally[0] / n).toBeLessThan(0.5);
});

test('every word it writes is one it has seen follow the word before', () => {
	const words = write(all, ['the'], 60, rng(5));
	expect(words.length).toBe(61);
	for (let i = 1; i < words.length; i++)
		expect(all.after1.get(words[i - 1])?.has(words[i])).toBe(true);
	expect(prose(['i', 'saw', 'mr', 'tod', STOP, 'he', 'ran'])).toBe('I saw Mr. Tod. He ran');
});

test('reading more books makes its top guess right more often, in a story it never read', () => {
	const one = hits(learn(library.slice(0, 1)), story.text);
	const seven = hits(all, story.text);
	// About 1 word in 30 with Peter Rabbit alone; about 1 in 10 with all seven books.
	expect(one).toBeGreaterThan(0.02);
	expect(one).toBeLessThan(0.05);
	expect(seven).toBeGreaterThan(0.09);
	expect(seven).toBeLessThan(0.12);
	expect(all.read).toBeGreaterThan(40_000);
});

test('the game sentences are in Jemima Puddle-Duck, with the answers the book gives', async () => {
	const { STOPS } = await import('../src/routes/next-word-guessing-game/stops');
	for (const s of STOPS) {
		const before = s.before.replace(/^[…“]\s*/, '');
		expect(story.text).toContain(`${before} ${s.answer}`);
		expect(s.choices).toContain(s.answer);
	}
});
