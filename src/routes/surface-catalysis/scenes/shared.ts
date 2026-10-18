/** Helpers the surface-catalysis scenes share: reading the step's controls and formats. */
import type { Params, Step } from '#lib/explainer/index.ts';

/** A number set either by the control the hint `<key>Param` names or by the hint `<key>`. */
export function numberFrom(step: Step, params: Params, key: string, fallback: number) {
	const h = step.hints ?? {};
	const p = h[`${key}Param`];
	const v = p !== undefined ? params[String(p)] : h[key];
	const n = Number(v);
	return Number.isFinite(n) ? n : fallback;
}

/** A rate or coverage with a fixed number of decimals. */
export const fmt = (v: number, digits = 3) => v.toFixed(digits);

/** k as the page writes it: 0, 0.02, 0.05 … */
export const fmtK = (k: number) => (k === 0 ? '0' : String(k));
