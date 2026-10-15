// Checks the CRISPR model against the biology it stands for: Cas9 cuts DNA
// that matches its crRNA only next to a PAM, reads the seed first, spares the
// bacterium's own array, and is escaped by a single letter change in the PAM
// or seed (Deveau et al. 2008; Garneau et al. 2010); new spacers go in at the
// leader end (Barrangou et al. 2007); and in a population, CRISPR saves the
// bacteria while mutating phages keep an arms race going. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	LEADER,
	PHAGES,
	PHAGE_STRETCH,
	PROTO_AT,
	REPEAT,
	SEED,
	SPACER,
	acquire,
	arrayDna,
	crRnas,
	findTargets,
	fromPam,
	immune,
	mutate,
	reverseComplement,
	sampleAt,
	scan,
	simulate,
	strainArray,
	PHAGE_858,
	PHAGE_2972
} from '../src/routes/crispr/model';

test('Cas9 checks each PAM in turn and cuts only where all the letters beside it match', () => {
	const checks = scan(PHAGE_STRETCH, SPACER);
	expect(checks.map((c) => c.verdict)).toEqual(['seed-mismatch', 'seed-mismatch', 'cut']);
	// the decoy: three letters next to its PAM match, the fourth does not
	expect(checks[1].mismatches).toEqual([4]);
	expect(checks[1].read).toBe(4);
	// the real target is read in full
	expect(checks[2].read).toBe(SPACER.length);
	expect(checks[2].start).toBe(PROTO_AT);
	expect(findTargets(PHAGE_STRETCH, SPACER)).toEqual([{ strand: '+', at: PROTO_AT }]);
});

test('a target on the other strand is found as well', () => {
	const flipped = reverseComplement(PHAGE_STRETCH);
	// the matching letters now sit on the bottom strand; on the top strand they start here
	const at = PHAGE_STRETCH.length - PROTO_AT - SPACER.length;
	expect(findTargets(flipped, SPACER)).toEqual([{ strand: '-', at }]);
	expect(flipped.slice(at, at + SPACER.length)).toBe(reverseComplement(SPACER));
});

test('the bacterium never cuts its own array: the same letters sit beside a repeat, not a PAM', () => {
	const own = arrayDna({ spacers: [{ seq: SPACER, source: 'phage' }] });
	expect(own).toContain(SPACER);
	expect(findTargets(own, SPACER)).toEqual([]);
	// without the PAM check it would cut its own chromosome
	expect(findTargets(own, SPACER, { requirePam: false }).length).toBe(1);
});

test('one changed letter in the PAM or the seed lets a phage escape; one far from the PAM does not', () => {
	const at = (m: Parameters<typeof mutate>[1]) => mutate(PHAGE_STRETCH, m);
	expect(findTargets(at('none').dna, SPACER).length).toBe(1);
	const distal = at('distal');
	expect(fromPam(distal.at!)).toBeGreaterThan(SEED);
	expect(findTargets(distal.dna, SPACER).length).toBe(1);
	const seed = at('seed');
	expect(fromPam(seed.at!)).toBeLessThanOrEqual(SEED);
	expect(findTargets(seed.dna, SPACER)).toEqual([]);
	expect(findTargets(at('pam').dna, SPACER)).toEqual([]);
	// each is a single letter
	for (const m of ['distal', 'seed', 'pam'] as const) {
		const d = at(m).dna;
		expect([...d].filter((c, i) => c !== PHAGE_STRETCH[i]).length).toBe(1);
	}
});

test('a new spacer goes in next to the leader, with a new copy of the repeat', () => {
	let a = { spacers: [] as { seq: string; source: string }[] };
	for (const name of ['A', 'B', 'C'] as const) a = acquire(a, PHAGES[name], name)!.array;
	expect(a.spacers.map((s) => s.source)).toEqual(['C', 'B', 'A']);
	const dna = arrayDna(a);
	expect(dna.startsWith(LEADER + REPEAT)).toBe(true);
	expect(dna.split(REPEAT).length - 1).toBe(a.spacers.length + 1);
	// the repeat is partly palindromic: its ends read the same on both strands
	expect(reverseComplement(REPEAT.slice(0, 8))).toBe(REPEAT.slice(-8));
	// one crRNA per spacer, in RNA letters
	expect(crRnas(a)).toEqual(a.spacers.map((s) => s.seq.replace(/T/g, 'U')));
	expect(crRnas(a).join('')).not.toContain('T');
});

test('a spacer protects against the phage it came from, not against others, and never against the cell', () => {
	const fromA = acquire({ spacers: [] }, PHAGES.A, 'A')!.array;
	expect(immune(fromA, PHAGES.A)).toBe(true);
	expect(immune(fromA, PHAGES.B)).toBe(false);
	expect(immune(fromA, PHAGES.C)).toBe(false);
	expect(immune(fromA, arrayDna(fromA))).toBe(false);
});

test('without CRISPR the phages kill the whole culture', () => {
	const run = simulate({ crispr: false, mutate: false, seed: 1 });
	expect(sampleAt(run, 0).bacteria).toBe(1e7);
	expect(sampleAt(run, 24).bacteria).toBe(0);
});

test('with CRISPR, the few cells that gain a spacer survive and their descendants refill the flask', () => {
	const run = simulate({ crispr: true, mutate: false, seed: 1 });
	// a crash first: almost every cell is infected
	const low = Math.min(...run.samples.filter((s) => s.t <= 24).map((s) => s.bacteria));
	expect(low).toBeLessThan(1e5);
	// then immune bacteria take over and the phages die out
	expect(sampleAt(run, 48).bacteria).toBeGreaterThan(9e6);
	expect(sampleAt(run, 48).immune / sampleAt(run, 48).bacteria).toBeGreaterThan(0.99);
	expect(sampleAt(run, 240).phage).toBe(0);
});

test('phages that change a letter escape, bacteria gain more spacers: an arms race', () => {
	for (const seed of [1, 2, 3]) {
		const run = simulate({ crispr: true, mutate: true, seed });
		expect(run.events.some((e) => e.kind === 'escape')).toBe(true);
		const end = sampleAt(run, 240);
		// the phages are still there, and the bacteria too
		expect(end.phage).toBeGreaterThan(1e3);
		expect(end.bacteria).toBeGreaterThan(1e6);
		// arrays have grown past one spacer; phages carry changed letters
		expect(end.spacers).toBeGreaterThan(1.5);
		expect(end.changes).toBeGreaterThan(1);
	}
	// without mutations the same runs end with the phages gone
	expect(sampleAt(simulate({ crispr: true, mutate: false, seed: 2 }), 240).phage).toBe(0);
});

test('runs replay identically from the same seed', () => {
	const a = simulate({ crispr: true, mutate: true, seed: 5 });
	const b = simulate({ crispr: true, mutate: true, seed: 5 });
	expect(sampleAt(a, 200)).toEqual(sampleAt(b, 200));
});

test('the yogurt experiment: resistance follows the new spacers, removed or added', () => {
	const resists = (s: Parameters<typeof strainArray>[0]) => immune(strainArray(s).array, PHAGE_858);
	expect(resists('wt')).toBe(false);
	expect(resists('bim')).toBe(true);
	expect(resists('removed')).toBe(false);
	expect(resists('added')).toBe(true);
	// the survivor's two new spacers are at the front
	const bim = strainArray('bim').array.spacers.map((s) => s.source);
	expect(bim.slice(0, 2)).toEqual(['new 2', 'new 1']);
});

test('as in 2007, the 858 spacers go into a survivor of phage 2972, which 858 still kills without them', () => {
	const added = strainArray('added').array;
	// before the two were added, its spacer matched 2972 and nothing in 858
	const withoutAdded = { spacers: added.spacers.filter((s) => !s.source.startsWith('new')) };
	expect(immune(withoutAdded, PHAGE_2972)).toBe(true);
	expect(immune(withoutAdded, PHAGE_858)).toBe(false);
	expect(immune(added, PHAGE_858)).toBe(true);
	// the original strain resists neither phage
	expect(immune(strainArray('wt').array, PHAGE_2972)).toBe(false);
});

test('the seed is the ten letters next to the PAM; far from it one mismatch is tolerated, two are not', () => {
	/** The phage stretch with the letters at these positions (1 = next to the PAM) changed. */
	const change = (...positions: number[]) => {
		const d = [...PHAGE_STRETCH];
		for (const k of positions) {
			const i = PROTO_AT + SPACER.length - k;
			d[i] = d[i] === 'A' ? 'C' : 'A';
		}
		return d.join('');
	};
	const cuts = (dna: string) => findTargets(dna, SPACER).length > 0;
	expect(cuts(change(10))).toBe(false);
	expect(cuts(change(11))).toBe(true);
	expect(cuts(change(18))).toBe(true);
	expect(cuts(change(14, 18))).toBe(false);
});
