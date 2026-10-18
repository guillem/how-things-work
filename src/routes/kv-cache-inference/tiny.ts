/**
 * The page's tiny GPT, trained: the weights of `weights-data.ts` (a float32 copy of a run of the
 * training page's code) widened to float64, its alphabet, and the generation the first scenes
 * show, with what each character cost with and without the cache.
 */
import { rng } from '#lib/draw/math.ts';
import { TinyGPT, type Config } from '../training-a-tiny-language-model/tiny-gpt.ts';
import { weightsData } from './weights-data.ts';
import {
	bytesMoved,
	draw,
	flops,
	generateCached,
	KvDecoder,
	recomputeCost,
	type Cost
} from './kv-gpt.ts';

export const chars = Array.from(weightsData.chars);
const index = new Map(chars.map((c, i) => [c, i]));
export const encode = (s: string) => Array.from(s, (c) => index.get(c) ?? 0);
export const decode = (codes: readonly number[]) => codes.map((c) => chars[c]).join('');

export const config: Config = {
	vocab: chars.length,
	width: weightsData.width,
	context: weightsData.context,
	heads: weightsData.heads,
	layers: weightsData.layers
};

function weights(): Float64Array {
	const bin = atob(weightsData.weights);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return Float64Array.from(new Float32Array(bytes.buffer));
}

let shared: Float64Array | null = null;
export const trainedWeights = () => (shared ??= weights());

export const makeDecoder = () => new KvDecoder(config, trainedWeights());
/** The training page's model (full recomputation over a window), on the same weights. */
export const makeTinyGpt = () => new TinyGPT(config, trainedWeights(), 1);

export const PROMPT = 'ROMEO:\n';
export const SEEDS = [11, 12, 13, 14, 15];

export interface Row {
	/** Position of the character written (0-based, in the 64-character window). */
	position: number;
	char: string;
	cached: Cost;
	recompute: Cost;
}

/** One generation to the end of the context, with each character's two costs. */
export function generation(seed: number): Row[] {
	const dec = makeDecoder();
	const prompt = encode(PROMPT);
	const g = generateCached(dec, prompt, seed);
	const window = prompt.slice();
	const counter = makeDecoder();
	return g.tokens.map((tok, k) => {
		const row: Row = {
			position: window.length,
			char: chars[tok],
			cached: g.cached[k],
			recompute: recomputeCost(counter, window)
		};
		window.push(tok);
		return row;
	});
}

export interface Comparison {
	cached: string;
	recomputed: string;
	/** Largest difference between the two runs' probabilities, over every position and character. */
	maxDiff: number;
}

/**
 * The same generation twice: with the cache, and with the training page's model recomputing the
 * whole window for every character (the same random number per character, as `sample` draws).
 */
export function compare(seed: number): Comparison {
	const rows = generation(seed);
	const cached = rows.map((r) => r.char).join('');
	const gpt = makeTinyGpt();
	const dec = makeDecoder();
	const text = encode(PROMPT + cached);
	let maxDiff = 0;
	const random = rng(seed);
	const out = encode(PROMPT);
	dec.reset();
	for (let t = 0; t < text.length - 1; t++) {
		const a = dec.step(text[t]);
		if (t < PROMPT.length - 1) continue;
		const b = gpt.next(out);
		for (let v = 0; v < a.length; v++) maxDiff = Math.max(maxDiff, Math.abs(a[v] - b[v]));
		out.push(draw(b, random()));
	}
	return { cached, recomputed: decode(out.slice(PROMPT.length)), maxDiff };
}

export { bytesMoved, flops };
