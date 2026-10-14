/** What every drawing of the zoom receives from `ZoomScene`. */
export interface FrameProps {
	/**
	 * The part of the drawing on screen, in the drawing's own units (µm for cells
	 * and tissues, in world coordinates; nm for molecular views, from the view's centre).
	 */
	view: { x0: number; y0: number; x1: number; y1: number };
	/** Stage units per drawing unit (how magnified the drawing is). */
	ppu: number;
	t: number;
	/** The structure picked by the reader, if any. */
	sel: string | null;
	/** Picks a structure (shows its card). */
	pick: (id: string) => void;
	/** This drawing takes clicks (it is the front one). */
	interactive: boolean;
	reduced: boolean;
}

/** Is a box (x, y, half-width, half-height) at least partly in view? */
export const inView = (v: FrameProps['view'], x: number, y: number, hw: number, hh = hw) =>
	x + hw >= v.x0 && x - hw <= v.x1 && y + hh >= v.y0 && y - hh <= v.y1;

/** SVG path of a polyline. */
export const polyline = (pts: readonly (readonly [number, number])[], close = false) =>
	pts.length
		? 'M' + pts.map(([x, y]) => `${+x.toFixed(4)} ${+y.toFixed(4)}`).join('L') + (close ? 'Z' : '')
		: '';

/** SVG path of a capsule (cylinder with round ends) of half-length a and radius b. */
export function capsulePath(x: number, y: number, a: number, b: number, angle: number) {
	const h = Math.max(0, a - b);
	const ca = Math.cos(angle);
	const sa = Math.sin(angle);
	const p = (u: number, v: number) =>
		`${+(x + u * ca - v * sa).toFixed(4)} ${+(y + u * sa + v * ca).toFixed(4)}`;
	return `M${p(-h, -b)}L${p(h, -b)}A${b} ${b} 0 0 1 ${p(h, b)}L${p(-h, b)}A${b} ${b} 0 0 1 ${p(-h, -b)}Z`;
}

/** SVG path of a circle. */
export const circlePath = (x: number, y: number, r: number) =>
	`M${+(x - r).toFixed(4)} ${+y.toFixed(4)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
