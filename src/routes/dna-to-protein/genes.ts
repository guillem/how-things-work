/**
 * The genes the reader can pick, the reader's own sequence, and the real HBB variants the
 * mutation steps show.
 */
import type { Params } from '#lib/explainer/index.ts';
import { cleanDna, type Edit } from './genetics';
import { HBB_CDS, HBB_EXONS, HBB_GENE, HBB_MRNA, TRPL_GENE } from './genes-data';

export type GeneId = 'hbb' | 'trpl' | 'own';

export interface Gene {
	id: GeneId;
	name: string;
	/** Short name for tight spots. */
	short: string;
	organism: string;
	/** What the RNA polymerase copies (coding strand, DNA letters): exons and introns. */
	transcribed: string;
	/** Exons of `transcribed` (0-based, end exclusive); one exon spanning everything if none. */
	exons: readonly { start: number; end: number }[];
	/** The finished message the ribosome reads, as DNA letters. */
	mrna: string;
	/** Has a nucleus (so the message is spliced and exported) or not. */
	eukaryote: boolean;
	source: string;
}

export const MAX_OWN = 120;

/** The reader's starting sequence: trpL, a whole real gene, start to stop. */
export const DEFAULT_OWN = TRPL_GENE;

export const HBB: Gene = {
	id: 'hbb',
	name: 'Human β-globin (HBB)',
	short: 'β-globin',
	organism: 'human',
	transcribed: HBB_GENE,
	exons: HBB_EXONS,
	mrna: HBB_MRNA,
	eukaryote: true,
	source: 'RefSeq NM_000518.5; Ensembl ENST00000335295'
};

export const TRPL: Gene = {
	id: 'trpl',
	name: 'E. coli trp leader peptide (trpL)',
	short: 'trpL',
	organism: 'E. coli',
	transcribed: TRPL_GENE,
	exons: [{ start: 0, end: TRPL_GENE.length }],
	mrna: TRPL_GENE,
	eukaryote: false,
	source: 'RefSeq NC_000913.3, 1323038–1323082 (complement)'
};

export const GENE_OPTIONS: { value: GeneId; label: string }[] = [
	{ value: 'hbb', label: 'Human β-globin (HBB), 147 codons' },
	{ value: 'trpl', label: 'E. coli trpL, 14 codons' },
	{ value: 'own', label: 'Your own (type it on the stage)' }
];

/** The reader's own sequence (shared by every step that offers it). */
export function ownOf(params: Params): string {
	const v = params.own;
	return typeof v === 'string' ? cleanDna(v, MAX_OWN) : DEFAULT_OWN;
}

export function ownGene(seq: string): Gene {
	return {
		id: 'own',
		name: 'Your sequence',
		short: 'yours',
		organism: '',
		transcribed: seq,
		exons: [{ start: 0, end: seq.length }],
		mrna: seq,
		eukaryote: false,
		source: ''
	};
}

/** The gene chosen with the `gene` control, or `fallback` where the step offers no choice. */
export function geneOf(params: Params, offered: boolean, fallback: GeneId = 'hbb'): Gene {
	const id = offered ? String(params.gene ?? fallback) : fallback;
	if (id === 'trpl') return TRPL;
	if (id === 'own') return ownGene(ownOf(params));
	return HBB;
}

/** HBB letters in coding-DNA numbering: c.1 is the A of the start codon. */
export const hbbIndex = (c: number) => HBB_CDS.start + c - 1;

export interface Variant {
	id: string;
	edit: Edit;
	/** HGVS name on NM_000518.5. */
	hgvs: string;
	/** The name doctors use, in the traditional numbering that skips the first methionine. */
	common: string;
	record: string;
}

/** Real HBB variants, as recorded in dbSNP and ClinVar (checked 2026-10-14). */
export const HBB_VARIANTS: Record<'silent' | 'missense' | 'nonsense' | 'frameshift', Variant> = {
	silent: {
		id: 'silent',
		edit: { kind: 'sub', at: hbbIndex(9), base: 'C' },
		hgvs: 'c.9T>C (p.His3=)',
		common: 'codon 2 CAT→CAC',
		record: 'dbSNP rs713040, benign'
	},
	missense: {
		id: 'missense',
		edit: { kind: 'sub', at: hbbIndex(20), base: 'T' },
		hgvs: 'c.20A>T (p.Glu7Val)',
		common: 'HbS, β6 Glu→Val',
		record: 'ClinVar 15333, pathogenic (sickle cell disease)'
	},
	nonsense: {
		id: 'nonsense',
		edit: { kind: 'sub', at: hbbIndex(118), base: 'T' },
		hgvs: 'c.118C>T (p.Gln40Ter)',
		common: 'β⁰39, codon 39 CAG→TAG',
		record: 'ClinVar 15402, pathogenic (β-thalassaemia)'
	},
	frameshift: {
		id: 'frameshift',
		edit: { kind: 'del', at: hbbIndex(20) },
		hgvs: 'c.20del (p.Glu7fs)',
		common: 'codon 6 (−A)',
		record: 'ClinVar 15418, pathogenic (β-thalassaemia)'
	}
};
