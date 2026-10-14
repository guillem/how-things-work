/** Shared helpers for the vision-color scenes. */
import { afterimage, conesOfRGB, type Cones } from '../colour';

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

// ------------------------------------------------------------------ afterimage scene

/** The grey field of the afterimage scene, as screen RGB. */
export const AFTER_GREY: readonly [number, number, number] = [128, 128, 128];
/** The discs to stare at, with the afterimage the page says each one leaves on the grey. */
export const AFTER_DISCS = [
	{ id: 'cyan', name: 'cyan', rgb: [0, 190, 190], x: 360, y: 190, after: 'reddish' },
	{ id: 'yellow', name: 'yellow', rgb: [225, 205, 0], x: 600, y: 190, after: 'bluish' },
	{ id: 'magenta', name: 'magenta', rgb: [205, 40, 205], x: 480, y: 344, after: 'greenish' }
] as const;
/** How far adaptation goes in a 20 s stare: an illustrative value, not a measurement. */
export const AFTER_STRENGTH = 0.3;
/** The cone signals the grey gives after staring at a disc of this colour (shown as a swatch). */
export const afterimageOf = (rgb: readonly [number, number, number]): Cones =>
	afterimage(conesOfRGB(...rgb), conesOfRGB(...AFTER_GREY), AFTER_STRENGTH);
