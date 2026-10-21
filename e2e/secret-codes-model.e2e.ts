// Secret codes: the code wheel (Caesar cipher), the scrambled alphabet (simple substitution) and
// counting letters against the letters of Alice in Wonderland.
import { expect, test } from '@playwright/test';
import { E_TALLEST } from '../src/routes/secret-codes/english';
import {
	allTries,
	assign,
	barsOf,
	bestTry,
	byHeight,
	decode,
	encode,
	ENGLISH,
	FIRST_MESSAGE,
	hint,
	LETTER,
	NOTE,
	orderings,
	readWith,
	scramble,
	startGuess,
	tallestGuesses,
	tidy,
	turnBack,
	turnLetters,
	wrongLetters,
	yearsToTryAll
} from '../src/routes/secret-codes/model';

test('ordinary English: E is the commonest letter, then T and A; Z, J, X and Q the rarest', () => {
	const order = byHeight(ENGLISH).map((b) => b.letter);
	expect(order.slice(0, 3)).toEqual(['E', 'T', 'A']);
	expect(new Set(order.slice(-4))).toEqual(new Set(['Z', 'J', 'X', 'Q']));
	// About one letter in eight is an E, as in the usual tables of English (12 to 13%).
	const e = ENGLISH.find((b) => b.letter === 'E')!;
	expect(e.per100).toBeGreaterThan(12);
	expect(e.per100).toBeLessThan(13.5);
});

test('the code wheel with a turn of 3 is Caesar’s cipher', () => {
	// Wikipedia's example uses a left shift of 3, the same as a turn of 23.
	const plain = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG';
	expect(turnLetters(plain, 23)).toBe('QEB NRFZH YOLTK CLU GRJMP LSBO QEB IXWV ALD');
	expect(turnLetters('HELLO', 3)).toBe('KHOOR');
	// Round from Z back to A.
	expect(turnLetters('XYZ', 3)).toBe('ABC');
	for (let turn = 0; turn < 26; turn++)
		expect(turnBack(turnLetters(plain, turn), turn)).toBe(plain);
});

test('the spy who tries all 25 turns finds the message, whatever the turn', () => {
	for (const msg of [FIRST_MESSAGE, 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG', 'I LIKE CATS'])
		for (let turn = 1; turn <= 25; turn++) {
			const tries = allTries(turnLetters(msg, turn));
			expect(tries).toHaveLength(25);
			const best = bestTry(tries);
			expect(best?.turn, `${msg} at ${turn}`).toBe(turn);
			expect(best?.text).toBe(msg);
		}
});

test('a scrambled alphabet: every letter gets a partner of its own, and reading it back works', () => {
	for (let seed = 0; seed < 30; seed++) {
		const key = scramble(seed);
		expect([...key].sort().join('')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
		expect(decode(encode(LETTER, key), key)).toBe(LETTER);
	}
	expect(scramble(1)).not.toBe(scramble(2));
	expect(scramble(1)).toBe(scramble(1));
});

test('a very short message can fool the spy, or give no word at all', () => {
	// HI turned 3 places is KL; turned back 23 places it reads NO, a word too.
	expect(bestTry(allTries(turnLetters('HI', 3)))?.text).toBe('NO');
	// HELLO and WORLD are not among the story's 200 commonest words: no line stands out.
	expect(bestTry(allTries(turnLetters('HELLO WORLD', 3)))).toBeNull();
});

test('trying the 25 turns finds nothing in a scrambled message', () => {
	for (let seed = 0; seed < 30; seed++) {
		const tries = allTries(encode(FIRST_MESSAGE, scramble(seed)));
		expect(tries.some((t) => t.text === FIRST_MESSAGE)).toBe(false);
	}
});

test('26 letters can be put in 403,291,461,126,605,635,584,000,000 orders', () => {
	expect(orderings()).toBe(403291461126605635584000000n);
	// A billion tries a second: about 13 billion years, close to the age of the universe (13.8).
	const years = yearsToTryAll(1e9);
	expect(years).toBeGreaterThan(12.5e9);
	expect(years).toBeLessThan(13.8e9);
});

test('the long letter: its three tallest bars are E, T and A, however it is scrambled', () => {
	expect(LETTER.replace(/[^A-Z]/g, '')).toHaveLength(289);
	for (let seed = 0; seed < 30; seed++) {
		const key = scramble(seed);
		const guesses = tallestGuesses(encode(LETTER, key));
		expect(guesses.size).toBe(3);
		for (const [secret, guess] of guesses) expect(decode(secret, key)).toBe(guess);
	}
});

test('the one-line note: too few letters, and its tallest bar is not E', () => {
	const tallest = byHeight(barsOf(NOTE))[0];
	expect(NOTE.replace(/[^A-Z]/g, '').length).toBeLessThan(25);
	expect(tallest.letter).not.toBe('E');
	// So the secret letter the spy guesses as E is never really E, however the note is scrambled.
	for (let seed = 0; seed < 30; seed++) {
		const key = scramble(seed);
		const asE = [...tallestGuesses(encode(NOTE, key))].find(([, g]) => g === 'E')!;
		expect(decode(asE[0], key)).not.toBe('E');
	}
});

test('pieces of Alice in Wonderland: the longer the piece, the more often E is the tallest bar', () => {
	const rate = (n: number) => {
		const p = E_TALLEST.find((x) => x.length === n)!;
		return p.eTallest / p.count;
	};
	expect(rate(25)).toBeLessThan(0.3); // about 1 in 4
	expect(rate(300)).toBeGreaterThan(0.75); // about 4 in 5
	expect(rate(1000)).toBeGreaterThan(0.9); // more than 9 in 10
	for (let i = 1; i < E_TALLEST.length; i++)
		expect(E_TALLEST[i].eTallest / E_TALLEST[i].count).toBeGreaterThan(
			E_TALLEST[i - 1].eTallest / E_TALLEST[i - 1].count
		);
});

test('solving: E, T and A give half-words like T_E, and fixing letters one by one reads the letter', () => {
	const key = scramble(3);
	const secret = encode(LETTER, key);
	let guess = startGuess(secret);
	expect(readWith(secret, guess)).toContain(' T_E ');
	const kinds = new Set(LETTER.replace(/[^A-Z]/g, '')).size;
	expect(wrongLetters(secret, guess, key)).toHaveLength(kinds - 3);
	for (let i = 0; i < kinds - 3; i++) guess = hint(secret, guess, key);
	expect(wrongLetters(secret, guess, key)).toEqual([]);
	expect(readWith(secret, guess)).toBe(LETTER);
});

test('guessing a letter that is already used swaps the two guesses', () => {
	let g = '.'.repeat(26);
	g = assign(g, 'Q', 'E');
	g = assign(g, 'X', 'T');
	g = assign(g, 'X', 'E');
	expect(g[16]).toBe('T'); // Q now has X's old guess
	expect(g[23]).toBe('E');
	g = assign(g, 'B', 'E');
	expect(g[23]).toBe('.'); // X had E; B had nothing, so X now has nothing
	expect(g[1]).toBe('E');
});

test('the wheel writes capitals, without accents or odd signs', () => {
	expect(tidy('Où est   ma chatte? 42!')).toBe('OU EST MA CHATTE? !');
});
