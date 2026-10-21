/**
 * Twenty questions: finding one thing among many by questions that split what is left in half.
 *
 * - A number from 1 to 100: "Is it bigger than …?", always asking about the middle of what is
 *   left. Each answer keeps one half, so seven questions are always enough (two, four, eight … 128
 *   is the first double past 100). Asking "Is it 1? Is it 2? …" takes as many questions as the
 *   number itself.
 * - A thousand-page dictionary (the word list of Webster's Second International, `data.ts`):
 *   opening it in the middle of the pages that are left takes at most ten opens; turning the
 *   pages one by one takes as many as the word's page number. The trick needs pages in order: in
 *   a shuffled pile, the middle page says nothing about where the word is.
 * - The animal board (the UCI Zoo dataset, `data.ts`): each yes/no question hides the animals
 *   that answer the other way. A good question hides about half; "Is it a penguin?" hides one.
 */
import { ANIMALS, PAGES } from './data';

// ---- numbers -----------------------------------------------------------------------------------

export interface NumberQuestion {
	/** The numbers still possible before this question: from `lo` to `hi`. */
	lo: number;
	hi: number;
	/** "Is it bigger than `mid`?" */
	mid: number;
	yes: boolean;
}

/** The questions that find `secret` among 1 to `n`, each about the middle of what is left. */
export function halving(secret: number, n = 100): NumberQuestion[] {
	const out: NumberQuestion[] = [];
	let lo = 1;
	let hi = n;
	while (lo < hi) {
		const mid = Math.floor((lo + hi) / 2);
		const yes = secret > mid;
		out.push({ lo, hi, mid, yes });
		if (yes) lo = mid + 1;
		else hi = mid;
	}
	return out;
}

/**
 * How many halving questions always suffice for `n` things: the number of times 1 must be
 * doubled to reach `n` or more.
 */
export function questionsFor(n: number): number {
	let k = 0;
	for (let reach = 1; reach < n; reach *= 2) k++;
	return k;
}

/** "Is it 1? Is it 2? …": the questions needed to reach `secret` one at a time. */
export const oneByOne = (secret: number) => secret;

/**
 * Where the game stands after the reader's answers to "Is it bigger than …?" (true = yes): the
 * numbers still possible, from `lo` to `hi`, and the next question's middle (null when one number
 * is left).
 */
export function afterAnswers(
	answers: readonly boolean[],
	n = 100
): { lo: number; hi: number; mid: number | null } {
	let lo = 1;
	let hi = n;
	for (const yes of answers) {
		if (lo >= hi) break;
		const mid = Math.floor((lo + hi) / 2);
		if (yes) lo = mid + 1;
		else hi = mid;
	}
	return { lo, hi, mid: lo < hi ? Math.floor((lo + hi) / 2) : null };
}

/**
 * How many numbers can be left after each question in the worst case, starting from `n`: the
 * bigger half each time, down to one. The questions needed are one fewer than its length.
 */
export function ladder(n: number): number[] {
	const out = [n];
	while (out[out.length - 1] > 1) out.push(Math.ceil(out[out.length - 1] / 2));
	return out;
}

// ---- the dictionary -------------------------------------------------------------------------------

export { PAGES, WORD_COUNT } from './data';

/** The page (0 to 999) a word is on, or −1 if it falls outside every page. */
export function pageOf(word: string): number {
	for (let p = 0; p < PAGES.length; p++) if (word >= PAGES[p][0] && word <= PAGES[p][1]) return p;
	return -1;
}

export interface Open {
	/** The part of the pile still searched before this open: positions `lo` to `hi`. */
	lo: number;
	hi: number;
	/** Where in the pile the page was opened (0 = the top of the pile). */
	at: number;
	/** The page found there. */
	page: number;
	/** Where the word must be, judging by that page: before it, after it, or on it. */
	verdict: 'before' | 'after' | 'here';
}

export interface Search {
	opens: Open[];
	/** Whether the word's page was found. */
	found: boolean;
}

/**
 * Looking a word up by opening the middle of what is left of the pile `order` (the page numbers
 * from top to bottom; in order, unless shuffled). Each open compares the word with the first and
 * last word of the page and keeps the half before or after it. In a pile in order this always
 * finds the page; in a shuffled one it usually throws the right page away.
 */
export function lookUp(word: string, order: readonly number[] = inOrder()): Search {
	const opens: Open[] = [];
	let lo = 0;
	let hi = order.length - 1;
	while (lo <= hi) {
		const at = Math.floor((lo + hi) / 2);
		const page = order[at];
		const [first, last] = PAGES[page];
		const verdict = word < first ? 'before' : word > last ? 'after' : 'here';
		opens.push({ lo, hi, at, page, verdict });
		if (verdict === 'here') return { opens, found: true };
		if (verdict === 'before') hi = at - 1;
		else lo = at + 1;
	}
	return { opens, found: false };
}

/** Turning the pages one by one from the first: how many pages are looked at to reach `word`. */
export const flips = (word: string) => pageOf(word) + 1;

/** The pages in order, 0 to 999. */
export function inOrder(): number[] {
	return PAGES.map((_, i) => i);
}

/** The pages in a shuffled pile, made from `seed` (the same seed gives the same pile). */
export function shuffled(seed: number): number[] {
	let a = (seed * 2654435761 + 12345) >>> 0;
	const rnd = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const order = inOrder();
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return order;
}

// ---- the animal board -------------------------------------------------------------------------------

export interface Animal {
	name: string;
	/** The dataset's class: 1 mammal, 2 bird, 3 reptile, 4 fish, 5 amphibian, 6 insect, 7 other. */
	type: number;
	legs: number;
	/** The yes/no answers, by feature (see `FEATURES`). */
	has: Record<string, boolean>;
}

/** The yes/no features of the dataset, in the order of `bits` in `data.ts`. */
const FEATURES = [
	'hair',
	'feathers',
	'eggs',
	'milk',
	'flies',
	'water',
	'hunts',
	'teeth',
	'backbone',
	'breathes',
	'venomous',
	'fins',
	'tail',
	'kept',
	'big'
] as const;

export const BOARD: Animal[] = ANIMALS.map((a) => ({
	name: a.name,
	type: a.type,
	legs: a.legs,
	has: Object.fromEntries(FEATURES.map((f, i) => [f, a.bits[i] === '1']))
}));

export interface Question {
	id: string;
	/** The question as the page asks it. */
	text: string;
	yes: (a: Animal) => boolean;
}

const feature = (id: (typeof FEATURES)[number], text: string): Question => ({
	id,
	text,
	yes: (a) => a.has[id]
});

/** The questions the reader can ask about the secret animal. */
export const QUESTIONS: Question[] = [
	feature('hair', 'Does it have hair or fur?'),
	feature('feathers', 'Does it have feathers?'),
	feature('eggs', 'Does it lay eggs?'),
	feature('milk', 'Does it feed its babies milk?'),
	feature('flies', 'Can it fly?'),
	feature('water', 'Does it live in water?'),
	feature('hunts', 'Does it hunt other animals?'),
	feature('teeth', 'Does it have teeth?'),
	feature('backbone', 'Does it have a backbone?'),
	feature('breathes', 'Does it breathe air?'),
	feature('venomous', 'Is it venomous?'),
	feature('fins', 'Does it have fins?'),
	feature('tail', 'Does it have a tail?'),
	feature('kept', 'Is it a pet or a farm animal?'),
	feature('big', 'Is it bigger than a cat?'),
	{ id: 'legs0', text: 'Does it have no legs?', yes: (a) => a.legs === 0 },
	{ id: 'legs2', text: 'Does it have two legs?', yes: (a) => a.legs === 2 },
	{ id: 'legs4', text: 'Does it have four legs?', yes: (a) => a.legs === 4 },
	{ id: 'legs6', text: 'Does it have six legs or more?', yes: (a) => a.legs >= 6 }
];

/** The question that hides only one animal (when the answer is no). */
export const PENGUIN: Question = {
	id: 'penguin',
	text: 'Is it a penguin?',
	yes: (a) => a.name === 'penguin'
};

/** A question by its id: one of `QUESTIONS`, the penguin, or `is:<name>` for any animal. */
export function questionById(id: string): Question | null {
	const q = [...QUESTIONS, PENGUIN].find((x) => x.id === id);
	if (q) return q;
	const a = id.startsWith('is:') ? BOARD.find((b) => b.name === id.slice(3)) : undefined;
	return a ? isIt(a) : null;
}

/** The animals of `left` that give the same answer to `q` as `secret` does. */
export function ask(left: readonly Animal[], q: Question, secret: Animal): Animal[] {
	const answer = q.yes(secret);
	return left.filter((a) => q.yes(a) === answer);
}

/** How many of `left` answer yes to `q`. */
export const yesCount = (left: readonly Animal[], q: Question) => left.filter(q.yes).length;

/**
 * The question that splits `left` most evenly (yes as close to half as possible), or null when
 * no question splits it at all (every animal left answers every question the same way).
 */
export function bestQuestion(left: readonly Animal[]): Question | null {
	let best: Question | null = null;
	let gap = Infinity;
	for (const q of QUESTIONS) {
		const y = yesCount(left, q);
		if (y === 0 || y === left.length) continue;
		const g = Math.abs(2 * y - left.length);
		if (g < gap) {
			gap = g;
			best = q;
		}
	}
	return best;
}

export interface Round {
	question: Question;
	answer: boolean;
	/** How many animals were left before and after the answer. */
	before: number;
	after: number;
}

/**
 * The game played well: always the question that splits what is left most evenly, until one
 * animal is left, or until the animals left answer every question alike (`left` holds them).
 */
export function playBest(secret: Animal): { rounds: Round[]; left: Animal[] } {
	let left = [...BOARD];
	const rounds: Round[] = [];
	for (;;) {
		const q = left.length > 1 ? bestQuestion(left) : null;
		if (!q) return { rounds, left };
		const after = ask(left, q, secret);
		rounds.push({ question: q, answer: q.yes(secret), before: left.length, after: after.length });
		left = after;
	}
}

/** The secret animal for the `k`-th press of "New secret animal" (every animal comes round). */
export const secretAnimal = (k: number): Animal =>
	BOARD[(((61 + 37 * k) % BOARD.length) + BOARD.length) % BOARD.length];

/** "a" or "an", as said before `word`. */
export const article = (word: string) => (/^[aeiou]/.test(word) ? 'an' : 'a');

/** The question "Is it a …?" about one animal of the board. */
export const isIt = (a: Animal): Question => ({
	id: `is:${a.name}`,
	text: `Is it ${article(a.name)} ${a.name}?`,
	yes: (b) => b.name === a.name
});

/** Animals of the board that answer every question alike (the board cannot tell them apart). */
export function twins(): Animal[][] {
	const groups = new Map<string, Animal[]>();
	for (const a of BOARD) {
		const k = QUESTIONS.map((q) => (q.yes(a) ? 1 : 0)).join('');
		groups.set(k, [...(groups.get(k) ?? []), a]);
	}
	return [...groups.values()].filter((g) => g.length > 1);
}
