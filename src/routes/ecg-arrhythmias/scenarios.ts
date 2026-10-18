/**
 * What each step of the page runs: the heart's options from the step and its controls, and the
 * scripted events (an early beat a set time after a QRS, a shock at a set time), plus the
 * read-outs the page shows. A `Run` is a `Heart` with its pending events. Shared by the scene and
 * the model tests, so the tests check what a visitor sees.
 */
import type { Params } from '#lib/explainer/index.ts';
import { Heart, STEP_MS, type Options } from './model.ts';

export type Event =
	| {
			kind: 'ectopic';
			/** ms after the onset of ventricular beat `beat` (0-based). */ beat: number;
			coupling: number;
	  }
	| { kind: 'shock'; at: number };

export interface Setup {
	options: Partial<Options>;
	events: Event[];
}

/** Defaults of the controls. */
export const CONTROL_DEFAULTS = {
	rate: 75,
	av: 1,
	coupling: 400,
	slow: true,
	scar: true,
	patchy: true,
	gradient: true
};

const num = (p: Params, id: keyof typeof CONTROL_DEFAULTS) => Number(p[id] ?? CONTROL_DEFAULTS[id]);
const bool = (p: Params, id: keyof typeof CONTROL_DEFAULTS) =>
	p[id] === undefined ? Boolean(CONTROL_DEFAULTS[id]) : p[id] === true;

/** The early beat that the arrhythmia steps fire by themselves, after the second QRS. */
export const AUTO_BEAT = 1;
/** When the shock step shocks by itself, ms. */
export const AUTO_SHOCK_MS = 5000;
/** When the flat-line step shocks by itself, ms. */
export const FLAT_SHOCK_MS = 2500;

/** The heart and the scripted events of a step, given its controls. */
export function setup(step: string, p: Params): Setup {
	switch (step) {
		case 'wave':
			return { options: { rate: num(p, 'rate') }, events: [] };
		case 'leads':
			return { options: { gradient: bool(p, 'gradient') }, events: [] };
		case 'block':
			return { options: { av: num(p, 'av') }, events: [] };
		case 'early':
			return {
				options: {},
				// an early beat after every third QRS, so that one is always in view
				events: Array.from({ length: 30 }, (_, k) => ({
					kind: 'ectopic' as const,
					beat: AUTO_BEAT + 3 * k,
					coupling: num(p, 'coupling')
				}))
			};
		case 'reentry':
			return {
				options: { slow: bool(p, 'slow'), scar: bool(p, 'scar') },
				events: [{ kind: 'ectopic', beat: AUTO_BEAT, coupling: num(p, 'coupling') }]
			};
		case 'vf':
			return {
				options: { slow: true, scar: true, patchy: bool(p, 'patchy') },
				events: [{ kind: 'ectopic', beat: AUTO_BEAT, coupling: CONTROL_DEFAULTS.coupling }]
			};
		case 'shock':
			return {
				options: { slow: true, scar: true, patchy: true },
				events: [
					{ kind: 'ectopic', beat: AUTO_BEAT, coupling: CONTROL_DEFAULTS.coupling },
					{ kind: 'shock', at: AUTO_SHOCK_MS }
				]
			};
		case 'flatline':
			return {
				options: { rate: 0, escape: false },
				events: [{ kind: 'shock', at: FLAT_SHOCK_MS }]
			};
		default:
			return { options: {}, events: [] };
	}
}

export class Run {
	readonly heart: Heart;
	private pending: Event[];

	constructor(s: Setup) {
		this.heart = new Heart(s.options);
		this.pending = [...s.events];
	}

	/** Advances to `ms` of heart time, at most `cap` steps; true when it got there. */
	advanceTo(ms: number, cap = Infinity) {
		const h = this.heart;
		const target = Math.round(ms / STEP_MS);
		let n = 0;
		this.fireDue();
		while (h.steps < target && n < cap) {
			// up to the next event, or in short strides while an early beat waits for its QRS
			let k = target - h.steps;
			for (const e of this.pending) {
				const at = this.when(e);
				k = Math.min(k, at === null ? 25 : Math.max(1, Math.ceil(at / STEP_MS) - h.steps));
			}
			k = Math.min(k, cap - n);
			h.step(k);
			n += k;
			this.fireDue();
		}
		return h.steps >= target;
	}

	/** When an event is due, ms, or null while it waits for its QRS. */
	private when(e: Event) {
		if (e.kind === 'shock') return e.at;
		const b = this.heart.beats[e.beat];
		return b ? b.onset + e.coupling : null;
	}
	private fireDue() {
		const h = this.heart;
		this.pending = this.pending.filter((e) => {
			const at = this.when(e);
			if (at === null || at > h.time + 1e-6) return true;
			if (e.kind === 'shock') h.shock();
			else h.ectopic();
			return false;
		});
	}

	/** An early beat `coupling` ms after the latest QRS if that is still ahead, else the next. */
	fire(coupling: number) {
		const h = this.heart;
		const last = h.beats.length - 1;
		const beat = last >= 0 && h.beats[last].onset + coupling > h.time ? last : last + 1;
		this.pending.push({ kind: 'ectopic', beat, coupling });
	}

	/** A shock now. */
	shock() {
		this.heart.shock();
	}
}

// ------------------------------------------------------------------------------- read-outs
/** Rate from the last few firings of a probe within `window` ms, beats a minute (0: none). */
export function rate(fires: number[], now: number, window = 3000) {
	const recent = fires.filter((t) => t > now - window);
	if (recent.length < 2) return 0;
	return (60000 * (recent.length - 1)) / (recent[recent.length - 1] - recent[0]);
}
export const atrialRate = (h: Heart) => rate(h.probeFires[0], h.time);
export const ventricularRate = (h: Heart) => rate(h.probeFires[1], h.time);

/** The last complete beat's PR interval (from the sinus firing before it) and QRS length, ms. */
export function intervals(h: Heart) {
	const done = h.beats.filter((b) => b.end < h.time - 40);
	const b = done[done.length - 1];
	if (!b) return null;
	// a beat started by the escape pacemaker or an early beat has no PR interval: no P led to it
	const own = [...h.escapes, ...h.ectopics].some((e) => e <= b.onset && b.onset - e < 200);
	const before = h.sinus.filter((s) => s < b.onset);
	const pr = !own && before.length ? b.onset - before[before.length - 1] : null;
	return { pr, qrs: b.end - b.onset };
}
