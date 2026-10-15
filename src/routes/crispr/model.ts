/**
 * CRISPR as a bacterial immune system: the rules the pictures follow.
 *
 * Three parts:
 *  1. Sequences and matching. Cas9 carrying a crRNA looks for a stretch of DNA
 *     that spells the crRNA's spacer AND is followed by a PAM (here NGG, the
 *     PAM of the best-studied Cas9). It reads the letters next to the PAM first
 *     (the seed); one mismatch there and it lets go. A single mismatch far from
 *     the PAM is tolerated, two are not (a simplification of a graded effect).
 *  2. The array: leader, repeat, spacer, repeat, … New spacers go in next to
 *     the leader, and each insertion copies the first repeat.
 *  3. A population of bacteria and phages, run through time. The rates are
 *     illustrative (chosen so a run takes days, not measured), the rules are
 *     those of the experiments: a cell is immune to a phage when one of its
 *     spacers matches one of the phage's protospacers; a phage that changes a
 *     letter in that protospacer escapes that spacer.
 *
 * Every sequence here is MADE UP for teaching. None is a real phage or
 * bacterial sequence.
 */
import { rng } from '#lib/draw/math.ts';

// --------------------------------------------------------------- 1. sequences

/** The PAM of the Cas9 drawn on this page (Streptococcus pyogenes Cas9): any letter, then GG. */
export const PAM = 'NGG';
/** Letters next to the PAM that Cas9 checks first; any mismatch here and it lets go. */
export const SEED = 10;
/** Mismatches tolerated in the rest of the match, far from the PAM. */
export const DISTAL_TOLERANCE = 1;
/** Length of the spacers on this page (real ones in S. thermophilus CRISPR1: 29–31, mostly 30). */
export const SPACER_LENGTH = 20;

const COMP: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
export const complement = (s: string) =>
	s
		.split('')
		.map((c) => COMP[c] ?? c)
		.join('');
export const reverseComplement = (s: string) => complement(s).split('').reverse().join('');
/** The RNA copy of a DNA strand: U for T. */
export const toRna = (s: string) => s.replace(/T/g, 'U');

/** Does `letter` fit the IUPAC code `code` (N any, W = A or T, R = A or G)? */
export function fits(code: string, letter: string): boolean {
	if (code === 'N') return true;
	if (code === 'W') return letter === 'A' || letter === 'T';
	if (code === 'R') return letter === 'A' || letter === 'G';
	return code === letter;
}

export function hasPam(dna: string, at: number, pam = PAM): boolean {
	if (at < 0 || at + pam.length > dna.length) return false;
	for (let i = 0; i < pam.length; i++) if (!fits(pam[i], dna[at + i])) return false;
	return true;
}

/** Why Cas9 let go of (or cut) a stretch it checked. */
export type Verdict = 'cut' | 'seed-mismatch' | 'too-many-mismatches';

/**
 * One stop of Cas9 on a strand: it gripped a PAM at `pam` (or, with the PAM
 * check switched off, any position) and compared the spacer with the
 * `SPACER_LENGTH` letters before it, starting next to the PAM.
 */
export interface Check {
	/** Index of the first letter of the PAM (= one past the end of the compared stretch). */
	pam: number;
	/** Index of the first compared letter. */
	start: number;
	/** Positions, counted from the PAM (1 = letter next to it), that were compared, in order. */
	read: number;
	/** Positions (1 = next to the PAM) that did not match. */
	mismatches: number[];
	verdict: Verdict;
}

/**
 * Cas9 + crRNA scanning one strand, 5′→3′, as it is drawn: every PAM in
 * turn (or every position when `requirePam` is false). Only the matching
 * strand is scanned; `findTargets` checks both.
 */
export function scan(
	dna: string,
	spacer: string,
	{ requirePam = true, pam = PAM }: { requirePam?: boolean; pam?: string } = {}
): Check[] {
	const L = spacer.length;
	const out: Check[] = [];
	for (let p = L; p <= dna.length - (requirePam ? pam.length : 0); p++) {
		if (requirePam && !hasPam(dna, p, pam)) continue;
		const start = p - L;
		const mismatches: number[] = [];
		let read = 0;
		let verdict: Verdict = 'cut';
		for (let k = 1; k <= L; k++) {
			read = k;
			if (dna[p - k] !== spacer[L - k]) {
				mismatches.push(k);
				if (k <= SEED) {
					verdict = 'seed-mismatch';
					break;
				}
				if (mismatches.length > DISTAL_TOLERANCE) {
					verdict = 'too-many-mismatches';
					break;
				}
			}
		}
		out.push({ pam: p, start, read, mismatches, verdict });
	}
	return out;
}

/** Where a crRNA would make Cas9 cut a double-stranded DNA: hits on either strand. */
export function findTargets(
	dna: string,
	spacer: string,
	opts: { requirePam?: boolean; pam?: string } = {}
): { strand: '+' | '-'; at: number }[] {
	const hits: { strand: '+' | '-'; at: number }[] = [];
	for (const c of scan(dna, spacer, opts))
		if (c.verdict === 'cut') hits.push({ strand: '+', at: c.start });
	const rc = reverseComplement(dna);
	for (const c of scan(rc, spacer, opts))
		if (c.verdict === 'cut') hits.push({ strand: '-', at: dna.length - c.pam });
	return hits;
}

/** Cas9 cuts both strands three letters before the PAM (between positions 3 and 4 of the match). */
export const CUT_FROM_PAM = 3;

// ----------------------------------------------- teaching sequences (made up)

/** A made-up repeat, partly palindromic like real ones (its two ends read the same on both strands). */
export const REPEAT = 'GTTGCAACATCGAAACGTTGCAAC';
/** A made-up leader (the stretch before the first repeat, where transcription starts). */
export const LEADER = 'ATAGTTCAATTAAACGTTATAC';

/** Made-up spacer that matches the phage in the interference steps. */
export const SPACER = 'TACCATGACTCAGTATCCAT';

/**
 * Made-up stretch of phage DNA for the scanning picture (top strand, 5′→3′):
 * a PAM whose neighbours do not match, a decoy whose three letters next to its
 * PAM match but not the fourth, then the protospacer and its PAM.
 */
export const PHAGE_STRETCH =
	'CA' +
	'TTCAGAACTGACTATTAGCA' +
	'TGG' +
	'AC' +
	'ACTGTCAGCATCATAGTCAT' +
	'AGG' +
	'T' +
	SPACER +
	'TGG' +
	'CT';

/** What can happen to the phage's protospacer in the escape step. */
export type Mutation = 'none' | 'distal' | 'seed' | 'pam';

/** Index of the protospacer in `PHAGE_STRETCH`. */
export const PROTO_AT = PHAGE_STRETCH.indexOf(SPACER + 'TGG');

const swap = (c: string) => ({ A: 'C', C: 'A', G: 'T', T: 'G' })[c] ?? c;

/** The phage stretch after one point mutation (one letter changed). */
export function mutate(stretch: string, m: Mutation): { dna: string; at: number | null } {
	let at: number | null = null;
	if (m === 'distal') at = PROTO_AT + 2; // position 18 from the PAM
	if (m === 'seed') at = PROTO_AT + SPACER_LENGTH - 4; // position 4 from the PAM
	if (m === 'pam') at = PROTO_AT + SPACER_LENGTH + 1; // the first G of NGG
	if (at === null) return { dna: stretch, at };
	return { dna: stretch.slice(0, at) + swap(stretch[at]) + stretch.slice(at + 1), at };
}

/** Position of a letter counted from the PAM (1 = next to it), for a letter inside the protospacer. */
export const fromPam = (index: number) => PROTO_AT + SPACER_LENGTH - index;

// ------------------------------------------------------------ 2. the array

export interface Spacer {
	seq: string;
	/** Which invader it was copied from (a label for the picture). */
	source: string;
}

/** A CRISPR array: leader, then repeat–spacer–repeat–…–repeat. Index 0 is next to the leader. */
export interface CrisprArray {
	spacers: Spacer[];
}

/** The array as one strand of DNA. */
export function arrayDna(a: CrisprArray): string {
	return LEADER + REPEAT + a.spacers.map((s) => s.seq + REPEAT).join('');
}

/**
 * Adaptation: Cas1–Cas2 take the `SPACER_LENGTH` letters just before a PAM
 * of the invader and insert them next to the leader, copying the first
 * repeat. Returns the new array (the old one is unchanged), or null when the
 * invader has no PAM at or after `from` with room before it.
 */
export function acquire(
	a: CrisprArray,
	invader: string,
	source: string,
	from = 0
): { array: CrisprArray; protospacer: number } | null {
	for (let p = Math.max(SPACER_LENGTH, from); p + PAM.length <= invader.length; p++) {
		if (!hasPam(invader, p)) continue;
		const seq = invader.slice(p - SPACER_LENGTH, p);
		return { array: { spacers: [{ seq, source }, ...a.spacers] }, protospacer: p - SPACER_LENGTH };
	}
	return null;
}

/** Expression: the array copied into one long RNA and cut inside every repeat into crRNAs, one spacer each. */
export function crRnas(a: CrisprArray): string[] {
	return a.spacers.map((s) => toRna(s.seq));
}

/** Is a cell with this array immune to this invader (some spacer has a target with a PAM on it)? */
export function immune(a: CrisprArray, invader: string): boolean {
	return a.spacers.some((s) => findTargets(invader, s.seq).length > 0);
}

/**
 * Made-up genomes of three phages (a few hundred letters stand for the tens of
 * thousands of a real one), generated from a fixed seed so they are random but
 * always the same.
 */
export function madeUpGenome(seed: number, length: number): string {
	const r = rng(seed);
	let s = '';
	for (let i = 0; i < length; i++) s += 'ACGT'[Math.floor(r() * 4)];
	return s;
}

export const PHAGES = {
	A: madeUpGenome(11, 240),
	B: madeUpGenome(23, 240),
	C: madeUpGenome(37, 240)
};

// ------------------------------------------- the yogurt experiment (schematic)

/** Made-up genomes standing for phages 858 and 2972 of the 2007 experiment. */
export const PHAGE_858 = madeUpGenome(858, 240);
export const PHAGE_2972 = madeUpGenome(2972, 240);
/** Made-up spacers the strain already had, from other phages. */
const OLD = [madeUpGenome(5, 240), madeUpGenome(6, 240), madeUpGenome(7, 240)].map(
	(g, i) => acquire({ spacers: [] }, g, `old ${i + 1}`)!.array.spacers[0]
);

export type Strain = 'wt' | 'bim' | 'removed' | 'added';

/**
 * The four bacteria of the experiment: the original strain, a survivor of
 * phage 858 with two new spacers at the front, that survivor with the two
 * removed, and a survivor of phage 2972 (one new spacer, against 2972 only)
 * given the same two. In the 2007 work the two 858 spacers went into the
 * 2972 survivor, not into the original strain.
 */
export function strainArray(strain: Strain): { array: CrisprArray; removed: number } {
	const wt: CrisprArray = { spacers: OLD.slice() };
	if (strain === 'wt') return { array: wt, removed: 0 };
	if (strain === 'removed') return { array: wt, removed: 2 };
	const base = strain === 'added' ? acquire(wt, PHAGE_2972, '2972')!.array : wt;
	const first = acquire(base, PHAGE_858, 'new 1')!;
	const second = acquire(first.array, PHAGE_858, 'new 2', first.protospacer + SPACER_LENGTH + 1)!;
	return { array: second.array, removed: 0 };
}

// ------------------------------------------------- 3. population through time

/** Protospacer sites on the model phage's genome, each with its own PAM. */
export const SITES = 6;
export const SITE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f'];

/** A spacer in the population model: it matches site `site` as spelled in version `variant`. */
export interface SpacerKey {
	site: number;
	variant: number;
}
export interface BacStrain {
	id: number;
	spacers: SpacerKey[];
	n: number;
	/** Hour the strain appeared. */
	born: number;
}
export interface PhageStrain {
	id: number;
	/** Spelling of each protospacer site (0 = the original; each escape gives a new number). */
	sites: number[];
	n: number;
	born: number;
}

export const isImmune = (b: { spacers: SpacerKey[] }, p: { sites: number[] }) =>
	b.spacers.some((s) => p.sites[s.site] === s.variant);

/** Illustrative rates (per hour), chosen so a run lasts a few days. */
export const POP = {
	/** Bacterial growth rate per hour (doubling in about an hour) and carrying capacity. */
	growth: 0.7,
	capacity: 1e7,
	/** Infections per phage per bacterium per hour. */
	adsorption: 1e-8,
	/** New phages per infected cell. */
	burst: 30,
	/** Fraction of free phages lost per hour. */
	decay: 0.1,
	/** Chance that an infected cell survives and gains a spacer (CRISPR on). */
	acquisition: 1e-6,
	/** Chance that a new phage carries a letter change in one protospacer site. */
	mutation: 1e-7,
	/** Hours simulated and the time step. */
	hours: 240,
	dt: 0.05,
	/** Starting numbers. */
	bacteria0: 1e7,
	phage0: 1e3
};

export interface PopOptions {
	crispr: boolean;
	mutate: boolean;
	seed: number;
}

export interface Sample {
	t: number;
	bacteria: number;
	phage: number;
	/** Bacteria immune to the most common phage of the moment. */
	immune: number;
	/** Average number of spacers a bacterium has gained. */
	spacers: number;
	/** Average number of letter changes in a phage's protospacers. */
	changes: number;
}

export interface PopEvent {
	t: number;
	kind: 'spacer' | 'escape';
	/** The site concerned. */
	site: number;
	variant: number;
}

export interface PopRun {
	samples: Sample[];
	/** Moments when a new bacterial strain or phage strain becomes common (≥ 10% of its population). */
	events: PopEvent[];
	/** Snapshots once an hour of the most common bacterium's spacers and the most common phage's sites. */
	snapshots: { t: number; spacers: SpacerKey[]; sites: number[] }[];
}

const keyOf = (spacers: SpacerKey[]) => spacers.map((k) => `${k.site}.${k.variant}`).join();

/** Poisson draw (Knuth for small means, normal approximation above 30). */
function poisson(mean: number, r: () => number): number {
	if (mean <= 0) return 0;
	if (mean > 30) {
		const u = Math.max(1e-12, r());
		const v = r();
		const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
		return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
	}
	const L = Math.exp(-mean);
	let k = 0;
	let p = 1;
	do {
		k++;
		p *= r();
	} while (p > L);
	return k - 1;
}

/**
 * Bacteria and phages in one flask, hour by hour (Euler steps of `dt`). Each
 * step: bacteria grow toward the capacity; every phage strain meets every
 * bacterial strain at a rate ∝ both numbers. On a cell it cannot infect, the
 * phage's DNA is cut and the phage is lost. Otherwise the cell dies and
 * releases `burst` new phages, a few of them with a changed protospacer site;
 * very rarely (CRISPR on) the cell survives and keeps a new spacer from that
 * phage. Strains that fall below one individual die out (or survive, by chance,
 * at one).
 */
export function simulate(opts: PopOptions, P = POP): PopRun {
	const r = rng(opts.seed);
	let nextId = 1;
	let bac: BacStrain[] = [{ id: nextId++, spacers: [], n: P.bacteria0, born: 0 }];
	let ph: PhageStrain[] = [
		{ id: nextId++, sites: Array<number>(SITES).fill(0), n: P.phage0, born: 0 }
	];
	const samples: Sample[] = [];
	const events: PopEvent[] = [];
	const snapshots: PopRun['snapshots'] = [];
	const announced = new Set<number>();
	const steps = Math.round(P.hours / P.dt);
	const record = (t: number) => {
		const B = bac.reduce((s, b) => s + b.n, 0);
		const Ph = ph.reduce((s, p) => s + p.n, 0);
		const top = ph.reduce((a, b) => (b.n > a.n ? b : a), ph[0] ?? { sites: [], n: 0 });
		const imm = top ? bac.reduce((s, b) => s + (isImmune(b, top) ? b.n : 0), 0) : B;
		const spacers = B > 0 ? bac.reduce((s, b) => s + b.n * b.spacers.length, 0) / B : 0;
		const changes =
			Ph > 0 ? ph.reduce((s, p) => s + p.n * p.sites.reduce((a, v) => a + v, 0), 0) / Ph : 0;
		samples.push({ t, bacteria: B, phage: Ph, immune: imm, spacers, changes });
		const topB = bac.reduce((a, b) => (b.n > a.n ? b : a), bac[0]);
		if (Math.abs(t - Math.round(t)) < P.dt / 2)
			snapshots.push({
				t,
				spacers: topB ? topB.spacers.slice() : [],
				sites: top && top.n > 0 ? top.sites.slice() : []
			});
		for (const b of bac)
			if (!announced.has(b.id) && b.spacers.length > 0 && b.n >= 0.1 * B) {
				announced.add(b.id);
				const s = b.spacers[0];
				events.push({ t, kind: 'spacer', site: s.site, variant: s.variant });
			}
		for (const p of ph)
			if (!announced.has(p.id) && p.id !== 2 && Ph > 0 && p.n >= 0.1 * Ph && p.n > 100) {
				announced.add(p.id);
				const parent = p.sites.findIndex((v) => v > 0 && v === Math.max(...p.sites));
				events.push({ t, kind: 'escape', site: parent, variant: p.sites[parent] });
			}
	};
	record(0);
	for (let k = 1; k <= steps; k++) {
		const t = k * P.dt;
		const B = bac.reduce((s, b) => s + b.n, 0);
		const growth = P.growth * (1 - B / P.capacity) * P.dt;
		const dBac = bac.map((b) => b.n * growth);
		const dPh = ph.map((p) => -P.decay * p.n * P.dt);
		const born: (BacStrain | PhageStrain)[] = [];
		for (let i = 0; i < bac.length; i++) {
			const b = bac[i];
			for (let j = 0; j < ph.length; j++) {
				const p = ph[j];
				const meetings = Math.min(b.n, P.adsorption * b.n * p.n * P.dt);
				if (meetings <= 0) continue;
				dPh[j] -= meetings;
				if (opts.crispr && isImmune(b, p)) continue; // phage DNA cut; cell lives
				dBac[i] -= meetings;
				const progeny = meetings * P.burst;
				dPh[j] += progeny;
				if (opts.crispr) {
					const gained = poisson(meetings * P.acquisition, r);
					for (let g = 0; g < gained; g++) {
						const site = Math.floor(r() * SITES);
						const key = { site, variant: p.sites[site] };
						born.push({ id: 0, spacers: [key, ...b.spacers], n: 1, born: t });
					}
				}
				if (opts.mutate) {
					const mutants = Math.min(5, poisson(progeny * P.mutation, r));
					for (let m = 0; m < mutants; m++) {
						const site = Math.floor(r() * SITES);
						const sites = p.sites.slice();
						sites[site] += 1;
						born.push({ id: 0, sites, n: 1, born: t });
						dPh[j] -= 1;
					}
				}
			}
		}
		for (let i = 0; i < bac.length; i++) bac[i].n = Math.max(0, bac[i].n + dBac[i]);
		for (let j = 0; j < ph.length; j++) ph[j].n = Math.max(0, ph[j].n + dPh[j]);
		// newcomers join their strain if it exists (same spacers, or same spelling of every site)
		for (const s of born) {
			if ('spacers' in s) {
				const key = keyOf(s.spacers);
				const old = bac.find((b) => keyOf(b.spacers) === key);
				if (old) old.n += s.n;
				else bac.push({ ...s, id: nextId++ });
			} else {
				const key = s.sites.join();
				const old = ph.find((q) => q.sites.join() === key);
				if (old) old.n += s.n;
				else ph.push({ ...s, id: nextId++ });
			}
		}
		// extinction of strains under one individual (kept at one by chance)
		const survive = <T extends { n: number }>(x: T) => {
			if (x.n >= 1) return true;
			if (x.n > 0 && r() < x.n) {
				x.n = 1;
				return true;
			}
			return false;
		};
		bac = bac.filter(survive);
		ph = ph.filter(survive);
		record(t);
	}
	return { samples, events, snapshots };
}

/** The sample nearest to hour `t`. */
export function sampleAt(run: PopRun, t: number): Sample {
	const i = Math.round(t / POP.dt);
	return run.samples[Math.max(0, Math.min(run.samples.length - 1, i))];
}
