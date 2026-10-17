/**
 * Ideal (potential) flow round a wing section, by the Joukowski transform.
 *
 * Flow round a spinning cylinder is known exactly. The map z = ζ + 1/ζ turns a circle
 * through ζ = 1 into a wing-like section with a sharp trailing edge at z = 2: a circle
 * centred at ζc = −mx + i·my gives a section of thickness ∝ mx and camber ∝ my. Every
 * streamline round the circle maps to a streamline round the section, so the flow is
 * exact for the inviscid, incompressible model (L. M. Milne-Thomson, Theoretical
 * Aerodynamics, 4th ed., 1958, ch. 6; J. D. Anderson, Fundamentals of Aerodynamics, ch. 4).
 *
 * The circulation Γ is the one value that lets the air leave the sharp trailing edge
 * smoothly (the Kutta condition): Γ = 4πaU·sin(α′ + β). Lift per unit span is then ρUΓ
 * (Kutta–Joukowski), with no drag at all (d'Alembert's paradox).
 *
 * Units: the section is about 4 long; speeds are in units of the free stream U = 1, so
 * times are in units of (length ÷ U). `Wind` coordinates turn the picture so that the air
 * arrives horizontally from the left, with y upwards; the section is then tilted nose-up
 * by the angle of attack.
 */

import { LADSON } from './naca0012.ts';

export type Cx = readonly [number, number];

const add = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Cx, b: Cx): Cx => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
function div(a: Cx, b: Cx): Cx {
	const d = b[0] * b[0] + b[1] * b[1];
	return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
}
const cis = (t: number): Cx => [Math.cos(t), Math.sin(t)];
const abs = (a: Cx) => Math.hypot(a[0], a[1]);
function sqrt(a: Cx): Cx {
	const r = abs(a);
	const re = Math.sqrt((r + a[0]) / 2);
	const im = Math.sqrt(Math.max(0, (r - a[0]) / 2));
	return [re, a[1] < 0 ? -im : im];
}

export const DEG = Math.PI / 180;

/** The Joukowski map of the ζ plane onto the section's plane. */
const joukowskiMap = (s: Cx): Cx => add(s, div([1, 0], s));

export interface Section {
	/** Circle centre −mx + i·my and radius a in the ζ plane. */
	mx: number;
	my: number;
	a: number;
	/** Angle (rad) by which the camber turns the zero-lift direction: tan β = my/(1 + mx). */
	beta: number;
	/** Leading edge (the point farthest from the trailing edge) and trailing edge, z plane. */
	le: Cx;
	te: Cx;
	chord: number;
	/** Direction of the chord line, leading edge → trailing edge (rad, z plane). */
	chordDir: number;
	/** Maximum thickness and maximum camber, as fractions of the chord. */
	thickness: number;
	camber: number;
}

function circleSection(mx: number, my: number): Section {
	const a = Math.hypot(1 + mx, my);
	const centre: Cx = [-mx, my];
	const te: Cx = [2, 0];
	let le: Cx = te;
	let far = 0;
	const pts: Cx[] = [];
	const N = 720;
	for (let i = 0; i < N; i++) {
		const z = joukowskiMap(add(centre, mul([a, 0], cis((2 * Math.PI * i) / N))));
		pts.push(z);
		const d = abs(sub(z, te));
		if (d > far) {
			far = d;
			le = z;
		}
	}
	const chordDir = Math.atan2(te[1] - le[1], te[0] - le[0]);
	// thickness and camber, measured perpendicular to the chord at 80 stations
	const c = Math.cos(chordDir);
	const s = Math.sin(chordDir);
	const local = pts.map((p): Cx => {
		const dx = p[0] - le[0];
		const dy = p[1] - le[1];
		return [(dx * c + dy * s) / far, (-dx * s + dy * c) / far];
	});
	let thickness = 0;
	let camber = 0;
	for (let k = 1; k < 80; k++) {
		const x = k / 80;
		const ys: number[] = [];
		for (let i = 0; i < N; i++) {
			const p = local[i];
			const q = local[(i + 1) % N];
			if ((p[0] - x) * (q[0] - x) <= 0 && p[0] !== q[0])
				ys.push(p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]));
		}
		if (ys.length < 2) continue;
		const hi = Math.max(...ys);
		const lo = Math.min(...ys);
		thickness = Math.max(thickness, hi - lo);
		camber = Math.max(camber, (hi + lo) / 2);
	}
	return {
		mx,
		my,
		a,
		beta: Math.atan2(my, 1 + mx),
		le,
		te,
		chord: far,
		chordDir,
		thickness,
		camber
	};
}

/**
 * The Joukowski section with the given maximum thickness and camber (fractions of the
 * chord), found by adjusting the circle until the measured shape matches.
 */
export function section(thickness: number, camber: number): Section {
	let mx = thickness / 1.3;
	let my = 2 * camber;
	let s = circleSection(mx, my);
	for (let i = 0; i < 6; i++) {
		if (s.thickness > 0) mx *= thickness / s.thickness;
		if (s.camber > 1e-6) my *= camber / s.camber;
		s = circleSection(mx, my);
	}
	return s;
}

/** The flow round a section at angle of attack α (rad, measured from the chord line). */
export interface Flow {
	section: Section;
	alpha: number;
	/** Direction of the free stream in the z plane. */
	streamDir: number;
	/** Circulation, in units of U × length. */
	gamma: number;
	/** Lift coefficient per unit span, on the real chord: c_l = 2Γ/(U·c). */
	cl: number;
}

export function flow(sec: Section, alpha: number): Flow {
	const streamDir = sec.chordDir + alpha;
	const gamma = 4 * Math.PI * sec.a * Math.sin(streamDir + sec.beta);
	return { section: sec, alpha, streamDir, gamma, cl: (2 * gamma) / sec.chord };
}

/** The ideal-flow lift coefficient of a section at angle of attack α (rad). */
export const liftCoefficient = (sec: Section, alpha: number) => flow(sec, alpha).cl;

/** Angle of attack (rad) at which the section makes no lift. */
export const zeroLiftAngle = (sec: Section) => -sec.beta - sec.chordDir;

/** z plane → wind coordinates (free stream along +x) and back. */
export const toWind = (f: Flow, z: Cx): Cx => mul(z, cis(-f.streamDir));
const fromWind = (f: Flow, w: Cx): Cx => mul(w, cis(f.streamDir));

/** The point of the ζ plane outside the circle that maps to z. */
function inverse(f: Flow, z: Cx): Cx {
	const r = sqrt(sub(mul(z, z), [4, 0]));
	const s1 = mul([0.5, 0], add(z, r));
	const s2 = mul([0.5, 0], sub(z, r));
	const c: Cx = [-f.section.mx, f.section.my];
	return abs(sub(s1, c)) >= abs(sub(s2, c)) ? s1 : s2;
}

/** Complex velocity u − iv in the ζ plane (free stream U = 1). */
function wZeta(f: Flow, s: Cx): Cx {
	const c: Cx = [-f.section.mx, f.section.my];
	const d = sub(s, c);
	const a2 = f.section.a ** 2;
	const free = cis(-f.streamDir);
	const doublet = div(mul([a2, 0], cis(f.streamDir)), mul(d, d));
	const vortex = div([0, f.gamma / (2 * Math.PI)], d);
	return add(sub(free, doublet), vortex);
}

/** Velocity (u, v) of the air at a point given in the ζ plane, in wind coordinates. */
function velocityAtZeta(f: Flow, s: Cx): Cx {
	const J = sub([1, 0], div([1, 0], mul(s, s)));
	const w = div(wZeta(f, s), J);
	return toWind(f, [w[0], -w[1]]);
}

/** Velocity (u, v) in wind coordinates at a point given in wind coordinates. */
export const velocity = (f: Flow, w: Cx): Cx => velocityAtZeta(f, inverse(f, fromWind(f, w)));

/** Pressure coefficient Cp = (p − p∞)/(½ρU²) = 1 − (V/U)² (Bernoulli). */
function pressureAtZeta(f: Flow, s: Cx) {
	const v = velocityAtZeta(f, s);
	return 1 - (v[0] * v[0] + v[1] * v[1]);
}

/** Stream function ψ at a point of the ζ plane; the section's surface has ψ = Γ ln a / 2π. */
function psiAtZeta(f: Flow, s: Cx) {
	const c: Cx = [-f.section.mx, f.section.my];
	const d = sub(s, c);
	const a2 = f.section.a ** 2;
	const F = add(mul(d, cis(-f.streamDir)), div(mul([a2, 0], cis(f.streamDir)), d));
	return F[1] + (f.gamma / (2 * Math.PI)) * Math.log(abs(d));
}
const psiBody = (f: Flow) => (f.gamma / (2 * Math.PI)) * Math.log(f.section.a);

/** The section's outline in wind coordinates, from the trailing edge round the top. */
export function outline(f: Flow, n = 120): Cx[] {
	const { mx, my, a } = f.section;
	const t0 = Math.atan2(-my, 1 + mx); // ζ = 1, the trailing edge
	return Array.from({ length: n + 1 }, (_, i) =>
		toWind(f, joukowskiMap(add([-mx, my], mul([a, 0], cis(t0 + (2 * Math.PI * i) / n)))))
	);
}

export interface SurfacePoint {
	/** Position and outward normal, wind coordinates. */
	p: Cx;
	n: Cx;
	cp: number;
	upper: boolean;
}

/** Pressure at n points round the surface (just off it, to avoid the cusp). */
export function surfacePressure(f: Flow, n = 48): SurfacePoint[] {
	const { mx, my, a } = f.section;
	const t0 = Math.atan2(-my, 1 + mx);
	const pts: SurfacePoint[] = [];
	for (let i = 0; i < n; i++) {
		// cosine spacing in the ζ angle crowds points near both edges, like real taps
		const u = (i + 0.5) / n;
		const th = t0 + 2 * Math.PI * u;
		const s = add([-mx, my], mul([a * 1.0005, 0], cis(th)));
		const p = toWind(f, joukowskiMap(s));
		const q = toWind(f, joukowskiMap(add([-mx, my], mul([a * 1.05, 0], cis(th)))));
		const d = sub(q, p);
		const len = abs(d);
		pts.push({ p, n: [d[0] / len, d[1] / len], cp: pressureAtZeta(f, s), upper: u < 0.5 });
	}
	return pts;
}

/**
 * Force coefficients found by adding up the surface pressure (per unit span, on the
 * chord): lift across the stream, drag along it. Checks the Kutta–Joukowski theorem and
 * d'Alembert's paradox numerically.
 */
export function integratedForce(f: Flow, n = 4000): { cl: number; cd: number } {
	const { mx, my, a } = f.section;
	const t0 = Math.atan2(-my, 1 + mx);
	let fx = 0;
	let fy = 0;
	let prev: Cx | null = null;
	let prevCp = 0;
	for (let i = 0; i <= n; i++) {
		const th = t0 + 1e-9 + ((2 * Math.PI - 2e-9) * i) / n;
		const s = add([-mx, my], mul([a, 0], cis(th)));
		const p = toWind(f, joukowskiMap(s));
		const cp = pressureAtZeta(f, add([-mx, my], mul([a * (1 + 1e-7), 0], cis(th))));
		if (prev) {
			// the map keeps orientation: the section is traversed anticlockwise, like the
			// circle, so a segment (dx, dy) has outward normal (dy, −dx); pressure pushes in
			const dx = p[0] - prev[0];
			const dy = p[1] - prev[1];
			const c = (cp + prevCp) / 2;
			fx -= c * dy;
			fy -= c * -dx;
		}
		prev = p;
		prevCp = cp;
	}
	return { cl: fy / f.section.chord, cd: fx / f.section.chord };
}

/** A streamline: positions in wind coordinates sampled every `dt` of travel time. */
export interface Streamline {
	/** ψ − ψ(surface), in units of U × length: equal steps carry equal flow. */
	dpsi: number;
	dt: number;
	pts: Cx[];
}

/** Where the streamline ψ − ψ(surface) = dpsi crosses x = x0, found by bisection. */
function seed(f: Flow, x0: number, dpsi: number): Cx {
	const target = psiBody(f) + dpsi;
	const psi = (y: number) => psiAtZeta(f, inverse(f, fromWind(f, [x0, y])));
	let lo = -40;
	let hi = 40;
	for (let i = 0; i < 60; i++) {
		const mid = (lo + hi) / 2;
		if (psi(mid) < target) lo = mid;
		else hi = mid;
	}
	return [x0, (lo + hi) / 2];
}

/**
 * Follows the air from x = x0 to x = x1 (wind coordinates) by fourth-order Runge–Kutta
 * steps of `dt`, recording every step: the position after a time k·dt is pts[k].
 */
export function streamline(f: Flow, dpsi: number, x0 = -8, x1 = 7, dt = 0.02): Streamline {
	let p = seed(f, x0, dpsi);
	const pts: Cx[] = [p];
	const v = (q: Cx) => velocity(f, q);
	for (let k = 0; k < 4000 && p[0] < x1; k++) {
		const k1 = v(p);
		const k2 = v([p[0] + (dt / 2) * k1[0], p[1] + (dt / 2) * k1[1]]);
		const k3 = v([p[0] + (dt / 2) * k2[0], p[1] + (dt / 2) * k2[1]]);
		const k4 = v([p[0] + dt * k3[0], p[1] + dt * k3[1]]);
		p = [
			p[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
			p[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
		];
		pts.push(p);
	}
	return { dpsi, dt, pts };
}

/** Position along a streamline after a time τ (linear between samples). */
export function at(s: Streamline, tau: number): Cx {
	const u = Math.max(0, tau / s.dt);
	const i = Math.floor(u);
	if (i >= s.pts.length - 1) return s.pts[s.pts.length - 1];
	const a = s.pts[i];
	const b = s.pts[i + 1];
	const r = u - i;
	return [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
}

/** Time at which a streamline first reaches x (wind coordinates), or Infinity. */
export function timeToReach(s: Streamline, x: number): number {
	for (let i = 1; i < s.pts.length; i++) {
		const a = s.pts[i - 1];
		const b = s.pts[i];
		if (a[0] < x && b[0] >= x) return s.dt * (i - 1 + (x - a[0]) / (b[0] - a[0]));
	}
	return Infinity;
}

/**
 * Two parcels released side by side, just above and just below the streamline that
 * divides at the nose (ψ offset ±`offset`, in units of U × length): the times at which
 * each passes the trailing edge, measured from when they cross the leading edge.
 */
export function transit(f: Flow, offset = 0.12) {
	const top = streamline(f, offset);
	const bottom = streamline(f, -offset);
	const le = toWind(f, f.section.le)[0];
	const te = toWind(f, f.section.te)[0];
	const tTop = timeToReach(top, te) - timeToReach(top, le);
	const tBottom = timeToReach(bottom, te) - timeToReach(bottom, le);
	return { tTop, tBottom, top, bottom };
}

/** Direction (rad, negative = downwards) of the air just behind the trailing edge. */
export function trailingFlowAngle(f: Flow) {
	const te = toWind(f, f.section.te);
	const v = velocity(f, [te[0] + 0.02 * f.section.chord, te[1]]);
	return Math.atan2(v[1], v[0]);
}

/**
 * The pressure field on a body-fitted grid (rings round the circle in the ζ plane,
 * mapped onto the section's plane): quadrilaterals in wind coordinates with the
 * pressure coefficient at their centre. With `band`, a cell whose corners fall in
 * different bands is split in four, twice, so that the band edges come out smooth.
 */
export function pressureCells(
	f: Flow,
	band?: (cp: number) => number,
	rings = 28,
	spokes = 144,
	rMax = 7
): { quad: Cx[]; cp: number }[] {
	const { mx, my, a } = f.section;
	const c: Cx = [-mx, my];
	// u in 0..1 across the rings (crowded near the surface), v in 0..1 round the circle
	const zeta = (u: number, v: number) =>
		add(c, mul([a * (rMax / a) ** (u ** 1.25), 0], cis(2 * Math.PI * v)));
	const point = (u: number, v: number) => toWind(f, joukowskiMap(zeta(u, v)));
	const cpAt = (u: number, v: number) => pressureAtZeta(f, zeta(u, v));
	const cells: { quad: Cx[]; cp: number }[] = [];
	const cell = (u0: number, u1: number, v0: number, v1: number, depth: number) => {
		if (band && depth < 2) {
			const b = band(cpAt(u0, v0));
			if (
				band(cpAt(u1, v0)) !== b ||
				band(cpAt(u1, v1)) !== b ||
				band(cpAt(u0, v1)) !== b ||
				band(cpAt((u0 + u1) / 2, (v0 + v1) / 2)) !== b
			) {
				const um = (u0 + u1) / 2;
				const vm = (v0 + v1) / 2;
				cell(u0, um, v0, vm, depth + 1);
				cell(um, u1, v0, vm, depth + 1);
				cell(u0, um, vm, v1, depth + 1);
				cell(um, u1, vm, v1, depth + 1);
				return;
			}
		}
		cells.push({
			quad: [point(u0, v0), point(u0, v1), point(u1, v1), point(u1, v0)],
			cp: cpAt((u0 + u1) / 2, (v0 + v1) / 2)
		});
	};
	for (let i = 0; i < rings; i++)
		for (let j = 0; j < spokes; j++)
			cell(i / rings, (i + 1) / rings, j / spokes, (j + 1) / spokes, 0);
	return cells;
}

/**
 * Thin-airfoil theory (Munk, Glauert): a thin section's lift coefficient is
 * 2π(α − α_L0), with the zero-lift angle set by the slope of its mean (camber) line:
 * α_L0 = −(1/π) ∫₀^π (dy_c/dx)(cos θ − 1) dθ, x = (1 − cos θ)/2.
 */
export const THIN_SLOPE = 2 * Math.PI;

/** Slope of the mean line of a NACA four-digit section (max camber m at chord fraction p). */
function naca4Slope(m: number, p: number, x: number) {
	return x < p ? ((2 * m) / (p * p)) * (p - x) : ((2 * m) / ((1 - p) * (1 - p))) * (p - x);
}

/** Zero-lift angle (rad) of a NACA four-digit section by thin-airfoil theory. */
export function naca4ZeroLift(m: number, p: number, n = 2000) {
	let sum = 0;
	for (let i = 0; i < n; i++) {
		const th = (Math.PI * (i + 0.5)) / n;
		sum += naca4Slope(m, p, (1 - Math.cos(th)) / 2) * (Math.cos(th) - 1);
	}
	return (-1 / Math.PI) * sum * (Math.PI / n);
}

// ---- the measured NACA 0012 -----------------------------------------------------------

/** Ladson's 80-grit run, the one used for readouts. */
const RUN = LADSON[0].rows;

/**
 * Measured lift coefficient of the NACA 0012 at α (degrees), interpolated linearly in
 * Ladson's 80-grit run. The section is symmetric, so negative angles mirror positive
 * ones; beyond the last angle measured (19.1°) the last value is kept.
 */
export function measuredLift(alphaDeg: number) {
	return Math.sign(alphaDeg) * interp(Math.abs(alphaDeg), 1);
}
/** Measured drag coefficient of the NACA 0012 at α (degrees), as `measuredLift`. */
export const measuredDrag = (alphaDeg: number) => interp(Math.abs(alphaDeg), 2);

function interp(a: number, col: 1 | 2) {
	const rows = RUN.filter((r) => r[0] > 0);
	// at zero angle: no lift, and the drag of the run's point nearest 0°
	const near0 = RUN.reduce((m, r) => (Math.abs(r[0]) < Math.abs(m[0]) ? r : m));
	const first: readonly number[] = [0, 0, near0[2]];
	const pts = [first, ...rows];
	if (a >= pts[pts.length - 1][0]) return pts[pts.length - 1][col];
	let i = 0;
	while (pts[i + 1][0] < a) i++;
	const p = pts[i];
	const q = pts[i + 1];
	return p[col] + ((q[col] - p[col]) * (a - p[0])) / (q[0] - p[0]);
}

/** Least-squares lift slope (per degree) of a run between two angles. */
export function measuredSlope(run = RUN, from = -4.5, to = 10.5) {
	const lin = run.filter((r) => r[0] >= from && r[0] <= to);
	const n = lin.length;
	const mx = lin.reduce((s, r) => s + r[0], 0) / n;
	const my = lin.reduce((s, r) => s + r[1], 0) / n;
	return (
		lin.reduce((s, r) => s + (r[0] - mx) * (r[1] - my), 0) /
		lin.reduce((s, r) => s + (r[0] - mx) ** 2, 0)
	);
}
