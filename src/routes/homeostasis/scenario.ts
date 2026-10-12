/**
 * Which scenario the plot shows on each step, from the step's `case` hint and
 * the controls it offers. A control's value is used only on steps that offer
 * it; elsewhere its default applies, so a slider moved on one step does not
 * silently change another step whose panel does not show it.
 */
import type { Params, Step } from '#lib/explainer/index.ts';
import { HEALTHY, basalFor, simulate, type Sample, type Scenario } from './model';

/** The window the charts show, in minutes from the meal. */
export const FROM = -30;
export const TO = 360;
/** Length of a run, in minutes. */
export const RUN_FOR = 45;

export const INTENSITY: Record<string, number> = { none: 0, easy: 40, run: 65 };

const DEFAULTS = {
	carbs: 75,
	exercise: 'run',
	runAt: 30,
	production: 100,
	sensitivity: 100,
	dose: 0,
	doseAt: -15
};

/** Background insulin that holds a body without insulin of its own at 100 mg/dL. */
export const BASAL = basalFor(100);

export type Case = 'meal' | 'run' | 'type1' | 'type2' | 'dosing';

export interface Setup {
	kind: Case;
	scenario: Scenario;
	/** The faint comparison curve: the same day without the step's change. */
	ghost: Scenario;
	ghostLabel: string;
}

export function setup(step: Step, params: Params): Setup {
	const offered = new Set((step.controls ?? []).map((c) => c.id));
	const num = (id: keyof typeof DEFAULTS) =>
		offered.has(id) ? Number(params[id]) : Number(DEFAULTS[id]);
	const exercise = offered.has('exercise') ? String(params.exercise) : 'none';
	const kind = String(step.hints?.case ?? 'meal') as Case;
	const meal: Scenario = { ...HEALTHY, carbs: num('carbs'), mealAt: 0 };
	const run = {
		intensity: INTENSITY[exercise] ?? 0,
		runAt: num('runAt'),
		runFor: RUN_FOR
	};
	switch (kind) {
		case 'run':
			return {
				kind,
				scenario: { ...meal, ...run },
				ghost: meal,
				ghostLabel: 'no exercise'
			};
		case 'type1':
		case 'type2':
			return {
				kind,
				scenario: {
					...meal,
					production: num('production') / 100,
					sensitivity: num('sensitivity') / 100
				},
				ghost: meal,
				ghostLabel: 'healthy'
			};
		case 'dosing': {
			const running = offered.has('dosingRun') && Boolean(params.dosingRun);
			const dosingRun = { intensity: running ? INTENSITY.run : 0, runAt: 30, runFor: RUN_FOR };
			return {
				kind,
				scenario: {
					...meal,
					...dosingRun,
					production: 0,
					basal: BASAL,
					dose: num('dose'),
					doseAt: num('doseAt')
				},
				ghost: { ...meal, ...dosingRun },
				ghostLabel: 'healthy'
			};
		}
		default:
			return { kind: 'meal', scenario: meal, ghost: meal, ghostLabel: '' };
	}
}

export const run = (sc: Scenario): Sample[] => simulate(sc, FROM, TO);
