/**
 * Pen-and-paper secret codes and the two ways they break.
 *
 * - The code wheel (a Caesar cipher): every letter steps the same number of places along the
 *   alphabet, round from Z to A. A spy who does not know the turn tries all 25 and looks for the
 *   one with English words in it (here: words among the 200 commonest of Alice in Wonderland).
 * - The scrambled alphabet (a simple substitution cipher): every letter gets its own partner. The
 *   spy counts the letters of the secret message and lines the bars up with the bars of ordinary
 *   English (the letter counts of Alice in Wonderland, `english.ts`): in a long message the
 *   tallest bars give E, T and A; past those the bars of English are too close together, so the
 *   rest is filled in by spotting half-words. In a one-line note there are too few letters for
 *   the bars to mean anything.
 */
import { COMMON_WORDS, LETTER_COUNTS, LETTER_TOTAL } from './english';

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 0 for A … 25 for Z; −1 for anything that is not a capital letter. */
export function letterIndex(ch: string): number {
	const i = ch.charCodeAt(0) - 65;
	return ch.length === 1 && i >= 0 && i < 26 ? i : -1;
}

const mod26 = (n: number) => ((n % 26) + 26) % 26;

/**
 * A message the way the wheel writes it: capitals, accents dropped, letters, spaces and a little
 * punctuation kept (anything else becomes a space), runs of spaces shortened, at most `max` long.
 */
export function tidy(text: string, max = 36): string {
	return text
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toUpperCase()
		.replace(/[^A-Z .,!?'’-]/g, ' ')
		.replace(/ {2,}/g, ' ')
		.replace(/^ /, '')
		.slice(0, max);
}

// ---- the code wheel ---------------------------------------------------------------------------

/** Turns every letter `turn` places along the alphabet (round from Z to A); the rest stays. */
export function turnLetters(text: string, turn: number): string {
	let out = '';
	for (const ch of text) {
		const i = letterIndex(ch);
		out += i < 0 ? ch : ALPHABET[mod26(i + turn)];
	}
	return out;
}

/** Undoes `turnLetters(text, turn)`: every letter turned back by the same amount. */
export const turnBack = (text: string, turn: number) => turnLetters(text, -turn);

const COMMON = new Set(COMMON_WORDS);

/** How many letters of `text` belong to common English words (two letters or more). */
export function wordLetters(text: string): number {
	let n = 0;
	for (const w of text.match(/[A-Z]+/g) ?? []) if (w.length >= 2 && COMMON.has(w)) n += w.length;
	return n;
}

export interface Try {
	/** How far the spy turned the letters back, 1 to 25. */
	turn: number;
	text: string;
	/** Letters of the try that make up common English words. */
	words: number;
}

/** The spy's 25 tries: the secret message turned back by every amount from 1 to 25. */
export function allTries(secret: string): Try[] {
	return Array.from({ length: 25 }, (_, k) => {
		const text = turnBack(secret, k + 1);
		return { turn: k + 1, text, words: wordLetters(text) };
	});
}

/**
 * The try that reads as English: the one with the most letters in common words, provided it has
 * some and no other try has as many. Null when nothing stands out.
 */
export function bestTry(tries: Try[]): Try | null {
	const sorted = [...tries].sort((a, b) => b.words - a.words);
	if (sorted[0].words === 0 || sorted[1].words === sorted[0].words) return null;
	return sorted[0];
}

// ---- the scrambled alphabet --------------------------------------------------------------------

/** A scramble: `key[i]` is the secret letter written for `ALPHABET[i]`. */
export type Key = string;

/** A small seeded random generator (mulberry32), so a scramble can be made again from its seed. */
function random(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * A scrambled alphabet made from `seed`: a shuffle of the 26 letters in which no letter is its own
 * partner (so every letter of the message really changes).
 */
export function scramble(seed: number): Key {
	const rnd = random(seed * 7919 + 17);
	for (;;) {
		const a = ALPHABET.split('');
		for (let i = 25; i > 0; i--) {
			const j = Math.floor(rnd() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		if (a.every((ch, i) => ch !== ALPHABET[i])) return a.join('');
	}
}

/** Writes `text` with the scrambled alphabet. */
export function encode(text: string, key: Key): string {
	let out = '';
	for (const ch of text) {
		const i = letterIndex(ch);
		out += i < 0 ? ch : key[i];
	}
	return out;
}

/** Reads `secret` back with the same scrambled alphabet. */
export function decode(secret: string, key: Key): string {
	return encode(secret, invert(key));
}

/** The scramble that undoes `key`. */
export function invert(key: Key): Key {
	const out = new Array<string>(26);
	for (let i = 0; i < 26; i++) out[letterIndex(key[i])] = ALPHABET[i];
	return out.join('');
}

/** How many different orders the 26 letters can be put in (26 × 25 × … × 1). */
export function orderings(): bigint {
	let n = 1n;
	for (let k = 2n; k <= 26n; k++) n *= k;
	return n;
}

/** Years needed to try every order at `perSecond` tries a second. */
export function yearsToTryAll(perSecond: number): number {
	return Number(orderings()) / perSecond / (365.25 * 24 * 3600);
}

// ---- counting letters --------------------------------------------------------------------------

/** How many times each letter, A to Z, appears in `text`. */
export function countLetters(text: string): number[] {
	const n = new Array<number>(26).fill(0);
	for (const ch of text) {
		const i = letterIndex(ch);
		if (i >= 0) n[i]++;
	}
	return n;
}

export interface Bar {
	letter: string;
	count: number;
	/** Out of every 100 letters. */
	per100: number;
}

function toBars(counts: readonly number[]): Bar[] {
	const total = counts.reduce((a, b) => a + b, 0);
	return counts.map((count, i) => ({
		letter: ALPHABET[i],
		count,
		per100: total ? (100 * count) / total : 0
	}));
}

/** The bars of a message, A to Z. */
export const barsOf = (text: string) => toBars(countLetters(text));

/** The bars of ordinary English: the letters of Alice in Wonderland, A to Z. */
export const ENGLISH: Bar[] = toBars(LETTER_COUNTS);
export const ENGLISH_TOTAL = LETTER_TOTAL;

/** Bars from tallest to shortest (equal bars in alphabetical order). */
export function byHeight(bars: Bar[]): Bar[] {
	return [...bars].sort((a, b) => b.count - a.count || (a.letter < b.letter ? -1 : 1));
}

/**
 * The spy's first guesses: the `n` tallest bars of the secret message, matched with the `n`
 * tallest bars of English (E, T and A). Secret letter → guessed letter.
 */
export function tallestGuesses(secret: string, n = 3): Map<string, string> {
	const s = byHeight(barsOf(secret)).filter((b) => b.count > 0);
	const e = byHeight(ENGLISH);
	const out = new Map<string, string>();
	for (let i = 0; i < Math.min(n, s.length); i++) out.set(s[i].letter, e[i].letter);
	return out;
}

// ---- solving by hand ---------------------------------------------------------------------------

/**
 * The spy's guesses while solving: `guess[i]` is the letter guessed for the secret letter
 * `ALPHABET[i]`, or '.' when there is no guess yet. Each English letter is used at most once.
 */
export type Guess = string;

export const NO_GUESS = '.';

/** Where the spy starts: the three tallest bars guessed as E, T and A, nothing else. */
export function startGuess(secret: string): Guess {
	const g = new Array<string>(26).fill(NO_GUESS);
	for (const [s, p] of tallestGuesses(secret)) g[letterIndex(s)] = p;
	return g.join('');
}

/**
 * Guesses `plain` for the secret letter `secretLetter`. If another secret letter already had
 * `plain`, the two swap: it gets this letter's old guess (or none).
 */
export function assign(guess: Guess, secretLetter: string, plain: string): Guess {
	const g = guess.split('');
	const i = letterIndex(secretLetter);
	const other = g.indexOf(plain);
	if (other >= 0 && other !== i) g[other] = g[i];
	g[i] = plain;
	return g.join('');
}

/** The secret message read with the guesses so far ('_' where a letter has no guess yet). */
export function readWith(secret: string, guess: Guess): string {
	let out = '';
	for (const ch of secret) {
		const i = letterIndex(ch);
		out += i < 0 ? ch : guess[i] === NO_GUESS ? '_' : guess[i];
	}
	return out;
}

/** The secret letters of `secret` whose guess is missing or wrong, commonest first. */
export function wrongLetters(secret: string, guess: Guess, key: Key): string[] {
	const truth = invert(key);
	return byHeight(barsOf(secret))
		.filter((b) => b.count > 0 && guess[letterIndex(b.letter)] !== truth[letterIndex(b.letter)])
		.map((b) => b.letter);
}

/** A hint: the commonest secret letter still guessed wrong (or not at all) gets its right letter. */
export function hint(secret: string, guess: Guess, key: Key): Guess {
	const [s] = wrongLetters(secret, guess, key);
	return s ? assign(guess, s, invert(key)[letterIndex(s)]) : guess;
}

// ---- the messages -------------------------------------------------------------------------------

/** The message on the wheel until the reader types one. */
export const FIRST_MESSAGE = 'MEET AT THE OLD OAK AT NOON';

/** The one-line note of the "too short" step. */
export const NOTE = FIRST_MESSAGE;

/** The spy's long letter (the project's own text, about 290 letters). */
export const LETTER = tidy(
	'Dear Sam, the treasure is not in the old mill any more. I moved it late last night, while the others were asleep. Walk to the far end of the garden, past the apple tree, and take sixty paces toward the lake. Dig beneath the flat stone that has a white mark on it. Keep the map safe and tell nobody, not even your sister. Burn this note when you have read it. See you soon, Alex',
	1000
);
