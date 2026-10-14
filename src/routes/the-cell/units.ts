/**
 * Lengths for "The cell": formatting in the unit a biologist would use, and the
 * scale bar (a round length that fits the view).
 */

export const MM = 1e-3;
export const UM = 1e-6;
export const NM = 1e-9;

const UNITS = [
	{ f: 1e-3, u: 'mm' },
	{ f: 1e-6, u: 'µm' },
	{ f: 1e-9, u: 'nm' }
] as const;

/** Rounds to `sig` significant figures, dropping trailing zeros. */
function round(v: number, sig: number) {
	if (v === 0) return '0';
	return String(Number(v.toPrecision(sig)));
}

/**
 * A length in metres as text: "25 µm", "4 nm", "0.3 nm", "1.5 mm". Picks the
 * largest unit in which the number is at least 1 (nm below that).
 */
export function formatLength(m: number, sig = 2): string {
	const a = Math.abs(m);
	const unit = UNITS.find((x) => a >= x.f * 0.9995) ?? UNITS[2];
	return `${round(m / unit.f, sig).replace('-', '−')} ${unit.u}`;
}

/** Nice lengths for a scale bar: 1, 2, 5 × 10ⁿ. */
const NICE = [1, 2, 5];

export interface ScaleBar {
	/** Length the bar stands for, metres. */
	length: number;
	/** Its length on the stage, stage units (960 across the view). */
	px: number;
	label: string;
}

/**
 * The scale bar for a view `field` metres wide drawn `stage` units wide: the
 * round length (1, 2 or 5 × 10ⁿ) whose bar is closest to `target` units long.
 */
export function scaleBar(field: number, stage = 960, target = 120): ScaleBar {
	const perUnit = field / stage;
	const want = target * perUnit;
	const e = Math.floor(Math.log10(want));
	let best = { length: 0, err: Infinity };
	for (const k of [e - 1, e, e + 1])
		for (const n of NICE) {
			const length = n * 10 ** k;
			const err = Math.abs(Math.log(length / want));
			if (err < best.err) best = { length, err };
		}
	// Snap away floating-point noise (2e-9 must not print as 2.0000000000000003 nm).
	const length = Number(best.length.toPrecision(3));
	return { length, px: length / perUnit, label: formatLength(length, 1) };
}
