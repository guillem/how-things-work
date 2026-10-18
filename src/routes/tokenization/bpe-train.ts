/**
 * Byte-pair encoding learned from a small text, merge by merge: the model behind the first
 * chapter of the tokenization explainer.
 *
 * The text is split into pieces by GPT-2's own pattern (a word with the space in front of it, a
 * run of digits, a run of punctuation, whitespace; see `PATTERN` in `language-models/bpe.ts`),
 * and each distinct piece is written as its UTF-8 bytes, one token per byte (tokens 0–255: the
 * byte's own value). Then, repeatedly:
 *
 * 1. count every pair of neighbouring tokens inside the pieces, each piece weighted by how often
 *    it occurs in the text (overlapping pairs count: "aaa" holds "aa" twice);
 * 2. take the most frequent pair; a tie goes to the pair that occurs first in the text;
 * 3. make it a new token (256, 257, … in the order learned) and replace every occurrence, left to
 *    right, in every piece.
 *
 * Training stops when no pair occurs twice (a pair seen once would only memorise the text) or
 * after `MAX_MERGES`. Pieces never merge with each other, as in GPT-2.
 *
 * `encode` then cuts any text with the merges learned: each piece starts as bytes, and the pair
 * whose merge was learned earliest is joined first, again and again (the same rule as GPT-2's
 * tokenizer, which `language-models/bpe.ts` implements with GPT-2's own 50,000 merges).
 */
import { PATTERN } from '../language-models/bpe';

/** Training stops after this many merges even if pairs still repeat. */
export const MAX_MERGES = 300;

export interface Merge {
	/** The two tokens joined. */
	a: number;
	b: number;
	/** The new token: 256 + its rank. */
	id: number;
	/** How often the pair occurred in the text when it was chosen. */
	count: number;
}

export interface Word {
	/** The piece of text (a word with its leading space, a number, punctuation…). */
	text: string;
	/** How many times it occurs in the text. */
	count: number;
	/** Its bytes: its tokens before any merge. */
	bytes: number[];
	/** Every time a merge changed this piece: the merge's rank and the piece's tokens after it. */
	changes: { rank: number; tokens: number[] }[];
}

export interface PairCount {
	a: number;
	b: number;
	count: number;
}

const enc = new TextEncoder();
const pairKey = (a: number, b: number) => a * 65536 + b;

/** The pieces of a text, as GPT-2's pattern splits it. */
export function split(text: string): string[] {
	return text.match(PATTERN) ?? [];
}

/** Joins every occurrence of the pair (a, b), left to right. */
function join(tokens: number[], a: number, b: number, id: number): number[] {
	const out: number[] = [];
	for (let i = 0; i < tokens.length; i++) {
		if (i < tokens.length - 1 && tokens[i] === a && tokens[i + 1] === b) {
			out.push(id);
			i++;
		} else out.push(tokens[i]);
	}
	return out;
}

/** Pair counts of pieces with frequencies, with the order in which each pair is first met. */
function countPairs(words: { tokens: number[]; count: number }[]) {
	const counts = new Map<number, { a: number; b: number; count: number; first: number }>();
	let order = 0;
	for (const w of words)
		for (let i = 0; i < w.tokens.length - 1; i++) {
			const k = pairKey(w.tokens[i], w.tokens[i + 1]);
			const c = counts.get(k);
			if (c) c.count += w.count;
			else counts.set(k, { a: w.tokens[i], b: w.tokens[i + 1], count: w.count, first: order++ });
		}
	return counts;
}

export class Training {
	/** The distinct pieces of the text, in the order they first occur. */
	readonly words: Word[];
	/** The merges learned, in order (rank 0 first). */
	readonly merges: Merge[] = [];
	/** The bytes of every token: 0–255 are single bytes, 256 + r is merge r. */
	readonly tokenBytes: number[][];
	/** Tokens in the whole text after k merges, for k = 0 … merges.length. */
	readonly total: number[] = [];
	private readonly rank = new Map<number, number>();

	constructor(text: string, maxMerges = MAX_MERGES) {
		const index = new Map<string, Word>();
		for (const p of split(text)) {
			const w = index.get(p);
			if (w) w.count++;
			else {
				const bytes = [...enc.encode(p)];
				index.set(p, { text: p, count: 1, bytes, changes: [] });
			}
		}
		this.words = [...index.values()];
		this.tokenBytes = Array.from({ length: 256 }, (_, b) => [b]);

		const state = this.words.map((w) => ({ tokens: w.bytes, count: w.count }));
		const size = () => state.reduce((s, w) => s + w.tokens.length * w.count, 0);
		this.total.push(size());
		while (this.merges.length < maxMerges) {
			let best: { a: number; b: number; count: number; first: number } | null = null;
			for (const c of countPairs(state).values())
				if (!best || c.count > best.count || (c.count === best.count && c.first < best.first))
					best = c;
			if (!best || best.count < 2) break;
			const id = 256 + this.merges.length;
			this.merges.push({ a: best.a, b: best.b, id, count: best.count });
			this.rank.set(pairKey(best.a, best.b), this.merges.length - 1);
			this.tokenBytes.push([...this.tokenBytes[best.a], ...this.tokenBytes[best.b]]);
			state.forEach((w, i) => {
				const next = join(w.tokens, best.a, best.b, id);
				if (next.length !== w.tokens.length) {
					w.tokens = next;
					this.words[i].changes.push({ rank: this.merges.length - 1, tokens: next });
				}
			});
			this.total.push(size());
		}
	}

	/** Size of the vocabulary after k merges: the 256 bytes plus one token per merge. */
	vocabulary(k: number): number {
		return 256 + Math.min(k, this.merges.length);
	}

	/** The tokens of a piece of the text after k merges. */
	tokensOf(w: Word, k: number): number[] {
		let tokens = w.bytes;
		for (const c of w.changes) if (c.rank < k) tokens = c.tokens;
		return tokens;
	}

	/** The most frequent pairs after k merges, most frequent first (ties: first in the text). */
	pairs(k: number, n = 8): PairCount[] {
		const counts = countPairs(
			this.words.map((w) => ({ tokens: this.tokensOf(w, k), count: w.count }))
		);
		return [...counts.values()]
			.sort((x, y) => y.count - x.count || x.first - y.first)
			.slice(0, n)
			.map(({ a, b, count }) => ({ a, b, count }));
	}

	/**
	 * Cuts any text with the first k merges: each piece starts as bytes, and the neighbouring pair
	 * whose merge was learned earliest is joined first, until no learned merge applies.
	 * Returns the pieces, each with every intermediate state.
	 */
	encode(
		text: string,
		k = this.merges.length
	): { text: string; steps: { rank: number; tokens: number[] }[]; tokens: number[] }[] {
		return split(text).map((p) => {
			let tokens = [...enc.encode(p)];
			const steps: { rank: number; tokens: number[] }[] = [];
			for (;;) {
				let best = Infinity;
				for (let i = 0; i < tokens.length - 1; i++) {
					const r = this.rank.get(pairKey(tokens[i], tokens[i + 1]));
					if (r !== undefined && r < k && r < best) best = r;
				}
				if (best === Infinity) break;
				const m = this.merges[best];
				tokens = join(tokens, m.a, m.b, m.id);
				steps.push({ rank: best, tokens });
			}
			return { text: p, steps, tokens };
		});
	}

	/** Number of tokens of any text with the first k merges. */
	count(text: string, k = this.merges.length): number {
		return this.encode(text, k).reduce((s, p) => s + p.tokens.length, 0);
	}

	/** A token as text; a token that is only part of a character shows its bytes, ⟨C3⟩. */
	text(id: number): string {
		return tokenText(this.tokenBytes[id] ?? []);
	}
}

const strict = new TextDecoder('utf-8', { fatal: true });

/** Bytes as text, or as hexadecimal ⟨F0 9F⟩ when they are not whole UTF-8 characters. */
export function tokenText(bytes: ArrayLike<number>): string {
	try {
		return strict.decode(Uint8Array.from(bytes));
	} catch {
		return (
			'⟨' + Array.from(bytes, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ') + '⟩'
		);
	}
}

let last: Training | null = null;
let lastText = '';

/** The training of a text, kept for the last text asked for (the stage and the controls share it). */
export function trained(text: string): Training {
	if (!last || text !== lastText) {
		last = new Training(text);
		lastText = text;
	}
	return last;
}
