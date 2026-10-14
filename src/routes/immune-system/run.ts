/**
 * What each step simulates, from its hints and controls, and a small cache so
 * that scenes sharing a run (or coming back to it) don't recompute it.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { simulate, type Sample, type Scenario } from './model';

export interface Setup {
	kind: 'standoff' | 'primary' | 'second';
	scenario: Partial<Scenario>;
	/** Day of the second infection (for `second`). */
	reinfectAt: number | null;
	/** Days shown on the time axis, counted from the start of an infection. */
	span: number;
	/** The full response, faint, when a response has been switched off. */
	ghost: Partial<Scenario> | null;
}

export function setup(step: Step, params: Params): Setup {
	const kind = String(step.hints?.case ?? 'primary') as Setup['kind'];
	if (kind === 'second') {
		const r = Number(params.reinfect ?? 180);
		return {
			kind,
			scenario: { days: r + 20, reinfectAt: r },
			reinfectAt: r,
			span: 20,
			ghost: null
		};
	}
	const id = kind === 'standoff' ? '1' : '';
	const innate = params[`innate${id}`] !== false;
	const adaptive = kind === 'standoff' ? params.adaptive1 === true : params.adaptive !== false;
	const scenario = { days: 30, innate, tcells: adaptive, bcells: adaptive };
	const full = innate && adaptive;
	return {
		kind,
		scenario,
		reinfectAt: null,
		span: 30,
		ghost: full || kind === 'standoff' ? null : { days: 30 }
	};
}

const cache = new Map<string, Sample[]>();

/** The simulated run (cached; a run takes a few tens of milliseconds). */
export function run(scenario: Partial<Scenario>): Sample[] {
	const key = JSON.stringify(scenario);
	let s = cache.get(key);
	if (!s) {
		s = simulate(scenario);
		if (cache.size > 40) cache.clear();
		cache.set(key, s);
	}
	return s;
}

/** The samples from day `from` on, re-timed to start at 0 and cut at `span` days. */
export function retime(series: readonly Sample[], from: number, span: number): Sample[] {
	return series
		.filter((s) => s.t >= from - 1e-9 && s.t <= from + span + 1e-9)
		.map((s) => ({ ...s, t: s.t - from }));
}

/** Superscript digits for powers of ten on log axes. */
const SUP: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻'
};
export const pow10 = (n: number) =>
	n === 0 ? '1' : n === 1 ? '10' : '10' + [...String(n)].map((c) => SUP[c] ?? c).join('');

/** A count in words a reader can take in at a glance: 63,000 · 1.1 million · 4 billion. */
export function count(v: number): string {
	if (!(v >= 1)) return v > 0 ? 'under 1' : '0';
	if (v < 1e4) return Math.round(v).toLocaleString('en-US');
	if (v < 1e6) return (Math.round(v / 1000) * 1000).toLocaleString('en-US');
	const units: [number, string][] = [
		[1e12, 'trillion'],
		[1e9, 'billion'],
		[1e6, 'million']
	];
	for (const [u, name] of units) {
		if (v >= u) {
			const x = v / u;
			return `${x < 10 ? x.toFixed(1).replace(/\.0$/, '') : Math.round(x)} ${name}`;
		}
	}
	return String(Math.round(v));
}
