/**
 * Fireflies as pulse-coupled clocks (the model of Mirollo and Strogatz, 1990, with neighbours
 * instead of everyone; Nicky Case's "Fireflies" uses the same idea). Each firefly has an inner
 * clock that runs from 0 to 1 in about a second; at 1 it flashes and starts again from 0. When a
 * firefly sees a neighbour flash, its own clock jumps forward by the nudge; if that takes it past
 * 1, it flashes at once. There is no leader and nothing from outside: every firefly follows the
 * same rule.
 */
import { rng } from '#lib/draw/math.ts';

export interface Swarm {
	x: Float64Array;
	y: Float64Array;
	/** Each clock's reading, 0 to 1. */
	phase: Float64Array;
	/** Each firefly's own period (s): about a second, a little different for each. */
	period: Float64Array;
	/** Seconds since each firefly last flashed (for drawing the glow). */
	since: Float64Array;
	/** Neighbours of each firefly (indices within seeing distance). */
	near: number[][];
	time: number;
}

export const FIELD_W = 900;
export const FIELD_H = 460;
/** How far a firefly can see another flash (in the field's units, which are 960-wide stage pixels). */
export const SIGHT = 120;
export const DT = 1 / 60;

export function swarm(n = 160, seed = 1): Swarm {
	const rand = rng(seed);
	const x = Float64Array.from({ length: n }, () => 20 + rand() * (FIELD_W - 40));
	const y = Float64Array.from({ length: n }, () => 20 + rand() * (FIELD_H - 40));
	const phase = Float64Array.from({ length: n }, () => rand());
	// Periods spread ±3% around one second.
	const period = Float64Array.from({ length: n }, () => 1 + (rand() - 0.5) * 0.06);
	const near: number[][] = Array.from({ length: n }, (_, i) => {
		const out: number[] = [];
		for (let j = 0; j < n; j++)
			if (j !== i && (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2 < SIGHT * SIGHT) out.push(j);
		return out;
	});
	return { x, y, phase, period, since: new Float64Array(n).fill(9), near, time: 0 };
}

/**
 * Advances the swarm by one time step. Flashes spread within the step: a nudged clock that passes
 * 1 flashes too, and its flash nudges its own neighbours; but each firefly flashes at most once
 * per step, and a firefly that has just flashed ignores flashes in the same step.
 */
export function tick(s: Swarm, nudge: number) {
	const n = s.phase.length;
	const flashed = new Uint8Array(n);
	const queue: number[] = [];
	for (let i = 0; i < n; i++) {
		s.phase[i] += DT / s.period[i];
		s.since[i] += DT;
		if (s.phase[i] >= 1) queue.push(i);
	}
	while (queue.length) {
		const i = queue.pop()!;
		if (flashed[i]) continue;
		flashed[i] = 1;
		s.phase[i] = 0;
		s.since[i] = 0;
		if (nudge <= 0) continue;
		for (const j of s.near[i]) {
			if (flashed[j]) continue;
			s.phase[j] += nudge;
			if (s.phase[j] >= 1) queue.push(j);
		}
	}
	s.time += DT;
	return flashed;
}

/** Runs the swarm for `seconds`. */
export function run(s: Swarm, nudge: number, seconds: number) {
	const steps = Math.round(seconds / DT);
	for (let k = 0; k < steps; k++) tick(s, nudge);
	return s;
}

/**
 * How in step the swarm is, 0 to 1: the length of the average of all the clock hands, each drawn
 * as an arrow of length 1 at its reading (1 when all point the same way, near 0 when scattered).
 */
export function inStep(s: Swarm) {
	let cx = 0;
	let cy = 0;
	for (const p of s.phase) {
		cx += Math.cos(2 * Math.PI * p);
		cy += Math.sin(2 * Math.PI * p);
	}
	return Math.hypot(cx, cy) / s.phase.length;
}

/** Sets the clocks of every firefly within `radius` of (x, y) to random readings (seeded). */
export function scramble(s: Swarm, x: number, y: number, radius: number, seed: number) {
	const rand = rng(seed);
	for (let i = 0; i < s.phase.length; i++)
		if ((s.x[i] - x) ** 2 + (s.y[i] - y) ** 2 < radius * radius) s.phase[i] = rand();
}
