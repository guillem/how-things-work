/** Helpers shared by the twelve-notes scenes. */

/** One cell of a readout card. */
export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
}

/** SVG path through a list of points. */
export const pathOf = (pts: { x: number; y: number }[]) =>
	pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** A number with a fixed count of decimals and a unicode minus sign. */
export const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');

/** A signed number: "+13.7", "−2.0", "0.0". */
export const signed = (v: number, digits = 1) => {
	const s = Math.abs(v).toFixed(digits);
	if (Number(s) === 0) return s;
	return (v > 0 ? '+' : '−') + s;
};

/** Point on a circle of radius r around (cx, cy) at a fraction u of a turn, clockwise from the top. */
export const onCircle = (cx: number, cy: number, r: number, u: number) => ({
	x: cx + r * Math.sin(2 * Math.PI * u),
	y: cy - r * Math.cos(2 * Math.PI * u)
});
