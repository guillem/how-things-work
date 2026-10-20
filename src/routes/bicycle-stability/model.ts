/**
 * The linearised Whipple bicycle of Meijaard, Papadopoulos, Ruina and Schwab (2007, Proc. R. Soc.
 * A 463:1955, "Linearized dynamics equations for the balance and steer of a bicycle: a benchmark
 * and review"): lean phi and steer delta of a riderless bicycle rolling at speed v obey
 *
 *   M q'' + v C1 q' + (g K0 + v² K2) q = f,   q = (phi, delta),
 *
 * with M, C1, K0, K2 built from 25 parameters by the paper's appendix formulas (below). Its
 * benchmark bicycle and the theoretical two-mass-skate bicycle of Kooijman et al. (2011, Science
 * 332:339, supplement table 7.1) are the two parameter sets. Self-stability is all four
 * eigenvalues of the motion having negative real parts.
 */

export interface Bike {
	/** Wheelbase, trail (m) and steer axis tilt from vertical (rad). */
	w: number;
	c: number;
	lambda: number;
	/** Rear wheel R: radius, mass, polar (yy) and diametral (xx) inertia. */
	rR: number;
	mR: number;
	IRxx: number;
	IRyy: number;
	/** Rear body and frame B: centre of mass (x forward, z down from the ground), mass, inertia. */
	xB: number;
	zB: number;
	mB: number;
	IBxx: number;
	IByy: number;
	IBzz: number;
	IBxz: number;
	/** Front handlebar and fork H. */
	xH: number;
	zH: number;
	mH: number;
	IHxx: number;
	IHyy: number;
	IHzz: number;
	IHxz: number;
	/** Front wheel F. */
	rF: number;
	mF: number;
	IFxx: number;
	IFyy: number;
}

/** The benchmark bicycle (Meijaard et al. 2007, table 1). */
export const BENCHMARK: Bike = {
	w: 1.02,
	c: 0.08,
	lambda: Math.PI / 10,
	rR: 0.3,
	mR: 2,
	IRxx: 0.0603,
	IRyy: 0.12,
	xB: 0.3,
	zB: -0.9,
	mB: 85,
	IBxx: 9.2,
	IByy: 11,
	IBzz: 2.8,
	IBxz: 2.4,
	xH: 0.9,
	zH: -0.7,
	mH: 4,
	IHxx: 0.05892,
	IHyy: 0.06,
	IHzz: 0.00708,
	IHxz: -0.00756,
	rF: 0.35,
	mF: 3,
	IFxx: 0.1405,
	IFyy: 0.28
};

/**
 * The theoretical two-mass-skate bicycle (Kooijman et al. 2011, supplement table 7.1): two point
 * masses, massless skates for wheels (no spin, no gyroscopic effect) and zero trail.
 */
export const TWO_MASS_SKATE: Bike = {
	w: 1,
	c: 0,
	lambda: (5 * Math.PI) / 180,
	rR: 0,
	mR: 0,
	IRxx: 0,
	IRyy: 0,
	xB: 1.2,
	zB: -0.4,
	mB: 10,
	IBxx: 0,
	IByy: 0,
	IBzz: 0,
	IBxz: 0,
	xH: 1.02,
	zH: -0.2,
	mH: 1,
	IHxx: 0,
	IHyy: 0,
	IHzz: 0,
	IHxz: 0,
	rF: 0,
	mF: 0,
	IFxx: 0,
	IFyy: 0
};

export const G = 9.81;

type M2 = [[number, number], [number, number]];

export interface Matrices {
	M: M2;
	C1: M2;
	K0: M2;
	K2: M2;
}

/**
 * The benchmark's coefficient matrices (Meijaard et al. 2007, appendix A). `gyro: false` sets the
 * wheels' spin angular momentum to zero (S_R = S_F = 0), removing the gyroscopic terms only.
 */
export function matrices(b: Bike, { gyro = true } = {}): Matrices {
	const { w, c, lambda: l } = b;
	const sl = Math.sin(l);
	const cl = Math.cos(l);
	const mT = b.mR + b.mB + b.mH + b.mF;
	const xT = (b.xB * b.mB + b.xH * b.mH + w * b.mF) / mT;
	const zT = (-b.rR * b.mR + b.zB * b.mB + b.zH * b.mH - b.rF * b.mF) / mT;
	const ITxx =
		b.IRxx +
		b.IBxx +
		b.IHxx +
		b.IFxx +
		b.mR * b.rR ** 2 +
		b.mB * b.zB ** 2 +
		b.mH * b.zH ** 2 +
		b.mF * b.rF ** 2;
	const ITxz = b.IBxz + b.IHxz - b.mB * b.xB * b.zB - b.mH * b.xH * b.zH + b.mF * w * b.rF;
	// The wheels are symmetric: their zz inertia equals their xx inertia.
	const ITzz =
		b.IRxx + b.IBzz + b.IHzz + b.IFxx + b.mB * b.xB ** 2 + b.mH * b.xH ** 2 + b.mF * w ** 2;
	const mA = b.mH + b.mF;
	const xA = (b.xH * b.mH + w * b.mF) / mA;
	const zA = (b.zH * b.mH - b.rF * b.mF) / mA;
	const IAxx = b.IHxx + b.IFxx + b.mH * (b.zH - zA) ** 2 + b.mF * (b.rF + zA) ** 2;
	const IAxz = b.IHxz - b.mH * (b.xH - xA) * (b.zH - zA) + b.mF * (w - xA) * (b.rF + zA);
	const IAzz = b.IHzz + b.IFxx + b.mH * (b.xH - xA) ** 2 + b.mF * (w - xA) ** 2;
	const uA = (xA - w - c) * cl - zA * sl;
	const IAll = mA * uA ** 2 + IAxx * sl ** 2 + 2 * IAxz * sl * cl + IAzz * cl ** 2;
	const IAlx = -mA * uA * zA + IAxx * sl + IAxz * cl;
	const IAlz = mA * uA * xA + IAxz * sl + IAzz * cl;
	const mu = (c / w) * cl;
	const SR = gyro && b.rR > 0 ? b.IRyy / b.rR : 0;
	const SF = gyro && b.rF > 0 ? b.IFyy / b.rF : 0;
	const ST = SR + SF;
	const SA = mA * uA + mu * mT * xT;
	return {
		M: [
			[ITxx, IAlx + mu * ITxz],
			[IAlx + mu * ITxz, IAll + 2 * mu * IAlz + mu ** 2 * ITzz]
		],
		K0: [
			[mT * zT, -SA],
			[-SA, -SA * sl]
		],
		K2: [
			[0, ((ST - mT * zT) / w) * cl],
			[0, ((SA + SF * sl) / w) * cl]
		],
		C1: [
			[0, mu * ST + SF * cl + (ITxz / w) * cl - mu * mT * zT],
			[-(mu * ST + SF * cl), (IAlz / w) * cl + mu * (SA + (ITzz / w) * cl)]
		]
	};
}

// ---- eigenvalues ------------------------------------------------------------------------------

export interface Complex {
	re: number;
	im: number;
}

/** Coefficients a4…a0 of det(M s² + v C1 s + g K0 + v² K2). */
export function characteristic({ M, C1, K0, K2 }: Matrices, v: number) {
	const C = C1.map((r) => r.map((x) => v * x)) as M2;
	const K = K0.map((r, i) => r.map((x, j) => G * x + v * v * K2[i][j])) as M2;
	return [
		M[0][0] * M[1][1] - M[0][1] * M[1][0],
		M[0][0] * C[1][1] + C[0][0] * M[1][1] - M[0][1] * C[1][0] - C[0][1] * M[1][0],
		M[0][0] * K[1][1] +
			C[0][0] * C[1][1] +
			K[0][0] * M[1][1] -
			M[0][1] * K[1][0] -
			C[0][1] * C[1][0] -
			K[0][1] * M[1][0],
		C[0][0] * K[1][1] + K[0][0] * C[1][1] - C[0][1] * K[1][0] - K[0][1] * C[1][0],
		K[0][0] * K[1][1] - K[0][1] * K[1][0]
	];
}

/** Roots of a polynomial (coefficients from the highest power), by Durand–Kerner iteration. */
export function roots(coef: number[]): Complex[] {
	const n = coef.length - 1;
	const a = coef.map((x) => x / coef[0]);
	let z: Complex[] = Array.from({ length: n }, (_, k) => {
		// Distinct starting points on a circle a little off the real axis.
		const ang = (2 * Math.PI * k) / n + 0.4;
		const r = 1 + Math.max(...a.slice(1).map(Math.abs));
		return { re: r * Math.cos(ang), im: r * Math.sin(ang) };
	});
	const mul = (p: Complex, q: Complex) => ({
		re: p.re * q.re - p.im * q.im,
		im: p.re * q.im + p.im * q.re
	});
	const div = (p: Complex, q: Complex) => {
		const d = q.re * q.re + q.im * q.im;
		return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d };
	};
	for (let it = 0; it < 500; it++) {
		let moved = 0;
		z = z.map((zi, i) => {
			let p: Complex = { re: 1, im: 0 };
			for (let k = 1; k <= n; k++) p = { re: mul(p, zi).re + a[k], im: mul(p, zi).im };
			let q: Complex = { re: 1, im: 0 };
			z.forEach((zj, j) => {
				if (j !== i) q = mul(q, { re: zi.re - zj.re, im: zi.im - zj.im });
			});
			const step = div(p, q);
			moved = Math.max(moved, Math.hypot(step.re, step.im));
			return { re: zi.re - step.re, im: zi.im - step.im };
		});
		if (moved < 1e-13) break;
	}
	// Clean up roots that are real to rounding.
	return z
		.map((r) => (Math.abs(r.im) < 1e-9 ? { re: r.re, im: 0 } : r))
		.sort((p, q) => q.re - p.re || q.im - p.im);
}

/** The four eigenvalues at speed v, largest real part first. */
export const eigenvalues = (m: Matrices, v: number) => roots(characteristic(m, v));

export const stableAt = (m: Matrices, v: number) => eigenvalues(m, v).every((e) => e.re < 0);

/**
 * The self-stable speed band: the first interval in (0, vMax] where every eigenvalue has a
 * negative real part, its ends refined by bisection. Null if there is none; `truncated` when it
 * is still stable at vMax (so it ends at vMax or beyond).
 */
export function stableBand(
	m: Matrices,
	vMax = 15
): { from: number; to: number; truncated: boolean } | null {
	const dv = 0.01;
	let from: number | null = null;
	for (let v = dv; v <= vMax + 1e-9; v += dv) {
		const s = stableAt(m, v);
		if (s && from === null) from = refine(m, v - dv, v, false);
		if (!s && from !== null) return { from, to: refine(m, v - dv, v, true), truncated: false };
	}
	// Still stable at vMax: the band goes on at least that far, but higher speeds weren't checked.
	return from === null ? null : { from, to: vMax, truncated: true };
}

/** The speed between lo and hi where stability changes (stable at lo when `stableLo`). */
function refine(m: Matrices, lo: number, hi: number, stableLo: boolean) {
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (stableAt(m, mid) === stableLo) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

// ---- motion -----------------------------------------------------------------------------------

export interface State {
	t: number;
	/** Lean and steer (rad), their rates, the heading (rad) and the rear contact's position (m). */
	phi: number;
	delta: number;
	dphi: number;
	ddelta: number;
	psi: number;
	x: number;
	y: number;
}

/**
 * Integrates the linear equations (RK4, 2 ms) from an initial lean rate (a sideways push), with an
 * optional steer torque (N m) applied from `torqueAt` to `torqueUntil`. The heading follows the
 * benchmark's kinematics, psi' = (v delta + c delta') cos(lambda) / w.
 */
export function simulate(
	b: Bike,
	m: Matrices,
	v: number,
	{ push = 0.5, torque = 0, torqueAt = 0, torqueUntil = Infinity, duration = 6, every = 0.02 } = {}
): State[] {
	const { M, C1, K0, K2 } = m;
	const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
	const Mi = [
		[M[1][1] / det, -M[0][1] / det],
		[-M[1][0] / det, M[0][0] / det]
	];
	const K = K0.map((r, i) => r.map((x, j) => G * x + v * v * K2[i][j]));
	const acc = (q: number[], dq: number[], t: number) => {
		const f1 = t >= torqueAt && t < torqueUntil ? torque : 0;
		const r0 = -(v * (C1[0][0] * dq[0] + C1[0][1] * dq[1]) + K[0][0] * q[0] + K[0][1] * q[1]);
		const r1 = f1 - (v * (C1[1][0] * dq[0] + C1[1][1] * dq[1]) + K[1][0] * q[0] + K[1][1] * q[1]);
		return [Mi[0][0] * r0 + Mi[0][1] * r1, Mi[1][0] * r0 + Mi[1][1] * r1];
	};
	const dt = 0.002;
	let s = [0, 0, push, 0]; // phi, delta, dphi, ddelta
	let psi = 0;
	let x = 0;
	let y = 0;
	const out: State[] = [];
	const keep = Math.round(every / dt);
	const cl = Math.cos(b.lambda);
	for (let i = 0; i * dt <= duration + 1e-9; i++) {
		const t = i * dt;
		if (i % keep === 0)
			out.push({ t, phi: s[0], delta: s[1], dphi: s[2], ddelta: s[3], psi, x, y });
		const deriv = (u: number[], tt: number) => {
			const a = acc([u[0], u[1]], [u[2], u[3]], tt);
			return [u[2], u[3], a[0], a[1]];
		};
		const k1 = deriv(s, t);
		const k2 = deriv(
			s.map((u, j) => u + (dt / 2) * k1[j]),
			t + dt / 2
		);
		const k3 = deriv(
			s.map((u, j) => u + (dt / 2) * k2[j]),
			t + dt / 2
		);
		const k4 = deriv(
			s.map((u, j) => u + dt * k3[j]),
			t + dt
		);
		const yaw = ((v * s[1] + b.c * s[3]) * cl) / b.w;
		s = s.map((u, j) => u + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
		psi += yaw * dt;
		x += v * Math.cos(psi) * dt;
		y += v * Math.sin(psi) * dt;
	}
	return out;
}
