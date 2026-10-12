/**
 * Shared drawing helpers for the chemical-bonds scenes: element colours (the usual
 * CPK-style colours chemists use: white hydrogen, grey carbon, blue nitrogen, red oxygen,
 * green halogens), drawn atom sizes from the covalent radii in the element data, and an
 * orthographic 3D projection that the reader can turn.
 */
import { data, type Sym, type Vec } from './model';

export interface AtomLook {
	fill: string;
	edge: string;
	/** Colour of the symbol written on the atom. */
	ink: string;
}

export const ATOM: Record<Sym, AtomLook> = {
	H: { fill: '#f3f4f6', edge: '#9ca3af', ink: '#1f2937' },
	C: { fill: 'var(--carbon)', edge: '#9ca3af', ink: '#ffffff' },
	N: { fill: '#3b82f6', edge: '#1d4ed8', ink: '#ffffff' },
	O: { fill: '#e5484d', edge: '#b3262b', ink: '#ffffff' },
	F: { fill: '#9fd356', edge: '#5f8f22', ink: '#1f2937' },
	Ne: { fill: '#f0a6c8', edge: '#b0618a', ink: '#1f2937' },
	Na: { fill: '#9061f9', edge: '#6d28d9', ink: '#ffffff' },
	Cl: { fill: '#2fb35f', edge: '#18803f', ink: '#ffffff' }
};

/** Charge-map colours: δ− (electrons pulled here) and δ+ (pulled away). */
export const NEG = '#e03131';
export const POS = '#1c7ed6';

/** Drawn radius (stage px) of an atom: grows with its covalent radius (pm). */
export const atomRadius = (s: Sym, k = 1) => k * (9 + 0.17 * (data(s).radius ?? 70));

/**
 * Double- and triple-bond covalent radii (pm) from Pyykkö & Atsumi, Chem. Eur. J. 15,
 * 12770 (2009), for the atoms the builder can join by a multiple bond (C, N, O).
 */
const MULTIPLE_RADIUS: Partial<Record<Sym, { 2: number; 3: number }>> = {
	C: { 2: 67, 3: 60 },
	N: { 2: 60, 3: 54 },
	O: { 2: 57, 3: 53 }
};

/** Covalent radius (pm) of an atom in a bond of the given order. */
function bondRadius(s: Sym, order: number) {
	const multiple = MULTIPLE_RADIUS[s];
	if (multiple && (order === 2 || order === 3)) return multiple[order];
	return data(s).radius ?? 70;
}

/**
 * Bond length (stage px) between two atoms: the sum of their covalent radii for that bond
 * order (single by default), so double and triple bonds come out shorter.
 */
export const bondLength = (a: Sym, b: Sym, pxPerPm = 1.05, order = 1) =>
	pxPerPm * (bondRadius(a, order) + bondRadius(b, order));

export interface Projected {
	x: number;
	y: number;
	/** Positive is towards the viewer. */
	depth: number;
}

/**
 * Orthographic projection with z up: turn by `yaw` about the vertical axis, then tilt by
 * `pitch` about the screen's horizontal axis. Returns a function from model coordinates
 * (in stage px, centred on the origin) to the screen.
 */
export function projector(yaw: number, pitch: number, cx: number, cy: number) {
	const cyw = Math.cos(yaw);
	const syw = Math.sin(yaw);
	const cp = Math.cos(pitch);
	const sp = Math.sin(pitch);
	return (v: Vec): Projected => {
		const X = v[0] * cyw - v[1] * syw;
		const D = v[0] * syw + v[1] * cyw;
		const up = v[2] * cp + D * sp;
		const depth = -(D * cp - v[2] * sp);
		return { x: cx + X, y: cy - up, depth };
	};
}

export const slerpish = (a: Vec, b: Vec, u: number): Vec => {
	const v: Vec = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
	const l = Math.hypot(v[0], v[1], v[2]);
	// Opposite directions would pass through zero: nudge sideways.
	if (l < 1e-3) return [b[1], b[2], b[0]];
	return [v[0] / l, v[1] / l, v[2] / l];
};
