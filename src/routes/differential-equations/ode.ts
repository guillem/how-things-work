/**
 * The mathematics behind the differential-equations explainer: five rules
 * dy/dt = f(t, y) for one quantity, solution curves traced through them with
 * the classical fourth-order Runge–Kutta method (RK4) in small fixed steps,
 * the exact solutions of the three rules that have a short formula, the
 * equilibria of the rules that do not depend on t (found numerically, with
 * their stability read off the sign of f), and a check that sampled
 * solution curves do not cross.
 *
 * The parameters are illustrative round numbers (a colony doubling in about
 * 2.3 hours, a mug of coffee, a fish stock measured in per cent of its
 * carrying capacity); no data.
 */

export type RuleId = 'growth' | 'cooling' | 'logistic' | 'harvest' | 'riccati';

/** The parameters the controls set; each rule reads the ones it needs. */
export interface RuleParams {
	/** Growth rate (per hour for the colony, per year for the fish). */
	r: number;
	/** Room temperature, °C. */
	room: number;
	/** Harvest, per cent of the carrying capacity per year. */
	H: number;
}

export const DEFAULTS: RuleParams = { r: 0.3, room: 20, H: 8 };
/** Cooling constant of the coffee, per minute. */
export const COOL_K = 0.05;
/** Carrying capacity: the stock is measured in per cent of it. */
export const K = 100;
/** Growth rate of the fish stock, per year. */
export const FISH_R = 0.5;

export interface Rule {
	id: RuleId;
	/** The window drawn: time across, the quantity up. */
	t: [number, number];
	y: [number, number];
	/**
	 * A physical floor (a population cannot go below 0): a trace that reaches
	 * it stops there. Undefined when the quantity may take any value.
	 */
	floor?: number;
	/** True when f does not depend on t, so the rule has equilibria. */
	autonomous: boolean;
	f: (t: number, y: number, p: RuleParams) => number;
	/** The exact solution through (t₀, y₀), for the rules that have a short formula. */
	exact?: (p: RuleParams, t0: number, y0: number) => (t: number) => number;
}

export const rules: Record<RuleId, Rule> = {
	/** dy/dt = r·y: a colony of bacteria, thousands of cells against hours. */
	growth: {
		id: 'growth',
		t: [0, 10],
		y: [0, 100],
		floor: 0,
		autonomous: true,
		f: (_t, y, p) => p.r * y,
		exact: (p, t0, y0) => (t) => y0 * Math.exp(p.r * (t - t0))
	},
	/** dT/dt = −k(T − T_room): Newton's law of cooling, °C against minutes. */
	cooling: {
		id: 'cooling',
		t: [0, 60],
		y: [0, 100],
		autonomous: true,
		f: (_t, y, p) => -COOL_K * (y - p.room),
		exact: (p, t0, y0) => (t) => p.room + (y0 - p.room) * Math.exp(-COOL_K * (t - t0))
	},
	/** dN/dt = r·N·(1 − N/K): logistic growth, per cent of K against years. */
	logistic: {
		id: 'logistic',
		t: [0, 25],
		y: [0, 150],
		floor: 0,
		autonomous: true,
		f: (_t, y) => FISH_R * y * (1 - y / K),
		exact: (_p, t0, y0) => (t) => (K * y0) / (y0 + (K - y0) * Math.exp(-FISH_R * (t - t0)))
	},
	/**
	 * dN/dt = r·N·(1 − N/K) − H: the same stock with a steady catch H. It has a
	 * formula too (separate the variables), but a long one; the page traces it.
	 */
	harvest: {
		id: 'harvest',
		t: [0, 40],
		y: [0, 150],
		floor: 0,
		autonomous: true,
		f: (_t, y, p) => FISH_R * y * (1 - y / K) - p.H
	},
	/**
	 * dy/dt = t − y²: a Riccati equation whose solutions are ratios of Airy
	 * functions, with no formula in elementary functions and their integrals.
	 */
	riccati: {
		id: 'riccati',
		t: [0, 6],
		y: [-3, 3],
		autonomous: false,
		f: (t, y) => t - y * y
	}
};
/** The harvest at which the two equilibria of the fish stock merge: r·K/4. */
export const criticalHarvest = () => (FISH_R * K) / 4;

// ---------------------------------------------------------------------------- tracing

/** One step of the classical fourth-order Runge–Kutta method. */
export function rk4Step(
	f: (t: number, y: number) => number,
	t: number,
	y: number,
	h: number
): number {
	const k1 = f(t, y);
	const k2 = f(t + h / 2, y + (h / 2) * k1);
	const k3 = f(t + h / 2, y + (h / 2) * k2);
	const k4 = f(t + h, y + h * k3);
	return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

export interface Trace {
	/** Times and values, in increasing time, through the start. */
	t: number[];
	y: number[];
	/** The slope f(t, y) at each kept point (for interpolating between them). */
	dy: number[];
	/** Index of the start in the arrays. */
	start: number;
	/** Time at which the forward trace reached the floor (the stock collapsed), if it did. */
	collapse?: number;
}

/** Steps across the whole window; the arrays keep every `KEEP`-th. */
export const STEPS = 3000;
const KEEP = 5;

/**
 * The solution through (t₀, y₀), followed forwards and backwards across the
 * rule's time window in small RK4 steps. A trace stops where it leaves the
 * window by more than its height (it is running off to infinity) or reaches
 * the rule's floor.
 */
export function trace(rule: Rule, p: RuleParams, t0: number, y0: number, steps = STEPS): Trace {
	const [ta, tb] = rule.t;
	const span = rule.y[1] - rule.y[0];
	const lo = rule.y[0] - span;
	const hi = rule.y[1] + span;
	const h = (tb - ta) / steps;
	const f = (t: number, y: number) => rule.f(t, y, p);
	const floor = rule.floor;

	const run = (dir: 1 | -1) => {
		const ts: number[] = [];
		const ys: number[] = [];
		let t = t0;
		let y = y0;
		let i = 0;
		let hitFloor: number | undefined;
		const end = dir > 0 ? tb : ta;
		while (dir * (end - t) > 1e-12) {
			const step = dir * Math.min(h, dir * (end - t));
			const next = rk4Step(f, t, y, step);
			if (!Number.isFinite(next) || next < lo || next > hi) break;
			if (floor !== undefined && next < floor && y >= floor) {
				// Land on the floor: the stock is gone.
				const u = (y - floor) / (y - next);
				t += u * step;
				ts.push(t);
				ys.push(floor);
				if (dir > 0 && y > floor) hitFloor = t;
				return { ts, ys, hitFloor };
			}
			t = dir * (end - t - step) <= 1e-12 ? end : t + step;
			y = next;
			i++;
			if (i % KEEP === 0 || dir * (end - t) <= 1e-12) {
				ts.push(t);
				ys.push(y);
			}
		}
		return { ts, ys, hitFloor };
	};

	const back = run(-1);
	const fwd = run(1);
	const t = [...back.ts.reverse(), t0, ...fwd.ts];
	const y = [...back.ys.reverse(), y0, ...fwd.ys];
	return { t, y, dy: t.map((ti, i) => f(ti, y[i])), start: back.ts.length, collapse: fwd.hitFloor };
}

/**
 * The value of a trace at time t, NaN outside it. Between kept points it uses
 * the cubic that matches the values and the slopes at both ends (Hermite),
 * as accurate as the steps themselves.
 */
export function valueAt(tr: Trace, t: number): number {
	const { t: ts, y: ys, dy } = tr;
	if (t < ts[0] || t > ts[ts.length - 1]) return NaN;
	let a = 0;
	let b = ts.length - 1;
	while (b - a > 1) {
		const m = (a + b) >> 1;
		if (ts[m] <= t) a = m;
		else b = m;
	}
	const h = ts[b] - ts[a];
	if (h === 0) return ys[a];
	const u = (t - ts[a]) / h;
	const u2 = u * u;
	const u3 = u2 * u;
	return (
		(2 * u3 - 3 * u2 + 1) * ys[a] +
		(u3 - 2 * u2 + u) * h * dy[a] +
		(-2 * u3 + 3 * u2) * ys[b] +
		(u3 - u2) * h * dy[b]
	);
}

/**
 * The largest difference between a trace and the exact solution through its
 * start, over the kept samples inside the window. NaN when there is no formula.
 */
export function gapToExact(rule: Rule, p: RuleParams, tr: Trace): number {
	if (!rule.exact) return NaN;
	const ex = rule.exact(p, tr.t[tr.start], tr.y[tr.start]);
	let worst = 0;
	for (let i = 0; i < tr.t.length; i++) {
		if (tr.y[i] < rule.y[0] || tr.y[i] > rule.y[1]) continue;
		const e = ex(tr.t[i]);
		if (Number.isFinite(e)) worst = Math.max(worst, Math.abs(e - tr.y[i]));
	}
	return worst;
}

// ---------------------------------------------------------------------------- equilibria

export type Stability = 'stable' | 'unstable' | 'semi-stable';

export interface Equilibrium {
	y: number;
	stability: Stability;
}

/**
 * Where f(y) = 0 inside the window, for a rule that does not depend on t,
 * found by scanning f and refining by bisection (a sign change) or by
 * minimising |f| (a double root that touches zero without crossing). Each is
 * stable when f > 0 below it and f < 0 above (curves on both sides move
 * towards it), unstable when the signs are the other way round.
 */
export function equilibria(rule: Rule, p: RuleParams, samples = 1500): Equilibrium[] {
	if (!rule.autonomous) return [];
	const f = (y: number) => rule.f(0, y, p);
	const [a, b] = rule.y;
	const dy = (b - a) / samples;
	const ys = Array.from({ length: samples + 1 }, (_, i) => a + i * dy);
	const fs = ys.map(f);
	const scaleF = Math.max(...fs.map(Math.abs), 1e-12);
	const roots: number[] = [];
	for (let i = 0; i < samples; i++) {
		if (fs[i] === 0) roots.push(ys[i]);
		else if (fs[i] * fs[i + 1] < 0) {
			let lo = ys[i];
			let hi = ys[i + 1];
			for (let k = 0; k < 80; k++) {
				const m = (lo + hi) / 2;
				if (f(m) * f(lo) <= 0) hi = m;
				else lo = m;
			}
			roots.push((lo + hi) / 2);
		} else if (
			i > 0 &&
			Math.abs(fs[i]) <= Math.abs(fs[i - 1]) &&
			Math.abs(fs[i]) <= Math.abs(fs[i + 1]) &&
			fs[i - 1] * fs[i + 1] > 0
		) {
			// A local minimum of |f| that does not change sign: a double root if it reaches 0.
			let lo = ys[i - 1];
			let hi = ys[i + 1];
			for (let k = 0; k < 100; k++) {
				const m1 = lo + (hi - lo) / 3;
				const m2 = hi - (hi - lo) / 3;
				if (Math.abs(f(m1)) < Math.abs(f(m2))) hi = m2;
				else lo = m1;
			}
			const m = (lo + hi) / 2;
			if (Math.abs(f(m)) < 1e-9 * scaleF) roots.push(m);
		}
	}
	if (fs[samples] === 0) roots.push(ys[samples]);
	const unique = roots.filter((r, i) => i === 0 || Math.abs(r - roots[i - 1]) > dy / 2);
	const d = (b - a) * 1e-4;
	return unique.map((y) => {
		const below = f(y - d);
		const above = f(y + d);
		const stability: Stability =
			below > 0 && above < 0 ? 'stable' : below < 0 && above > 0 ? 'unstable' : 'semi-stable';
		return { y, stability };
	});
}

// ---------------------------------------------------------------------------- crossings

/**
 * How many pairs of traces cross: their difference changes sign by more than
 * a tolerance somewhere in the time they share. Two traces that agree
 * everywhere (two starts dropped on the same curve) are the same solution,
 * not a crossing.
 */
export function crossings(rule: Rule, traces: Trace[], samples = 400): number {
	const tol = (rule.y[1] - rule.y[0]) * 1e-6;
	let count = 0;
	for (let i = 0; i < traces.length; i++)
		for (let j = i + 1; j < traces.length; j++) {
			const a = traces[i];
			const b = traces[j];
			const t0 = Math.max(a.t[0], b.t[0]);
			const t1 = Math.min(a.t[a.t.length - 1], b.t[b.t.length - 1]);
			if (!(t1 > t0)) continue;
			let sign = 0;
			let crossed = false;
			for (let k = 0; k <= samples; k++) {
				const t = t0 + ((t1 - t0) * k) / samples;
				const d = valueAt(a, t) - valueAt(b, t);
				if (!Number.isFinite(d) || Math.abs(d) <= tol) continue;
				const s = Math.sign(d);
				if (sign !== 0 && s !== sign) crossed = true;
				sign = s;
			}
			if (crossed) count++;
		}
	return count;
}
