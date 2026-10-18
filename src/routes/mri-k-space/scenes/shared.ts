/**
 * What the scenes share: the scans of the head (computed once, on first use), the grey scale of
 * the images and the logarithmic scale of k-space, and a colour raster for the wave pictures.
 */
import { acquire, type KSpace } from '../model';
import { head, type Weighting } from '../phantom';

/** Samples per line and lines, and the field of view (cm), of the page's scans. */
export const N = 128;
export const FOV = 24;

const scans = new Map<Weighting, KSpace>();
/** The full k-space of the head in one weighting. */
export function scan(w: Weighting): KSpace {
	let k = scans.get(w);
	if (!k) {
		k = acquire(head(w), N, N, FOV, FOV);
		scans.set(w, k);
	}
	return k;
}

/** Brightness of the image's white: a little above the brightest tissue (fluid, 0.57). */
export const WHITE = 0.62;

/**
 * k-space drawn on a logarithmic scale, log(1 + |F| / floor), so that its faint edges show beside
 * its bright centre; `top` is the value drawn white (the full scan's centre).
 */
export function logMagnitude(k: KSpace, floor: number): Float64Array {
	const out = new Float64Array(k.re.length);
	for (let i = 0; i < out.length; i++) out[i] = Math.log1p(Math.hypot(k.re[i], k.im[i]) / floor);
	return out;
}
export const K_FLOOR = 0.02;

let canvas: HTMLCanvasElement | null = null;

/**
 * Paints a signed field as colour over a grey picture: `base` (0–1) sets the brightness, `wave`
 * (−1…1) mixes towards `pos` or `neg` (RGB). For the stripes laid over the head.
 */
export function waveImage(
	base: ArrayLike<number>,
	wave: ArrayLike<number>,
	width: number,
	height: number,
	pos: [number, number, number],
	neg: [number, number, number]
): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(width, height);
	const px = img.data;
	for (let i = 0; i < width * height; i++) {
		const b = Math.min(1, Math.max(0, base[i]));
		const w = wave[i];
		const c = w >= 0 ? pos : neg;
		const a = Math.min(1, Math.abs(w));
		for (let j = 0; j < 3; j++) {
			const grey = 255 * b;
			px[4 * i + j] = Math.round(grey * (1 - a * 0.85) + c[j] * b * a * 0.85);
		}
		px[4 * i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}

/** Colours of the two signs of a wave (the same in both themes: images sit on black). */
export const WAVE_POS: [number, number, number] = [255, 146, 43];
export const WAVE_NEG: [number, number, number] = [77, 171, 247];
