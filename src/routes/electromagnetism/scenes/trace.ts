/**
 * Field-line tracing for the magnetic scenes, in a plane through the axis of
 * a set of coaxial current loops (the model's `loopsField`). Lines start in
 * the mid-plane of the source at radii that split its flux into equal shares,
 * so they crowd where the field is strong, and are followed until they close
 * on themselves or leave the region. Results are cached per source and count.
 */
import { loopFlux, loopsField, type Loop } from '../em';

export interface Frame {
	/** Screen position of the source's centre and px per metre. */
	cx: number;
	cy: number;
	scale: number;
	/** Visible region (screen px). */
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

export interface Line {
	/** Screen points of the upper half (ρ > 0); the lower half is its mirror image. */
	points: { x: number; y: number }[];
	closed: boolean;
}

/** Radius (m) inside which the flux through the mid-plane is `share` of the flux through `rMax`. */
function seedRadius(loops: readonly Loop[], rMax: number, share: number) {
	const flux = (r: number) => loops.reduce((s, l) => s + loopFlux({ ...l, I: 1 }, r, 0), 0);
	const total = flux(rMax);
	let lo = 1e-6;
	let hi = rMax;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (flux(mid) < share * total) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
}

function traceFrom(loops: readonly Loop[], f: Frame, z0: number, r0: number, dir: 1 | -1) {
	const pts: { x: number; y: number }[] = [];
	let z = z0;
	let r = r0;
	const h = 2.5 / f.scale;
	const at = (zz: number, rr: number) => {
		const b = loopsField(loops, rr, zz);
		const m = Math.hypot(b.z, b.rho);
		return m > 0 ? { z: (dir * b.z) / m, r: (dir * b.rho) / m } : null;
	};
	let travelled = 0;
	let closed = false;
	for (let i = 0; i < 1600; i++) {
		pts.push({ x: f.cx + z * f.scale, y: f.cy - r * f.scale });
		const k1 = at(z, r);
		if (!k1) break;
		const k2 = at(z + (h / 2) * k1.z, r + (h / 2) * k1.r);
		if (!k2) break;
		const k3 = at(z + (h / 2) * k2.z, r + (h / 2) * k2.r);
		if (!k3) break;
		const k4 = at(z + h * k3.z, r + h * k3.r);
		if (!k4) break;
		const nz = z + (h / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z);
		const nr = r + (h / 6) * (k1.r + 2 * k2.r + 2 * k3.r + k4.r);
		travelled += h;
		// Back at the start: crossing the mid-plane again near the seed, the same way round.
		if (
			travelled > 40 / f.scale &&
			Math.sign(z - z0) !== Math.sign(nz - z0) &&
			Math.abs(nr - r0) < 4 / f.scale
		) {
			pts.push({ x: f.cx + z0 * f.scale, y: f.cy - r0 * f.scale });
			closed = true;
			break;
		}
		z = nz;
		r = Math.max(0, nr);
		const x = f.cx + z * f.scale;
		const y = f.cy - r * f.scale;
		if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) {
			pts.push({ x, y });
			break;
		}
	}
	return { pts, closed };
}

const cache = new Map<string, Line[]>();

/**
 * `count` field lines (upper half) of the loops, seeded in the mid-plane at
 * z = 0 between the axis and `rMax`, at equal shares of the flux.
 */
export function axialLines(
	key: string,
	loops: readonly Loop[],
	f: Frame,
	rMax: number,
	count: number
): Line[] {
	const id = `${key}|${count}`;
	const hit = cache.get(id);
	if (hit) return hit;
	const lines: Line[] = [];
	for (let k = 1; k <= count; k++) {
		// Shares growing as the square, so that in a near-uniform field inside the
		// source the lines start evenly spaced across the flat cut.
		const r0 = seedRadius(loops, rMax, (k / (count + 1)) ** 2);
		const fwd = traceFrom(loops, f, 0, r0, 1);
		if (fwd.closed) {
			lines.push({ points: fwd.pts, closed: true });
		} else {
			const back = traceFrom(loops, f, 0, r0, -1);
			lines.push({ points: [...back.pts.reverse(), ...fwd.pts.slice(1)], closed: false });
		}
	}
	cache.set(id, lines);
	return lines;
}
