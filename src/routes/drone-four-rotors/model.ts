/**
 * A small four-rotor drone, simulated as a rigid body.
 *
 * The numbers are those of a real palm-sized drone, the Crazyflie 2.0 (27 g, its motors 4 cm from
 * the middle), as identified by Förster (2015, "System Identification of the Crazyflie 2.0 Nano
 * Quadrocopter", ETH Zurich) and used in the simulator gym-pybullet-drones (Panerati et al. 2021,
 * `cf2x.urdf`, MIT licence). Each rotor pushes up along the drone's own up direction with a force
 * that grows with the square of its speed (`KF`·rpm²) and twists the body the other way from its
 * spin with a torque that also grows with the square of its speed (`KM`·rpm²). The air drags on
 * the moving drone in proportion to its speed and to how fast the rotors spin (the same model's
 * linear rotor drag). The rotors sit in an X: front left and back right spin clockwise seen from
 * above, front right and back left anticlockwise (the layout DJI's drones use).
 *
 * In every step but the last, a flight computer (as on every real drone) turns the reader's stick
 * into the four rotor speeds: it holds the height, tilts the drone to the angle the stick asks
 * for, and turns it at the rate the stick asks for. Its gains are this page's own (gentler than a
 * real drone's, so that the tip takes about half a second); it shares the push between the rotors
 * with the exact "mixer" of an X layout. In the last step the reader sets the four speeds and the
 * flight computer is off.
 *
 * Units: metres, kilograms, seconds, radians; rotor speeds in revolutions a minute (rpm) inside,
 * turns a second on the page. Axes of the body: x forward, y left, z up. Angles: roll is positive
 * with the right side down, pitch positive with the nose down, yaw positive anticlockwise seen
 * from above.
 */

export const G = 9.81;
/** Crazyflie 2.0 (gym-pybullet-drones `cf2x.urdf`). */
export const MASS = 0.027;
/** Distance from the middle to each motor, m. */
export const ARM = 0.0397;
/** Push of one rotor per rpm², N. */
export const KF = 3.16e-10;
/** Twist of one rotor on the body per rpm², N·m. */
export const KM = 7.94e-12;
/** Moments of inertia, kg·m². */
export const IXX = 1.4e-5;
export const IYY = 1.4e-5;
export const IZZ = 2.17e-5;
/** All four rotors flat out push 2.25 times the drone's weight. */
export const THRUST_TO_WEIGHT = 2.25;
/** Linear drag, N per (m/s) per (rad/s) of the four rotors' speeds added up: sideways and up. */
export const DRAG_XY = 9.1785e-7;
export const DRAG_Z = 10.311e-7;
/** Radius of a propeller, m. */
export const PROP_RADIUS = 0.0231;
/**
 * The air's drag on the body when it whirls round, N·m per (rad/s)²: an estimate (the four arms
 * and motors as small flat plates), which matters only when all four rotors spin the same way.
 */
export const YAW_DRAG = 3.4e-8;

export const WEIGHT = MASS * G;
/** The speed at which the four pushes add up to the weight. */
export const HOVER_RPM = Math.sqrt(WEIGHT / (4 * KF));
export const MAX_RPM = Math.sqrt((THRUST_TO_WEIGHT * WEIGHT) / (4 * KF));
export const turnsPerSecond = (rpm: number) => rpm / 60;
export const HOVER_TURNS = turnsPerSecond(HOVER_RPM);
export const MAX_TURNS = turnsPerSecond(MAX_RPM);

/** The flight computer's limits: the steepest tilt it allows and its fastest turn. */
export const MAX_TILT = (10 * Math.PI) / 180;
export const MAX_TURN_RATE = Math.PI / 2;
/** The height it holds, m. */
export const HOLD_HEIGHT = 1.5;
/** The flight computer's gains (the page's own): tilt, tilt rate, turn, height, climb. */
const KP = 64;
const KD = 16;
const KR = 4;
const KZ = 4;
const KVZ = 4;

const A = ARM / Math.SQRT2;
export type RotorId = 'fl' | 'fr' | 'br' | 'bl';
export interface Rotor {
	id: RotorId;
	name: string;
	/** Position in the body, m: x forward, y left. */
	x: number;
	y: number;
	/** +1 anticlockwise, −1 clockwise, seen from above. */
	spin: 1 | -1;
}
export const ROTORS: readonly Rotor[] = [
	{ id: 'fl', name: 'front left', x: A, y: A, spin: -1 },
	{ id: 'fr', name: 'front right', x: A, y: -A, spin: 1 },
	{ id: 'br', name: 'back right', x: -A, y: -A, spin: -1 },
	{ id: 'bl', name: 'back left', x: -A, y: A, spin: 1 }
];

export type Speeds = [number, number, number, number];

export type Settings =
	| {
			/** The reader sets the four rotor speeds, rpm (front left, front right, back right, back left). */
			mode: 'manual';
			rpm: Speeds;
	  }
	| {
			/** The flight computer flies, from the reader's sticks (each −1 to 1). */
			mode: 'assisted';
			/** Forward stick: positive tips the nose down and flies forward. */
			forward: number;
			/** Sideways stick: positive tips it to the right. */
			right: number;
			/** Turn stick: positive turns it to the right (clockwise seen from above). */
			turn: number;
			/** All four rotors spin clockwise (a drone built wrong). */
			sameWay?: boolean;
	  };

export type Vec = [number, number, number];
/** A unit quaternion [w, x, y, z]: the body's orientation. */
type Quat = [number, number, number, number];

export interface State {
	t: number;
	pos: Vec;
	vel: Vec;
	q: Quat;
	/** Body rates, rad/s (roll, pitch, yaw). */
	w: Vec;
	rpm: Speeds;
	onGround: boolean;
	/** When it last crashed, s (and is waiting to be put back on its feet), or null. */
	crashedAt: number | null;
	upsideDown: boolean;
}

/** The biggest speed differences, turns a second, since the sticks last moved. */
export interface Peaks {
	/** Back pair minus front pair. */
	pitch: number;
	/** Left pair minus right pair. */
	roll: number;
	/** Clockwise pair minus anticlockwise pair. */
	yaw: number;
}

export const DT = 0.002;
/** How long a crashed drone lies there before it is put back on its feet, s. */
export const RESET_AFTER = 2;

const level = (yaw: number): Quat => [Math.cos(yaw / 2), 0, 0, Math.sin(yaw / 2)];

/** Rotation matrix of a quaternion, rows: body → world. */
export function matrix(q: Quat): number[][] {
	const [w, x, y, z] = q;
	return [
		[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
		[2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
		[2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]
	];
}

/** Roll, pitch and yaw (Z-Y-X), rad. */
export function angles(q: Quat): { roll: number; pitch: number; yaw: number } {
	const [w, x, y, z] = q;
	return {
		roll: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
		pitch: Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
		yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
	};
}

/** Spin of each rotor: as built, or all clockwise. */
const spins = (sameWay: boolean) => ROTORS.map((r) => (sameWay ? -1 : r.spin));

/**
 * The mixer: the four rpm² that give a total push `T` and body torques `tx`, `ty`, `tz`. In an X
 * layout with the diagonals spinning the same way, the four patterns (all, left−right,
 * back−front, anticlockwise−clockwise) are independent, so this is exact (until a rotor hits
 * zero or full speed).
 */
export function mix(T: number, tx: number, ty: number, tz: number, sameWay = false): Speeds {
	const s = spins(sameWay);
	const out = ROTORS.map((r, i) => {
		let u = T / (4 * KF) + (tx * r.y) / (4 * A * A * KF) - (ty * r.x) / (4 * A * A * KF);
		if (!sameWay) u -= (tz * s[i]) / (4 * KM);
		return Math.sqrt(Math.min(MAX_RPM * MAX_RPM, Math.max(0, u)));
	});
	return out as Speeds;
}

const pairs = (rpm: Speeds) => {
	const t = rpm.map(turnsPerSecond);
	return {
		pitch: (t[2] + t[3] - t[0] - t[1]) / 2,
		roll: (t[0] + t[3] - t[1] - t[2]) / 2,
		yaw: (t[0] + t[2] - t[1] - t[3]) / 2
	};
};

export class Drone {
	state: State;
	settings: Settings;
	peaks: Peaks = { pitch: 0, roll: 0, yaw: 0 };

	constructor(settings: Settings, start: { height: number; rpm?: number } = { height: HOLD_HEIGHT }) {
		this.settings = settings;
		const rpm = start.rpm ?? (start.height > 0 ? HOVER_RPM : 0);
		this.state = {
			t: 0,
			pos: [0, 0, start.height],
			vel: [0, 0, 0],
			q: level(0),
			w: [0, 0, 0],
			rpm: [rpm, rpm, rpm, rpm],
			onGround: start.height <= 0,
			crashedAt: null,
			upsideDown: false
		};
	}

	/** New sticks or speeds; the peaks count afresh from here. */
	set(settings: Settings) {
		this.settings = settings;
		this.peaks = { pitch: 0, roll: 0, yaw: 0 };
	}

	/** The rotor speeds the flight computer (or the reader) asks for now. */
	private command(): Speeds {
		const s = this.settings;
		const st = this.state;
		if (s.mode === 'manual') {
			return s.rpm.map((v) => Math.min(MAX_RPM, Math.max(0, v))) as Speeds;
		}
		const { roll, pitch } = angles(st.q);
		const [p, q, r] = st.w;
		const tx = IXX * (KP * (s.right * MAX_TILT - roll) - KD * p);
		const ty = IYY * (KP * (s.forward * MAX_TILT - pitch) - KD * q);
		const tz = IZZ * KR * (-s.turn * MAX_TURN_RATE - r);
		const up = matrix(st.q)[2][2];
		const T = (MASS * (G + KZ * (HOLD_HEIGHT - st.pos[2]) - KVZ * st.vel[2])) / Math.max(0.5, up);
		return mix(Math.max(0, T), tx, ty, tz, s.sameWay === true);
	}

	private step() {
		const st = this.state;
		st.t += DT;
		if (st.crashedAt !== null) {
			st.rpm = [0, 0, 0, 0];
			if (st.t - st.crashedAt >= RESET_AFTER) {
				st.crashedAt = null;
				st.upsideDown = false;
				st.q = level(angles(st.q).yaw);
				st.onGround = true;
			}
			return;
		}
		const rpm = this.command();
		st.rpm = rpm;
		const sameWay = this.settings.mode === 'assisted' && this.settings.sameWay === true;
		const s = spins(sameWay);
		const u = rpm.map((v) => v * v);
		const T = KF * u.reduce((a, b) => a + b, 0);
		const R = matrix(st.q);
		const d = pairs(rpm);
		for (const k of ['pitch', 'roll', 'yaw'] as const)
			if (Math.abs(d[k]) > Math.abs(this.peaks[k])) this.peaks[k] = d[k];

		if (st.onGround) {
			// On its feet on the ground: it stays put until the rotors push harder than its weight.
			if (T <= WEIGHT) return;
			st.onGround = false;
		}

		// Forces: the rotors' push along the body's up, the air's drag, the weight.
		const spinSum = rpm.reduce((a, b) => a + b, 0) * ((2 * Math.PI) / 60);
		const vb = [0, 1, 2].map(
			(j) => R[0][j] * st.vel[0] + R[1][j] * st.vel[1] + R[2][j] * st.vel[2]
		);
		const fb = [-DRAG_XY * spinSum * vb[0], -DRAG_XY * spinSum * vb[1], T - DRAG_Z * spinSum * vb[2]];
		for (let i = 0; i < 3; i++) {
			const f = R[i][0] * fb[0] + R[i][1] * fb[1] + R[i][2] * fb[2];
			st.vel[i] += (f / MASS - (i === 2 ? G : 0)) * DT;
		}
		for (let i = 0; i < 3; i++) st.pos[i] += st.vel[i] * DT;

		// Torques: the difference in pushes tips it; the rotors' twists turn it.
		let tx = 0;
		let ty = 0;
		let tz = 0;
		ROTORS.forEach((r, i) => {
			tx += KF * u[i] * r.y;
			ty -= KF * u[i] * r.x;
			tz -= KM * u[i] * s[i];
		});
		const [p, q, rr] = st.w;
		tz -= YAW_DRAG * rr * Math.abs(rr);
		st.w[0] += ((tx - (IZZ - IYY) * q * rr) / IXX) * DT;
		st.w[1] += ((ty - (IXX - IZZ) * p * rr) / IYY) * DT;
		st.w[2] += ((tz - (IYY - IXX) * p * q) / IZZ) * DT;
		const [w, x, y, z] = st.q;
		const [wx, wy, wz] = st.w;
		const h = DT / 2;
		const nq: Quat = [
			w - h * (x * wx + y * wy + z * wz),
			x + h * (w * wx + y * wz - z * wy),
			y + h * (w * wy + z * wx - x * wz),
			z + h * (w * wz + x * wy - y * wx)
		];
		const n = Math.hypot(...nq);
		st.q = nq.map((c) => c / n) as Quat;

		// The ground.
		if (st.pos[2] <= 0) {
			const up = matrix(st.q)[2][2];
			const hard = -st.vel[2] > 2.5 || up < Math.cos((30 * Math.PI) / 180);
			st.pos[2] = 0;
			st.vel = [0, 0, 0];
			st.w = [0, 0, 0];
			if (hard) {
				st.crashedAt = st.t;
				st.upsideDown = up < 0;
				st.rpm = [0, 0, 0, 0];
			} else {
				st.q = level(angles(st.q).yaw);
				st.onGround = true;
			}
		}
	}

	/** Runs the simulation on to time `t`, s. */
	run(t: number): State {
		while (this.state.t < t - DT / 2) this.step();
		return this.state;
	}
}

// ---- what the page reads off the drone ---------------------------------------------------------

/** How far the body is tipped from level, degrees. */
export function tilt(st: State): number {
	return (Math.acos(Math.max(-1, Math.min(1, matrix(st.q)[2][2]))) * 180) / Math.PI;
}
/** Speed over the ground, m/s. */
export const groundSpeed = (st: State) => Math.hypot(st.vel[0], st.vel[1]);
/** The drone's own forward and right speeds, m/s. */
export function bodySpeed(st: State): { forward: number; right: number } {
	const yaw = angles(st.q).yaw;
	const c = Math.cos(yaw);
	const s = Math.sin(yaw);
	return { forward: c * st.vel[0] + s * st.vel[1], right: s * st.vel[0] - c * st.vel[1] };
}
/** The four pushes added up, as a share of the weight. */
export const lift = (st: State) => st.rpm.reduce((a, r) => a + KF * r * r, 0) / WEIGHT;
/** The rotors' twists on the body added up, N·m (positive anticlockwise seen from above). */
export function netTwist(st: State, sameWay = false): number {
	const s = spins(sameWay);
	return st.rpm.reduce((a, r, i) => a - KM * r * r * s[i], 0);
}
/** Turns a second of the body about its up direction (positive anticlockwise seen from above). */
export const turnRate = (st: State) => st.w[2] / (2 * Math.PI);
/** km/h from m/s. */
export const kmh = (v: number) => v * 3.6;

/** Runs a drone from the start for `seconds` and returns it. */
export function fly(
	settings: Settings,
	seconds: number,
	start?: { height: number; rpm?: number }
): Drone {
	const d = new Drone(settings, start);
	d.run(seconds);
	return d;
}

export const hover: Settings = { mode: 'assisted', forward: 0, right: 0, turn: 0 };
