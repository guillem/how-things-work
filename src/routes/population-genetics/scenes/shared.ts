import type { ParamValue, Step } from '#lib/explainer/index.ts';

/** A hint that names a control (read its value) or holds a value itself. */
export function hinted(
	step: Step,
	params: Record<string, ParamValue>,
	key: string,
	fallback: ParamValue
): ParamValue {
	const h = step.hints?.[key];
	if (typeof h === 'string' && h in params) return params[h];
	return h ?? fallback;
}

/** A share as a percentage: "30%", "2.4%", "0.05%". */
export function percent(v: number): string {
	const x = v * 100;
	if (x === 0) return '0%';
	if (x >= 99.5 && x < 100) return 'over 99%';
	if (x >= 10) return `${Math.round(x)}%`;
	if (x >= 1) return `${x.toFixed(1)}%`;
	if (x < 0.001) return 'under 0.001%';
	return `${Number(x.toPrecision(2))}%`;
}

/** Colours of the three genotypes (and of the alleles: A as AA, a as aa). */
export const GENO = {
	AA: 'var(--popgen-AA)',
	Aa: 'var(--popgen-Aa)',
	aa: 'var(--popgen-aa)'
} as const;
