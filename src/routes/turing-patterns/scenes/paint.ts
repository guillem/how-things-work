/**
 * Painting a field of activator into a canvas shown as an SVG `<image>`, with colours from the
 * theme's CSS variables (read when the theme changes). The colour ramp runs from the low
 * activator colour through the middle one (the uniform level) to the high one.
 */
export type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null = null;

/** The RGB value of a CSS colour variable (e.g. '--tp-high'); black outside a browser. */
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

/** 256 colours: low (index 0) → mid (128) → high (255). */
export function coatRamp(): RGB[] {
	const lo = cssColor('--tp-low');
	const mid = cssColor('--tp-mid');
	const hi = cssColor('--tp-high');
	return Array.from({ length: 256 }, (_, k) => {
		const u = k / 255;
		const [a, b, f] = u < 0.5 ? [lo, mid, u * 2] : [mid, hi, u * 2 - 1];
		return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * f)) as RGB;
	});
}

/**
 * The ramp index for an activator level relative to the uniform state: tanh-compressed so that
 * the starting noise (±5 %) is visible and tall peaks do not wash out.
 */
export function shade(rel: number) {
	const u = Math.tanh((rel - 1) / 0.35);
	return Math.max(0, Math.min(255, Math.round((u + 1) * 127.5)));
}

let canvas: HTMLCanvasElement | null = null;

/**
 * Paints a w × h field (values relative to the uniform state) into a data URL; cells where
 * `inside` is false are transparent.
 */
export function paintField(
	values: ArrayLike<number>,
	w: number,
	h: number,
	ramp: RGB[],
	norm: number,
	inside?: (i: number) => boolean
): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const img = ctx.createImageData(w, h);
	const px = img.data;
	for (let i = 0; i < w * h; i++) {
		if (inside && !inside(i)) continue;
		const c = ramp[shade(values[i] / norm)];
		px[4 * i] = c[0];
		px[4 * i + 1] = c[1];
		px[4 * i + 2] = c[2];
		px[4 * i + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	return canvas.toDataURL();
}
