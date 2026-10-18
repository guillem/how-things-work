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

/** Width of a chip for `text` at `size` px (monospace; ⟨ ⟩ of byte tokens come from a wider font). */
export const chipWidth = (text: string, size = 13, min = 20) =>
	Math.max(
		min,
		Math.round([...text].length * size * 0.6 + 10 + (text.startsWith('⟨') ? size * 0.5 : 0))
	);

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
