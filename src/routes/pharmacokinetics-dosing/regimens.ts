/**
 * The regimens of the narrative's steps: which drug, which doses, and the faint comparison
 * curve, as a pure function of the step's mode and its controls.
 */
import type { ParamValue } from '#lib/explainer/index.ts';
import { DRUGS, type Drug } from './drugs';
import {
	bodyOf,
	halfLifeAt,
	repeated,
	simulate,
	steadyAverage,
	type Body,
	type Dose,
	type Series
} from './model';

export interface Curve {
	body: Body;
	doses: Dose[];
	series: Series;
	/** Short name of the regimen, for the legend. */
	label: string;
}

export interface Plan {
	mode: string;
	drug: Drug;
	span: number;
	main: Curve;
	ghost: Curve | null;
	/** Doses left out (for the dose strip), as times. */
	missed: number[];
	/** Linear half-life of the main curve, h (NaN for a saturable drug). */
	halfLife: number;
	/** Average level at steady state of the main regimen (Infinity: none). */
	plateau: number;
}

const num = (v: ParamValue | undefined, fallback: number) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : fallback;
};
const on = (v: ParamValue | undefined) => v === true || v === 'true';

const curve = (body: Body, doses: Dose[], span: number, label: string): Curve => ({
	body,
	doses,
	series: simulate(body, doses, span, 1200),
	label
});

/** A dose amount as the label writes it: "300 mg", "250 mcg", "600 mg (16.2 mEq)". */
export function amountText(d: Drug, amount: number): string {
	if (d.amountUnit === 'mEq') {
		const mg = Math.round((amount / ((300 / 73.89) * 2)) * 300);
		return `${mg.toLocaleString('en-US')} mg (${amount.toFixed(1)} mEq)`;
	}
	return `${Math.round(amount).toLocaleString('en-US')} ${d.amountUnit}`;
}

export function planFor(mode: string, params: Record<string, ParamValue>): Plan {
	switch (mode) {
		case 'tablet': {
			const d = DRUGS.theophylline;
			const span = 24;
			const body = bodyOf(d, { ka: num(params.ka2, 2) });
			const main = curve(body, [{ t: 0, form: 'tablet', amount: 300 }], span, '300 mg tablet');
			const ghost = curve(
				bodyOf(d),
				[{ t: 0, form: 'injection', amount: 300 }],
				span,
				'300 mg injected'
			);
			return plan(mode, d, span, main, ghost);
		}
		case 'repeat': {
			const d = DRUGS.theophylline;
			const span = 72;
			const tau = num(params.tau3, 8);
			const miss = on(params.miss3);
			const all = repeated({ amount: 300, interval: tau, form: 'tablet', until: span });
			// the dose missed: the first one due after hour 30
			const skip = all.findIndex((d) => d.t > 30);
			const doses = miss ? all.filter((_, i) => i !== skip) : all;
			const main = curve(bodyOf(d), doses, span, `300 mg every ${tau} h`);
			return {
				...plan(mode, d, span, main, null),
				missed: miss && skip >= 0 ? [all[skip].t] : [],
				plateau: steadyAverage(main.body, 300, tau, 'tablet')
			};
		}
		case 'drip': {
			const d = DRUGS.theophylline;
			const span = 72;
			const rate = num(params.rate4, 28);
			const load = on(params.load4);
			const drip: Dose = { t: 0, form: 'drip', amount: rate, duration: span + 1 };
			const doses: Dose[] = load
				? [{ t: 0, form: 'injection', amount: 320, duration: 0.5 }, drip]
				: [drip];
			const main = curve(bodyOf(d), doses, span, `${rate} mg/h drip`);
			const ghost = load ? curve(bodyOf(d), [drip], span, 'drip alone') : null;
			return {
				...plan(mode, d, span, main, ghost),
				plateau: steadyAverage(main.body, rate, 1, 'drip')
			};
		}
		case 'double': {
			const d = DRUGS.digoxin;
			const span = d.span;
			const dbl = on(params.dbl5);
			const reg = (amount: number) =>
				repeated({ amount, interval: 24, form: 'tablet', until: span });
			const base = curve(bodyOf(d), reg(250), span, '250 mcg a day');
			if (!dbl)
				return {
					...plan(mode, d, span, base, null),
					plateau: steadyAverage(base.body, 250, 24, 'tablet')
				};
			const main = curve(bodyOf(d), reg(500), span, '500 mcg a day');
			return {
				...plan(mode, d, span, main, base),
				plateau: steadyAverage(main.body, 500, 24, 'tablet')
			};
		}
		case 'loading': {
			const d = DRUGS.digoxin;
			const span = d.span;
			const load = on(params.load6);
			const plain = repeated({ amount: 250, interval: 24, form: 'tablet', until: span });
			const base = curve(bodyOf(d), plain, span, '250 mcg a day');
			const p = { plateau: steadyAverage(base.body, 250, 24, 'tablet') };
			if (!load) return { ...plan(mode, d, span, base, null), ...p };
			const loaded: Dose[] = [{ t: 0, form: 'tablet', amount: 750 }, ...plain.slice(1)];
			const main = curve(bodyOf(d), loaded, span, '750 mcg, then 250 a day');
			return { ...plan(mode, d, span, main, base), ...p };
		}
		case 'kidney': {
			const d = DRUGS.lithium;
			const span = d.span;
			const k = num(params.kid7, 1);
			const doses = repeated({ amount: d.dose, interval: 12, form: 'tablet', until: span });
			const main = curve(bodyOf(d, { clearance: k }), doses, span, 'this kidney');
			const ghost = k < 1 ? curve(bodyOf(d), doses, span, 'normal kidneys') : null;
			return {
				...plan(mode, d, span, main, ghost),
				plateau: steadyAverage(main.body, d.dose, 12, 'tablet')
			};
		}
		case 'saturable': {
			const d = DRUGS.phenytoin;
			const span = d.span;
			const daily = num(params.dose9, 300);
			const sat = params.sat9 === undefined ? true : on(params.sat9);
			const doses = repeated({ amount: daily / 3, interval: 8, form: 'tablet', until: span });
			const main = curve(sat ? bodyOf(d) : linearTwin(d), doses, span, `${daily} mg a day`);
			return {
				...plan(mode, d, span, main, null),
				halfLife: sat ? NaN : halfLifeAt(main.body),
				plateau: steadyAverage(main.body, daily, 24, 'tablet')
			};
		}
		default: {
			// 'single': one injection
			const d = DRUGS.theophylline;
			const span = 48;
			const body = bodyOf(d, { clearance: num(params.cl1, 1), volume: num(params.v1, 1) });
			const main = curve(body, [{ t: 0, form: 'injection', amount: 320 }], span, '320 mg injected');
			return plan('single', d, span, main, null);
		}
	}
}

/**
 * The linear drug the saturable one is compared with: a constant clearance that gives the same
 * steady state at 300 mg a day.
 */
export function linearTwin(d: Drug): Body {
	const b = bodyOf(d, { saturable: false });
	if (!d.saturable) return b;
	const R = (d.F * 300) / 24;
	return { ...b, CL: (d.saturable.Vmax - R) / d.saturable.Km };
}

function plan(mode: string, drug: Drug, span: number, main: Curve, ghost: Curve | null): Plan {
	return {
		mode,
		drug,
		span,
		main,
		ghost,
		missed: [],
		halfLife: main.body.saturable ? NaN : halfLifeAt(main.body),
		plateau: NaN
	};
}
