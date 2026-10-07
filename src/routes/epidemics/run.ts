/**
 * Shared set-up for the scenes that run the crowd model: the crowd's size and
 * the parameters a step actually offers.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { Crowd } from './model';

export const POPULATION = 300;
/** Side of the square field the crowd wanders over, in stage units. */
export const FIELD = 440;
/** Walking speed in stage units per simulated day (only drawn). */
export const WALK = 5;
/** Simulated days after which a run is cut off (no run lasts nearly this long). */
const MAX_DAYS = 3000;

export const DEFAULTS = { r0: 3, days: 7, vaccinated: 0 };

/**
 * The model parameters on a step. A control's value is used only on steps
 * that offer that control; elsewhere the default applies, so a slider moved on
 * one step does not silently change another step whose panel does not show it.
 */
export function settings(step: Step, params: Params) {
	const offered = new Set((step.controls ?? []).map((c) => c.id));
	const pick = (id: keyof typeof DEFAULTS, scale = 1) =>
		offered.has(id) ? Number(params[id]) / scale : DEFAULTS[id];
	return {
		r0: pick('r0'),
		days: pick('days'),
		vaccinated: offered.has('vaccinated') ? Number(params.vaccinated) / 100 : 0,
		rerun: offered.has('rerun') ? Number(params.rerun ?? 0) : 0
	};
}

/** Runs a crowd to the end. A full run of 300 people takes a few milliseconds. */
export function runCrowd(o: {
	r0: number;
	days: number;
	vaccinated: number;
	initial: number;
	seed: number;
}) {
	const crowd = new Crowd({
		...o,
		population: POPULATION,
		size: FIELD,
		speed: WALK
	});
	crowd.advanceTo(MAX_DAYS);
	return crowd;
}

/** Day the run ended (the last infectious person recovered). */
export const endDay = (crowd: Crowd) => crowd.history[crowd.history.length - 1].day;
