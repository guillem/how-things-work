/**
 * Oscillators: a mass on a spring and a pendulum, with friction (damping)
 * and an optional periodic push.
 *
 * Mass on a spring (SI units):  m·x″ = −k·x − c·x′ + F₀·cos(ω t)
 *   natural frequency f₀ = (1/2π)·√(k/m); damping ratio ζ = c / (2√(k m)).
 * Pendulum (length L, small or large swings): θ″ = −(g/L)·sin θ − γ·θ′;
 *   small swings have period 2π·√(L/g), independent of the mass and (nearly)
 *   of the amplitude.
 *
 * Motion is integrated with fourth-order Runge–Kutta; the steady amplitude of
 * the driven spring also has an exact formula (resonance curve), used for the
 * plot and checked against the simulation in the tests.
 */

export const G = 9.81;
const TAU = 2 * Math.PI;

export interface Spring {
	/** Mass (kg). */
	m: number;
	/** Stiffness (N/m). */
	k: number;
	/** Damping coefficient (N·s/m). */
	c: number;
}

export interface Drive {
	/** Push amplitude (N). */
	F0: number;
	/** Push frequency (Hz). */
	f: number;
}

/** Natural frequency (Hz) of an undamped spring: (1/2π)·√(k/m). */
export const naturalFrequency = ({ m, k }: Spring) => Math.sqrt(k / m) / TAU;

/** Damping ratio: < 1 oscillates (underdamped), 1 critically damped, > 1 creeps back. */
export const dampingRatio = ({ m, k, c }: Spring) => c / (2 * Math.sqrt(k * m));

/** Frequency (Hz) of the free, damped oscillation: f₀·√(1 − ζ²) (0 when ζ ≥ 1). */
export const dampedFrequency = (s: Spring) =>
	naturalFrequency(s) * Math.sqrt(Math.max(0, 1 - dampingRatio(s) ** 2));

/** Quality factor Q = 1/(2ζ): roughly how many swings it takes to lose most of its energy (×π). */
export const quality = (s: Spring) => 1 / (2 * dampingRatio(s));

/**
 * Steady-state amplitude (m) of a spring pushed at frequency f:
 *   A = F₀ / √((k − m ω²)² + (c ω)²).
 */
export function steadyAmplitude({ m, k, c }: Spring, { F0, f }: Drive) {
	const w = TAU * f;
	return F0 / Math.sqrt((k - m * w * w) ** 2 + (c * w) ** 2);
}

/** Frequency (Hz) at which the steady amplitude is largest: f₀·√(1 − 2ζ²) (0 if ζ² ≥ ½). */
export const peakFrequency = (s: Spring) =>
	naturalFrequency(s) * Math.sqrt(Math.max(0, 1 - 2 * dampingRatio(s) ** 2));

/** Phase lag (radians) of the steady motion behind the push: 0 slow, π/2 at f₀, → π fast. */
export function phaseLag({ m, k, c }: Spring, f: number) {
	const w = TAU * f;
	return Math.atan2(c * w, k - m * w * w);
}

export interface Motion {
	t: Float64Array;
	x: Float64Array;
	v: Float64Array;
}

/**
 * Integrates the spring from position x0 (m) and speed v0 (m/s) for `seconds`,
 * sampling every `sample` s (RK4 with steps ≤ 1 ms).
 */
export function springMotion(
	s: Spring,
	x0: number,
	v0: number,
	seconds: number,
	drive: Drive = { F0: 0, f: 0 },
	sample = 1 / 60
): Motion {
	const n = Math.round(seconds / sample) + 1;
	const sub = Math.max(1, Math.ceil(sample / 0.001));
	const h = sample / sub;
	const out = { t: new Float64Array(n), x: new Float64Array(n), v: new Float64Array(n) };
	let x = x0;
	let v = v0;
	let t = 0;
	const acc = (tt: number, xx: number, vv: number) =>
		(-s.k * xx - s.c * vv + drive.F0 * Math.cos(TAU * drive.f * tt)) / s.m;
	for (let i = 0; i < n; i++) {
		out.t[i] = t;
		out.x[i] = x;
		out.v[i] = v;
		for (let j = 0; j < sub; j++) {
			const a1 = acc(t, x, v);
			const a2 = acc(t + h / 2, x + (h / 2) * v, v + (h / 2) * a1);
			const a3 = acc(t + h / 2, x + (h / 2) * (v + (h / 2) * a1), v + (h / 2) * a2);
			const a4 = acc(t + h, x + h * (v + (h / 2) * a2), v + h * a3);
			x += (h / 6) * (v + 2 * (v + (h / 2) * a1) + 2 * (v + (h / 2) * a2) + (v + h * a3));
			v += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
			t += h;
		}
	}
	return out;
}

/** Energy (J) stored in the spring and the moving mass. */
export const springEnergy = ({ m, k }: Spring, x: number, v: number) =>
	0.5 * k * x * x + 0.5 * m * v * v;

// ------------------------------------------------------------ pendulum

/** Small-swing period (s) of a pendulum of length L (m): 2π√(L/g). */
export const pendulumPeriod = (L: number) => TAU * Math.sqrt(L / G);

/**
 * Pendulum swing from angle a0 (degrees) at rest, with damping γ (1/s),
 * sampled every `sample` s (full sin θ: large swings are slower).
 */
export function pendulumMotion(L: number, a0: number, seconds: number, gamma = 0, sample = 1 / 60) {
	const n = Math.round(seconds / sample) + 1;
	const sub = Math.max(1, Math.ceil(sample / 0.001));
	const h = sample / sub;
	const theta = new Float64Array(n);
	let th = (a0 * Math.PI) / 180;
	let w = 0;
	const acc = (a: number, ww: number) => -(G / L) * Math.sin(a) - gamma * ww;
	for (let i = 0; i < n; i++) {
		theta[i] = th;
		for (let j = 0; j < sub; j++) {
			const k1a = w;
			const k1w = acc(th, w);
			const k2a = w + (h / 2) * k1w;
			const k2w = acc(th + (h / 2) * k1a, k2a);
			const k3a = w + (h / 2) * k2w;
			const k3w = acc(th + (h / 2) * k2a, k3a);
			const k4a = w + h * k3w;
			const k4w = acc(th + h * k3a, k4a);
			th += (h / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
			w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
		}
	}
	return theta;
}

/** Period (s) measured from a simulated swing: time between successive upward zero crossings. */
export function measuredPeriod(values: Float64Array, sample: number) {
	const crossings: number[] = [];
	for (let i = 1; i < values.length; i++)
		if (values[i - 1] < 0 && values[i] >= 0) {
			const u = -values[i - 1] / (values[i] - values[i - 1]);
			crossings.push((i - 1 + u) * sample);
		}
	if (crossings.length < 2) return NaN;
	return (crossings.at(-1)! - crossings[0]) / (crossings.length - 1);
}

/** The spring the page starts with: 1 kg on 40 N/m (≈ 1 Hz), lightly damped. */
export const DEFAULT_SPRING: Spring = { m: 1, k: 4 * Math.PI ** 2, c: 0.3 };
