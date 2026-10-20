/**
 * k-means (Lloyd's algorithm) on points in the plane: drop k centres, give every point the colour
 * of its nearest centre, move each centre to the average of its points, repeat until nothing
 * changes. Each round can only lower (or keep) the total squared distance from the points to their
 * centres, and there are finitely many ways to colour the points, so it always stops, but where it
 * stops depends on where the centres started.
 *
 * The penguins are clustered on bill length and flipper length, each measured in its own spread
 * (standard deviations from the mean), so that a millimetre of bill and a millimetre of flipper
 * don't weigh differently just because flippers are longer. The page draws both axes to the same
 * scale in those units, so "nearest" on screen is the nearest the algorithm uses.
 */
import { rng } from '#lib/draw/math.ts';
import { PENGUINS, SPECIES } from './penguins';

export interface Pt {
	x: number;
	y: number;
}

/** One state of a run: the centres and the colour (centre index) of every point. */
export interface KState {
	centres: Pt[];
	labels: number[];
}

const d2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Index of the centre nearest to p (the first one on a tie). */
export function nearest(p: Pt, centres: readonly Pt[]): number {
	let best = 0;
	for (let j = 1; j < centres.length; j++) if (d2(p, centres[j]) < d2(p, centres[best])) best = j;
	return best;
}

export const assign = (points: readonly Pt[], centres: readonly Pt[]) =>
	points.map((p) => nearest(p, centres));

/** Each centre moved to the average of its points; a centre with no points stays where it is. */
export function moveCentres(
	points: readonly Pt[],
	labels: readonly number[],
	centres: readonly Pt[]
) {
	const sum = centres.map(() => ({ x: 0, y: 0, n: 0 }));
	points.forEach((p, i) => {
		const s = sum[labels[i]];
		s.x += p.x;
		s.y += p.y;
		s.n++;
	});
	return sum.map((s, j) => (s.n ? { x: s.x / s.n, y: s.y / s.n } : { ...centres[j] }));
}

/** Total squared distance from every point to its own centre (what k-means makes small). */
export const spread = (points: readonly Pt[], { centres, labels }: KState) =>
	points.reduce((sum, p, i) => sum + d2(p, centres[labels[i]]), 0);

/** k distinct points of the data, chosen at random, as the starting centres. */
export function startCentres(points: readonly Pt[], k: number, seed: number): Pt[] {
	const rand = rng(seed * 7919 + k);
	const picked = new Set<number>();
	const n = Math.min(k, points.length);
	while (picked.size < n) picked.add(Math.floor(rand() * points.length));
	return [...picked].map((i) => ({ ...points[i] }));
}

/**
 * Every state of a run from the given centres: states[0] colours the points by the starting
 * centres, each later state moves the centres and colours again. The last state is the first one
 * whose colours no longer change (so its centres would not move either).
 */
export function run(points: readonly Pt[], start: readonly Pt[], maxRounds = 100): KState[] {
	const states: KState[] = [
		{ centres: start.map((c) => ({ ...c })), labels: assign(points, start) }
	];
	for (let r = 0; r < maxRounds; r++) {
		const last = states[states.length - 1];
		const centres = moveCentres(points, last.labels, last.centres);
		const labels = assign(points, centres);
		if (labels.every((l, i) => l === last.labels[i])) {
			// Nothing changes colour: the centres take their final place and stay there.
			if (centres.some((c, j) => d2(c, last.centres[j]) > 1e-18)) states.push({ centres, labels });
			break;
		}
		states.push({ centres, labels });
	}
	return states;
}

/** A whole run from random starting centres. */
export const kmeans = (points: readonly Pt[], k: number, seed: number) =>
	run(points, startCentres(points, k, seed));

/**
 * How well groups match known labels: name each group after its most common label and count the
 * points that are named right (the "purity" of the grouping), as a fraction.
 */
export function agreement(labels: readonly number[], truth: readonly number[], k: number) {
	const counts = Array.from({ length: k }, () => new Map<number, number>());
	labels.forEach((l, i) => counts[l].set(truth[i], (counts[l].get(truth[i]) ?? 0) + 1));
	const right = counts.reduce((sum, m) => sum + Math.max(0, ...m.values()), 0);
	return right / labels.length;
}

// ---- data ---------------------------------------------------------------------------------

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v: number[]) => {
	const m = mean(v);
	return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
};

const bills = PENGUINS.map((p) => p[0]);
const flippers = PENGUINS.map((p) => p[1]);
/** Mean and standard deviation of each measurement (mm), to convert to and from spreads. */
export const SCALE = {
	bill: { mean: mean(bills), sd: sd(bills) },
	flipper: { mean: mean(flippers), sd: sd(flippers) }
};

/** The penguins in spreads: x from bill length, y from flipper length. */
export const penguins: Pt[] = PENGUINS.map(([b, f]) => ({
	x: (b - SCALE.bill.mean) / SCALE.bill.sd,
	y: (f - SCALE.flipper.mean) / SCALE.flipper.sd
}));
export const species: number[] = PENGUINS.map((p) => p[2]);
export { SPECIES };

/** Two noisy rings around the same middle, the outer one twice as wide (ring index in `ring`). */
export function rings(seed = 3, n = 180): (Pt & { ring: number })[] {
	const rand = rng(seed);
	return Array.from({ length: n }, (_, i) => {
		const ring = i < n / 3 ? 0 : 1;
		const r = (ring ? 2 : 0.9) + (rand() - 0.5) * 0.3;
		const a = rand() * 2 * Math.PI;
		return { x: r * Math.cos(a), y: r * Math.sin(a), ring };
	});
}

/**
 * The starting points of "try your own": a big, loose cloud of 40 next to a small, tight one of
 * 12, close enough that the halfway border between their middles runs through the big cloud.
 */
export function ownDefault(seed = 5): Pt[] {
	const rand = rng(seed);
	const disc = (cx: number, cy: number, r: number, n: number) =>
		Array.from({ length: n }, () => {
			const a = rand() * 2 * Math.PI;
			const d = r * Math.sqrt(rand());
			return { x: +(cx + d * Math.cos(a)).toFixed(2), y: +(cy + d * Math.sin(a)).toFixed(2) };
		});
	return [...disc(-0.9, 0, 1.4, 40), ...disc(1.3, 0.2, 0.3, 12)];
}

/** Hand-placed points stored in a control-free param: "x,y;x,y" with two decimals. */
export const parsePoints = (s: unknown): Pt[] =>
	typeof s !== 'string' || !s
		? []
		: s
				.split(';')
				.map((pair) => pair.split(',').map(Number))
				.filter((v) => v.length === 2 && v.every(Number.isFinite))
				.map(([x, y]) => ({ x, y }));
export const formatPoints = (points: readonly Pt[]) =>
	points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';');
