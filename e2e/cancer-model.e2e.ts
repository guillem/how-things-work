// Checks the models of the cancer explainer against what they stand for: a tissue in
// balance, selection of driver mutations, the effect of broken DNA repair, treatment and
// resistance (the same seeds the page uses, and many others), the Armitage–Doll multistage
// model against SEER incidence by age, Knudson's two-hit statistics, and KRAS codon 12 read
// by the genetic code (definition of done #5 in docs/TOPICS.md). Runs in Node; no browser.
import { expect, test } from '@playwright/test';
import { SEER_AGE } from '../src/routes/cancer/data';
import {
	D0,
	DEFAULT,
	DETECT,
	KRAS,
	Kind,
	MMR,
	PASSENGERS,
	P53A,
	P53B,
	RES_A,
	RES_B,
	SITES,
	count,
	fitStages,
	knudsonChildren,
	knudsonOdds,
	krasWith,
	living,
	multistageDensity,
	simulate as run,
	tumour,
	type Scenario
} from '../src/routes/cancer/model';
import { amino } from '../src/routes/dna-to-protein/genetics';

const memo = new Map<string, ReturnType<typeof run>>();
/** The model's runs, shared between tests (each takes a few tens of milliseconds). */
function simulate(s: Partial<Scenario>) {
	const key = JSON.stringify(s);
	if (!memo.has(key)) memo.set(key, run(s));
	return memo.get(key)!;
}

const DRIVERS = KRAS | P53A | P53B;
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const median = (xs: number[]) => {
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.floor(s.length / 2)];
};

test('a healthy tissue stays in balance: divisions replace the cells that die', () => {
	const run = simulate({ seed: 3, genes: 0 });
	// After a short settling in, the share of occupied sites stays put (gaps are cells that
	// have just died, waiting to be replaced).
	const share = [];
	for (let g = 50; g <= run.scenario.gens; g += 10) share.push(living(run, g) / SITES);
	expect(Math.min(...share)).toBeGreaterThan(0.95);
	expect(Math.max(...share)).toBeLessThanOrEqual(1);
	// About one cell in D0 dies each generation, and as many divisions replace them.
	const divs = run.divisions.slice(100).reduce((a, b) => a + b, 0) / (run.scenario.gens - 99);
	expect(divs / (D0 * living(run, 300))).toBeGreaterThan(0.9);
	expect(divs / (D0 * living(run, 300))).toBeLessThan(1.1);
});

test('harmless mutations pile up steadily with every generation', () => {
	const run = simulate({ seed: 3, genes: 0, passengers: PASSENGERS });
	const m = run.meanPassengers;
	expect(m[0]).toBe(0);
	// Steady accumulation, as in human stem cells (Blokzijl et al. 2016): twice the time,
	// about twice the mutations.
	expect(m[600] / m[300]).toBeGreaterThan(1.8);
	expect(m[600] / m[300]).toBeLessThan(2.2);
});

test('a driver mutation is selected: its clone outgrows a neutral one', () => {
	let kras = 0;
	let neutral = 0;
	for (const seed of SEEDS) {
		kras += count(simulate({ seed, genes: KRAS, passengers: 0, gens: 300 }), 300, Kind.Kras);
		// One TP53 copy hit changes nothing: a neutral mutation at the same rate.
		neutral += count(simulate({ seed, genes: P53A, passengers: 0, gens: 300 }), 300, Kind.OneHit);
	}
	expect(kras).toBeGreaterThan(5 * neutral);
});

test('one driver alone never makes a tumour; both together do', () => {
	for (const seed of SEEDS.slice(0, 10)) {
		const onlyKras = simulate({ seed, genes: KRAS, passengers: 0 });
		expect(onlyKras.found).toBeNull();
		const both = simulate({ seed, genes: DRIVERS, gens: 1200 });
		expect(both.found).not.toBeNull();
		// Untreated, the tumour crowds out most of the patch within 200 generations.
		expect(tumour(both, both.found! + 200) / SITES).toBeGreaterThan(0.8);
	}
});

test('a higher mutation rate brings the tumour sooner', () => {
	const at = (mu: number) =>
		median(SEEDS.map((seed) => simulate({ seed, genes: DRIVERS, mu }).found ?? Infinity));
	expect(at(2 * DEFAULT.mu)).toBeLessThan(0.8 * at(DEFAULT.mu));
});

test('a broken repair gene brings the tumour sooner', () => {
	const without = SEEDS.map((seed) => simulate({ seed, genes: DRIVERS }).found ?? Infinity);
	const withRepair = SEEDS.map(
		(seed) => simulate({ seed, genes: DRIVERS | MMR }).found ?? Infinity
	);
	expect(median(withRepair)).toBeLessThan(0.75 * median(without));
	// …and the tumour that comes is made of cells with broken repair, in most runs.
	let mutatorTumours = 0;
	for (const seed of SEEDS) {
		const r = simulate({ seed, genes: DRIVERS | MMR });
		if (r.found !== null && r.mutators[r.found] > tumour(r, r.found) / 2) mutatorTumours++;
	}
	expect(mutatorTumours).toBeGreaterThan(SEEDS.length / 2);
});

test('treatment shrinks the tumour; with one drug it usually regrows from resistant cells', () => {
	let relapses = 0;
	let preexisting = 0;
	let shrank = 0;
	for (const seed of SEEDS) {
		const r = simulate({ seed, genes: DRIVERS | RES_A | RES_B, treat: true, therapy: 'one' });
		expect(r.treatedAt).toBe(r.found);
		if (r.lowest !== null && r.lowest < DETECT / 2) shrank++;
		if (r.relapse !== null && r.cleared === null) {
			relapses++;
			if (r.resistantAtStart > 0) preexisting++;
			// The tumour that comes back is resistant.
			expect(count(r, r.relapse, Kind.Resistant)).toBeGreaterThan(0.9 * tumour(r, r.relapse));
		}
	}
	expect(shrank).toBeGreaterThan(0.8 * SEEDS.length);
	expect(relapses).toBeGreaterThan(SEEDS.length / 2);
	// Most relapses grow from cells that were already resistant before the first dose.
	expect(preexisting).toBeGreaterThan(0.6 * relapses);
});

test('two drugs at once rarely leave a resistant cell', () => {
	let one = 0;
	let two = 0;
	for (const seed of SEEDS) {
		const a = simulate({ seed, genes: DRIVERS | RES_A | RES_B, treat: true, therapy: 'one' });
		const b = simulate({ seed, genes: DRIVERS | RES_A | RES_B, treat: true, therapy: 'two' });
		if (a.cleared === null) one++;
		if (b.cleared === null) two++;
	}
	// The page quotes these counts over seeds 1–30: three in five, and one in ten.
	expect(one).toBe(18);
	expect(two).toBe(3);
});

test('the history before treatment does not depend on the treatment', () => {
	const a = simulate({ seed: 25, genes: DRIVERS | RES_A | RES_B, treat: false });
	const b = simulate({ seed: 25, genes: DRIVERS | RES_A | RES_B, treat: true });
	expect(b.found).toBe(a.found);
	const end = b.found! * SITES;
	expect(Buffer.from(b.cells.subarray(0, end)).equals(Buffer.from(a.cells.subarray(0, end)))).toBe(
		true
	);
});

// ------------------------------------------------------------------ Armitage–Doll and SEER

test('in the multistage model, incidence rises as age to the power k − 1', () => {
	for (const k of [2, 4, 6]) {
		const u = 1e-5; // ut ≪ 1
		const slope = Math.log(multistageDensity(70, k, u) / multistageDensity(35, k, u)) / Math.log(2);
		expect(slope).toBeCloseTo(k - 1, 1);
	}
});

const fitOf = (id: string) => {
	const site = SEER_AGE.find((s) => s.id === id)!;
	return fitStages(
		site.bands
			.filter((b) => b.mid !== null && b.mid > 30 && b.mid < 80)
			.map((b) => ({ age: b.mid!, rate: b.rate }))
	);
};

test('SEER incidence by age fits the multistage model: about five steps for colorectal cancer', () => {
	const crc = fitOf('colorectal');
	expect(Math.round(crc.k)).toBe(5);
	expect(crc.r2).toBeGreaterThan(0.95);
	// Pancreatic cancer rises even more steeply: six or seven steps.
	expect(fitOf('pancreas').k).toBeGreaterThan(6);
	expect(fitOf('pancreas').k).toBeLessThan(7);
	// From 35–39 to 70–74 the colorectal rate rises about elevenfold (the page says so).
	const bands = SEER_AGE.find((s) => s.id === 'colorectal')!.bands;
	const rateAt = (age: string) => bands.find((b) => b.age === age)!.rate;
	expect(Math.round(rateAt('70-74') / rateAt('35-39'))).toBe(11);
	expect(crc.k).toBeCloseTo(4.7, 1);
	// A rate per 100,000 people a year: colorectal cancer at 70–74 is about 1 in 750 a year.
	const crc70 = SEER_AGE.find((s) => s.id === 'colorectal')!.bands.find((b) => b.age === '70-74')!;
	expect(crc70.rate).toBeGreaterThan(120);
	expect(crc70.rate).toBeLessThan(145);
});

test('childhood leukaemia does not follow the old-age pattern', () => {
	const all = SEER_AGE.find((s) => s.id === 'all-leukaemia')!.bands;
	const rate = (age: string) => all.find((b) => b.age === age)!.rate;
	expect(rate('1-4')).toBeGreaterThan(5 * rate('30-34'));
});

// ------------------------------------------------------------------ Knudson

test("Knudson's numbers: three tumours on average leave 5% of carriers free, 60% with both eyes hit", () => {
	const o = knudsonOdds();
	expect(o.none).toBeCloseTo(0.05, 2);
	expect(o.oneEye).toBeCloseTo(0.35, 2);
	expect(o.bothEyes).toBeCloseTo(0.6, 2);
	const kids = knudsonChildren(20000, true, 1);
	const both = kids.filter((c) => c.left > 0 && c.right > 0).length / kids.length;
	expect(both).toBeCloseTo(o.bothEyes, 1);
	const mean = kids.reduce((a, c) => a + c.left + c.right, 0) / kids.length;
	expect(mean).toBeCloseTo(3, 1);
	// Without the inherited hit, almost nobody.
	const others = knudsonChildren(20000, false, 1);
	expect(others.filter((c) => c.left + c.right > 0).length).toBeLessThan(5);
});

// ------------------------------------------------------------------ KRAS

test('KRAS codon 12 is GGT, glycine; one-letter changes give the cancer variants', () => {
	expect(krasWith('none').protein.slice(0, 13)).toBe('MTEYKLVVVGAGG');
	expect(krasWith('none').codon12).toBe('GGT');
	const aa12 = (c: Parameters<typeof krasWith>[0]) => amino(krasWith(c).protein[11]).three;
	expect(aa12('none')).toBe('Gly');
	expect(aa12('G12D')).toBe('Asp');
	expect(aa12('G12V')).toBe('Val');
	expect(aa12('G12C')).toBe('Cys');
	// Each is a single-letter change; the rest of the protein is untouched.
	for (const c of ['G12D', 'G12V', 'G12C'] as const) {
		const a = krasWith('none').dna;
		const b = krasWith(c).dna;
		expect([...a].filter((x, i) => x !== b[i]).length).toBe(1);
		expect(krasWith(c).protein.slice(12)).toBe(krasWith('none').protein.slice(12));
	}
});
