/** What the scenes share: the controls read as model settings, a cache of solved columns, colours. */
import type { Params, Step } from '#lib/explainer/index.ts';
import {
	LAPSE_REF,
	TAU_REF,
	WINDOW,
	diagnose,
	equilibrium,
	evolve,
	type Column,
	type Diagnostics,
	type Settings,
	type Snapshot
} from '../model';

export const TAU_MIN = 0.5;
export const TAU_MAX = 12;
export const LAPSE_MIN = 4;
export const LAPSE_MAX = 9.8;

const num = (v: unknown, fallback: number) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : fallback;
};

/**
 * The reader's column. A step can hold convection off (`radiative` hint) or on (`convective`:
 * the real-time run, which follows a troposphere tied to the ocean by convection).
 */
export function settingsOf(p: Params, step?: Step): Settings {
	const radiative = step?.hints?.radiative === true;
	return {
		tau: Math.min(TAU_MAX, Math.max(TAU_MIN, num(p.tau, TAU_REF))),
		window: p.window === false ? 0 : WINDOW,
		lapse: Math.min(LAPSE_MAX, Math.max(LAPSE_MIN, num(p.lapse, LAPSE_REF))),
		convection: radiative ? false : step?.hints?.convective === true || p.convection !== false
	};
}

export interface Solved {
	column: Column;
	d: Diagnostics;
}

const cache = new Map<string, Solved>();
/** The equilibrium column for these settings (solved once, a few milliseconds). */
export function solve(s: Settings): Solved {
	const key = `${s.tau.toFixed(2)}|${s.window}|${s.lapse.toFixed(2)}|${s.convection}`;
	let hit = cache.get(key);
	if (!hit) {
		const column = equilibrium(s);
		hit = { column, d: diagnose(column) };
		if (cache.size > 400) cache.clear();
		cache.set(key, hit);
	}
	return hit;
}

const runs = new Map<string, Snapshot[]>();
/** The column `from` (in equilibrium for `s`) given twice the absorber, in real time to `lastDay`. */
export function runOf(s: Settings, from: Column, lastDay: number): Snapshot[] {
	const key = `${s.tau.toFixed(2)}|${s.window}|${s.lapse.toFixed(2)}|${s.convection}`;
	let r = runs.get(key);
	if (!r) {
		r = evolve(from, { ...s, tau: 2 * s.tau }, lastDay, 90);
		if (runs.size > 100) runs.clear();
		runs.set(key, r);
	}
	return r;
}

/** Theme colours (app.css, `--rc-*`). */
export const C = {
	tropo: 'var(--rc-tropo)',
	tropoText: 'var(--rc-tropo-text)',
	strat: 'var(--rc-strat)',
	stratText: 'var(--rc-strat-text)',
	ref: 'var(--rc-ref)',
	unstable: 'var(--rc-unstable)',
	unstableText: 'var(--rc-unstable-text)',
	ir: 'var(--rc-ir)',
	irText: 'var(--rc-ir-text)',
	down: 'var(--rc-down)',
	downText: 'var(--rc-down-text)',
	sun: 'var(--rc-sun)',
	sunText: 'var(--rc-sun-text)',
	window: 'var(--rc-window)',
	windowText: 'var(--rc-window-text)',
	emission: 'var(--rc-emission)',
	emissionText: 'var(--rc-emission-text)',
	ground: 'var(--rc-ground)',
	sky: 'var(--rc-sky)'
};

export const fmtK = (T: number) => `${T.toFixed(1)} K`;
export const fmtKm = (z: number) => `${z.toFixed(1)} km`;
export const fmtW = (f: number) => `${Math.round(f)} W/m²`;
/** A signed change in kelvin, "+15.6 K" or "−2.5 K". */
export function dK(d: number, digits = 1): string {
	const r = Number(d.toFixed(digits));
	if (r === 0) return `±${(0).toFixed(digits)} K`;
	return r > 0 ? `+${r.toFixed(digits)} K` : `−${(-r).toFixed(digits)} K`;
}
