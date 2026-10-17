/**
 * The rocket model behind the explainer: the rocket equation, staging, and a flight from the
 * pad to orbit through the real atmosphere.
 *
 * - Rocket equation (Tsiolkovsky, 1903): a rocket that throws its propellant backwards at
 *   exhaust speed vₑ gains Δv = vₑ ln(m₀/m_f), where m₀ and m_f are its masses before and after.
 * - Ascent: a point mass in the plane of its path over a round, spinning Earth (Newton's
 *   gravity GM/r²), pushed by its engines and slowed by air drag ½ρv²C_dA, with the air
 *   density of the U.S. Standard Atmosphere 1976 and the air turning with the ground. The
 *   equations are integrated with a fourth-order Runge–Kutta step.
 * - Guidance: straight up, a small tilt ("pitch kick") towards the east, then a gravity turn
 *   (the engines push along the direction of travel through the air and gravity bends the
 *   path over). Above the dense air the upper stages steer to level off at a target height and
 *   build up sideways speed until the orbit is round; the engines stop when it is.
 *
 * Simplifications, stated on the page: the flight stays in one plane, due east (Apollo 11
 * flew a 72° heading); the drag coefficient is a constant 0.5 (a real one peaks near the
 * speed of sound); the engines run at full thrust until the stage is empty.
 */
import { US76 } from './us76.ts';
import { EARTH, G0, KSC_LATITUDE, SATURN_V, type StageFigures } from './vehicles.ts';

export { G0 };

// ---- the rocket equation ------------------------------------------------------------------

/** Speed gained (m/s) by burning from mass m0 down to mf with exhaust speed ve (m/s). */
export const deltaV = (ve: number, m0: number, mf: number) => ve * Math.log(m0 / mf);

/** Starting mass ÷ final mass needed to gain dv with exhaust speed ve. */
export const massRatio = (dv: number, ve: number) => Math.exp(dv / ve);

/** Share of the starting mass that must be propellant to gain dv. */
export const propellantShare = (dv: number, ve: number) => 1 - 1 / massRatio(dv, ve);

// ---- the atmosphere -----------------------------------------------------------------------

const P0 = US76[0][1];

/** Pressure (Pa) and density (kg/m³) at geometric altitude h (m), US Standard Atmosphere 1976. */
export function atmosphere(h: number): { p: number; rho: number } {
	const km = h / 1000;
	if (km <= 0) return { p: US76[0][1], rho: US76[0][2] };
	const last = US76[US76.length - 1];
	if (km >= last[0]) return { p: 0, rho: 0 };
	const i = Math.floor(km / 5);
	const a = US76[i];
	const b = US76[i + 1];
	const f = (km - a[0]) / (b[0] - a[0]);
	// Pressure and density fall off nearly exponentially: interpolate their logarithms.
	return {
		p: Math.exp(Math.log(a[1]) + f * (Math.log(b[1]) - Math.log(a[1]))),
		rho: Math.exp(Math.log(a[2]) + f * (Math.log(b[2]) - Math.log(a[2])))
	};
}

// ---- Earth --------------------------------------------------------------------------------

const MU = EARTH.gm;
export const RE = EARTH.radius;
/** Earth's spin (rad/s) and the eastward speed of the ground at the launch site (m/s). */
const OMEGA = (2 * Math.PI) / EARTH.siderealDay;
export const SPIN = OMEGA * RE * Math.cos((KSC_LATITUDE * Math.PI) / 180);

/** Speed of a circular orbit at height h (m/s). */
export const circularSpeed = (h: number) => Math.sqrt(MU / (RE + h));

// ---- vehicles -----------------------------------------------------------------------------

interface Vehicle {
	name: string;
	stages: StageFigures[];
	/** Reference area for drag (m²). */
	area: number;
	payload: number;
	/** Height the guidance aims to level off at (m); 190 km unless set. */
	target?: number;
}

/** Drag coefficient (a constant: see the header). */
const CD = 0.5;

export const saturnV: Vehicle = {
	name: 'Saturn V',
	stages: SATURN_V.stages,
	area: (Math.PI * SATURN_V.diameter ** 2) / 4,
	payload: 0,
	target: SATURN_V.target
};

/** Tanks, engines and structure as a share of a stage's propellant (between the S-II's ~8% and the S-IVB's ~13%). */
export const DRY_SHARE = 0.1;
/** Payload of the reader's rocket (kg). */
export const PAYLOAD = 10000;
/** Thrust ÷ weight when each stage lights: the first must lift the rocket off; upper stages fly already moving. */
const LIFTOFF_TWR = 1.3;
const UPPER_TWR = 0.8;

/**
 * The reader's rocket: `fuel` kg of propellant shared between `n` stages so that each gives
 * the same mass ratio (the best split when the stages are alike), each stage's dry mass
 * `DRY_SHARE` of its propellant, `ve` (m/s) exhaust speed for all of them, `PAYLOAD` on top.
 */
export function designRocket(fuel: number, ve: number, n: number): Vehicle {
	// With a mass ratio R per stage and mass M above it, a stage carries
	// p = M (R − 1) / (1 + DRY_SHARE − DRY_SHARE·R) of propellant. Total propellant grows with
	// R, so find R by bisection.
	const props = (R: number) => {
		const out: number[] = [];
		let above = PAYLOAD;
		for (let i = 0; i < n; i++) {
			const p = (above * (R - 1)) / (1 + DRY_SHARE - DRY_SHARE * R);
			out.unshift(p);
			above += p * (1 + DRY_SHARE);
		}
		return out;
	};
	const total = (R: number) => props(R).reduce((s, p) => s + p, 0);
	let lo = 1;
	let hi = (1 + DRY_SHARE) / DRY_SHARE - 1e-9;
	for (let k = 0; k < 80; k++) {
		const mid = (lo + hi) / 2;
		if (total(mid) > fuel) hi = mid;
		else lo = mid;
	}
	const ps = props(lo);
	const stages: StageFigures[] = [];
	let m0 = PAYLOAD + ps.reduce((s, p) => s + p * (1 + DRY_SHARE), 0);
	for (let i = 0; i < n; i++) {
		const p = ps[i];
		const twr = i === 0 ? LIFTOFF_TWR : UPPER_TWR;
		stages.push({
			name: `Stage ${i + 1}`,
			m0,
			mf: m0 - p,
			mdot: (twr * m0 * G0) / ve,
			veVac: ve,
			veSea: ve
		});
		m0 -= p * (1 + DRY_SHARE);
	}
	const liftoff = stages[0].m0;
	// Wider rockets for heavier ones: the Saturn V's 10.1 m scaled by the cube root of the mass.
	const diameter = SATURN_V.diameter * Math.cbrt(liftoff / SATURN_V.stages[0].m0);
	return { name: 'Your rocket', stages, area: (Math.PI * diameter ** 2) / 4, payload: PAYLOAD };
}

/** The rocket equation summed over the stages, in a vacuum (m/s); reserves left out. */
export const idealDeltaV = (v: Vehicle) =>
	v.stages.reduce((s, st) => s + deltaV(st.veVac, st.m0, st.mf), 0);

/**
 * The most a single stage can give with exhaust speed ve, however much propellant it carries:
 * its tanks alone (DRY_SHARE of the propellant) cap the mass ratio at (1 + DRY_SHARE)/DRY_SHARE.
 */
export const singleStageLimit = (ve: number) => ve * Math.log((1 + DRY_SHARE) / DRY_SHARE);

// ---- the flight ---------------------------------------------------------------------------

export interface Sample {
	t: number;
	/** Position (m) in a frame that does not turn with the Earth: centre at 0, pad at (0, RE). */
	x: number;
	y: number;
	/** Height (m), speed (m/s) relative to the Earth's centre, stage index (−1: engines off). */
	h: number;
	v: number;
	stage: number;
	/** Gravity, drag and steering losses so far (m/s). */
	gravity: number;
	drag: number;
	steering: number;
	/** Δv the engines have given so far (m/s). */
	burned: number;
}

type Outcome = 'orbit' | 'falls';

interface Flight {
	samples: Sample[];
	outcome: Outcome;
	/** When the engines stopped (s), and where: height (m), speed (m/s). */
	cutoff: { t: number; h: number; v: number };
	/** Perigee and apogee heights (m) of the path after cutoff (perigee < 0: it comes down). */
	perigee: number;
	apogee: number;
	/** Highest point reached (m). */
	maxHeight: number;
	/** Δv given by the engines, the losses, and the Earth's spin (m/s). */
	burned: number;
	gravity: number;
	drag: number;
	steering: number;
	spin: number;
	/** Δv left in the tanks when the orbit was reached (m/s). */
	spare: number;
	/** Stage separation times (s). */
	staging: number[];
}

interface FlightOptions {
	/** Height the guidance aims to level off at (m). */
	target?: number;
	/** Tilt from vertical given at the start of the turn (degrees). */
	kick?: number;
	/** Time step (s). */
	dt?: number;
	/** Keep one sample every this many seconds. */
	every?: number;
	/** Stop after this long (s). */
	maxTime?: number;
}

/** Orbit perigee and apogee radii (m) from position and velocity. */
function apsides(x: number, y: number, vx: number, vy: number) {
	const r = Math.hypot(x, y);
	const v2 = vx * vx + vy * vy;
	const energy = v2 / 2 - MU / r;
	const h = x * vy - y * vx;
	const a = -MU / (2 * energy);
	const e = Math.sqrt(Math.max(0, 1 + (2 * energy * h * h) / (MU * MU)));
	if (energy >= 0) return { peri: a * (1 - e), apo: Infinity };
	return { peri: a * (1 - e), apo: a * (1 + e) };
}

/** Flies `v` from the pad. */
function fly(v: Vehicle, opts: FlightOptions = {}): Flight {
	const target = opts.target ?? v.target ?? 190e3;
	/** Mass at which a stage is empty, its reserve burnt too. */
	const empty = (s: StageFigures) => s.mf - (s.reserve ?? 0);
	const kick = ((opts.kick ?? 3) * Math.PI) / 180;
	const dt = opts.dt ?? 0.5;
	const every = opts.every ?? 2;
	const maxTime = opts.maxTime ?? 2400;

	// State: position, velocity (inertial), mass. The pad moves east (+x) with the ground.
	let x = 0;
	let y = RE;
	let vx = OMEGA * RE * Math.cos((KSC_LATITUDE * Math.PI) / 180);
	let vy = 0;
	let t = 0;
	let si = 0;
	let m = v.stages[0].m0;
	// The air turns with the ground; in this plane, at the rate that gives the pad its speed.
	const w = SPIN / RE;
	let gravity = 0;
	let drag = 0;
	let steering = 0;
	let burned = 0;
	let maxHeight = 0;
	const staging: number[] = [];
	const samples: Sample[] = [];
	let nextSample = 0;
	let kicked = false;
	let level = false; // above the air: steering to level off
	let cut: { t: number; h: number; v: number } | null = null;

	const record = () => {
		samples.push({
			t,
			x,
			y,
			h: Math.hypot(x, y) - RE,
			v: Math.hypot(vx, vy),
			stage: cut ? -1 : si,
			gravity,
			drag,
			steering,
			burned
		});
	};

	/** Thrust direction (unit vector) for the current state. */
	const steer = (px: number, py: number, qx: number, qy: number, a: number) => {
		const r = Math.hypot(px, py);
		const ux = px / r;
		const uy = py / r;
		// Local east (prograde) direction.
		const ex = uy;
		const ey = -ux;
		const ax = qx - w * py;
		const ay = qy + w * px;
		const airV = Math.hypot(ax, ay);
		const h = r - RE;
		if (!kicked) {
			if (airV < 60) return { x: ux, y: uy };
			kicked = true;
		}
		if (!level) {
			const sp = airV > 1 ? airV : 1;
			// Air-relative direction of travel, but never steeper than the kick.
			const up = (ax * ux + ay * uy) / sp;
			const maxUp = Math.cos(kick);
			if (up > maxUp)
				return { x: maxUp * ux + Math.sin(kick) * ex, y: maxUp * uy + Math.sin(kick) * ey };
			return { x: ax / sp, y: ay / sp };
		}
		// Levelling off: choose the vertical part of the push so that, by the time the sideways
		// speed reaches orbital speed, the climb has stopped exactly at the target height (the
		// vertical acceleration is planned as a straight line in time, as in the Space Shuttle's
		// "powered explicit guidance"). vr: climb rate, vt: sideways speed.
		const vr = qx * ux + qy * uy;
		const vt = qx * ex + qy * ey;
		const gEff = MU / (r * r) - (vt * vt) / r; // what's left of gravity after "falling round"
		const vOrbit = Math.sqrt(MU / (RE + target));
		const tgo = Math.max(20, (vOrbit - vt) / a);
		const miss = target - h - vr * tgo;
		const want = (6 * miss + 2 * vr * tgo) / (tgo * tgo) + gEff;
		const s = Math.max(-0.5, Math.min(1, want / a));
		const c = Math.sqrt(1 - s * s);
		return { x: s * ux + c * ex, y: s * uy + c * ey };
	};

	const deriv = (px: number, py: number, qx: number, qy: number, mm: number, thrust: number) => {
		const r = Math.hypot(px, py);
		const g = MU / (r * r);
		const gx = (-g * px) / r;
		const gy = (-g * py) / r;
		const { rho } = atmosphere(r - RE);
		const ax = qx - w * py;
		const ay = qy + w * px;
		const airV = Math.hypot(ax, ay);
		const dragA = (0.5 * rho * airV * airV * CD * v.area) / mm;
		const dx = airV > 0 ? (-dragA * ax) / airV : 0;
		const dy = airV > 0 ? (-dragA * ay) / airV : 0;
		let tx = 0;
		let ty = 0;
		if (thrust > 0) {
			const d = steer(px, py, qx, qy, thrust / mm);
			tx = (thrust / mm) * d.x;
			ty = (thrust / mm) * d.y;
		}
		return { ax: gx + dx + tx, ay: gy + dy + ty, dragA, tx, ty, g, ux: px / r, uy: py / r };
	};

	record();
	while (t < maxTime) {
		const st = cut ? null : v.stages[si];
		let thrust = 0;
		let mdot = 0;
		if (st) {
			const { p } = atmosphere(Math.hypot(x, y) - RE);
			const ve = st.veVac - (st.veVac - st.veSea) * (p / P0);
			mdot = st.mdot;
			thrust = mdot * ve;
		}
		const h0 = Math.hypot(x, y) - RE;
		if (!level && h0 > 60e3 && (si > 0 || h0 > 80e3)) level = true;

		// RK4 on position and velocity; the mass falls linearly within the step.
		const step = st ? Math.min(dt, (m - empty(st)) / mdot) : dt;
		const k1 = deriv(x, y, vx, vy, m, thrust);
		const k2 = deriv(
			x + (vx * step) / 2,
			y + (vy * step) / 2,
			vx + (k1.ax * step) / 2,
			vy + (k1.ay * step) / 2,
			m - (mdot * step) / 2,
			thrust
		);
		const k3 = deriv(
			x + ((vx + (k2.ax * step) / 2) * step) / 2,
			y + ((vy + (k2.ay * step) / 2) * step) / 2,
			vx + (k2.ax * step) / 2,
			vy + (k2.ay * step) / 2,
			m - (mdot * step) / 2,
			thrust
		);
		const k4 = deriv(
			x + (vx + k3.ax * step) * step,
			y + (vy + k3.ay * step) * step,
			vx + k3.ax * step,
			vy + k3.ay * step,
			m - mdot * step,
			thrust
		);
		const nx =
			x +
			(step / 6) *
				(vx + 2 * (vx + (k1.ax * step) / 2) + 2 * (vx + (k2.ax * step) / 2) + (vx + k3.ax * step));
		const ny =
			y +
			(step / 6) *
				(vy + 2 * (vy + (k1.ay * step) / 2) + 2 * (vy + (k2.ay * step) / 2) + (vy + k3.ay * step));
		const nvx = vx + (step / 6) * (k1.ax + 2 * k2.ax + 2 * k3.ax + k4.ax);
		const nvy = vy + (step / 6) * (k1.ay + 2 * k2.ay + 2 * k3.ay + k4.ay);

		// Loss bookkeeping (on the first stage of the RK step, which is accurate enough for a tally):
		// gravity loss = gravity's pull against the direction of travel; drag loss = drag/m;
		// steering loss = thrust not along the direction of travel.
		const sp = Math.hypot(vx, vy);
		if (st && sp > 0) {
			const ux = vx / sp;
			const uy = vy / sp;
			const a = thrust / m;
			gravity += k1.g * (k1.ux * ux + k1.uy * uy) * step;
			drag += k1.dragA * step;
			steering += (a - (k1.tx * ux + k1.ty * uy)) * step;
			burned += a * step;
		} else if (st) {
			gravity += k1.g * step;
			burned += (thrust / m) * step;
		}

		x = nx;
		y = ny;
		vx = nvx;
		vy = nvy;
		t += step;
		const h = Math.hypot(x, y) - RE;
		maxHeight = Math.max(maxHeight, h);
		if (st) {
			m -= mdot * step;
			// Orbit reached? Stop the engines once the perigee is up at the target height.
			const ap = apsides(x, y, vx, vy);
			if (level && ap.peri - RE > target - 5e3) {
				cut = { t, h, v: Math.hypot(vx, vy) };
				record();
			} else if (m <= empty(st) + 1e-6) {
				staging.push(t);
				if (si + 1 < v.stages.length) {
					si += 1;
					m = v.stages[si].m0;
				} else {
					cut = { t, h, v: Math.hypot(vx, vy) };
					record();
				}
			}
		}
		if (h < -1) break;
		if (t >= nextSample) {
			record();
			nextSample += every;
		}
		if (cut && apsides(x, y, vx, vy).peri - RE > 100e3 && t > cut.t + 10) break;
	}
	record();
	const end = apsides(x, y, vx, vy);
	const perigee = end.peri - RE;
	const apogee = end.apo - RE;
	const outcome: Outcome = perigee > 100e3 ? 'orbit' : 'falls';
	// What the remaining propellant could still give.
	let spare = 0;
	if (cut && outcome === 'orbit' && si < v.stages.length) {
		const st = v.stages[si];
		spare += deltaV(st.veVac, m, empty(st));
		for (let i = si + 1; i < v.stages.length; i++) {
			const s = v.stages[i];
			spare += deltaV(s.veVac, s.m0, empty(s));
		}
	}
	return {
		samples,
		outcome,
		cutoff: cut ?? { t, h: Math.hypot(x, y) - RE, v: Math.hypot(vx, vy) },
		perigee,
		apogee,
		maxHeight,
		burned,
		gravity,
		drag,
		steering,
		spin: SPIN,
		spare: Math.max(0, spare),
		staging
	};
}

/**
 * Flies `v` with the best pitch kick, as mission planners shape the climb for each rocket: tries
 * kicks from 0.25° to 8° and keeps the flight that reaches orbit with the most Δv to spare (or,
 * when none does, the one that gets fastest).
 */
export function flyBest(
	v: Vehicle,
	opts: Omit<FlightOptions, 'kick'> = {}
): Flight & { kick: number } {
	let best: (Flight & { kick: number }) | null = null;
	let bestScore = -Infinity;
	for (let kick = 0.25; kick <= 8; kick += 0.25) {
		const f = fly(v, { ...opts, kick, every: 1e9 });
		const score = f.outcome === 'orbit' ? 1e6 + f.spare : f.cutoff.v;
		if (score > bestScore) {
			bestScore = score;
			best = { ...f, kick };
		}
	}
	// Fly the winner again, keeping its samples for the drawing.
	const kick = best?.kick ?? 3;
	return { ...fly(v, { ...opts, kick }), kick };
}
