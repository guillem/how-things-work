/**
 * The lac operon as a positive-feedback switch: the model of Ozbudak, Thattai, Lim, Shraiman and
 * van Oudenaarden (Nature 427, 737–740, 2004; equations S1–S8 of their Supplementary
 * Information), with their fitted parameters, plus two small extensions that are ours:
 *
 * - **lactose** instead of TMG: lactose is taken up by LacY like TMG, but β-galactosidase (made
 *   by the same operon) both turns it into the inducer allolactose and breaks the allolactose
 *   down, so the inducer level depends only weakly on how many lac enzymes the cell has (the
 *   third explanation of their Supplementary Information for why they never saw hysteresis
 *   with lactose). Its two constants are chosen, not measured.
 * - **a culture** growing on glucose and lactose (Monod growth on each sugar, coupled to the
 *   operon), to show the diauxic pause. Its growth rates, yields and CRP-cAMP effect are typical
 *   values chosen for the illustration; inducer exclusion is set to the sixfold upper bound
 *   measured by Aggarwal & Narang (2022).
 *
 * Units: lac expression y in Ozbudak's green-fluorescence units, in which a fully induced cell
 * without glucose reads about 100 (so y reads as "% of full induction"); concentrations of TMG,
 * lactose and glucose in µM; the internal inducer x in units of the repressor's half-saturation
 * concentration (x₀ = 1). Time in hours.
 */

// ---- Ozbudak et al. 2004: the switch with TMG ------------------------------------------------

/** Repression factor ρ: the ratio of fully induced to fully repressed output (fitted, ±20%). */
export const RHO = 167.1;
/** Effective Hill coefficient of LacI inactivation in this reduced model. */
export const HILL = 2;
/** Measured switching thresholds without glucose, µM TMG (Ozbudak et al. 2004, Fig. 2b). */
export const MEASURED = { off: 3, on: 30 };

/**
 * Maximal operon output α at glucose G (µM): CRP-cAMP's activation, which glucose lowers to
 * about a fifth (Ozbudak's fit, eq. S8).
 */
export const alphaOz = (G: number) => 84.4 / (1 + Math.max(0, G / 8.1) ** 1.2) + 16.1;

/**
 * Fraction (in %) of LacY molecules active at glucose G (µM): inducer exclusion. Ozbudak's fit
 * gives 100 without glucose and about 65 above 10 µM; the exponential in between is our
 * interpolation.
 */
export const betaGOz = (G: number) => (G > 10 ? 65 : 65 + 35 * Math.exp(-G / 3));

/** TMG uptake per active LacY at external TMG T (µM): Ozbudak's power law, exponent 0.6. */
export const betaT = (T: number) => 1.23e-3 * Math.max(0, T) ** 0.6;

/** Repressor's release: the operon's output as a fraction of α at internal inducer x. */
export const release = (x: number) => (1 + x * x) / (RHO + x * x);

/** The lac medium: an inducer (TMG or lactose) and glucose, all in µM. */
export interface Medium {
	inducer: 'tmg' | 'lactose';
	/** External inducer, µM. */
	c: number;
	/** External glucose, µM. */
	glucose: number;
}

// ---- Lactose: the inducer is also eaten ------------------------------------------------------

/**
 * Lactose → allolactose (chosen constants). Uptake by LacY saturates with half-saturation
 * `K` µM; allolactose made per LacY is `b`; β-galactosidase (∝ y) breaks it down as fast as
 * dilution removes it when y = `yc`. So x = b·s·y / (1 + y/yc): the inducer still rises with the
 * lac enzymes (the feedback remains), but less and less, and with these constants the switch
 * has a single steady state at every lactose and glucose level, as Ozbudak et al. and Zander
 * et al. (2017) found for wild-type cells.
 */
export const LACTOSE = { b: 30, K: 500, yc: 0.7 };

/**
 * Internal inducer x for a cell with lac expression y in `m`. `active` is the fraction of its
 * LacY not blocked by glucose (inducer exclusion), 0–1.
 */
export function inducer(y: number, m: Medium, active: number): number {
	if (m.inducer === 'tmg') return betaT(m.c) * 100 * active * y;
	const s = m.c / (m.c + LACTOSE.K);
	return (LACTOSE.b * s * active * y) / (1 + y / LACTOSE.yc);
}

/** The operon's target output (production rate × time constant) for a cell at y in `m`. */
export function production(y: number, m: Medium): number {
	return alphaOz(m.glucose) * release(inducer(y, m, betaGOz(m.glucose) / 100));
}

export interface SteadyState {
	y: number;
	stable: boolean;
}

/**
 * Steady states of τ dy/dt = production(y) − y, from low to high: one (off or on) or three
 * (off, the unstable middle, on).
 */
export function steadyStates(m: Medium): SteadyState[] {
	const lo = alphaOz(m.glucose) / RHO / 2;
	const hi = alphaOz(m.glucose) * 1.05;
	const N = 1200;
	const out: SteadyState[] = [];
	let y0 = lo;
	let f0 = production(y0, m) - y0;
	for (let i = 1; i <= N; i++) {
		const y1 = lo * (hi / lo) ** (i / N);
		const f1 = production(y1, m) - y1;
		if (f0 === 0 || Math.sign(f1) !== Math.sign(f0)) {
			// Bisection on the bracket.
			let a = y0;
			let b = y1;
			for (let k = 0; k < 50; k++) {
				const c = (a + b) / 2;
				const fc = production(c, m) - c;
				if (Math.sign(fc) === Math.sign(production(a, m) - a)) a = c;
				else b = c;
			}
			// Stable where the net rate falls through zero (f goes from + to −).
			out.push({ y: (a + b) / 2, stable: f0 > 0 });
		}
		y0 = y1;
		f0 = f1;
	}
	return out;
}

/**
 * The inducer range (µM) over which the switch has two stable states, at glucose G: below
 * `off` every cell is uninduced, above `on` every cell is induced. Null when there is no such
 * range (a graded response).
 */
export function thresholds(
	G: number,
	inducer: Medium['inducer'] = 'tmg'
): { off: number; on: number } | null {
	const bistable = (c: number) => steadyStates({ inducer, c, glucose: G }).length === 3;
	// Scan 0.1 µM to 100 mM on a log grid, then refine both edges.
	const N = 600;
	const at = (i: number) => 10 ** (-1 + (6 * i) / N);
	let first = -1;
	let last = -1;
	for (let i = 0; i <= N; i++) {
		if (bistable(at(i))) {
			if (first < 0) first = i;
			last = i;
		}
	}
	if (first < 0) return null;
	const refine = (inside: number, outside: number) => {
		let a = inside;
		let b = outside;
		for (let k = 0; k < 40; k++) {
			const c = Math.sqrt(a * b);
			if (bistable(c)) a = c;
			else b = c;
		}
		return Math.sqrt(a * b);
	};
	const off = first > 0 ? refine(at(first), at(first - 1)) : at(0);
	const on = last < N ? refine(at(last), at(last + 1)) : at(N);
	return { off, on };
}

// ---- A slow sweep: the hysteresis loop -------------------------------------------------------

/**
 * Time constant of lac expression, h: LacY is stable, so it is removed by dilution as the cell
 * grows (a doubling time of about 1.4 h on succinate; chosen).
 */
export const TAU = 2;

export interface SweepPoint {
	/** Hours since the sweep started. */
	t: number;
	/** External inducer, µM. */
	c: number;
	/** Lac expression of a cell that started uninduced. */
	y: number;
	/** Going up (true) or coming back down. */
	up: boolean;
}

/**
 * One cell, uninduced at first, while the inducer rises geometrically from `from` to `to` µM
 * over `hours`, then falls back over the same time. Glucose stays at `glucose` µM.
 */
export function sweep(opts: {
	inducer: Medium['inducer'];
	glucose: number;
	from: number;
	to: number;
	hours: number;
	every?: number;
}): SweepPoint[] {
	const { inducer: ind, glucose, from, to, hours } = opts;
	const every = opts.every ?? hours / 200;
	const dt = 0.01;
	const cAt = (t: number) => {
		const u = t <= hours ? t / hours : 2 - t / hours;
		return from * (to / from) ** Math.max(0, Math.min(1, u));
	};
	let y = steadyStates({ inducer: ind, c: from, glucose })[0].y;
	const out: SweepPoint[] = [];
	let next = 0;
	for (let t = 0; t <= 2 * hours + 1e-9; t += dt) {
		const c = cAt(t);
		if (t >= next - 1e-9) {
			out.push({ t, c, y, up: t <= hours });
			next += every;
		}
		y += ((production(y, { inducer: ind, c, glucose }) - y) / TAU) * dt;
	}
	return out;
}

// ---- A culture on glucose and lactose: diauxie -----------------------------------------------

/**
 * The culture's constants (chosen typical values, not fitted to a data set): growth rates (per
 * hour) on glucose and, fully induced, on lactose; Monod half-saturation constants (µM); yields
 * (OD₆₀₀ per mM of sugar, ≈ 0.5 g of dry cells per g of sugar); how strongly glucose uptake
 * blocks LacY in cells growing on glucose (`exclusion`: 83%, the sixfold upper bound measured by
 * Aggarwal & Narang 2022 in partially induced cells; the loop amplifies it); how
 * much higher the output is without glucose through CRP-cAMP in such cells (`cap`, small, as
 * Inada et al. 1996 found cAMP levels barely differ); and the rate at which a cell can still
 * make protein while it is not growing (`k0`, per hour). LacY and β-galactosidase are stable: they
 * are lost only by dilution as the cells grow.
 */
export const CULTURE = {
	muG: 0.8,
	muL: 0.65,
	KG: 10,
	KL: 200,
	yieldG: 0.22,
	yieldL: 0.43,
	exclusion: 0.83,
	cap: 0.3,
	k0: 0.4
};

/**
 * Which cell grows: the wild type; a cell whose lac promoter ignores CRP-cAMP (the lacL8UV5
 * mutation used by Kimata et al. 1997); one without the repressor (lacI⁻, Inada et al. 1996);
 * and a what-if cell whose permease glucose cannot block.
 */
export type Strain = 'wild' | 'uv5' | 'lacI' | 'noexcl';

export interface CulturePoint {
	t: number;
	/** Optical density at 600 nm. */
	od: number;
	/** Glucose and lactose left, mM. */
	glucose: number;
	lactose: number;
	/** Lac expression, % of full induction. */
	y: number;
	/** Growth rate, per hour. */
	mu: number;
}

/** Fraction of LacY blocked while glucose is being taken up, in a culture. */
const blocked = (G: number, strain: Strain) =>
	strain === 'noexcl' ? 0 : (CULTURE.exclusion * G) / (G + CULTURE.KG);

/** Maximal output α in a culture: CRP-cAMP lowers it a little while glucose is present. */
const alphaCulture = (G: number, strain: Strain) =>
	alphaOz(0) * (strain === 'uv5' ? 1 : 1 - (CULTURE.cap * G) / (G + CULTURE.KG));

/**
 * Lac output a cell settles to in a medium with glucose G and lactose L (µM), in the culture's
 * regime (cells growing on these sugars): the classic four cases of the operon.
 */
export function cultureSteady(G: number, L: number, strain: Strain = 'wild'): number {
	return cultureCell(G, L, strain).y;
}

/**
 * The settled cell of `cultureSteady` in detail: its lac output y, its inducer x, the chance
 * that the operator is held by a repressor (1 − the repressor's release), the share of its permeases blocked by
 * glucose, and its maximal output α (CRP-cAMP's part).
 */
export function cultureCell(G: number, L: number, strain: Strain = 'wild') {
	const a = alphaCulture(G, strain);
	const active = 1 - blocked(G, strain);
	const m: Medium = { inducer: 'lactose', c: L, glucose: G };
	let y = a / RHO;
	for (let i = 0; i < 4000; i++) {
		const r = strain === 'lacI' ? 1 : release(inducer(y, m, active));
		y += (a * r - y) * 0.05;
	}
	const x = inducer(y, m, active);
	return { y, x, bound: strain === 'lacI' ? 0 : 1 - release(x), blocked: 1 - active, alpha: a };
}

/**
 * Grows a culture from `od0` on `glucose` and `lactose` (mM) for `hours`, starting with cells
 * grown on glucose alone. Returns a point every `every` hours.
 */
export function culture(opts: {
	glucose: number;
	lactose: number;
	hours: number;
	strain?: Strain;
	od0?: number;
	every?: number;
}): CulturePoint[] {
	const strain = opts.strain ?? 'wild';
	const every = opts.every ?? 0.05;
	const dt = 0.002;
	let od = opts.od0 ?? 0.02;
	let G = opts.glucose * 1000;
	let L = opts.lactose * 1000;
	// Pre-grown on glucose alone: the uninduced level (or, without repressor, fully on).
	let y = strain === 'lacI' ? alphaCulture(1e4, strain) : alphaCulture(1e4, strain) / RHO;
	const out: CulturePoint[] = [];
	let next = 0;
	for (let t = 0; t <= opts.hours + 1e-9; t += dt) {
		const active = 1 - blocked(G, strain);
		const muG = (CULTURE.muG * G) / (G + CULTURE.KG);
		const muL = CULTURE.muL * Math.min(1, y / 100) * active * (L / (L + CULTURE.KL));
		const mu = muG + muL;
		if (t >= next - 1e-9) {
			out.push({ t, od, glucose: G / 1000, lactose: L / 1000, y, mu });
			next += every;
		}
		const x = inducer(y, { inducer: 'lactose', c: L, glucose: G }, active);
		const target = alphaCulture(G, strain) * (strain === 'lacI' ? 1 : release(x));
		// Made at the growth rate (or slowly, at k0, while not growing); lost only by dilution.
		y += (target > y ? Math.max(mu, CULTURE.k0) * (target - y) : mu * (target - y)) * dt;
		const growth = mu * od * dt;
		G = Math.max(0, G - ((muG / mu || 0) * growth * 1000) / CULTURE.yieldG);
		L = Math.max(0, L - ((muL / mu || 0) * growth * 1000) / CULTURE.yieldL);
		od += growth;
	}
	return out;
}

/**
 * The diauxic pause: when the glucose runs out, the hours during which the growth rate stays
 * below half of the best rate the culture then reaches on lactose. Null when growth never
 * drops that low (no pause).
 */
export function pauseWindow(trace: readonly CulturePoint[]): { start: number; end: number } | null {
	// A diauxic shift needs a glucose phase first.
	if (trace.length === 0 || trace[0].glucose < 0.001) return null;
	const gone = trace.findIndex((p) => p.glucose < 0.001);
	if (gone < 0) return null;
	let best = 0;
	for (let i = gone; i < trace.length; i++) best = Math.max(best, trace[i].mu);
	const half = best / 2;
	let start = -1;
	for (let i = Math.max(0, gone - 20); i < trace.length; i++) {
		const p = trace[i];
		if (p.mu < half && start < 0) start = i;
		if (p.mu >= half && start >= 0) return { start: trace[start].t, end: p.t };
	}
	return null;
}

/** The length of the diauxic pause in hours (0 when there is none). */
export function pause(trace: readonly CulturePoint[]): number {
	const w = pauseWindow(trace);
	return w ? w.end - w.start : 0;
}
