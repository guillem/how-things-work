import { expect, test } from '@playwright/test';
import {
	initialPopulation,
	nextGeneration,
	survivors,
	shadeCounts
} from '../src/routes/be-the-bird-camouflage/model';

test('predation removes only the moths the reader catches', () => {
	const original = initialPopulation();
	const caught = new Set(original.filter((m) => m.shade > 0.5).map((m) => m.id));
	const living = survivors(original, caught);
	expect(living).toHaveLength(12);
	expect(living.every((m) => m.shade < 0.5)).toBe(true);
	// The moths themselves do not change colour when their neighbours disappear.
	for (const m of living) expect(m.shade).toBe(original[m.id].shade);
});

test('survivors pass their shade on; an eaten parent has no offspring', () => {
	const population = initialPopulation();
	const pale = population.filter((m) => m.shade < 0.2);
	const dark = population.filter((m) => m.shade > 0.8);
	for (let seed = 1; seed <= 20; seed++) {
		const paleChildren = nextGeneration(pale, seed);
		const darkChildren = nextGeneration(dark, seed);
		expect(paleChildren).toHaveLength(population.length);
		// The variation is at most ±0.14 around the parent.
		expect(paleChildren.every((m) => m.shade < 0.34)).toBe(true);
		expect(darkChildren.every((m) => m.shade > 0.66)).toBe(true);
	}
});

test('offspring of alike parents stay close to their shade rather than recolouring', () => {
	const range = (moths: { shade: number }[]) =>
		Math.max(...moths.map((m) => m.shade)) - Math.min(...moths.map((m) => m.shade));
	const original = initialPopulation();
	const parents = original.map((m) => ({ ...m, shade: 0.5 }));
	const children = nextGeneration(parents, 70);
	const mean = children.reduce((sum, m) => sum + m.shade, 0) / children.length;
	// A little variation, centred on the parents, far narrower than the whole population's range.
	expect(new Set(children.map((m) => m.shade)).size).toBeGreaterThan(10);
	expect(mean).toBeCloseTo(0.5, 1);
	expect(range(children)).toBeLessThan(range(original) / 4);
});

test('eating everyone causes extinction rather than inventing survivors', () => {
	const population = initialPopulation();
	const living = survivors(population, new Set(population.map((m) => m.id)));
	expect(nextGeneration(living, 17)).toEqual([]);
});

test('the histogram counts living moths, including the darkest possible shade', () => {
	const population = initialPopulation();
	population[0].shade = 1;
	const counts = shadeCounts(population);
	expect(counts.reduce((a, b) => a + b, 0)).toBe(24);
	expect(counts[5]).toBeGreaterThan(0);
});

test('selection changes a population over generations and can reverse direction', () => {
	const mean = (population: { shade: number }[]) =>
		population.reduce((sum, moth) => sum + moth.shade, 0) / population.length;
	let population = initialPopulation();
	const initial = mean(population);
	for (let generation = 0; generation < 5; generation++) {
		const parents = [...population].sort((a, b) => a.shade - b.shade).slice(0, 12);
		population = nextGeneration(parents, 100 + generation);
	}
	const pale = mean(population);
	expect(pale).toBeLessThan(initial - 0.2);
	for (let generation = 0; generation < 5; generation++) {
		const parents = [...population].sort((a, b) => b.shade - a.shade).slice(0, 12);
		population = nextGeneration(parents, 200 + generation);
	}
	// Within a session's worth of hunts, the moths follow the darkened bark past halfway.
	for (let generation = 5; generation < 10; generation++) {
		const parents = [...population].sort((a, b) => b.shade - a.shade).slice(0, 12);
		population = nextGeneration(parents, 200 + generation);
	}
	expect(mean(population)).toBeGreaterThan(0.5);
});

test('catching moths at random, whatever their shade, shifts the population no way in particular', () => {
	const mean = (population: { shade: number }[]) =>
		population.reduce((sum, moth) => sum + moth.shade, 0) / population.length;
	let total = 0;
	const runs = 200;
	for (let run = 0; run < runs; run++) {
		let population = initialPopulation(run + 1);
		for (let generation = 0; generation < 5; generation++) {
			// Seeded "blind taps": every other moth in the drawing order, which is unrelated to shade.
			const parents = population.filter((m) => (m.id + run + generation) % 2 === 0);
			population = nextGeneration(parents, run * 1000 + generation);
		}
		total += mean(population);
	}
	expect(total / runs).toBeCloseTo(0.5, 1);
});

test('random resting places leave room for the wings and non-overlapping tap targets', () => {
	for (let seed = 1; seed <= 100; seed++) {
		const moths = initialPopulation(seed);
		for (let i = 0; i < moths.length; i++) {
			expect(moths[i].x - 30).toBeGreaterThan(28);
			expect(moths[i].x + 30).toBeLessThan(602);
			expect(moths[i].y - 30).toBeGreaterThan(74);
			expect(moths[i].y + 30).toBeLessThan(510);
			for (let j = i + 1; j < moths.length; j++) {
				expect(Math.hypot(moths[i].x - moths[j].x, moths[i].y - moths[j].y)).toBeGreaterThan(60);
			}
		}
	}
});
