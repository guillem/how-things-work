/**
 * Layout, wording and starting points for the slope-field scene: where the
 * plot, the strip of arrows and the chart of f sit, what each rule is called
 * and measured in, the starts drawn before the reader drops any, and how
 * numbers are written.
 */
import type { RuleId, RuleParams } from '../ode';

/** The plot of time against the quantity. */
export const PLOT = { left: 84, right: 590, top: 40, bottom: 540 };
/** The strip of up/down arrows beside it, on the same vertical scale. */
export const STRIP = { left: 604, right: 632 };
/** The text panel and, under it, the chart of f against the quantity. */
export const PANEL = 664;
export const CHART = { left: 724, right: 930, top: 300, bottom: 520 };

export interface RuleText {
	title: string;
	/** Axis titles (short, for phones). */
	tLabel: string;
	yLabel: string;
	/** The quantity's symbol and unit in readouts. */
	sym: string;
	unit: string;
	tUnit: string;
	formula: (p: RuleParams) => string;
}

export const TEXT: Record<RuleId, RuleText> = {
	growth: {
		title: 'A growing colony',
		tLabel: 'hours',
		yLabel: 'thousand cells',
		sym: 'y',
		unit: 'thousand',
		tUnit: 'h',
		formula: (p) => `dy/dt = ${fixed(p.r)} · y`
	},
	cooling: {
		title: 'Coffee cooling',
		tLabel: 'minutes',
		yLabel: '°C',
		sym: 'T',
		unit: '°C',
		tUnit: 'min',
		formula: (p) => `dT/dt = −0.05 · (T − ${fixed(p.room, 0)})`
	},
	logistic: {
		title: 'Growth with a ceiling',
		tLabel: 'years',
		yLabel: '% of K',
		sym: 'N',
		unit: '% of K',
		tUnit: 'yr',
		formula: () => 'dN/dt = 0.5 · N · (1 − N/100)'
	},
	harvest: {
		title: 'A fish stock with a steady catch',
		tLabel: 'years',
		yLabel: '% of K',
		sym: 'N',
		unit: '% of K',
		tUnit: 'yr',
		formula: (p) => `dN/dt = 0.5 · N · (1 − N/100) − ${fixed(p.H, 1)}`
	},
	riccati: {
		title: 'A rule with no formula',
		tLabel: 't',
		yLabel: 'y',
		sym: 'y',
		unit: '',
		tUnit: '',
		formula: () => 'dy/dt = t − y²'
	}
};

/** The vertical range of the chart of f (fixed, so lowering the parabola shows). */
export const F_RANGE: Record<RuleId, [number, number]> = {
	growth: [-50, 80],
	cooling: [-5, 5],
	logistic: [-30, 15],
	harvest: [-30, 15],
	riccati: [-1, 1]
};

/** Starting points drawn before the reader drops any: (t₀, y₀). */
export const PRESETS: Record<RuleId, [number, number][]> = {
	growth: [
		[0, 5],
		[0, 15],
		[5, 40]
	],
	cooling: [
		[0, 90],
		[0, 60],
		[0, 5]
	],
	logistic: [
		[0, 10],
		[0, 40],
		[0, 140]
	],
	harvest: [
		[0, 30],
		[0, 60],
		[0, 120],
		[0, 15]
	],
	riccati: [
		[0, -1],
		[0, 0],
		[0, 1.2],
		[0, 2.8],
		[2.5, -0.5]
	]
};

/** The fish stock past rK/4; the newest (last) start is the one the narrative follows. */
export const COLLAPSE: [number, number][] = [
	[0, 20],
	[0, 50],
	[0, 120],
	[0, 80]
];

/** Many starts, for the step about crossings. */
export const DENSE: Record<RuleId, [number, number][]> = {
	growth: [0.5, 2, 5, 10, 18, 30, 45, 65].map((y) => [0, y]),
	cooling: [0, 8, 15, 20, 28, 45, 65, 85, 100].map((y) => [0, y]),
	logistic: [
		...[1, 5, 15, 40, 70, 100, 125, 150].map((y): [number, number] => [0, y]),
		[8, 2],
		[12, 1]
	],
	harvest: [
		...[10, 18, 22, 35, 60, 100, 150].map((y): [number, number] => [0, y]),
		[10, 50],
		[20, 30]
	],
	riccati: [
		...[-2.5, -1.5, -0.8, -0.3, 0.3, 1, 2, 3].map((y): [number, number] => [0, y]),
		[2, -1],
		[3.5, -1.5]
	]
};

/** A real minus sign, and never "−0.00". */
export function fixed(v: number, decimals = 2): string {
	const s = Math.abs(v).toFixed(decimals);
	return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

const SUP: Record<string, string> = {
	'0': '⁰',
	'1': '¹',
	'2': '²',
	'3': '³',
	'4': '⁴',
	'5': '⁵',
	'6': '⁶',
	'7': '⁷',
	'8': '⁸',
	'9': '⁹',
	'-': '⁻'
};
const sup = (v: number) => [...String(v)].map((c) => SUP[c] ?? c).join('');

/** A small positive number readably: 0.0042, 3.1 × 10⁻¹². */
export function small(v: number): string {
	if (!Number.isFinite(v)) return '—';
	if (v === 0) return '0';
	if (v >= 1e-3) return v.toPrecision(2);
	const e = Math.floor(Math.log10(v));
	return `${(v / 10 ** e).toFixed(1)} × 10${sup(e)}`;
}
