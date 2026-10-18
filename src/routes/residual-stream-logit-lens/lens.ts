/**
 * The residual-stream explainer's model: GPT-2 small's running vector, read out with the logit
 * lens after every block, for five fixed prompts, and the same runs with one block's attention or
 * MLP output switched off.
 *
 * The numbers come from `lens-data.ts`, made once by
 * `scripts/data/residual-stream-logit-lens/build.py` (GPT-2 small, openai-community/gpt2 on
 * Hugging Face, MIT licence; the script's header gives the revision, checksum, format and how it
 * was run). No model runs in the browser. Blocks are numbered from 1 here, as readers count;
 * papers count from 0 (block 10 here is layer 9 there). Row L of a grid is the stream after
 * block L, row 0 the embedding alone.
 */
import { data } from './lens-data';

export interface LensData {
	source: {
		model: string;
		repository: string;
		revision: string;
		licence: string;
		sha256: string;
		script: string;
	};
	prompts: PromptData[];
}

type Pair = [number, number];

export interface PromptData {
	id: string;
	text: string;
	tokens: string[];
	vocab: string[];
	/** [row 0..12][position 1..n-1]: [i1, p1, i2, p2, i3, p3], p in thousandths. */
	lens: number[][][];
	/** [row][position 1..n-1]: the final answer's probability at that row, in thousandths. */
	answer: number[][];
	last: {
		stream: number[];
		attn: number[];
		mlp: number[];
		ln1: number[];
		ln2: number[];
		answer: string;
		runnerUp: string;
		plane: { x0: Pair; attn: Pair[]; mlp: Pair[]; final: Pair };
	};
	next: [string, number][];
	ablate: {
		kind: 'attn' | 'mlp';
		layer: number;
		/** [row block+1 .. 12][position]: [vocab index, p in thousandths]. */
		grid: number[][][];
		next: [string, number][];
		pAnswer: number;
	}[];
}

export const BLOCKS = 12;
export const ROWS = BLOCKS + 1;

export type Part = 'attn' | 'mlp';
/** A component that can be switched off: block 1..12, its attention or its MLP. */
export interface Component {
	block: number;
	part: Part;
}

export const partName = (p: Part) => (p === 'attn' ? 'attention' : 'MLP');
export const componentName = (c: Component) => `block ${c.block} ${partName(c.part)}`;

export const PROMPTS = data.prompts.map((p) => ({ id: p.id, text: p.text }));
export const source = data.source;

export function prompt(id: string): PromptData {
	return data.prompts.find((p) => p.id === id) ?? data.prompts[0];
}

/** A token as the page shows it: the start token named, a leading space dropped. */
export function tokenLabel(t: string): string {
	if (t === '<|endoftext|>') return '⟨start⟩';
	if (t === '\n') return '↵';
	return t.trim() === '' ? '␣' : t.trim();
}

/** The words of the prompt that are read out: every token after the start token. */
export const words = (p: PromptData) => p.tokens.slice(1);

export interface Guess {
	token: string;
	p: number;
}

/** The lens's three best guesses after block `row` (0: the embedding) at word `pos` (0-based). */
export function lensAt(p: PromptData, row: number, pos: number): Guess[] {
	const c = p.lens[row][pos];
	const out: Guess[] = [];
	for (let k = 0; k < c.length; k += 2) out.push({ token: p.vocab[c[k]], p: c[k + 1] / 1000 });
	return out;
}

/** The token the model finally predicts after word `pos`. */
export const finalAt = (p: PromptData, pos: number) => lensAt(p, BLOCKS, pos)[0].token;

/** The probability the lens gives that final token after block `row`. */
export const answerAt = (p: PromptData, row: number, pos: number) => p.answer[row][pos] / 1000;

/**
 * The first row from which the lens's top guess at `pos` is the final answer and stays it to the
 * end (12 if it only appears in the output).
 */
export function settlesAt(p: PromptData, pos: number): number {
	const ans = finalAt(p, pos);
	let r = BLOCKS;
	while (r > 0 && lensAt(p, r - 1, pos)[0].token === ans) r--;
	return r;
}

/** The ablation record for a component. */
function ablation(p: PromptData, c: Component) {
	const a = p.ablate.find((x) => x.layer === c.block - 1 && x.kind === c.part);
	if (!a) throw new Error(`no ablation ${componentName(c)}`);
	return a;
}

/**
 * The grid's top-1 guesses, row by row (0..12), word by word, in the clean run or with one
 * component switched off. Rows before the switched-off block are those of the clean run: nothing
 * upstream can see what happens downstream.
 */
export function grid(p: PromptData, off: Component | null = null): Guess[][] {
	const n = words(p).length;
	const clean = Array.from({ length: ROWS }, (_, r) =>
		Array.from({ length: n }, (_, i) => lensAt(p, r, i)[0])
	);
	if (!off) return clean;
	const a = ablation(p, off);
	return clean.map((row, r) =>
		r < off.block
			? row
			: a.grid[r - off.block].map(([v, q]) => ({ token: p.vocab[v], p: q / 1000 }))
	);
}

/** The model's final top guesses after the last word, clean or with one component off. */
export function nextTokens(p: PromptData, off: Component | null = null): Guess[] {
	const src = off ? ablation(p, off).next : p.next;
	return src.map(([token, q]) => ({ token, p: off ? q / 1000 : q }));
}

/** The probability of the clean answer after the last word, clean or with a component off. */
export function pAnswer(p: PromptData, off: Component | null = null): number {
	return off ? ablation(p, off).pAnswer / 1000 : p.next[0][1];
}

/** Every component, in the order the stream meets them: block 1 attention, block 1 MLP, … */
export const COMPONENTS: Component[] = Array.from({ length: BLOCKS }, (_, l): Component[] => [
	{ block: l + 1, part: 'attn' },
	{ block: l + 1, part: 'mlp' }
]).flat();

/** Every single-component ablation's effect on the answer, in stream order. */
export function effects(p: PromptData) {
	const base = pAnswer(p);
	return COMPONENTS.map((c) => {
		const q = pAnswer(p, c);
		const top = nextTokens(p, c)[0];
		return { ...c, p: q, change: q - base, top: top.token, flips: top.token !== p.next[0][0] };
	});
}

/**
 * The last word's running vector as a path in the plane: x along the direction that raises the
 * final answer above the average token as the lens reads it, y the same for the runner-up, made
 * at right angles to x. Point 0 is the embedding, then one point after each attention and each
 * MLP output is added, 25 in all. The projection is linear, so the path ends at the final vector.
 */
export function path(p: PromptData) {
	const pl = p.last.plane;
	const pts: { x: number; y: number; part: Part | 'embed'; block: number }[] = [
		{ x: pl.x0[0], y: pl.x0[1], part: 'embed', block: 0 }
	];
	let [x, y] = pl.x0;
	for (let l = 0; l < BLOCKS; l++) {
		x += pl.attn[l][0];
		y += pl.attn[l][1];
		pts.push({ x, y, part: 'attn', block: l + 1 });
		x += pl.mlp[l][0];
		y += pl.mlp[l][1];
		pts.push({ x, y, part: 'mlp', block: l + 1 });
	}
	return pts;
}

/** Sizes at the last word: the stream's length after each row, and each block's two outputs. */
export function sizes(p: PromptData) {
	return {
		stream: p.last.stream,
		attn: p.last.attn,
		mlp: p.last.mlp,
		/** The factor each block's first layer norm scales the stream by, 1/σ. */
		ln1: p.last.ln1.map((s) => 1 / s)
	};
}
