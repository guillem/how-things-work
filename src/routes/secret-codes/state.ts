/**
 * What the scenes share through the explainer's params: the reader's message, the wheel's turn
 * and the scramble. Kept here so that every scene reads them the same way.
 */
import type { Params } from '#lib/explainer/index.ts';
import { FIRST_MESSAGE, scramble, tidy, type Key } from './model';

/** The reader's message, as the wheel writes it (the first message until they type one). */
export function messageOf(params: Params): string {
	return tidy(typeof params.msg === 'string' ? params.msg : FIRST_MESSAGE);
}

/** The turn of the reader's wheel, 1 to 25. */
export function turnOf(params: Params): number {
	return Math.min(25, Math.max(1, Math.round(Number(params.turn ?? 3)) || 3));
}

/** The scramble the reader made (a new one for each press of "Scramble again"). */
export function keyOf(params: Params): Key {
	return scramble(Math.round(Number(params.scramble ?? 0)) || 0);
}

export interface Line {
	text: string;
	/** Where the line starts in the whole text. */
	start: number;
}

/** Breaks `text` into lines of at most `width` characters, at spaces where it can. */
export function wrap(text: string, width: number): Line[] {
	const lines: Line[] = [];
	let i = 0;
	while (i < text.length) {
		while (text[i] === ' ') i++;
		if (i >= text.length) break;
		let end = Math.min(text.length, i + width);
		if (end < text.length && text[end] !== ' ') {
			const space = text.lastIndexOf(' ', end);
			if (space > i) end = space;
		}
		lines.push({ text: text.slice(i, end).trimEnd(), start: i });
		i = end;
	}
	return lines;
}
