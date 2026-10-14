/**
 * Orbital mechanics for the explainer's manoeuvres, all in the plane of the orbits (2D),
 * under the gravity of one body at a time ("patched conics"): burns that raise an orbit
 * (Hohmann, 1925), the transfer from the Earth to Mars between real planet positions (a
 * Lambert solver), and the speed a spacecraft gains from a flyby of Jupiter.
 *
 * Units: SI (m, s, m/s) throughout.
 */
import { AU, DAY, EARTH, ELEMENTS, JUPITER, MARS, SUN } from './vehicles.ts';

export interface Vec {
	x: number;
	y: number;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const rot = (a: Vec, ang: number): Vec => ({
	x: a.x * Math.cos(ang) - a.y * Math.sin(ang),
	y: a.x * Math.sin(ang) + a.y * Math.cos(ang)
});

// ---- two-body orbits ---------------------------------------------------------------------

/** A conic orbit in the plane, prograde (anticlockwise). */
export interface Conic {
	mu: number;
	/** Semi-major axis (m, negative for a hyperbola) and eccentricity. */
	a: number;
	e: number;
	/** Direction of the closest point (rad). */
	omega: number;
	/** Mean anomaly at time 0 (rad) and the mean motion (rad/s). */
	m0: number;
	n: number;
	/** Closest and farthest distances (m); farthest is Infinity if unbound. */
	peri: number;
	apo: number;
	/** Period (s); Infinity if unbound. */
	period: number;
}

/** The orbit through position r with velocity v at time 0, about a body of gravity `mu`. */
export function conic(mu: number, r: Vec, v: Vec): Conic {
	const rr = len(r);
	const v2 = v.x * v.x + v.y * v.y;
	const energy = v2 / 2 - mu / rr;
	const rv = r.x * v.x + r.y * v.y;
	const ex = ((v2 - mu / rr) * r.x - rv * v.x) / mu;
	const ey = ((v2 - mu / rr) * r.y - rv * v.y) / mu;
	const e = Math.hypot(ex, ey);
	const a = -mu / (2 * energy);
	const omega = e > 1e-10 ? Math.atan2(ey, ex) : Math.atan2(r.y, r.x);
	const nu = Math.atan2(r.y, r.x) - omega;
	let m0: number;
	if (e < 1) {
		const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
		m0 = E - e * Math.sin(E);
	} else {
		const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
		m0 = e * Math.sinh(H) - H;
	}
	const n = Math.sqrt(mu / Math.abs(a) ** 3);
	return {
		mu,
		a,
		e,
		omega,
		m0,
		n,
		peri: a * (1 - e),
		apo: e < 1 ? a * (1 + e) : Infinity,
		period: e < 1 ? (2 * Math.PI) / n : Infinity
	};
}

/** Position and velocity on the orbit at time t (s). */
export function at(o: Conic, t: number): { r: Vec; v: Vec } {
	const M = o.m0 + o.n * t;
	const { e, a } = o;
	let px: number;
	let py: number;
	let qx: number;
	let qy: number;
	if (e < 1) {
		let E = e < 0.8 ? M : Math.PI;
		for (let i = 0; i < 30; i++) {
			const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
			E -= d;
			if (Math.abs(d) < 1e-12) break;
		}
		const b = a * Math.sqrt(1 - e * e);
		const rr = a * (1 - e * Math.cos(E));
		px = a * (Math.cos(E) - e);
		py = b * Math.sin(E);
		const edot = o.n / (1 - e * Math.cos(E));
		qx = -a * Math.sin(E) * edot;
		qy = b * Math.cos(E) * edot;
		void rr;
	} else {
		let H = Math.asinh(M / e);
		for (let i = 0; i < 50; i++) {
			const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
			H -= d;
			if (Math.abs(d) < 1e-12) break;
		}
		const aa = -a;
		const b = aa * Math.sqrt(e * e - 1);
		px = aa * (e - Math.cosh(H));
		py = b * Math.sinh(H);
		const hdot = o.n / (e * Math.cosh(H) - 1);
		qx = -aa * Math.sinh(H) * hdot;
		qy = b * Math.cosh(H) * hdot;
	}
	return { r: rot({ x: px, y: py }, o.omega), v: rot({ x: qx, y: qy }, o.omega) };
}

/** Circular-orbit speed at distance r. */
export const circular = (mu: number, r: number) => Math.sqrt(mu / r);

// ---- raising an orbit round the Earth ----------------------------------------------------

export const MU_EARTH = EARTH.gm;
export const R_EARTH = EARTH.radius;
/** Geostationary orbit: a sidereal day's period, so a = (μT²/4π²)^⅓ (≈ 42,164 km). */
export const R_GEO = Math.cbrt((MU_EARTH * EARTH.siderealDay ** 2) / (4 * Math.PI ** 2));
/** The low orbit the manoeuvres start from: 200 km up. */
export const R_LEO = R_EARTH + 200e3;

/**
 * A Hohmann transfer between circular orbits r1 → r2: a burn of dv1 along the direction of
 * travel puts the craft on an ellipse touching both; half an orbit later, dv2 makes it round.
 */
export function hohmann(mu: number, r1: number, r2: number) {
	const a = (r1 + r2) / 2;
	const dv1 = Math.sqrt(mu / r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1);
	const dv2 = Math.sqrt(mu / r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)));
	return { dv1, dv2, total: Math.abs(dv1) + Math.abs(dv2), time: Math.PI * Math.sqrt(a ** 3 / mu) };
}

/**
 * Two burns along the direction of travel from the 200 km circular orbit: dv1 at the start
 * (the craft at angle 0), then dv2 at the farthest point of the orbit dv1 gives. Returns the
 * three orbits (before, between, after).
 */
export function twoBurns(dv1: number, dv2: number) {
	const v0 = circular(MU_EARTH, R_LEO);
	const start: Vec = { x: R_LEO, y: 0 };
	const first = conic(MU_EARTH, start, { x: 0, y: v0 });
	const second = conic(MU_EARTH, start, { x: 0, y: v0 + dv1 });
	if (second.e >= 1) return { first, second, third: null, burn2: null };
	// The farthest point, half an orbit later (or the start, if dv1 < 0 made it the nearest).
	const tApo = dv1 >= 0 ? second.period / 2 : 0;
	const s = at(second, tApo);
	const speed = len(s.v);
	const dir = { x: s.v.x / speed, y: s.v.y / speed };
	const third = conic(MU_EARTH, s.r, { x: s.v.x + dir.x * dv2, y: s.v.y + dir.y * dv2 });
	return { first, second, third, burn2: { t: tApo, r: s.r } };
}

// ---- the Sun, the Earth and Mars ---------------------------------------------------------

export const MU_SUN = SUN.gm;
/** J2000 epoch: 2000-01-01 12:00 TT, as a JavaScript time (UTC; the 64 s difference is ignored). */
export const J2000 = Date.UTC(2000, 0, 1, 12);

const deg = Math.PI / 180;

/** Heliocentric position and velocity (m, m/s) of a planet `days` after J2000. */
export function planet(name: 'earth' | 'mars', days: number): { r: Vec; v: Vec } {
	const el = ELEMENTS[name];
	const T = days / 36525;
	const a = (el.a[0] + el.a[1] * T) * AU;
	const e = el.e[0] + el.e[1] * T;
	const L = (el.L[0] + el.L[1] * T) * deg;
	const peri = (el.peri[0] + el.peri[1] * T) * deg;
	const n = Math.sqrt(MU_SUN / a ** 3);
	const o: Conic = {
		mu: MU_SUN,
		a,
		e,
		omega: peri,
		m0: L - peri,
		n,
		peri: a * (1 - e),
		apo: a * (1 + e),
		period: (2 * Math.PI) / n
	};
	return at(o, 0);
}

/** Days after J2000 for a calendar date (UTC). */
export const daysFromDate = (y: number, m: number, d: number) =>
	(Date.UTC(y, m - 1, d) - J2000) / (DAY * 1000);

/**
 * Lambert's problem in the plane: the prograde conic that leaves r1 and reaches r2 after
 * `tof` seconds (less than one revolution), found from Lagrange's time equation by bisection
 * on the semi-major axis. Works through a 180° transfer, where the usual 3D methods break
 * down. Returns null when no ellipse fits (a flight shorter than the parabolic one).
 */
export function lambert(
	mu: number,
	r1: Vec,
	r2: Vec,
	tof: number
): { v1: Vec; v2: Vec; a: number } | null {
	const m1 = len(r1);
	const m2 = len(r2);
	let theta = Math.atan2(r2.y, r2.x) - Math.atan2(r1.y, r1.x);
	theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	const c = len(sub(r2, r1));
	const s = (m1 + m2 + c) / 2;
	const long = theta > Math.PI;
	const am = s / 2;
	const time = (a: number, upper: boolean) => {
		let alpha = 2 * Math.asin(Math.min(1, Math.sqrt(s / (2 * a))));
		let beta = 2 * Math.asin(Math.min(1, Math.sqrt((s - c) / (2 * a))));
		if (upper) alpha = 2 * Math.PI - alpha;
		if (long) beta = -beta;
		return {
			t: Math.sqrt(a ** 3 / mu) * (alpha - Math.sin(alpha) - (beta - Math.sin(beta))),
			alpha,
			beta
		};
	};
	const tm = time(am, false).t;
	// Parabolic time: the shortest an ellipse can take.
	const tp =
		(Math.sqrt(2) / 3) * Math.sqrt(s ** 3 / mu) * (1 - (long ? -1 : 1) * ((s - c) / s) ** 1.5);
	if (tof <= tp * 1.0001) return null;
	const upper = tof > tm;
	let lo = am;
	let hi = am * 2;
	// Lower branch: time falls from tm towards tp as a grows. Upper: it grows without limit.
	while ((upper ? time(hi, true).t < tof : time(hi, false).t > tof) && hi < am * 1e6) hi *= 2;
	for (let i = 0; i < 100; i++) {
		const mid = (lo + hi) / 2;
		const t = time(mid, upper).t;
		if (upper ? t < tof : t > tof) lo = mid;
		else hi = mid;
	}
	const a = (lo + hi) / 2;
	const { alpha, beta } = time(a, upper);
	const p = ((4 * a * (s - m1) * (s - m2)) / (c * c)) * Math.sin((alpha + beta) / 2) ** 2;
	// Speed from the energy, sideways part from the angular momentum; the radial part's sign
	// is the one whose orbit actually reaches r2 at tof.
	const speed = Math.sqrt(mu * (2 / m1 - 1 / a));
	const vt = Math.sqrt(mu * p) / m1;
	const vr = Math.sqrt(Math.max(0, speed * speed - vt * vt));
	const u = { x: r1.x / m1, y: r1.y / m1 };
	const side = { x: -u.y, y: u.x };
	let best: { v1: Vec; v2: Vec; miss: number } | null = null;
	for (const sign of [1, -1]) {
		const v1 = { x: u.x * vr * sign + side.x * vt, y: u.y * vr * sign + side.y * vt };
		const end = at(conic(mu, r1, v1), tof);
		const miss = len(sub(end.r, r2));
		if (!best || miss < best.miss) best = { v1, v2: end.v, miss };
	}
	if (!best) return null;
	return { v1: best.v1, v2: best.v2, a };
}

/** Low parking orbits the Mars trip starts and ends in: 200 km above each planet. */
export const R_PARK_EARTH = EARTH.radius + 200e3;
export const R_PARK_MARS = MARS.radius + 200e3;

/** Burn (m/s) to leave (or be captured into) a circular orbit of radius r with excess speed vInf. */
export const escapeBurn = (mu: number, r: number, vInf: number) =>
	Math.sqrt(vInf * vInf + (2 * mu) / r) - Math.sqrt(mu / r);

export interface MarsTrip {
	/** Days after J2000 at departure, and the flight time (days). */
	depart: number;
	flight: number;
	/** Speed relative to the planet when leaving the Earth and reaching Mars (m/s). */
	vInfDepart: number;
	vInfArrive: number;
	/** Burns from a 200 km Earth orbit and into a 200 km Mars orbit (m/s). */
	burnDepart: number;
	burnArrive: number;
	total: number;
	/** The transfer orbit (time 0 = departure) and the planets at both ends. */
	orbit: Conic;
	earth0: Vec;
	mars1: Vec;
	/** Angle (rad) from the Earth to Mars at departure, measured round the Sun. */
	phase: number;
}

/** A trip to Mars leaving `depart` days after J2000 and taking `flight` days, or null. */
export function marsTrip(depart: number, flight: number): MarsTrip | null {
	const e0 = planet('earth', depart);
	const m0 = planet('mars', depart);
	const m1 = planet('mars', depart + flight);
	const sol = lambert(MU_SUN, e0.r, m1.r, flight * DAY);
	if (!sol) return null;
	const vInfDepart = len(sub(sol.v1, e0.v));
	const vInfArrive = len(sub(sol.v2, m1.v));
	const burnDepart = escapeBurn(EARTH.gm, R_PARK_EARTH, vInfDepart);
	const burnArrive = escapeBurn(MARS.gm, R_PARK_MARS, vInfArrive);
	let phase = Math.atan2(m0.r.y, m0.r.x) - Math.atan2(e0.r.y, e0.r.x);
	phase = ((((phase + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
	return {
		depart,
		flight,
		vInfDepart,
		vInfArrive,
		burnDepart,
		burnArrive,
		total: burnDepart + burnArrive,
		orbit: conic(MU_SUN, e0.r, sol.v1),
		earth0: e0.r,
		mars1: m1.r,
		phase
	};
}

/** The idealised Hohmann trip between circular orbits at the planets' mean distances. */
export function marsHohmann() {
	const r1 = ELEMENTS.earth.a[0] * AU;
	const r2 = ELEMENTS.mars.a[0] * AU;
	const h = hohmann(MU_SUN, r1, r2);
	const nMars = Math.sqrt(MU_SUN / r2 ** 3);
	// Mars must be ahead by 180° minus the angle it covers during the flight.
	const lead = Math.PI - nMars * h.time;
	const nEarth = Math.sqrt(MU_SUN / r1 ** 3);
	const synodic = (2 * Math.PI) / (nEarth - nMars);
	return {
		...h,
		r1,
		r2,
		lead,
		synodic,
		burnDepart: escapeBurn(EARTH.gm, R_PARK_EARTH, h.dv1),
		burnArrive: escapeBurn(MARS.gm, R_PARK_MARS, h.dv2)
	};
}

// ---- a flyby of Jupiter -------------------------------------------------------------------

export { JUPITER };

/**
 * A flyby of Jupiter. The craft arrives on the Hohmann ellipse from the Earth, at its farthest
 * point, moving the same way as Jupiter but slower, so Jupiter catches it up. In Jupiter's
 * frame the craft swings round a hyperbola and leaves at the same speed it came, turned by
 * δ = 2 asin(1 / (1 + r_p v∞² / GM)); back in the Sun's frame, adding Jupiter's own velocity,
 * its speed has changed. `closest` is the closest distance from Jupiter's centre (m). The craft
 * passes behind Jupiter (on the side it is leaving), so it is turned forwards, round towards
 * Jupiter's direction of travel. Arriving straight from behind, any turn is a gain; the gain is
 * 2 v∞ sin(δ/2) along Jupiter's motion at most, for a turn of 180°.
 */
export function flyby(closest: number) {
	const r1 = ELEMENTS.earth.a[0] * AU;
	const r2 = JUPITER.a;
	const vArrive = Math.sqrt(MU_SUN / r2) * Math.sqrt((2 * r1) / (r1 + r2));
	const vJ = JUPITER.speed;
	// Sun frame: Jupiter moving along +x; the craft along +x too, slower.
	const vIn: Vec = { x: vArrive, y: 0 };
	const V: Vec = { x: vJ, y: 0 };
	const inf = sub(vIn, V); // relative velocity (points −x: Jupiter overtakes the craft)
	const vInf = len(inf);
	const turn = 2 * Math.asin(1 / (1 + (closest * vInf * vInf) / JUPITER.gm));
	// Passing behind Jupiter (below it in the drawing) turns the relative velocity anticlockwise.
	const out = rot(inf, turn);
	const vOut = add(V, out);
	const escape = Math.sqrt((2 * MU_SUN) / r2);
	return {
		vInf,
		turn,
		vIn,
		vOut,
		vJupiter: V,
		infIn: inf,
		infOut: out,
		speedIn: len(vIn),
		speedOut: len(vOut),
		gain: len(vOut) - len(vIn),
		escape
	};
}
