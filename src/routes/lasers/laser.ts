/**
 * The laser rate equations, for one cavity mode and a gain medium of N atoms.
 *
 * Populations: N₂ atoms in the upper laser level; the lower laser level holds N₁ atoms.
 *   - four-level: the pump lifts atoms from the ground state to a pump band that empties at once
 *     into the upper level, and the lower laser level empties at once into the ground state, so
 *     N₁ = 0 and the inversion is ΔN = N₂ (Nd:YAG at 1064 nm is close to this).
 *   - three-level: the lower laser level is the ground state, N₁ = N − N₂ and ΔN = 2N₂ − N
 *     (ruby is the classic example).
 *   - two-level: the pump drives the laser transition itself, so it stimulates emission as
 *     often as absorption: dN₂/dt gains W·(N₁ − N₂), never W·N₁.
 *
 * Photons: q in the cavity mode. Stimulated emission adds K·ΔN·q per second (absorption by the
 * lower level is the negative part of ΔN), spontaneous emission into this one mode adds K·N₂
 * (the same coefficient: the rate into a mode holding q photons goes as q + 1), and the photons
 * leave after τc on average, through the output mirror or by internal loss:
 *
 *   dq/dt  = K·ΔN·q + K·N₂ − q/τc
 *   dN₂/dt = pump − N₂/τ − K·ΔN·q
 *
 * with K = 2σ/(A·t_rt) (a photon makes one round trip of t_rt through a rod of mode area A,
 * where each inverted atom offers the cross-section σ twice) and 1/τc = (−ln R + L)/t_rt for an
 * output mirror of reflectivity R, a back mirror of 100% and an internal round-trip loss L.
 * Threshold is K·ΔN·τc = 1: gain per round trip equal to loss per round trip.
 *
 * Constants are Nd:YAG's (Koechner, Solid-State Laser Engineering, 6th ed., 2006: σ = 2.8·10⁻¹⁹
 * cm², τ = 230 µs, 1.38·10²⁰ Nd ions per cm³ at 1 at.%) in a 10 cm cavity with a 5 cm rod and a
 * 0.5 mm mode radius; the three- and two-level media keep the same atoms and change only the level
 * scheme, so that the scheme alone makes the difference. Every pump photon (808 nm) is assumed
 * to put one atom in the upper level.
 */

// ------------------------------------------------------------ constants

const H = 6.62607015e-34;
const C = 299792458;
/** Laser photon energy (1064 nm), J. */
export const PHOTON_J = (H * C) / 1064e-9;
/** Pump photon energy (808 nm), J. */
export const PUMP_PHOTON_J = (H * C) / 808e-9;
/** Upper-level lifetime, s. */
export const TAU = 230e-6;
/** Emission cross-section, cm². */
export const SIGMA = 2.8e-19;
/** Nd ions per cm³ (1 at.% in YAG). */
const DENSITY = 1.38e20;
/** Rod length and mode radius, cm. */
const ROD_CM = 5;
const MODE_RADIUS_CM = 0.05;
const AREA = Math.PI * MODE_RADIUS_CM ** 2;
/** Round-trip time of a 10 cm cavity, s. */
export const T_RT = (2 * 0.1) / C;
/** Atoms inside the mode. */
export const N_ATOMS = DENSITY * AREA * ROD_CM;
/** Stimulated rate per photon per inverted atom, 1/s. */
export const K = (2 * SIGMA) / (AREA * T_RT);
/** Internal loss per round trip (scattering, absorption in the rod and mirrors). */
export const INTERNAL_LOSS = 0.02;
/** Extra round-trip loss of a closed shutter (a Pockels cell between crossed polarisers). */
export const SHUTTER_LOSS = 10;

export type Medium = 'four' | 'three' | 'two';

export interface Cavity {
	medium: Medium;
	/** Output mirror reflectivity, 0–1. */
	R: number;
	/** Extra loss per round trip on top of the mirror and the internal loss. */
	extraLoss?: number;
}

/** Output coupling per round trip, −ln R. */
export const coupling = (R: number) => -Math.log(R);
/** Cavity photon lifetime, s. */
export const photonLifetime = (R: number, extraLoss = 0) =>
	T_RT / (coupling(R) + INTERNAL_LOSS + extraLoss);

/** Inversion ΔN for N₂ atoms in the upper level. */
export const inversion = (medium: Medium, n2: number) =>
	medium === 'four' ? n2 : 2 * n2 - N_ATOMS;
/** Atoms in the lower laser level. */
export const lowerLevel = (medium: Medium, n2: number) => (medium === 'four' ? 0 : N_ATOMS - n2);

/** Inversion at threshold, K·ΔN·τc = 1. */
export const thresholdInversion = (R: number, extraLoss = 0) =>
	1 / (K * photonLifetime(R, extraLoss));

/**
 * dN₂/dt = A − B·N₂ for a fixed photon number q and pump rate W (per atom able to absorb, 1/s).
 */
function populationRates(medium: Medium, W: number, q: number): [number, number] {
	const N = N_ATOMS;
	if (medium === 'four') return [W * N, W + 1 / TAU + K * q];
	if (medium === 'three') return [W * N + K * q * N, W + 1 / TAU + 2 * K * q];
	return [W * N + K * q * N, 2 * W + 1 / TAU + 2 * K * q];
}

/** Upper-level atoms in the steady state for a given photon number. */
const steadyN2 = (medium: Medium, W: number, q: number) => {
	const [a, b] = populationRates(medium, W, q);
	return a / b;
};

/** Pump rate per atom for an absorbed pump power, assuming the ground state holds ~all atoms. */
export const pumpRate = (watts: number) => watts / PUMP_PHOTON_J / N_ATOMS;

export interface Steady {
	/** Upper-level atoms. */
	n2: number;
	/** Lower-level atoms. */
	n1: number;
	/** Inversion ΔN = N₂ − N₁. */
	dn: number;
	/** Photons in the mode. */
	q: number;
	/** Power leaving through the output mirror, W. */
	out: number;
}

/**
 * The steady state of the rate equations: dq/dt = 0 and dN₂/dt = 0. For a given q the
 * population equation gives N₂, and the photon balance f(q) = K·ΔN·q + K·N₂ − q/τc falls from
 * K·N₂ > 0 at q = 0 through a single zero, found by bisection on log q.
 */
export function steadyState(cav: Cavity, W: number): Steady {
	const tc = photonLifetime(cav.R, cav.extraLoss);
	const f = (q: number) => {
		const n2 = steadyN2(cav.medium, W, q);
		return K * inversion(cav.medium, n2) * q + K * n2 - q / tc;
	};
	let lo = -12;
	let hi = 22;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (f(10 ** mid) > 0) lo = mid;
		else hi = mid;
	}
	const q = 10 ** ((lo + hi) / 2);
	const n2 = steadyN2(cav.medium, W, q);
	return {
		n2,
		n1: lowerLevel(cav.medium, n2),
		dn: inversion(cav.medium, n2),
		q,
		out: outputPower(q, cav.R)
	};
}

/** Power leaving through the output mirror for q photons in the mode, W. */
export const outputPower = (q: number, R: number) => (q * PHOTON_J * coupling(R)) / T_RT;

/** The medium alone (no mirrors, so no photons): the steady upper-level population. */
export const mediumOnly = (medium: Medium, W: number) => {
	const n2 = steadyN2(medium, W, 0);
	return { n2, n1: lowerLevel(medium, n2), dn: inversion(medium, n2) };
};

/** Factor by which light grows (> 1) or fades (< 1) on one round trip through the rod. */
export const roundTripGain = (dn: number) => Math.exp(K * dn * T_RT);

/** Absorbed pump power at threshold for a four-level laser (watts). */
export function thresholdPump(R: number) {
	const nth = thresholdInversion(R);
	return (nth / TAU) * PUMP_PHOTON_J;
}

// ------------------------------------------------------------ dynamics

export interface Trace {
	/** Times, s, at every integration step. */
	t: Float64Array;
	n2: Float64Array;
	q: Float64Array;
	/** Output power, W (zero while the shutter is closed). */
	out: Float64Array;
	/** Peak output power, W, and when. */
	peak: { out: number; t: number; q: number };
}

export interface RunOptions {
	medium?: Medium;
	R: number;
	/** Absorbed pump power, W, switched on at t = 0. */
	pump: number;
	/** The shutter stays closed until this time, s (0: always open). */
	openAt?: number;
	/** Duration, s. */
	until: number;
}

/**
 * Integrates the rate equations from an empty upper level and an empty cavity, with the pump
 * switched on at t = 0. Each step alternates exact solutions of the two linear halves (photons
 * with N₂ frozen, N₂ with q frozen; Strang splitting), so the stiff closed-shutter cavity, with
 * a photon lifetime of picoseconds against an upper-level lifetime of 230 µs, stays stable; the
 * step adapts to how fast either half changes.
 */
export function run(opts: RunOptions): Trace {
	const medium = opts.medium ?? 'four';
	const openAt = opts.openAt ?? 0;
	const W = pumpRate(opts.pump);
	const tOpen = photonLifetime(opts.R);
	const lossOpen = 1 / tOpen;
	const lossClosed = 1 / photonLifetime(opts.R, SHUTTER_LOSS);
	const dtMax = 20 * tOpen;

	const ts: number[] = [0];
	const n2s: number[] = [0];
	const qs: number[] = [0];
	let t = 0;
	let n2 = 0;
	let q = 0;
	const peak = { out: 0, t: 0, q: 0 };

	const popStep = (h: number) => {
		const [a, b] = populationRates(medium, W, q);
		const eq = a / b;
		n2 = eq + (n2 - eq) * Math.exp(-b * h);
	};
	const photonStep = (h: number, loss: number) => {
		const a = K * inversion(medium, n2) - loss;
		const b = K * n2;
		if (Math.abs(a * h) < 1e-9) q = q + (a * q + b) * h;
		else q = (q + b / a) * Math.exp(a * h) - b / a;
		if (q < 0) q = 0;
	};

	while (t < opts.until) {
		const closed = t < openAt;
		const loss = closed ? lossClosed : lossOpen;
		const a = K * inversion(medium, n2) - loss;
		const [, b] = populationRates(medium, W, q);
		let h = Math.min(dtMax, 0.02 / (Math.max(a, 0) + b + 1e-30), opts.until - t);
		// with the shutter closed the photons sit at a quasi-steady few: the slow N₂ sets the step
		if (closed) h = Math.min(h, openAt - t, TAU / 50);
		if (h <= 0) h = Math.min(dtMax, opts.until - t);
		popStep(h / 2);
		photonStep(h, loss);
		popStep(h / 2);
		t += h;
		ts.push(t);
		n2s.push(n2);
		qs.push(q);
		const o = t < openAt ? 0 : outputPower(q, opts.R);
		if (o > peak.out) {
			peak.out = o;
			peak.t = t;
			peak.q = q;
		}
	}
	const out = new Float64Array(qs.length);
	for (let i = 0; i < qs.length; i++) out[i] = ts[i] < openAt ? 0 : outputPower(qs[i], opts.R);
	return {
		t: Float64Array.from(ts),
		n2: Float64Array.from(n2s),
		q: Float64Array.from(qs),
		out,
		peak
	};
}

/** Index of the last sample at or before time s (binary search). */
export function indexAt(trace: Trace, s: number) {
	let lo = 0;
	let hi = trace.t.length - 1;
	if (s >= trace.t[hi]) return hi;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (trace.t[mid] <= s) lo = mid;
		else hi = mid;
	}
	return lo;
}

/**
 * Relaxation oscillations: for small deviations from the steady state at r times the threshold
 * pump, the linearised rate equations ring at ω² = (r − 1)/(τ·τc) − (r/2τ)² and decay at r/(2τ)
 * (Siegman, Lasers, 1986, ch. 25).
 */
export function relaxation(R: number, r: number) {
	const tc = photonLifetime(R);
	const decay = r / (2 * TAU);
	const w2 = (r - 1) / (TAU * tc) - decay * decay;
	return { freq: w2 > 0 ? Math.sqrt(w2) / (2 * Math.PI) : 0, decay };
}

/** Peaks of the output after `from`: times and powers, each a local maximum. */
export function peaks(trace: Trace, from = 0) {
	const out: { t: number; out: number }[] = [];
	for (let i = 1; i < trace.t.length - 1; i++) {
		if (trace.t[i] < from) continue;
		if (trace.out[i] > trace.out[i - 1] && trace.out[i] >= trace.out[i + 1])
			out.push({ t: trace.t[i], out: trace.out[i] });
	}
	return out;
}

/** Energy of the output between two times, J (trapezoids over the steps). */
export function energyBetween(trace: Trace, a: number, b: number) {
	let e = 0;
	for (let i = 1; i < trace.t.length; i++) {
		const t0 = trace.t[i - 1];
		const t1 = trace.t[i];
		if (t1 <= a || t0 >= b) continue;
		e += ((trace.out[i] + trace.out[i - 1]) / 2) * (Math.min(t1, b) - Math.max(t0, a));
	}
	return e;
}

/** Full width at half maximum of the output pulse around its peak, s. */
export function pulseWidth(trace: Trace) {
	const half = trace.peak.out / 2;
	const ip = indexAt(trace, trace.peak.t);
	let i = ip;
	while (i > 0 && trace.out[i] > half) i--;
	let j = ip;
	while (j < trace.t.length - 1 && trace.out[j] > half) j++;
	return trace.t[j] - trace.t[i];
}

/**
 * Wagner and Lengyel (1963): a Q-switched pulse that starts from an inversion Nᵢ ends at N_f with
 * Nᵢ − N_f = N_th·ln(Nᵢ/N_f) (four-level), and the photon number peaks when ΔN passes N_th at
 * Nᵢ − N_th − N_th·ln(Nᵢ/N_th). Solved here by bisection, for the page's readouts.
 */
export function qSwitchTheory(ni: number, nth: number) {
	let lo = 0;
	let hi = nth;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (ni - mid - nth * Math.log(ni / mid) > 0) hi = mid;
		else lo = mid;
	}
	const nf = (lo + hi) / 2;
	return { nf, qPeak: ni - nth - nth * Math.log(ni / nth) };
}
