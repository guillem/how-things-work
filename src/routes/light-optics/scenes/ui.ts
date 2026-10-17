/** Helpers shared by the optics scenes. */
import { wavelengthToColor } from '#lib/draw/index.ts';
import type { Leg, RayPath, Vec } from '../optics';

/** One cell of a readout card. */
export interface Cell {
	id: string;
	label: string;
	value: string;
	sub?: string;
	color?: string;
}

/** SVG path through a list of points. */
export const pathOf = (pts: Vec[], close = false) =>
	pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
	(close ? ' Z' : '');

/** A number with a fixed count of decimals and a unicode minus sign. */
export const fmt = (v: number, digits = 1) => v.toFixed(digits).replace('-', '−');

/**
 * Colour of light of a wavelength, darkened on the light stage so that
 * yellow and green stay visible on the off-white background.
 */
export function rayColour(nm: number, dark: boolean): string {
	const c = wavelengthToColor(nm);
	const [r, g, b] = (c.match(/\d+/g) ?? ['0', '0', '0']).map(Number);
	if (dark) {
		// Deep violet is too dim on the dark stage: lift it towards white a little.
		const w = nm < 440 ? (440 - nm) / 120 : 0;
		const up = (v: number) => Math.round(v + (255 - v) * w);
		return `rgb(${up(r)}, ${up(g)}, ${up(b)})`;
	}
	const k = 0.78;
	return `rgb(${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)})`;
}

/** Wavelengths that stand for white light (nm), red to violet. */
export const WHITE = [690, 650, 610, 585, 560, 530, 500, 470, 440, 410];

/** Opacity of a ray carrying a share `power` of the light (dim rays stay visible). */
export const rayOpacity = (power: number) => Math.min(1, Math.max(0.16, Math.sqrt(power)));

/** A traced path to draw, with its colour. `skip` legs at the start are not drawn. */
export interface DrawnPath {
	key: string;
	legs: Leg[];
	color: string;
	skip?: number;
	width?: number;
	/** Scale on the drawn opacity (to fade a whole path in or out). */
	fade?: number;
}

/** Light pulses along a path: positions where the optical path length is phase + k·spacing. */
export function pulsesOn(
	legs: Leg[],
	phase: number,
	spacing: number,
	skip = 0
): (Vec & { o: number })[] {
	const out: (Vec & { o: number })[] = [];
	for (let i = skip; i < legs.length; i++) {
		const l = legs[i];
		const L = Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
		const o0 = l.opl;
		const o1 = l.opl + l.n * L;
		let k = Math.ceil((o0 - phase) / spacing);
		for (let o = phase + k * spacing; o < o1; o = phase + ++k * spacing) {
			const u = (o - o0) / l.n / L;
			out.push({
				x: l.a.x + (l.b.x - l.a.x) * u,
				y: l.a.y + (l.b.y - l.a.y) * u,
				o: rayOpacity(l.power)
			});
			if (out.length > 60) return out;
		}
	}
	return out;
}

/** Index of the first path in `paths` that is the main ray (not a reflection branch). */
export const mainPaths = (paths: RayPath[]) => paths.filter((p) => p.parent < 0);

/** Rays of several colours traced from the same start. */
interface ColourSet {
	nm: number;
	paths: RayPath[];
}

const same = (a: Leg, b: Leg) =>
	Math.abs(a.a.x - b.a.x) +
		Math.abs(a.a.y - b.a.y) +
		Math.abs(a.b.x - b.b.x) +
		Math.abs(a.b.y - b.b.y) <
	0.05;

/**
 * White light as several colours: the stretch where all colours still share
 * one path is drawn once, in the white-light colour; from where they part,
 * each colour is drawn on its own.
 */
export function spectrumPaths(
	sets: ColourSet[],
	dark: boolean,
	white: string,
	key: string
): DrawnPath[] {
	if (!sets.length) return [];
	const mains = sets.map((s) => s.paths[0]);
	let common = 0;
	while (
		common < mains[0].legs.length &&
		mains.every((m) => m.legs.length > common && same(m.legs[common], mains[0].legs[common]))
	)
		common++;
	const out: DrawnPath[] = [];
	if (common > 0) out.push({ key: `${key}-w`, legs: mains[0].legs.slice(0, common), color: white });
	sets.forEach((s, j) => {
		const color = rayColour(s.nm, dark);
		s.paths.forEach((p, i) => {
			if (i === 0) {
				if (common < p.legs.length)
					out.push({ key: `${key}-${s.nm}-0`, legs: p.legs, color, skip: common });
			} else if (p.parent === 0 && p.from <= common) {
				// A reflection off a surface the colours reach together: draw it once, white.
				if (j === 0) out.push({ key: `${key}-b${i}`, legs: p.legs, color: white });
			} else out.push({ key: `${key}-${s.nm}-${i}`, legs: p.legs, color });
		});
	});
	return out;
}
