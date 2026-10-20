/**
 * Braking one wheel of a car (a quarter-car model) with and without ABS.
 *
 * The tyre's friction against slip follows the Burckhardt model,
 * mu(s) = c1 (1 - e^(-c2 s)) - c3 s, with the coefficient sets for dry asphalt, wet asphalt and
 * snow used across the ABS literature (Burckhardt 1993, via Kiencke and Nielsen, Automotive
 * Control Systems; reproduced in Crocetti et al., arXiv:2211.10336). Slip s = (v - omega R) / v:
 * 0 for a freely rolling wheel, 1 for a locked one.
 *
 * Two equations of motion, integrated with a 0.1 ms step:
 *   the car (a quarter of its mass on this wheel):  m dv/dt = -Fx
 *   the wheel:                                       J domega/dt = Fx R - T
 * where Fx = mu N is the road's braking force on the tyre and T the brake torque.
 *
 * Steering uses Burckhardt's combined slip: with a slip angle alpha the tyre also slips sideways,
 * sy = (1 - s) tan(alpha); the friction mu(|(s, sy)|) is shared between the two directions in
 * proportion to the two slips. A locked wheel (s = 1) has sy = 0: no sideways force, no steering.
 *
 * The ABS is the classic two-threshold cycler: release the brake pressure when the slip rises
 * past an upper threshold, reapply it when the slip falls back under a lower one. Real units also
 * watch the wheel's deceleration and must estimate the car's speed; this one is told the speed.
 */

export type Surface = 'dry' | 'wet' | 'snow';

export const SURFACES: Record<Surface, { label: string; c1: number; c2: number; c3: number }> = {
	dry: { label: 'Dry asphalt', c1: 1.2801, c2: 23.99, c3: 0.52 },
	wet: { label: 'Wet asphalt', c1: 0.857, c2: 33.822, c3: 0.347 },
	snow: { label: 'Snow', c1: 0.1946, c2: 94.129, c3: 0.0646 }
};

/** Burckhardt friction coefficient at slip s (0…1). */
export function mu(s: number, surface: Surface): number {
	const { c1, c2, c3 } = SURFACES[surface];
	return c1 * (1 - Math.exp(-c2 * s)) - c3 * s;
}

/** The curve's peak: where d mu / d s = 0, s* = ln(c1 c2 / c3) / c2. */
export function peak(surface: Surface) {
	const { c1, c2, c3 } = SURFACES[surface];
	const slip = Math.log((c1 * c2) / c3) / c2;
	return { slip, mu: mu(slip, surface) };
}

// ---- the car and wheel ----------------------------------------------------------------------

export const G = 9.81;
/** A 1,500 kg car: a quarter of it on the wheel modelled. */
export const MASS = 1500 / 4;
export const N = MASS * G;
/** Rolling radius (m) and moment of inertia of wheel, tyre and brake disc (kg m²). */
export const R = 0.3;
export const J = 1.2;
/** Brake torque of a full press of the pedal (N m): more than the best dry grip can hold. */
export const T_MAX = 2500;
/** How fast the hydraulics build and drop the brake torque (N m per second). */
export const RATE_UP = 8000;
export const RATE_DOWN = 16000;
/** ABS thresholds: release above 20% slip, reapply below 10%. */
export const ABS_HIGH = 0.2;
export const ABS_LOW = 0.1;

export interface BrakeInput {
	surface: Surface;
	/** Pedal, 0…1, as a fraction of T_MAX. */
	pedal: number;
	abs: boolean;
	/** Starting speed (m/s). */
	v0?: number;
	/** Slip angle the driver asks for (degrees); 0 brakes in a straight line. */
	steer?: number;
	/** When the driver starts steering (s after the foot lands). */
	steerAt?: number;
	/**
	 * Steer into the next lane, this far to the side (m), instead of holding the steering: turn
	 * one way until halfway across, then the other way until the car points straight again.
	 */
	lane?: number;
}

export interface Sample {
	t: number;
	/** Car speed and the wheel's rim speed omega R (m/s). */
	v: number;
	rim: number;
	slip: number;
	/** Brake torque (N m) and the braking friction coefficient Fx / N. */
	torque: number;
	mux: number;
	/** Position along the road and sideways (m), and heading (rad). */
	x: number;
	y: number;
	heading: number;
}

export interface BrakeRun {
	samples: Sample[];
	/** Distance travelled (along the path) until the car stops (m), and the time it takes (s). */
	distance: number;
	time: number;
	/** First time the wheel stops turning (s), or null. */
	lockedAt: number | null;
	/** Number of ABS pressure releases. */
	releases: number;
}

const DT = 1e-4;
/** Samples kept for drawing, every 5 ms. */
const EVERY = 50;
/** Pedal travel time: the driver's foot takes 0.15 s to reach the set pressure. */
const PRESS = 0.15;
/** Below this speed slip is ill-defined (and ABS units switch off): finish at the last friction. */
const V_END = 1;

/** Braking from v0 (100 km/h by default) until the car stops. */
export function brake({
	surface,
	pedal,
	abs,
	v0 = 100 / 3.6,
	steer = 0,
	steerAt = 0,
	lane
}: BrakeInput): BrakeRun {
	let v = v0;
	let omega = v0 / R;
	let torque = 0;
	let releasing = false;
	let releases = 0;
	let lockedAt: number | null = null;
	let x = 0;
	let y = 0;
	let heading = 0;
	let t = 0;
	let mux = 0;
	let path = 0;
	let countering = false;
	let straight = false;
	const tanA = Math.tan((steer * Math.PI) / 180);
	const samples: Sample[] = [];
	for (let i = 0; v > V_END && t < 30; i++) {
		const slip = Math.min(1, Math.max(0, (v - omega * R) / v));
		// Combined slip: the friction of the total slip, split between braking and sideways.
		// The steering: held, or a lane change (out until halfway, back until straight, then none).
		let dir = t >= steerAt ? 1 : 0;
		if (dir && lane !== undefined) {
			if (y >= lane / 2) countering = true;
			dir = countering ? (heading > 0 ? -1 : 0) : 1;
			if (countering && heading <= 0) straight = true;
			if (straight) dir = 0;
		}
		const sy = dir * (1 - slip) * tanA;
		const total = Math.hypot(slip, sy);
		const m = total > 0 ? mu(total, surface) : 0;
		mux = total > 0 ? (m * slip) / total : 0;
		const muy = total > 0 ? (m * sy) / total : 0;

		// The brake: the driver's command, cycled by the ABS.
		const command = pedal * T_MAX * Math.min(1, t / PRESS);
		if (abs) {
			if (!releasing && slip > ABS_HIGH) {
				releasing = true;
				releases++;
			} else if (releasing && slip < ABS_LOW) releasing = false;
		}
		if (abs && releasing) torque = Math.max(0, torque - RATE_DOWN * DT);
		else torque = Math.min(command, torque + RATE_UP * DT);
		if (torque > command) torque = command;

		if (i % EVERY === 0) samples.push({ t, v, rim: omega * R, slip, torque, mux, x, y, heading });

		const fx = mux * N;
		v -= (fx / MASS) * DT;
		// The wheel: the road spins it up, the brake slows it; a stopped wheel stays stopped while
		// the brake holds more than the road can turn.
		omega += ((fx * R - torque) / J) * DT;
		if (omega <= 0) {
			omega = 0;
			if (lockedAt === null) lockedAt = t;
		}
		heading += ((muy * G) / v) * DT;
		x += v * Math.cos(heading) * DT;
		y += v * Math.sin(heading) * DT;
		path += v * DT;
		t += DT;
	}
	// The last metre per second, at the last braking friction.
	const tail = mux > 0 ? (v * v) / (2 * mux * G) : 0;
	x += tail * Math.cos(heading);
	y += tail * Math.sin(heading);
	path += tail;
	t += mux > 0 ? v / (mux * G) : 0;
	samples.push({ t, v: 0, rim: 0, slip: lockedAt === null ? 0 : 1, torque, mux, x, y, heading });
	return { samples, distance: path, time: t, lockedAt, releases };
}

/** Stopping distance at constant deceleration mu g from v (m). */
export const ideal = (v: number, m: number) => (v * v) / (2 * m * G);

/** The sample at time t (the last one before it). */
export function at(run: BrakeRun, t: number): Sample {
	const s = run.samples;
	let lo = 0;
	let hi = s.length - 1;
	if (t >= s[hi].t) return s[hi];
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (s[mid].t <= t) lo = mid;
		else hi = mid;
	}
	return s[lo];
}

const stopsCache = new Map<Surface, { label: string; d: number; note: string }[]>();
/**
 * The four stops the comparison shows, from 100 km/h: a locked wheel, ABS, the best constant
 * pedal (searched in 1% steps) and the floor of the peak friction held all the way.
 */
export function compareStops(surface: Surface) {
	const hit = stopsCache.get(surface);
	if (hit) return hit;
	let foot = { d: Infinity, pedal: 0 };
	for (let p = 0.02; p <= 1.0001; p += 0.01) {
		const d = brake({ surface, pedal: p, abs: false }).distance;
		if (d < foot.d) foot = { d, pedal: p };
	}
	const out = [
		{
			label: 'Wheel locked',
			d: brake({ surface, pedal: 1, abs: false }).distance,
			note: 'full press, no ABS'
		},
		{ label: 'ABS', d: brake({ surface, pedal: 1, abs: true }).distance, note: 'full press' },
		{
			label: 'Perfect foot',
			d: foot.d,
			note: `best steady pressure: ${Math.round(foot.pedal * 100)}% of full`
		},
		{
			label: 'Peak grip all the way',
			d: ideal(100 / 3.6, peak(surface).mu),
			note: 'the floor no braking can beat'
		}
	];
	stopsCache.set(surface, out);
	return out;
}
