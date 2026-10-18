/** Shared drawing geometry of the cochlea scenes: the uncoiled cochlea, base on the left. */
import { LENGTH_MM, SECTIONS } from '../model.ts';

/** x of the base and of the apex end of the membrane. */
export const X0 = 120;
export const X1 = 890;
/** x of a place, mm from the base. */
export const xAt = (mm: number) => X0 + (mm / LENGTH_MM) * (X1 - X0);
/** Width of the drawn membrane at a place, px (about 0.1 mm at the base to 0.5 mm at the apex). */
export const membraneWidth = (mm: number) => 2.5 + (7.5 * mm) / LENGTH_MM;

/** Every k-th section, for drawing. */
export const STRIDE = 12;
export const DRAWN = Array.from({ length: Math.ceil(SECTIONS / STRIDE) }, (_, i) => i * STRIDE);

/** Tick frequencies of the "tuned to" row, Hz, with their labels. */
export const MAP_TICKS: [number, string][] = [
	[16000, '16 kHz'],
	[8000, '8k'],
	[4000, '4k'],
	[2000, '2k'],
	[1000, '1k'],
	[500, '500'],
	[250, '250'],
	[125, '125 Hz']
];

export const hz = (f: number) =>
	f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz` : `${Math.round(f)} Hz`;
