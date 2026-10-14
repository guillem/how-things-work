/**
 * The language-model explainer's model: GPT-2 small's real next-token distributions, and the
 * ways of turning them into text (greedy decoding, temperature, top-k, top-p and sampling),
 * written out here in plain TypeScript.
 *
 * No model runs in the browser. The distributions were computed once by
 * `scripts/data/language-models/build.py` (GPT-2 small, openai-community/gpt2 on Hugging Face,
 * MIT licence; see the script's header for the revision, checksum and format) and stored in
 * `gpt2-lm-data.ts`. For each stored context we keep the 10 most likely next tokens, their
 * logits, and log Σ exp(logit / T) over the whole vocabulary of 50,257 tokens for every
 * temperature T = 0.1 … 2.0, which is exactly what is needed to compute
 *
 *     p(token | T) = exp(logit / T) / Σ exp(logit' / T)
 *
 * for those ten tokens and for "everything else" at any of those temperatures.
 */

export interface LmNode {
	/** The K most likely next tokens (ids), most likely first. */
	k: number[];
	/** Their logits, minus the largest logit. */
	l: number[];
	/** log Σ exp((logit − max) / T) over the whole vocabulary, for T = tgrid[i]. */
	z: number[];
	/** Size of the top-p nucleus for tgrid × pgrid, row by row (prompts only). */
	nuc?: number[];
	/** Probability mass of that nucleus, same layout (prompts only). */
	nucm?: number[];
	/** The node reached by appending k[i], for the first few i. */
	ch?: number[];
	/** GPT-2's greedy continuation from here (token ids). */
	g?: number[];
}

export interface LmRun {
	prompt: string;
	/** Temperature; 0 = greedy decoding. */
	T: number;
	/** Top-p; 1 = no cut. */
	p: number;
	seed: number;
	steps: {
		/** The most likely tokens of the distribution sampled from, [id, probability]. */
		d: [number, number][];
		/** The random number drawn, in [0, 1) (null for greedy decoding). */
		r: number | null;
		pick: number;
		/** Probability of the token picked. */
		pp: number;
	}[];
}

export interface LmData {
	source: {
		model: string;
		repository: string;
		revision: string;
		licence: string;
		sha256: string;
		script: string;
	};
	vocab: number;
	K: number;
	tgrid: number[];
	pgrid: number[];
	prompts: { id: string; text: string; ids: number[]; node: number }[];
	nodes: LmNode[];
	runs: LmRun[];
	training: {
		text: string;
		ids: number[];
		steps: { p: number; top: [number, number][] }[];
	};
	tok: Record<string, string>;
}

/** A next-token distribution as the page shows it: the top tokens and everything else. */
export interface Dist {
	ids: number[];
	/** Probability of each of `ids`. */
	p: number[];
	/** Probability of all the other tokens together. */
	rest: number;
	/** How many other tokens that is. */
	restCount: number;
}

/** A cut-off (top-k or top-p) applied to a distribution. */
export interface Cut {
	/** Is each of the shown tokens kept? */
	kept: boolean[];
	/** How many tokens are kept in all (null: more than the shown ones, number not stored). */
	size: number | null;
	/** Probability mass of the kept tokens before renormalising (null if not known). */
	mass: number | null;
	/** Probabilities of the shown tokens after the cut, renormalised (0 for cut tokens). */
	p: number[];
}

/** The index of temperature T in the grid (T is rounded to the grid's 0.1 step). */
export function tIndex(T: number): number {
	return Math.min(19, Math.max(0, Math.round(T * 10) - 1));
}

export class Lm {
	readonly data: LmData;
	constructor(data: LmData) {
		this.data = data;
	}

	get vocab() {
		return this.data.vocab;
	}

	token(id: number): string {
		const t = this.data.tok[String(id)];
		if (t === undefined) throw new Error(`token ${id} not stored`);
		return t;
	}

	text(ids: readonly number[]): string {
		return ids.map((i) => this.token(i)).join('');
	}

	prompt(id: string) {
		const p = this.data.prompts.find((x) => x.id === id);
		if (!p) throw new Error(`no prompt ${id}`);
		return p;
	}

	node(i: number): LmNode {
		return this.data.nodes[i];
	}

	/**
	 * The next-token distribution of `node` at temperature T. T = 0 is the limit T → 0: all the
	 * probability on the most likely token (greedy decoding).
	 */
	dist(node: LmNode, T = 1): Dist {
		const n = node.k.length;
		if (T <= 0) {
			return {
				ids: node.k,
				p: node.k.map((_, i) => (i === 0 ? 1 : 0)),
				rest: 0,
				restCount: this.vocab - n
			};
		}
		const z = node.z[tIndex(T)];
		const Tg = this.data.tgrid[tIndex(T)];
		const p = node.l.map((l) => Math.exp(l / Tg - z));
		const rest = Math.max(0, 1 - p.reduce((a, b) => a + b, 0));
		return { ids: node.k, p, rest, restCount: this.vocab - n };
	}

	/** Top-k: keep the k most likely tokens and renormalise. */
	topK(d: Dist, k: number): Cut {
		const kept = d.p.map((_, i) => i < k);
		const mass = d.p.slice(0, k).reduce((a, b) => a + b, 0);
		return { kept, size: k, mass, p: d.p.map((x, i) => (kept[i] ? x / mass : 0)) };
	}

	/**
	 * Top-p (nucleus): keep the fewest most likely tokens whose probabilities add up to at least
	 * p, and renormalise. When the nucleus reaches past the stored tokens its size and mass come
	 * from the table stored for the prompts; elsewhere they are unknown (null).
	 */
	topP(node: LmNode, T: number, top: number): Cut {
		const d = this.dist(node, T);
		if (T <= 0 || top >= 1 - 1e-9) {
			if (T <= 0) return this.topK(d, 1);
			return { kept: d.p.map(() => true), size: this.vocab, mass: 1, p: d.p };
		}
		let c = 0;
		let size = 0;
		for (let i = 0; i < d.p.length; i++) {
			c += d.p[i];
			if (c >= top - 1e-9) {
				size = i + 1;
				break;
			}
		}
		if (size > 0) {
			const mass = d.p.slice(0, size).reduce((a, b) => a + b, 0);
			const kept = d.p.map((_, i) => i < size);
			return { kept, size, mass, p: d.p.map((x, i) => (kept[i] ? x / mass : 0)) };
		}
		const kept = d.p.map(() => true);
		const j = tIndex(T) * 20 + Math.min(19, Math.max(0, Math.round(top * 20) - 1));
		const big = node.nuc?.[j] ?? null;
		const mass = node.nucm?.[j] ?? null;
		return { kept, size: big, mass, p: mass ? d.p.map((x) => x / mass) : d.p };
	}

	/** The `n`-th stored run (1, 2, 3) of a prompt at temperature T and top-p p; T = 0 is greedy. */
	run(prompt: string, T: number, p: number, n: number): LmRun {
		const all = this.data.runs.filter(
			(x) =>
				x.prompt === prompt && Math.abs(x.T - T) < 1e-9 && (T === 0 || Math.abs(x.p - p) < 1e-9)
		);
		const r = T === 0 ? all[0] : all[n - 1];
		if (!r) throw new Error(`no run ${prompt} T=${T} p=${p} no. ${n}`);
		return r;
	}

	runs(prompt: string) {
		return this.data.runs.filter((x) => x.prompt === prompt);
	}
}

/**
 * Sampling by inverse transform: with the tokens sorted by probability, return the index of the
 * one whose stretch of the cumulative distribution contains r (0 ≤ r < 1), or −1 if r lands past
 * the tokens listed (on one of the rarer tokens not shown).
 */
export function drawIndex(p: readonly number[], r: number): number {
	let c = 0;
	for (let i = 0; i < p.length; i++) {
		c += p[i];
		if (r < c) return i;
	}
	return -1;
}

/** Cross-entropy of a text: the average of −ln p over the tokens, in nats. */
export function crossEntropy(p: readonly number[]): number {
	return p.reduce((a, x) => a - Math.log(x), 0) / p.length;
}

/** How a token is written on the stage: ␣ for a leading space, ↵ for a newline. */
export function tokenLabel(t: string): string {
	if (t === '<|endoftext|>') return '⟨start⟩';
	return t.replace(/\n/g, '↵').replace(/^ /, '␣').replace(/\u00a0/g, '⍽');
}

/** A probability as a percentage: 35%, 6.9%, 99.8%, <0.1%. */
export const percent = (p: number) =>
	p >= 0.995 && p < 1
		? `${(p * 100).toFixed(1)}%`
		: p >= 0.1
			? `${(p * 100).toFixed(0)}%`
			: p >= 0.001
				? `${(p * 100).toFixed(1)}%`
				: '<0.1%';
