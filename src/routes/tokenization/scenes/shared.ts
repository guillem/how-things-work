/** Small helpers shared by the tokenization scenes. */
import { gpt2, type Gpt2 } from '../gpt2';
import mergesUrl from '../../language-models/gpt2-merges.bin?url';

/** GPT-2's tokenizer; its merges (the same file as the language-models page) are fetched once. */
export const tokenizer = (): Promise<Gpt2> => gpt2(mergesUrl);

/** A token as shown on a chip: a leading space as ␣, a line break as ↵. */
export const show = (t: string) =>
	t
		.replace(/^ /, '␣')
		.replace(/\n/g, '↵')
		.replace(/\t/g, '⇥')
		.replace(/ (?= |$)/g, '␣');

/** Is this a wide (full-width) character: Chinese, Japanese, Korean? */
const wide = (c: string) =>
	/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]/.test(c);

/** Rough width of monospace text at `size` px: CJK characters are about twice as wide. */
export const textWidth = (text: string, size: number) =>
	[...text].reduce((a, c) => a + (wide(c) ? 1.0 : 0.6) * size, 0);

/** Width of a chip for `text` at `size` px (monospace; ⟨ ⟩ of byte tokens come from a wider font). */
export const chipWidth = (text: string, size = 13, min = 20) =>
	Math.max(min, Math.round(textWidth(text, size) + 10 + (text.startsWith('⟨') ? size * 0.5 : 0)));

/** The start of `text` that fits in `width` px at `size`, with an ellipsis if cut. */
export function fit(text: string, size: number, width: number) {
	if (textWidth(text, size) <= width) return text;
	let out = '';
	for (const c of text) {
		if (textWidth(out + c + '…', size) > width) break;
		out += c;
	}
	return out + '…';
}

/** Lay chips out left to right, wrapping at `width`. */
export function flow<T extends { w: number }>(
	items: T[],
	x0: number,
	width: number,
	gap = 4,
	lineH = 40
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

/** Soft colours that alternate under consecutive tokens (the language-models page's). */
export const FILLS = [
	'var(--lm-t1)',
	'var(--lm-t2)',
	'var(--lm-t3)',
	'var(--lm-t4)',
	'var(--lm-t5)'
];

/** 1,234 */
export const fmt = (n: number) => n.toLocaleString('en-US');

/** A long token cut to n characters, with an ellipsis. */
export const clip = (t: string, n = 14) => {
	const c = [...t];
	return c.length > n ? c.slice(0, n - 1).join('') + '…' : t;
};
