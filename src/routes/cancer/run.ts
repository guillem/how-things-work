/**
 * What each tissue step simulates (from its hints and controls), how fast it plays, and a
 * small cache so that scenes sharing a run, or coming back to it, don't recompute it.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import {
	DEFAULT,
	PASSENGERS,
	KRAS,
	MMR,
	P53A,
	P53B,
	RES_A,
	RES_B,
	simulate,
	type Run,
	type Scenario,
	type Therapy
} from './model';

export type View =
	'balance' | 'passengers' | 'driver' | 'hits' | 'repair' | 'treat' | 'combo' | 'recap';

/** The seed of the first run on every step; "Run again" counts up from it. */
export const SEED = 25;

const DRIVERS = KRAS | P53A | P53B;

export interface Setup {
	view: View;
	scenario: Partial<Scenario>;
}

export function setup(step: Step, params: Params): Setup {
	const view = String(step.hints?.view ?? 'hits') as View;
	const seed = SEED + Number(params.again ?? 0);
	const base = { seed, passengers: 0 };
	const scenario: Partial<Scenario> = (() => {
		switch (view) {
			case 'balance':
				return { ...base, genes: 0, gens: 300 };
			case 'passengers':
				return { ...base, genes: 0, passengers: PASSENGERS };
			case 'driver':
				return { ...base, genes: KRAS, gens: 500 };
			case 'hits':
				return { ...base, genes: DRIVERS, mu: DEFAULT.mu * Number(params.rate ?? 1) };
			case 'repair':
				return { ...base, genes: DRIVERS | (params.repair === false ? 0 : MMR) };
			case 'treat':
			case 'combo':
			case 'recap':
				return {
					...base,
					genes: DRIVERS | RES_A | RES_B,
					treat: view === 'recap' || params.treat !== false,
					therapy: (view === 'combo' ? String(params.therapy ?? 'one') : 'one') as Therapy
				};
		}
	})();
	return { view, scenario };
}

const cache = new Map<string, Run>();

/** The simulated run (cached; a run takes a few tens of milliseconds). */
export function run(scenario: Partial<Scenario>): Run {
	const key = JSON.stringify(scenario);
	let r = cache.get(key);
	if (!r) {
		r = simulate(scenario);
		if (cache.size > 24) cache.clear();
		cache.set(key, r);
	}
	return r;
}

export interface Plan {
	/** Last generation shown. */
	end: number;
	/** Generations per second, before and after the tumour is found. */
	pace: number;
	slow: number;
	/** Generation shown in the reduced-motion frame. */
	still: number;
}

/** How a run is played on a step. */
export function plan(view: View, r: Run): Plan {
	const G = r.scenario.gens;
	const after = (g: number | null, extra: number) => Math.min(G, (g ?? G) + extra);
	switch (view) {
		case 'balance':
			return { end: G, pace: 12, slow: 12, still: 150 };
		case 'passengers':
			return { end: G, pace: 24, slow: 24, still: 600 };
		case 'driver':
			return { end: G, pace: 18, slow: 18, still: 400 };
		case 'hits':
		case 'repair': {
			const end = after(r.found, 90);
			return { end, pace: 20, slow: 8, still: end };
		}
		default: {
			const done = r.treatedAt === null ? r.found : (r.relapse ?? r.cleared);
			const end = after(done, r.treatedAt === null ? 90 : 60);
			return { end, pace: 40, slow: 5, still: end };
		}
	}
}

/** The generation shown `t` seconds into the run. */
export function generationAt(p: Plan, found: number | null, t: number): number {
	const g = t * p.pace;
	if (found === null || g <= found) return Math.min(p.end, Math.floor(g));
	const tf = found / p.pace;
	return Math.min(p.end, Math.floor(found + (t - tf) * p.slow));
}
