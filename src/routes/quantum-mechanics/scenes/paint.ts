/**
 * Small helpers for the scenes that paint pixels (the slit wave map and the
 * dots on the screen) into a canvas shown as an SVG `<image>`. Colours come
 * from the theme's CSS variables, read when the theme changes.
 */
export type RGB = [number, number, number];

let probe: CanvasRenderingContext2D | null = null;

/** The RGB value of a CSS colour variable (e.g. '--qm-dot'); black outside a browser. */
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

/** 256 colours from `lo` to `hi`. */
export function ramp(lo: RGB, hi: RGB): RGB[] {
	return Array.from(
		{ length: 256 },
		(_, k) => [0, 1, 2].map((i) => Math.round(lo[i] + ((hi[i] - lo[i]) * k) / 255)) as RGB
	);
}

export const rgb = (c: RGB, a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
