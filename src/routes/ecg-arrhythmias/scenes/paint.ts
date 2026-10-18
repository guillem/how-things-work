/**
 * Painting the sheet into a canvas shown as an SVG `<image>`, with colours from the theme's CSS
 * variables (read again when the theme changes): resting tissue, excited (by voltage u) and
 * recovering (by the recovery variable v), and the scar.
 */
import { ATRIUM, H, SCAR, VENTRICLE, W, type Heart } from '../model';

export type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null = null;

/** The RGB value of a CSS colour variable; black outside a browser. */
export function cssColor(name: string): RGB {
	if (typeof document === 'undefined') return [0, 0, 0];
	if (!probe) {
		const c = document.createElement('canvas');
		c.width = c.height = 1;
		probe = c.getContext('2d', { willReadFrequently: true });
	}
	if (!probe) return [0, 0, 0];
	const css = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	probe.clearRect(0, 0, 1, 1);
	probe.fillStyle = '#000';
	probe.fillStyle = css || '#000';
	probe.fillRect(0, 0, 1, 1);
	const px = probe.getImageData(0, 0, 1, 1).data;
	return [px[0], px[1], px[2]];
}

export interface Palette {
	rest: RGB;
	atria: RGB;
	excited: RGB;
	recovering: RGB;
	scar: RGB;
}

export function palette(): Palette {
	return {
		rest: cssColor('--ecg-rest'),
		atria: cssColor('--ecg-atria'),
		excited: cssColor('--ecg-excited'),
		recovering: cssColor('--ecg-recovering'),
		scar: cssColor('--ecg-scar')
	};
}

const mix = (a: RGB, b: RGB, f: number, out: Uint8ClampedArray, o: number) => {
	out[o] = a[0] + (b[0] - a[0]) * f;
	out[o + 1] = a[1] + (b[1] - a[1]) * f;
	out[o + 2] = a[2] + (b[2] - a[2]) * f;
	out[o + 3] = 255;
};

let canvas: HTMLCanvasElement | null = null;

/** The sheet as a data URL: excited cells by u, recovering ones by v, the scar dark. */
export function paintSheet(h: Heart, pal: Palette): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(W, H);
	const px = img.data;
	const { u, v, kind } = h;
	for (let i = 0; i < W * H; i++) {
		const k = kind[i];
		if (k === SCAR) {
			mix(pal.scar, pal.scar, 0, px, 4 * i);
			continue;
		}
		if (k !== ATRIUM && k !== VENTRICLE) continue;
		const base = k === ATRIUM ? pal.atria : pal.rest;
		const U = u[i];
		if (U > 0.12) {
			const f = Math.min(1, (U - 0.12) / 0.6);
			mix(base, pal.excited, f, px, 4 * i);
		} else {
			mix(base, pal.recovering, Math.min(1, v[i] / 1.6), px, 4 * i);
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}
