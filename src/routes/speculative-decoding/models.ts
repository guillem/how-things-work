/**
 * The page's models, all over the 65 characters of Tiny Shakespeare. The target is the trained
 * tiny GPT of kv-cache-inference (width 32), decoded with its KV cache. The drafts, from the
 * worst guesser to the best: character frequencies (unigram), the counts of each character after
 * the previous one (bigram), a smaller tiny GPT (width 16, trained with the same code on the same
 * text; `drafts-data.ts`), and the target itself (the limiting case where every guess is kept).
 *
 * Costs are counted as kv-cache-inference counts them: multiply-adds, and bytes read at 8 bytes a
 * number (the models compute in float64). An n-gram step reads one row of its table and does no
 * multiplications.
 */
import { BYTES, KvDecoder } from '../kv-cache-inference/kv-gpt.ts';
import { chars, config, PROMPT, trainedWeights } from '../kv-cache-inference/tiny.ts';
import type { Config } from '../training-a-tiny-language-model/tiny-gpt.ts';
import { draftsData } from './drafts-data.ts';
import type { CharModel } from './speculate.ts';

export { chars, PROMPT };
export const V = chars.length;
const index = new Map(chars.map((c, i) => [c, i]));
export const encode = (s: string) => Array.from(s, (c) => index.get(c) ?? 0);
export const decode = (codes: readonly number[]) => codes.map((c) => chars[c]).join('');

/** A tiny GPT read through its KV cache. */
export class GptModel implements CharModel {
	readonly dec: KvDecoder;
	readonly context: number;
	lastMacs = 0;
	lastBytes = 0;
	constructor(config: Config, weights: Float64Array) {
		this.dec = new KvDecoder(config, weights);
		this.context = config.context;
	}
	get length() {
		return this.dec.length;
	}
	set length(n: number) {
		this.dec.length = n;
	}
	step(token: number): Float64Array {
		const p = this.dec.step(token).slice();
		this.lastMacs = this.dec.cost.macs;
		this.lastBytes = this.dec.cost.weightBytes + this.dec.cost.cacheBytes;
		return p;
	}
}

/** Counts of the next character, given the previous one (bigram) or regardless of it (unigram). */
export class NgramModel implements CharModel {
	length = 0;
	readonly context: number = Infinity;
	readonly lastMacs = 0;
	/** One row of the table: a probability per character. */
	readonly lastBytes = V * BYTES;
	private readonly rows: Float64Array[];
	constructor(order: 1 | 2) {
		const uni = normalise(draftsData.unigram);
		this.rows =
			order === 1
				? [uni]
				: chars.map((_, a) => {
						const row = draftsData.bigram.slice(a * V, (a + 1) * V);
						// a character never followed by anything in the text: back off to the unigram
						return row.some((c) => c > 0) ? normalise(row) : uni;
					});
	}
	step(token: number): Float64Array {
		this.length++;
		return (this.rows[token] ?? this.rows[0]).slice();
	}
}

function normalise(counts: readonly number[]): Float64Array {
	const s = counts.reduce((a, b) => a + b, 0);
	return Float64Array.from(counts, (c) => c / s);
}

function weightsOf(b64: string): Float64Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return Float64Array.from(new Float32Array(bytes.buffer));
}

const smallConfig: Config = {
	vocab: V,
	width: draftsData.small.width,
	context: draftsData.small.context,
	heads: draftsData.small.heads,
	layers: draftsData.small.layers
};
let smallWeights: Float64Array | null = null;

export const makeTarget = () => new GptModel(config, trainedWeights());

export type DraftId = 'unigram' | 'bigram' | 'small' | 'self';

export const DRAFTS: { id: DraftId; name: string; short: string }[] = [
	{ id: 'unigram', name: 'Character frequencies (unigram)', short: 'unigram' },
	{ id: 'bigram', name: 'Previous character (bigram)', short: 'bigram' },
	{ id: 'small', name: 'Smaller tiny GPT (width 16)', short: 'small GPT' },
	{ id: 'self', name: 'The target itself', short: 'target itself' }
];

export function makeDraft(id: DraftId): CharModel {
	switch (id) {
		case 'unigram':
			return new NgramModel(1);
		case 'bigram':
			return new NgramModel(2);
		case 'small':
			return new GptModel(smallConfig, (smallWeights ??= weightsOf(draftsData.small.weights)));
		case 'self':
			return makeTarget();
	}
}

/** Held-out losses (nats per character) of the two GPTs, from their training runs. */
export const SMALL_LOSS = draftsData.small.heldOutLoss;
export const draftChars = draftsData.chars;
