/** Geometry shared by the ring scenes: positions on a circle, 0 at the top, clockwise. */
import { TAU } from '#lib/draw/index.ts';

export interface Circle {
	cx: number;
	cy: number;
	r: number;
}

/** Point at fraction u of a turn on a circle of radius r. */
export const at = (c: Circle, u: number, r = c.r) => ({
	x: c.cx + r * Math.sin(TAU * u),
	y: c.cy - r * Math.cos(TAU * u)
});

const f = (v: number) => v.toFixed(1);

/** Clockwise span from u0 to u1 as a fraction of a turn, in (0, 1]. */
export const span = (u0: number, u1: number) => {
	const s = (((u1 - u0) % 1) + 1) % 1;
	return s === 0 ? 1 : s;
};

/** SVG path of the clockwise arc from u0 to u1 (fractions of a turn), at radius r. */
export function arc(c: Circle, u0: number, u1: number, r = c.r) {
	const s = span(u0, u1);
	const a = at(c, u0, r);
	if (s >= 0.9999) {
		const b = at(c, u0 + 0.5, r);
		return `M${f(a.x)} ${f(a.y)} A${r} ${r} 0 1 1 ${f(b.x)} ${f(b.y)} A${r} ${r} 0 1 1 ${f(a.x)} ${f(a.y)}`;
	}
	const b = at(c, u0 + s, r);
	return `M${f(a.x)} ${f(a.y)} A${r} ${r} 0 ${s > 0.5 ? 1 : 0} 1 ${f(b.x)} ${f(b.y)}`;
}

/** A chord from a to b bowed towards the centre (a quadratic Bézier), and a point along it. */
export function chordPath(c: Circle, a: { x: number; y: number }, b: { x: number; y: number }) {
	const k = 0.35;
	const qx = (a.x + b.x) / 2 + (c.cx - (a.x + b.x) / 2) * k;
	const qy = (a.y + b.y) / 2 + (c.cy - (a.y + b.y) / 2) * k;
	return {
		d: `M${f(a.x)} ${f(a.y)} Q${f(qx)} ${f(qy)} ${f(b.x)} ${f(b.y)}`,
		point: (s: number) => ({
			x: (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * qx + s * s * b.x,
			y: (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * qy + s * s * b.y
		})
	};
}

/** A position on the ring as a number from 0 to 999 (the top bits of the 32-bit identifier). */
export const dial = (u: number) => Math.floor(u * 1000);

/** Colour token of server i (A, B, ...). */
export const serverColor = (i: number) => `var(--dht-s${(i % 9) + 1})`;
