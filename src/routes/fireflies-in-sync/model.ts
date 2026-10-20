/**
 * Fireflies as pulse-coupled clocks, after Mirollo and Strogatz (1990, SIAM J. Appl. Math.
 * 50:1645). Each firefly has a clock whose phase runs evenly from 0 to 1 over its period; at 1 it
 * flashes and starts again from 0. Its "charge" x = f(phase) rises along the concave curve
 * f(p) = ln(1 + (e^b - 1) p) / b. When a firefly sees a neighbour flash, its charge jumps by the
 * coupling (capped at 1, where it flashes at once), so a flash hurries a clock that is nearly
 * due more than one that has just flashed: that curvature is what pulls a swarm into step.
 *
 * Unlike Mirollo and Strogatz, whose proof assumes identical clocks all seeing each other, each
 * firefly here sees only the neighbours within sight, and the periods differ a little; whether the
 * swarm falls into step is then something the simulation shows, not a theorem.
 *
 * The simulation is event-driven: time runs to the exact moment the next clock reaches 1, that
 * flash and any it triggers at the same instant are handled together (a firefly that flashes in
 * a cascade isn't hurried again in it), and then time runs on. So the result does not depend on
 * the frame rate of the drawing.
 */
import { rng } from '#lib/draw/math.ts';

/** Curvature of the charge curve (Mirollo and Strogatz's b; any b > 0 gives a concave rise). */
export const B = 3;
const EB = Math.exp(B) - 1;
export const charge = (p: number) => Math.log(1 + EB * p) / B;
export const phaseOf = (x: number) => (Math.exp(B * x) - 1) / EB;

export interface Swarm {
	x: Float64Array;
	y: Float64Array;
	/** Each clock's phase, 0 to 1. */
	phase: Float64Array;
	/** Each firefly's own period (s). */
	period: Float64Array;
	/** Time of each firefly's last flash (s). */
	last: Float64Array;
	/** Neighbours of each firefly (indices within sight). */
	near: number[][];
	time: number;
}

export const FIELD_W = 900;
export const FIELD_H = 460;
/** How far a firefly can see another flash (field units: 960-wide stage pixels). */
export const SIGHT = 120;

export function swarm(n = 160, seed = 1, spread = 0.02): Swarm {
	const rand = rng(seed);
	const x = Float64Array.from({ length: n }, () => 20 + rand() * (FIELD_W - 40));
	const y = Float64Array.from({ length: n }, () => 20 + rand() * (FIELD_H - 40));
	const phase = Float64Array.from({ length: n }, () => rand());
	// Periods spread around one second (±1% by default).
	const period = Float64Array.from({ length: n }, () => 1 + (rand() - 0.5) * spread);
	const near: number[][] = Array.from({ length: n }, (_, i) => {
		const out: number[] = [];
		for (let j = 0; j < n; j++)
			if (j !== i && (x[i] - x[j]) ** 2 + (y[i] - y[j]) ** 2 < SIGHT * SIGHT) out.push(j);
		return out;
	});
	return { x, y, phase, period, last: new Float64Array(n).fill(-9), near, time: 0 };
}

/** Advances the swarm by `dt` seconds exactly; returns how many flashes happened. */
export function advance(s: Swarm, coupling: number, dt: number): number {
	const n = s.phase.length;
	let left = dt;
	let flashes = 0;
	for (let guard = 0; guard < 100000; guard++) {
		// The next clock to reach 1.
		let wait = Infinity;
		for (let i = 0; i < n; i++) wait = Math.min(wait, (1 - s.phase[i]) * s.period[i]);
		if (wait > left) {
			for (let i = 0; i < n; i++) s.phase[i] += left / s.period[i];
			s.time += left;
			return flashes;
		}
		for (let i = 0; i < n; i++) s.phase[i] += wait / s.period[i];
		s.time += wait;
		left -= wait;
		// The flash, and every flash it triggers at this same instant.
		const fired = new Uint8Array(n);
		const queue: number[] = [];
		for (let i = 0; i < n; i++) if (s.phase[i] >= 1 - 1e-12) queue.push(i);
		while (queue.length) {
			const i = queue.pop()!;
			if (fired[i]) continue;
			fired[i] = 1;
			flashes++;
			s.phase[i] = 0;
			s.last[i] = s.time;
			if (coupling <= 0) continue;
			for (const j of s.near[i]) {
				if (fired[j]) continue;
				const xj = charge(s.phase[j]) + coupling;
				if (xj >= 1) {
					s.phase[j] = 1;
					queue.push(j);
				} else s.phase[j] = phaseOf(xj);
			}
		}
	}
	return flashes;
}

/** Runs the swarm for `seconds`, in steps of `dt` (the result does not depend on dt). */
export function run(s: Swarm, coupling: number, seconds: number, dt = 0.25) {
	const steps = Math.round(seconds / dt);
	for (let k = 0; k < steps; k++) advance(s, coupling, dt);
	return s;
}

/**
 * How in step the swarm is, 0 to 1: the length of the average of all the clock hands, each drawn
 * as an arrow of length 1 at its phase (1 when all point the same way, near 0 when scattered).
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

/** Sets the clocks of every firefly within `radius` of (x, y) to random phases (seeded). */
export function scramble(s: Swarm, x: number, y: number, radius: number, seed: number) {
	const rand = rng(seed);
	for (let i = 0; i < s.phase.length; i++)
		if ((s.x[i] - x) ** 2 + (s.y[i] - y) ** 2 < radius * radius) s.phase[i] = rand();
}

/** Where the scramble button's n-th press lands (a patch that moves with each press). */
export const scrambleSpot = (n: number) => ({
	x: 150 + ((n * 263) % 600),
	y: 80 + ((n * 151) % 300)
});
