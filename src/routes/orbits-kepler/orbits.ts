/**
 * Orbits under Newton's law of gravity, in units that make the Sun–Earth
 * system simple: distances in astronomical units (AU, the Earth–Sun
 * distance), time in years, so the Sun's GM = 4π² AU³/yr² and the Earth's
 * orbit (1 AU, circular speed 2π AU/yr) takes exactly one year.
 *
 * Bodies move under the Sun's pull (the Sun stays fixed: it is ~330 000
 * times heavier than the Earth) and, when there are several planets, each
 * other's pull too. Integrated with the velocity-Verlet (leapfrog) method,
 * which keeps orbits from slowly spiralling in or out.
 */

export const GM = 4 * Math.PI ** 2; // AU³ / yr², the Sun
/** Masses of planets as fractions of the Sun's mass. */
export const EARTH_MASS = 3.003e-6;
export const JUPITER_MASS = 9.546e-4;
/** 1 AU/yr in km/s. */
export const AU_PER_YEAR_KMS = 4.74;

export interface Vec {
	x: number;
	y: number;
}

/** Speed for a circular orbit at distance r (AU/yr): √(GM/r). */
export const circularSpeed = (r: number) => Math.sqrt(GM / r);
/** Escape speed at distance r: √2 × the circular speed. */
export const escapeSpeed = (r: number) => Math.sqrt((2 * GM) / r);

export type OrbitKind = 'circle' | 'ellipse' | 'parabola' | 'hyperbola' | 'fall';

export interface Elements {
	/** Energy per unit mass: negative = bound (ellipse), ≥ 0 = escapes. */
	energy: number;
	/** Angular momentum per unit mass (r × v). */
	h: number;
	/** Semi-major axis (AU); Infinity for a parabola, negative for a hyperbola. */
	a: number;
	/** Eccentricity: 0 circle, < 1 ellipse, 1 parabola, > 1 hyperbola. */
	e: number;
	/** Closest and farthest distances from the Sun (AU); farthest is Infinity if unbound. */
	perihelion: number;
	aphelion: number;
	/** Orbital period (years) from Kepler's third law; Infinity if unbound. */
	period: number;
	kind: OrbitKind;
	/** Direction of the perihelion (radians). */
	periAngle: number;
}

/** The shape of the orbit started at position r with velocity v (two-body). */
export function elements(r: Vec, v: Vec): Elements {
	const rr = Math.hypot(r.x, r.y);
	const v2 = v.x * v.x + v.y * v.y;
	const energy = v2 / 2 - GM / rr;
	const h = r.x * v.y - r.y * v.x;
	// Eccentricity vector: ((v² − GM/r) r − (r·v) v) / GM
	const rv = r.x * v.x + r.y * v.y;
	const ex = ((v2 - GM / rr) * r.x - rv * v.x) / GM;
	const ey = ((v2 - GM / rr) * r.y - rv * v.y) / GM;
	const e = Math.hypot(ex, ey);
	const a = Math.abs(energy) < 1e-12 ? Infinity : -GM / (2 * energy);
	const p = (h * h) / GM; // semi-latus rectum
	const perihelion = p / (1 + e);
	const bound = energy < 0;
	const aphelion = bound && e < 1 ? p / (1 - e) : Infinity;
	const period = bound ? 2 * Math.PI * Math.sqrt(a ** 3 / GM) : Infinity;
	let kind: OrbitKind;
	if (Math.abs(h) < 1e-9) kind = 'fall';
	else if (e < 0.01) kind = 'circle';
	else if (bound) kind = 'ellipse';
	else if (Math.abs(e - 1) < 0.01) kind = 'parabola';
	else kind = 'hyperbola';
	return { energy, h, a, e, perihelion, aphelion, period, kind, periAngle: Math.atan2(ey, ex) };
}

export interface Body {
	r: Vec;
	v: Vec;
	/** Mass as a fraction of the Sun's (pulls on the other planets). */
	m: number;
}

export interface Track {
	/** Positions of each body at every sample (bodies × samples). */
	x: Float64Array[];
	y: Float64Array[];
	/** Sample interval (years). */
	dt: number;
	/** True for bodies that hit the Sun (closer than SUN_RADIUS); they stop there. */
	crashed: boolean[];
}

/** The Sun's radius in AU (for crashes). */
export const SUN_RADIUS = 0.00465;

/**
 * Integrates the bodies for `years`, sampling every `sample` years with
 * `sub` leapfrog steps per sample. Step size shrinks automatically near the
 * Sun (each sample is split further when a body is close).
 */
export function integrate(bodies: Body[], years: number, sample = 0.005, sub = 8): Track {
	const n = bodies.length;
	const samples = Math.round(years / sample) + 1;
	const x = bodies.map(() => new Float64Array(samples));
	const y = bodies.map(() => new Float64Array(samples));
	const crashed = bodies.map(() => false);
	const r = bodies.map((b) => ({ ...b.r }));
	const v = bodies.map((b) => ({ ...b.v }));
	const acc = () =>
		r.map((ri, i) => {
			if (crashed[i]) return { x: 0, y: 0 };
			const d = Math.hypot(ri.x, ri.y);
			let ax = (-GM * ri.x) / d ** 3;
			let ay = (-GM * ri.y) / d ** 3;
			for (let j = 0; j < n; j++) {
				if (j === i || crashed[j] || bodies[j].m === 0) continue;
				const dx = r[j].x - ri.x;
				const dy = r[j].y - ri.y;
				const dd = Math.hypot(dx, dy) + 1e-4; // softening: planets never quite collide
				ax += (GM * bodies[j].m * dx) / dd ** 3;
				ay += (GM * bodies[j].m * dy) / dd ** 3;
			}
			return { x: ax, y: ay };
		});
	let a = acc();
	for (let s = 0; s < samples; s++) {
		for (let i = 0; i < n; i++) {
			x[i][s] = r[i].x;
			y[i][s] = r[i].y;
		}
		if (s === samples - 1) break;
		const minD = Math.min(...r.map((ri, i) => (crashed[i] ? Infinity : Math.hypot(ri.x, ri.y))));
		const k = minD < 0.2 ? sub * Math.ceil(0.2 / Math.max(minD, 0.005)) : sub;
		const h = sample / k;
		for (let step = 0; step < k; step++) {
			for (let i = 0; i < n; i++) {
				if (crashed[i]) continue;
				v[i].x += (a[i].x * h) / 2;
				v[i].y += (a[i].y * h) / 2;
				r[i].x += v[i].x * h;
				r[i].y += v[i].y * h;
				if (Math.hypot(r[i].x, r[i].y) < SUN_RADIUS) crashed[i] = true;
			}
			a = acc();
			for (let i = 0; i < n; i++) {
				if (crashed[i]) continue;
				v[i].x += (a[i].x * h) / 2;
				v[i].y += (a[i].y * h) / 2;
			}
		}
	}
	return { x, y, dt: sample, crashed };
}

/** Area of the triangle Sun–p–q (AU²), for the equal-areas overlay. */
export const triangleArea = (p: Vec, q: Vec) => Math.abs(p.x * q.y - p.y * q.x) / 2;

/** Area swept by body i of a track between samples s0 and s1 (sum of thin triangles). */
export function sweptArea(t: Track, i: number, s0: number, s1: number) {
	let A = 0;
	for (let s = s0; s < s1; s++)
		A += triangleArea({ x: t.x[i][s], y: t.y[i][s] }, { x: t.x[i][s + 1], y: t.y[i][s + 1] });
	return A;
}

/**
 * The planets (mean distance a in AU, period in years) — standard values
 * (NASA planetary fact sheet), for the third-law plot.
 */
export const PLANETS = [
	{ name: 'Mercury', a: 0.387, period: 0.241 },
	{ name: 'Venus', a: 0.723, period: 0.615 },
	{ name: 'Earth', a: 1.0, period: 1.0 },
	{ name: 'Mars', a: 1.524, period: 1.881 },
	{ name: 'Jupiter', a: 5.203, period: 11.86 },
	{ name: 'Saturn', a: 9.537, period: 29.46 },
	{ name: 'Uranus', a: 19.19, period: 84.01 },
	{ name: 'Neptune', a: 30.07, period: 164.8 }
];

// ------------------------------------------------------------ Newton's cannon

/** Earth's radius (km) and surface gravity (m/s²), for the cannon. */
export const EARTH_RADIUS_KM = 6371;
export const SURFACE_G = 9.81;
/** Speed for a circular orbit just above the ground, ignoring air: √(gR) ≈ 7.9 km/s. */
export const lowOrbitSpeed = () => Math.sqrt(SURFACE_G * EARTH_RADIUS_KM * 1000) / 1000;

/**
 * Newton's cannon: a ball fired horizontally from a mountain of height h km
 * at speed v km/s, under gravity GM/r² only (no air). Returns the path (km,
 * Earth's centre at the origin, the cannon at the top), stopping when it hits
 * the ground or after `maxSeconds`.
 */
export function cannon(v: number, h = 300, maxSeconds = 20_000, dt = 5) {
	const gm = SURFACE_G * (EARTH_RADIUS_KM * 1000) ** 2; // m³/s²
	let x = 0;
	let y = (EARTH_RADIUS_KM + h) * 1000;
	let vx = v * 1000;
	let vy = 0;
	const path: Vec[] = [{ x: x / 1000, y: y / 1000 }];
	let hit = false;
	const accel = (px: number, py: number) => {
		const d = Math.hypot(px, py);
		return [(-gm * px) / d ** 3, (-gm * py) / d ** 3];
	};
	let [ax, ay] = accel(x, y);
	for (let t = 0; t < maxSeconds; t += dt) {
		vx += (ax * dt) / 2;
		vy += (ay * dt) / 2;
		x += vx * dt;
		y += vy * dt;
		[ax, ay] = accel(x, y);
		vx += (ax * dt) / 2;
		vy += (ay * dt) / 2;
		path.push({ x: x / 1000, y: y / 1000 });
		if (Math.hypot(x, y) < EARTH_RADIUS_KM * 1000) {
			hit = true;
			break;
		}
	}
	return { path, hit, dt };
}
