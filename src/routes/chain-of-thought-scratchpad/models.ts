/**
 * The two shipped models, rebuilt from their stored weights the first time a scene asks for one,
 * and what each writes for a sum (greedy decoding, run in the page).
 */
import { TinyGPT } from '../training-a-tiny-language-model/tiny-gpt';
import { completionOf, type Mode } from './addition';
import { results } from './results-data';
import { solve, type Written } from './solve';
import { weights } from './weights-data';
import { unpackWeights } from './weights';

const cache = new Map<Mode, TinyGPT>();

export function modelOf(mode: Mode): TinyGPT {
	let m = cache.get(mode);
	if (!m) {
		m = new TinyGPT(results[mode].config, unpackWeights(weights[mode]), 1);
		cache.set(mode, m);
	}
	return m;
}

export interface Transcript {
	mode: Mode;
	written: Written[];
	/** The right completion, character for character. */
	right: string;
}

const memo = new Map<string, Transcript>();

/** What `mode`'s model writes after the question a + b (memoised). */
export function transcript(mode: Mode, a: number, b: number): Transcript {
	const key = `${mode}:${a}+${b}`;
	let t = memo.get(key);
	if (!t) {
		t = { mode, written: solve(modelOf(mode), mode, a, b), right: completionOf(mode, a, b) };
		memo.set(key, t);
	}
	return t;
}
