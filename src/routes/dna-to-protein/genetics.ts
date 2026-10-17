/**
 * The model behind "DNA to protein": base pairing, transcription, the standard genetic code
 * (NCBI translation table 1) and translation from the first AUG, and what a one-letter edit
 * (a substitution, an insertion or a deletion) does to the protein.
 *
 * Sequences are strings of DNA letters (A, C, G, T) on the coding (sense) strand, 5′→3′; the
 * mRNA is the same string with U for T. Positions are 0-based indices into that string.
 */

/**
 * NCBI translation table 1, "The Standard Code", verbatim from
 * https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi (rows AAs and Base1–Base3).
 * Column i is the codon Base1[i] Base2[i] Base3[i]; '*' is a stop codon.
 */
const NCBI_TABLE_1 = {
	AAs: 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
	Base1: 'TTTTTTTTTTTTTTTTCCCCCCCCCCCCCCCCAAAAAAAAAAAAAAAAGGGGGGGGGGGGGGGG',
	Base2: 'TTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGGTTTTCCCCAAAAGGGG',
	Base3: 'TCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAGTCAG'
} as const;

export type Base = 'A' | 'C' | 'G' | 'T';
const BASES: readonly Base[] = ['A', 'C', 'G', 'T'];
/** Order of the rows and columns of the printed code table (U, C, A, G). */
export const TABLE_ORDER: readonly Base[] = ['T', 'C', 'A', 'G'];

/** Codon (DNA letters) → one-letter amino acid, or '*' for stop. */
export const CODE: ReadonlyMap<string, string> = new Map(
	[...NCBI_TABLE_1.AAs].map((aa, i) => [
		NCBI_TABLE_1.Base1[i] + NCBI_TABLE_1.Base2[i] + NCBI_TABLE_1.Base3[i],
		aa
	])
);

export const STOP = '*';
const START_CODON = 'ATG';

/**
 * Chemical character of a side chain, the way introductory texts group them: water-repelling
 * (non-polar), polar but uncharged, positively charged (basic) and negatively charged (acidic).
 * Tyrosine is put with the polar ones and glycine with the non-polar ones, as is usual.
 */
export type AminoKind = 'nonpolar' | 'polar' | 'positive' | 'negative' | 'stop';

interface AminoAcid {
	one: string;
	three: string;
	name: string;
	kind: AminoKind;
}

const AA: [string, string, string, AminoKind][] = [
	['A', 'Ala', 'alanine', 'nonpolar'],
	['R', 'Arg', 'arginine', 'positive'],
	['N', 'Asn', 'asparagine', 'polar'],
	['D', 'Asp', 'aspartic acid', 'negative'],
	['C', 'Cys', 'cysteine', 'polar'],
	['Q', 'Gln', 'glutamine', 'polar'],
	['E', 'Glu', 'glutamic acid', 'negative'],
	['G', 'Gly', 'glycine', 'nonpolar'],
	['H', 'His', 'histidine', 'positive'],
	['I', 'Ile', 'isoleucine', 'nonpolar'],
	['L', 'Leu', 'leucine', 'nonpolar'],
	['K', 'Lys', 'lysine', 'positive'],
	['M', 'Met', 'methionine', 'nonpolar'],
	['F', 'Phe', 'phenylalanine', 'nonpolar'],
	['P', 'Pro', 'proline', 'nonpolar'],
	['S', 'Ser', 'serine', 'polar'],
	['T', 'Thr', 'threonine', 'polar'],
	['W', 'Trp', 'tryptophan', 'nonpolar'],
	['Y', 'Tyr', 'tyrosine', 'polar'],
	['V', 'Val', 'valine', 'nonpolar'],
	['*', 'Stop', 'stop', 'stop']
];

export const AMINO: ReadonlyMap<string, AminoAcid> = new Map(
	AA.map(([one, three, name, kind]) => [one, { one, three, name, kind }])
);

export function amino(one: string): AminoAcid {
	return AMINO.get(one) ?? { one, three: '???', name: 'unknown', kind: 'stop' };
}

const PAIR: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C', U: 'A' };

/** The base that pairs with `b` in DNA (A–T, C–G). */
export function complement(b: string): string {
	return PAIR[b] ?? b;
}

/**
 * The template strand, letter by letter under the coding strand. Read left to right it runs
 * 3′→5′: the RNA polymerase reads it in that direction and builds the RNA 5′→3′.
 */
export function templateOf(coding: string): string {
	return [...coding].map(complement).join('');
}

/** The RNA copy of the template strand: the coding strand with U in place of T. */
export function transcribe(coding: string): string {
	return coding.replaceAll('T', 'U');
}

/** The RNA letter that pairs with a template-strand DNA letter. */
export function rnaPartner(templateBase: string): string {
	return templateBase === 'A' ? 'U' : complement(templateBase);
}

const RNA_PAIR: Record<string, string> = { A: 'U', U: 'A', T: 'A', C: 'G', G: 'C' };

/**
 * The anticodon of a tRNA that reads `codon`, letter by letter under it (exact pairing; real
 * tRNAs may "wobble" at the third letter). Read left to right it runs 3′→5′.
 */
export function anticodonOf(codon: string): string {
	return [...codon].map((b) => RNA_PAIR[b] ?? b).join('');
}

/** The amino acid of a codon (DNA or RNA letters). */
export function codonToAmino(codon: string): string {
	return CODE.get(codon.replaceAll('U', 'T')) ?? '?';
}

/** The codons (DNA letters) that code for an amino acid, in table order. */
export function codonsFor(one: string): string[] {
	return [...CODE].filter(([, aa]) => aa === one).map(([c]) => c);
}

/**
 * Cleans what a reader typed: upper case, U read as T, everything but A, C, G, T dropped,
 * at most `max` letters.
 */
export function cleanDna(input: string, max = Infinity): string {
	return input
		.toUpperCase()
		.replaceAll('U', 'T')
		.replace(/[^ACGT]/g, '')
		.slice(0, max);
}

interface Codon {
	/** Index of its first letter in the sequence. */
	at: number;
	codon: string;
	aa: string;
}

interface Translation {
	/** Index of the A of the first ATG, or −1 if there is none. */
	start: number;
	/** The codons read, from the start codon up to and including the stop codon. */
	codons: Codon[];
	/** The ribosome met a stop codon (otherwise it ran off the end of the sequence). */
	stopped: boolean;
	/** One-letter amino acids, without the stop. */
	protein: string;
	/** Index just past the last letter read. */
	end: number;
}

/**
 * Translates the way a ribosome does in our cells (simplified): it starts at the first AUG of
 * the message and reads codon after codon until a stop codon or the end of the sequence.
 */
export function translate(seq: string): Translation {
	const start = seq.indexOf(START_CODON);
	const codons: Codon[] = [];
	let stopped = false;
	if (start >= 0) {
		for (let at = start; at + 3 <= seq.length; at += 3) {
			const codon = seq.slice(at, at + 3);
			const aa = codonToAmino(codon);
			codons.push({ at, codon, aa });
			if (aa === STOP) {
				stopped = true;
				break;
			}
		}
	}
	const protein = codons
		.filter((c) => c.aa !== STOP)
		.map((c) => c.aa)
		.join('');
	const end = start < 0 ? 0 : start + codons.length * 3;
	return { start, codons, stopped, protein, end };
}

// ---- one-letter edits ---------------------------------------------------------------------

export type EditKind = 'sub' | 'ins' | 'del';

export interface Edit {
	kind: EditKind;
	/** Index of the letter changed or deleted, or before which a letter is inserted. */
	at: number;
	/** The new letter (substitution, insertion). */
	base?: Base;
}

export function applyEdit(seq: string, e: Edit): string {
	const at = Math.max(0, Math.min(seq.length, e.at));
	if (e.kind === 'del') return seq.slice(0, at) + seq.slice(at + 1);
	const b = e.base ?? 'A';
	if (e.kind === 'ins') return seq.slice(0, at) + b + seq.slice(at);
	return seq.slice(0, at) + b + seq.slice(at + 1);
}

/** Position-based name of an edit (simplified from HGVS: no `dup`, no shift to the 3′-most
 * letter of a run) in coding-DNA numbering (c.1 is the A of the start codon). */
export function editName(seq: string, e: Edit, cdsStart: number, cdsEnd = Infinity): string {
	// No c.0: the letter before c.1 is c.−1; letters after the stop codon are c.*1, c.*2…
	// (cdsEnd: index just past the stop codon). Without a start codon, plain letter numbers.
	const pre = cdsStart < 0 ? '' : 'c.';
	const pos = (i: number) => {
		if (cdsStart < 0) return `${i + 1}`;
		if (i >= cdsEnd) return `*${i - cdsEnd + 1}`;
		const c = i - cdsStart;
		return c >= 0 ? `${c + 1}` : `${c}`;
	};
	if (e.kind === 'sub') return `${pre}${pos(e.at)}${seq[e.at] ?? '?'}>${e.base ?? 'A'}`;
	if (e.kind === 'del') return `${pre}${pos(e.at)}del${seq[e.at] ?? ''}`;
	return `${pre}${pos(e.at - 1)}_${pos(e.at)}ins${e.base ?? 'A'}`;
}

export type Effect =
	| 'none'
	| 'outside'
	| 'silent'
	| 'missense'
	| 'nonsense'
	| 'frameshift'
	| 'stop-lost'
	| 'start-changed'
	| 'no-start';

interface Comparison {
	effect: Effect;
	before: Translation;
	after: Translation;
	/** First residue (0-based) that differs, or −1 if none. */
	firstDiff: number;
	/** Residues of the new protein that differ from the old one at the same place. */
	changed: number;
}

/** Compares the proteins made from a sequence before and after a one-letter edit. */
export function compareEdit(seq: string, e: Edit | null): Comparison {
	const before = translate(seq);
	if (!e) return { effect: 'none', before, after: before, firstDiff: -1, changed: 0 };
	const after = translate(applyEdit(seq, e));
	const a = before.protein;
	const b = after.protein;
	let firstDiff = -1;
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		if (a[i] !== b[i]) {
			firstDiff = i;
			break;
		}
	}
	let changed = 0;
	for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) changed++;
	const shift = e.kind === 'ins' ? 1 : e.kind === 'del' ? -1 : 0;
	const expectedStart =
		before.start >= 0 && e.at < before.start ? before.start + shift : before.start;
	const inCds = before.start >= 0 && e.at >= before.start && e.at < before.end;
	let effect: Effect;
	if (after.start < 0) effect = 'no-start';
	else if (before.start < 0 || after.start !== expectedStart) effect = 'start-changed';
	else if (a === b && after.stopped === before.stopped) effect = inCds ? 'silent' : 'outside';
	else if (e.kind !== 'sub') effect = 'frameshift';
	else if (b.length < a.length && a.startsWith(b) && after.stopped) effect = 'nonsense';
	else if (b.length > a.length && b.startsWith(a)) effect = 'stop-lost';
	else effect = 'missense';
	return { effect, before, after, firstDiff, changed };
}

/**
 * Every single-letter substitution of a coding sequence (start codon to stop codon), counted by
 * what it does to the protein. `seq` must start with ATG and end with a stop codon.
 */
export function substitutionSpectrum(
	cds: string
): Record<'silent' | 'missense' | 'nonsense' | 'other', number> {
	const counts = { silent: 0, missense: 0, nonsense: 0, other: 0 };
	for (let at = 0; at < cds.length; at++) {
		for (const base of BASES) {
			if (base === cds[at]) continue;
			const { effect } = compareEdit(cds, { kind: 'sub', at, base });
			if (effect === 'silent' || effect === 'missense' || effect === 'nonsense') counts[effect]++;
			else counts.other++;
		}
	}
	return counts;
}
