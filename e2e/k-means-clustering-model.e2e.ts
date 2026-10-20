// The k-means model: Lloyd's algorithm on the Palmer penguins and on two rings.
import { expect, test } from '@playwright/test';
import {
	agreement,
	groupingCount,
	startCentres,
	assign,
	kmeans,
	moveCentres,
	ownDefault,
	penguins,
	rings,
	run,
	species,
	spread,
	type Pt
} from '../src/routes/k-means-clustering/model';

const last = <T>(a: T[]) => a[a.length - 1];

test('the data: 342 measured penguins, 151 Adélie, 68 Chinstrap and 123 Gentoo', () => {
	expect(penguins).toHaveLength(342);
	expect([0, 1, 2].map((s) => species.filter((x) => x === s).length)).toEqual([151, 68, 123]);
});

test('every round lowers the total squared distance or keeps it, and the run stops', () => {
	for (const k of [2, 3, 4, 5, 6]) {
		for (let seed = 1; seed <= 10; seed++) {
			const states = kmeans(penguins, k, seed);
			expect(states.length).toBeLessThan(100);
			const s = states.map((st) => spread(penguins, st));
			for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1] + 1e-9);
		}
	}
});

test('where it stops, every point is at its nearest centre and every centre at its points’ middle', () => {
	const end = last(kmeans(penguins, 4, 2));
	expect(assign(penguins, end.centres)).toEqual(end.labels);
	const moved = moveCentres(penguins, end.labels, end.centres);
	moved.forEach((c, j) => {
		expect(c.x).toBeCloseTo(end.centres[j].x, 12);
		expect(c.y).toBeCloseTo(end.centres[j].y, 12);
	});
});

test('three groups match the species for 96% of penguins; two groups split the Chinstraps', () => {
	const three = last(kmeans(penguins, 3, 1));
	expect(agreement(three.labels, species, 3)).toBeCloseTo(0.956, 3);
	const two = last(kmeans(penguins, 2, 1));
	expect(agreement(two.labels, species, 2)).toBeCloseTo(0.8, 2);
	// Asked for two groups, it still finds two: Chinstraps go to both of them.
	const chinstrapIn = [0, 1].map(
		(g) => species.filter((s, i) => s === 1 && two.labels[i] === g).length
	);
	expect(Math.min(...chinstrapIn)).toBeGreaterThan(15);
});

test('with four centres, different starts end in different groupings', () => {
	const ends = new Set(
		Array.from({ length: 10 }, (_, i) =>
			spread(penguins, last(kmeans(penguins, 4, i + 1))).toFixed(1)
		)
	);
	expect(ends.size).toBeGreaterThan(2);
});

test('the best of ten starts fits tighter for each added centre, from 2 to 7', () => {
	const best = (k: number) =>
		Math.min(
			...Array.from({ length: 10 }, (_, i) => spread(penguins, last(kmeans(penguins, k, i + 1))))
		);
	for (let k = 2; k < 7; k++) expect(best(k + 1)).toBeLessThan(best(k));
});

test('two rings, one inside the other: two centres cut both rings in half instead of separating them', () => {
	const r = rings();
	for (let seed = 1; seed <= 10; seed++) {
		const end = last(kmeans(r, 2, seed));
		for (const ring of [0, 1]) {
			const members = r.filter((p) => p.ring === ring);
			const inFirst = members.filter((p) => end.labels[r.indexOf(p)] === 0).length;
			// Each ring is split between the two groups, roughly half and half.
			expect(inFirst / members.length).toBeGreaterThan(0.25);
			expect(inFirst / members.length).toBeLessThan(0.75);
		}
	}
});

test('a hand-made pair of blobs is found from any start', () => {
	const blob = (cx: number): Pt[] =>
		Array.from({ length: 9 }, (_, i) => ({
			x: cx + ((i % 3) - 1) * 0.2,
			y: (Math.floor(i / 3) - 1) * 0.2
		}));
	const points = [...blob(-2), ...blob(2)];
	const truth = points.map((p) => (p.x < 0 ? 0 : 1));
	const end = last(run(points, [points[0], points[1]]));
	expect(agreement(end.labels, truth, 2)).toBe(1);
});

test('a big loose cloud beside a small tight one: two centres give the big cloud\u2019s edge to the small one', () => {
	const points = ownDefault();
	const small = points.slice(40);
	for (let seed = 1; seed <= 10; seed++) {
		const end = last(kmeans(points, 2, seed));
		const smallGroup = end.labels[40];
		// The small cloud is one group...
		expect(small.every((_, i) => end.labels[40 + i] === smallGroup)).toBe(true);
		// ...but it also takes some of the big cloud.
		const taken = end.labels.slice(0, 40).filter((l) => l === smallGroup).length;
		expect(taken).toBeGreaterThan(2);
		expect(taken).toBeLessThan(20);
	}
});

test('three centres usually find the species, but some starts settle on a worse grouping', () => {
	// Seed 242 is one such start (found by the fact-check).
	const bad = last(kmeans(penguins, 3, 242));
	expect(agreement(bad.labels, species, 3)).toBeLessThan(0.85);
	expect(spread(penguins, bad)).toBeGreaterThan(spread(penguins, last(kmeans(penguins, 3, 1))));
});

test('the six starts of the "different starts" step: six groupings at k = 6, one at k = 3', () => {
	const ends = (k: number) =>
		Array.from({ length: 6 }, (_, i) => last(kmeans(penguins, k, i + 1)).labels);
	expect(groupingCount(ends(3))).toBe(1);
	expect(groupingCount(ends(4))).toBeGreaterThan(2);
	expect(groupingCount(ends(6))).toBeGreaterThan(4);
});

test('repeated points: the starting centres sit on distinct positions, so no group starts empty', () => {
	const points: Pt[] = [
		{ x: 0, y: 0 },
		{ x: 0, y: 0 },
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 }
	];
	for (let seed = 1; seed <= 20; seed++) {
		const start = startCentres(points, 3, seed);
		expect(new Set(start.map((c) => `${c.x},${c.y}`)).size).toBe(3);
		expect(new Set(last(run(points, start)).labels).size).toBe(3);
	}
});
