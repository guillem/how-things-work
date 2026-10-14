/** Shared helpers for the vision-color scenes. */

/** One cell of a readout card: a small label, a big value and an optional note. */
export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
}

/** Signed number with a real minus sign. */
export const signed = (v: number, digits = 2) =>
	`${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}`;
