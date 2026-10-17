/**
 * The run each "run the clock" step shows, from the step's mode and the
 * controls it offers. A control's value is used only on steps that offer it;
 * elsewhere its default applies, so a slider moved on one step does not
 * silently change another step whose panel does not show it.
 */
import type { Params as StageParams, Step } from '#lib/explainer/index.ts';
import { DEFAULTS, future, type Params, type State } from './carbon';

export const HORIZON = 1000;

export const CONTROL_DEFAULTS = {
	burning: 9.8,
	clearing: 1.4,
	years: 50,
	plants: 100,
	mixing: 100
};

interface Setup {
	fossil: number;
	luc: number;
	years: number;
	params: Params;
	/** True when the sinks differ from the default (the faint default run is shown). */
	changedSinks: boolean;
}

export function setup(step: Step, params: StageParams): Setup {
	const offered = new Set((step.controls ?? []).map((c) => c.id));
	const num = (id: keyof typeof CONTROL_DEFAULTS) =>
		offered.has(id) && params[id] !== undefined ? Number(params[id]) : CONTROL_DEFAULTS[id];
	const plants = num('plants') / 100;
	const mixing = num('mixing') / 100;
	return {
		fossil: num('burning'),
		luc: num('clearing'),
		years: num('years'),
		params: {
			...DEFAULTS,
			beta: DEFAULTS.beta * plants,
			mixUpper: DEFAULTS.mixUpper * mixing,
			mixDeep: DEFAULTS.mixDeep * mixing
		},
		changedSinks: plants !== 1 || mixing !== 1
	};
}

export const runOf = (s: Setup): State[] => future(s.fossil, s.luc, s.years, HORIZON, s.params);

let cachedDefault: State[] | null = null;
/** The default run: today's emissions for 50 years, default sinks. */
export function defaultRun(): State[] {
	cachedDefault ??= future(
		CONTROL_DEFAULTS.burning,
		CONTROL_DEFAULTS.clearing,
		CONTROL_DEFAULTS.years,
		HORIZON
	);
	return cachedDefault;
}
