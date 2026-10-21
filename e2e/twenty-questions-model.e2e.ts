// Twenty questions: halving the numbers from 1 to 100, a 1,000-page dictionary (Webster's Second
// word list), and the animals of the UCI Zoo dataset.
import { expect, test } from '@playwright/test';
import {
	afterAnswers,
	ask,
	bestQuestion,
	BOARD,
	flips,
	halving,
	inOrder,
	ladder,
	lookUp,
	oneByOne,
	PAGES,
	pageOf,
	PENGUIN,
	playBest,
	questionById,
	secretAnimal,
	shuffled,
	twins,
	WORD_COUNT,
	yesCount
} from '../src/routes/twenty-questions/model';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test.describe('a number from 1 to 100', () => {
	test('asking about the middle always finds the number, in seven questions at most', () => {
		const counts = range(100).map((secret) => {
			const qs = halving(secret);
			const end = afterAnswers(qs.map((q) => q.yes));
			expect(end).toEqual({ lo: secret, hi: secret, mid: null });
			return qs.length;
		});
		expect(Math.max(...counts)).toBe(7);
		// Some numbers are found in six: "at most seven", not "always seven".
		expect(Math.min(...counts)).toBe(6);
	});

	test('every answer keeps half of what is left (one more, at most, when it is odd)', () => {
		for (const secret of range(100))
			for (const q of halving(secret)) {
				const left = q.hi - q.lo + 1;
				const kept = q.yes ? q.hi - q.mid : q.mid - q.lo + 1;
				expect(kept).toBeLessThanOrEqual(Math.ceil(left / 2));
				expect(kept).toBeGreaterThanOrEqual(Math.floor(left / 2));
			}
	});

	test('one at a time takes up to a hundred questions', () => {
		expect(Math.max(...range(100).map(oneByOne))).toBe(100);
	});

	test('the first question is "bigger than 50?", and a yes leaves 51 to 100', () => {
		expect(afterAnswers([])).toEqual({ lo: 1, hi: 100, mid: 50 });
		expect(afterAnswers([true])).toMatchObject({ lo: 51, hi: 100 });
	});

	test('twice as many numbers take one more question; a million take twenty', () => {
		for (const n of [100, 200, 1000]) {
			const worst = Math.max(...range(n).map((s) => halving(s, n).length));
			expect(ladder(n).length - 1).toBe(worst);
		}
		expect(ladder(100).length - 1).toBe(7);
		expect(ladder(200).length - 1).toBe(8);
		expect(ladder(1000).length - 1).toBe(10);
		expect(ladder(1_000_000).length - 1).toBe(20);
		expect(halving(1_000_000, 1_000_000).length).toBeLessThanOrEqual(20);
		expect(ladder(100)).toEqual([100, 50, 25, 13, 7, 4, 2, 1]);
	});
});

test.describe('the thousand-page dictionary', () => {
	test('1,000 pages in alphabetical order, of about 211 words each', () => {
		expect(PAGES).toHaveLength(1000);
		expect(WORD_COUNT).toBe(210_773);
		for (let p = 0; p < PAGES.length; p++) {
			expect(PAGES[p][0] <= PAGES[p][1]).toBe(true);
			if (p > 0) expect(PAGES[p - 1][1] < PAGES[p][0]).toBe(true);
		}
		expect(PAGES[0][0]).toBe('a');
		expect(PAGES[999][1]).toBe('zythum');
	});

	test('opening in the middle finds any page in ten opens at most', () => {
		let most = 0;
		for (let p = 0; p < PAGES.length; p++)
			for (const word of PAGES[p]) {
				const s = lookUp(word);
				expect(s.found).toBe(true);
				expect(s.opens[s.opens.length - 1].page).toBe(p);
				most = Math.max(most, s.opens.length);
			}
		expect(most).toBe(10);
	});

	test('the first open is the middle page, and each open keeps the half the word is in', () => {
		const s = lookUp('kitten');
		expect(s.opens[0].at).toBe(499);
		for (const o of s.opens) {
			expect(pageOf('kitten')).toBeGreaterThanOrEqual(o.lo);
			expect(pageOf('kitten')).toBeLessThanOrEqual(o.hi);
		}
	});

	test('the page’s words: kitten is on page 428, zebra near the end', () => {
		expect(pageOf('kitten') + 1).toBe(428);
		expect(flips('kitten')).toBe(428);
		expect(lookUp('kitten').opens.length).toBe(10);
		expect(flips('zebra')).toBe(997);
		expect(flips('apple')).toBe(48);
	});

	test('in a shuffled pile, opening in the middle almost never finds the word', () => {
		const pile = shuffled(1);
		expect([...pile].sort((a, b) => a - b)).toEqual(inOrder());
		let found = 0;
		for (let p = 0; p < PAGES.length; p++) if (lookUp(PAGES[p][0], pile).found) found++;
		expect(found).toBeLessThan(50);
		for (const w of ['apple', 'dragon', 'kitten', 'pizza', 'rainbow', 'zebra'])
			expect(lookUp(w, pile).found).toBe(false);
	});
});

test.describe('the animal board (UCI Zoo)', () => {
	test('99 animals, and the dataset agrees with what we know about them', () => {
		expect(BOARD).toHaveLength(99);
		const get = (name: string) => BOARD.find((a) => a.name === name)!;
		expect(get('penguin').has.feathers).toBe(true);
		expect(get('penguin').has.flies).toBe(false);
		expect(get('dolphin').has.milk).toBe(true);
		expect(get('dolphin').legs).toBe(0);
		expect(get('platypus').has.milk && get('platypus').has.eggs).toBe(true);
		// Every mammal feeds its babies milk, and only mammals do; only birds have feathers.
		for (const a of BOARD) {
			expect(a.has.milk).toBe(a.type === 1);
			expect(a.has.feathers).toBe(a.type === 2);
		}
	});

	test('"Is it a penguin?" hides one animal when the answer is no', () => {
		const notPenguin = BOARD.find((a) => a.name === 'lion')!;
		expect(ask(BOARD, PENGUIN, notPenguin)).toHaveLength(98);
		expect(yesCount(BOARD, PENGUIN)).toBe(1);
	});

	test('the split of the questions the page compares', () => {
		const split = (id: string) => yesCount(BOARD, questionById(id)!);
		expect(split('hunts')).toBe(54);
		expect(split('eggs')).toBe(58);
		expect(split('flies')).toBe(24);
		expect(split('penguin')).toBe(1);
		// The most even question on the full board hides at least 45 animals whatever the answer.
		const best = bestQuestion(BOARD)!;
		const y = yesCount(BOARD, best);
		expect(Math.min(y, 99 - y)).toBeGreaterThanOrEqual(45);
	});

	test('good questions find any animal, or a group the board cannot tell apart, in 8 or fewer', () => {
		let most = 0;
		for (const secret of BOARD) {
			const { rounds, left } = playBest(secret);
			most = Math.max(most, rounds.length);
			expect(left).toContain(secret);
			// What is left answers every question alike: only "Is it a …?" can tell them apart.
			expect(bestQuestion(left)).toBeNull();
		}
		expect(most).toBe(8);
	});

	test('some animals answer every question alike: a lion and a wolf, for one', () => {
		const groups = twins();
		const lion = groups.find((g) => g.some((a) => a.name === 'lion'))!;
		expect(lion.map((a) => a.name)).toContain('wolf');
		expect(lion).toHaveLength(10);
	});

	test('each press of "New secret animal" brings a different animal, and all come round', () => {
		const seen = new Set(range(99).map((k) => secretAnimal(k - 1).name));
		expect(seen.size).toBe(99);
		expect(secretAnimal(0).name).not.toBe(secretAnimal(1).name);
	});

	test('"Is it a …?" about the secret animal leaves only it', () => {
		const secret = secretAnimal(0);
		expect(ask(BOARD, questionById(`is:${secret.name}`)!, secret)).toEqual([secret]);
	});
});
