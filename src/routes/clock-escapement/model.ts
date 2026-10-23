/**
 * A weight-driven pendulum clock with a dead-beat escapement, simulated.
 *
 * The pendulum is a simple pendulum (a bob on a light rod) with air and pivot losses set by its
 * quality factor: θ'' = −(g/L)·sin θ − (ω₀/Q)·θ' + kick. The escape wheel is turned by the falling
 * weight through the clock's gears and is locked by one pallet of the anchor, which rocks with the
 * pendulum. Each time the pendulum passes through the bottom of its swing (within `IMPULSE` of it),
 * the locked tooth is let go, slides along the pallet's slanted face and pushes the pendulum on
 * (the kick), then drops and is caught by the other pallet: the tick. Every swing lets the wheel
 * on by half a tooth, so a 30-tooth wheel turns once a minute on a pendulum that beats seconds,
 * and carries the second hand.
 *
 * The energy of the kick comes from the weight and does not depend on the pendulum: the wheel
 * turns the same angle under the same pull every swing. The pendulum's losses grow with the square
 * of its swing, so the swing settles where the two match, wider for a heavier weight. The time of
 * a swing is set by the length and, very slightly, by how wide the swing is (circular error: a
 * wider swing is slower). The kick is given symmetrically about the bottom of the swing, where it
 * hardly changes the timing (Airy).
 *
 * Units: metres, kilograms, seconds, radians. The escape wheel's position is counted in teeth.
 */

export const G = 9.81;
/** The seconds pendulum: about a metre long, it beats once a second in small swings. */
export const SECONDS_LENGTH = G / Math.PI ** 2;
/**
 * Quality factor of the pendulum: the number of swings (×π) it takes to lose most of its energy.
 * Wikipedia, "Pendulum": "A quality home pendulum clock might have a Q of 10,000".
 */
export const Q = 10_000;
/** Teeth on the escape wheel: 30 in a grandfather clock, so it turns once a minute. */
export const TEETH = 30;
/** The weight at the start of the page, kg (an estimate for a home longcase clock). */
export const DEFAULT_WEIGHT = 3;
/**
 * Swing each side of the seconds pendulum under the default weight. Anchor escapements swing the
 * pendulum 4–6° from side to side (Wikipedia, "Anchor escapement"); the rest of the drive follows
 * from this (it fixes how much of the weight's energy reaches the pendulum).
 */
export const DEFAULT_SWING = (2.5 * Math.PI) / 180;
/** The kick is given while the pendulum is within this angle of the bottom of its swing. */
export const IMPULSE = (1 * Math.PI) / 180;
/** Of the half tooth the wheel moves each swing, the share it moves while pushing (the rest drops). */
export const PUSH_SHARE = 5 / 6;
/** How far the weight falls in a full run, m, and how long the run lasts with a seconds pendulum. */
export const DROP = 0.95;
export const RUN_DAYS = 8;
/**
 * The escape wheel let run with no anchor: its top speed (turns a second) and how fast it gets
 * there (time constant, s). An estimate: friction in the wheels decides it, and it is not measured.
 */
export const RUNAWAY_TURNS = 20;
export const SPIN_UP = 1;

/** Integration step, s. */
export const DT = 0.001;

export const deg = (rad: number) => (rad * 180) / Math.PI;

/** Arithmetic-geometric mean, for the exact period of a pendulum. */
function agm(a: number, b: number): number {
	for (let k = 0; k < 30 && Math.abs(a - b) > 1e-15; k++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
	return a;
}

/** Time of one swing (one tick), s, of a pendulum of length `length` swinging `swing` each side. */
export function beatTime(length: number, swing: number): number {
	return (Math.PI * Math.sqrt(length / G)) / agm(1, Math.cos(swing / 2));
}

/** Ticks a minute. */
export const ticksPerMinute = (length: number, swing: number) => 60 / beatTime(length, swing);

/**
 * Seconds a day the clock gains (positive) or loses (negative). The wheels are cut for one tick a
 * second, so the hands count each tick as a second.
 */
export const gainPerDay = (length: number, swing: number) =>
	86_400 * (1 / beatTime(length, swing) - 1);

/** Energy a kick gives the pendulum, per kilogram of bob, J/kg: the weight's share per tick. */
const KICK_PER_KG = (Math.PI * G * SECONDS_LENGTH * DEFAULT_SWING ** 2) / (2 * Q);

/**
 * The swing the clock settles into, each side, rad: where the kick's energy matches what the
 * pendulum loses in a swing. Twice the weight gives twice the energy and a swing about 1.4 times
 * as wide; a shorter pendulum, given the same energy, swings wider.
 */
export function settledSwing(weight: number, length: number): number {
	return DEFAULT_SWING * Math.sqrt((weight / DEFAULT_WEIGHT) * (SECONDS_LENGTH / length));
}

/** How far the weight sinks in an hour of ticking at one tick a second, m. */
export const SINK_PER_HOUR = DROP / (RUN_DAYS * 24);
/** How far the weight sinks for each turn of the escape wheel, m. */
export const SINK_PER_TURN = DROP / (RUN_DAYS * 24 * 60);

export interface Settings {
	length: number;
	weight: number;
	/** The anchor is fitted: without it the wheels run free. */
	anchor: boolean;
	/** The weight hangs on its cord: without it nothing drives the wheels. */
	driven: boolean;
}

export const DEFAULTS: Settings = {
	length: SECONDS_LENGTH,
	weight: DEFAULT_WEIGHT,
	anchor: true,
	driven: true
};

/** The clock's state at a moment, for drawing. */
export interface ClockState {
	t: number;
	/** Pendulum angle, rad (positive: the bob is to the right), and its speed, rad/s. */
	theta: number;
	omega: number;
	/** The escape wheel's position, in teeth (it only moves forward). */
	wheel: number;
	/** Wheel speed when it runs free, teeth/s. */
	spin: number;
	/** Which pallet holds the wheel: −1 the left one, +1 the right one. */
	locked: -1 | 1;
	/** The pendulum is being pushed by a tooth right now. */
	kicking: boolean;
	ticks: number;
	/** Time of the last tick, s (−∞ before the first). */
	lastTick: number;
	/** Pallet that caught the last tick. */
	lastTickSide: -1 | 1;
	/** The latest swing, each side, rad. */
	swing: number;
}

/**
 * The clock, advanced in fixed steps of `DT` from a start: the pendulum held at `start` to the
 * right and let go at time 0, the wheel locked on the left pallet. `run(t)` brings it to time `t`
 * (only forwards); settings can change between calls.
 */
export class Clock {
	s: Settings;
	private st: ClockState;
	/** Where the pendulum entered the kick zone (−1 left, +1 right), 0 outside it. */
	private entry = 0;
	/** Wheel position when it was last locked. */
	private lockAt = 0;

	constructor(
		settings: Settings = DEFAULTS,
		start = settledSwing(settings.weight, settings.length)
	) {
		this.s = { ...settings };
		this.st = {
			t: 0,
			theta: settings.anchor ? start : 0,
			omega: 0,
			wheel: 0,
			spin: 0,
			locked: -1,
			kicking: false,
			ticks: 0,
			lastTick: -Infinity,
			lastTickSide: -1,
			swing: settings.anchor ? start : 0
		};
	}

	get state(): ClockState {
		return this.st;
	}

	/**
	 * Changes the settings. A new weight or length takes about an hour to settle into its new swing
	 * in a real clock (the pendulum loses or gains only a little energy each swing); with `settle`
	 * the clock skips ahead to it, keeping where in its swing the pendulum is.
	 */
	set(next: Settings, settle = false): void {
		const prev = this.s;
		this.s = { ...next };
		const st = this.st;
		if (next.anchor && !prev.anchor) {
			// The anchor goes in: the wheel is caught and the pendulum is set swinging.
			st.spin = 0;
			this.lockAt = Math.ceil(st.wheel * 2) / 2;
			st.wheel = this.lockAt;
			st.locked = Math.round(this.lockAt * 2) % 2 === 0 ? -1 : 1;
			st.theta = settledSwing(next.weight, next.length);
			st.omega = 0;
			st.swing = st.theta;
			this.entry = 0;
			return;
		}
		if (settle && next.anchor && (next.weight !== prev.weight || next.length !== prev.length)) {
			const k = settledSwing(next.weight, next.length) / Math.max(st.swing, 1e-6);
			const w = Math.sqrt(prev.length / next.length);
			st.theta *= k;
			st.omega *= k * w;
			st.swing *= k;
		}
	}

	/** The pendulum's angular acceleration. */
	private accel(theta: number, omega: number, kick: number): number {
		const w0 = Math.sqrt(G / this.s.length);
		return -(w0 * w0) * Math.sin(theta) - (w0 / Q) * omega + kick;
	}

	run(to: number): ClockState {
		const st = this.st;
		const { length, weight, anchor, driven } = this.s;
		// Angular acceleration of the kick: its energy spread over the zone 2·IMPULSE wide.
		const kickAcc = driven
			? (KICK_PER_KG * (weight / DEFAULT_WEIGHT)) / (length * length * 2 * IMPULSE)
			: 0;
		while (st.t + DT <= to + 1e-9) {
			if (!anchor) {
				// No anchor: the weight spins the wheels up to the speed friction allows.
				const top = driven ? RUNAWAY_TURNS * TEETH : 0;
				st.spin += ((top - st.spin) * DT) / SPIN_UP;
				st.wheel += st.spin * DT;
				st.t += DT;
				continue;
			}
			const th0 = st.theta;
			const inZone = Math.abs(th0) < IMPULSE;
			const dir = Math.sign(st.omega) || 1;
			const kick = inZone && this.entry !== 0 && dir === -this.entry ? dir * kickAcc : 0;
			// Runge–Kutta, with the kick held over the step.
			const h = DT;
			const a1 = this.accel(st.theta, st.omega, kick);
			const v1 = st.omega;
			const a2 = this.accel(st.theta + (h / 2) * v1, st.omega + (h / 2) * a1, kick);
			const v2 = st.omega + (h / 2) * a1;
			const a3 = this.accel(st.theta + (h / 2) * v2, st.omega + (h / 2) * a2, kick);
			const v3 = st.omega + (h / 2) * a2;
			const a4 = this.accel(st.theta + h * v3, st.omega + h * a3, kick);
			const v4 = st.omega + h * a3;
			const om0 = st.omega;
			st.theta += (h / 6) * (v1 + 2 * v2 + 2 * v3 + v4);
			st.omega += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
			st.t += h;
			if (Math.sign(st.omega) !== Math.sign(om0) && om0 !== 0) st.swing = Math.abs(st.theta);

			const th1 = st.theta;
			const wasIn = Math.abs(th0) < IMPULSE;
			const isIn = Math.abs(th1) < IMPULSE;
			if (!wasIn && isIn) this.entry = th0 > 0 ? 1 : -1;
			st.kicking = isIn && kick !== 0;
			if (wasIn && !isIn) {
				const side = th1 > 0 ? 1 : -1;
				if (this.entry !== 0 && side === -this.entry && driven) {
					// Through the zone: the tooth drops and the other pallet catches the wheel. Tick.
					this.lockAt += 0.5;
					st.ticks += 1;
					// When it crossed the edge of the zone, between the two steps.
					const f = (IMPULSE - Math.abs(th0)) / (Math.abs(th1) - Math.abs(th0));
					st.lastTick = st.t - h + f * h;
					// Swinging right, the left pallet dips into the wheel and catches it.
					st.locked = side > 0 ? -1 : 1;
					st.lastTickSide = st.locked;
				}
				this.entry = 0;
			}
			// While pushing, the wheel follows the pallet's slanted face across the zone.
			if (isIn && this.entry !== 0 && driven) {
				const p = Math.min(1, Math.max(0, (-this.entry * th1 + IMPULSE) / (2 * IMPULSE)));
				st.wheel = this.lockAt + 0.5 * PUSH_SHARE * p;
			} else st.wheel = this.lockAt;
		}
		return st;
	}
}
