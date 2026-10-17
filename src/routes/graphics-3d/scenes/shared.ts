/** Helpers shared by the 3D-graphics scenes: reading the controls, and the map's geometry. */
import type { Params } from '#lib/explainer/index.ts';
import {
	DEFAULT_CAMERA,
	DEFAULT_LIGHT,
	FAR,
	NEAR,
	TARGET,
	type CameraSpec,
	type Image,
	type LightSpec
} from '../render';

/** Resolution of every rendered picture: 192 × 120 pixels. */
export const IMG_W = 192;
export const IMG_H = 120;

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function cameraOf(params: Params): CameraSpec {
	return {
		az: num(params.az, DEFAULT_CAMERA.az),
		el: num(params.el, DEFAULT_CAMERA.el),
		dist: num(params.dist, DEFAULT_CAMERA.dist),
		fov: num(params.fov, DEFAULT_CAMERA.fov)
	};
}
export function lightOf(params: Params): LightSpec {
	return {
		az: num(params.lightAz, DEFAULT_LIGHT.az),
		el: num(params.lightEl, DEFAULT_LIGHT.el)
	};
}
export const cubeTurnOf = (params: Params) => (num(params.cubeTurn, 25) * Math.PI) / 180;

/** The picked pixel, stored as "i,j" under `key`; `fallback` if none was picked. */
export function pickOf(params: Params, key: string, fallback: [number, number]): [number, number] {
	const raw = params[key];
	if (typeof raw === 'string') {
		const [i, j] = raw.split(',').map(Number);
		if (Number.isInteger(i) && Number.isInteger(j) && i >= 0 && j >= 0 && i < IMG_W && j < IMG_H)
			return [i, j];
	}
	return fallback;
}

// ---- the map: the scene seen from above --------------------------------------------------
export interface MapBox {
	x: number;
	y: number;
	size: number;
	/** Stage units per world unit. */
	scale: number;
}
export const MAP: MapBox = { x: 16, y: 16, size: 320, scale: 19 };

/** World (x, z) → map point (+z, towards the starting camera, is down the map). */
export const toMap = (m: MapBox, x: number, z: number) => ({
	x: m.x + m.size / 2 + x * m.scale,
	y: m.y + m.size / 2 + z * m.scale
});
const fromMap = (m: MapBox, p: { x: number; y: number }) => ({
	x: (p.x - m.x - m.size / 2) / m.scale,
	z: (p.y - m.y - m.size / 2) / m.scale
});

/** Camera azimuth and distance from a point dragged on the map (it orbits `TARGET`). */
export function cameraFromMap(m: MapBox, p: { x: number; y: number }, el: number) {
	const w = fromMap(m, p);
	const dx = w.x - TARGET[0];
	const dz = w.z - TARGET[2];
	const az = (Math.atan2(dx, dz) * 180) / Math.PI;
	const dist = Math.hypot(dx, dz) / Math.cos((el * Math.PI) / 180);
	return { az: Math.round(az), dist: Math.round(Math.min(8, Math.max(6.5, dist)) * 10) / 10 };
}

/** Lamp azimuth and height from a point on the map (towards the middle = higher). */
export function lightFromMap(m: MapBox, p: { x: number; y: number }, lightDist: number) {
	const w = fromMap(m, p);
	const az = (Math.atan2(w.x, w.z) * 180) / Math.PI;
	const r = Math.min(lightDist, Math.hypot(w.x, w.z));
	const el = (Math.acos(r / lightDist) * 180) / Math.PI;
	return { az: Math.round(az), el: Math.round(Math.min(85, Math.max(10, el))) };
}

/** Wraps an angle in degrees into −180…180. */
export const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

// ---- pictures --------------------------------------------------------------------------
let canvas: HTMLCanvasElement | null = null;
/** A rendered picture as a data URL for an SVG `<image>` ('' while prerendering). */
export function toDataUrl(img: Pick<Image, 'width' | 'height' | 'rgba'>): string {
	if (typeof document === 'undefined') return '';
	canvas ??= document.createElement('canvas');
	canvas.width = img.width;
	canvas.height = img.height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	const data = ctx.createImageData(img.width, img.height);
	data.data.set(img.rgba);
	ctx.putImageData(data, 0, 0);
	return canvas.toDataURL();
}

/**
 * The depth buffer as a grey picture: near is dark, far (and sky) light. The buffer holds the
 * projection's depth (z/w, mapped to 0…1); it is turned back into a distance from the camera and
 * shaded linearly between `from` and `to` units.
 */
export function depthImage(depth: Float32Array, w: number, h: number, from: number, to: number) {
	const rgba = new Uint8ClampedArray(w * h * 4);
	for (let k = 0; k < w * h; k++) {
		const d = depth[k];
		const zn = 2 * d - 1;
		const dist = (2 * NEAR * FAR) / (FAR + NEAR - zn * (FAR - NEAR));
		const u = Math.min(1, Math.max(0, (dist - from) / (to - from)));
		const g = d >= 1 ? 255 : Math.round(25 + 205 * u);
		rgba[4 * k] = g;
		rgba[4 * k + 1] = g;
		rgba[4 * k + 2] = g;
		rgba[4 * k + 3] = 255;
	}
	return { width: w, height: h, rgba };
}

export const fmt = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
export const thousands = (v: number) => Math.round(v).toLocaleString('en-GB');
