/**
 * The counting machine behind the n-gram explainer: a character model that looks back at the
 * last `n` characters (the window, or context) and counts which character came next in its
 * training text, then writes by drawing each next character in proportion to those counts.
 *
 * Instead of a table of counts per window, the model keeps every position of its training text
 * sorted by the 11 characters that start there (radix sort, `MAX_N` + 1 deep). All occurrences of
 * a window of up to 10 characters are then one contiguous range of that list, found by binary
 * search: its length is the window's count, the character after each occurrence is a follower,
 * and a position drawn uniformly from the range picks a follower exactly in proportion to its
 * count. One sorted list serves every n from 0 to 10.
 *
 * Everything is deterministic: sampling takes a seed (mulberry32, `rng` in `#lib/draw/math.ts`).
 */
import { rng } from '#lib/draw/math.ts';

/** The longest window the page offers. */
export const MAX_N = 10;
/** Positions are sorted by this many characters: the longest window plus its follower. */
const DEPTH = MAX_N + 1;
/** Code of a character the training text never contains (held-out or prompt text). */
const UNKNOWN = 0xffff;

/** The characters of a text, as code points (an emoji is one character). */
export function chars(text: string): string[] {
	return Array.from(text);
}

/** The set of characters a model knows, each with a code from 1 (0 marks "past the end"). */
export class Alphabet {
	readonly chars: string[];
	private readonly index = new Map<string, number>();

	constructor(text: string) {
		const seen = new Set<string>();
		for (const c of text) seen.add(c);
		this.chars = [...seen].sort();
		this.chars.forEach((c, i) => this.index.set(c, i + 1));
	}

	get size() {
		return this.chars.length;
	}

	/** Codes of `text`; characters outside the alphabet get a code that matches nothing. */
	encode(text: string): Uint16Array {
		const out: number[] = [];
		for (const c of text) out.push(this.index.get(c) ?? UNKNOWN);
		return Uint16Array.from(out);
	}

	char(code: number) {
		return this.chars[code - 1] ?? '';
	}
}

/** One drawn character of a sample. */
export interface Draw {
	/** The window actually used (shorter than n at the start, or after a back-off). */
	window: number;
	/** Occurrences of that window in the training text that have a character after them. */
	count: number;
	/** The window was always followed by the same character: the model had no choice. */
	forced: boolean;
}

export interface Sample {
	/** Prompt plus the written characters. */
	text: string;
	/** Characters of the prompt at the start of `text`. */
	prompt: number;
	draws: Draw[];
}

export interface Copy {
	/** Start, in characters, of the copied stretch within the text searched. */
	start: number;
	/** Its length in characters. */
	length: number;
	/** Where it occurs in the training text (character position). */
	source: number;
}

/** What followed one window in the training text. */
export interface Followers {
	/** Occurrences of the window that have a character after them. */
	total: number;
	/** Each next character with its count, most frequent first (ties alphabetical). */
	next: { char: string; count: number }[];
}

export class NgramModel {
	readonly alphabet: Alphabet;
	/** The training text as codes. */
	readonly codes: Uint16Array;
	/** Every position of the training text, sorted by the `DEPTH` characters starting there. */
	readonly sorted: Uint32Array;
	private words: Set<string> | null = null;
	private lcp: Uint8Array | null = null;

	/** The training text. */
	readonly text: string;

	constructor(text: string, alphabet = new Alphabet(text)) {
		this.text = text;
		this.alphabet = alphabet;
		this.codes = alphabet.encode(text);
		this.sorted = sortPositions(this.codes, alphabet.size);
	}

	/** Training text length in characters. */
	get length() {
		return this.codes.length;
	}

	private at(p: number) {
		return p < this.codes.length ? this.codes[p] : 0;
	}

	/**
	 * Range [lo, hi) of `sorted` whose positions start with `key[from .. from + len)`, narrowed
	 * from the range `[lo, hi)` already known to match its first `known` characters.
	 */
	private narrow(
		key: ArrayLike<number>,
		from: number,
		known: number,
		len: number,
		lo = 0,
		hi = this.sorted.length
	): [number, number] {
		for (let k = known; k < len && lo < hi; k++) {
			const c = key[from + k];
			let a = lo;
			let b = hi;
			while (a < b) {
				const m = (a + b) >>> 1;
				if (this.at(this.sorted[m] + k) < c) a = m + 1;
				else b = m;
			}
			const first = a;
			b = hi;
			while (a < b) {
				const m = (a + b) >>> 1;
				if (this.at(this.sorted[m] + k) <= c) a = m + 1;
				else b = m;
			}
			lo = first;
			hi = a;
		}
		return [lo, hi];
	}

	/**
	 * Occurrences of `key[from .. from + len)` that have a character after them, as a range of
	 * `sorted`. Within it the positions are sorted by that next character.
	 */
	range(key: ArrayLike<number>, from: number, len: number): [number, number] {
		const [lo, hi] = this.narrow(key, from, 0, len);
		// The one occurrence that ends the text has nothing after it; it sorts first (code 0).
		return lo < hi && this.sorted[lo] + len >= this.codes.length ? [lo + 1, hi] : [lo, hi];
	}

	/** What followed `window` (a string) in the training text. */
	followers(window: string): Followers {
		const key = this.alphabet.encode(window);
		const [lo, hi] = this.range(key, 0, key.length);
		const counts = new Map<number, number>();
		for (let i = lo; i < hi; i++) {
			const c = this.codes[this.sorted[i] + key.length];
			counts.set(c, (counts.get(c) ?? 0) + 1);
		}
		const next = [...counts]
			.map(([c, count]) => ({ char: this.alphabet.char(c), count }))
			.sort((a, b) => b.count - a.count || (a.char < b.char ? -1 : 1));
		return { total: hi - lo, next };
	}

	/**
	 * Writes `length` characters after `prompt`, each drawn from the counts of what followed the
	 * last `n` characters. While fewer than `n` characters exist, or if a window never occurred
	 * with something after it, the model backs off to a shorter window (at worst, n = 0: the
	 * plain letter counts).
	 */
	sample(n: number, length: number, seed: number, prompt = ''): Sample {
		const random = rng(seed);
		const out = Array.from(this.alphabet.encode(prompt));
		const draws: Draw[] = [];
		for (let i = 0; i < length; i++) {
			let k = Math.min(n, out.length);
			let lo = 0;
			let hi = 0;
			for (; k >= 0; k--) {
				[lo, hi] = this.range(out, out.length - k, k);
				if (hi > lo) break;
			}
			if (hi <= lo) break; // an empty training text
			const pick = this.sorted[lo + Math.floor(random() * (hi - lo))];
			const first = this.codes[this.sorted[lo] + k];
			const last = this.codes[this.sorted[hi - 1] + k];
			out.push(this.codes[pick + k]);
			draws.push({ window: k, count: hi - lo, forced: first === last });
		}
		const text = out.map((c) => this.alphabet.char(c)).join('');
		return { text, prompt: chars(prompt).length, draws };
	}

	/**
	 * For each position of `codes`, the longest stretch starting there (at most `MAX_N`
	 * characters) that occurs in the training text with a character after it.
	 */
	matchLengths(codes: ArrayLike<number>): Uint8Array {
		const out = new Uint8Array(codes.length);
		for (let i = 0; i < codes.length; i++) {
			let lo = 0;
			let hi = this.sorted.length;
			let k = 0;
			const max = Math.min(MAX_N, codes.length - i);
			while (k < max) {
				const [a, b] = this.narrow(codes, i, k, k + 1, lo, hi);
				// keep only occurrences with a character after them
				const ok = a < b && (this.sorted[a] + k + 1 < this.codes.length || b - a > 1);
				if (!ok) break;
				lo = a;
				hi = b;
				k++;
			}
			out[i] = k;
		}
		return out;
	}

	/**
	 * The longest stretch of `text` (from character `from` on) that appears word for word in
	 * the training text.
	 */
	longestCopy(text: string, from = 0): Copy {
		const key = this.alphabet.encode(text);
		let best: Copy = { start: from, length: 0, source: -1 };
		for (let i = from; i < key.length; i++) {
			if (key.length - i <= best.length) break;
			const len = Math.min(DEPTH, key.length - i);
			const [lo, hi] = this.narrow(key, i, 0, len);
			if (lo >= hi) {
				// shorter than DEPTH: find the longest prefix that occurs
				let k = len - 1;
				for (; k > best.length; k--) {
					const [a, b] = this.narrow(key, i, 0, k);
					if (a < b) {
						best = { start: i, length: k, source: this.sorted[a] };
						break;
					}
				}
				continue;
			}
			for (let j = lo; j < hi; j++) {
				const p = this.sorted[j];
				let k = len;
				while (i + k < key.length && p + k < this.codes.length && key[i + k] === this.codes[p + k])
					k++;
				if (k > best.length) best = { start: i, length: k, source: p };
			}
		}
		return best;
	}

	/** Common prefix (capped at DEPTH) of each sorted position with the one before it. */
	private prefixes(): Uint8Array {
		if (this.lcp) return this.lcp;
		const lcp = new Uint8Array(this.sorted.length);
		for (let j = 1; j < this.sorted.length; j++) {
			const p = this.sorted[j - 1];
			const q = this.sorted[j];
			let k = 0;
			while (k < DEPTH && this.at(p + k) !== 0 && this.at(p + k) === this.at(q + k)) k++;
			lcp[j] = k;
		}
		this.lcp = lcp;
		return lcp;
	}

	/**
	 * Distinct windows of `n` characters that occur in the training text with a character after
	 * them, and how many of those were always followed by the same character.
	 */
	windows(n: number): { distinct: number; forced: number } {
		const lcp = this.prefixes();
		const N = this.codes.length;
		let distinct = 0;
		let forced = 0;
		let groupOneChar = false;
		let run = DEPTH; // common prefix with the previous position that has a follower
		let started = false;
		for (let j = 0; j < this.sorted.length; j++) {
			run = Math.min(run, lcp[j]);
			if (this.sorted[j] + n >= N) continue; // no character after this window
			if (!started || run < n) {
				if (started && groupOneChar) forced++;
				distinct++;
				groupOneChar = true;
			} else if (run < n + 1) groupOneChar = false;
			started = true;
			run = DEPTH;
		}
		if (started && groupOneChar) forced++;
		return { distinct, forced };
	}

	/** Whether `word` (lower case) occurs as a word of the training text. */
	hasWord(word: string) {
		this.words ??= new Set(words(this.text));
		return this.words.has(word);
	}
}

/** The words of a text: runs of letters, with inner apostrophes ("o'er"), in lower case. */
export function words(text: string): string[] {
	return (text.match(/\p{L}+(?:'\p{L}+)*/gu) ?? []).map((w) => w.toLowerCase());
}

/** Share of the words of `text` (from character `from` on) that occur in the training text. */
export function realWordShare(model: NgramModel, text: string, from = 0) {
	const ws = words(chars(text).slice(from).join(''));
	// the last word may be cut off mid-way: leave it out
	const counted = ws.length > 1 ? ws.slice(0, -1) : ws;
	if (counted.length === 0) return 0;
	return counted.filter((w) => model.hasWord(w)).length / counted.length;
}

/**
 * Held-out windows the model never saw, for every n from 0 to MAX_N: for each position of the
 * held-out text that has n characters before it, whether those n characters occur in the
 * training text with something after them. Element n is the share of such windows never seen.
 */
export function unseenProfile(model: NgramModel, heldOut: string): number[] {
	const codes = model.alphabet.encode(heldOut);
	const ms = model.matchLengths(codes);
	const out: number[] = [];
	for (let n = 0; n <= MAX_N; n++) {
		let total = 0;
		let unseen = 0;
		// the window before position j is codes[j - n .. j); it starts at i = j - n
		for (let i = 0; i + n < codes.length; i++) {
			total++;
			if (ms[i] < n) unseen++;
		}
		out.push(total ? unseen / total : 0);
	}
	return out;
}

/** Which characters of `heldOut` come after a window of `n` the model never saw. */
export function unseenMarks(model: NgramModel, heldOut: string, n: number): boolean[] {
	const codes = model.alphabet.encode(heldOut);
	const ms = model.matchLengths(codes);
	return Array.from(codes, (_, j) => j >= n && ms[j - n] < n);
}

/** Radix sort (least significant character first) of every position by DEPTH characters. */
function sortPositions(codes: Uint16Array, alphabetSize: number): Uint32Array {
	const N = codes.length;
	let a = new Uint32Array(N);
	let b = new Uint32Array(N);
	for (let i = 0; i < N; i++) a[i] = i;
	const buckets = alphabetSize + 2; // 0 = past the end, UNKNOWN never occurs in training
	const count = new Uint32Array(buckets);
	for (let d = DEPTH - 1; d >= 0; d--) {
		count.fill(0);
		for (let i = 0; i < N; i++) {
			const p = a[i] + d;
			count[p < N ? codes[p] : 0]++;
		}
		let sum = 0;
		for (let c = 0; c < buckets; c++) {
			const v = count[c];
			count[c] = sum;
			sum += v;
		}
		for (let i = 0; i < N; i++) {
			const p = a[i] + d;
			b[count[p < N ? codes[p] : 0]++] = a[i];
		}
		[a, b] = [b, a];
	}
	return a;
}

/** Tiny Shakespeare split as nanoGPT does: the first 90% to learn from, the last 10% held out. */
export function split(text: string, share = 0.9) {
	const cs = chars(text);
	const cut = Math.floor(cs.length * share);
	return { train: cs.slice(0, cut).join(''), heldOut: cs.slice(cut).join('') };
}

/** The training sizes offered by the page, in characters. */
export const SIZES = [10_000, 100_000, 1_000_000] as const;

/** The page's samples start on a blank line, as each speech of the plays does. */
export const PROMPT = '\n\n';

/** What a model writes at one window size, measured on its own sample. */
export interface Measure {
	n: number;
	sample: Sample;
	/** Share of the sample's words that are words of the training text. */
	realWords: number;
	/** The longest stretch of the sample copied word for word from the training text. */
	copy: Copy;
	/** Share of the drawn characters whose window allowed only one next character. */
	forced: number;
}

export function measure(model: NgramModel, n: number, seed: number, length: number): Measure {
	const sample = model.sample(n, length, seed, PROMPT);
	const forced = sample.draws.filter((d) => d.forced).length / Math.max(1, sample.draws.length);
	return {
		n,
		sample,
		realWords: realWordShare(model, sample.text, sample.prompt),
		copy: model.longestCopy(sample.text, sample.prompt),
		forced
	};
}
