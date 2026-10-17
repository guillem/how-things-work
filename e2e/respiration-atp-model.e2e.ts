// Checks the respiration model against textbook stoichiometry, measured
// potentials and P/O ratios, and the known behaviour of mitochondria without
// oxygen, with ATP synthase blocked and with an uncoupler (definition of done
// #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import {
	CITRIC_ACID_CYCLE,
	FERMENTATION_ATP,
	GLYCOLYSIS,
	H_PER_FADH2,
	H_PER_NADH,
	LINK,
	NORMAL,
	STAGES,
	atpYield,
	C_RINGS,
	deliveredHPerATP,
	dropKJ,
	E,
	efficiency,
	hPerATP,
	oxygenPerGlucose,
	poRatio,
	protonKJ,
	steadyChain,
	stepChain,
	synthaseHPerATP
} from '../src/routes/respiration-atp/model';

test('one glucose gives 6 CO₂, 10 NADH, 2 FADH₂ and 4 ATP before the chain', () => {
	expect(STAGES.glycolysis).toEqual({ atp: 2, nadh: 2, fadh2: 0, co2: 0 });
	const all = Object.values(STAGES).reduce(
		(a, s) => ({
			atp: a.atp + s.atp,
			nadh: a.nadh + s.nadh,
			fadh2: a.fadh2 + s.fadh2,
			co2: a.co2 + s.co2
		}),
		{ atp: 0, nadh: 0, fadh2: 0, co2: 0 }
	);
	expect(all).toEqual({ atp: 4, nadh: 10, fadh2: 2, co2: 6 });
	// 24 electrons reduce exactly the 6 O₂ of the overall equation.
	expect(oxygenPerGlucose()).toBe(6);
});

test('carbon is conserved at every step', () => {
	// Glycolysis: 6 carbons until aldolase, then two 3-carbon halves.
	expect(GLYCOLYSIS.slice(0, 3).every((r) => r.carbons === 6)).toBe(true);
	expect(GLYCOLYSIS.slice(3).every((r) => r.carbons === 3)).toBe(true);
	// Pyruvate (3 C) loses one CO₂ to become acetyl (2 C).
	expect(LINK.carbons + (LINK.co2 ?? 0)).toBe(3);
	// Round the cycle: each step's carbons = previous − CO₂ released; it closes on 4 + 2.
	let c = 4 + LINK.carbons;
	for (const r of CITRIC_ACID_CYCLE) {
		if (r.enzyme !== 'citrate synthase') c -= r.co2 ?? 0;
		expect(r.carbons).toBe(c);
	}
	expect(c).toBe(4);
});

test('glycolysis invests 2 ATP and gets 4 back', () => {
	const spent = GLYCOLYSIS.filter((r) => (r.atp ?? 0) < 0).reduce(
		(a, r) => a - r.atp! * r.times,
		0
	);
	const made = GLYCOLYSIS.filter((r) => (r.atp ?? 0) > 0).reduce((a, r) => a + r.atp! * r.times, 0);
	expect(spent).toBe(2);
	expect(made).toBe(4);
	expect(FERMENTATION_ATP).toBe(2);
});

test('electrons from NADH to oxygen release about 220 kJ/mol', () => {
	// 2 × 96485 × 1.136 V = 219 kJ/mol (Lehninger).
	expect(dropKJ(E.nad, E.o2)).toBeCloseTo(219, 0);
	// Succinate's electrons start lower and release less.
	expect(dropKJ(E.succinate, E.o2)).toBeLessThan(160);
	// 10 protons at 180 mV store about 174 kJ/mol: most of it.
	expect((H_PER_NADH * protonKJ(0.18)) / dropKJ(E.nad, E.o2)).toBeGreaterThan(0.75);
});

test('the cow c₈ ring sets 2.7 H⁺ per ATP and P/O maxima of 2.7 and 1.6', () => {
	expect(H_PER_NADH).toBe(10);
	expect(H_PER_FADH2).toBe(6);
	// Watt et al. 2010: 2.7 protons per ATP at the synthase.
	expect(synthaseHPerATP(8)).toBeCloseTo(2.7, 1);
	expect(poRatio(H_PER_NADH, hPerATP(8))).toBeCloseTo(2.7, 1);
	expect(poRatio(H_PER_FADH2, hPerATP(8))).toBeCloseTo(1.6, 1);
	// Hinkle 2005: a c₁₀ ring (yeast) would give 2.3 and 1.4.
	expect(poRatio(H_PER_NADH, hPerATP(10))).toBeCloseTo(2.3, 1);
	expect(poRatio(H_PER_FADH2, hPerATP(10))).toBeCloseTo(1.4, 1);
});

test('yeast and E. coli both have c₁₀ rings, but only the mitochondrion pays to export its ATP', () => {
	const ring = (id: string) => C_RINGS.find((r) => r.id === id)!;
	// Stock et al. 1999 (yeast), Jiang et al. 2001 (E. coli): 10 c-subunits each
	expect(ring('yeast').c).toBe(10);
	expect(ring('ecoli').c).toBe(10);
	// Ferguson 2010: a bacterium has no ATP-for-ADP exchange across a membrane
	expect(deliveredHPerATP(ring('ecoli'))).toBeCloseTo(3.3, 1);
	expect(deliveredHPerATP(ring('yeast'))).toBeCloseTo(4.3, 1);
	// the cow's mitochondrion: 8/3 + 1 ≈ 3.7 (the narrative's figure); a chloroplast's c₁₄: 4.7
	expect(deliveredHPerATP(ring('cow'))).toBeCloseTo(3.7, 1);
	expect(deliveredHPerATP(ring('spinach'))).toBeCloseTo(4.7, 1);
});

test('a glucose yields 30–32 ATP with measured P/O, 36–38 with the old integers', () => {
	expect(atpYield('measured', 'malate').total).toBe(32);
	expect(atpYield('measured', 'glycerol').total).toBe(30);
	expect(atpYield('classic', 'malate').total).toBe(38);
	expect(atpYield('classic', 'glycerol').total).toBe(36);
	// The c₈ ring's ceiling, with no leak at all.
	const max = atpYield('ring', 'malate').total;
	expect(max).toBeCloseTo(34.5, 1);
	// The narrative quotes the glycerol-phosphate shuttle's ceiling too.
	expect(atpYield('ring', 'glycerol').total).toBeCloseTo(32.4, 1);
	// The chain makes almost all of it: only 4 come from substrate-level steps.
	expect(atpYield('measured', 'malate').substrate).toBe(4);
	// Fermentation gives 2 per glucose: 16 times less.
	expect(atpYield('measured', 'malate').total / FERMENTATION_ATP).toBe(16);
});

test('about a third of glucose energy ends in ATP at standard values, over half in a cell', () => {
	expect(efficiency(32)).toBeCloseTo(0.34, 2);
	expect(efficiency(32, -50)).toBeGreaterThan(0.5);
});

test('working mitochondria hold a gradient of 150–200 mV and come close to P/O 2.5', () => {
	const { state, fluxes } = steadyChain(NORMAL);
	expect(state.dp).toBeGreaterThan(0.15);
	expect(state.dp).toBeLessThan(0.2);
	// Electrons in = electrons out, through every complex.
	expect(fluxes.I + fluxes.II).toBeCloseTo(fluxes.III, 2);
	expect(fluxes.III).toBeCloseTo(fluxes.IV, 2);
	// Proton leak keeps the yield below the c₈ maximum of 2.7.
	const po = fluxes.atp / fluxes.IV;
	expect(po).toBeGreaterThan(2.2);
	expect(po).toBeLessThan(poRatio(H_PER_NADH, hPerATP(8)));
});

test('without oxygen the chain backs up from cytochrome c to NADH and stops', () => {
	const start = steadyChain(NORMAL).state;
	const cond = { ...NORMAL, oxygen: false };
	const s1 = stepChain(start, 0.3, cond);
	// The carrier next to oxygen fills first, NADH last.
	expect(s1.c - start.c).toBeGreaterThan(s1.nadh - start.nadh);
	// Time for each pool to pass 90% reduced: cytochrome c, then ubiquinone, then NADH.
	const t90: Record<string, number> = {};
	let s = start;
	for (let i = 1; i <= 4000 && Object.keys(t90).length < 3; i++) {
		s = stepChain(s, 0.001, cond);
		for (const k of ['c', 'q', 'nadh'] as const) if (!(k in t90) && s[k] > 0.9) t90[k] = i;
	}
	expect(t90.c).toBeLessThan(t90.q);
	expect(t90.q).toBeLessThan(t90.nadh);
	const end = steadyChain(cond, start);
	expect(end.state.c).toBeGreaterThan(0.99);
	expect(end.state.q).toBeGreaterThan(0.99);
	expect(end.state.nadh).toBeGreaterThan(0.99);
	expect(end.fluxes.o2).toBe(0);
	expect(end.fluxes.atp).toBe(0);
	// With no pumping the gradient runs down.
	expect(end.state.dp).toBeLessThan(start.dp - 0.05);
});

test('blocking ATP synthase raises the gradient and slows respiration', () => {
	const normal = steadyChain(NORMAL);
	const blocked = steadyChain({ ...NORMAL, synthase: false });
	expect(blocked.state.dp).toBeGreaterThan(normal.state.dp);
	// Respiratory control: oxygen use falls several-fold.
	expect(normal.fluxes.o2 / blocked.fluxes.o2).toBeGreaterThan(4);
	expect(blocked.fluxes.atp).toBe(0);
});

test('an uncoupler collapses the gradient: the chain races, no ATP is made', () => {
	const normal = steadyChain(NORMAL);
	const leaky = steadyChain({ ...NORMAL, uncoupler: true });
	expect(leaky.state.dp).toBeLessThan(0.08);
	expect(leaky.fluxes.o2).toBeGreaterThan(1.5 * normal.fluxes.o2);
	expect(leaky.fluxes.atp).toBe(0);
});
