/**
 * Running a trained model on a sum: greedy decoding (the likeliest character every time), one
 * character per forward pass, as the page steps through it; and a fast batched check of many
 * problems for the accuracy tables.
 *
 * Kept free of TypeScript-only syntax that Node cannot strip (see `addition.ts`).
 */
import type { TinyGPT } from '../training-a-tiny-language-model/tiny-gpt.ts';
import {
	CHARS,
	completionOf,
	encode,
	END,
	lengthOf,
	QUESTION,
	questionOf,
	readAnswer,
	sequenceOf,
	type Mode
} from './addition.ts';

export interface Written {
	/** The character written. */
	char: string;
	/** The model's probability for it. */
	p: number;
}

/**
 * Greedy decoding after the question, up to the end mark or the length of a correct completion.
 * Returns each written character with its probability.
 */
export function solve(model: TinyGPT, mode: Mode, a: number, b: number): Written[] {
	const context = encode(questionOf(a, b));
	const max = lengthOf(mode) - QUESTION;
	const out: Written[] = [];
	for (let i = 0; i < max; i++) {
		const p = model.next(context);
		let best = 0;
		for (let v = 1; v < p.length; v++) if (p[v] > p[best]) best = v;
		out.push({ char: CHARS[best], p: p[best] });
		context.push(best);
		if (best === END) break;
	}
	return out;
}

export const textOf = (w: Written[]) => w.map((x) => x.char).join('');

/** How a model did on one problem. */
export interface Outcome {
	/** The answer it wrote is the sum. */
	answer: boolean;
	/** Everything it wrote (working, answer, end mark) is exactly the right completion. */
	exact: boolean;
}

/**
 * How the model does on each of `problems`, decoding greedily. One teacher-forced pass per batch
 * first: if the likeliest character is the right one at every position of the correct
 * completion, greedy decoding writes exactly that completion. Only the others (where it would
 * stray) are decoded for real, since a scratchpad model can stray in its working and still land
 * on the right answer. With `decodeStrays` false, a stray counts as wrong (a quick lower bound,
 * used while training).
 */
export function check(
	model: TinyGPT,
	mode: Mode,
	problems: [number, number][],
	decodeStrays = true
): Outcome[] {
	const T = lengthOf(mode) - 1;
	const V = CHARS.length;
	const B = model.batch;
	const out: Outcome[] = [];
	for (let s = 0; s < problems.length; s += B) {
		const chunk = problems.slice(s, s + B);
		const tokens: number[] = [];
		const targets: number[] = [];
		for (const [a, b] of chunk) {
			const codes = encode(sequenceOf(mode, a, b));
			tokens.push(...codes.slice(0, -1));
			targets.push(...codes.slice(1));
		}
		model.forward(tokens, chunk.length, T);
		const P = model.logits;
		chunk.forEach((_, k) => {
			let all = true;
			for (let t = QUESTION - 1; t < T && all; t++) {
				const r = (k * T + t) * V;
				const want = P[r + targets[k * T + t]];
				for (let v = 0; v < V; v++)
					if (P[r + v] > want) {
						all = false;
						break;
					}
			}
			out.push({ answer: all, exact: all });
		});
		// decode the strays one by one (this reuses the model's buffers, so after the batch)
		if (decodeStrays)
			chunk.forEach(([a, b], k) => {
				if (out[s + k].exact) return;
				const written = textOf(solve(model, mode, a, b));
				out[s + k] = {
					answer: readAnswer(mode, written) === a + b,
					exact: written === completionOf(mode, a, b)
				};
			});
	}
	return out;
}
