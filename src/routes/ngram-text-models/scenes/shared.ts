/** Data, caches and small helpers shared by the n-gram scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { Alphabet, MAX_N, NgramModel, measure, split, unseenProfile, type Measure } from '../ngram';
import { DEFAULT_TEXT, SIZE_OPTIONS, type SizeId } from '../steps';
import textUrl from '../tinyshakespeare.txt?url';

export const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

/** The reader's own text (the box of the first steps). */
export const ownText = (params: Params) => str(params.msg, DEFAULT_TEXT);
export const MAX_LENGTH = 300;

/** Window size on the Shakespeare steps, 1–10. */
export const windowOf = (params: Params) =>
	Math.max(1, Math.min(MAX_N, Math.round(num(params.n, 3))));
export const sizeOf = (params: Params): SizeId => {
	const v = str(params.size, '1m');
	return SIZE_OPTIONS.some((o) => o.value === v) ? (v as SizeId) : '1m';
};
/** Seed for sampling: "Write again" presses count up from 0. */
export const seedOf = (params: Params) => 1 + Math.round(num(params.again, 0));

/** Characters shown as they are: a space as ␣ and a line break as ↵ (in windows and chips). */
export const visible = (s: string) => s.replace(/ /g, '␣').replace(/\n/g, '↵');

export interface Shakespeare {
	text: string;
	train: string;
	heldOut: string;
	alphabet: Alphabet;
}

let loading: Promise<Shakespeare> | null = null;
/** Tiny Shakespeare (1.1 MB), fetched the first time a scene needs it. */
export function shakespeare(): Promise<Shakespeare> {
	loading ??= fetch(textUrl)
		.then((r) => {
			if (!r.ok) throw new Error(`Tiny Shakespeare: HTTP ${r.status}`);
			return r.text();
		})
		.then((text) => ({ text, ...split(text), alphabet: new Alphabet(text) }));
	loading.catch(() => (loading = null));
	return loading;
}

const SIZE_CHARS: Record<SizeId, number> = { '10k': 10_000, '100k': 100_000, '1m': Infinity };

const models = new Map<SizeId, NgramModel>();
/** The model trained on the first `size` characters of the training part. */
export function modelFor(data: Shakespeare, size: SizeId): NgramModel {
	let m = models.get(size);
	if (!m) {
		m = new NgramModel(data.train.slice(0, SIZE_CHARS[size]), data.alphabet);
		models.set(size, m);
	}
	return m;
}

const profiles = new Map<SizeId, number[]>();
/** Share of held-out windows never seen, for n = 0 … 10. */
export function unseenFor(data: Shakespeare, size: SizeId): number[] {
	let p = profiles.get(size);
	if (!p) {
		p = unseenProfile(modelFor(data, size), data.heldOut);
		profiles.set(size, p);
	}
	return p;
}

/** Characters in each sample the Shakespeare steps write. */
export const SAMPLE_LENGTH = 600;

const measures = new Map<string, Measure[]>();
/** One sample for every n from 1 to 10 (same seed), with its measures; index n − 1. */
export function measuresFor(data: Shakespeare, size: SizeId, seed: number): Measure[] {
	const key = `${size}:${seed}`;
	let ms = measures.get(key);
	if (!ms) {
		const model = modelFor(data, size);
		ms = Array.from({ length: MAX_N }, (_, i) => measure(model, i + 1, seed, SAMPLE_LENGTH));
		measures.set(key, ms);
	}
	return ms;
}

/** "12.3%" with one decimal under 10%, none above; "0%" and "100%" stay plain. */
export function pct(v: number) {
	const p = v * 100;
	if (p === 0 || p === 100) return `${p}%`;
	return p < 10 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
}

export const fmt = (v: number) => v.toLocaleString('en-US');

/** How a character of a text block is drawn. */
export type Kind = 'plain' | 'muted' | 'hot' | 'copy' | 'unseen' | 'window' | 'next';

/** Characters per line and line breaks of a monospace text block. */
export interface Line {
	/** Index (in characters) of each character on this line. */
	idx: number[];
	/** An empty line (a blank line in the text): drawn at half height. */
	blank: boolean;
}

/**
 * Word-wraps `cs` (one string per character) at `perLine` columns. A line break starts a new
 * line; runs of blank lines collapse into one half-height gap.
 */
export function wrap(cs: readonly string[], perLine: number): Line[] {
	const lines: Line[] = [];
	let cur: number[] = [];
	const push = () => {
		const blank = cur.length === 0;
		if (blank && (lines.length === 0 || lines[lines.length - 1].blank)) return;
		lines.push({ idx: cur, blank });
		cur = [];
	};
	for (let i = 0; i < cs.length; i++) {
		const c = cs[i];
		if (c === '\n') {
			push();
			continue;
		}
		if (cur.length >= perLine) {
			// break after the last space of the line if there is one
			let cut = cur.length;
			for (let k = cur.length - 1; k > perLine / 2; k--)
				if (cs[cur[k]] === ' ') {
					cut = k + 1;
					break;
				}
			const rest = cur.slice(cut);
			cur = cur.slice(0, cut);
			push();
			cur = rest;
		}
		cur.push(i);
	}
	if (cur.length) lines.push({ idx: cur, blank: false });
	return lines;
}

let windowCounts: { distinct: number; forced: number }[] | null = null;
/** Distinct windows of the whole training text, and how many allow one next letter; index n − 1. */
export function windowsFor(data: Shakespeare) {
	const model = modelFor(data, '1m');
	windowCounts ??= Array.from({ length: MAX_N }, (_, i) => model.windows(i + 1));
	return windowCounts;
}
