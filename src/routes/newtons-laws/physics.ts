/**
 * The mechanics behind the Newton's-laws explainer. Everything is computed
 * from Newton's second law, F = m·a, in SI units (metres, seconds, kilograms),
 * with g = 9.81 m/s². The scenes only draw these results.
 *
 * Simplifications, stated on the page where they matter:
 * - air resistance on the projectile is quadratic drag, F = −k·|v|·v (a fair
 *   model for a ball through air), with k per kilogram set by the slider;
 * - carts move without rolling resistance unless friction is switched on, and
 *   collide head-on along a line;
 * - the cart on the track stays on the rails (like a roller-coaster car); with
 *   friction on, the friction force is μ·m·g·cos(slope), ignoring the extra
 *   grip from curvature.
 */

export const G = 9.81;

// ------------------------------------------------------------------ projectile

export interface Sample2D {
	t: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
}

/**
 * Flight of a projectile launched from (0, 0) at `speed` m/s and `angleDeg`
 * above the horizontal, with quadratic drag coefficient `k` (per kg, 1/m),
 * until it lands back at y = 0. Fourth-order Runge–Kutta, step `dt`.
 */
export function flight(speed: number, angleDeg: number, k = 0, dt = 0.005): Sample2D[] {
	const a = (angleDeg * Math.PI) / 180;
	let s = { x: 0, y: 0, vx: speed * Math.cos(a), vy: speed * Math.sin(a) };
	const out: Sample2D[] = [{ t: 0, ...s }];
	const f = (p: typeof s) => {
		const v = Math.hypot(p.vx, p.vy);
		return { x: p.vx, y: p.vy, vx: -k * v * p.vx, vy: -G - k * v * p.vy };
	};
	const add = (p: typeof s, d: typeof s, h: number) => ({
		x: p.x + d.x * h,
		y: p.y + d.y * h,
		vx: p.vx + d.vx * h,
		vy: p.vy + d.vy * h
	});
	let t = 0;
	for (let i = 0; i < 200000; i++) {
		const k1 = f(s);
		const k2 = f(add(s, k1, dt / 2));
		const k3 = f(add(s, k2, dt / 2));
		const k4 = f(add(s, k3, dt));
		const next = {
			x: s.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
			y: s.y + (dt / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
			vx: s.vx + (dt / 6) * (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx),
			vy: s.vy + (dt / 6) * (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy)
		};
		t += dt;
		if (next.y < 0 && t > dt) {
			// Land exactly on y = 0 by linear interpolation within the last step.
			const u = s.y / (s.y - next.y);
			out.push({
				t: t - dt + u * dt,
				x: s.x + (next.x - s.x) * u,
				y: 0,
				vx: s.vx + (next.vx - s.vx) * u,
				vy: s.vy + (next.vy - s.vy) * u
			});
			return out;
		}
		s = next;
		out.push({ t, ...s });
	}
	return out;
}

/** Range, flight time and peak height of a flight. */
export function summary(path: Sample2D[]) {
	let top = path[0];
	for (const p of path) if (p.y > top.y) top = p;
	const last = path[path.length - 1];
	return { range: last.x, time: last.t, height: top.y, topAt: top };
}

/** Position on a flight at time `t` (clamped to the flight), interpolated. */
export function at(path: Sample2D[], t: number): Sample2D {
	if (t <= 0) return path[0];
	const last = path[path.length - 1];
	if (t >= last.t) return last;
	let lo = 0;
	let hi = path.length - 1;
	while (hi - lo > 1) {
		const mid = (lo + hi) >> 1;
		if (path[mid].t <= t) lo = mid;
		else hi = mid;
	}
	const a = path[lo];
	const b = path[hi];
	const u = (t - a.t) / (b.t - a.t);
	return {
		t,
		x: a.x + (b.x - a.x) * u,
		y: a.y + (b.y - a.y) * u,
		vx: a.vx + (b.vx - a.vx) * u,
		vy: a.vy + (b.vy - a.vy) * u
	};
}

/** Launch angle (whole degrees) that gives the longest range for this speed and drag. */
export function bestAngle(speed: number, k: number) {
	let best = 45;
	let bestRange = -1;
	for (let a = 5; a <= 85; a++) {
		const r = summary(flight(speed, a, k, 0.01)).range;
		if (r > bestRange) {
			bestRange = r;
			best = a;
		}
	}
	return best;
}

// ------------------------------------------------------------------ collisions

/**
 * Velocities after a head-on collision of masses m1, m2 moving at u1, u2,
 * with coefficient of restitution e (1 = perfectly bouncy/elastic, 0 = they
 * stick together). Momentum is always conserved; kinetic energy only if e = 1.
 */
export function collide(m1: number, u1: number, m2: number, u2: number, e: number) {
	const p = m1 * u1 + m2 * u2;
	const v1 = (p + m2 * e * (u2 - u1)) / (m1 + m2);
	const v2 = (p + m1 * e * (u1 - u2)) / (m1 + m2);
	return { v1, v2 };
}

export const kinetic = (m: number, v: number) => 0.5 * m * v * v;

/**
 * Two carts on a line: positions over time. Cart 1 starts at x1 moving at u1,
 * cart 2 at x2 moving at u2; they collide when they touch (each is `width`
 * long) and then move apart (or together) with the post-collision speeds.
 * Returns position functions and the collision time (Infinity if they never meet).
 */
export function carts(
	o: { m1: number; u1: number; x1: number; m2: number; u2: number; x2: number; e: number },
	width: number
) {
	const gap = o.x2 - o.x1 - width;
	const closing = o.u1 - o.u2;
	const tc = gap > 0 && closing > 0 ? gap / closing : gap <= 0 ? 0 : Infinity;
	const { v1, v2 } = collide(o.m1, o.u1, o.m2, o.u2, o.e);
	const pos = (x0: number, u: number, v: number) => (t: number) =>
		t <= tc ? x0 + u * t : x0 + u * tc + v * (t - tc);
	return {
		tc,
		v1,
		v2,
		x1: pos(o.x1, o.u1, v1),
		x2: pos(o.x2, o.u2, v2),
		velocity1: (t: number) => (t <= tc ? o.u1 : v1),
		velocity2: (t: number) => (t <= tc ? o.u2 : v2)
	};
}

// ------------------------------------------------------------------ pushing

/**
 * A cart of mass m at rest, pushed by a constant force F for `pushFor`
 * seconds, with an optional rolling-friction force μ·m·g once it moves.
 * Returns x(t), v(t) and the acceleration while pushed.
 */
export function push(m: number, F: number, pushFor: number, mu = 0) {
	const friction = mu * m * G;
	const aPush = Math.max(0, F - friction) / m; // friction only resists motion
	const vEnd = aPush * pushFor;
	const xEnd = 0.5 * aPush * pushFor * pushFor;
	const decel = friction / m;
	const stopAfter = decel > 0 ? vEnd / decel : Infinity;
	const v = (t: number) => (t <= pushFor ? aPush * t : Math.max(0, vEnd - decel * (t - pushFor)));
	const x = (t: number) => {
		if (t <= pushFor) return 0.5 * aPush * t * t;
		const s = Math.min(t - pushFor, stopAfter);
		return xEnd + vEnd * s - 0.5 * decel * s * s;
	};
	return { x, v, a: aPush, vEnd, stopAfter };
}

// ------------------------------------------------------------------ track

export interface Track {
	/** Height (m) at horizontal position x (m), for x in [0, length]. */
	h: (x: number) => number;
	/** Slope dh/dx. */
	dh: (x: number) => number;
	length: number;
}

/**
 * A smooth track through control heights spaced evenly over `length` metres
 * (monotone cubic interpolation, so it never overshoots between the points).
 */
export function trackThrough(heights: number[], length: number): Track {
	const n = heights.length;
	const dx = length / (n - 1);
	const d = heights.slice(0, -1).map((h, i) => (heights[i + 1] - h) / dx);
	const m = heights.map((_, i) => {
		if (i === 0) return d[0];
		if (i === n - 1) return d[n - 2];
		if (d[i - 1] * d[i] <= 0) return 0;
		return (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
	});
	const seg = (x: number) => {
		const i = Math.max(0, Math.min(n - 2, Math.floor(x / dx)));
		return { i, u: (x - i * dx) / dx };
	};
	return {
		length,
		h: (x) => {
			const { i, u } = seg(x);
			const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
			const h10 = u ** 3 - 2 * u ** 2 + u;
			const h01 = -2 * u ** 3 + 3 * u ** 2;
			const h11 = u ** 3 - u ** 2;
			return h00 * heights[i] + h10 * dx * m[i] + h01 * heights[i + 1] + h11 * dx * m[i + 1];
		},
		dh: (x) => {
			const { i, u } = seg(x);
			const d00 = 6 * u ** 2 - 6 * u;
			const d10 = 3 * u ** 2 - 4 * u + 1;
			const d01 = -6 * u ** 2 + 6 * u;
			const d11 = 3 * u ** 2 - 2 * u;
			return (d00 * heights[i] + d10 * dx * m[i] + d01 * heights[i + 1] + d11 * dx * m[i + 1]) / dx;
		}
	};
}

export interface RideSample {
	t: number;
	/** Horizontal position (m). */
	x: number;
	/** Speed along the track (m/s, signed: + to the right). */
	v: number;
	kinetic: number;
	potential: number;
	/** Energy turned into heat by friction so far. */
	dissipated: number;
}

/**
 * A cart of mass m released at rest from the start of the track, sliding
 * under gravity (and friction μ, if any), bouncing off buffers at both ends
 * without losing energy. Integrates along the track's arc length with RK4.
 * Returns samples every `dt` seconds for `duration` seconds.
 */
export function ride(
	track: Track,
	m: number,
	mu: number,
	duration: number,
	dt = 0.002
): RideSample[] {
	const out: RideSample[] = [];
	const h0 = track.h(0);
	let x = 0;
	let v = 0; // speed along the track
	let dissipated = 0;
	const accel = (x: number, v: number) => {
		const s = track.dh(x);
		const c = 1 / Math.sqrt(1 + s * s); // cos(slope)
		const sin = s * c;
		const fr = Math.abs(v) > 1e-6 ? -Math.sign(v) * mu * G * c : 0;
		return -G * sin + fr;
	};
	// dx/dt = v·cos(slope)
	const dxdt = (x: number, v: number) => v / Math.sqrt(1 + track.dh(x) ** 2);
	let t = 0;
	const record = () =>
		out.push({
			t,
			x,
			v,
			kinetic: 0.5 * m * v * v,
			potential: m * G * (track.h(x) - 0),
			dissipated
		});
	record();
	const every = Math.round(0.02 / dt);
	for (let i = 1; t < duration; i++) {
		// When at rest on a slope gentle enough for static friction, stay put.
		const s = track.dh(x);
		if (Math.abs(v) < 1e-4 && mu > 0 && Math.abs(s) <= mu) {
			v = 0;
		} else {
			const k1x = dxdt(x, v);
			const k1v = accel(x, v);
			const k2x = dxdt(x + (k1x * dt) / 2, v + (k1v * dt) / 2);
			const k2v = accel(x + (k1x * dt) / 2, v + (k1v * dt) / 2);
			const k3x = dxdt(x + (k2x * dt) / 2, v + (k2v * dt) / 2);
			const k3v = accel(x + (k2x * dt) / 2, v + (k2v * dt) / 2);
			const k4x = dxdt(x + k3x * dt, v + k3v * dt);
			const k4v = accel(x + k3x * dt, v + k3v * dt);
			const nx = x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
			let nv = v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
			// Friction can stop the cart but never push it backwards.
			if (mu > 0 && v !== 0 && Math.sign(nv) !== Math.sign(v) && Math.abs(s) <= mu) nv = 0;
			x = nx;
			v = nv;
			// Buffers at the ends: elastic bounce.
			if (x < 0) {
				x = -x;
				v = Math.abs(v);
			} else if (x > track.length) {
				x = 2 * track.length - x;
				v = -Math.abs(v);
			}
		}
		t += dt;
		// Whatever mechanical energy is missing went to heat (exact bookkeeping;
		// with μ = 0 this stays at the integrator's tiny error).
		dissipated = Math.max(0, m * G * h0 - 0.5 * m * v * v - m * G * track.h(x));
		if (i % every === 0) record();
	}
	return out;
}
