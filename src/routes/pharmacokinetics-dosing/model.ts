/**
 * A one-compartment model of a drug in the body.
 *
 * The body is one well-mixed volume V (the volume of distribution). A dose injected into a vein
 * enters it at once (or over a few minutes, `duration`); a drip adds a constant rate; a tablet
 * first sits in the gut, from which a fraction F is absorbed at a rate ka × (what is left). The
 * drug leaves at a rate CL × C (clearance × concentration: first-order, "linear" elimination),
 * or, when elimination saturates, at Vmax × C / (Km + C) (Michaelis–Menten).
 *
 *   d(gut)/dt  = −ka · gut                         (+ F · dose at each tablet)
 *   d(body)/dt =  ka · gut + infusion − elimination(C),   C = body / V
 *
 * The equations are integrated with a fourth-order Runge–Kutta step on a fixed grid, split at
 * every dose so that a dose lands at its exact time. Linear elimination has closed forms
 * (`ivLevel`, `oralLevel`, `steadyAverage`), against which the model tests check the integrator.
 */
import type { Drug, Form } from './drugs';

export interface Body {
	V: number;
	CL: number;
	F: number;
	ka: number;
	saturable?: { Vmax: number; Km: number } | null;
}

export interface Dose {
	/** Start time, h. */
	t: number;
	form: Form;
	/** Amount (an injection or a tablet), or the rate per hour of a drip. */
	amount: number;
	/** Hours over which an injection is infused, or a drip runs. 0: all at once. */
	duration?: number;
}

export interface Series {
	/** Sample times, h (evenly spaced, from 0). */
	t: Float64Array;
	/** Concentration in the blood at each sample, amount / L. */
	c: Float64Array;
	/** Amount still in the gut (tablets not yet absorbed) at each sample. */
	g: Float64Array;
	dt: number;
}

const LN2 = Math.LN2;

/** The body of a drug, with optional multipliers on clearance and volume. */
export function bodyOf(
	d: Drug,
	opts: { clearance?: number; volume?: number; ka?: number; saturable?: boolean } = {}
): Body {
	const cl = opts.clearance ?? 1;
	const sat = opts.saturable ?? true;
	return {
		V: d.V * (opts.volume ?? 1),
		CL: d.CL * cl,
		F: d.F,
		ka: opts.ka ?? d.ka,
		saturable: d.saturable && sat ? { Vmax: d.saturable.Vmax * cl, Km: d.saturable.Km } : null
	};
}

/** Elimination rate (amount/h) at concentration c. */
export function elimination(b: Body, c: number): number {
	if (b.saturable) return (b.saturable.Vmax * c) / (b.saturable.Km + Math.max(c, 0));
	return b.CL * c;
}

/** The infusion rate (amount/h) at time t, from injections spread over time and drips. */
function infusionAt(doses: readonly Dose[], t: number): number {
	let r = 0;
	for (const d of doses) {
		const dur = d.duration ?? 0;
		if (dur <= 0 || d.form === 'tablet') continue;
		if (t >= d.t && t < d.t + dur) r += d.form === 'drip' ? d.amount : d.amount / dur;
	}
	return r;
}

/**
 * Integrates the model from 0 to `tEnd` h and returns the blood level on an even grid of
 * `samples` + 1 points.
 */
export function simulate(b: Body, doses: readonly Dose[], tEnd: number, samples = 1200): Series {
	const n = Math.max(2, Math.round(samples));
	const dt = tEnd / n;
	const t = new Float64Array(n + 1);
	const c = new Float64Array(n + 1);
	const g = new Float64Array(n + 1);
	// inner step: fine enough for the fastest process (absorption, or a short infusion)
	const fast = Math.max(b.ka, (b.saturable ? b.saturable.Vmax / b.saturable.Km : b.CL) / b.V);
	const sub = Math.max(1, Math.ceil(dt / Math.min(0.1, 0.2 / Math.max(fast, 1e-9))));
	const h0 = dt / sub;

	// breakpoints where something starts or stops: doses land on them exactly
	const sorted = [...doses].sort((x, y) => x.t - y.t);
	const breaks = new Set<number>();
	for (const d of sorted) {
		breaks.add(d.t);
		if ((d.duration ?? 0) > 0 && d.form !== 'tablet') breaks.add(d.t + (d.duration ?? 0));
	}
	const bps = [...breaks].filter((x) => x >= 0 && x <= tEnd).sort((x, y) => x - y);
	let bi = 0;

	let gut = 0;
	let body = 0;
	const deriv = (g: number, a: number, rate: number): [number, number] => {
		const cc = a / b.V;
		return [-b.ka * g, b.ka * g + rate - elimination(b, cc)];
	};
	const rk4 = (from: number, h: number) => {
		const rate = infusionAt(sorted, from + h / 2);
		const [g1, a1] = deriv(gut, body, rate);
		const [g2, a2] = deriv(gut + (h / 2) * g1, body + (h / 2) * a1, rate);
		const [g3, a3] = deriv(gut + (h / 2) * g2, body + (h / 2) * a2, rate);
		const [g4, a4] = deriv(gut + h * g3, body + h * a3, rate);
		gut += (h / 6) * (g1 + 2 * g2 + 2 * g3 + g4);
		body += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
		if (body < 0) body = 0;
		if (gut < 0) gut = 0;
	};
	const land = (time: number) => {
		for (const d of sorted) {
			if (d.t !== time) continue;
			if (d.form === 'tablet') gut += b.F * d.amount;
			else if ((d.duration ?? 0) <= 0 && d.form === 'injection') body += d.amount;
		}
	};

	let now = 0;
	const advance = (to: number) => {
		while (now < to - 1e-12) {
			while (bi < bps.length && bps[bi] <= now + 1e-12) {
				land(bps[bi]);
				bi++;
			}
			const next = bi < bps.length ? Math.min(bps[bi], to) : to;
			const span = next - now;
			const k = Math.max(1, Math.ceil(span / h0 - 1e-9));
			for (let i = 0; i < k; i++) rk4(now + (i * span) / k, span / k);
			now = next;
		}
	};
	// doses at time 0
	while (bi < bps.length && bps[bi] <= 1e-12) {
		land(bps[bi]);
		bi++;
	}
	t[0] = 0;
	c[0] = body / b.V;
	g[0] = gut;
	for (let i = 1; i <= n; i++) {
		advance(i * dt);
		t[i] = i * dt;
		c[i] = body / b.V;
		g[i] = gut;
	}
	return { t, c, g, dt };
}

/** The level at time `time`, interpolated from a series. */
export function levelAt(s: Series, time: number): number {
	const n = s.t.length - 1;
	const x = Math.min(n, Math.max(0, time / s.dt));
	const i = Math.min(n - 1, Math.floor(x));
	const u = x - i;
	return s.c[i] * (1 - u) + s.c[i + 1] * u;
}

/** Highest and lowest level between two times. */
export function range(s: Series, from: number, to: number): { max: number; min: number } {
	let max = -Infinity;
	let min = Infinity;
	for (let i = 0; i < s.t.length; i++) {
		if (s.t[i] < from - 1e-9 || s.t[i] > to + 1e-9) continue;
		max = Math.max(max, s.c[i]);
		min = Math.min(min, s.c[i]);
	}
	return { max, min };
}

/** Repeated doses of one form every `interval` hours from `start`, up to (not at) `until`. */
export function repeated(opts: {
	amount: number;
	interval: number;
	form: Form;
	until: number;
	start?: number;
	/** Doses to leave out, counted from 1. */
	skip?: number[];
	duration?: number;
}): Dose[] {
	const out: Dose[] = [];
	const start = opts.start ?? 0;
	for (let k = 0, time = start; time < opts.until - 1e-9; k++, time = start + k * opts.interval) {
		if (opts.skip?.includes(k + 1)) continue;
		out.push({ t: time, form: opts.form, amount: opts.amount, duration: opts.duration });
	}
	return out;
}

// ---------------------------------------------------------------- closed forms (linear)

/** Elimination rate constant k = CL / V, 1/h. */
export const rateConstant = (b: Body) => b.CL / b.V;

/** Half-life, h: ln 2 · V / CL (for a saturable drug, its value at concentration c). */
export function halfLifeAt(b: Body, c = 0): number {
	if (b.saturable) return (LN2 * b.V * (b.saturable.Km + c)) / b.saturable.Vmax;
	return (LN2 * b.V) / b.CL;
}

/** Level t hours after an injection of `amount` all at once. */
export const ivLevel = (b: Body, amount: number, t: number) =>
	(amount / b.V) * Math.exp(-rateConstant(b) * t);

/** Level t hours after one tablet (Bateman function). */
export function oralLevel(b: Body, amount: number, t: number): number {
	const k = rateConstant(b);
	if (Math.abs(b.ka - k) < 1e-9) return ((b.F * amount) / b.V) * k * t * Math.exp(-k * t);
	return ((b.F * amount * b.ka) / (b.V * (b.ka - k))) * (Math.exp(-k * t) - Math.exp(-b.ka * t));
}

/** Time of the peak after one tablet, h. */
export function oralPeakTime(b: Body): number {
	const k = rateConstant(b);
	if (Math.abs(b.ka - k) < 1e-9) return 1 / k;
	return Math.log(b.ka / k) / (b.ka - k);
}

/**
 * Average level at steady state for `amount` every `interval` hours (or a drip of
 * `amount` per hour with interval 1): F·dose / (CL·τ) for linear elimination; for saturable
 * elimination Km·R / (Vmax − R), with R the rate that reaches the blood, and Infinity when the
 * intake reaches Vmax (no steady state).
 */
export function steadyAverage(b: Body, amount: number, interval: number, form: Form): number {
	const R = ((form === 'tablet' ? b.F : 1) * amount) / interval;
	if (b.saturable) {
		const { Vmax, Km } = b.saturable;
		return R >= Vmax ? Infinity : (Km * R) / (Vmax - R);
	}
	return R / b.CL;
}

/** Share of the steady state reached after n half-lives (linear elimination): 1 − 2⁻ⁿ. */
export const shareAfter = (halfLives: number) => 1 - Math.pow(2, -halfLives);

/**
 * The first time the level, just before each dose (the trough), reaches `share` of its
 * steady-state value `plateau`; NaN if it never does within the series.
 */
export function timeToShare(
	s: Series,
	doses: readonly Dose[],
	plateau: number,
	share: number
): number {
	for (const d of doses) {
		if (d.t <= 0) continue;
		const before = levelAt(s, d.t - 1e-6);
		if (before >= share * plateau) return d.t;
	}
	return NaN;
}

/** Hours the level spends inside [lo, hi] between two times. */
export function hoursInside(s: Series, lo: number, hi: number, from = 0, to = Infinity): number {
	let h = 0;
	for (let i = 1; i < s.t.length; i++) {
		if (s.t[i] <= from || s.t[i - 1] >= to) continue;
		const mid = (s.c[i] + s.c[i - 1]) / 2;
		if (mid >= lo && mid <= hi) h += s.dt;
	}
	return h;
}
