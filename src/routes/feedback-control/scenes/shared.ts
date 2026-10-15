/** Helpers shared by the feedback-control scenes. */
import type { Road } from '../control';
import { grade } from '../control';

export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
}

/**
 * The clock of a precomputed run: seconds since its settings last changed. A change
 * restarts the run (as in oscillations-resonance/DrivenScene: the guide's sanctioned
 * memo), and so does stepping back in time.
 */
export function restartClock() {
	let memo = { key: '', start: 0 };
	return (key: string, t: number) => {
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	};
}

/** Road heights (m) every 2 m from 0 to 5 km, integrated from the grade. */
const STEP = 2;
const profiles = new Map<Road, Float64Array>();
export function heightAt(road: Road, x: number) {
	let p = profiles.get(road);
	if (!p) {
		p = new Float64Array(2501);
		for (let i = 1; i < p.length; i++)
			p[i] = p[i - 1] + (STEP * (grade(road, (i - 1) * STEP) + grade(road, i * STEP))) / 2;
		profiles.set(road, p);
	}
	if (x <= 0) return 0;
	const f = Math.min(p.length - 1.001, x / STEP);
	const i = Math.floor(f);
	return p[i] + (p[i + 1] - p[i]) * (f - i);
}

/** SVG path through sampled values (index → time), mapped by the scales, every `stride` samples. */
export function seriesPath(
	values: Float64Array,
	sample: number,
	sx: (t: number) => number,
	sy: (v: number) => number,
	stride = 3,
	clampLo = -Infinity,
	clampHi = Infinity
) {
	let d = '';
	for (let i = 0; i < values.length; i += stride) {
		const v = Math.min(clampHi, Math.max(clampLo, values[i]));
		d += `${i ? 'L' : 'M'}${sx(i * sample).toFixed(1)} ${sy(v).toFixed(1)}`;
	}
	return d;
}
