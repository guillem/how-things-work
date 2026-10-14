// Checks the genetic code, transcription, translation and mutation model behind the
// "DNA to protein" explainer against NCBI translation table 1 and real HBB records. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	CODE,
	STOP,
	anticodonOf,
	applyEdit,
	cleanDna,
	codonsFor,
	compareEdit,
	editName,
	substitutionSpectrum,
	templateOf,
	transcribe,
	translate
} from '../src/routes/dna-to-protein/genetics';
import {
	HBB_CDS,
	HBB_EXONS,
	HBB_GENE,
	HBB_MRNA,
	HBB_PROTEIN,
	TRPL_GENE
} from '../src/routes/dna-to-protein/genes-data';
import { HBB_VARIANTS } from '../src/routes/dna-to-protein/genes';

const HBB_CODING = HBB_MRNA.slice(HBB_CDS.start, HBB_CDS.end);

test.describe('the standard genetic code', () => {
	test('64 codons: 61 for the 20 amino acids and 3 stops (UAA, UAG, UGA)', () => {
		expect(CODE.size).toBe(64);
		const stops = codonsFor(STOP).map(transcribe).sort();
		expect(stops).toEqual(['UAA', 'UAG', 'UGA']);
		expect(new Set([...CODE.values()].filter((a) => a !== STOP)).size).toBe(20);
	});

	test('the code is redundant: one codon for Met and Trp, six for Leu, Ser and Arg', () => {
		expect(codonsFor('M')).toEqual(['ATG']);
		expect(codonsFor('W')).toEqual(['TGG']);
		for (const aa of ['L', 'S', 'R']) expect(codonsFor(aa)).toHaveLength(6);
		expect(codonsFor('G').every((c) => c.startsWith('GG'))).toBe(true);
	});
});

test.describe('copying DNA into RNA', () => {
	test('the template strand pairs A–T and C–G, and the mRNA is the coding strand with U', () => {
		const coding = HBB_CODING.slice(0, 12);
		expect(coding).toBe('ATGGTGCATCTG');
		expect(templateOf(coding)).toBe('TACCACGTAGAC');
		expect(transcribe(coding)).toBe('AUGGUGCAUCUG');
		// Pairing the template again gives back the coding strand.
		expect(templateOf(templateOf(HBB_GENE))).toBe(HBB_GENE);
	});

	test('the exons of the HBB gene, joined, are the RefSeq mRNA', () => {
		expect(HBB_GENE).toHaveLength(1608);
		expect(HBB_EXONS.map((e) => HBB_GENE.slice(e.start, e.end)).join('')).toBe(HBB_MRNA);
		expect(HBB_MRNA).toHaveLength(628);
	});

	test('a tRNA anticodon pairs with its codon', () => {
		expect(anticodonOf('AUG')).toBe('UAC');
		expect(anticodonOf('GAG')).toBe('CUC');
	});
});

test.describe('translation', () => {
	test('HBB mRNA translates to the RefSeq protein NP_000509.1, starting at the first AUG', () => {
		const tr = translate(HBB_MRNA);
		expect(tr.start).toBe(HBB_CDS.start);
		expect(tr.stopped).toBe(true);
		expect(tr.protein).toBe(HBB_PROTEIN);
		expect(tr.protein).toHaveLength(147);
		expect(tr.end).toBe(HBB_CDS.end);
	});

	test('trpL gives the 14-residue leader peptide MKAIFVLKGWWRTS', () => {
		const tr = translate(TRPL_GENE);
		expect(tr.protein).toBe('MKAIFVLKGWWRTS');
		expect(tr.codons.at(-1)?.codon).toBe('TGA');
	});

	test('no AUG: no protein; no stop: the ribosome runs off the end', () => {
		expect(translate('CCCGGGTTT').start).toBe(-1);
		expect(translate('CCCGGGTTT').protein).toBe('');
		const open = translate('GGATGAAACCC');
		expect(open.protein).toBe('MKP');
		expect(open.stopped).toBe(false);
	});

	test('typed sequences are cleaned: case, U as T, other characters dropped', () => {
		expect(cleanDna('aug gcu-uaa x')).toBe('ATGGCTTAA');
		expect(cleanDna('ACGTACGT', 5)).toBe('ACGTA');
	});
});

test.describe('one-letter changes in real HBB variants', () => {
	test('rs713040 (c.9T>C) changes CAT to CAC: still histidine, the protein is unchanged', () => {
		const v = HBB_VARIANTS.silent;
		expect(editName(HBB_MRNA, v.edit, HBB_CDS.start)).toBe('c.9T>C');
		const cmp = compareEdit(HBB_MRNA, v.edit);
		expect(cmp.effect).toBe('silent');
		expect(cmp.after.protein).toBe(HBB_PROTEIN);
	});

	test('sickle cell (c.20A>T): GAG to GTG, glutamic acid 7 becomes valine', () => {
		const v = HBB_VARIANTS.missense;
		expect(editName(HBB_MRNA, v.edit, HBB_CDS.start)).toBe('c.20A>T');
		const cmp = compareEdit(HBB_MRNA, v.edit);
		expect(cmp.effect).toBe('missense');
		expect(cmp.firstDiff).toBe(6);
		expect(cmp.before.protein[6]).toBe('E');
		expect(cmp.after.protein[6]).toBe('V');
		expect(cmp.changed).toBe(1);
		expect(cmp.after.protein).toHaveLength(147);
	});

	test('c.118C>T turns codon 40 (CAG, glutamine) into the stop UAG: 39 residues', () => {
		const v = HBB_VARIANTS.nonsense;
		expect(editName(HBB_MRNA, v.edit, HBB_CDS.start)).toBe('c.118C>T');
		const cmp = compareEdit(HBB_MRNA, v.edit);
		expect(cmp.effect).toBe('nonsense');
		expect(cmp.after.protein).toBe(HBB_PROTEIN.slice(0, 39));
		expect(compareEdit(HBB_MRNA, { kind: 'sub', at: HBB_CDS.start + 51, base: 'T' }).effect).toBe(
			'nonsense'
		); // c.52A>T, AAG → TAG (ClinVar 15401)
	});

	test('a stop at codon 146 (Hb McKees Rocks, c.438T>A or G) loses only the last two residues', () => {
		for (const base of ['A', 'G'] as const) {
			const cmp = compareEdit(HBB_MRNA, { kind: 'sub', at: HBB_CDS.start + 437, base });
			expect(cmp.effect).toBe('nonsense');
			expect(cmp.after.protein).toBe(HBB_PROTEIN.slice(0, 145));
		}
	});

	test('c.20del shifts the frame: 6 residues kept, 12 wrong ones, then a stop', () => {
		const v = HBB_VARIANTS.frameshift;
		expect(editName(HBB_MRNA, v.edit, HBB_CDS.start)).toBe('c.20delA');
		const cmp = compareEdit(HBB_MRNA, v.edit);
		expect(cmp.effect).toBe('frameshift');
		expect(cmp.after.protein).toBe('MVHLTPGRSLPLLPCGAR');
		expect(cmp.firstDiff).toBe(6);
		expect(cmp.after.stopped).toBe(true);
	});

	test('inserting a letter also shifts the frame; three insertions restore it', () => {
		const at = HBB_CDS.start + 30;
		expect(compareEdit(HBB_MRNA, { kind: 'ins', at, base: 'G' }).effect).toBe('frameshift');
		let three = HBB_MRNA;
		for (let i = 0; i < 3; i++) three = applyEdit(three, { kind: 'ins', at, base: 'G' });
		const tr = translate(three);
		expect(tr.protein).toHaveLength(148);
		expect(tr.protein.slice(12)).toBe(HBB_PROTEIN.slice(11));
	});

	test('changes outside the coding part leave the protein alone; losing the start moves it', () => {
		expect(compareEdit(HBB_MRNA, { kind: 'sub', at: 10, base: 'G' }).effect).toBe('outside');
		expect(compareEdit(HBB_MRNA, { kind: 'del', at: HBB_CDS.end + 20 }).effect).toBe('outside');
		// Named as HGVS does: before the start c.−N, after the stop c.*N.
		expect(editName(HBB_MRNA, { kind: 'sub', at: 10, base: 'G' }, HBB_CDS.start)).toBe('c.-40C>G');
		expect(
			editName(HBB_MRNA, { kind: 'del', at: HBB_CDS.end + 20 }, HBB_CDS.start, HBB_CDS.end)
		).toMatch(/^c\.\*21del/);
		const noStart = compareEdit(HBB_MRNA, { kind: 'sub', at: HBB_CDS.start + 1, base: 'C' });
		expect(noStart.effect).toBe('start-changed');
		const stopLost = compareEdit(HBB_MRNA, { kind: 'sub', at: HBB_CDS.end - 3, base: 'C' });
		expect(stopLost.effect).toBe('stop-lost');
	});

	test('about a quarter of all single-letter changes in the HBB coding sequence are silent', () => {
		const s = substitutionSpectrum(HBB_CODING);
		const total = HBB_CODING.length * 3;
		expect(s.silent + s.missense + s.nonsense + s.other).toBe(total);
		// The numbers the narrative quotes: 325 of 1,332 silent, 34 make a stop.
		expect(total).toBe(1332);
		expect(s.silent).toBe(325);
		expect(s.nonsense).toBe(34);
		expect(s.missense / total).toBeGreaterThan(0.7);
		// …and 306 of the silent ones are at the third letter of a codon.
		let third = 0;
		for (let at = 2; at < HBB_CODING.length; at += 3)
			for (const base of ['A', 'C', 'G', 'T'] as const)
				if (
					base !== HBB_CODING[at] &&
					compareEdit(HBB_CODING, { kind: 'sub', at, base }).effect === 'silent'
				)
					third++;
		expect(third).toBe(306);
	});
});
