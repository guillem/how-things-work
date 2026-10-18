import type { ParamValue, Step } from '#lib/explainer/index.ts';
import type { Kind } from '../pcr';

/** Colours of the three kinds of strand. */
export const KIND_COLOR: Record<Kind, string> = {
	original: 'var(--pcr-template)',
	long: 'var(--pcr-long)',
	target: 'var(--pcr-target)'
};

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

const WORDS: [number, string][] = [
	[1e12, 'million million'],
	[1e9, 'billion'],
	[1e6, 'million']
];

/** A count in words for big numbers: "1,024", "1.07 million", "6.0 million million". */
export function count(n: number): string {
	if (n < 1e6) return Math.round(n).toLocaleString('en-US');
	for (const [v, w] of WORDS) if (n >= v) return `${(n / v).toFixed(n / v < 10 ? 2 : 1)} ${w}`;
	return Math.round(n).toLocaleString('en-US');
}

/** Labels of the powers of ten on a log axis, in words up to a million million. */
export function powerLabel(p: number): string {
	const names: Record<number, string> = {
		0: '1',
		3: '1,000',
		6: '1 million',
		9: '1 billion',
		12: '10¹²'
	};
	return names[p] ?? '';
}

/** The test tube's outline: a straight body and a rounded cone, open at the top. */
export function tubePath(x: number, y: number, w: number, h: number): string {
	const cone = h * 0.32;
	const body = h - cone;
	const tip = w * 0.16;
	return [
		`M${x} ${y}`,
		`L${x} ${y + body}`,
		`C${x} ${y + body + cone * 0.6} ${x + w / 2 - tip} ${y + h} ${x + w / 2} ${y + h}`,
		`C${x + w / 2 + tip} ${y + h} ${x + w} ${y + body + cone * 0.6} ${x + w} ${y + body}`,
		`L${x + w} ${y}`
	].join(' ');
}
