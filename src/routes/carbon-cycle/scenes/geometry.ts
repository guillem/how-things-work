/**
 * Drawing helpers shared by the carbon-cycle scenes: areas and widths to
 * scale, and wide arrows ("bands") whose width is a flow.
 */
import { along, polylineLength, smooth, type Point } from '#lib/draw/index.ts';

/** Square scene units per GtC of a reservoir. */
const AREA_PER_GTC = 3.2;
/** Scene units of band width per GtC/yr of flow. */
const WIDTH_PER_GTCYR = 0.35;
/** Flows thinner than this are drawn at this width, dashed. */
const MIN_WIDTH = 1.5;

export const widthOf = (flux: number) => Math.max(MIN_WIDTH, flux * WIDTH_PER_GTCYR);
export const toScale = (flux: number) => flux * WIDTH_PER_GTCYR >= MIN_WIDTH;

/** A rectangle of fixed height (or width) whose area holds `gtc`. */
export const widthFor = (gtc: number, height: number) => (gtc * AREA_PER_GTC) / height;
export const heightFor = (gtc: number, width: number) => (gtc * AREA_PER_GTC) / width;

interface Band {
	/** Centre line (smoothed). */
	line: Point[];
	/** Outline of the band with its arrowhead, as an SVG path. */
	d: string;
	length: number;
	width: number;
}

/**
 * A band of width `w` along the smoothed polyline `points`, ending in an
 * arrowhead. Its outline is the centre line offset by ±w/2.
 */
export function band(points: Point[], w: number): Band {
	const line = smooth(points, 10);
	const length = polylineLength(line);
	const head = Math.max(7, w * 0.7);
	const headWidth = Math.max(w + 7, w * 1.45);
	// Stop the body where the head starts.
	const bodyEnd = Math.max(0, 1 - head / length);
	const n = 40;
	const left: string[] = [];
	const right: string[] = [];
	for (let i = 0; i <= n; i++) {
		const p = along(line, (i / n) * bodyEnd);
		const nx = -Math.sin(p.angle);
		const ny = Math.cos(p.angle);
		left.push(`${(p.x + (nx * w) / 2).toFixed(1)} ${(p.y + (ny * w) / 2).toFixed(1)}`);
		right.push(`${(p.x - (nx * w) / 2).toFixed(1)} ${(p.y - (ny * w) / 2).toFixed(1)}`);
	}
	const base = along(line, bodyEnd);
	const tip = line[line.length - 1];
	const nx = -Math.sin(base.angle);
	const ny = Math.cos(base.angle);
	const hl = `${(base.x + (nx * headWidth) / 2).toFixed(1)} ${(base.y + (ny * headWidth) / 2).toFixed(1)}`;
	const hr = `${(base.x - (nx * headWidth) / 2).toFixed(1)} ${(base.y - (ny * headWidth) / 2).toFixed(1)}`;
	const d =
		`M${left.join(' L')} L${hl} L${tip.x.toFixed(1)} ${tip.y.toFixed(1)} L${hr} L` +
		right.reverse().join(' L') +
		'Z';
	return { line, d, length, width: w };
}

/** Format a number of GtC with thousands separators. */
export const gtc = (v: number, digits = 0) =>
	v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
