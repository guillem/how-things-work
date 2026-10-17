/**
 * Light and matter round a non-spinning black hole (the Schwarzschild
 * solution of general relativity, 1916), in the equatorial plane.
 *
 * Units: G = c = 1 and the hole's mass M = 1, so lengths are in GM/c² (for
 * the Sun, 1.477 km). The horizon is at r = 2 (the Schwarzschild radius
 * r_s = 2GM/c²); the explainer quotes distances in r_s.
 *
 * Paths are geodesics, traced with the orbit equation in u = 1/r as a
 * function of the angle φ swept round the hole:
 *
 *   light:  u'' + u = 3u²
 *   matter: u'' + u = 1/L² + 3u²      (L: angular momentum per unit mass)
 *
 * Without the 3u² term these are exactly Newton's orbits (straight lines for
 * light, conics for matter); that term is general relativity's correction,
 * tiny far away (u small) and dominant near the hole. Integrated with RK4 in
 * φ. Every number below is either derived from these equations or quoted
 * with its source.
 */

// ---- physical constants ---------------------------------------------------------------

/** Speed of light, m/s (exact, SI). */
export const C = 299_792_458;
/** The Sun's GM, m³/s² (IAU 2015 Resolution B3, nominal solar mass parameter). */
export const GM_SUN = 1.3271244e20;
/** The Sun's radius, m (IAU 2015 Resolution B3, nominal solar radius). */
export const R_SUN = 6.957e8;
/** The Earth's GM, m³/s² (IERS Conventions 2010 / WGS 84). */
export const GM_EARTH = 3.986004418e14;
/** The Earth's mean radius, m (IUGG mean radius R1). */
export const R_EARTH = 6.371e6;
/** Radius of a GPS satellite's orbit, m (semi-major axis 26 560 km; Ashby 2003, Living Rev. Relativ. 6, 1). */
export const R_GPS = 2.656e7;
/** The astronomical unit, m (IAU 2012 Resolution B2, exact). */
export const AU = 1.495978707e11;
/** The parsec, m (IAU 2015 Resolution B2). */
const PARSEC = 3.085677581491367e16;
/** Seconds in a Julian year. */
export const YEAR_S = 365.25 * 86400;

/** One micro-arcsecond in radians. */
const MICROARCSEC = Math.PI / 180 / 3600 / 1e6;
/** One arcsecond in radians. */
export const ARCSEC = Math.PI / 180 / 3600;

/**
 * Sagittarius A*, the black hole at the centre of the Milky Way: 4.152 million
 * solar masses at 8.178 kpc (GRAVITY Collaboration 2019, A&A 625, L10, from
 * the orbit of the star S2). Its ring imaged by the Event Horizon Telescope:
 * 51.8 ± 2.3 µas across (EHT Collaboration 2022, ApJL 930, L12).
 */
export const SGR_A = { mass: 4.152e6, distance: 8178 * PARSEC, ring: 51.8, ringError: 2.3 };
/**
 * M87*, in the galaxy Messier 87, at 16.8 Mpc. Its mass from the motions of
 * the galaxy's stars: 6.6 ± 0.4 billion solar masses at the 17.9 Mpc Gebhardt
 * et al. (2011, ApJ 729, 119) adopted, so about 6.2 billion at 16.8 Mpc (the
 * mass scales with the distance; EHT Collaboration 2019, ApJL 875, L1). Its
 * ring, 42 ± 3 µas across, and the EHT's own mass fitted to that ring,
 * 6.5 ± 0.7 billion (ApJL 875, L1 and L6): not an independent check.
 */
export const M87 = {
	mass: 6.2e9,
	ehtMass: 6.5e9,
	distance: 16.8e6 * PARSEC,
	ring: 42,
	ringError: 3
};
/**
 * The 1919 eclipse: starlight grazing the Sun measured to bend 1.98 ± 0.12″
 * (Sobral) and 1.61 ± 0.30″ (Príncipe) (Dyson, Eddington & Davidson 1920,
 * Phil. Trans. R. Soc. A 220, 291).
 */
export const ECLIPSE_1919 = { sobral: 1.98, sobralError: 0.12, principe: 1.61, principeError: 0.3 };
/**
 * Mercury's orbit (NASA Mercury fact sheet): semi-major axis 0.387 098 AU,
 * eccentricity 0.205 630, period 87.969 days. Its perihelion turns 43″ per
 * century more than Newton's gravity and the other planets explain (found by
 * Le Verrier in 1859, who put it at 38″; 43″ is Newcomb's 1882 value;
 * explained by Einstein in 1915).
 */
export const MERCURY = { a: 0.387098 * AU, e: 0.20563, periodDays: 87.9691 };
/** The Earth's orbit (NASA Earth fact sheet): a = 1.000 001 AU, e = 0.0167. */
export const EARTH_ORBIT = { a: 1.000001 * AU, e: 0.0167 };

/** Schwarzschild radius 2GM/c² (m) for a body with the given GM (m³/s²). */
export const schwarzschildRadius = (gm: number) => (2 * gm) / (C * C);

// ---- geometric quantities (M = 1) -------------------------------------------------------

/** The horizon: the Schwarzschild radius, in units of GM/c². */
export const RS = 2;

/**
 * Rate of a clock held at rest at radius r, compared with a clock far away:
 * √(1 − r_s/r). It falls to 0 at the horizon.
 */
export function clockRate(r: number) {
	return r <= RS ? 0 : Math.sqrt(1 - RS / r);
}

/** Specific angular momentum of a circular orbit at r (exists only for r > 3). */
export function circularL(r: number) {
	return r > 3 ? Math.sqrt((r * r) / (r - 3)) : NaN;
}
/** Newton's circular orbit at r has L = √(GM r). */
export const newtonCircularL = (r: number) => Math.sqrt(r);

/**
 * Angular momentum per unit mass of a probe launched sideways at r with speed
 * v (a fraction of c) as measured on the spot by an observer held at rest
 * there: L = r v / √(1 − v²). (Newton's is r v.) It escapes if and only if
 * v ≥ √(2GM/r), the same escape speed as Newton's.
 */
export function sidewaysL(r: number, v: number) {
	return (r * v) / Math.sqrt(1 - v * v);
}

/**
 * The extra turn of an orbit's closest point per orbit predicted by general
 * relativity for a nearly Newtonian orbit (a, e in GM/c²): 6π / (a(1 − e²)).
 */
export function perihelionAdvance(a: number, e: number) {
	return (6 * Math.PI) / (a * (1 - e * e));
}

// ---- the tracer ---------------------------------------------------------------------------

export type Fate = 'captured' | 'escaped' | 'orbiting';

export interface Trace {
	/** u = 1/r at each sample, and the angle φ swept since the start. */
	u: Float64Array;
	phi: Float64Array;
	n: number;
	fate: Fate;
	/** Total angle swept (radians) when the trace stopped. */
	sweep: number;
}

interface TraceOptions {
	/** Angle step in radians (default 0.002). */
	dphi?: number;
	/** Stop after sweeping this angle (default 8π). */
	maxSweep?: number;
	/** Stop once r exceeds this, moving outwards (default: only when u reaches 0). */
	rMax?: number;
}

/**
 * Integrates u'' + u = k + 3u² from (u0, du0) with RK4 in φ. Stops at the
 * horizon (u ≥ 1/2, captured), when the path leaves for infinity (u ≤ 0, or
 * r > rMax on the way out: escaped) or after `maxSweep` (still orbiting).
 * The last sample sits exactly on the stopping boundary.
 */
export function trace(u0: number, du0: number, k: number, opts: TraceOptions = {}): Trace {
	const h = opts.dphi ?? 0.002;
	const maxSweep = opts.maxSweep ?? 8 * Math.PI;
	const uMin = opts.rMax ? 1 / opts.rMax : 0;
	const cap = Math.ceil(maxSweep / h) + 2;
	const U = new Float64Array(cap);
	const P = new Float64Array(cap);
	const f = (u: number) => k + 3 * u * u - u;
	let u = u0;
	let v = du0;
	let phi = 0;
	let n = 0;
	U[n] = u;
	P[n++] = phi;
	let fate: Fate = 'orbiting';
	while (phi < maxSweep && n < cap) {
		const k1u = v;
		const k1v = f(u);
		const k2u = v + (h / 2) * k1v;
		const k2v = f(u + (h / 2) * k1u);
		const k3u = v + (h / 2) * k2v;
		const k3v = f(u + (h / 2) * k2u);
		const k4u = v + h * k3v;
		const k4v = f(u + h * k3u);
		const un = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
		const vn = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
		if (un >= 0.5) {
			// Crossed the horizon during this step: end exactly on it.
			const s = (0.5 - u) / (un - u);
			U[n] = 0.5;
			P[n++] = phi + s * h;
			phi += s * h;
			fate = 'captured';
			break;
		}
		if (un <= uMin && vn < 0) {
			const s = (u - uMin) / (u - un);
			U[n] = uMin;
			P[n++] = phi + s * h;
			phi += s * h;
			fate = 'escaped';
			break;
		}
		u = un;
		v = vn;
		phi += h;
		U[n] = u;
		P[n++] = phi;
	}
	return { u: U.subarray(0, n), phi: P.subarray(0, n), n, fate, sweep: phi };
}

/**
 * A light ray arriving from far away on the left, moving right, a distance b
 * (the impact parameter) above the hole. Its points are (−r cos φ, r sin φ):
 * it comes in along y = b and bends towards the hole (b < 0 mirrors it).
 */
export function ray(b: number, opts: TraceOptions = {}): Trace {
	const ab = Math.max(Math.abs(b), 1e-6);
	return trace(0, 1 / ab, 0, opts);
}

/** Total bending of a light ray with impact parameter b (radians); Infinity if it is captured. */
export function deflection(b: number, maxSweep = 40 * Math.PI) {
	const tr = ray(b, { dphi: b > 50 ? 0.0005 : 0.001, maxSweep });
	if (tr.fate !== 'escaped') return Infinity;
	return tr.sweep - Math.PI;
}

/**
 * The critical impact parameter, found by bisection on the tracer: rays
 * passing closer than this are captured, farther ones escape.
 */
export function criticalImpact(tol = 1e-9) {
	let lo = 3;
	let hi = 8;
	while (hi - lo > tol) {
		const mid = (lo + hi) / 2;
		if (ray(mid, { maxSweep: 60 * Math.PI, dphi: 0.002 }).fate === 'captured') lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}
/** √27 ≈ 5.196: the critical impact parameter in closed form (photon sphere at r = 3). */
export const B_CRIT = Math.sqrt(27);

/**
 * Light emitted from a lamp held at rest at radius r0, at angle psi (radians)
 * from straight up (outwards), turning anticlockwise if `side` is +1. The
 * angle is the one measured by the lamp, held at rest (a static observer),
 * through b = r0 sin ψ / √(1 − 2/r0).
 */
export function flashRay(r0: number, psi: number, opts: TraceOptions = {}) {
	const u0 = 1 / r0;
	const s = Math.sin(psi);
	const c = Math.cos(psi);
	// (du/dφ)² = 1/b² − u²(1 − 2u) and at the lamp 1/b² = u0²(1 − 2u0)/sin²ψ.
	const du0 = s < 1e-9 ? -Math.sign(c) * 1e9 : (-u0 * Math.sqrt(1 - 2 * u0) * c) / s;
	return trace(u0, du0, 0, opts);
}

/**
 * Half-angle of the cone of directions from straight up in which light from
 * a lamp held at rest at r0 escapes to infinity (radians). From the critical
 * impact parameter: sin ψ = (√27/r0)√(1 − 2/r0), with the cone wider than a
 * hemisphere outside the photon sphere (r0 > 3).
 */
export function escapeCone(r0: number) {
	if (r0 <= RS) return 0;
	const s = Math.min(1, (B_CRIT / r0) * Math.sqrt(1 - RS / r0));
	const a = Math.asin(s);
	return r0 >= 3 ? Math.PI - a : a;
}

/**
 * A probe launched sideways at radius r0 with angular momentum L per unit
 * mass. Points are (r cos φ, r sin φ), anticlockwise. `tau` is its own
 * (proper) time since launch, `time` the time of a clock far away, both in
 * GM/c³ (dτ = r² dφ / L; dt = E dτ / (1 − 2/r)).
 */
export function probe(r0: number, L: number, opts: TraceOptions = {}) {
	const tr = trace(1 / r0, 0, 1 / (L * L), opts);
	const E = Math.sqrt((1 - 2 / r0) * (1 + (L * L) / (r0 * r0)));
	const tau = new Float64Array(tr.n);
	const time = new Float64Array(tr.n);
	for (let i = 1; i < tr.n; i++) {
		const um = (tr.u[i] + tr.u[i - 1]) / 2;
		const dtau = (tr.phi[i] - tr.phi[i - 1]) / (L * um * um);
		tau[i] = tau[i - 1] + dtau;
		time[i] = time[i - 1] + (E * dtau) / Math.max(1e-6, 1 - 2 * um);
	}
	return { ...tr, tau, time, E, L };
}

/**
 * Newton's prediction for the same launch (r0, L): the conic
 * u = 1/L² + (1/r0 − 1/L²) cos φ. Returns u at angle φ (≤ 0 means the
 * orbit has gone off to infinity).
 */
export function newtonU(r0: number, L: number, phi: number) {
	const p = 1 / (L * L);
	return p + (1 / r0 - p) * Math.cos(phi);
}

/** Angles (radians) of the successive closest approaches of a probe's path. */
export function periapses(tr: Trace) {
	const out: number[] = [];
	for (let i = 1; i < tr.n - 1; i++) {
		if (tr.u[i] > tr.u[i - 1] && tr.u[i] >= tr.u[i + 1]) {
			// Parabola through the three samples for a sub-step angle.
			const a = tr.u[i - 1];
			const b = tr.u[i];
			const c = tr.u[i + 1];
			const den = a - 2 * b + c;
			const off = den !== 0 ? (0.5 * (a - c)) / den : 0;
			const h = tr.phi[i + 1] - tr.phi[i];
			out.push(tr.phi[i] + off * h);
		}
	}
	return out;
}

// ---- lensing -----------------------------------------------------------------------------

/**
 * Bending angle α(b) for every impact parameter, from the tracer, as a table
 * (fine near the critical value, where it grows without limit), with the
 * weak-field series 4/b + 15π/4b² beyond it.
 */
export function deflectionTable(bMax = 200, n = 400) {
	const b = new Float64Array(n);
	const a = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		// Spacing that crowds towards B_CRIT (1e-5 above it) and spreads out to bMax.
		const s = i / (n - 1);
		b[i] = B_CRIT + 1e-5 * Math.pow((bMax - B_CRIT) / 1e-5, s);
		a[i] = deflection(b[i], 12 * Math.PI); // ≤ 2 loops at 1e-5 above critical
	}
	return { b, a, bMax };
}
export type DeflectionTable = ReturnType<typeof deflectionTable>;

/** α(b) from the table (Infinity below the critical impact parameter). */
export function alphaAt(tab: DeflectionTable, b: number) {
	if (b <= tab.b[0]) return Infinity;
	if (b >= tab.bMax) return 4 / b + (15 * Math.PI) / (4 * b * b);
	let lo = 0;
	let hi = tab.b.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (tab.b[mid] <= b) lo = mid;
		else hi = mid;
	}
	// Interpolate in log(b − B_CRIT), where α is nearly linear close in.
	const x0 = Math.log(tab.b[lo] - B_CRIT);
	const x1 = Math.log(tab.b[hi] - B_CRIT);
	const f = (Math.log(b - B_CRIT) - x0) / (x1 - x0);
	return tab.a[lo] + (tab.a[hi] - tab.a[lo]) * f;
}

/**
 * Where a camera held at rest at distance D from the hole sees the sky:
 * looking at angle θ from the hole, the light it receives has impact
 * parameter b = D sin θ / √(1 − 2/D) (as for the lamp in `flashRay`) and was
 * bent by α(b), so it came from the sky at angle β = θ − α (the lens
 * equation for a sky far behind the hole; negative means the other side of
 * the hole). NaN inside the shadow. α is the whole bend, including the small
 * part (about b/D²) the ray would still pick up beyond the camera.
 */
export function cameraImpact(D: number, theta: number) {
	return (D * Math.sin(theta)) / Math.sqrt(1 - 2 / D);
}
export function skyAngle(tab: DeflectionTable, D: number, theta: number) {
	const b = cameraImpact(D, theta);
	const a = alphaAt(tab, b);
	return Number.isFinite(a) ? theta - a : NaN;
}

/** Angular radius of the shadow seen from distance D: sin θ = b_crit √(1 − 2/D) / D. */
export function shadowAngle(D: number) {
	return Math.asin((B_CRIT * Math.sqrt(1 - 2 / D)) / D);
}

/** Angle of the Einstein ring (a star exactly behind the hole) for a camera at D, by bisection. */
export function einsteinAngle(tab: DeflectionTable, D: number) {
	let lo = shadowAngle(D) * 1.0001;
	let hi = 1.2;
	for (let i = 0; i < 80; i++) {
		const mid = (lo + hi) / 2;
		if (skyAngle(tab, D, mid) < 0) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

/**
 * The two main images of a star at sky angle beta > 0 from the hole: one
 * outside the Einstein ring on the star's side, one inside it on the far
 * side (returned as a positive angle; it lies opposite). By bisection.
 */
export function images(tab: DeflectionTable, D: number, beta: number) {
	const thE = einsteinAngle(tab, D);
	const solve = (lo: number, hi: number, target: number) => {
		for (let i = 0; i < 70; i++) {
			const mid = (lo + hi) / 2;
			if (skyAngle(tab, D, mid) < target) lo = mid;
			else hi = mid;
		}
		return (lo + hi) / 2;
	};
	const outer = solve(thE, 1.5, beta);
	const inner = solve(shadowAngle(D) * 1.000001, thE, -beta);
	return { outer, inner, ring: thE };
}

/** Angular size (µas) of a black hole's shadow, 2√27 GM/(c² d), for a mass in suns at distance d (m). */
export function shadowMicroarcsec(massSuns: number, distance: number) {
	const m = (massSuns * GM_SUN) / (C * C);
	return (2 * B_CRIT * m) / distance / MICROARCSEC;
}
