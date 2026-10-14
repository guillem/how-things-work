/** What the DNA-to-protein scenes share: colours of bases and amino acids, letter display. */
import { amino, type AminoKind } from '../genetics';

/** Theme colour of a base letter (U shares T's colour). */
export function baseColor(b: string): string {
	switch (b) {
		case 'A':
			return 'var(--dp-a)';
		case 'C':
			return 'var(--dp-c)';
		case 'G':
			return 'var(--dp-g)';
		default:
			return 'var(--dp-t)';
	}
}

export const KIND_COLOR: Record<AminoKind, string> = {
	nonpolar: 'var(--dp-nonpolar)',
	polar: 'var(--dp-polar)',
	positive: 'var(--dp-positive)',
	negative: 'var(--dp-negative)',
	stop: 'var(--dp-stop)'
};

export const KIND_LABEL: Record<AminoKind, string> = {
	nonpolar: 'water-repelling',
	polar: 'water-loving',
	positive: 'charged +',
	negative: 'charged −',
	stop: 'stop'
};

export const aminoColor = (one: string) => KIND_COLOR[amino(one).kind];

/** A DNA letter as RNA (T → U). */
export const rna = (s: string) => s.replaceAll('T', 'U');

/** Whole numbers with thousands separators. */
export const int = (v: number) => Math.round(v).toLocaleString('en-US');
