/**
 * The model behind the PCR page, in three parts.
 *
 * 1. Strands, one cycle at a time (`Tube`): every single strand is an interval of the template,
 *    0…`length`, read 5′→3′ left to right for the top strand. The forward primer is the top
 *    strand's sequence at [a, a + lf): it pairs with a bottom strand and is extended to that
 *    strand's 5′ end (its right end). The reverse primer pairs with a top strand at [b − lr, b)
 *    and is extended to its 5′ end (its left end). Each cycle melts every double strand, primes
 *    every strand that carries its primer's site and copies it. Nothing is assumed about which
 *    pieces appear when: that falls out of the copying.
 *
 * 2. Amplification with running out (`amplify`): the number of double-stranded copies N grows
 *    each cycle by N·E, where the fraction copied E is the best-case efficiency E₀ times the
 *    fractions of primers and of building blocks (nucleotides) still left. Every new copy uses
 *    one primer of each kind and the nucleotides of its new stretches. The tube is a typical
 *    20 µL reaction with each primer at 500 nM (the CDC N1 test's concentration) and each of the
 *    four nucleotides at 0.2 mM. The threshold cycle Ct is where N first reaches the detector's
 *    threshold, interpolated between cycles on a log scale.
 *
 * 3. Primer matching (`primerSites`): a primer binds only where the template carries its exact
 *    sequence (the forward primer on the top strand, the reverse primer's reverse complement).
 */

// ------------------------------------------------------------------------------------------
// 1. Strands
// ------------------------------------------------------------------------------------------

export type Sense = 'top' | 'bottom';

export interface Strand {
	sense: Sense;
	/** Left end, in template positions. */
	from: number;
	/** Right end. */
	to: number;
	/** The cycle that made it (0 for the original template). */
	born: number;
}

export interface Duplex {
	top: Strand;
	bottom: Strand;
}

export interface Layout {
	/** Length of the original double strand. */
	length: number;
	/** Where the forward primer starts on the top strand (the target's left end). */
	a: number;
	/** Where the reverse primer's site ends on the top strand (the target's right end). */
	b: number;
	/** Primer lengths. */
	lf: number;
	lr: number;
}

/** The kinds of strand a cycle can leave, by which ends the primers fixed. */
export type Kind = 'original' | 'long' | 'target';

export function kindOf(s: Strand, l: Layout): Kind {
	if (s.born === 0) return 'original';
	return s.from === l.a && s.to === l.b ? 'target' : 'long';
}

export class Tube {
	readonly layout: Layout;
	duplexes: Duplex[];
	cycle = 0;

	constructor(layout: Layout, copies = 1) {
		this.layout = layout;
		this.duplexes = Array.from({ length: copies }, () => ({
			top: { sense: 'top', from: 0, to: layout.length, born: 0 },
			bottom: { sense: 'bottom', from: 0, to: layout.length, born: 0 }
		}));
	}

	/** The copy a primer makes of one strand, or null if the strand lacks the primer's site. */
	copyOf(s: Strand, born: number): Strand | null {
		const { a, b, lf, lr } = this.layout;
		if (s.sense === 'bottom') {
			// the forward primer pairs with [a, a + lf) and is extended rightwards to the end
			if (s.from > a || s.to < a + lf) return null;
			return { sense: 'top', from: a, to: s.to, born };
		}
		// the reverse primer pairs with [b − lr, b) and is extended leftwards to the end
		if (s.from > b - lr || s.to < b) return null;
		return { sense: 'bottom', from: s.from, to: b, born };
	}

	/** One cycle: melt every double strand, prime and copy each strand. */
	step(): this {
		const born = this.cycle + 1;
		const next: Duplex[] = [];
		for (const d of this.duplexes) {
			for (const s of [d.top, d.bottom]) {
				const c = this.copyOf(s, born);
				if (!c) continue;
				next.push(s.sense === 'top' ? { top: s, bottom: c } : { top: c, bottom: s });
			}
		}
		this.duplexes = next;
		this.cycle = born;
		return this;
	}

	strands(): Strand[] {
		return this.duplexes.flatMap((d) => [d.top, d.bottom]);
	}

	/** Strands of each kind. */
	count(): Record<Kind, number> {
		const out: Record<Kind, number> = { original: 0, long: 0, target: 0 };
		for (const s of this.strands()) out[kindOf(s, this.layout)]++;
		return out;
	}

	/** Double strands whose two strands are both exactly the target. */
	targetDuplexes(): number {
		return this.duplexes.filter(
			(d) => kindOf(d.top, this.layout) === 'target' && kindOf(d.bottom, this.layout) === 'target'
		).length;
	}
}

/** The drawing's template: a stretch of 100 positions with the target in the middle. */
export const LAYOUT: Layout = { length: 100, a: 30, b: 70, lf: 6, lr: 6 };

// ------------------------------------------------------------------------------------------
// 2. Amplification
// ------------------------------------------------------------------------------------------

const AVOGADRO = 6.02214076e23;

export interface Recipe {
	/** Reaction volume, litres. */
	volume: number;
	/** Each primer, mol/L. */
	primer: number;
	/** Each of the four nucleotides, mol/L. */
	nucleotide: number;
	/** Length of the copied piece, base pairs. */
	amplicon: number;
	/** Lengths of the two primers together (their letters come with the primers). */
	primerLetters: number;
}

/** A typical 20 µL test: primers at 500 nM each, nucleotides at 0.2 mM each, the CDC N1 piece. */
export const RECIPE: Recipe = {
	volume: 20e-6,
	primer: 500e-9,
	nucleotide: 0.2e-3,
	amplicon: 72,
	primerLetters: 20 + 24
};

/** Molecules of each primer in the tube. */
export const primerMolecules = (r: Recipe = RECIPE) => r.primer * r.volume * AVOGADRO;
/** Nucleotide molecules in the tube, all four kinds. */
export const nucleotideMolecules = (r: Recipe = RECIPE) => 4 * r.nucleotide * r.volume * AVOGADRO;

/** Copies the detector needs to see the glow: the page's round number. */
export const THRESHOLD = 1e10;
/** Cycles a test runs (the CDC N1 test runs 45). */
export const CYCLES = 45;

export interface Run {
	/** Double-stranded copies after each cycle, index 0 = the start. */
	copies: number[];
	/** Fraction of the primers left after each cycle. */
	primers: number[];
	/** Fraction of the nucleotides left after each cycle. */
	nucleotides: number[];
}

export function amplify(start: number, cycles = CYCLES, efficiency = 1, r: Recipe = RECIPE): Run {
	const p0 = primerMolecules(r);
	const d0 = nucleotideMolecules(r);
	const perCopy = 2 * r.amplicon - r.primerLetters;
	let n = start;
	let p = p0;
	let d = d0;
	const run: Run = { copies: [n], primers: [1], nucleotides: [1] };
	for (let c = 0; c < cycles; c++) {
		const e = efficiency * (p / p0) * (d / d0);
		const made = Math.min(n * e, p, d / perCopy);
		n += made;
		p -= made;
		d -= made * perCopy;
		run.copies.push(n);
		run.primers.push(p / p0);
		run.nucleotides.push(d / d0);
	}
	return run;
}

/** Copies at a fractional cycle, interpolated on a log scale (for smooth drawing). */
export function copiesAt(run: Run, cycle: number): number {
	const c = Math.max(0, Math.min(run.copies.length - 1, cycle));
	const i = Math.min(run.copies.length - 2, Math.floor(c));
	const u = c - i;
	return Math.exp((1 - u) * Math.log(run.copies[i]) + u * Math.log(run.copies[i + 1]));
}

/** The threshold cycle: where the copies first reach `threshold`; null if they never do. */
export function thresholdCycle(run: Run, threshold = THRESHOLD): number | null {
	const c = run.copies;
	if (c[0] >= threshold) return 0;
	for (let i = 1; i < c.length; i++) {
		if (c[i] >= threshold) {
			const u = (Math.log(threshold) - Math.log(c[i - 1])) / (Math.log(c[i]) - Math.log(c[i - 1]));
			return i - 1 + u;
		}
	}
	return null;
}

// ------------------------------------------------------------------------------------------
// 3. Primers
// ------------------------------------------------------------------------------------------

const PAIR: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };
export const complement = (s: string) =>
	s
		.split('')
		.map((c) => PAIR[c] ?? 'N')
		.join('');
export const reverseComplement = (s: string) => complement(s).split('').reverse().join('');

export interface Sites {
	/** Start of the forward primer on the top strand, or −1. */
	forward: number;
	/** Start of the reverse primer's reverse complement on the top strand, or −1. */
	reverse: number;
	/** The piece copied, as indices [from, to) of the top strand, or null. */
	product: [number, number] | null;
}

/** Where a pair of primers binds a top strand: exact matches only. */
export function primerSites(top: string, forward: string, reverse: string): Sites {
	const f = top.indexOf(forward);
	const rc = reverseComplement(reverse);
	const r = top.indexOf(rc);
	const product: [number, number] | null =
		f >= 0 && r >= 0 && r + rc.length > f ? [f, r + rc.length] : null;
	return { forward: f, reverse: r, product };
}

/** Fewest letters that differ between `primer` and any same-length window of `top`. */
export function bestMismatch(top: string, primer: string): number {
	let best = primer.length;
	for (let i = 0; i + primer.length <= top.length; i++) {
		let m = 0;
		for (let j = 0; j < primer.length && m < best; j++) if (top[i + j] !== primer[j]) m++;
		best = Math.min(best, m);
	}
	return best;
}
