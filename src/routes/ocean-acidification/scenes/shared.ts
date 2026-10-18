/** What the scenes share: the controls read as numbers, the water they describe, colours, formats. */
import type { Params } from '#lib/explainer/index.ts';
import { SEAWATER, type Water } from '../model';

export const PPM_MIN = 280;
export const PPM_MAX = 1200;
export const T_MIN = -1.8;
export const T_MAX = 30;

const num = (v: unknown, fallback: number) => {
	const x = Number(v);
	return Number.isFinite(x) ? x : fallback;
};
export const ppmOf = (p: Params) => Math.min(PPM_MAX, Math.max(PPM_MIN, num(p.co2, 423)));
export const tempOf = (p: Params) => Math.min(T_MAX, Math.max(T_MIN, num(p.temp, 18)));
export const waterAt = (T: number): Water => ({ ...SEAWATER, T });

/** Theme colours (app.css, `--oa-*`). */
export const C = {
	air: 'var(--oa-air)',
	water: 'var(--oa-water)',
	waterEdge: 'var(--oa-water-edge)',
	co2: 'var(--oa-co2)',
	co2Text: 'var(--oa-co2-text)',
	hco3: 'var(--oa-hco3)',
	hco3Text: 'var(--oa-hco3-text)',
	co3: 'var(--oa-co3)',
	co3Text: 'var(--oa-co3-text)',
	h: 'var(--oa-h)',
	hText: 'var(--oa-h-text)',
	ph: 'var(--oa-ph)',
	phText: 'var(--oa-ph-text)',
	acid: 'var(--oa-acid)',
	acidText: 'var(--oa-acid-text)',
	under: 'var(--oa-under)',
	calcite: 'var(--oa-calcite)',
	calciteText: 'var(--oa-calcite-text)',
	cold: 'var(--oa-cold)',
	warm: 'var(--oa-warm)',
	mark: 'var(--oa-mark)',
	markText: 'var(--oa-mark-text)'
};

/** Colour of water at temperature T: blue when cold, red when warm. */
export function tempColor(T: number): string {
	const u = Math.round((100 * (T - T_MIN)) / (T_MAX - T_MIN));
	return `color-mix(in oklch, ${C.warm} ${u}%, ${C.cold})`;
}

export const fmtPpm = (v: number) => `${Math.round(v).toLocaleString('en-US')} ppm`;
export const fmtT = (T: number) => `${T.toFixed(1).replace('-', '−')} °C`;
export const fmtUmol = (v: number) =>
	v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
/** A signed percentage change, "+51%" or "−24%". */
export function change(now: number, then: number): string {
	const p = Math.round(100 * (now / then - 1));
	return p === 0 ? '±0%' : p > 0 ? `+${p}%` : `−${-p}%`;
}
/** Shares as "91%", "8.2%", "0.7%". */
export const pct = (f: number) => {
	const p = 100 * f;
	return p >= 20 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
};
