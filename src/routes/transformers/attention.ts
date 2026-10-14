/**
 * The attention explainer's model: real attention weights of GPT-2 small, and the attention
 * operation itself, softmax(q·kᵀ / √d) v, redone here in plain TypeScript from the model's real
 * query, key and value vectors.
 *
 * The numbers come from `gpt2-data.ts`, made once by `scripts/data/transformers/build.py`
 * (GPT-2 small, openai-community/gpt2 on Hugging Face, MIT licence; see the script's header for
 * the revision, checksum and how it was run). No model runs in the browser: the sentences are
 * fixed, their attention was computed when the page was made.
 */

export interface GptData {
	source: {
		model: string;
		repository: string;
		revision: string;
		licence: string;
		sha256: string;
		script: string;
	};
	config: {
		layers: number;
		heads: number;
		dHead: number;
		dModel: number;
		vocab: number;
		context: number;
		params: number;
	};
	sentences: {
		id: string;
		text: string;
		tokens: string[];
		ids: number[];
		att: string;
		next: [string, number][];
	}[];
	featured: {
		sentence: string;
		layer: number;
		head: number;
		q: number[][];
		k: number[][];
		v: number[][];
		out: number[][];
	};
	positions: { n: number; cos: string; norms: number[] };
}

function bytes(b64: string): Uint8Array {
	const s = atob(b64);
	const out = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
	return out;
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += a[i] * b[i];
	return s;
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
	const d = Math.sqrt(dot(a, a) * dot(b, b));
	return d > 0 ? dot(a, b) / d : 0;
}

/** softmax: e^sᵢ / Σ e^sⱼ (shifted by the maximum, which changes nothing but avoids overflow). */
export function softmax(scores: readonly number[]): number[] {
	const m = Math.max(...scores);
	const e = scores.map((s) => Math.exp(s - m));
	const sum = e.reduce((a, b) => a + b, 0);
	return e.map((x) => x / sum);
}

export interface AttentionStep {
	/** q·k for every key j ≤ i (the earlier tokens and the token itself). */
	dots: number[];
	/** The scores q·k / √d. */
	scores: number[];
	/** softmax of the scores: the attention weights, summing to 1. */
	weights: number[];
	/** Σ weightⱼ vⱼ: the head's output for this token. */
	out: number[];
}

/**
 * One attention operation for the token at position `i`, as GPT-2 does it: its query is matched
 * against the keys of tokens 0..i (later tokens are masked out: GPT-2 only looks back), the dot
 * products are divided by √d, a softmax turns them into weights, and the values are mixed.
 */
export function attend(
	q: readonly (readonly number[])[],
	k: readonly (readonly number[])[],
	v: readonly (readonly number[])[],
	i: number
): AttentionStep {
	const d = q[i].length;
	const dots = k.slice(0, i + 1).map((kj) => dot(q[i], kj));
	const scores = dots.map((x) => x / Math.sqrt(d));
	const weights = softmax(scores);
	const out = new Array<number>(d).fill(0);
	weights.forEach((w, j) => {
		for (let c = 0; c < d; c++) out[c] += w * v[j][c];
	});
	return { dots, scores, weights, out };
}

/** One fixed sentence and the attention of all 144 heads of GPT-2 small on it. */
export class Sentence {
	readonly id: string;
	readonly text: string;
	readonly tokens: string[];
	readonly ids: number[];
	readonly next: { token: string; p: number }[];
	readonly n: number;
	private readonly att: Uint8Array;
	private readonly heads: number;
	private readonly tri: number;

	constructor(s: GptData['sentences'][number], heads: number) {
		this.id = s.id;
		this.text = s.text;
		this.tokens = s.tokens;
		this.ids = s.ids;
		this.next = s.next.map(([token, p]) => ({ token, p }));
		this.n = s.tokens.length;
		this.att = bytes(s.att);
		this.heads = heads;
		this.tri = (this.n * (this.n + 1)) / 2;
	}

	/**
	 * How much token `i` attends to each token (0..n−1) in head `head` of layer `layer` (both
	 * counted from 0). Later tokens get 0: GPT-2 cannot look ahead. Stored with 8 bits, so each
	 * weight is within 0.002 of the model's.
	 */
	row(layer: number, head: number, i: number): number[] {
		const base = (layer * this.heads + head) * this.tri + (i * (i + 1)) / 2;
		return Array.from({ length: this.n }, (_, j) => (j <= i ? this.att[base + j] / 255 : 0));
	}

	/** The whole n × n attention pattern of one head (row = the token doing the looking). */
	matrix(layer: number, head: number): number[][] {
		return Array.from({ length: this.n }, (_, i) => this.row(layer, head, i));
	}
}

export class Gpt2 {
	readonly config: GptData['config'];
	readonly source: GptData['source'];
	readonly sentences: Sentence[];
	readonly featured: GptData['featured'];
	readonly positions: { n: number; cos: number[][]; norms: number[] };

	constructor(data: GptData) {
		this.config = data.config;
		this.source = data.source;
		this.sentences = data.sentences.map((s) => new Sentence(s, data.config.heads));
		this.featured = data.featured;
		const n = data.positions.n;
		const raw = new DataView(bytes(data.positions.cos).buffer);
		this.positions = {
			n,
			cos: Array.from({ length: n }, (_, i) =>
				Array.from({ length: n }, (_, j) => raw.getInt16(2 * (i * n + j), true) / 10000)
			),
			norms: data.positions.norms
		};
	}

	sentence(id: string): Sentence {
		return this.sentences.find((s) => s.id === id) ?? this.sentences[0];
	}

	/** The featured head redone by hand for token `i`: see `attend`. */
	featuredStep(i: number): AttentionStep {
		const f = this.featured;
		return attend(f.q, f.k, f.v, i);
	}
}

/**
 * Parameters of a GPT-2-style model, counted from its shape: token and position embeddings, and
 * per block two LayerNorms, the q/k/v projection, the output projection W_O and the two-layer MLP
 * (4 × wider in the middle), then a final LayerNorm. The output layer reuses the token embedding.
 */
export function parameterCount(c: {
	layers: number;
	dModel: number;
	vocab: number;
	context: number;
}): { total: number; embeddings: number; perBlock: number; attention: number; mlp: number } {
	const d = c.dModel;
	const attention = d * 3 * d + 3 * d + d * d + d;
	const mlp = d * 4 * d + 4 * d + 4 * d * d + d;
	const perBlock = attention + mlp + 2 * 2 * d;
	const embeddings = c.vocab * d + c.context * d;
	return { total: embeddings + c.layers * perBlock + 2 * d, embeddings, perBlock, attention, mlp };
}

/** How a token is written on the stage: the start token, new lines, spaces made visible. */
export function tokenLabel(t: string, showSpace = false): string {
	if (t === '<|endoftext|>') return '⟨start⟩';
	if (t === '\n') return '↵';
	if (showSpace && t.startsWith(' ')) return '␣' + t.slice(1);
	return t.trim() === '' ? '␣' : t.trim();
}

/** "layer 5, head 4": readers count from 1 (the papers count from 0: head 4.3). */
export const headName = (layer: number, head: number) => `layer ${layer + 1}, head ${head + 1}`;
