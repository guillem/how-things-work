/**
 * The two standard testbeds of predictability research, integrated with fourth-order
 * Runge–Kutta, and what forecasters do with them: single forecasts, ensembles, probabilities,
 * a reliability check and an ensemble Kalman filter.
 *
 * Lorenz 96 (Lorenz 1996, "Predictability: a problem partly solved"): K = 40 values x_k round
 * a latitude circle, dx_k/dt = (x_{k+1} − x_{k−2}) x_{k−1} − x_k + F, with F = 8. The quadratic
 * term carries values round the ring (advection), −x_k is damping and F the heating that drives
 * it. Lorenz scaled one model time unit to 5 days, so that the model's errors double in about
 * the time real synoptic errors did in the forecast models of the day; the page uses that
 * scale: a 6-hour time step is 0.05.
 *
 * Lorenz 63 (Lorenz 1963): dx/dt = σ(y − x), dy/dt = x(ρ − z) − y, dz/dt = xy − βz with
 * σ = 10, ρ = 28, β = 8/3, the butterfly-shaped attractor, used for Palmer's picture of
 * flow-dependent predictability.
 *
 * Everything is seeded: the same seed gives the same weather, forecasts and members.
 */
import { rng } from '#lib/draw/math.ts';

// ---- random numbers --------------------------------------------------------------------------

/** A seeded standard normal generator (Box–Muller on mulberry32). */
export function gauss(seed: number) {
	const u = rng(seed);
	let spare: number | null = null;
	return () => {
		if (spare !== null) {
			const s = spare;
			spare = null;
			return s;
		}
		let a = u();
		while (a <= 1e-12) a = u();
		const b = u();
		const r = Math.sqrt(-2 * Math.log(a));
		spare = r * Math.sin(2 * Math.PI * b);
		return r * Math.cos(2 * Math.PI * b);
	};
}

// ---- Lorenz 96 -------------------------------------------------------------------------------

/** Number of cells round the latitude circle. */
export const K = 40;
/** The forcing of the true weather. */
export const F_TRUE = 8;
/** Model time step: 0.05 model units = 6 hours. */
export const DT = 0.05;
/** Model time units per day (Lorenz's scaling: 1 unit = 5 days). */
export const PER_DAY = 0.2;
/** Time steps per day. */
export const STEPS_PER_DAY = Math.round(PER_DAY / DT);

type Vec = Float64Array;

function l96Rate(x: Vec, F: number, out: Vec) {
	const n = x.length;
	for (let k = 0; k < n; k++) {
		const p1 = x[(k + 1) % n];
		const m1 = x[(k - 1 + n) % n];
		const m2 = x[(k - 2 + n) % n];
		out[k] = (p1 - m2) * m1 - x[k] + F;
	}
}

/** Scratch buffers for RK4, one set per state length. */
const scratch = new Map<number, Vec[]>();
function buffers(n: number) {
	let b = scratch.get(n);
	if (!b) {
		b = Array.from({ length: 5 }, () => new Float64Array(n));
		scratch.set(n, b);
	}
	return b;
}

/** One RK4 step of Lorenz 96 with forcing F, in place. */
export function l96Step(x: Vec, F = F_TRUE, dt = DT) {
	const n = x.length;
	const [k1, k2, k3, k4, tmp] = buffers(n);
	l96Rate(x, F, k1);
	for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k1[i];
	l96Rate(tmp, F, k2);
	for (let i = 0; i < n; i++) tmp[i] = x[i] + 0.5 * dt * k2[i];
	l96Rate(tmp, F, k3);
	for (let i = 0; i < n; i++) tmp[i] = x[i] + dt * k3[i];
	l96Rate(tmp, F, k4);
	for (let i = 0; i < n; i++) x[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

/** Runs `steps` steps from x (copied) and returns every state, x itself first. */
export function l96Run(x0: Vec, steps: number, F = F_TRUE) {
	const out: Vec[] = [Float64Array.from(x0)];
	const x = Float64Array.from(x0);
	for (let s = 0; s < steps; s++) {
		l96Step(x, F);
		out.push(Float64Array.from(x));
	}
	return out;
}

/**
 * A state on the attractor: every cell starts at F plus a seeded random nudge, and the model
 * runs for 50 days, long enough for chaos to forget the start, so different seeds give
 * independent weather.
 */
export function weather(seed: number) {
	const g = gauss(seed * 7919 + 1);
	const x = Float64Array.from({ length: K }, () => F_TRUE + g());
	for (let s = 0; s < 50 * STEPS_PER_DAY; s++) l96Step(x);
	return x;
}

/** Root-mean-square difference between two states. */
export function rms(a: ArrayLike<number>, b: ArrayLike<number>) {
	let s = 0;
	for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
	return Math.sqrt(s / a.length);
}

/** A measurement of `x` with independent Gaussian errors of standard deviation `sigma`. */
export function measure(x: Vec, sigma: number, seed: number) {
	const g = gauss(seed);
	return Float64Array.from(x, (v) => v + sigma * g());
}

/** The climate of Lorenz 96 at F = 8: mean and standard deviation of one cell, long run. */
export function climate(days = 2000, seed = 1) {
	const x = weather(seed);
	let s = 0;
	let s2 = 0;
	let n = 0;
	for (let st = 0; st < days * STEPS_PER_DAY; st++) {
		l96Step(x);
		for (let k = 0; k < K; k++) {
			s += x[k];
			s2 += x[k] * x[k];
		}
		n += K;
	}
	const mean = s / n;
	return { mean, sd: Math.sqrt(s2 / n - mean * mean) };
}

/** Climate of the true model, measured once (2000 days, every cell): used for skill limits. */
export const CLIMATE = { mean: 2.34, sd: 3.63 };

// ---- forecasts -------------------------------------------------------------------------------

export interface ForecastSetup {
	/** Which day's weather (seed of the truth). */
	seed: number;
	/** Standard deviation of the measurement error of each cell. */
	obsErr: number;
	/** Number of members (1 = a single forecast from the measurement). */
	members: number;
	/** Forcing of the forecast model (F_TRUE = a perfect model). */
	F: number;
	/** Forecast length in days. */
	days: number;
}

export interface Forecast {
	truth: Vec[];
	/** The measurement the forecast starts from (the analysis). */
	start: Vec;
	/** The forecast from the measurement itself (the control). */
	control: Vec[];
	/** Perturbed members: each starts from the measurement plus fresh noise of the same size. */
	members: Vec[][];
	/** Per time step: RMS error of the control, of the ensemble mean, and the ensemble spread. */
	err: number[];
	meanErr: number[];
	spread: number[];
}

/**
 * The truth from `seed`'s weather, a forecast from a measurement of it and `members − 1`
 * perturbed members. The perturbations have the size of the measurement error, so that the
 * truth is statistically one more member of the ensemble (in a perfect model).
 */
export function forecast(o: ForecastSetup): Forecast {
	const steps = Math.round(o.days * STEPS_PER_DAY);
	const x0 = weather(o.seed);
	const truth = l96Run(x0, steps);
	const start = measure(x0, o.obsErr, o.seed * 31 + 7);
	const control = l96Run(start, steps, o.F);
	const members: Vec[][] = [];
	for (let m = 1; m < o.members; m++) {
		const s = measure(start, o.obsErr, o.seed * 1009 + m * 17 + 3);
		members.push(l96Run(s, steps, o.F));
	}
	const all = [control, ...members];
	const err: number[] = [];
	const meanErr: number[] = [];
	const spread: number[] = [];
	const mean = new Float64Array(K);
	for (let s = 0; s <= steps; s++) {
		err.push(rms(control[s], truth[s]));
		mean.fill(0);
		for (const run of all) for (let k = 0; k < K; k++) mean[k] += run[s][k] / all.length;
		meanErr.push(rms(mean, truth[s]));
		let v = 0;
		for (const run of all) for (let k = 0; k < K; k++) v += (run[s][k] - mean[k]) ** 2;
		spread.push(Math.sqrt(v / (K * Math.max(1, all.length - 1))));
	}
	return { truth, start, control, members, err, meanErr, spread };
}

/**
 * The day a forecast stops being useful: when its RMS error first reaches the climate's
 * standard deviation, the error of simply forecasting the average weather.
 */
export function horizon(err: readonly number[], limit = CLIMATE.sd) {
	if (err.length > 0 && err[0] >= limit) return 0;
	for (let s = 1; s < err.length; s++)
		if (err[s] >= limit) {
			const f = (limit - err[s - 1]) / (err[s] - err[s - 1]);
			return (s - 1 + f) / STEPS_PER_DAY;
		}
	return Infinity;
}

/** Mean of several error curves, by root-mean-square at each time step. */
export function meanCurve(curves: readonly (readonly number[])[]) {
	return curves[0].map((_, s) =>
		Math.sqrt(curves.reduce((a, c) => a + c[s] ** 2, 0) / curves.length)
	);
}

// ---- Lyapunov exponents ----------------------------------------------------------------------

/**
 * Largest Lyapunov exponent by the two-trajectory (Benettin) method: follow a companion a tiny
 * distance away, renormalise every `every` steps and average the log growth.
 */
export function lyapunov(
	step: (x: Vec) => void,
	x0: Vec,
	opts: { dt: number; steps: number; every?: number; d0?: number }
) {
	const every = opts.every ?? 10;
	const d0 = opts.d0 ?? 1e-8;
	const x = Float64Array.from(x0);
	const y = Float64Array.from(x0);
	y[0] += d0;
	let sum = 0;
	let n = 0;
	for (let s = 1; s <= opts.steps; s++) {
		step(x);
		step(y);
		if (s % every === 0) {
			let d = 0;
			for (let i = 0; i < x.length; i++) d += (y[i] - x[i]) ** 2;
			d = Math.sqrt(d);
			sum += Math.log(d / d0);
			n++;
			for (let i = 0; i < x.length; i++) y[i] = x[i] + ((y[i] - x[i]) * d0) / d;
		}
	}
	return sum / (n * every * opts.dt);
}

// ---- Lorenz 63 -------------------------------------------------------------------------------

export const L63 = { sigma: 10, rho: 28, beta: 8 / 3 };
export const DT63 = 0.01;

function l63Rate(s: Vec, out: Vec) {
	out[0] = L63.sigma * (s[1] - s[0]);
	out[1] = s[0] * (L63.rho - s[2]) - s[1];
	out[2] = s[0] * s[1] - L63.beta * s[2];
}

/** One RK4 step of Lorenz 63, in place. */
export function l63Step(s: Vec, dt = DT63) {
	const [k1, k2, k3, k4, tmp] = buffers(3);
	l63Rate(s, k1);
	for (let i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * dt * k1[i];
	l63Rate(tmp, k2);
	for (let i = 0; i < 3; i++) tmp[i] = s[i] + 0.5 * dt * k2[i];
	l63Rate(tmp, k3);
	for (let i = 0; i < 3; i++) tmp[i] = s[i] + dt * k3[i];
	l63Rate(tmp, k4);
	for (let i = 0; i < 3; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}

// ---- many forecasts --------------------------------------------------------------------------

/** Error and spread curves averaged (as RMS) over `cases` start days. */
export function verify(o: Omit<ForecastSetup, 'seed'>, cases: number, seed0 = 1) {
	const err: number[][] = [];
	const meanErr: number[][] = [];
	const spread: number[][] = [];
	for (let c = 0; c < cases; c++) {
		const f = forecast({ ...o, seed: seed0 + c });
		err.push(f.err);
		meanErr.push(f.meanErr);
		spread.push(f.spread);
	}
	return { err: meanCurve(err), meanErr: meanCurve(meanErr), spread: meanCurve(spread) };
}

/** The event the probabilities are about: a cell's value above this. */
export const EVENT = 6;

/** The chance of rain (a value above EVENT) in each cell: the fraction of members above it. */
export function chances(runs: readonly Vec[][], step: number) {
	const out = new Float64Array(K);
	for (const run of runs) for (let k = 0; k < K; k++) if (run[step][k] > EVENT) out[k]++;
	for (let k = 0; k < K; k++) out[k] /= runs.length;
	return out;
}

export interface ReliabilityBin {
	/** Number of forecasts (cell × start day) in the bin. */
	count: number;
	/** Their mean forecast probability. */
	p: number;
	/** The fraction of them in which it rained. */
	observed: number;
}

/**
 * Reliability of ensemble probabilities of rain (a value above EVENT) at every whole day of
 * lead from 1 to `days`: every cell of every start day is one forecast; the forecasts are
 * grouped by their probability (the fraction of members above the threshold) in `bins` bins,
 * and each bin gets the fraction of times it rained. Also the frequency of rain in the truth
 * and the mean forecast probability, per day. `stride` > 1 uses only every stride-th cell, so
 * that the cells counted are far enough apart to be nearly independent.
 */
export function reliabilityByDay(
	o: Omit<ForecastSetup, 'seed' | 'days'>,
	days: number,
	cases: number,
	bins = 11,
	seed0 = 1000,
	stride = 1
) {
	const n = Array.from({ length: days }, () => new Array<number>(bins).fill(0));
	const hits = Array.from({ length: days }, () => new Array<number>(bins).fill(0));
	const prob = Array.from({ length: days }, () => new Array<number>(bins).fill(0));
	for (let c = 0; c < cases; c++) {
		const f = forecast({ ...o, days, seed: seed0 + c });
		const all = [f.control, ...f.members];
		for (let d = 1; d <= days; d++) {
			const s = d * STEPS_PER_DAY;
			const pk = chances(all, s);
			for (let k = 0; k < K; k += stride) {
				const p = pk[k];
				const b = Math.min(bins - 1, Math.round(p * (bins - 1)));
				n[d - 1][b]++;
				prob[d - 1][b] += p;
				if (f.truth[s][k] > EVENT) hits[d - 1][b]++;
			}
		}
	}
	return n.map((counts, d) => {
		const total = counts.reduce((a, v) => a + v, 0);
		const rained = hits[d].reduce((a, v) => a + v, 0);
		const meanP = prob[d].reduce((a, v) => a + v, 0) / total;
		const binned: ReliabilityBin[] = counts.map((count, b) => ({
			count,
			p: count ? prob[d][b] / count : b / (bins - 1),
			observed: count ? hits[d][b] / count : NaN
		}));
		return { day: d + 1, bins: binned, rainFreq: rained / total, meanP };
	});
}

// ---- forecast, observe, correct --------------------------------------------------------------

/** Gaspari–Cohn (1999) fifth-order compactly supported correlation, zero beyond 2c. */
function gaspariCohn(d: number, c: number) {
	const r = Math.abs(d) / c;
	if (r >= 2) return 0;
	if (r <= 1) return -0.25 * r ** 5 + 0.5 * r ** 4 + 0.625 * r ** 3 - (5 / 3) * r ** 2 + 1;
	return (
		(1 / 12) * r ** 5 - 0.5 * r ** 4 + 0.625 * r ** 3 + (5 / 3) * r ** 2 - 5 * r + 4 - 2 / (3 * r)
	);
}

export interface CycleSetup {
	seed: number;
	/** Observation error (standard deviation). */
	obsErr: number;
	/** Observe every `spacing`-th cell. */
	spacing: number;
	/** Days between observations. */
	every: number;
	members: number;
	days: number;
	/** Multiplicative inflation of the spread before each correction. */
	inflation?: number;
	/** Localisation half-width in cells. */
	radius?: number;
}

/**
 * The forecast–observe–correct cycle with a serial ensemble square-root filter (Whitaker &
 * Hamill 2002): the ensemble runs forward; at each observation time the cells observed (with
 * error `obsErr`) pull every member towards the observation, by an amount set by the
 * ensemble's own spread and the observation error (the Kalman gain), spreading the
 * correction to nearby cells through the ensemble's correlations (localised with
 * Gaspari–Cohn). A free forecast from the same start runs alongside for comparison.
 */
export function cycle(o: CycleSetup) {
	const steps = Math.round(o.days * STEPS_PER_DAY);
	const every = Math.max(1, Math.round(o.every * STEPS_PER_DAY));
	const infl = o.inflation ?? 1.05;
	const radius = o.radius ?? 4;
	const x0 = weather(o.seed);
	const truth = l96Run(x0, steps);
	const start = measure(x0, o.obsErr, o.seed * 31 + 7);
	const free = l96Run(start, steps);
	const ens: Vec[] = [];
	for (let m = 0; m < o.members; m++) ens.push(measure(start, o.obsErr, o.seed * 977 + m * 13 + 5));
	const g = gauss(o.seed * 7 + 11);
	const M = o.members;
	const mean = new Float64Array(K);
	const hx = new Float64Array(M);
	const analysis: Vec[] = [];
	const obs: { step: number; cells: number[]; values: number[] }[] = [];
	const freeErr: number[] = [];
	const anaErr: number[] = [];
	const spread: number[] = [];
	const ensMean = () => {
		mean.fill(0);
		for (const e of ens) for (let k = 0; k < K; k++) mean[k] += e[k] / M;
		return mean;
	};
	const record = (s: number) => {
		const m = ensMean();
		analysis.push(Float64Array.from(m));
		anaErr.push(rms(m, truth[s]));
		freeErr.push(rms(free[s], truth[s]));
		let v = 0;
		for (const e of ens) for (let k = 0; k < K; k++) v += (e[k] - m[k]) ** 2;
		spread.push(Math.sqrt(v / (K * (M - 1))));
	};
	record(0);
	for (let s = 1; s <= steps; s++) {
		for (const e of ens) l96Step(e);
		if (s % every === 0) {
			// inflate the spread about the mean
			const m = ensMean();
			for (const e of ens) for (let k = 0; k < K; k++) e[k] = m[k] + infl * (e[k] - m[k]);
			const cells: number[] = [];
			const values: number[] = [];
			for (let j = 0; j < K; j += o.spacing) {
				const y = truth[s][j] + o.obsErr * g();
				cells.push(j);
				values.push(y);
				// serial square-root update with observation j
				const mm = ensMean();
				let hm = 0;
				for (let i = 0; i < M; i++) hm += ens[i][j] / M;
				let pHH = 0;
				for (let i = 0; i < M; i++) {
					hx[i] = ens[i][j] - hm;
					pHH += hx[i] * hx[i];
				}
				pHH /= M - 1;
				const R = o.obsErr ** 2;
				const alpha = 1 / (1 + Math.sqrt(R / (pHH + R)));
				for (let k = 0; k < K; k++) {
					const d = Math.min(Math.abs(k - j), K - Math.abs(k - j));
					const loc = gaspariCohn(d, radius);
					if (loc === 0) continue;
					let pXH = 0;
					for (let i = 0; i < M; i++) pXH += (ens[i][k] - mm[k]) * hx[i];
					pXH /= M - 1;
					const gain = (loc * pXH) / (pHH + R);
					const shift = gain * (y - hm);
					for (let i = 0; i < M; i++) {
						const dev = ens[i][k] - mm[k];
						ens[i][k] = mm[k] + shift + dev - alpha * gain * hx[i];
					}
				}
			}
			obs.push({ step: s, cells, values });
		}
		record(s);
	}
	return { truth, free, analysis, obs, freeErr, anaErr, spread };
}

/** Points along the Lorenz 63 attractor, every `every` steps after a spin-up. */
export function l63Orbit(n: number, every = 2) {
	const s = Float64Array.from([1, 1, 1]);
	for (let i = 0; i < 2000; i++) l63Step(s);
	const out: [number, number, number][] = [];
	for (let i = 0; i < n * every; i++) {
		l63Step(s);
		if (i % every === 0) out.push([s[0], s[1], s[2]]);
	}
	return out;
}

/**
 * A cloud of `n` starts within `radius` of `centre` (a seeded Gaussian ball), run forward:
 * returns every member's state at each of `frames + 1` times `dt·every` apart.
 */
export function l63Cloud(
	centre: readonly number[],
	n: number,
	radius: number,
	frames: number,
	every: number,
	seed: number
) {
	const g = gauss(seed);
	const members = Array.from({ length: n }, () =>
		Float64Array.from(centre, (v) => v + radius * g())
	);
	const out: [number, number, number][][] = [];
	const snap = () => out.push(members.map((m) => [m[0], m[1], m[2]] as [number, number, number]));
	snap();
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < every; i++) for (const m of members) l63Step(m);
		snap();
	}
	return out;
}

/** Root-mean-square distance of a cloud's members from their mean. */
export function cloudSpread(points: readonly (readonly number[])[]) {
	const d = points[0].length;
	const mean = new Array<number>(d).fill(0);
	for (const p of points) for (let i = 0; i < d; i++) mean[i] += p[i] / points.length;
	let v = 0;
	for (const p of points) for (let i = 0; i < d; i++) v += (p[i] - mean[i]) ** 2;
	return Math.sqrt(v / points.length);
}

/**
 * Three starts on the Lorenz 63 attractor for Palmer's picture, picked from 400 points along an
 * orbit by how much a cloud of 40 starts (radius 0.4) grows in 0.8 time units: a slow, a
 * middling and a fast grower.
 */
export const PALMER_STARTS: readonly (readonly [number, number, number])[] = [
	[16.546, 21.493, 33.112],
	[3.102, 4.924, 14.776],
	[-14.183, -9.929, 38.494]
];
/** Time steps (of DT63) the clouds run for, and members per cloud. */
export const PALMER_STEPS = 80;
export const PALMER_MEMBERS = 40;
