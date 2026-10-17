/**
 * Electric motors and generators: the model behind the explainer. SI units
 * throughout (metres, seconds, amperes, teslas, volts, newtons, radians).
 *
 * One machine: a flat rectangular coil of N turns (sides L long, w apart, area
 * A = L·w) turning on a shaft in a uniform magnetic field B, connected to the
 * outside either through two slip rings or through a two-segment split-ring
 * commutator. This is the textbook simplification: real machines have many
 * coils, curved pole pieces and iron cores, which smooth the torque and the
 * voltage, but the physics is the same.
 *
 * Angles: θ is the angle between the coil's normal n̂ and the field B (B points
 * along +x, from the north pole on the left to the south pole on the right;
 * n̂ = (cos θ, sin θ), and θ grows anticlockwise as seen looking along the
 * shaft). The coil's two long sides sit at ±(w/2)·û with û = (−sin θ, cos θ):
 * side "a" at +û, side "b" at −û. A positive coil current flows out of the
 * page in side a (⊙) and into it in side b (⊗); its magnetic moment is then
 * m = N I A n̂ (right-hand rule).
 *
 * 1. Force and torque (motor). Each long side feels F = N B I L (F = I L × B),
 *    perpendicular to B, the two in opposite directions: a couple. The torque
 *    about the shaft is τ = m × B = −N B I A sin θ (anticlockwise positive):
 *    zero when the coil's plane is perpendicular to the field (θ = 0, π, the
 *    "dead points"), largest when the plane lies along the field.
 * 2. Induction (generator). The flux linkage is Φ = N B A cos θ; turning at ω
 *    the coil makes emf = −dΦ/dt = N B A ω sin θ, in the positive-current
 *    sense. Peak N B A ω, frequency = turns per second.
 * 3. The connection. Slip rings keep each side wired to the same terminal, so
 *    the outside sees the coil's own alternating emf. The commutator swaps the
 *    two sides' connections every half-turn, just as the coil passes a dead
 *    point: the outside sees |emf| (pulsing, never reversing), and a battery's
 *    current is reversed in the coil each half-turn, so the torque never
 *    changes direction. In both cases the external polarity is chosen so that
 *    a positive battery drives the coil anticlockwise from θ = 90°: the coil
 *    current is −g(θ)·I_out with g = sign(sin θ) (commutator) or 1 (slip
 *    rings), so τ = N B A I_out · s(θ) with s = g·sin θ = |sin θ| or sin θ.
 * 4. Motor dynamics: J dω/dt = N B A I s(θ) − friction, with the current set by the
 *    battery and the coil's own (back) emf: I = (V − N B A ω s(θ)) / R. The
 *    coil's inductance is neglected and the commutator switches instantly.
 *    Integrated with fixed-step RK4 from rest, so the motion is a pure
 *    function of the time since the start.
 *
 * The coil, magnet, battery and flywheel numbers below describe this model
 * machine, chosen so that it turns slowly enough to watch; they are not
 * claimed as typical of any real motor.
 */

/** The model machine. */
export const MACHINE = {
	/** Turns of wire on the coil. */
	turns: 200,
	/** Field between the poles, T. */
	B: 0.25,
	/** Length of each long side (along the shaft), m. */
	L: 0.1,
	/** Distance between the two long sides, m. */
	w: 0.1,
	/** Resistance of the coil plus the battery's internal resistance, Ω. */
	R: 4,
	/** Moment of inertia of the coil, shaft and a flywheel on it, kg·m². */
	J: 0.02,
	/** Viscous friction in the bearings, N·m per rad/s. */
	friction: 0.012,
	/** Dry friction of the brushes, N·m (smoothed below 0.05 rad/s). */
	dryFriction: 0.01
} as const;

/** Coil area A = L·w, m². */
const AREA = MACHINE.L * MACHINE.w;
/** N·B·A, the machine's constant (V·s per rad, or N·m per A). */
export const NBA = MACHINE.turns * MACHINE.B * AREA;

/**
 * Mains frequencies: 50 Hz in Europe and most of the world, 60 Hz in North
 * America (and some other countries). Source: IEC 60038:2009, "IEC standard
 * voltages", which lists standard voltages for 50 Hz and for 60 Hz systems;
 * the US grid runs at 60 Hz (ANSI C84.1), the European grid at 50 Hz
 * (EN 50160).
 */
export const MAINS_HZ = [50, 60] as const;

export type Connection = 'commutator' | 'slip';

// ------------------------------------------------------------------ geometry

/** Unit normal n̂ of the coil (x along B, y up). */
export const normal = (theta: number) => ({ x: Math.cos(theta), y: Math.sin(theta) });

/** Positions (m, from the shaft; x along B, y up) of the coil's sides a and b. */
function sides(theta: number, w: number = MACHINE.w) {
	const h = w / 2;
	return {
		a: { x: -h * Math.sin(theta), y: h * Math.cos(theta) },
		b: { x: h * Math.sin(theta), y: -h * Math.cos(theta) }
	};
}

/**
 * Force (N) on one long side carrying `current` amperes (positive: out of the
 * page), in a field B along +x: F = N I L × B, so with L = ±ẑ it points along
 * ±ŷ, always perpendicular to the field whatever the coil's angle.
 */
function sideForce(current: number, outOfPage: boolean) {
	const sign = outOfPage ? 1 : -1;
	return { x: 0, y: sign * MACHINE.turns * current * MACHINE.L * MACHINE.B };
}

/** Forces (N) on sides a and b for a coil current (positive: ⊙ in side a). */
export function coilForces(current: number) {
	return { a: sideForce(current, true), b: sideForce(current, false) };
}

/**
 * Torque about the shaft (N·m, anticlockwise positive) of the forces on the two
 * sides: Σ r × F, computed from the side positions and forces.
 */
export function torqueFromForces(theta: number, current: number) {
	const s = sides(theta);
	const f = coilForces(current);
	return s.a.x * f.a.y - s.a.y * f.a.x + (s.b.x * f.b.y - s.b.y * f.b.x);
}

/** Torque (N·m, anticlockwise positive) on the coil for a coil current: −N B I A sin θ. */
export const coilTorque = (theta: number, current: number) => -NBA * current * Math.sin(theta);

// ------------------------------------------------------------------ connection

/**
 * Which way the outside circuit is connected to the coil at angle θ: the coil
 * current is `−sense(θ) × the external current`. Slip rings: always the same.
 * Commutator: flips every half-turn, at the dead points.
 */
export function sense(theta: number, connection: Connection) {
	if (connection === 'slip') return 1;
	return Math.sin(theta) >= 0 ? 1 : -1;
}

/** Coil current (positive: ⊙ in side a) for an external current `I`. */
export const coilCurrent = (theta: number, I: number, connection: Connection) =>
	-sense(theta, connection) * I;

/** Torque (N·m) for an external current `I` through the connection. */
export const motorTorque = (theta: number, I: number, connection: Connection) =>
	coilTorque(theta, coilCurrent(theta, I, connection));

/** Mean torque over one full turn at a constant external current (numerical average). */
export function meanTorque(I: number, connection: Connection, samples = 3600) {
	let sum = 0;
	for (let i = 0; i < samples; i++) {
		sum += motorTorque(((i + 0.5) / samples) * 2 * Math.PI, I, connection);
	}
	return sum / samples;
}

// ------------------------------------------------------------------ generator

/** Flux linkage N·Φ (Wb-turns) through the coil at angle θ. */
export const fluxLinkage = (theta: number) => NBA * Math.cos(theta);

/** The coil's own emf (V, in the positive-current sense) when turning at ω rad/s. */
export const coilEmf = (theta: number, omega: number) => NBA * omega * Math.sin(theta);

/**
 * Voltage at the terminals (open circuit) through the connection, N B A ω s(θ):
 * alternating with slip rings, pulsing but never reversing with the commutator
 * (for forward turning). The terminal marked + is the one a battery's + would
 * go to to drive the coil forward, so as a motor this is the back emf.
 */
export const terminalVoltage = (theta: number, omega: number, connection: Connection) =>
	sense(theta, connection) * coilEmf(theta, omega);

/**
 * The generator driving a load: total resistance `R` (coil + lamp). The coil
 * current is emf / R whatever the connection, and the force on it opposes the
 * turning (Lenz): torque −(N B A)² ω sin²θ / R.
 */
export function generatorLoad(theta: number, omega: number, R: number) {
	const current = coilEmf(theta, omega) / R;
	return { current, torque: coilTorque(theta, current) };
}

/** Peak voltage N B A ω for a coil turning at `turnsPerSecond`. */
export const peakEmf = (turnsPerSecond: number) => NBA * 2 * Math.PI * turnsPerSecond;

/** Steady turning: angle after `t` s at `f` turns/s, from θ = 0 (coil upright, no emf). */
export const steadyAngle = (t: number, f: number) => 2 * Math.PI * f * t;

// ------------------------------------------------------------------ motor

interface MotorParams {
	/** Battery voltage, V. */
	V: number;
	connection: Connection;
	/** Extra load on the shaft (a brake), N·m per rad/s. */
	load?: number;
}

export interface MotorState {
	theta: number;
	omega: number;
}

/** External (battery) current, A, at angle θ and speed ω: (V − back emf) / R. */
function motorCurrent(p: MotorParams, theta: number, omega: number) {
	// Back emf seen through the connection: N B A ω s(θ), with s = |sin θ| or sin θ.
	return (p.V - terminalVoltage(theta, omega, p.connection)) / MACHINE.R;
}

function accel(p: MotorParams, theta: number, omega: number) {
	const I = motorCurrent(p, theta, omega);
	const tau = motorTorque(theta, I, p.connection);
	const drag =
		(MACHINE.friction + (p.load ?? 0)) * omega + MACHINE.dryFriction * Math.tanh(omega / 0.05);
	return (tau - drag) / MACHINE.J;
}

/** Fixed RK4 step for the motor, s. */
export const MOTOR_DT = 1 / 400;

/**
 * A motor run from a start state: `at(t)` gives the state t seconds later,
 * integrated with fixed RK4 steps (cached, so a run is a pure function of t).
 */
export class MotorRun {
	readonly params: MotorParams;
	readonly start: MotorState;
	private readonly states: MotorState[];
	constructor(params: MotorParams, start: MotorState = { theta: Math.PI / 2, omega: 0 }) {
		this.params = params;
		this.start = start;
		this.states = [start];
	}

	private extend(n: number) {
		const p = this.params;
		const h = MOTOR_DT;
		while (this.states.length <= n) {
			const { theta, omega } = this.states[this.states.length - 1];
			const k1t = omega;
			const k1w = accel(p, theta, omega);
			const k2t = omega + (h / 2) * k1w;
			const k2w = accel(p, theta + (h / 2) * k1t, k2t);
			const k3t = omega + (h / 2) * k2w;
			const k3w = accel(p, theta + (h / 2) * k2t, k3t);
			const k4t = omega + h * k3w;
			const k4w = accel(p, theta + h * k3t, k4t);
			this.states.push({
				theta: theta + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
				omega: omega + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)
			});
		}
	}

	/** State `t` seconds after the start (t ≤ 0: the start). */
	at(t: number): MotorState {
		if (!(t > 0)) return this.start;
		const u = t / MOTOR_DT;
		const i = Math.floor(u);
		this.extend(i + 1);
		const a = this.states[i];
		const b = this.states[i + 1];
		const f = u - i;
		return { theta: a.theta + (b.theta - a.theta) * f, omega: a.omega + (b.omega - a.omega) * f };
	}

	/** Battery current, torque and back emf `t` seconds after the start. */
	readings(t: number) {
		const s = this.at(t);
		const I = motorCurrent(this.params, s.theta, s.omega);
		return {
			...s,
			I,
			torque: motorTorque(s.theta, I, this.params.connection),
			backEmf: this.params.V - I * MACHINE.R
		};
	}
}

/** Wraps an angle into [0, 2π). */
export const wrap = (a: number) => {
	const r = a % (2 * Math.PI);
	return r < 0 ? r + 2 * Math.PI : r;
};

/** The smallest signed difference b − a between two angles, in (−π, π]. */
export function angleDelta(a: number, b: number) {
	let d = (b - a) % (2 * Math.PI);
	if (d <= -Math.PI) d += 2 * Math.PI;
	if (d > Math.PI) d -= 2 * Math.PI;
	return d;
}

/**
 * Averages over `span` seconds of steady running, after `settle` seconds from
 * rest: mean speed (turns/s), mean battery current (A) and mean back emf (V).
 */
export function steadyRunning(p: MotorParams, settle = 15, span = 5) {
	const run = new MotorRun(p);
	const n = Math.round(span / MOTOR_DT);
	let I = 0;
	let emf = 0;
	for (let i = 0; i < n; i++) {
		const r = run.readings(settle + i * MOTOR_DT);
		I += r.I;
		emf += r.backEmf;
	}
	const turns = (run.at(settle + span).theta - run.at(settle).theta) / (2 * Math.PI);
	return { speed: turns / span, current: I / n, backEmf: emf / n };
}
