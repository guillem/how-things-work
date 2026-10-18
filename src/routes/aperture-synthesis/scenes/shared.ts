/**
 * What the scenes share: painting images and the uv plane as pictures for an SVG `<image>`.
 *
 * Images are painted with east to the left and north up, as astronomers draw the sky; the uv
 * plane with u to the right and v up. Positive brightness runs black → red → yellow → white,
 * negative black → blue, the same in both themes (the images sit on black).
 */
import { N, pixel } from '../model';

let canvas: HTMLCanvasElement | null = null;

/** Centred index → screen row or column, so that the centre pixel lands in the middle. */
const wrap = (i: number) => ((((N / 2 - i) % N) + N) % N) - N / 2;

/**
 * An image (centred pixels, +x east, +y north) as a data URL, with a soft (asinh) stretch:
 * values near `soft × hi` and below are shown nearly linearly, brighter ones compressed, `hi` is
 * white and −hi full blue.
 */
export function paint(values: ArrayLike<number>, hi: number, soft = 0.08, mirrorX = true): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = N;
	canvas.height = N;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(N, N);
	const px = img.data;
	const h = hi > 0 ? hi : 1;
	const norm = Math.asinh(1 / soft);
	for (let r = 0; r < N; r++) {
		const y = wrap(r);
		for (let c = 0; c < N; c++) {
			const x = mirrorX ? wrap(c) : c - N / 2;
			const v = Math.max(-1, Math.min(1, Math.asinh(values[pixel(x, y)] / (soft * h)) / norm));
			const o = 4 * (r * N + c);
			if (v >= 0) {
				px[o] = 255 * Math.min(1, 1.6 * v);
				px[o + 1] = 255 * Math.min(1, Math.max(0, 1.7 * v - 0.45));
				px[o + 2] = 255 * Math.min(1, Math.max(0, 2.2 * v - 1.2));
			} else {
				px[o] = 0;
				px[o + 1] = 255 * 0.45 * -v;
				px[o + 2] = 255 * Math.min(1, 1.1 * -v);
			}
			px[o + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}

/** The uv weights of a filled dish as a grey picture (u right, v up). */
export function uvGrey(w: ArrayLike<number>, colour: [number, number, number]): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = N;
	canvas.height = N;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(N, N);
	const px = img.data;
	for (let r = 0; r < N; r++) {
		const iv = wrap(r);
		for (let c = 0; c < N; c++) {
			const a = w[(iv + N / 2) * N + c];
			const o = 4 * (r * N + c);
			px[o] = colour[0];
			px[o + 1] = colour[1];
			px[o + 2] = colour[2];
			px[o + 3] = Math.round(255 * Math.min(1, a));
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}

/** The CLEAN iterations the slider steps through. */
export const ITERATIONS = [0, 1, 2, 3, 5, 10, 20, 50, 100, 200, 300, 500, 1000, 1500, 2000, 3000];

/** Seconds formatted as a duration in minutes, hours or days. */
export function duration(minutes: number): string {
	if (minutes < 90) return `${Math.round(minutes)} minutes`;
	if (minutes < 60 * 36) return `${Math.round(minutes / 60)} hours`;
	return `${Math.round(minutes / 1440)} days`;
}
