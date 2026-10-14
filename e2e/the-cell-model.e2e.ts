// Checks the measured sizes and proportions behind "The cell" (definition of
// done #5 in docs/TOPICS.md): the scale bar tells the truth, the zoom keeps its
// target on screen, the drawn sections have the measured composition, and the
// traced molecules have their published sizes. Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	ecoliSection,
	ECOLI,
	envelopeThickness,
	capsuleVolume
} from '../src/routes/the-cell/bacterium';
import {
	BRANCHES,
	FRAMES,
	STAGE,
	branchFrames,
	cameraAt,
	layers,
	type Frame
} from '../src/routes/the-cell/frames';
import { hepatocyte, VOLUME_FRACTIONS, SIZES } from '../src/routes/the-cell/liver';
import { palisadeCell, PLANT_SHARES, THYLAKOID } from '../src/routes/the-cell/plant';
import { MACHINES, SMALL_MOLECULES } from '../src/routes/the-cell/shapes';
import { STRUCTURES, STRUCTURE_LIST } from '../src/routes/the-cell/structures';
import { formatLength, scaleBar, NM, UM } from '../src/routes/the-cell/units';

const chains = () =>
	Object.entries(BRANCHES).flatMap(([cell, bs]) =>
		Object.keys(bs).map((b) => branchFrames(cell as Frame['cell'], b))
	);

test('lengths are written in the unit a biologist would use', () => {
	expect(formatLength(25 * UM)).toBe('25 µm');
	expect(formatLength(4 * NM)).toBe('4 nm');
	expect(formatLength(0.3 * NM)).toBe('0.3 nm');
	expect(formatLength(1.5e-3)).toBe('1.5 mm');
	expect(formatLength(1000 * NM)).toBe('1 µm');
});

test('the scale bar is a round length, drawn at its true length, at every zoom', () => {
	for (let e = -2.5; e >= -9; e -= 0.05) {
		const field = 10 ** e;
		const bar = scaleBar(field);
		const mant = bar.length / 10 ** Math.floor(Math.log10(bar.length) + 1e-9);
		expect([1, 2, 5]).toContain(Math.round(mant));
		// the bar on the stage, converted back to metres, is the length it is labelled with
		expect((bar.px * field) / STAGE.w).toBeCloseTo(bar.length, 15);
		expect(bar.px).toBeGreaterThan(50);
		expect(bar.px).toBeLessThan(280);
	}
	expect(scaleBar(40 * UM).label).toBe('5 µm');
	expect(scaleBar(100 * NM).label).toBe('10 nm');
});

test('the zoom ends exactly on each view, and the next view is always inside the current one', () => {
	for (const chain of chains()) {
		for (let k = 0; k < chain.length; k++) {
			const fr = chain[k];
			const cam = cameraAt(chain, fr.W);
			expect(cam.x).toBeCloseTo(fr.c[0], 15);
			expect(cam.y).toBeCloseTo(fr.c[1], 15);
			if (k === 0) continue;
			// the child view fits in its parent view: the target never leaves the screen
			const p = chain[k - 1];
			const hw = (w: number) => w / 2;
			const hh = (w: number) => (w * STAGE.h) / STAGE.w / 2;
			expect(Math.abs(fr.c[0] - p.c[0]) + hw(fr.W)).toBeLessThanOrEqual(hw(p.W) * 1.0001);
			expect(Math.abs(fr.c[1] - p.c[1]) + hh(fr.W)).toBeLessThanOrEqual(hh(p.W) * 1.0001);
		}
		// continuous: a 1% narrower view moves the centre by much less than the view
		for (let f = chain[0].W; f > chain.at(-1)!.W; f *= 0.99) {
			const a = cameraAt(chain, f);
			const b = cameraAt(chain, f * 0.99);
			expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.02 * f);
		}
	}
});

test('at every zoom something covers the view, and it is drawn at its true scale', () => {
	for (const chain of chains()) {
		for (let f = chain[0].W; f > chain.at(-1)!.W * 0.8; f *= 0.97) {
			const ls = layers(chain, cameraAt(chain, f));
			expect(ls.length).toBeGreaterThan(0);
			expect(ls.some((l) => l.opacity === 1)).toBe(true);
			for (const l of ls) expect(l.scale).toBeCloseTo(l.frame.W / f, 12);
		}
	}
});

test('the liver cell section has the measured composition of a liver cell', () => {
	const h = hepatocyte();
	const A = h.areas;
	// the section passes through the nucleus: drawn at its measured 8 µm
	expect(h.nucleus.r * 2).toBe(8);
	// the cell's size matches a 6,200 µm³ hepatocyte: a central section of that sphere
	const d = Math.cbrt((6 * SIZES.cellVolume) / Math.PI);
	expect(A.cell / ((Math.PI * d * d) / 4)).toBeGreaterThan(0.9);
	expect(A.cell / ((Math.PI * d * d) / 4)).toBeLessThan(1.3);
	// each organelle covers the share of the cytoplasm it fills of the cell (Delesse)
	for (const k of [
		'mitochondria',
		'roughER',
		'smoothERGolgi',
		'peroxisomes',
		'lysosomes',
		'endosomes'
	] as const) {
		const share = (A[k] / A.cytoplasm) * (1 - VOLUME_FRACTIONS.nucleus);
		expect(share / VOLUME_FRACTIONS[k]).toBeGreaterThan(0.95);
		expect(share / VOLUME_FRACTIONS[k]).toBeLessThan(1.1);
	}
	// what is left, the cytosol, is the measured 50–60% of the cell
	const organelles =
		A.mitochondria + A.roughER + A.smoothERGolgi + A.peroxisomes + A.lysosomes + A.endosomes;
	const cytosol = ((A.cytoplasm - organelles) / A.cytoplasm) * (1 - VOLUME_FRACTIONS.nucleus);
	expect(cytosol).toBeGreaterThan(0.5);
	expect(cytosol).toBeLessThan(0.6);
	// mitochondria are the measured ~1 µm thick and up to 2 µm long
	for (const m of h.mitochondria) {
		expect(2 * m.b).toBeLessThanOrEqual(1);
		expect(2 * m.a).toBeLessThanOrEqual(2.1);
	}
});

test('the leaf cell has the measured shares of vacuole and chloroplasts', () => {
	const c = palisadeCell();
	expect(c.areas.cell).toBeGreaterThan(1250);
	expect(c.areas.cell).toBeLessThan(1400); // measured 1,335 µm² (Arabidopsis)
	const chl = c.areas.chloroplasts / c.areas.cell;
	expect(chl).toBeGreaterThan(PLANT_SHARES.chloroplasts * 0.9);
	expect(chl).toBeLessThan(PLANT_SHARES.chloroplasts * 1.15);
	// the vacuole fills most of the cell: 79% in spinach, 80–90% in plants
	expect(c.areas.vacuole / c.areas.cell).toBeGreaterThan(0.72);
	expect(c.areas.vacuole / c.areas.cell).toBeLessThan(0.9);
	// chloroplasts are about 5 µm long; a stack of thylakoids repeats every ≈ 22 nm
	for (const p of c.chloroplasts) expect(2 * p.a).toBeLessThanOrEqual(5.01);
	expect(THYLAKOID.repeat * 1000).toBeCloseTo(22.4, 1);
});

test('the bacterium has the measured size, envelope and number of ribosomes', () => {
	const s = ecoliSection();
	expect(capsuleVolume(ECOLI.length, ECOLI.width)).toBeGreaterThan(1);
	expect(capsuleVolume(ECOLI.length, ECOLI.width)).toBeLessThan(1.8);
	// envelope: two membranes and the periplasm, a few tens of nm
	expect(envelopeThickness * 1000).toBeGreaterThan(20);
	expect(envelopeThickness * 1000).toBeLessThan(40);
	// ~10,000 ribosomes per cell: an ideal thin section cuts n_V × d per µm²
	const nV = ECOLI.ribosomesPerCell / capsuleVolume(ECOLI.length, ECOLI.width);
	const expected = nV * ECOLI.ribosome * s.sectionArea;
	expect(s.ribosomes.length).toBeGreaterThan(expected * 0.97);
	expect(s.ribosomes.length).toBeLessThan(expected * 1.03);
	// no two ribosomes overlap
	for (let i = 0; i < s.ribosomes.length; i += 7)
		for (let j = 0; j < s.ribosomes.length; j++)
			if (i !== j) {
				const [a, b] = [s.ribosomes[i], s.ribosomes[j]];
				expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(ECOLI.ribosome);
			}
});

test('the traced machines and molecules have their published sizes', () => {
	const M = MACHINES;
	// ribosomes: 20–30 nm (BNID 102320); the mammalian one is the larger
	expect(M.ribosome70S.width).toBeGreaterThan(20);
	expect(M.ribosome70S.width).toBeLessThan(30);
	expect(M.ribosome80S.height).toBeGreaterThan(M.ribosome70S.height);
	// nucleosome: a disc about 10–11 nm across (histone tails stick out further)
	expect(M.nucleosome.width).toBeGreaterThan(10);
	expect(M.nucleosome.width).toBeLessThan(17);
	// GroEL–GroES: a barrel ≈ 14 nm wide; Rubisco ≈ 11 nm
	expect(M.groEL.width).toBeGreaterThan(13);
	expect(M.groEL.width).toBeLessThan(16);
	expect(M.rubisco.width).toBeGreaterThan(10);
	expect(M.rubisco.width).toBeLessThan(14);
	// a typical soluble protein is 4–5 nm across (adenylate kinase, 24 kDa)
	expect(Math.sqrt(M.adk.width * M.adk.height)).toBeGreaterThan(4);
	expect(Math.sqrt(M.adk.width * M.adk.height)).toBeLessThan(7);
	// membrane proteins sit across the membrane (y = 0 inside them)
	for (const m of Object.values(M).filter((m) => m.membrane)) {
		expect(m.top).toBeLessThan(0);
		expect(m.bottom).toBeGreaterThan(0);
	}
	// ATP synthase: its head hangs in the matrix (the y > 0 side), ≈ 10 nm out of the membrane
	expect(M.atpSynthase.bottom).toBeGreaterThan(14);
	// the catalogue quotes the sizes measured on the outlines
	const close = (a: number, b: number) => expect(Math.abs(a - b) / b).toBeLessThan(0.12);
	close(STRUCTURES.atpSynthase.size / NM, M.atpSynthase.height);
	close(STRUCTURES.psii.size / NM, M.psii.width);
	close(STRUCTURES.groEL.size / NM, M.groEL.height);
	close(STRUCTURES.rubisco.size / NM, M.rubisco.width);
	close(STRUCTURES.naKPump.size / NM, M.naKPump.height);

	const extent = (id: keyof typeof SMALL_MOLECULES) => {
		const xs = SMALL_MOLECULES[id].atoms.map((a) => a[1]);
		const ys = SMALL_MOLECULES[id].atoms.map((a) => a[2]);
		return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
	};
	// glucose ≈ 1 nm (BNID 110368); ATP ≈ 1.4 nm effective diameter (BNID 106978)
	expect(extent('glucose')[0]).toBeGreaterThan(0.6);
	expect(extent('glucose')[0]).toBeLessThan(1.2);
	expect(extent('atp')[0]).toBeGreaterThan(1.2);
	expect(extent('atp')[0]).toBeLessThan(2);
	// B-DNA: 2 nm wide, 12 base pairs rise 12 × 0.34 nm ≈ 4 nm
	const [w, len] = extent('dna');
	expect(w).toBeGreaterThan(1.7);
	expect(w).toBeLessThan(2.3);
	expect(len).toBeGreaterThan(3.6);
	expect(len).toBeLessThan(4.6);
	// water: O–H bonds ≈ 0.1 nm
	const [o, h1] = SMALL_MOLECULES.water.atoms.filter((a) => a[0] === 'O' || a[0] === 'H');
	expect(Math.hypot(o[1] - h1[1], o[2] - h1[2], o[3] - h1[3])).toBeCloseTo(0.096, 2);
});

test('every structure has a size, a role and a source', () => {
	for (const s of STRUCTURE_LIST) {
		expect(s.size).toBeGreaterThan(0);
		if (s.range) {
			expect(s.size).toBeGreaterThanOrEqual(s.range[0]);
			expect(s.size).toBeLessThanOrEqual(s.range[1]);
		}
		expect(s.does.length).toBeGreaterThan(20);
		expect(s.source.length).toBeGreaterThan(5);
	}
	for (const f of Object.values(FRAMES)) expect(STRUCTURES[f.focus]).toBeDefined();
	// the parts span six orders of magnitude: a 0.3 mm piece of tissue to a 0.3 nm water molecule
	const sizes = STRUCTURE_LIST.map((s) => s.size);
	expect(Math.log10(Math.max(...sizes) / Math.min(...sizes))).toBeGreaterThan(5.99);
});
