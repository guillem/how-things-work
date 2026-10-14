/**
 * The view of the Bloch sphere: an orthographic camera a little above the equator, turned
 * so that +x (|+⟩) comes out towards the lower left and +y (|+i⟩) points right, as in most
 * textbooks. `project` gives screen offsets in units of the radius (x right, y down) and the
 * depth towards the viewer; `unproject` inverts it on the front hemisphere, for dragging.
 */
import type { Vec3 } from '../qubits';

const A = (25 * Math.PI) / 180; // azimuth of the camera
const E = (15 * Math.PI) / 180; // elevation of the camera
const RIGHT: Vec3 = [-Math.sin(A), Math.cos(A), 0];
const UP: Vec3 = [-Math.sin(E) * Math.cos(A), -Math.sin(E) * Math.sin(A), Math.cos(E)];
const TOWARDS: Vec3 = [Math.cos(E) * Math.cos(A), Math.cos(E) * Math.sin(A), Math.sin(E)];

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function project(p: Vec3) {
	return { x: dot(p, RIGHT), y: -dot(p, UP), depth: dot(p, TOWARDS) };
}

/** The point of the sphere's front half under the screen offset (a, b), in radii. */
export function unproject(a: number, b: number): Vec3 {
	let x = a;
	let y = -b;
	const r = Math.hypot(x, y);
	if (r > 1) {
		x /= r;
		y /= r;
	}
	const c = Math.sqrt(Math.max(0, 1 - x * x - y * y));
	return [0, 1, 2].map((i) => x * RIGHT[i] + y * UP[i] + c * TOWARDS[i]) as Vec3;
}

/**
 * A circle on the sphere through the unit vectors e1 and e2 (at height h along their normal,
 * radius √(1 − h²) when e1, e2 are scaled by it), split into its front and back halves.
 */
export function circle(
	cx: number,
	cy: number,
	R: number,
	e1: Vec3,
	e2: Vec3,
	offset: Vec3 = [0, 0, 0]
) {
	let front = '';
	let back = '';
	let prev: boolean | null = null;
	const N = 72;
	for (let i = 0; i <= N; i++) {
		const t = (i / N) * 2 * Math.PI;
		const p: Vec3 = [0, 1, 2].map(
			(k) => offset[k] + Math.cos(t) * e1[k] + Math.sin(t) * e2[k]
		) as Vec3;
		const s = project(p);
		const X = (cx + s.x * R).toFixed(1);
		const Y = (cy + s.y * R).toFixed(1);
		const isFront = s.depth >= 0;
		if (isFront) front += `${prev === true ? 'L' : 'M'}${X} ${Y}`;
		else back += `${prev === false ? 'L' : 'M'}${X} ${Y}`;
		prev = isFront;
	}
	return { front, back };
}

/** Points along the arc that v sweeps when turned by `angle` about `axis` (for a trace). */
export function arc(
	cx: number,
	cy: number,
	R: number,
	turnFn: (v: Vec3, n: Vec3, a: number) => Vec3,
	v: Vec3,
	axis: Vec3,
	angle: number
) {
	let d = '';
	const N = Math.max(2, Math.ceil(Math.abs(angle) / 0.08));
	for (let i = 0; i <= N; i++) {
		const s = project(turnFn(v, axis, (angle * i) / N));
		d += `${i ? 'L' : 'M'}${(cx + s.x * R).toFixed(1)} ${(cy + s.y * R).toFixed(1)}`;
	}
	return d;
}
