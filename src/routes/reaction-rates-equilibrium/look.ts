/** Shared drawing and formatting helpers for the reaction-rates scenes. */

/** Atom colours (fixed, readable on both stage backgrounds). */
export const ATOM = {
	h: '#f1f3f5',
	hEdge: '#868e96',
	i: '#7048e8',
	iEdge: '#4c2fb0'
} as const;
/** Atom radii and bond lengths in drawing units. */
export const R_H = 5;
export const R_I = 9;
export const BOND = { h2: 7, i2: 14, hi: 11 } as const;

/** SVG path of a circle, for drawing many atoms in one <path>. */
export const circ = (x: number, y: number, r: number) =>
	`M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

/**
 * The two atoms of a diatomic molecule centred at (x, y), turned by `deg`:
 * [[x, y, radius, isIodine], …].
 */
export function atoms(
	kind: 'h2' | 'i2' | 'hi',
	x: number,
	y: number,
	deg: number,
	scale = 1
): [number, number, number, boolean][] {
	const a = (deg * Math.PI) / 180;
	const c = Math.cos(a);
	const s = Math.sin(a);
	if (kind === 'h2') {
		const d = (BOND.h2 / 2) * scale;
		return [
			[x - c * d, y - s * d, R_H * scale, false],
			[x + c * d, y + s * d, R_H * scale, false]
		];
	}
	if (kind === 'i2') {
		const d = (BOND.i2 / 2) * scale;
		return [
			[x - c * d, y - s * d, R_I * scale, true],
			[x + c * d, y + s * d, R_I * scale, true]
		];
	}
	// HI: the centre of the drawing sits near the heavy iodine.
	const dI = 3 * scale;
	const dH = (BOND.hi - 3) * scale;
	return [
		[x - c * dI, y - s * dI, R_I * scale, true],
		[x + c * dH, y + s * dH, R_H * scale, false]
	];
}

/** "1 h 05 min", "35 min", "42 s", "2.4 ms": a time in the flask. */
export function fmtTime(s: number): string {
	if (!(s > 0)) return '0 s';
	if (s < 1e-3) return `${(s * 1e6).toPrecision(2)} µs`;
	if (s < 1) return `${Number((s * 1000).toPrecision(2))} ms`;
	if (s < 60) return `${Number(s.toPrecision(2))} s`;
	if (s < 3600) return `${Math.round(s / 60)} min`;
	const h = Math.floor(s / 3600);
	const m = Math.round((s - h * 3600) / 60);
	if (h >= 24) return `${Number((s / 86400).toPrecision(2))} days`;
	return m === 60 ? `${h + 1} h 00 min` : `${h} h ${String(m).padStart(2, '0')} min`;
}

/** "10 min", "1 ms": the span of flask time one second of animation shows. */
export const fmtLapse = (s: number) => fmtTime(s);

const SUP: Record<string, string> = {
	'-': '⁻',
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹'
};
export const superscript = (n: number) =>
	String(Math.round(n))
		.split('')
		.map((c) => SUP[c] ?? c)
		.join('');

/** "6 × 10¹²" (one significant figure for big counts). */
export function fmtPow(v: number, digits = 1): string {
	if (!(v > 0)) return '0';
	const e = Math.floor(Math.log10(v));
	let m = Number((v / 10 ** e).toPrecision(digits));
	let ee = e;
	if (m >= 10) {
		m /= 10;
		ee++;
	}
	if (ee <= 3 && ee >= 0) return Number(v.toPrecision(digits + 1)).toLocaleString('en-US');
	return `${m} × 10${superscript(ee)}`;
}

/** Two significant figures, plain: 0.063, 52, 1.5. */
export const sig = (v: number, n = 2) => Number(v.toPrecision(n)).toString();

/** Nice time-lapse values (flask seconds per second of animation). */
const NICE = [
	1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60, 120,
	300, 600, 1200, 1800, 3600, 7200, 18000, 36000
];
/** The nice lapse closest (in ratio) to `v`. */
export function niceLapse(v: number): number {
	let best = NICE[0];
	for (const n of NICE) if (Math.abs(Math.log(n / v)) < Math.abs(Math.log(best / v))) best = n;
	return best;
}
