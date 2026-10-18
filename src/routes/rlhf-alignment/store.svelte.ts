/**
 * The comparisons collected so far, one book per question, shared by every scene of the page:
 * the stand-in rater's (100 to start with, from a fixed seed; its button adds 100 more from the
 * same stream) and the reader's own clicks. The reward model is refitted whenever a book changes.
 * Scenes read `books[id]` and `rewardsOf(id)` in a `$derived`.
 */
import { prompts } from './rlhf-data';
import { BATCH, DEFAULT_COMPARISONS, DEFAULT_SEED, READER_SEED } from './prefs';
import { fitRewardModel, randomPair, rate, rewards, rng, strengths, type Comparison } from './rlhf';

export interface Book {
	comparisons: Comparison[];
	/** How many of them are the reader's. */
	mine: number;
	/** The pair offered to the reader next. */
	pair: [number, number];
	/** A new number on every change (unique across books and restarts). */
	version: number;
}

// the random streams (not reactive state)
let stamp = 0;
const raters: Record<string, () => number> = {};
const pickers: Record<string, () => number> = {};

function fresh(id: string): Book {
	const p = prompts.find((x) => x.id === id)!;
	const s = strengths(p.answers.map((a) => a.score));
	const rand = rng(DEFAULT_SEED);
	raters[id] = rand;
	const pick = rng(READER_SEED);
	pickers[id] = pick;
	const comparisons: Comparison[] = [];
	for (let i = 0; i < DEFAULT_COMPARISONS; i++)
		comparisons.push(rate(s, randomPair(s.length, rand), rand));
	return { comparisons, mine: 0, pair: randomPair(s.length, pick), version: ++stamp };
}

export const books: Record<string, Book> = $state(
	Object.fromEntries(prompts.map((p) => [p.id, fresh(p.id)]))
);

/** The stand-in rater answers BATCH more random pairs. */
export function rateMore(id: string) {
	const p = prompts.find((x) => x.id === id)!;
	const s = strengths(p.answers.map((a) => a.score));
	const rand = raters[id];
	const add: Comparison[] = [];
	for (let i = 0; i < BATCH; i++) add.push(rate(s, randomPair(s.length, rand), rand));
	books[id].comparisons.push(...add);
	books[id].version = ++stamp;
}

/** The reader prefers answer `win` of the offered pair; the next pair is offered. */
export function choose(id: string, win: number) {
	const b = books[id];
	const [a, c] = b.pair;
	b.comparisons.push({ win, lose: win === a ? c : a });
	b.mine++;
	b.pair = randomPair(64, pickers[id]);
	b.version = ++stamp;
}

/** Skips the offered pair. */
export function skip(id: string) {
	books[id].pair = randomPair(64, pickers[id]);
}

/** Forgets every comparison of this question: the reward model starts from nothing. */
export function clear(id: string) {
	books[id].comparisons = [];
	books[id].mine = 0;
	books[id].version = ++stamp;
}

/** Back to the page's starting point (the rater's first 100 comparisons). */
export function restart(id: string) {
	books[id] = fresh(id);
}

// the last fit per question (not reactive state)
const cache: Record<string, { version: number; r: number[] }> = {};

/** The reward model's score of every answer of the question, fitted to its book. */
export function rewardsOf(id: string): number[] {
	const b = books[id];
	const hit = cache[id];
	if (hit?.version === b.version) return hit.r;
	const p = prompts.find((x) => x.id === id)!;
	const F = p.answers.map((a) => a.f);
	const r = rewards(F, fitRewardModel(F, $state.snapshot(b.comparisons)));
	cache[id] = { version: b.version, r };
	return r;
}
