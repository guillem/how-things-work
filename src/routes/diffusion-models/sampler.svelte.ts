/**
 * The 2-D model's sampling runs, computed in a Web Worker (./sampler.worker.ts) and kept here,
 * reactively, so the scenes can show progress and then replay a finished run as a pure function
 * of the animation time. Scenes call `request` from an `$effect` and read `runs[key]` in a
 * `$derived` (requesting from a `$derived` would change state while rendering).
 */
import { schedule } from './ddpm';

export const POINTS = 400;

export interface Job {
	key: string;
	steps: number;
	seed: number;
	label: number | null;
	guidance: number;
	count: number;
}
export interface JobReply {
	key: string;
	done: number;
	frames?: Float32Array;
}
export interface Run {
	steps: number;
	/** steps computed so far */
	done: number;
	/** the timestep reached after each step: ts[k] after k steps (ts[0] = T) */
	ts: number[];
	/** (steps + 1) × POINTS × 2 numbers once finished */
	frames: Float32Array | null;
}

export const runKey = (steps: number, seed: number, label: number | null, guidance: number) =>
	`${steps}|${seed}|${label ?? 'none'}|${label === null ? 0 : guidance}`;

export const runs: Record<string, Run> = $state({});
const order: string[] = [];
let worker: Worker | null = null;

export function request(steps: number, seed: number, label: number | null, guidance: number) {
	const key = runKey(steps, seed, label, guidance);
	if (runs[key]) return;
	const sched = schedule(steps);
	runs[key] = { steps, done: 0, ts: [...sched, 0], frames: null };
	order.push(key);
	// keep the last 8 runs (a 1000-step run is 3 MB)
	while (order.length > 8) delete runs[order.shift() as string];
	if (!worker) {
		worker = new Worker(new URL('./sampler.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<JobReply>) => {
			const r = runs[e.data.key];
			if (!r) return;
			r.done = e.data.done;
			if (e.data.frames) r.frames = e.data.frames;
		};
	}
	worker.postMessage({
		key,
		steps,
		seed,
		label,
		guidance: label === null ? 0 : guidance,
		count: POINTS
	} satisfies Job);
}
