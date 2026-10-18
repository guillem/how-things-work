import { niceMax, type Scale } from '#lib/draw/index.ts';
import type { Drug } from '../drugs';
import type { Series } from '../model';

/** Where things sit on the 960 × 600 stage (shared by both scenes). */
export const L = {
	PX0: 340,
	PX1: 928,
	PY1: 160,
	PY0: 470,
	/** Row of dose icons above the chart. */
	STRIP: 124,
	/** Row of half-life marks between the strip and the chart. */
	HALF: 148,
	/** The tank: the body as one well-mixed volume. */
	TX: 96,
	TW: 132
} as const;

export const C = {
	curve: 'var(--pk-curve)',
	ghost: 'var(--pk-ghost)',
	band: 'var(--pk-band)',
	bandText: 'var(--pk-band-text)',
	toxic: 'var(--pk-toxic)',
	water: 'var(--pk-water)',
	tablet: 'var(--pk-tablet)',
	inject: 'var(--pk-inject)',
	drip: 'var(--pk-drip)',
	half: 'var(--pk-half)'
} as const;

export interface TimeAxis {
	ticks: number[];
	format: (h: number) => string;
	label: string;
}

/** Ticks of the time axis: hours for up to three days, then days. */
export function timeAxis(span: number): TimeAxis {
	if (span <= 96) {
		const every = span <= 24 ? 4 : 12;
		const ticks: number[] = [];
		for (let h = 0; h <= span + 1e-9; h += every) ticks.push(h);
		return { ticks, format: (h) => `${h}`, label: 'hours' };
	}
	const days = span / 24;
	const every = days <= 8 ? 1 : days <= 14 ? 2 : 7;
	const ticks: number[] = [];
	for (let d = 0; d <= days + 1e-9; d += every) ticks.push(d * 24);
	return { ticks, format: (h) => `${Math.round(h / 24)}`, label: 'days' };
}

/** A duration in hours, in hours or days as fits: "8.0 hours", "1.8 days". */
export function duration(h: number): string {
	if (!Number.isFinite(h)) return '—';
	const short = (v: number) => (Math.round(v * 10) / 10 < 10 ? v.toFixed(1) : `${Math.round(v)}`);
	if (h < 48) return `${short(h)} hours`;
	return `${short(h / 24)} days`;
}

/** A level with sensible digits and the label's unit: "12 mcg/mL", "0.90 ng/mL". */
export function level(c: number, d: Drug, unit = true): string {
	const u = unit ? ` ${d.concUnit}` : '';
	if (!Number.isFinite(c)) return `no steady state`;
	if (c >= 100) return `${Math.round(c).toLocaleString('en-US')}${u}`;
	if (c >= 10) return `${c.toFixed(0)}${u}`;
	if (c >= 1) return `${c.toFixed(1)}${u}`;
	return `${c.toFixed(2)}${u}`;
}

/** Upper end of the level axis: room for the curves and the target range. */
export function levelMax(d: Drug, highest: number): number {
	const floor = Math.max(d.window?.[1] ?? 0, d.toxic ?? 0) * 1.25;
	return niceMax(Math.max(floor, highest * 1.08, 1e-6));
}

/** Path of a series up to time `upTo`. */
export function pathOf(s: Series, sx: Scale, sy: Scale, upTo = Infinity): string {
	let d = '';
	const n = s.t.length;
	const stride = Math.max(1, Math.floor(n / 600));
	for (let i = 0; i < n; i += stride) {
		if (s.t[i] > upTo) break;
		d += `${d ? 'L' : 'M'}${sx(s.t[i]).toFixed(1)} ${sy(s.c[i]).toFixed(1)}`;
	}
	return d;
}

/** The highest level of a series. */
export function highest(s: Series): number {
	let m = 0;
	for (let i = 0; i < s.c.length; i++) m = Math.max(m, s.c[i]);
	return m;
}
