/**
 * The page's model glue: the two lattice chains, Levinthal's estimate, and statistics of
 * the real proteins in `proteins-data.ts`.
 */
import { AMINO, type AminoKind } from '../dna-to-protein/genetics';
import { PROTEINS, type ProteinRecord } from './proteins-data';
import { landscape, type Landscape } from './hp';
import { distance, type Vec3 } from './structure';

export interface LatticeChain {
	id: string;
	label: string;
	seq: string;
}

/**
 * Two 14-bead HP chains with the same beads (7 H, 7 P) in a different order. Each was picked,
 * by enumerating all 110,188 shapes of every 14-bead sequence with 7 H, from the sequences
 * whose lowest energy (−6) is reached by one shape only, so that each chain has a single
 * best fold, and the two folds differ.
 */
export const CHAINS: LatticeChain[] = [
	{ id: 'a', label: 'Chain A', seq: 'HHPPHHPPHPPHPH' },
	{ id: 'b', label: 'Chain B', seq: 'HPHPPHHPPHPHPH' }
];
export const chainById = (id: string) => CHAINS.find((c) => c.id === id) ?? CHAINS[0];

const landscapes = new Map<string, Landscape>();
/** The full landscape of a chain (every shape; ~0.1 s for 14 beads), computed once. */
export function landscapeOf(seq: string): Landscape {
	let l = landscapes.get(seq);
	if (!l) landscapes.set(seq, (l = landscape(seq)));
	return l;
}

// ---- Levinthal ----------------------------------------------------------------------------

export const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
/** Age of the universe, years (Planck Collaboration 2018: 13.787 ± 0.020 billion). */
export const UNIVERSE_AGE_YEARS = 13.787e9;

/**
 * Years needed to try `shapes` conformations one after another at `rate` per second: the
 * argument of Levinthal's paradox (Levinthal 1968–69), in the form of Zwanzig, Szabo &
 * Bagchi (PNAS 89, 20, 1992): 3¹⁰⁰ shapes at 10¹³ per second.
 */
export const searchYears = (shapes: number, rate = 1e13) => shapes / rate / SECONDS_PER_YEAR;

// ---- real proteins --------------------------------------------------------------------------

export const proteinById = (id: string): ProteinRecord =>
	PROTEINS.find((p) => p.id === id) ?? PROTEINS[0];

/** A residue counts as buried when less than this share of its surface touches water. */
export const BURIED = 0.2;

/** Share of a kind of amino acid that is buried in the measured structure. */
export function buriedShare(p: ProteinRecord, kinds: AminoKind[]): { buried: number; of: number } {
	let buried = 0;
	let of = 0;
	p.sequence.split('').forEach((c, i) => {
		const r = p.rsa[i];
		if (r === null || !kinds.includes(AMINO.get(c)?.kind ?? 'stop')) return;
		of++;
		if (r < BURIED) buried++;
	});
	return { buried, of };
}

export const kindOf = (letter: string): AminoKind => AMINO.get(letter)?.kind ?? 'stop';

/** Mean pLDDT over a stretch of residues (UniProt positions, 1-based, inclusive). */
export function meanPlddt(p: ProteinRecord, from: number, to: number): number {
	const xs = p.plddt.slice(from - 1, to);
	return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/** Cα–Cα distance beyond which two consecutive points are not bonded (a gap in the data). */
export const GAP = 4.3;

/**
 * Runs of consecutive residues (indices) that form an unbroken chain in a trace: missing
 * residues and gaps longer than a peptide bond split it.
 */
export function runs(trace: readonly (Vec3 | null)[]): number[][] {
	const out: number[][] = [];
	let cur: number[] = [];
	trace.forEach((v, i) => {
		const prev = cur.length ? trace[cur[cur.length - 1]] : null;
		if (!v || (prev && (cur[cur.length - 1] !== i - 1 || distance(prev, v) > GAP))) {
			if (cur.length) out.push(cur);
			cur = [];
		}
		if (v) cur.push(i);
	});
	if (cur.length) out.push(cur);
	return out;
}

// ---- the gap between sequences and structures --------------------------------------------

/**
 * Experimentally determined structures in the RCSB PDB, from its search service (query
 * `rcsb_entry_info.structure_determination_methodology = experimental`), 14 October 2026.
 */
export const PDB_ENTRIES = 260_896;
/** Protein sequences in UniProtKB, release 2026_03 (2 September 2026), from its REST API. */
export const UNIPROT_SEQUENCES = 150_006_383;
