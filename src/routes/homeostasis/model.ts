/**
 * The glucose–insulin–glucagon model behind the explainer: one virtual adult
 * (70 kg) over a few hours, minute by minute.
 *
 * It is assembled from published models, each used for the part it was built
 * and checked for. Every constant below names its source. Where no published
 * value exists, the constant is marked ILLUSTRATIVE and the page says so.
 *
 * 1. Glucose and insulin: the model of Topp, Promislow, De Vries, Miura &
 *    Finegood, "A model of β-cell mass, insulin, and glucose kinetics:
 *    pathways to diabetes", J. Theor. Biol. 206:605–619 (2000), itself built
 *    on Bergman's minimal model:
 *
 *      dG/dt = R0 − (EG0 + SI·I)·G         glucose: the liver's net output
 *                                          minus uptake that needs no insulin
 *                                          (EG0) and uptake that insulin drives
 *      dI/dt = β·σ·G²/(α + G²) − k·I       insulin: secretion by the β-cells,
 *                                          rising steeply with glucose, minus
 *                                          clearance
 *
 *    Fasting glucose is not fixed in this model: it is wherever production
 *    and uptake balance, so it rises when insulin is missing. (The deviation
 *    form of Bergman's minimal model pulls glucose back to a fixed basal value
 *    even with no insulin at all, so it cannot show diabetes.)
 *    Parameter values: Topp et al.'s table, as restated by the CellML
 *    encoding of the model (Physiome Model Repository: SI, EG0, σ, k) and by
 *    the appendix of arXiv:2006.06435 (R0, α, σ, k). The two restatements
 *    disagree on some values (CellML: R0 = 846, α = 2000; arXiv: EG0 = 0.44);
 *    the values used here are the ones that reproduce the normal fasting
 *    state Topp et al. describe (glucose 100 mg/dL, insulin 10 µU/mL), which
 *    the model test checks.
 *
 *    Topp's insulin term SI·I·G is lumped, as in Bergman's minimal model: it
 *    stands both for insulin pushing glucose into cells and for insulin
 *    holding back the liver's output, which insulin suppresses directly and
 *    within minutes (Edgerton et al., JCI Insight 2:e91863, 2017). The model's
 *    glucose balance keeps that lumped term; only for the flows the page shows
 *    is it split between the liver and the cells (see HEPATIC_SHARE). R0 is
 *    the liver's output before insulin's brake.
 *
 *    Three changes, all stated on the page:
 *    - The β-cells respond more steeply to glucose than in Topp's model,
 *      calibrated so that a healthy adult handles a meal normally (see
 *      HILL_N).
 *    - Insulin acts after a delay. As in Bergman's minimal model, glucose
 *      responds to insulin in a "remote" compartment that follows plasma
 *      insulin with rate p2 (Bergman, Phillips & Cobelli, J. Clin. Invest.
 *      68:1456, 1981; value from Roy & Parker 2006, Table 1).
 *    - Plasma insulin is cleared at Hovorka's ke = 0.138/min instead of
 *      Topp's 0.3/min, so that injected doses act for as long as real
 *      rapid-acting insulin; the secretion rate is scaled by the same factor,
 *      which keeps Topp's normal fasting state unchanged.
 *
 * 2. Meals and injected insulin: the absorption sub-models of Hovorka et al.,
 *    "Nonlinear model predictive control of glucose concentration in subjects
 *    with type 1 diabetes", Physiol. Meas. 25:905–920 (2004): two
 *    compartments in series for carbohydrate from the gut and for
 *    rapid-acting insulin under the skin, and the kidneys' loss of glucose
 *    into urine above 9 mmol/L. Values from Table 1 of that paper, as
 *    restated by Boiroux et al. (DYCOPS 2010) and Amjad et al. (DYCOPS 2013).
 *
 * 3. Exercise: Roy & Parker, "Dynamic modeling of exercise effects on plasma
 *    glucose and insulin levels", ADCHEM 2006, pp. 509–514: exercise
 *    intensity as a percentage of the maximal oxygen uptake (eq. 4) and the
 *    extra clearance of insulin during exercise (eq. 10), which they fitted to
 *    measured insulin in healthy exercising volunteers. In healthy people
 *    that fall is mostly the pancreas secreting less, so it is applied only
 *    to the body's own insulin: injected insulin cannot be switched off.
 *    The extra glucose taken up by working muscle is ILLUSTRATIVE in size
 *    (see EXERCISE_UPTAKE).
 *
 * 4. Glucagon: a simplified term, ILLUSTRATIVE in strength, built on three
 *    well-established observations:
 *    - insulin from neighbouring β-cells holds glucagon down, so it falls
 *      after a meal (Unger & Cherrington, J. Clin. Invest. 122:4, 2012);
 *    - it rises when glucose falls below about 68 mg/dL (3.8 mmol/L), the
 *      threshold for counter-regulation (Schwartz et al., J. Clin. Invest.
 *      79:777, 1987), and it rises during exercise;
 *    - in type 1 diabetes the glucagon response to low glucose is lost
 *      (Gerich et al., Science 182:171, 1973). The model removes it in
 *      proportion to the lost insulin production. The rise during exercise
 *      is kept: the α-cells' defect is specific to the stimulus, and their
 *      glucagon release during exercise is preserved in type 1 diabetes
 *      (Bao, Briscoe, Tate & Davis, Diabetes 58:2100, 2009).
 *    Glucagon makes the liver release more glucose (it scales R0).
 *
 * Simplifications, stated on the page: one average adult; a meal is only its
 * carbohydrate (fat and protein, which slow absorption, are left out); no
 * stress hormones (adrenaline, cortisol, growth hormone), no glycogen
 * running out on long runs, and none of the long-term changes of diabetes
 * (in Topp's full model the β-cell mass itself changes over months).
 *
 * Units: time in minutes, glucose in mg/dL (÷ 18 for mmol/L), insulin in
 * µU/mL (= mU/L), glucagon relative to its normal fasting level.
 */

// ---------------------------------------------------------------- constants

/** Minutes per day, to convert Topp et al.'s per-day rates. */
const DAY = 1440;

/** Net glucose production at zero glucose, mg/dL per minute (Topp: 864 mg/dL/day). */
const R0 = 864 / DAY;
/** Glucose uptake that needs no insulin, per minute (Topp: EG0 = 1.44 /day). */
const EG0 = 1.44 / DAY;
/** Insulin sensitivity, mL/µU per minute (Topp: SI = 0.72 mL/µU/day). */
const SI = 0.72 / DAY;
/** Topp's normal fasting state: glucose 100 mg/dL, insulin 10 µU/mL (R0 / (EG0 + SI·10) = 100). */
const FASTING_GLUCOSE = 100;
const FASTING_INSULIN = 10;

/** Plasma insulin clearance, per minute (Hovorka 2004: ke = 0.138 /min; Topp: k = 432 /day = 0.3 /min). */
const KE = 0.138;

/**
 * The β-cells' response to glucose: a Hill function, as in Topp et al.
 * (secretion ∝ Gⁿ / (Kⁿ + Gⁿ)), scaled so that the normal fasting state is
 * Topp's (insulin 10 µU/mL at 100 mg/dL). CALIBRATED, not published: Topp's
 * own response (n = 2, K = √α = 141 mg/dL with α = 20 000 mg²/dL²) was built
 * for changes over months, and in a meal it lets glucose stay above 250
 * mg/dL for an hour and a half, and leaves it near 270 at two hours. The steeper response used here makes the healthy
 * virtual adult pass a 75 g glucose tolerance test, with a 2-hour value below
 * the ADA's 140 mg/dL and insulin rising several-fold, as it does in people
 * with normal glucose tolerance; the model test checks both. Even so, insulin acts more slowly here than
 * in real people: a healthy adult's glucose peaks near 190 mg/dL, higher and
 * later than usual (the page says so).
 */
const HILL_N = 5;
const HILL_K = 200;
const hill = (g: number) =>
	Math.max(0, g) ** HILL_N / (HILL_K ** HILL_N + Math.max(0, g) ** HILL_N);
/** Maximal insulin secretion, µU/mL per minute. */
const SECRETION_MAX = (KE * FASTING_INSULIN) / hill(FASTING_GLUCOSE);

/** Rate at which insulin action follows plasma insulin, per minute (Roy & Parker 2006, Table 1: p2 = 0.037). */
const P2 = 0.037;

/** Body weight of the virtual adult, kg (the usual reference adult of Hovorka et al.). */
const BODY_WEIGHT = 70;
/** Glucose distribution volume, dL (Hovorka 2004: 0.16 L/kg). */
const VG = 0.16 * BODY_WEIGHT * 10;
/** Insulin distribution volume, mL (Hovorka 2004: 0.12 L/kg). */
const VI = 0.12 * BODY_WEIGHT * 1000;
/** Share of a meal's carbohydrate that reaches the blood (Hovorka 2004: AG = 0.8). */
const AG = 0.8;
/** Time to peak absorption of a meal, min (Hovorka 2004: tmax,G = 40). */
const TMAX_G = 40;
/** Time to peak absorption of rapid-acting insulin injected under the skin, min (Hovorka 2004: tmax,I = 55). */
const TMAX_I = 55;
/** Kidney threshold above which glucose spills into urine, mg/dL (Hovorka 2004: 9 mmol/L). */
const RENAL_THRESHOLD = 9 * 18;
/** Renal glucose clearance above the threshold, per minute (Hovorka 2004: 0.003 /min). */
const RENAL_RATE = 0.003;

/** Resting exercise level, % of maximal oxygen uptake (Roy & Parker 2006, citing Felig & Wahren 1975). */
const REST_INTENSITY = 8;
/** Rate at which the body reaches the exercise intensity, per minute (Roy & Parker 2006, eq. 4). */
const INTENSITY_RATE = 0.8;
/** Exercise-induced insulin clearance, µU/mL/min² per % (Roy & Parker 2006, eq. 10 and Table 2: a6). */
const A6 = 0.00025;
/** Decay of the exercise-induced insulin clearance, per minute (Roy & Parker 2006, Table 2: a7). */
const A7 = 0.009;
/**
 * ILLUSTRATIVE. Extra glucose taken up by working muscle without insulin,
 * mg/dL per minute per % of maximal oxygen uptake above rest (at 100 mg/dL;
 * it scales with glucose). Set to half the rise in the liver's glucose output
 * that Roy & Parker fitted to healthy volunteers (a1/a2 = 0.011/0.9); the
 * other half of the extra uptake comes from insulin working harder during
 * exercise (EXERCISE_SENSITIVITY). With both, a healthy adult's glucose dips
 * a little but stays in the normal range during a 45-minute run, as measured
 * (Ahlborg et al. 1974: nearly level for the first 40 minutes).
 */
const EXERCISE_UPTAKE = 0.5 * (0.011 / 0.9);

/** Glucose below which glucagon rises: the counter-regulation threshold, mg/dL (Schwartz et al. 1987: 3.8 mmol/L). */
const GLUCAGON_THRESHOLD = 68;
/** Time constant with which glucagon follows its target, min (plasma half-life of a few minutes). */
const GLUCAGON_TAU = 5;
/** ILLUSTRATIVE. Liver output rises by this share of each step of glucagon above fasting. */
const GLUCAGON_EFFECT = 0.5;
/** ILLUSTRATIVE. Glucagon at 50 mg/dL, relative to fasting, with a working counter-regulation. */
const GLUCAGON_HYPO = 3;
/** ILLUSTRATIVE. Lowest glucagon relative to fasting when insulin secretion is high (after a meal). */
const GLUCAGON_FLOOR = 0.5;
/** ILLUSTRATIVE. Extra glucagon during a run at 65 % of maximal oxygen uptake. */
const GLUCAGON_EXERCISE = 1;
/**
 * ILLUSTRATIVE. Exercise makes insulin work harder on muscle (Wolfe et al.
 * 1986; Wasserman et al. 1989, cited by Roy & Parker): insulin sensitivity is
 * multiplied by 1 + this at 65 % of maximal oxygen uptake.
 */
const EXERCISE_SENSITIVITY = 1;

/**
 * ILLUSTRATIVE. The share of Topp's lumped insulin term (SI·I·G, taken at
 * the fasting glucose of 100 mg/dL) shown as insulin holding back the liver's
 * output rather than as glucose going into cells: at the fasting insulin it
 * holds back 0.25 of the liver's 0.6 mg/dL per minute. It changes only how the page splits the flows, never the glucose
 * balance: what the liver no longer releases is subtracted from the liver's
 * flow and from the flow into cells alike. Once insulin holds the liver's
 * output at zero, the rest of the term counts as uptake (the liver itself
 * then stores glucose).
 */
const HEPATIC_SHARE = 0.5;

/** Clinical thresholds, mg/dL (American Diabetes Association, Standards of Care). */
export const THRESHOLDS = {
	/** Hypoglycaemia level 1 (alert value): below 70 mg/dL (3.9 mmol/L), down to 54. */
	hypo: 70,
	/**
	 * Hypoglycaemia level 2 (clinically significant): below 54 mg/dL (3.0 mmol/L).
	 * (Level 3, severe, is defined by needing someone else's help, not by a value.)
	 */
	hypoLevel2: 54,
	/** Normal fasting glucose: below 100 mg/dL (5.6 mmol/L); 100–125 is prediabetes. */
	fastingNormal: 100,
	/** Diabetes range: fasting glucose 126 mg/dL (7.0 mmol/L) or more (confirmed by a repeat test). */
	fastingDiabetes: 126,
	/** Normal 2-hour value of a 75 g oral glucose tolerance test: below 140 mg/dL (7.8 mmol/L). */
	twoHourNormal: 140,
	/** Diabetes: 2-hour value of 200 mg/dL (11.1 mmol/L) or more. */
	twoHourDiabetes: 200
} as const;

export const MMOL_PER_MGDL = 1 / 18;

// ---------------------------------------------------------------- the model

export interface Scenario {
	/** Insulin production, as a share of normal (0 = none, as in type 1 diabetes; up to 2). */
	production: number;
	/** Insulin sensitivity, as a share of normal (insulin resistance below 1). */
	sensitivity: number;
	/** Carbohydrate in the meal, g (0 = no meal). */
	carbs: number;
	/** Minute of the meal. */
	mealAt: number;
	/** Exercise intensity, % of maximal oxygen uptake (0 or REST_INTENSITY = none). */
	intensity: number;
	/** Minute the run starts. */
	runAt: number;
	/** Length of the run, min. */
	runFor: number;
	/**
	 * Background insulin, µU/mL per minute delivered to the blood, standing
	 * for long-acting insulin with a flat profile (0 = none).
	 */
	basal: number;
	/** Rapid-acting insulin injected under the skin, units (0 = none). */
	dose: number;
	/** Minute of the injection. */
	doseAt: number;
}

export const HEALTHY: Scenario = {
	production: 1,
	sensitivity: 1,
	carbs: 0,
	mealAt: 0,
	intensity: 0,
	runAt: 60,
	runFor: 45,
	basal: 0,
	dose: 0,
	doseAt: 0
};

export interface Sample {
	/** Minute. */
	t: number;
	/** Blood glucose, mg/dL. */
	g: number;
	/** Plasma insulin, µU/mL. */
	i: number;
	/** Glucagon, relative to normal fasting. */
	gcg: number;
	/** Glucose arriving from the gut, mg/dL per minute. */
	gut: number;
	/**
	 * Glucose released by the liver, mg/dL per minute: its output, raised by
	 * glucagon, minus what insulin holds back (see HEPATIC_SHARE).
	 */
	liver: number;
	/** Glucose taken up by the body's cells (the liver's own storage included), mg/dL per minute. */
	uptake: number;
	/** Glucose lost in urine, mg/dL per minute. */
	urine: number;
	/** Exercise intensity, % of maximal oxygen uptake. */
	effort: number;
}

/** Exercise above rest, as a share of a run at 65 % of maximal oxygen uptake. */
const exertion = (p: number) => Math.max(0, p - REST_INTENSITY) / (65 - REST_INTENSITY);

/** Insulin secretion, µU/mL per minute, at glucose `g` (see HILL_N). */
function secretion(g: number, production: number) {
	return production * SECRETION_MAX * hill(g);
}

/** Normal fasting secretion, the reference for the glucagon brake. */
const SECRETION_FASTING = secretion(FASTING_GLUCOSE, 1);

/** Glucagon level the islets aim for, relative to normal fasting. */
function glucagonTarget(g: number, sec: number, production: number, effort: number) {
	// Insulin from neighbouring β-cells brakes glucagon: halved once secretion
	// is three times its fasting rate.
	const brake = (1 - GLUCAGON_FLOOR) * Math.min(1, Math.max(0, (sec / SECRETION_FASTING - 1) / 2));
	// Below the threshold, glucagon climbs to GLUCAGON_HYPO at 50 mg/dL (and
	// on, up to twice that rise), but only with working counter-regulation.
	const counter = Math.min(1, production);
	const low = Math.min(1.5, Math.max(0, (GLUCAGON_THRESHOLD - g) / (GLUCAGON_THRESHOLD - 50)));
	const hypo = counter * (GLUCAGON_HYPO - 1) * low;
	// The rise during exercise survives in type 1 diabetes (Bao et al. 2009).
	const run = GLUCAGON_EXERCISE * exertion(effort);
	return Math.max(0, 1 - brake + hypo + run);
}

interface State {
	g: number;
	i: number;
	/** Insulin in the remote compartment where it acts, µU/mL. */
	x: number;
	gcg: number;
	/** Carbohydrate in the two gut compartments, mg of glucose. */
	d1: number;
	d2: number;
	/** Injected insulin in the two compartments under the skin, µU. */
	s1: number;
	s2: number;
	/** Exercise intensity, %. */
	p: number;
	/** Exercise-induced insulin clearance, µU/mL per minute. */
	ie: number;
}

function rates(s: State, sc: Scenario, t: number) {
	const sec = secretion(s.g, sc.production);
	const effortTarget =
		sc.intensity > REST_INTENSITY && t >= sc.runAt && t < sc.runAt + sc.runFor
			? sc.intensity
			: REST_INTENSITY;
	const release = R0 * (1 + GLUCAGON_EFFECT * (s.gcg - 1));
	const gut = s.d2 / TMAX_G / VG;
	const urine = RENAL_RATE * Math.max(0, s.g - RENAL_THRESHOLD);
	const exercise = EXERCISE_UPTAKE * Math.max(0, s.p - REST_INTENSITY) * (s.g / 100);
	const boost = 1 + EXERCISE_SENSITIVITY * exertion(s.p);
	const uptake = (EG0 + SI * sc.sensitivity * boost * s.x) * s.g + exercise;
	// The part of the insulin term shown as the liver held back (display only:
	// liver − uptake, and so the glucose balance, is unchanged). It is taken at
	// the fasting glucose, so that it follows insulin, not glucose, and it is
	// never more than the insulin-driven uptake it comes out of.
	const insulinDriven = SI * sc.sensitivity * boost * Math.max(0, s.x) * s.g;
	const heldBack = Math.min(
		release,
		insulinDriven,
		HEPATIC_SHARE * SI * sc.sensitivity * Math.max(0, s.x) * FASTING_GLUCOSE
	);
	const injected = s.s2 / TMAX_I / VI;
	// The exercise cut stands for the pancreas secreting less, so it can
	// remove at most what the pancreas is secreting.
	const cut = Math.min(sec, Math.min(1, sc.production) * s.ie);
	const di = sec - cut + sc.basal + injected - KE * s.i;
	return {
		sample: { liver: release - heldBack, gut, urine, uptake: uptake - heldBack },
		d: {
			g: release + gut - uptake - urine,
			i: s.i <= 0 && di < 0 ? 0 : di,
			x: P2 * (s.i - s.x),
			gcg: (glucagonTarget(s.g, sec, sc.production, s.p) - s.gcg) / GLUCAGON_TAU,
			d1: -s.d1 / TMAX_G,
			d2: (s.d1 - s.d2) / TMAX_G,
			s1: -s.s1 / TMAX_I,
			s2: (s.s1 - s.s2) / TMAX_I,
			p: INTENSITY_RATE * (effortTarget - s.p),
			ie: A6 * Math.max(0, s.p - REST_INTENSITY) - A7 * s.ie
		} satisfies State
	};
}

/**
 * The resting, fasting steady state for a scenario's production, sensitivity
 * and background insulin: glucose where production and uptake balance.
 */
export function fasting(sc: Pick<Scenario, 'production' | 'sensitivity' | 'basal'>) {
	const at = (g: number) => {
		const sec = secretion(g, sc.production);
		const i = (sec + sc.basal) / KE;
		const gcg = glucagonTarget(g, sec, sc.production, REST_INTENSITY);
		const net =
			R0 * (1 + GLUCAGON_EFFECT * (gcg - 1)) -
			(EG0 + SI * sc.sensitivity * i) * g -
			RENAL_RATE * Math.max(0, g - RENAL_THRESHOLD);
		return { g, i, gcg, net };
	};
	// net is positive at low glucose and negative at high glucose: bisect.
	let lo = 1;
	let hi = 1000;
	for (let k = 0; k < 60; k++) {
		const mid = (lo + hi) / 2;
		if (at(mid).net > 0) lo = mid;
		else hi = mid;
	}
	return at((lo + hi) / 2);
}

/** Time step of the integration, min. */
const DT = 0.25;

/**
 * Runs a scenario from `from` to `to` (minutes), starting at rest in the
 * fasting steady state, and returns one sample per minute.
 */
export function simulate(scenario: Partial<Scenario>, from = -30, to = 360): Sample[] {
	const sc: Scenario = { ...HEALTHY, ...scenario };
	const f = fasting(sc);
	let s: State = {
		g: f.g,
		i: f.i,
		x: f.i,
		gcg: f.gcg,
		d1: 0,
		d2: 0,
		s1: 0,
		s2: 0,
		p: REST_INTENSITY,
		ie: 0
	};
	const out: Sample[] = [];
	const steps = Math.round((to - from) / DT);
	const perMinute = Math.round(1 / DT);
	let mealDone = !(sc.carbs > 0);
	let doseDone = !(sc.dose > 0);
	for (let k = 0; k <= steps; k++) {
		const t = from + k * DT;
		if (!mealDone && t >= sc.mealAt) {
			s = { ...s, d1: s.d1 + AG * sc.carbs * 1000 };
			mealDone = true;
		}
		if (!doseDone && t >= sc.doseAt) {
			s = { ...s, s1: s.s1 + sc.dose * 1e6 };
			doseDone = true;
		}
		const { sample, d } = rates(s, sc, t);
		if (k % perMinute === 0) {
			out.push({
				t,
				g: s.g,
				i: s.i,
				gcg: s.gcg,
				gut: sample.gut,
				liver: sample.liver,
				uptake: sample.uptake,
				urine: sample.urine,
				effort: s.p
			});
		}
		if (k === steps) break;
		// Classic fourth-order Runge–Kutta.
		const add = (a: State, b: State, h: number): State => ({
			g: a.g + h * b.g,
			i: Math.max(0, a.i + h * b.i),
			x: a.x + h * b.x,
			gcg: a.gcg + h * b.gcg,
			d1: a.d1 + h * b.d1,
			d2: a.d2 + h * b.d2,
			s1: a.s1 + h * b.s1,
			s2: a.s2 + h * b.s2,
			p: a.p + h * b.p,
			ie: a.ie + h * b.ie
		});
		const k1 = d;
		const k2 = rates(add(s, k1, DT / 2), sc, t + DT / 2).d;
		const k3 = rates(add(s, k2, DT / 2), sc, t + DT / 2).d;
		const k4 = rates(add(s, k3, DT), sc, t + DT).d;
		s = {
			g: s.g + (DT / 6) * (k1.g + 2 * k2.g + 2 * k3.g + k4.g),
			i: Math.max(0, s.i + (DT / 6) * (k1.i + 2 * k2.i + 2 * k3.i + k4.i)),
			x: s.x + (DT / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
			gcg: s.gcg + (DT / 6) * (k1.gcg + 2 * k2.gcg + 2 * k3.gcg + k4.gcg),
			d1: s.d1 + (DT / 6) * (k1.d1 + 2 * k2.d1 + 2 * k3.d1 + k4.d1),
			d2: s.d2 + (DT / 6) * (k1.d2 + 2 * k2.d2 + 2 * k3.d2 + k4.d2),
			s1: s.s1 + (DT / 6) * (k1.s1 + 2 * k2.s1 + 2 * k3.s1 + k4.s1),
			s2: s.s2 + (DT / 6) * (k1.s2 + 2 * k2.s2 + 2 * k3.s2 + k4.s2),
			p: s.p + (DT / 6) * (k1.p + 2 * k2.p + 2 * k3.p + k4.p),
			ie: s.ie + (DT / 6) * (k1.ie + 2 * k2.ie + 2 * k3.ie + k4.ie)
		};
	}
	return out;
}

/**
 * Background insulin, µU/mL per minute, that holds the fasting glucose of a
 * body with no insulin of its own at `target` mg/dL.
 */
export function basalFor(target = 100, sensitivity = 1) {
	let lo = 0;
	let hi = 20;
	for (let k = 0; k < 60; k++) {
		const mid = (lo + hi) / 2;
		if (fasting({ production: 0, sensitivity, basal: mid }).g > target) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/** Background insulin rate in units per day (1 unit = 10⁶ µU). */
export const basalUnitsPerDay = (basal: number) => (basal * VI * DAY) / 1e6;

/** The sample at minute `t` (the series holds one sample per minute). */
export function at(series: readonly Sample[], t: number): Sample {
	const k = Math.round(t - series[0].t);
	return series[Math.min(series.length - 1, Math.max(0, k))];
}

/** Lowest and highest glucose over [from, to]. */
export function extremes(series: readonly Sample[], from = -Infinity, to = Infinity) {
	let lo = { t: NaN, g: Infinity };
	let hi = { t: NaN, g: -Infinity };
	for (const s of series) {
		if (s.t < from || s.t > to) continue;
		if (s.g < lo.g) lo = { t: s.t, g: s.g };
		if (s.g > hi.g) hi = { t: s.t, g: s.g };
	}
	return { lo, hi };
}
