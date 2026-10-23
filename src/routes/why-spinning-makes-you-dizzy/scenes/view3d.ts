/**
 * A tiny 3D helper for the page's drawings: points in a body's own frame (x to its right…
 * as drawn, y up, z forwards), turned about the vertical (a spin), and projected for a viewer
 * looking slightly down. Painter's order by depth.
 */
export type V3 = readonly [number, number, number];

export interface View {
	/** Screen position of the origin. */
	cx: number;
	cy: number;
	/** Drawing units per body unit. */
	s: number;
	/** How far the viewer looks down, radians. */
	elev: number;
}

/** Turns a point about the vertical axis by `a` radians (positive: the body turns to its right). */
export function yaw(p: V3, a: number): V3 {
	const c = Math.cos(a);
	const s = Math.sin(a);
	return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/** Turns a point about the sideways axis (a nod: positive tips the front down). */
export function pitch(p: V3, a: number): V3 {
	const c = Math.cos(a);
	const s = Math.sin(a);
	return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}

/** Turns a point about the forwards axis (a tilt: positive tips the top to the viewer's left). */
export function roll(p: V3, a: number): V3 {
	const c = Math.cos(a);
	const s = Math.sin(a);
	return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
}

export interface Projected {
	x: number;
	y: number;
	/** Larger is nearer the viewer. */
	depth: number;
}

export function project(v: View, p: V3): Projected {
	const ce = Math.cos(v.elev);
	const se = Math.sin(v.elev);
	return {
		x: v.cx + v.s * p[0],
		y: v.cy - v.s * (p[1] * ce - p[2] * se),
		depth: p[2] * ce + p[1] * se
	};
}
