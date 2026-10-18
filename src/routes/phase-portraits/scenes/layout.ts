/**
 * Layout, colours and wording shared by the phase-portrait scenes: where the
 * phase plane and the panel sit, the seeded starts of each system, the colour
 * of each kind of fixed point, and how numbers, eigenvalues and matrices are
 * written.
 */
import { scale } from '#lib/draw/index.ts';
import type { Box, Eigen, Kind, Mat, SystemId, Vec } from '../phase';

export interface Rect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** The phase plane (square). */
export const PLANE: Rect = { left: 78, right: 538, top: 40, bottom: 500 };
/** Left edge of the text panel. */
export const PANEL = 586;

/** A real minus sign, and never "−0.00". */
export function fixed(v: number, d = 2): string {
	const s = Math.abs(v).toFixed(d);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** A matrix as [[a, b], [c, d]]. */
export const matText = (m: Mat, d = 2) =>
	`[[${fixed(m[0], d)}, ${fixed(m[1], d)}], [${fixed(m[2], d)}, ${fixed(m[3], d)}]]`;

/** The eigenvalues: "1.00, −1.50" or "−0.25 ± 0.97i". */
export function eigenText(e: Eigen, d = 2): string {
	if (e.im[0] !== 0) {
		const re = Math.abs(e.re[0]) < 5e-13 ? '' : `${fixed(e.re[0], d)} `;
		return `${re}${re ? '± ' : '±'}${Math.abs(e.im[0]).toFixed(d)}i`;
	}
	return `${fixed(e.re[0], d)}, ${fixed(e.re[1], d)}`;
}

/** Colour of a fixed point by its kind. */
export function kindColor(k: Kind): string {
	if (k === 'saddle') return 'var(--pp-saddle)';
	if (k === 'centre' || k === 'non-isolated') return 'var(--pp-centre)';
	return k.startsWith('stable') ? 'var(--pp-stable)' : 'var(--pp-unstable)';
}

/** Seeded starts for the linear portraits: two rings around the origin of a ±3 window. */
export const LINEAR_STARTS: Vec[] = [
	...Array.from({ length: 12 }, (_, i): Vec => {
		const a = (i * Math.PI) / 6 + 0.13;
		return [2.7 * Math.cos(a), 2.7 * Math.sin(a)];
	}),
	...Array.from({ length: 6 }, (_, i): Vec => {
		const a = (i * Math.PI) / 3 + 0.4;
		return [1.1 * Math.cos(a), 1.1 * Math.sin(a)];
	})
];

export interface SystemText {
	title: string;
	lines: string[];
	xLabel: string;
	yLabel: string;
}

export const TEXT: Record<SystemId, SystemText> = {
	pendulum: {
		title: 'A pendulum with friction',
		lines: ['θ′ = ω', 'ω′ = −sin θ − γω'],
		xLabel: 'angle θ',
		yLabel: 'ω'
	},
	predator: {
		title: 'Predators and prey',
		lines: ['x′ = x(1 − 0.5y)', 'y′ = y(0.25x − 0.75)'],
		xLabel: 'prey x',
		yLabel: 'predators y'
	},
	vanderpol: {
		title: 'Van der Pol’s oscillator',
		lines: ['x′ = y', 'y′ = μ(1 − x²)y − x'],
		xLabel: 'x',
		yLabel: 'y'
	},
	hopf: {
		title: 'The Hopf normal form',
		lines: ['r′ = μr − r³, φ′ = −1', ''],
		xLabel: 'x',
		yLabel: 'y'
	},
	subcritical: {
		title: 'r′ = +r³',
		lines: ['r′ = μr + r³, φ′ = −1', ''],
		xLabel: 'x',
		yLabel: 'y'
	}
};

/**
 * Starts seeded for each nonlinear system (traced forwards and backwards
 * unless the system's orbits settle on a cycle, where only forwards).
 */
export const SYSTEM_STARTS: Record<SystemId, Vec[]> = {
	pendulum: [
		...[-6.5, -4, -1.5, 1, 3.5, 6].map((x): Vec => [x, 3.2]),
		...[-6, -3.5, -1, 1.5, 4, 6.5].map((x): Vec => [x, -3.2]),
		[0.6, 0],
		[-2 * Math.PI + 1.4, 0],
		[2 * Math.PI - 1.2, 0]
	],
	predator: [2.3, 2.6, 3.2, 4, 5].map((y): Vec => [3, y]),
	vanderpol: [
		[0.1, 0],
		[-0.6, 0.3],
		[3.3, 4.6],
		[-3.3, -4.6],
		[-3.3, 2],
		[3.3, -2],
		[0, 4.8],
		[0, -4.8]
	],
	hopf: [
		[0.05, 0],
		[-0.15, 0.05],
		[1.45, 0],
		[-1.45, 0],
		[0, 1.45],
		[0, -1.45],
		[1.4, 1.4],
		[-1.4, -1.4]
	],
	subcritical: [
		[0.3, 0],
		[-0.5, 0],
		[0, 0.7],
		[0.9, 0]
	]
};

/** The fixed points the "Linearise at" selects name. */
export const AT: Record<string, Vec> = {
	bottom: [0, 0],
	top: [Math.PI, 0],
	origin: [0, 0],
	coexist: [3, 2]
};

/** Data → stage scales of a window drawn in a rectangle. */
export function scales(rect: Rect, box: Box) {
	return {
		sx: scale(box.x, [rect.left, rect.right]),
		sy: scale(box.y, [rect.bottom, rect.top])
	};
}
