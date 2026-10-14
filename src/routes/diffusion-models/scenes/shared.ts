/**
 * What the diffusion-models scenes share: number formats, the plane's coordinates, the reading of
 * "Run by itself" / slider controls, and pixel images drawn as data URLs.
 */
import type { Params } from '#lib/explainer/index.ts';
import { clamp } from '#lib/draw/index.ts';

/** Numbers with `d` decimals, a real minus sign, no "-0". */
export const fmt = (v: number, d = 2) => {
	const s = v.toFixed(d);
	return Number(s) === 0 ? (0).toFixed(d) : s.replace('-', '−');
};
export const int = (v: number) => Math.round(v).toLocaleString('en-US');
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const textWidth = (text: string, size: number) => text.length * size * 0.56;

/**
 * Where a process stands, 0 … 1. With "Run by itself" on, it plays as a pure function of t:
 * `lead` seconds still, `run` seconds of progress, then it holds the end. Off (or under reduced
 * motion), it is the slider's value (`value` already scaled 0 … 1).
 */
export function playhead(
	t: number,
	auto: boolean,
	reduced: boolean,
	value: number,
	run = 7,
	lead = 0.6
): number {
	if (!auto || reduced) return clamp(value);
	return clamp((t - lead) / run);
}

export const bool = (params: Params, id: string, def = true) =>
	typeof params[id] === 'boolean' ? (params[id] as boolean) : def;
export const num = (params: Params, id: string, def: number) => {
	const v = Number(params[id]);
	return Number.isFinite(v) ? v : def;
};

// ---------------------------------------------------------------------------- the plane

/** The plane's drawing box (stage units) and its scale: 1 data unit = S px. */
export const PLANE = { x: 24, y: 24, w: 600, h: 552, cx: 324, cy: 300, s: 112 };
export const px = (x: number) => PLANE.cx + x * PLANE.s;
export const py = (y: number) => PLANE.cy - y * PLANE.s;

/**
 * Many dots as ONE path (each a zero-length round-capped segment), so a few hundred points
 * cost one SVG node. `pts` is flat [x, y, x, y, …] in data units; `pick` filters by index.
 */
export function dotsPath(pts: ArrayLike<number>, pick?: (i: number) => boolean): string {
	let d = '';
	const n = pts.length / 2;
	for (let i = 0; i < n; i++) {
		if (pick && !pick(i)) continue;
		const x = px(pts[2 * i]);
		const y = py(pts[2 * i + 1]);
		if (
			x < PLANE.x - 4 ||
			x > PLANE.x + PLANE.w + 4 ||
			y < PLANE.y - 4 ||
			y > PLANE.y + PLANE.h + 4
		)
			continue;
		d += `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
	}
	return d;
}

// ---------------------------------------------------------------------------- pixel images

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, u: number): RGB =>
	[0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * u) as RGB;

/**
 * Fixed colours of the pixel images (data URLs cannot read CSS variables), one set per theme:
 * paper (−1) is a dark ink-well in both themes, as MNIST is drawn (white strokes on black).
 */
const THEME = {
	light: { paper: hex('#1d1e21'), ink: hex('#f8f9fa') },
	dark: { paper: hex('#050506'), ink: hex('#e9ecef') }
};
const palettes = new Map<boolean, RGB[]>();
function palette(dark: boolean): RGB[] {
	let p = palettes.get(dark);
	if (!p) {
		const c = THEME[dark ? 'dark' : 'light'];
		p = Array.from({ length: 256 }, (_, i) => mix(c.paper, c.ink, i / 255));
		palettes.set(dark, p);
	}
	return p;
}

/** An 8-bit palette BMP as a data URL (top row first). */
function bmp(width: number, height: number, idx: Uint8Array, pal: RGB[]): string {
	const row = Math.ceil(width / 4) * 4;
	const offset = 14 + 40 + 256 * 4;
	const buf = new Uint8Array(offset + row * height);
	const dv = new DataView(buf.buffer);
	buf[0] = 0x42;
	buf[1] = 0x4d;
	dv.setUint32(2, buf.length, true);
	dv.setUint32(10, offset, true);
	dv.setUint32(14, 40, true);
	dv.setInt32(18, width, true);
	dv.setInt32(22, -height, true);
	dv.setUint16(26, 1, true);
	dv.setUint16(28, 8, true);
	dv.setUint32(34, row * height, true);
	dv.setUint32(46, 256, true);
	pal.forEach(([r, g, b], i) => {
		buf[54 + i * 4] = Math.round(b);
		buf[55 + i * 4] = Math.round(g);
		buf[56 + i * 4] = Math.round(r);
	});
	for (let y = 0; y < height; y++)
		buf.set(idx.subarray(y * width, (y + 1) * width), offset + y * row);
	let bin = '';
	for (let i = 0; i < buf.length; i += 0x8000)
		bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
	return 'data:image/bmp;base64,' + btoa(bin);
}

/** A 28 × 28 image with values −1 (paper) … 1 (ink), clipped. */
export function imageUrl(v: ArrayLike<number>, dark: boolean, side = 28): string {
	const idx = Uint8Array.from({ length: side * side }, (_, i) =>
		Math.round(127.5 * (clamp(v[i], -1, 1) + 1))
	);
	return bmp(side, side, idx, palette(dark));
}

function bytesOf(base64: string): Uint8Array {
	const bin = atob(base64);
	return Uint8Array.from({ length: bin.length }, (_, i) => bin.charCodeAt(i));
}

/** Decodes a stored 4-bit image (two pixels per byte, high nibble first) to −1 … 1. */
export function unpack4(base64: string): Float32Array {
	const b = bytesOf(base64);
	const out = new Float32Array(b.length * 2);
	for (let i = 0; i < b.length; i++) {
		out[2 * i] = ((b[i] >> 4) / 15) * 2 - 1;
		out[2 * i + 1] = ((b[i] & 15) / 15) * 2 - 1;
	}
	return out;
}

/** Decodes a stored 8-bit MNIST digit (0 … 255) to −1 … 1. */
export function unpack8(base64: string): Float32Array {
	return Float32Array.from(bytesOf(base64), (v) => v / 127.5 - 1);
}
