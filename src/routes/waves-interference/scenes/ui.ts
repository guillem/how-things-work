/** Helpers shared by the wave scenes. */

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
