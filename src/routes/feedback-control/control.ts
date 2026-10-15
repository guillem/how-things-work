/**
 * Feedback control: a PID controller closing the loop round four machines.
 *
 *   car       cruise control. The throttle sets the engine's force through the
 *             torque curve of Åström & Murray's cruise-control example (Feedback
 *             Systems, 2nd ed., 2021, §4.1): m·v′ = a·αₙ·T(αₙ v) − m g Cr
 *             − ½ρ Cd A v² − m g sin θ(x), with their parameters (top gear, αₙ = 10).
 *             Added here: the engine takes τₑ = 0.5 s to follow the throttle, and
 *             the speed reading is 0.2 s old.
 *   drone     height hold: m·z″ = thrust − m g + gusts; the controller adds the
 *             hover thrust for the 1 kg it thinks it carries (feed-forward).
 *   pendulum  a weight on a light 1 m rod balanced on a cart whose acceleration is
 *             the control: θ″ = (g sin θ − a cos θ) / L.
 *   arm       a two-joint arm in a vertical plane (masses at the elbow and the hand),
 *             each joint driven by its own motor and PID.
 *
 * The controller is digital, as real ones are: it runs every millisecond, holding
 * its output in between, with the derivative taken on the measurement (no kick when
 * the target jumps) and smoothed by a first-order filter, an output clamp, and an
 * optional anti-windup clamp on the integral. Plants are integrated with RK4 at the
 * same 1 ms step. Noise and gusts come from a seeded generator, so a run is the
 * same every time.
 */
import { rng } from '#lib/draw/math.ts';

export const G = 9.81;
/** Controller period (s). */
export const DT = 0.001;
const TAU = 2 * Math.PI;

// ------------------------------------------------------------ random numbers

/** Standard normal samples from a uniform generator (Box–Muller). */
export function gaussian(u: () => number) {
	return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(TAU * u());
}

// ------------------------------------------------------------ the controller

export interface Gains {
	kp: number;
	ki: number;
	kd: number;
}

export interface PidOptions extends Gains {
	/** Output limits. */
	min: number;
	max: number;
	/** Constant added to the output (e.g. the hover thrust). */
	ff?: number;
	/** Derivative filter time constant (s); 0 for none. */
	tf?: number;
	/** Stop integrating while the output is clamped and the error would push it further. */
	antiWindup?: boolean;
}

export interface PidState {
	i: number;
	d: number;
	prev: number;
	started: boolean;
}

export const pidState = (i = 0): PidState => ({ i, d: 0, prev: 0, started: false });

/** One controller tick: error e = r − y, measured y; returns the clamped output and its terms. */
export function pidTick(o: PidOptions, s: PidState, r: number, y: number, dt = DT) {
	const e = r - y;
	const rate = s.started ? (y - s.prev) / dt : 0;
	s.prev = y;
	s.started = true;
	const tf = o.tf ?? 0;
	const raw = -o.kd * rate;
	s.d = tf > 0 ? s.d + (raw - s.d) * (dt / (tf + dt)) : raw;
	const p = o.kp * e;
	const ff = o.ff ?? 0;
	const want = ff + p + s.i + s.d;
	const u = Math.min(o.max, Math.max(o.min, want));
	const i = s.i;
	const pushing = (want > o.max && e > 0) || (want < o.min && e < 0);
	if (!(o.antiWindup && pushing)) s.i += o.ki * e * dt;
	return { u, p, i, d: s.d, want };
}

// ------------------------------------------------------------ a closed loop

export interface Plant {
	/** Number of state variables. */
	n: number;
	/** State derivative for actuator command u at time t. */
	deriv(x: Float64Array, u: number, t: number, out: Float64Array): void;
	/** The quantity the sensor measures. */
	output(x: Float64Array): number;
	/** When true, the run stops (it fell over, crashed…). */
	ended?(x: Float64Array): boolean;
	/** Applied after every step (e.g. the ground stops a falling drone). */
	limit?(x: Float64Array): void;
}

export interface LoopOptions {
	plant: Plant;
	x0: number[];
	/** Target at time t. */
	target: (t: number) => number;
	pid: PidOptions;
	seconds: number;
	/** Age of the measurement the controller sees (s); rounded to whole ticks. */
	delay?: number;
	/** Standard deviation of the sensor noise (output units). */
	noise?: number;
	seed?: number;
	/** Sampling of the stored run (s). */
	sample?: number;
	/** Integral the controller starts with. */
	i0?: number;
}

export interface Run {
	sample: number;
	t: Float64Array;
	/** True output, target, controller output and its P, I, D terms. */
	y: Float64Array;
	r: Float64Array;
	u: Float64Array;
	p: Float64Array;
	i: Float64Array;
	d: Float64Array;
	/** What the controller wanted before its output clamp. */
	want: Float64Array;
	/** The measurement it saw (with noise and delay). */
	seen: Float64Array;
	/** Every state variable. */
	x: Float64Array[];
	/** Time the run stopped early (Infinity if it didn't). */
	end: number;
}

/** RK4 step of size h with the command u held. */
function rk4(plant: Plant, x: Float64Array, u: number, t: number, h: number, w: Float64Array[]) {
	const [k1, k2, k3, k4, tmp] = w;
	const n = plant.n;
	plant.deriv(x, u, t, k1);
	for (let j = 0; j < n; j++) tmp[j] = x[j] + (h / 2) * k1[j];
	plant.deriv(tmp, u, t + h / 2, k2);
	for (let j = 0; j < n; j++) tmp[j] = x[j] + (h / 2) * k2[j];
	plant.deriv(tmp, u, t + h / 2, k3);
	for (let j = 0; j < n; j++) tmp[j] = x[j] + h * k3[j];
	plant.deriv(tmp, u, t + h, k4);
	for (let j = 0; j < n; j++) x[j] += (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
}

/** Runs the loop for `seconds`, storing every `sample` s. */
export function runLoop(o: LoopOptions): Run {
	const sample = o.sample ?? 1 / 30;
	const every = Math.max(1, Math.round(sample / DT));
	const n = Math.floor(o.seconds / sample) + 1;
	const plant = o.plant;
	const arr = () => new Float64Array(n);
	const run: Run = {
		sample,
		t: arr(),
		y: arr(),
		r: arr(),
		u: arr(),
		p: arr(),
		i: arr(),
		d: arr(),
		want: arr(),
		seen: arr(),
		x: Array.from({ length: plant.n }, arr),
		end: Infinity
	};
	const x = Float64Array.from(o.x0);
	const w = Array.from({ length: 5 }, () => new Float64Array(plant.n));
	const s = pidState(o.i0 ?? 0);
	const lag = Math.max(0, Math.round((o.delay ?? 0) / DT));
	const buf = new Float64Array(lag + 1);
	const noise = o.noise ?? 0;
	const g = gaussian(rng(o.seed ?? 1));
	buf.fill(plant.output(x));
	let head = 0;
	let ended = false;
	for (let k = 0, idx = 0; idx < n; k++) {
		const t = k * DT;
		// the sensor: noisy now, seen `lag` ticks later
		buf[head] = plant.output(x) + (noise > 0 ? noise * g() : 0);
		const seen = buf[(head + 1) % (lag + 1)];
		head = (head + 1) % (lag + 1);
		const r = o.target(t);
		const c = pidTick(o.pid, s, r, seen);
		if (k % every === 0) {
			run.t[idx] = t;
			run.y[idx] = plant.output(x);
			run.r[idx] = r;
			run.u[idx] = c.u;
			run.p[idx] = c.p;
			run.i[idx] = c.i;
			run.d[idx] = c.d;
			run.want[idx] = c.want;
			run.seen[idx] = seen;
			for (let j = 0; j < plant.n; j++) run.x[j][idx] = x[j];
			idx++;
		}
		if (!ended) {
			rk4(plant, x, c.u, t, DT, w);
			plant.limit?.(x);
			if (plant.ended?.(x)) {
				ended = true;
				run.end = t;
			}
		}
	}
	return run;
}

/** Linear interpolation of a stored series at time s (clamped to its ends). */
export function at(run: Run, series: Float64Array, s: number) {
	const f = Math.max(0, s / run.sample);
	const i = Math.min(series.length - 2, Math.floor(f));
	const u = Math.min(1, f - i);
	return series[i] + (series[i + 1] - series[i]) * u;
}

/** Peaks of |series − ref| between t0 and t1: the swing's size, crest by crest. */
export function swings(run: Run, series: Float64Array, ref: number, t0 = 0, t1 = Infinity) {
	const out: { t: number; a: number }[] = [];
	const i0 = Math.max(1, Math.ceil(t0 / run.sample));
	const i1 = Math.min(series.length - 1, Math.floor(t1 / run.sample));
	for (let i = i0; i < i1; i++) {
		const a = Math.abs(series[i - 1] - ref);
		const b = Math.abs(series[i] - ref);
		const c = Math.abs(series[i + 1] - ref);
		if (b > a && b >= c && b > 1e-12) out.push({ t: i * run.sample, a: b });
	}
	return out;
}

/** Mean of a series over [t0, t1]. */
export function mean(run: Run, series: Float64Array, t0: number, t1: number) {
	const i0 = Math.max(0, Math.round(t0 / run.sample));
	const i1 = Math.min(series.length - 1, Math.round(t1 / run.sample));
	let s = 0;
	for (let i = i0; i <= i1; i++) s += series[i];
	return s / (i1 - i0 + 1);
}

/** Largest value of a series over [t0, t1]. */
export function peak(run: Run, series: Float64Array, t0 = 0, t1 = Infinity) {
	let m = -Infinity;
	const i1 = Math.min(series.length - 1, Math.floor(t1 / run.sample));
	for (let i = Math.max(0, Math.ceil(t0 / run.sample)); i <= i1; i++) m = Math.max(m, series[i]);
	return m;
}

// ------------------------------------------------------------ complex numbers

type C = [number, number];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => {
	const d = b[0] * b[0] + b[1] * b[1];
	return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cabs = (a: C) => Math.hypot(a[0], a[1]);
const cexp = (phase: number): C => [Math.cos(phase), Math.sin(phase)];

/** Root of a continuous f on [a, b] by bisection (f(a), f(b) of opposite signs). */
function bisect(f: (x: number) => number, a: number, b: number) {
	let fa = f(a);
	for (let k = 0; k < 200; k++) {
		const m = (a + b) / 2;
		const fm = f(m);
		if (fa * fm <= 0) b = m;
		else {
			a = m;
			fa = fm;
		}
	}
	return (a + b) / 2;
}

/** The PID's frequency response C(jω), with its derivative filter. */
function pidResponse(g: Gains, w: number, tf = 0): C {
	const d = cdiv([0, g.kd * w], [1, tf * w]);
	return [g.kp + d[0], d[1] - g.ki / w];
}

// ------------------------------------------------------------ the car

/** Åström & Murray's car (Feedback Systems, §4.1), in top gear. */
export const CAR = {
	m: 1600, // kg
	cr: 0.01, // rolling resistance
	cd: 0.32,
	area: 2.4, // m²
	rho: 1.3, // kg/m³
	tm: 190, // N·m, peak engine torque
	wm: 420, // rad/s, engine speed of peak torque
	beta: 0.4,
	alpha: 10, // top gear: engine rad/s per m/s
	/** Added here: engine response time (s) and age of the speed reading (s). */
	lag: 0.5,
	delay: 0.2
};

/** Engine torque (N·m) at engine speed ω (rad/s). */
export const torque = (w: number) => Math.max(0, CAR.tm * (1 - CAR.beta * (w / CAR.wm - 1) ** 2));
/** Force at the wheels (N) at full throttle and speed v (m/s). */
export const fullForce = (v: number) => CAR.alpha * torque(CAR.alpha * Math.max(0, v));
/** Rolling resistance plus air drag (N) at speed v on the flat. */
export const resistance = (v: number) =>
	CAR.m * G * CAR.cr * Math.sign(v) + 0.5 * CAR.rho * CAR.cd * CAR.area * v * v;
/** Force (N) of gravity along a slope of grade s (rise over run). */
export const slopeForce = (s: number) => CAR.m * G * Math.sin(Math.atan(s));
/** Throttle (0–1) that holds speed v on grade s. */
export const throttleToHold = (v: number, s = 0) => (resistance(v) + slopeForce(s)) / fullForce(v);

/** km/h ↔ m/s */
export const KMH = 1 / 3.6;

export type Road = 'flat' | 'hills' | 'climb';

const ramp = (x: number, a: number, b: number) => {
	const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return u * u * (3 - 2 * u);
};

/**
 * Grade (rise over run) at distance x (m) along the road:
 *   hills  flat for 400 m, then two rolling hills of ±2.5% (800 m each), then flat
 *   climb  flat for 300 m, a 1 km climb at 8.4%, then flat again
 */
export function grade(road: Road, x: number) {
	if (road === 'hills') {
		if (x < 400 || x > 2000) return 0;
		return 0.025 * Math.sin((TAU * (x - 400)) / 800);
	}
	if (road === 'climb') return 0.084 * (ramp(x, 300, 380) - ramp(x, 1260, 1340));
	return 0;
}

/** Height (m) of the road at x, integrated from its grade (Simpson, 2 m steps). */
export function roadHeight(road: Road, x: number) {
	const n = Math.max(2, 2 * Math.ceil(Math.abs(x) / 4));
	const h = x / n;
	let s = grade(road, 0) + grade(road, x);
	for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * grade(road, k * h);
	return (s * h) / 3;
}

/** The car as a plant: state [distance, speed, engine throttle]; the command is the throttle. */
export function carPlant(road: Road): Plant {
	return {
		n: 3,
		deriv(x, u, _t, out) {
			const v = x[1];
			const f = x[2] * fullForce(v) - resistance(v) - slopeForce(grade(road, x[0]));
			out[0] = v;
			out[1] = f / CAR.m;
			out[2] = (u - x[2]) / CAR.lag;
		},
		output: (x) => x[1]
	};
}

export interface CarOptions {
	road: Road;
	/** Gains in throttle (0–1) per m/s of error (and per second, × second). */
	gains: Gains;
	/** Open loop: hold this throttle instead. */
	fixed?: number;
	antiWindup?: boolean;
	/** Starting speed and target (m/s). */
	v0?: number;
	target?: number;
	seconds?: number;
	sample?: number;
}

/** A drive: starts at v0 on the flat, already at the throttle that holds v0. */
export function drive(o: CarOptions): Run {
	const v0 = o.v0 ?? 80 * KMH;
	const a0 = throttleToHold(v0);
	const fixed = o.fixed;
	return runLoop({
		plant: carPlant(o.road),
		x0: [0, v0, fixed ?? a0],
		target: () => o.target ?? 90 * KMH,
		pid:
			fixed !== undefined
				? { kp: 0, ki: 0, kd: 0, min: 0, max: 1, ff: fixed }
				: {
						...o.gains,
						min: 0,
						max: 1,
						tf: o.gains.kd > 0 ? 0.05 : 0,
						antiWindup: o.antiWindup
					},
		// a PI or PID car starts with the throttle it was holding in its integral
		i0: fixed === undefined && o.gains.ki > 0 ? a0 : 0,
		delay: CAR.delay,
		seconds: o.seconds ?? 90,
		sample: o.sample ?? 1 / 30
	});
}

/** The car linearised about speed v (m/s) on the flat at its holding throttle. */
export function carLinear(v: number) {
	const a0 = throttleToHold(v);
	const h = 1e-4;
	const dRes = (resistance(v + h) - resistance(v - h)) / (2 * h);
	const dFull = (fullForce(v + h) - fullForce(v - h)) / (2 * h);
	const beta = (dRes - a0 * dFull) / CAR.m; // 1/s
	const gain = fullForce(v) / CAR.m; // m/s² per unit throttle
	/** Steady speed change per unit throttle change: G(0) (m/s). */
	const g0 = gain / beta;
	/** Loop transfer of the plant (with its lag, delay and the 1 ms hold) at frequency ω. */
	const response = (w: number): C => {
		const den = cmul([beta, w], [1, CAR.lag * w]);
		return cmul(cdiv([gain, 0], den), cexp(-w * (CAR.delay + DT / 2)));
	};
	return { a0, beta, gain, g0, response };
}

/**
 * Speed (m/s) at which a P controller of gain kp (throttle per m/s) settles on the flat
 * with target r: where its throttle kp·(r − v) is just what holds v.
 */
export function pSettles(kp: number, r: number) {
	return bisect((v) => kp * (r - v) - throttleToHold(v), 0.1, r);
}

/**
 * Steady-state error left by a P controller of gain K on a plant of steady gain
 * G(0), for a target step Δr: Δr / (1 + K·G(0)).
 */
export const pOffset = (k: number, g0: number, dr = 1) => dr / (1 + k * g0);

/**
 * Ultimate gain Ku (throttle per m/s) and period Tu (s) of the car under P control at
 * speed v: the gain at which its loop gain reaches 1 where its phase lag is 180°.
 */
export function carUltimate(v = 90 * KMH) {
	const lin = carLinear(v);
	// phase lag of the car, of the engine's lag and of the delay (with the 1 ms hold)
	const lag = (w: number) =>
		Math.atan(w / lin.beta) + Math.atan(CAR.lag * w) + w * (CAR.delay + DT / 2);
	const w = bisect((x) => lag(x) - Math.PI, 1e-3, 100);
	return { ku: 1 / cabs(lin.response(w)), tu: TAU / w, w };
}

/**
 * Ziegler & Nichols (1942), "Optimum settings for automatic controllers", Trans. ASME
 * 64: 759–768, ultimate-sensitivity method: from the gain Ku at which a P controller
 * keeps the loop oscillating, and that oscillation's period Tu,
 *   P:   Kp = 0.5 Ku
 *   PI:  Kp = 0.45 Ku, Ti = Tu / 1.2
 *   PID: Kp = 0.6 Ku,  Ti = Tu / 2,  Td = Tu / 8
 * with Ki = Kp / Ti and Kd = Kp · Td.
 */
export function zieglerNichols(ku: number, tu: number, kind: 'P' | 'PI' | 'PID' = 'PID'): Gains {
	if (kind === 'P') return { kp: 0.5 * ku, ki: 0, kd: 0 };
	if (kind === 'PI') {
		const kp = 0.45 * ku;
		return { kp, ki: kp / (tu / 1.2), kd: 0 };
	}
	const kp = 0.6 * ku;
	return { kp, ki: kp / (tu / 2), kd: (kp * tu) / 8 };
}

// ------------------------------------------------------------ the drone

export const DRONE = {
	/** Mass the controller assumes (kg) and its hover thrust (N). */
	m: 1,
	maxThrust: 25, // N
	/** Derivative filter (s). */
	tf: 0.02
};

export interface DroneOptions {
	gains: Gains;
	/** Extra mass the controller doesn't know about (kg). */
	parcel?: number;
	/** Sensor noise (m) and its seed. */
	noise?: number;
	gusts?: boolean;
	/** Age of the height reading (s). */
	delay?: number;
	/** Start height and target (m); the target jumps at `jump` s. */
	z0?: number;
	target?: number;
	jump?: number;
	seconds?: number;
	sample?: number;
	seed?: number;
}

/**
 * Vertical gusts (N): a seeded random force, smoothed over about a second
 * (Ornstein–Uhlenbeck), about ±1.5 N, sampled every 10 ms.
 */
export function gustForce(seconds: number, seed = 7) {
	const g = gaussian(rng(seed));
	const h = 0.01;
	const n = Math.ceil(seconds / h) + 2;
	const out = new Float64Array(n);
	const tau = 0.8;
	const sigma = 1.5;
	let f = 0;
	for (let k = 0; k < n; k++) {
		out[k] = f;
		f += (-f / tau) * h + sigma * Math.sqrt((2 * h) / tau) * g();
	}
	return (t: number) => {
		const u = Math.max(0, t / h);
		const i = Math.min(n - 2, Math.floor(u));
		return out[i] + (out[i + 1] - out[i]) * (u - i);
	};
}

/** The drone hovering at z0 jumps to a new target height; state [height, climb rate]. */
export function fly(o: DroneOptions): Run {
	const seconds = o.seconds ?? 30;
	const m = DRONE.m + (o.parcel ?? 0);
	const gust = o.gusts ? gustForce(seconds + 1, o.seed ?? 7) : () => 0;
	const z0 = o.z0 ?? 1;
	const plant: Plant = {
		n: 2,
		deriv(x, u, t, out) {
			out[0] = x[1];
			out[1] = (u - m * G + gust(t)) / m;
		},
		output: (x) => x[0],
		// the ground
		limit(x) {
			if (x[0] < 0) {
				x[0] = 0;
				x[1] = Math.max(0, x[1]);
			}
		}
	};
	const jump = o.jump ?? 1;
	return runLoop({
		plant,
		x0: [z0, 0],
		target: (t) => (t < jump ? z0 : (o.target ?? 3)),
		pid: { ...o.gains, min: 0, max: DRONE.maxThrust, ff: DRONE.m * G, tf: DRONE.tf },
		delay: o.delay ?? 0,
		noise: o.noise ?? 0,
		seed: (o.seed ?? 7) + 1,
		seconds,
		sample: o.sample ?? 1 / 30
	});
}

/** Damping ratio of the drone under PD control: Kd / (2√(m·Kp)) (the spring's ζ). */
export const droneDamping = (g: Gains, m = DRONE.m) => g.kd / (2 * Math.sqrt(m * g.kp));
/** Overshoot (fraction) of a second-order step response with damping ratio ζ < 1. */
export const overshoot = (zeta: number) =>
	zeta >= 1 ? 0 : Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));

/**
 * The longest delay (s) of the height reading the drone's loop survives: its phase
 * margin divided by the frequency at which the loop gain is 1 (the 1 ms hold, half a
 * tick of delay, is taken off). Infinity when the loop never has a gain of 1.
 */
export function criticalDelay(g: Gains, m = DRONE.m) {
	const loop = (w: number) => cabs(pidResponse(g, w, DRONE.tf)) / (m * w * w);
	// |L| falls through 1 once (it starts huge and ends tiny)
	let hi = 1;
	while (loop(hi) > 1) hi *= 2;
	let lo = hi / 2;
	while (loop(lo) < 1 && lo > 1e-6) lo /= 2;
	const w = bisect((x) => loop(x) - 1, lo, hi);
	const c = pidResponse(g, w, DRONE.tf);
	const margin = Math.atan2(c[1], c[0]); // the plant's own phase is −180°
	return { delay: margin / w - DT / 2, w, margin };
}

// ------------------------------------------------------------ the balancing pole

export const POLE = {
	length: 1, // m
	/** Largest cart acceleration (m/s²). */
	maxPush: 30,
	/** Tilt at which the weight is on the floor (rad). */
	fallen: (85 * Math.PI) / 180
};

/**
 * Balancing from a tilt of `tilt0` degrees: state [cart position, cart speed, tilt,
 * tilt rate]; the controller pushes the cart under the weight (a = Kp θ + Kd θ′).
 */
export function balance(o: { gains: Gains; tilt0?: number; seconds?: number; sample?: number }) {
	const L = POLE.length;
	const plant: Plant = {
		n: 4,
		deriv(x, u, _t, out) {
			const a = -u; // the controller's output opposes the error θ − 0
			out[0] = x[1];
			out[1] = a;
			out[2] = x[3];
			out[3] = (G * Math.sin(x[2]) - a * Math.cos(x[2])) / L;
		},
		output: (x) => x[2],
		ended: (x) => Math.abs(x[2]) >= POLE.fallen
	};
	return runLoop({
		plant,
		x0: [0, 0, ((o.tilt0 ?? 6) * Math.PI) / 180, 0],
		target: () => 0,
		pid: { ...o.gains, min: -POLE.maxPush, max: POLE.maxPush },
		seconds: o.seconds ?? 20,
		sample: o.sample ?? 1 / 30
	});
}

// ------------------------------------------------------------ the robot arm

export const ARM = {
	l1: 0.5, // m, upper arm
	l2: 0.4, // m, forearm
	m1: 2, // kg at the elbow (the elbow motor)
	m2: 1, // kg at the hand
	/** Motor friction (N·m·s/rad) and torque limits (N·m). */
	b: 0.2,
	max1: 60,
	max2: 30
};

/** Joint angles (rad) that put the hand at (x, y) (m, from the shoulder; y up), elbow up. */
export function reach(x: number, y: number) {
	const { l1, l2 } = ARM;
	let r = Math.hypot(x, y);
	const rmin = Math.abs(l1 - l2) + 0.02;
	const rmax = l1 + l2 - 0.01;
	const k = r < rmin ? rmin / Math.max(r, 1e-9) : r > rmax ? rmax / r : 1;
	if (r < 1e-9) {
		x = rmin;
		y = 0;
	} else {
		x *= k;
		y *= k;
	}
	r = Math.hypot(x, y);
	const c2 = (r * r - l1 * l1 - l2 * l2) / (2 * l1 * l2);
	const q2 = -Math.acos(Math.max(-1, Math.min(1, c2)));
	const q1 = Math.atan2(y, x) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
	return { q1, q2, x, y, clamped: k !== 1 };
}

/** Elbow and hand positions (m) for joint angles q1, q2. */
export function joints(q1: number, q2: number) {
	const ex = ARM.l1 * Math.cos(q1);
	const ey = ARM.l1 * Math.sin(q1);
	return {
		ex,
		ey,
		hx: ex + ARM.l2 * Math.cos(q1 + q2),
		hy: ey + ARM.l2 * Math.sin(q1 + q2)
	};
}

/** State of the arm: joint angles, their rates, and the two integrals. */
export type ArmState = [number, number, number, number, number, number];

export interface ArmRun {
	sample: number;
	q1: Float64Array;
	q2: Float64Array;
	/** Every stored state, to restart from. */
	state: ArmState[];
	tau1: Float64Array;
	tau2: Float64Array;
}

/**
 * The arm moving its two joints to (target1, target2) from `from`, each joint under
 * its own PID (gains for the shoulder; the elbow, carrying less, gets half), with the
 * full two-link dynamics: M(q)·q″ + C(q, q′)·q′ + g(q) = τ − b·q′.
 */
export function moveArm(
	from: ArmState,
	target1: number,
	target2: number,
	gains: Gains,
	seconds = 8,
	sample = 1 / 30
): ArmRun {
	const { l1, l2, m1, m2, b } = ARM;
	const n = Math.floor(seconds / sample) + 1;
	const every = Math.round(sample / DT);
	const out: ArmRun = {
		sample,
		q1: new Float64Array(n),
		q2: new Float64Array(n),
		state: [],
		tau1: new Float64Array(n),
		tau2: new Float64Array(n)
	};
	let [q1, q2, w1, w2, i1, i2] = from;
	const g2: Gains = { kp: gains.kp / 2, ki: gains.ki / 2, kd: gains.kd / 2 };
	const accel = (a1: number, a2: number, v1: number, v2: number, t1: number, t2: number) => {
		const c = Math.cos(a2);
		const s = Math.sin(a2);
		const M11 = (m1 + m2) * l1 * l1 + m2 * l2 * l2 + 2 * m2 * l1 * l2 * c;
		const M12 = m2 * l2 * l2 + m2 * l1 * l2 * c;
		const M22 = m2 * l2 * l2;
		const h = m2 * l1 * l2 * s;
		const c1 = -h * (2 * v1 * v2 + v2 * v2);
		const c2 = h * v1 * v1;
		const gr1 = (m1 + m2) * G * l1 * Math.cos(a1) + m2 * G * l2 * Math.cos(a1 + a2);
		const gr2 = m2 * G * l2 * Math.cos(a1 + a2);
		const r1 = t1 - b * v1 - c1 - gr1;
		const r2 = t2 - b * v2 - c2 - gr2;
		const det = M11 * M22 - M12 * M12;
		return [(M22 * r1 - M12 * r2) / det, (M11 * r2 - M12 * r1) / det];
	};
	const torques = (a1: number, a2: number, v1: number, v2: number) => {
		const u1 = gains.kp * (target1 - a1) + i1 - gains.kd * v1;
		const u2 = g2.kp * (target2 - a2) + i2 - g2.kd * v2;
		return [
			Math.max(-ARM.max1, Math.min(ARM.max1, u1)),
			Math.max(-ARM.max2, Math.min(ARM.max2, u2))
		];
	};
	for (let k = 0, idx = 0; idx < n; k++) {
		const [t1, t2] = torques(q1, q2, w1, w2);
		if (k % every === 0) {
			out.q1[idx] = q1;
			out.q2[idx] = q2;
			out.tau1[idx] = t1;
			out.tau2[idx] = t2;
			out.state.push([q1, q2, w1, w2, i1, i2]);
			idx++;
		}
		// RK4 on (q1, q2, w1, w2) with the torques held
		const h = DT;
		const f = (a1: number, a2: number, v1: number, v2: number) => {
			const [d1, d2] = accel(a1, a2, v1, v2, t1, t2);
			return [v1, v2, d1, d2];
		};
		const k1 = f(q1, q2, w1, w2);
		const k2 = f(
			q1 + (h / 2) * k1[0],
			q2 + (h / 2) * k1[1],
			w1 + (h / 2) * k1[2],
			w2 + (h / 2) * k1[3]
		);
		const k3 = f(
			q1 + (h / 2) * k2[0],
			q2 + (h / 2) * k2[1],
			w1 + (h / 2) * k2[2],
			w2 + (h / 2) * k2[3]
		);
		const k4 = f(q1 + h * k3[0], q2 + h * k3[1], w1 + h * k3[2], w2 + h * k3[3]);
		const e1 = target1 - q1;
		const e2 = target2 - q2;
		q1 += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
		q2 += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
		w1 += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
		w2 += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
		// integrals, held while the motor is at its limit and the error pushes further
		if (!(Math.abs(t1) >= ARM.max1 && Math.sign(e1) === Math.sign(t1))) i1 += gains.ki * e1 * h;
		if (!(Math.abs(t2) >= ARM.max2 && Math.sign(e2) === Math.sign(t2))) i2 += g2.ki * e2 * h;
	}
	return out;
}

/** Gravity torques (N·m) the two joints must supply to hold angles q1, q2 still. */
export function holdingTorque(q1: number, q2: number) {
	const { l1, l2, m1, m2 } = ARM;
	return [
		(m1 + m2) * G * l1 * Math.cos(q1) + m2 * G * l2 * Math.cos(q1 + q2),
		m2 * G * l2 * Math.cos(q1 + q2)
	];
}
