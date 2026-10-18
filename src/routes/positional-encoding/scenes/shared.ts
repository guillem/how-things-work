/** Small helpers shared by the positional-encoding scenes. */

export const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** `d` decimals, with a real minus sign and no "−0.00". */
export const fix = (v: number, d = 2) => {
	const s = v.toFixed(d);
	return Number(s) === 0 ? (0).toFixed(d) : s.replace('-', '−');
};

/** Radians to whole degrees, as text. */
export const deg = (rad: number, d = 0) => `${fix((rad * 180) / Math.PI, d)}°`;

/** A number with thousands separators. */
export const big = (v: number) => Math.round(v).toLocaleString('en-US');

/**
 * A point on a dial: the angle a is measured counter-clockwise from the right, as on the unit
 * circle, so on screen y goes up as sin a grows.
 */
export const onDial = (cx: number, cy: number, r: number, a: number) => ({
	x: cx + r * Math.cos(a),
	y: cy - r * Math.sin(a)
});

/** An SVG arc on a dial from angle a0 to a1 (counter-clockwise when a1 > a0), radius r. */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
	const span = a1 - a0;
	if (Math.abs(span) >= 2 * Math.PI - 1e-6) {
		// a full circle: two half arcs
		const p = onDial(cx, cy, r, a0);
		const q = onDial(cx, cy, r, a0 + Math.PI);
		return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}A${r} ${r} 0 1 0 ${q.x.toFixed(1)} ${q.y.toFixed(1)}A${r} ${r} 0 1 0 ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
	}
	const p = onDial(cx, cy, r, a0);
	const q = onDial(cx, cy, r, a1);
	const large = Math.abs(span) > Math.PI ? 1 : 0;
	const sweep = span > 0 ? 0 : 1; // counter-clockwise on screen is SVG sweep 0
	return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}A${r} ${r} 0 ${large} ${sweep} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
}

/** A filled wedge from the centre: the sector between a0 and a1. */
export function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
	if (Math.abs(a1 - a0) >= 2 * Math.PI - 1e-6) return arc(cx, cy, r, a0, a0 + 2 * Math.PI) + 'Z';
	return `M${cx} ${cy}L${arc(cx, cy, r, a0, a1).slice(1)}Z`;
}
