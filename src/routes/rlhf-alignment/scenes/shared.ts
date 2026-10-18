/** Helpers shared by the rlhf-alignment scenes. */
import type { Params } from '#lib/explainer/index.ts';
import { prompts } from '../rlhf-data';
import type { PromptData } from '../data';

/** The question picked by the select control. */
export function promptOf(params: Params): PromptData {
	const id = typeof params.question === 'string' ? params.question : 'sleep';
	return prompts.find((p) => p.id === id) ?? prompts[0];
}

/** β from the leash slider, which holds log₁₀ β. */
export const betaOf = (params: Params) =>
	10 ** (typeof params.leash === 'number' ? params.leash : 0);

/** β as the slider shows it. */
export function fmtBeta(b: number): string {
	return b >= 1 ? b.toFixed(b < 10 ? 1 : 0) : b.toFixed(b < 0.1 ? 3 : 2);
}

/** The colour of a rater's score. */
export function scoreColor(s: number): string {
	if (s <= -1) return 'var(--rl-s-low)';
	if (s >= 4) return 'var(--rl-s-4)';
	return `var(--rl-s-${Math.round(s)})`;
}

/** Splits a text into lines of at most `max` characters, at spaces; at most `lines` lines (… added). */
export function wrap(text: string, max: number, lines = 3): string[] {
	const out: string[] = [];
	let cur = '';
	for (const w of text.split(/\s+/)) {
		if (!cur) cur = w;
		else if (cur.length + 1 + w.length <= max) cur += ' ' + w;
		else {
			out.push(cur);
			cur = w;
		}
	}
	if (cur) out.push(cur);
	if (out.length <= lines) return out;
	const kept = out.slice(0, lines);
	kept[lines - 1] = kept[lines - 1].replace(/\s*\S*$/, '') + ' …';
	return kept;
}

/** A signed number: +1.2, −0.4. */
export const signed = (v: number, digits = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(digits);

/** A number with a real minus sign. */
export const num = (v: number, digits = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(digits);

/** A probability as a percentage. */
export const pct = (p: number) =>
	p >= 0.995 ? '100%' : p >= 0.1 ? `${Math.round(p * 100)}%` : `${(p * 100).toFixed(1)}%`;
