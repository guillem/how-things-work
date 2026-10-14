/** Small helpers shared by the language-model scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { Bpe } from '../bpe';
import { Lm, tokenLabel } from '../lm';
import { data } from '../gpt2-lm-data';
import { DEFAULT_MESSAGE } from '../steps';
import mergesUrl from '../gpt2-merges.bin?url';

export const lm = new Lm(data);

export const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
export const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);

export const label = (t: string) => tokenLabel(t);

/** The message typed on the tokenizer steps. */
export const message = (params: Params) => str(params.msg, DEFAULT_MESSAGE);
export const MAX_LENGTH = 120;

/** Width of a chip for `text` at `size` px (a rough average glyph width). */
export const chipWidth = (text: string, size = 13, min = 22) =>
	Math.max(min, Math.round([...text].length * size * 0.6 + 12));

/** Lay chips out left to right, wrapping at `width`. */
export function flow<T extends { w: number }>(
	items: T[],
	x0: number,
	width: number,
	gap = 6,
	lineH = 44
) {
	let x = x0;
	let row = 0;
	return items.map((it) => {
		if (x + it.w > x0 + width && x > x0) {
			x = x0;
			row++;
		}
		const out = { ...it, x, row, y: row * lineH };
		x += it.w + gap;
		return out;
	});
}

/** Five soft colours that alternate under consecutive tokens (like most tokenizer demos). */
export const TOKEN_FILLS = [
	'var(--lm-t1)',
	'var(--lm-t2)',
	'var(--lm-t3)',
	'var(--lm-t4)',
	'var(--lm-t5)'
];

let bpe: Promise<Bpe> | null = null;
/** GPT-2's tokenizer; its 200 KB of merges are fetched the first time it is needed. */
export function tokenizer(): Promise<Bpe> {
	bpe ??= fetch(mergesUrl)
		.then((r) => {
			if (!r.ok) throw new Error(`merges: HTTP ${r.status}`);
			return r.arrayBuffer();
		})
		.then((b) => new Bpe(new Uint8Array(b)));
	bpe.catch(() => (bpe = null));
	return bpe;
}

export function onkey(event: KeyboardEvent, act: () => void) {
	if (event.key !== 'Enter' && event.key !== ' ') return;
	event.preventDefault();
	act();
}
