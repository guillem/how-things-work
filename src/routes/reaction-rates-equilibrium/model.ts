/**
 * The hydrogen–iodine reaction, H₂ + I₂ ⇌ 2 HI, from Bodenstein's 1899 measurements
 * (see ./bodenstein.ts).
 *
 * Rate law (mass action, as Bodenstein measured it):
 *     rate forward  r_f = k_f [H₂][I₂]
 *     rate reverse  r_r = k_r [HI]²
 *     net rate      ν = r_f − r_r        (reactions per litre per second, mol L⁻¹ s⁻¹)
 *     d[H₂]/dt = d[I₂]/dt = −ν,  d[HI]/dt = +2ν
 * At equilibrium ν = 0, so [HI]²/([H₂][I₂]) = k_f/k_r = K.
 *
 * Constants, all fitted here from the data rather than typed in:
 *   - K(T): van 't Hoff fit (ln K = a + b/T) to Bodenstein's equilibrium data. The
 *     slope gives the reaction enthalpy, ΔH = −R·b ≈ −12 kJ/mol (exothermic).
 *   - k_f(T) = A·exp(−Ea_f/RT): Arrhenius fit to every rate measurement at once, the
 *     formation constants as measured and the decomposition constants turned into
 *     formation ones through K(T) (k_f = k_r·K). Then k_r = k_f/K always, so the two
 *     directions agree with the equilibrium exactly (detailed balance) and the
 *     barriers differ by exactly ΔH: Ea_r = Ea_f − ΔH.
 *   - Units: Giunta's arbitrary unit, calibrated with OpenStax (L mol⁻¹ s⁻¹).
 *
 * A catalyst opens a second path whose barrier is lower by the same amount in both
 * directions (the path is the same, run forwards or backwards, so its two barriers
 * still differ by ΔH). The page keeps the same rate law and pre-factor A for it;
 * that is a simplification (on a real gold surface the rate law changes too).
 *
 * Fits are used only inside the measured range, 556–781 K.
 */
import {
	DECOMPOSITION,
	EQUILIBRIUM,
	FORMATION,
	OPENSTAX_DECOMPOSITION,
	OPENSTAX_MATCH
} from './bodenstein';

/** Gas constant, J mol⁻¹ K⁻¹. */
export const R = 8.314462618;
/** Kelvin of 0 °C. */
export const ZERO_C = 273.15;
/** The measured range (K): Bodenstein's lowest and highest temperatures. */
export const T_MIN = 283 + ZERO_C;
export const T_MAX = 508 + ZERO_C;

/** Least-squares line y = a + b·x. */
function line(xs: readonly number[], ys: readonly number[]): { a: number; b: number } {
	const n = xs.length;
	const mx = xs.reduce((s, v) => s + v, 0) / n;
	const my = ys.reduce((s, v) => s + v, 0) / n;
	let sxy = 0;
	let sxx = 0;
	for (let i = 0; i < n; i++) {
		sxy += (xs[i] - mx) * (ys[i] - my);
		sxx += (xs[i] - mx) ** 2;
	}
	const b = sxy / sxx;
	return { a: my - b * mx, b };
}

/** K from Bodenstein's equilibrium fraction ξ of HI decomposed. */
export const kFromFraction = (xi: number) => (1 - xi) ** 2 / (xi / 2) ** 2;

const vantHoff = line(
	EQUILIBRIUM.map(([c]) => 1 / (c + ZERO_C)),
	EQUILIBRIUM.map(([, xi]) => Math.log(kFromFraction(xi)))
);

/** Equilibrium constant K = [HI]²/([H₂][I₂]) at temperature T (K). Dimensionless. */
export const equilibriumConstant = (T: number) => Math.exp(vantHoff.a + vantHoff.b / T);

/** Reaction enthalpy (J/mol), from the van 't Hoff slope: negative, exothermic. */
export const DH = -R * vantHoff.b;

/** Giunta's arbitrary unit per L mol⁻¹ s⁻¹ (the mean ratio at the five shared points). */
export const UNIT =
	OPENSTAX_MATCH.reduce((s, [kelvin, celsius]) => {
		const b = DECOMPOSITION.find(([c]) => c === celsius)?.[1] ?? NaN;
		const o = OPENSTAX_DECOMPOSITION.find(([k]) => k === kelvin)?.[1] ?? NaN;
		return s + b / o;
	}, 0) / OPENSTAX_MATCH.length;

const arrhenius = line(
	[...FORMATION, ...DECOMPOSITION].map(([c]) => 1 / (c + ZERO_C)),
	[
		...FORMATION.map(([, k]) => Math.log(k / UNIT)),
		...DECOMPOSITION.map(([c, k]) => Math.log((k / UNIT) * equilibriumConstant(c + ZERO_C)))
	]
);

/** Activation energy of H₂ + I₂ → 2 HI (J/mol). */
export const EA_F = -R * arrhenius.b;
/** Activation energy of 2 HI → H₂ + I₂ (J/mol): higher by −ΔH. */
export const EA_R = EA_F - DH;
/** Arrhenius pre-factor of the forward reaction (L mol⁻¹ s⁻¹). */
const A_F = Math.exp(arrhenius.a);

/**
 * Activation energy of HI decomposition on a gold surface, ≈ 105 kJ/mol: the value
 * textbooks quote from C. N. Hinshelwood and C. R. Prichard, J. Chem. Soc. 127,
 * 1551–1555 (1925). The page uses it only for the size of the drop it makes.
 */
const EA_GOLD = 105e3;
/** How much gold lowers the barrier, in both directions (J/mol). */
export const GOLD_LOWERING = EA_R - EA_GOLD;

/** Forward rate constant k_f (L mol⁻¹ s⁻¹) at T (K), barrier lowered by `lowering` J/mol. */
export const kForward = (T: number, lowering = 0) => A_F * Math.exp(-(EA_F - lowering) / (R * T));
/** Reverse rate constant k_r (L mol⁻¹ s⁻¹): always k_f / K. */
export const kReverse = (T: number, lowering = 0) => kForward(T, lowering) / equilibriumConstant(T);

/**
 * Share of collisions whose energy (along the line between the two molecules'
 * centres) is at least E (J/mol) at temperature T: e^(−E/RT). This is the
 * Boltzmann factor in the Arrhenius equation.
 */
export const fractionAbove = (E: number, T: number) => Math.exp(-E / (R * T));

/**
 * Density of collision energies at T, normalised so that its integral from E up
 * is fractionAbove(E, T): f(E) = e^(−E/RT) / RT (per J/mol).
 */
export const energyDensity = (E: number, T: number) => Math.exp(-E / (R * T)) / (R * T);

// ------------------------------------------------------------------ mixtures

/** Concentrations in mol/L. */
export interface Mix {
	h2: number;
	i2: number;
	hi: number;
}

/** The flask of the page: 1 atm at 700 K, half hydrogen and half iodine vapour. */
export const START_TOTAL = 101325 / (R * 700) / 1000;
export const START: Mix = { h2: START_TOTAL / 2, i2: START_TOTAL / 2, hi: 0 };
/** The same atoms as pure hydrogen iodide. */
export const START_HI: Mix = { h2: 0, i2: 0, hi: START_TOTAL };

/** Reaction quotient Q = [HI]²/([H₂][I₂]); Infinity when there is no H₂ or I₂. */
export function quotient(m: Mix): number {
	const d = m.h2 * m.i2;
	if (d <= 0) return m.hi > 0 ? Infinity : NaN;
	return (m.hi * m.hi) / d;
}

/** Forward and reverse rates (mol L⁻¹ s⁻¹) of a mixture. */
export function rates(m: Mix, T: number, lowering = 0): { forward: number; reverse: number } {
	return {
		forward: kForward(T, lowering) * m.h2 * m.i2,
		reverse: kReverse(T, lowering) * m.hi * m.hi
	};
}

/** The equilibrium mixture reached from `m` at T (solves K = Q for the extent). */
export function equilibriumMix(m: Mix, T: number): Mix {
	const K = equilibriumConstant(T);
	// Extent x (mol/L) of H₂ + I₂ → 2 HI: from −hi/2 (all HI gone) to min(h2, i2).
	let lo = -m.hi / 2;
	let hi = Math.min(m.h2, m.i2);
	const g = (x: number) => (m.hi + 2 * x) ** 2 - K * (m.h2 - x) * (m.i2 - x);
	// g rises from −K·(…) ≤ 0 at lo to ≥ 0 at hi.
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (g(mid) > 0) hi = mid;
		else lo = mid;
	}
	const x = (lo + hi) / 2;
	return { h2: m.h2 - x, i2: m.i2 - x, hi: m.hi + 2 * x };
}

/** Share of the iodine atoms that are in HI (0–1). */
export const hiShare = (m: Mix) => m.hi / (m.hi + 2 * m.i2);

// ------------------------------------------------------------------ running it

/** Conditions in force from a moment on. */
interface Conditions {
	T: number;
	/** Barrier lowering by a catalyst (J/mol), 0 = none. */
	lowering: number;
}

/** Something that happens during a run, at model time `at` (s). */
export interface Change {
	at: number;
	/** New temperature and/or catalyst from this moment. */
	T?: number;
	lowering?: number;
	/** Hydrogen added (mol/L; negative removes, never more than there is). */
	addH2?: number;
}

export interface Sample extends Mix {
	/** Model time (s). */
	t: number;
	forward: number;
	reverse: number;
	/** Cumulative forward and reverse reactions so far (mol/L). */
	done: number;
	undone: number;
	T: number;
	lowering: number;
}

function derivative(m: Mix, kf: number, kr: number) {
	const nu = kf * m.h2 * m.i2 - kr * m.hi * m.hi;
	return { nu, f: kf * m.h2 * m.i2, r: kr * m.hi * m.hi };
}

/**
 * Integrates the rate law from `start` under `conditions`, applying `changes` at
 * their times, and records a sample every `dt` seconds up to `until` (s). Fourth-
 * order Runge–Kutta, with sub-steps short compared with the relaxation time; an
 * interval many relaxation times long uses the exact solution (`mixAt`) instead.
 */
export function simulate(
	start: Mix,
	conditions: Conditions,
	changes: readonly Change[],
	until: number,
	dt: number
): Sample[] {
	const todo = [...changes].sort((a, b) => a.at - b.at);
	let m = { ...start };
	let { T, lowering } = conditions;
	let done = 0;
	let undone = 0;
	let t = 0;
	const out: Sample[] = [];
	const record = () => {
		const r = rates(m, T, lowering);
		out.push({ t, ...m, forward: r.forward, reverse: r.reverse, done, undone, T, lowering });
	};
	const apply = (c: Change) => {
		if (c.T !== undefined) T = c.T;
		if (c.lowering !== undefined) lowering = c.lowering;
		if (c.addH2) m = { ...m, h2: Math.max(0, m.h2 + c.addH2) };
	};
	let next = 0;
	while (next < todo.length && todo[next].at <= 0) apply(todo[next++]);
	record();
	const steps = Math.round(until / dt);
	for (let s = 1; s <= steps; s++) {
		const tEnd = s * dt;
		while (t < tEnd - 1e-12) {
			const stop = next < todo.length ? Math.min(tEnd, todo[next].at) : tEnd;
			const kf = kForward(T, lowering);
			const kr = kReverse(T, lowering);
			// Relaxation rate of the linearised equation: dν/dx.
			const lambda = kf * (m.h2 + m.i2) + 4 * kr * m.hi + 1e-30;
			if ((stop - t) * lambda > 50) {
				// Stiff (a fast catalysed run, recorded sparsely): RK4 would need up to
				// 10⁶ sub-steps per record. The conditions are fixed until `stop`, so take
				// the exact solution, and integrate the forward and reverse counts on
				// log-spaced points (fine during the relaxation, coarse once settled).
				const c = { T, lowering };
				const m0 = m;
				const span = stop - t;
				const h0 = 1 / (20 * lambda);
				const N = 200;
				let prevT = 0;
				let prev = rates(m0, T, lowering);
				for (let i = 1; i <= N; i++) {
					const tt = i === N ? span : Math.min(span, h0 * Math.pow(span / h0, i / N));
					const mi = mixAt(m0, c, tt);
					const ri = rates(mi, T, lowering);
					done += ((prev.forward + ri.forward) / 2) * (tt - prevT);
					undone += ((prev.reverse + ri.reverse) / 2) * (tt - prevT);
					prev = ri;
					prevT = tt;
					m = mi;
				}
				t = stop;
				while (next < todo.length && todo[next].at <= t + 1e-12) apply(todo[next++]);
				continue;
			}
			const n = Math.max(1, Math.ceil((stop - t) * lambda * 20));
			const h = (stop - t) / n;
			for (let i = 0; i < n; i++) {
				const at = (x: number) => ({ h2: m.h2 - x, i2: m.i2 - x, hi: m.hi + 2 * x });
				const d1 = derivative(m, kf, kr);
				const d2 = derivative(at((h / 2) * d1.nu), kf, kr);
				const d3 = derivative(at((h / 2) * d2.nu), kf, kr);
				const d4 = derivative(at(h * d3.nu), kf, kr);
				const dx = (h / 6) * (d1.nu + 2 * d2.nu + 2 * d3.nu + d4.nu);
				done += (h / 6) * (d1.f + 2 * d2.f + 2 * d3.f + d4.f);
				undone += (h / 6) * (d1.r + 2 * d2.r + 2 * d3.r + d4.r);
				m = at(dx);
			}
			t = stop;
			while (next < todo.length && todo[next].at <= t + 1e-12) apply(todo[next++]);
		}
		t = tEnd;
		record();
	}
	return out;
}

/** The sample at model time `t` (linear interpolation between records). */
export function sampleAt(samples: readonly Sample[], t: number): Sample {
	if (samples.length === 0) throw new Error('no samples');
	const dt = samples.length > 1 ? samples[1].t - samples[0].t : 1;
	const u = Math.max(0, t / dt);
	const i = Math.min(samples.length - 1, Math.floor(u));
	const j = Math.min(samples.length - 1, i + 1);
	const f = Math.min(1, u - i);
	const a = samples[i];
	const b = samples[j];
	const mix = (p: number, q: number) => p + (q - p) * f;
	return {
		...a,
		t: mix(a.t, b.t),
		h2: mix(a.h2, b.h2),
		i2: mix(a.i2, b.i2),
		hi: mix(a.hi, b.hi),
		forward: mix(a.forward, b.forward),
		reverse: mix(a.reverse, b.reverse),
		done: mix(a.done, b.done),
		undone: mix(a.undone, b.undone)
	};
}

/**
 * Time (s) for a mixture to get within `within` (a share of the way, default 1 %)
 * of its equilibrium, at fixed conditions. Bisection on the integrated run.
 */
export function timeToEquilibrium(start: Mix, c: Conditions, within = 0.01): number {
	const eq = equilibriumMix(start, c.T);
	const gap0 = Math.abs(eq.hi - start.hi);
	if (gap0 === 0) return 0;
	// A time scale: the relaxation time at equilibrium.
	const kf = kForward(c.T, c.lowering);
	const kr = kReverse(c.T, c.lowering);
	const tau = 1 / (kf * (eq.h2 + eq.i2) + 4 * kr * eq.hi);
	const until = tau * 40;
	const dt = until / 4000;
	const run = simulate(start, c, [], until, dt);
	const i = run.findIndex((s) => Math.abs(eq.hi - s.hi) <= within * gap0);
	return i < 0 ? Infinity : run[i].t;
}

/** Half-life of the starting hydrogen (s): first time [H₂] falls to half. */
export function halfLife(start: Mix, c: Conditions): number {
	const kf = kForward(c.T, c.lowering);
	const tau = 1 / (kf * (start.h2 + start.i2));
	const until = tau * 20;
	const run = simulate(start, c, [], until, until / 4000);
	const i = run.findIndex((s) => s.h2 <= start.h2 / 2);
	return i < 0 ? Infinity : run[i].t;
}

/**
 * The exact solution at fixed conditions. With x the extent of H₂ + I₂ → 2 HI,
 * dx/dt = k_f(h₂ − x)(i₂ − x) − k_r(hi + 2x)² = α(x − r₁)(x − r₂), a quadratic with
 * roots r₁ (the equilibrium) and r₂, so ln((x − r₁)/(x − r₂)) grows linearly in time.
 */
export function mixAt(start: Mix, c: Conditions, t: number): Mix {
	const kf = kForward(c.T, c.lowering);
	const kr = kReverse(c.T, c.lowering);
	const alpha = kf - 4 * kr;
	const beta = -kf * (start.h2 + start.i2) - 4 * kr * start.hi;
	const gamma = kf * start.h2 * start.i2 - kr * start.hi * start.hi;
	const of = (x: number): Mix => ({ h2: start.h2 - x, i2: start.i2 - x, hi: start.hi + 2 * x });
	if (Math.abs(alpha) < 1e-300) return of((-gamma / beta) * (1 - Math.exp(beta * t)));
	const disc = Math.sqrt(beta * beta - 4 * alpha * gamma);
	const roots = [(-beta - disc) / (2 * alpha), (-beta + disc) / (2 * alpha)];
	// The equilibrium root lies between −hi/2 and min(h₂, i₂).
	const lo = -start.hi / 2 - 1e-15;
	const hi = Math.min(start.h2, start.i2) + 1e-15;
	const r1 = roots.find((r) => r >= lo && r <= hi) ?? roots[0];
	const r2 = r1 === roots[0] ? roots[1] : roots[0];
	if (Math.abs(r1) < 1e-18 && Math.abs(gamma) < 1e-30) return of(0);
	const C = (0 - r1) / (0 - r2);
	const e = C * Math.exp(alpha * (r1 - r2) * t);
	return of((r1 - r2 * e) / (1 - e));
}
