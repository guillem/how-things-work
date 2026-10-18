/**
 * What each step runs: the views of the ocean scene (the part of the slice drawn, how fast the
 * model's clock runs against the animation's, where it starts and stops), the floor and the
 * uplift a step's controls ask for, and the model runs the other scenes take their curves from.
 */
import type { Params } from '#lib/explainer/index.ts';
import {
	COAST_KM,
	JAPAN_KM,
	Ocean,
	STATIONS,
	UPLIFT_KM,
	cellAt,
	floorDepths,
	kmOf,
	type FloorEdit
} from './model';

export interface View {
	/** The part of the slice drawn, km from the epicentre. */
	from: number;
	to: number;
	/** Deepest depth drawn, m. */
	maxDepth: number;
	/** Wave height drawn per metre, px. */
	etaPx: number;
	/** Model seconds per second of animation. */
	rate: number;
	/** Model time at which the view's run starts showing, s, and where it stops, s. */
	startS: number;
	endS: number;
	/** Seconds of animation before the earthquake (only the source view shows the jump). */
	delay: number;
}

export const VIEWS: Record<string, View> = {
	source: {
		from: -160,
		to: 520,
		maxDepth: 8000,
		etaPx: 9,
		rate: 60,
		startS: 0,
		endS: 75 * 60,
		delay: 2
	},
	ocean: {
		from: JAPAN_KM - 60,
		to: COAST_KM + 60,
		maxDepth: 8000,
		etaPx: 10,
		rate: 900,
		startS: 0,
		endS: 12.5 * 3600,
		delay: 0.5
	},
	shelf: {
		from: COAST_KM - 300,
		to: COAST_KM + 14,
		maxDepth: 4500,
		etaPx: 7,
		rate: 75,
		startS: 540 * 60,
		endS: 11 * 3600,
		delay: 0
	}
};

/** Model time shown under reduced motion, per step, s. */
export const REDUCED_S: Record<string, number> = {
	jolt: 9 * 60,
	cross: 620 * 60,
	speed: 3 * 3600,
	shelf: 604 * 60,
	ridge: 5.2 * 3600
};

/** Defaults of the controls, for steps that don't show them. */
export const DEFAULTS = { uplift: 5, ramp: 120, ridgeKm: 3000, ridgeTop: 1500 };

const num = (p: Params, id: keyof typeof DEFAULTS) => {
	const v = Number(p[id]);
	return Number.isFinite(v) ? v : DEFAULTS[id];
};

/** The floor and the uplift a step runs with. */
export function setup(stepId: string, p: Params): { uplift: number; edit: FloorEdit } {
	const edit: FloorEdit = {};
	if (stepId === 'shelf' && p.reshape === true) edit.rampKm = num(p, 'ramp');
	if (stepId === 'ridge') edit.ridge = { km: num(p, 'ridgeKm'), top: num(p, 'ridgeTop') };
	return { uplift: num(p, 'uplift'), edit };
}

/** The cells watched by the ocean scene: the stations, then both coasts, then 250 km off California. */
export const WATCH_KM = [...STATIONS.map((s) => s.km), JAPAN_KM, COAST_KM, COAST_KM - 250];
export const W_JAPAN = STATIONS.length;
export const W_COAST = STATIONS.length + 1;
export const W_OFFSHORE = STATIONS.length + 2;

/** A run of a step's setup, already advanced to `seconds`. */
export function runTo(s: { uplift: number; edit: FloorEdit }, seconds: number) {
	const o = new Ocean(floorDepths(s.edit), s.uplift, WATCH_KM);
	o.advanceTo(seconds);
	return o;
}

// ---- the crest in mid-ocean, for the ship ----------------------------------------------------

export interface Crest {
	/** km from the crest, and the surface there, m. */
	km: number[];
	eta: number[];
	/** Depth under the crest, m. */
	depth: number;
	/** Where the crest is on the slice, km from the epicentre. */
	at: number;
}

let crestCache: { uplift: number; crest: Crest } | null = null;

/** The eastbound wave 150 km either side of its crest, three hours after the earthquake. */
export function midOceanCrest(uplift: number): Crest {
	if (crestCache?.uplift === uplift) return crestCache.crest;
	const o = runTo({ uplift, edit: {} }, 3 * 3600);
	let best = cellAt(UPLIFT_KM + 500);
	for (let i = best; i < cellAt(COAST_KM - 500); i++) if (o.eta[i] > o.eta[best]) best = i;
	const km: number[] = [];
	const eta: number[] = [];
	for (let i = best - 75; i <= best + 75; i++) {
		km.push(kmOf(i) - kmOf(best));
		eta.push(o.eta[i]);
	}
	const crest = { km, eta, depth: o.h[best], at: kmOf(best) };
	crestCache = { uplift, crest };
	return crest;
}

// ---- the model's records at the stations and the coasts -------------------------------------

let recordCache: { uplift: number; records: number[][] } | null = null;

/** One value a minute for 12 hours at each WATCH_KM cell, on the real floor. */
export function modelRecords(uplift: number): number[][] {
	if (recordCache?.uplift === uplift) return recordCache.records;
	const o = runTo({ uplift, edit: {} }, 12 * 3600);
	recordCache = { uplift, records: o.records };
	return o.records;
}

/** "3 h 05 min", or "42 min" under an hour. */
export function hoursMinutes(seconds: number): string {
	const m = Math.max(0, Math.round(seconds / 60));
	if (m < 60) return `${m} min`;
	return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
