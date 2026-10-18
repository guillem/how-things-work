/**
 * The hanging chain behind the second example: a chain of N equal links, 1 kg
 * per metre, hung between two supports at the same height, s metres apart. Its
 * shape makes the potential energy as small as it can be while its length stays
 * fixed: a constraint, handled with a Lagrange multiplier.
 *
 * Statics gives the discrete answer exactly. The horizontal pull H is the same in
 * every link, and the vertical pull grows by one link's weight from link to link,
 * so the slopes are evenly spaced: tan θⱼ = (j − (N − 1)/2)·w/H, with w the weight
 * of a link. H is whatever makes the links span the gap. As N grows the chain
 * tends to the catenary y = a·cosh(x/a) + c, with a = H/(ρg).
 *
 * Heights y are measured upwards from the supports.
 */
import type { Pt } from './brachistochrone';

export const G = 9.81;
/** Mass per metre of chain (kg/m). */
export const RHO = 1;

export interface Chain {
	/** The joints, from the left support (−s/2, 0) to the right one (s/2, 0). */
	pts: Pt[];
	/** The link angles (rad, from the horizontal, positive going up to the right). */
	angles: number[];
	/** Horizontal tension, the same in every link (N). */
	H: number;
	/** Tension at the supports (N): the Lagrange multiplier of the length constraint. */
	support: number;
	/** Potential energy relative to the supports' height, ρg·Σ ℓ·(mid-height) (J). */
	energy: number;
}

/** The joints and the energy of a chain of links of length ℓ at the given angles. */
function shape(span: number, ell: number, angles: readonly number[]) {
	const pts: Pt[] = [{ x: -span / 2, y: 0 }];
	let energy = 0;
	for (const a of angles) {
		const p = pts[pts.length - 1];
		const q = { x: p.x + ell * Math.cos(a), y: p.y + ell * Math.sin(a) };
		energy += RHO * G * ell * ((p.y + q.y) / 2);
		pts.push(q);
	}
	return { pts, energy };
}

/** The hanging chain of the given length (m) across the given span (m), in N links. */
export function hangingChain(span: number, length: number, N = 40): Chain {
	const ell = length / N;
	const w = RHO * G * ell;
	const anglesFor = (H: number) =>
		Array.from({ length: N }, (_, j) => Math.atan(((j - (N - 1) / 2) * w) / H));
	const reach = (H: number) => anglesFor(H).reduce((s, a) => s + ell * Math.cos(a), 0);
	// The links' horizontal reach grows with H, towards the full length: bisect on log H.
	let lo = Math.log(1e-6);
	let hi = Math.log(1e9);
	for (let k = 0; k < 200; k++) {
		const mid = (lo + hi) / 2;
		if (reach(Math.exp(mid)) < span) lo = mid;
		else hi = mid;
	}
	const H = Math.exp((lo + hi) / 2);
	const angles = anglesFor(H);
	const { pts, energy } = shape(span, ell, angles);
	pts[N] = { x: span / 2, y: 0 };
	// At a support the chain pulls with H sideways and half its weight downwards.
	return { pts, angles, H, support: Math.hypot(H, (RHO * G * length) / 2), energy };
}

/** The catenary y = a·cosh(x/a) − a·cosh(s/2a) of the given length across the span. */
export function catenary(span: number, length: number) {
	// Its length 2a·sinh(s/2a) falls from ∞ to s as a grows: bisect on log a.
	let lo = Math.log(1e-4);
	let hi = Math.log(1e6);
	for (let k = 0; k < 200; k++) {
		const mid = Math.exp((lo + hi) / 2);
		if (2 * mid * Math.sinh(span / (2 * mid)) > length) lo = Math.log(mid);
		else hi = Math.log(mid);
	}
	const a = Math.exp((lo + hi) / 2);
	const c = a * Math.cosh(span / (2 * a));
	return { a, y: (x: number) => a * Math.cosh(x / a) - c, sag: c - a };
}

/** The parabola y = k(x² − s²/4) with the same length (for comparison), sampled. */
export function parabolaPoints(span: number, length: number, n = 200): Pt[] {
	const arc = (k: number) => {
		let s = 0;
		for (let i = 0; i < 400; i++) {
			const x = -span / 2 + (span * (i + 0.5)) / 400;
			s += Math.hypot(1, 2 * k * x) * (span / 400);
		}
		return s;
	};
	let lo = 0;
	let hi = 1e3;
	for (let k = 0; k < 100; k++) {
		const mid = (lo + hi) / 2;
		if (arc(mid) < length) lo = mid;
		else hi = mid;
	}
	const k = (lo + hi) / 2;
	return Array.from({ length: n + 1 }, (_, i) => {
		const x = -span / 2 + (span * i) / n;
		return { x, y: k * (x * x - (span * span) / 4) };
	});
}

/** ρg·∫ y ds along a polyline (J). */
export function energyOf(pts: readonly Pt[]): number {
	let e = 0;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		e += RHO * G * Math.hypot(b.x - a.x, b.y - a.y) * ((a.y + b.y) / 2);
	}
	return e;
}

/**
 * The chain (or, with `flip`, the same chain upside down: an arch) nudged out of
 * shape by ε: a sideways sway, sin(2π(j + ½)/N) added to the link angles, with a
 * tilt and a spread of all the angles (two more unknowns) chosen so the links
 * still end exactly on the right support. Every link keeps its length.
 */
export function nudged(c: Chain, span: number, eps: number, flip = false) {
	const N = c.angles.length;
	const ell = Math.hypot(c.pts[1].x - c.pts[0].x, c.pts[1].y - c.pts[0].y);
	const base = c.angles.map((a) => (flip ? -a : a));
	const mode = base.map((_, j) => Math.sin((2 * Math.PI * (j + 0.5)) / N));
	const spread = base.map((_, j) => j - (N - 1) / 2);
	let alpha = 0;
	let beta = 0;
	let angles = base;
	for (let k = 0; k < 50; k++) {
		angles = base.map((a, j) => a + eps * mode[j] + alpha + beta * spread[j]);
		// Residuals: horizontal reach − span, vertical rise.
		const fx = angles.reduce((s, a) => s + ell * Math.cos(a), 0) - span;
		const fy = angles.reduce((s, a) => s + ell * Math.sin(a), 0);
		if (Math.abs(fx) + Math.abs(fy) < 1e-13) break;
		// Jacobian with respect to (α, β).
		let a11 = 0;
		let a12 = 0;
		let a21 = 0;
		let a22 = 0;
		angles.forEach((a, j) => {
			a11 -= ell * Math.sin(a);
			a12 -= ell * Math.sin(a) * spread[j];
			a21 += ell * Math.cos(a);
			a22 += ell * Math.cos(a) * spread[j];
		});
		const det = a11 * a22 - a12 * a21;
		alpha -= (fx * a22 - fy * a12) / det;
		beta -= (a11 * fy - a21 * fx) / det;
	}
	return shape(span, ell, angles);
}
