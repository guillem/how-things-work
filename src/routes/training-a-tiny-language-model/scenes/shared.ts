/** Small helpers shared by the training scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { CONTEXTS, DATA_SIZES, DEFAULT, STEPS, WIDTHS } from '../train';

export const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

const pick = <T extends number>(list: readonly T[], v: unknown, d: T): T => {
	const n = Number(v);
	return (list as readonly number[]).includes(n) ? (n as T) : d;
};
export const widthOf = (p: Params, id = 'width') => pick(WIDTHS, p[id], DEFAULT.width);
export const contextOf = (p: Params, id = 'context') => pick(CONTEXTS, p[id], DEFAULT.context);
const DATA_IDS: Record<string, number> = { '10k': 10_000, '100k': 100_000, all: Infinity };
export const dataOf = (p: Params, id = 'data', d = 'all') =>
	DATA_IDS[typeof p[id] === 'string' ? String(p[id]) : d] ?? DATA_IDS[d];
export { DATA_SIZES };

/** The training step the curve's cursor is on. */
export const atOf = (p: Params) => Math.max(0, Math.min(STEPS, Math.round(num(p.at, STEPS))));

/** Nats with two decimals. */
export const nats = (v: number) => v.toFixed(2);
/** A thousands-separated whole number. */
export const int = (v: number) => Math.round(v).toLocaleString('en-US');
/** A probability as a percentage (one decimal under 10%). */
export function pct(p: number): string {
	const v = p * 100;
	if (v < 0.1) return '<0.1%';
	if (v > 99.9) return '>99.9%';
	return v < 10 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`;
}
/** A character as the stage shows it: a space as ␣, a line break as ↵. */
export const visible = (c: string) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c);

/** Data size for a label. */
export const dataLabel = (size: number) =>
	Number.isFinite(size) ? `${int(size)} characters` : 'all 1,003,854 characters';

/**
 * Lines of a sample for a card: split at its line breaks, long lines wrapped at `width`
 * characters, at most `max` lines.
 */
export function sampleLines(text: string, width: number, max: number): string[] {
	const out: string[] = [];
	for (const line of text.split('\n')) {
		if (line.length === 0) out.push('');
		for (let i = 0; i < line.length; i += width) out.push(line.slice(i, i + width));
	}
	// a blank first line (the sample starts after a blank line) adds nothing
	while (out.length && out[0] === '') out.shift();
	return out.slice(0, max);
}
