/**
 * The guessing machine behind "How a chatbot picks its next word": it reads a few children's
 * books (books.json, from Project Gutenberg), counts which word came next after every word (and
 * after every pair of words), and writes by spinning a spinner whose slices are as big as those
 * counts. A toy word-pair (bigram) and word-triple (trigram) counter, nothing more.
 */

export interface Book {
	title: string;
	text: string;
}

/** End of a sentence: written as a full stop, counted like a word so the machine can end one. */
export const STOP = '.';

const ABBREVIATIONS = new Set(['mr', 'mrs', 'dr', 'st']);

/**
 * Splits a text into lower-case words and sentence ends. Commas, quotes and dashes are dropped;
 * apostrophes and hyphens inside a word stay ("don't", "puddle-duck").
 */
export function tokens(text: string): string[] {
	const out: string[] = [];
	const clean = text
		.replace(/[’‘]/g, "'")
		.replace(/--+/g, ' ')
		.toLowerCase();
	const re = /[a-z]+(?:['-][a-z]+)*|[.!?]+/g;
	for (const m of clean.matchAll(re)) {
		const w = m[0];
		if (/^[.!?]/.test(w)) {
			const prev = out[out.length - 1];
			if (prev === undefined || prev === STOP || ABBREVIATIONS.has(prev)) continue;
			out.push(STOP);
		} else out.push(w);
	}
	return out;
}

export interface Card {
	word: string;
	count: number;
}

/** What the machine has learned: for each word (and each pair of words), what came next. */
export interface Machine {
	/** Words read in all. */
	read: number;
	/** Books read, by title. */
	books: string[];
	after1: Map<string, Map<string, number>>;
	after2: Map<string, Map<string, number>>;
}

function bump(map: Map<string, Map<string, number>>, key: string, next: string) {
	let m = map.get(key);
	if (!m) map.set(key, (m = new Map()));
	m.set(next, (m.get(next) ?? 0) + 1);
}

/** Reads the books and counts. */
export function learn(books: Book[]): Machine {
	const after1 = new Map<string, Map<string, number>>();
	const after2 = new Map<string, Map<string, number>>();
	let read = 0;
	for (const b of books) {
		// Each book starts as if after the end of a sentence.
		const ws = [STOP, ...tokens(b.text)];
		read += ws.length - 1;
		for (let i = 1; i < ws.length; i++) {
			bump(after1, ws[i - 1], ws[i]);
			if (i >= 2) bump(after2, `${ws[i - 2]} ${ws[i - 1]}`, ws[i]);
		}
	}
	return { read, books: books.map((b) => b.title), after1, after2 };
}

export interface Guess {
	/** The words the machine looked back at (one or two). */
	looked: string[];
	/** What came next after them in the books, most common first. */
	cards: Card[];
	/** How many times those words were seen followed by anything. */
	total: number;
}

/**
 * The machine's cards for the next word after `story`, looking back `back` words (1 or 2). If
 * the last two words never turned up together, it looks back at one word only.
 */
export function guess(m: Machine, story: string[], back: 1 | 2 = 1): Guess {
	const last = story.length ? story[story.length - 1] : STOP;
	if (back === 2 && story.length >= 2) {
		const key = `${story[story.length - 2]} ${last}`;
		const seen = m.after2.get(key);
		if (seen) return toGuess([story[story.length - 2], last], seen);
	}
	return toGuess([last], m.after1.get(last) ?? new Map());
}

function toGuess(looked: string[], seen: Map<string, number>): Guess {
	const cards = [...seen].map(([word, count]) => ({ word, count }));
	// Most common first; ties in alphabetical order, so the order never depends on the books' order.
	cards.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : 1));
	return { looked, cards, total: cards.reduce((s, c) => s + c.count, 0) };
}

/**
 * Spins the spinner: `u` is where it stops, from 0 to 1 round the wheel, and each card's slice is
 * as big as its count. Returns the index of the card it stops on.
 */
export function spin(cards: Card[], u: number): number {
	const total = cards.reduce((s, c) => s + c.count, 0);
	let x = u * total;
	for (let i = 0; i < cards.length; i++) {
		x -= cards[i].count;
		if (x < 0) return i;
	}
	return cards.length - 1;
}

/** Writes `n` more words after `start`, each picked by a spin from `random`. */
export function write(
	m: Machine,
	start: string[],
	n: number,
	random: () => number,
	back: 1 | 2 = 1
): string[] {
	const story = [...start];
	for (let k = 0; k < n; k++) {
		const g = guess(m, story, back);
		if (!g.cards.length) break;
		story.push(g.cards[spin(g.cards, random())].word);
	}
	return story;
}

/** The words as a reader would write them: capitals after a full stop, "I", "Mr. Tod". */
export function prose(words: string[]): string {
	let out = '';
	let cap = true;
	for (const w of words) {
		if (w === STOP) {
			out += '.';
			cap = true;
			continue;
		}
		let s = w === 'i' || w.startsWith("i'") ? 'I' + w.slice(1) : w;
		if (ABBREVIATIONS.has(w)) s = s[0].toUpperCase() + s.slice(1) + '.';
		if (cap) s = s[0].toUpperCase() + s.slice(1);
		out += (out ? ' ' : '') + s;
		// After a full stop, and for the name after "Mr." or "Mrs.", a capital.
		cap = ABBREVIATIONS.has(w);
	}
	return out;
}

/**
 * The guessing game played on a text: for each word of `text` after the first, does the
 * machine's top card (looking back `back` words) name it? Returns the share it gets right.
 */
export function hits(m: Machine, text: string, back: 1 | 2 = 1): number {
	const ws = [STOP, ...tokens(text)];
	let right = 0;
	for (let i = 1; i < ws.length; i++) {
		const g = guess(m, ws.slice(Math.max(0, i - 2), i), back);
		if (g.cards[0]?.word === ws[i]) right++;
	}
	return ws.length > 1 ? right / (ws.length - 1) : 0;
}
