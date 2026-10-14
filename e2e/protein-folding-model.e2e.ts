// Checks the models behind "Protein folding": the HP lattice model (shape counts against the
// exact enumeration series, unique folds, Monte Carlo at low and high temperature),
// Levinthal's estimate, the structure superposition, and the real protein data (Cα geometry,
// the RMSD and confidence figures the page quotes). Runs in Node.
import { expect, test } from '@playwright/test';
import {
	canonical,
	contacts,
	eachShape,
	energy,
	fromTurns,
	landscape,
	mirror,
	run,
	selfAvoiding,
	toTurns,
	walkCount,
	walkCountEstimate
} from '../src/routes/protein-folding/hp';
import {
	CHAINS,
	UNIVERSE_AGE_YEARS,
	buriedShare,
	meanPlddt,
	proteinById,
	runs,
	searchYears
} from '../src/routes/protein-folding/folding';
import { PROTEINS } from '../src/routes/protein-folding/proteins-data';
import {
	apply,
	band,
	distance,
	place,
	rmsd,
	superpose,
	type Mat3,
	type Vec3
} from '../src/routes/protein-folding/structure';

test.describe('the HP lattice model', () => {
	test('counts self-avoiding walks on the square lattice exactly (OEIS A001411)', () => {
		// https://oeis.org/A001411 (b-file): walks of n steps from the origin
		const a001411 = [1, 4, 12, 36, 100, 284, 780, 2172, 5916, 16268, 44100, 120292, 324932, 881500];
		a001411.forEach((c, n) => expect(walkCount(n), `n = ${n}`).toBe(c));
	});

	test('the long-chain law μⁿ n^(γ−1) carries the exact count forward to within 2 %', () => {
		const est = walkCountEstimate(13, 9, 16268);
		expect(Math.abs(est / 881500 - 1)).toBeLessThan(0.02);
	});

	test('each shape is listed once up to rotation and mirror image', () => {
		const seen = new Set<string>();
		eachShape(9, (w) => {
			const fold = Array.from({ length: 10 }, (_, i) => [w[2 * i], w[2 * i + 1]] as const);
			const t = toTurns(fold);
			expect(canonical(t)).toBe(t);
			seen.add(t);
		});
		expect(seen.size).toBe((16268 + 4) / 8);
	});

	test('turns and coordinates convert both ways; a mirrored shape has the same energy', () => {
		const t = 'SLLSRLLRLLRL';
		expect(toTurns(fromTurns(t))).toBe(t);
		const seq = CHAINS[0].seq;
		expect(energy(seq, fromTurns(mirror(t)))).toBe(energy(seq, fromTurns(t)));
	});

	test('only non-neighbouring H beads on adjacent grid points score', () => {
		// a 2 × 2 square of four H beads: one contact (0–3); 0–1, 1–2, 2–3 are chain bonds
		expect(contacts('HHHH', fromTurns('LL'))).toEqual([[0, 3]]);
		expect(energy('HPPH', fromTurns('LL'))).toBe(-1);
		expect(energy('PHHP', fromTurns('LL'))).toBe(0);
		expect(selfAvoiding(fromTurns('LLL'))).toBe(false);
	});

	test('each chain has one best fold, at −6, and the same beads in another order fold differently', () => {
		const [a, b] = CHAINS.map((c) => landscape(c.seq));
		for (const l of [a, b]) {
			expect(l.shapes).toBe((881500 + 4) / 8);
			expect(l.best).toBe(-6);
			expect(l.bestFolds).toHaveLength(1);
			expect(l.byEnergy.reduce((s, e) => s + e.shapes, 0)).toBe(l.shapes);
		}
		expect([...CHAINS[0].seq].sort().join('')).toBe([...CHAINS[1].seq].sort().join(''));
		expect(a.bestFolds[0]).not.toBe(b.bestFolds[0]);
		expect(energy(CHAINS[1].seq, fromTurns(a.bestFolds[0]))).toBeGreaterThan(-6);
		// in the best fold the H beads have fewer free grid neighbours than the P beads (a core)
		const fold = fromTurns(a.bestFolds[0]);
		const taken = new Set(fold.map(([x, y]) => `${x},${y}`));
		const open = (i: number) =>
			[
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			].filter(([dx, dy]) => !taken.has(`${fold[i][0] + dx},${fold[i][1] + dy}`)).length;
		const mean = (r: string) => {
			const ix = [...CHAINS[0].seq].flatMap((c, i) => (c === r ? [i] : []));
			return ix.reduce((s, i) => s + open(i), 0) / ix.length;
		};
		expect(mean('H')).toBeLessThan(mean('P') / 2);
	});

	test('Monte Carlo folds the chain when cool and leaves it floppy when hot', () => {
		const seq = CHAINS[0].seq;
		const cold = run(seq, { T: 0.3, movesPerFrame: 50, frames: 600, seed: 2 });
		const hot = run(seq, { T: 2, movesPerFrame: 50, frames: 600, seed: 2 });
		for (const f of [...cold, ...hot]) {
			expect(selfAvoiding(f.fold)).toBe(true);
			expect(energy(seq, f.fold)).toBe(f.energy);
		}
		expect(cold.at(-1)?.best).toBe(-6);
		const mean = (fs: typeof cold) => fs.slice(300).reduce((s, f) => s + f.energy, 0) / 300;
		expect(mean(cold)).toBeLessThan(-5);
		expect(mean(hot)).toBeGreaterThan(-1.5);
	});
});

test('Levinthal: 3¹⁰⁰ shapes at 10¹³ a second take about 10²⁷ years', () => {
	const years = searchYears(3 ** 100);
	expect(Math.log10(years)).toBeGreaterThan(27);
	expect(Math.log10(years)).toBeLessThan(28);
	expect(years / UNIVERSE_AGE_YEARS).toBeGreaterThan(1e16);
});

test.describe('structures', () => {
	test('superposition finds a known rotation and translation exactly', () => {
		const pts: Vec3[] = [
			[1, 2, 3],
			[-4, 0.5, 2],
			[3, -1, -2],
			[0, 5, 1],
			[2, 2, -3]
		];
		const c = Math.cos(1.1);
		const s = Math.sin(1.1);
		const R: Mat3 = [
			[c, -s, 0],
			[s, c, 0],
			[0, 0, 1]
		];
		const moved = pts.map((p) => apply(R, p).map((v, i) => v + [5, -3, 2][i]) as Vec3);
		const fit = superpose(moved, pts);
		expect(fit.rmsd).toBeLessThan(1e-6);
		moved.forEach((p, i) => expect(distance(place(fit, p), pts[i])).toBeLessThan(1e-9));
	});

	test('the traces are real chains: consecutive Cα atoms 3.8 Å apart (2.9 Å at a cis bond)', () => {
		for (const p of PROTEINS) {
			for (const trace of [p.exp, p.pred]) {
				for (const r of runs(trace)) {
					for (let k = 1; k < r.length; k++) {
						const d = distance(trace[r[k - 1]]!, trace[r[k]]!);
						// (coordinates are rounded to 0.1 Å) a cis peptide bond (mostly before a proline) brings them to ~2.9 Å; where
						// AlphaFold is unsure (pLDDT < 50) its geometry may be strained a little
						const loose = trace === p.pred && p.plddt[r[k]] < 50;
						expect(d, `${p.id} ${r[k]}`).toBeGreaterThan(d < 3.2 ? 2.7 : loose ? 3.3 : 3.5);
						expect(d).toBeLessThan(4.1);
					}
				}
			}
			expect(runs(p.pred)).toHaveLength(1);
		}
	});

	test('AlphaFold matches the crystal structures to within an atom’s width', () => {
		for (const p of PROTEINS) {
			const ix = p.exp.flatMap((v, i) => (v ? [i] : []));
			const shipped = rmsd(
				ix.map((i) => p.pred[i]),
				ix.map((i) => p.exp[i]!)
			);
			// the shipped prediction is already superposed: refitting gains nothing
			const refit = superpose(
				ix.map((i) => p.pred[i]),
				ix.map((i) => p.exp[i]!)
			).rmsd;
			expect(shipped).toBeLessThan(1);
			expect(shipped - refit).toBeLessThan(0.05);
			expect(Math.abs(shipped - p.rmsd)).toBeLessThan(0.05);
		}
		expect(proteinById('globin').rmsd).toBeCloseTo(0.47, 1);
	});

	test('the β-globin sequence is the one translated in “DNA to protein”', () => {
		const g = proteinById('globin');
		expect(g.sequence.slice(0, 10)).toBe('MVHLTPEEKS');
		expect(g.sequence).toHaveLength(147);
		// sickle-cell position: Glu7 (β6 counting from the valine)
		expect(g.sequence[6]).toBe('E');
		expect(g.exp[0]).toBeNull();
	});

	test('water-repelling amino acids are mostly buried, charged ones mostly on the surface', () => {
		const g = proteinById('globin');
		const nonpolar = buriedShare(g, ['nonpolar']);
		const charged = buriedShare(g, ['positive', 'negative']);
		expect(nonpolar.buried / nonpolar.of).toBeGreaterThan(0.6);
		expect(charged.buried / charged.of).toBeLessThan(0.15);
	});

	test('AlphaFold is sure of p53’s core and unsure of its floppy ends', () => {
		const p = proteinById('p53');
		expect(meanPlddt(p, 100, 290)).toBeGreaterThan(90);
		expect(meanPlddt(p, 1, 40)).toBeLessThan(70);
		expect(meanPlddt(p, 370, 393)).toBeLessThan(50);
		expect(band(95)).toBe('veryHigh');
		expect(band(40)).toBe('veryLow');
		const g = proteinById('globin');
		expect(g.af.meanPlddt).toBeGreaterThan(95);
	});
});
