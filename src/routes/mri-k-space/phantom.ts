/**
 * The head this page scans: the Shepp–Logan phantom with MRI tissue properties.
 *
 * Geometry: the classic 2-D Shepp–Logan head (Shepp and Logan, IEEE Trans. Nucl. Sci. 21, 1974),
 * imported from the medical-imaging page so both pages show the same head the same way up (the
 * three small dots at the bottom), plus the two extra layers of the MRI version of Gach, Tanase
 * and Boada ("2D & 3D Shepp–Logan phantom standards for MRI", 19th International Conference on
 * Systems Engineering, IEEE, 2008, doi:10.1109/ICSEng.2008.15): a scalp round the skull and a thin
 * layer of fluid (CSF) between the skull and the grey matter. This page uses the 2-D geometry, not
 * Gach's slice of the 3-D ellipsoids (whose outer ellipses are a few per cent smaller there).
 *
 * Tissues: each region gets Gach's proton density M₀, T2, and T1 from their field-dependent model
 * T1 = A·B₀^C (T1 in seconds, B₀ in tesla; CSF has a fixed T1), evaluated at 1.5 T as on the
 * medical-imaging page. The numbers were read from the transcription of Gach's table in the
 * phantominator package (github.com/mckib2/phantominator, mr_shepp_logan.py); no code was copied.
 *
 * Scale: one Shepp–Logan unit is 10 cm, so the head is 19 cm from front to back and 14.4 cm wide.
 * Every region is an ellipse that replaces its parent's tissue, written as an ellipse that adds
 * (its tissue's signal − its parent's signal): so any image of the head, and its Fourier
 * transform, is a sum over ellipses.
 */
import { SHEPP_LOGAN } from '../medical-imaging/imaging';

export type Tissue = 'scalp' | 'marrow' | 'csf' | 'grey' | 'white' | 'lesion';

interface TissueData {
	name: string;
	/** Relative proton density. */
	m0: number;
	/** T1 = a·B₀^c seconds, or a fixed T1 (s) when `t1` is set. */
	a?: number;
	c?: number;
	t1?: number;
	/** T2, seconds. */
	t2: number;
}

/** Gach, Tanase and Boada (2008), as transcribed in phantominator. */
export const TISSUES: Record<Tissue, TissueData> = {
	scalp: { name: 'scalp', m0: 0.8, a: 0.324, c: 0.137, t2: 0.07 },
	marrow: { name: 'skull (marrow)', m0: 0.12, a: 0.533, c: 0.088, t2: 0.05 },
	csf: { name: 'fluid (CSF)', m0: 0.98, t1: 4.2, t2: 1.99 },
	grey: { name: 'grey matter', m0: 0.745, a: 0.857, c: 0.376, t2: 0.1 },
	white: { name: 'white matter', m0: 0.617, a: 0.583, c: 0.382, t2: 0.08 },
	lesion: { name: 'small lesions', m0: 0.95, a: 0.926, c: 0.217, t2: 0.1 }
};

/** Field strength of the scanner on this page, tesla. */
export const B0 = 1.5;

/** T1 of a tissue at field B (T), milliseconds. */
export function t1Ms(t: Tissue, B = B0): number {
	const d = TISSUES[t];
	return 1000 * (d.t1 ?? (d.a as number) * Math.pow(B, d.c as number));
}

/** T2 of a tissue, milliseconds. */
export const t2Ms = (t: Tissue) => 1000 * TISSUES[t].t2;

/**
 * Signal of a tissue in a spin-echo scan repeated every TR ms with its echo at TE ms (TE ≪ TR):
 * M₀ (1 − e^(−TR/T1)) e^(−TE/T2).
 */
export function spinEchoSignal(t: Tissue, TR: number, TE: number): number {
	return TISSUES[t].m0 * (1 - Math.exp(-TR / t1Ms(t))) * Math.exp(-TE / t2Ms(t));
}

/** The two weightings the page uses. */
export const WEIGHTINGS = {
	t1: { name: 'T1-weighted', tr: 500, te: 15 },
	t2: { name: 'T2-weighted', tr: 4000, te: 100 }
} as const;
export type Weighting = keyof typeof WEIGHTINGS;

/** An ellipse in centimetres (y down the picture) that adds `value`. */
export interface Ellipse {
	x0: number;
	y0: number;
	/** Semi-axis along the direction at angle phi from +x towards +y. */
	a: number;
	b: number;
	phi: number;
	value: number;
}

export interface Region {
	tissue: Tissue;
	parent: Tissue | null;
	x0: number;
	y0: number;
	a: number;
	b: number;
	phi: number;
}

const CM = 10; // cm per Shepp–Logan unit
const sl = SHEPP_LOGAN.ellipses;
const at = (i: number, tissue: Tissue, parent: Tissue): Region => ({
	tissue,
	parent,
	x0: sl[i].x0 * CM,
	y0: sl[i].y0 * CM,
	a: sl[i].a * CM,
	b: sl[i].b * CM,
	phi: sl[i].phi
});

/** The head's regions, outermost first; each replaces its parent's tissue. */
export const REGIONS: Region[] = [
	// Gach's scalp, 0.03 units outside the skull all round
	{ tissue: 'scalp', parent: null, x0: 0, y0: 0, a: 0.72 * CM, b: 0.95 * CM, phi: 0 },
	at(0, 'marrow', 'scalp'), // Shepp–Logan's skull
	at(1, 'csf', 'marrow'), // Shepp–Logan's brain: Gach's fluid layer…
	// …with grey matter 0.01 units inside it
	{
		tissue: 'grey',
		parent: 'csf',
		x0: 0,
		y0: sl[1].y0 * CM,
		a: 0.6524 * CM,
		b: 0.864 * CM,
		phi: 0
	},
	at(2, 'csf', 'grey'), // the two ventricles
	at(3, 'csf', 'grey'),
	at(4, 'white', 'grey'), // the large ellipse near the top
	at(5, 'lesion', 'grey'),
	at(6, 'lesion', 'grey'),
	at(7, 'lesion', 'grey'),
	at(8, 'lesion', 'grey'),
	at(9, 'lesion', 'grey')
];

/** The head as a sum of ellipses whose values are each tissue's signal, `signal(tissue)`. */
export function headEllipses(signal: (t: Tissue) => number): Ellipse[] {
	return REGIONS.map((r) => ({
		x0: r.x0,
		y0: r.y0,
		a: r.a,
		b: r.b,
		phi: r.phi,
		value: signal(r.tissue) - (r.parent ? signal(r.parent) : 0)
	}));
}

/** The head as it looks in a spin-echo scan of the given weighting. */
export function head(w: Weighting): Ellipse[] {
	const { tr, te } = WEIGHTINGS[w];
	return headEllipses((t) => spinEchoSignal(t, tr, te));
}

/** Value of a sum of ellipses at a point (cm). */
export function valueAt(es: readonly Ellipse[], x: number, y: number): number {
	let v = 0;
	for (const e of es) {
		const dx = x - e.x0;
		const dy = y - e.y0;
		const c = Math.cos(e.phi);
		const s = Math.sin(e.phi);
		const u = (dx * c + dy * s) / e.a;
		const w = (-dx * s + dy * c) / e.b;
		if (u * u + w * w <= 1) v += e.value;
	}
	return v;
}

/** Points inside each named region, away from its edges (for tests and readouts), cm. */
export const LANDMARKS = {
	ventricle: { x: 2.2, y: 0 },
	whiteMatter: { x: 0, y: -4 },
	greyMatter: { x: -4, y: 4 },
	scalp: { x: 0, y: -9.35 }
} as const;
