// Ants and scent trails: the field (NetLogo-style foragers) and Deneubourg's double bridge.
import { expect, test } from '@playwright/test';
import {
	bridges,
	choice,
	dropPebble,
	field,
	FIELD_HALF_LIFE,
	lastChoices,
	onStraightLine,
	pebbleSpot,
	runBridges,
	runField,
	scentAt,
	scentOf,
	SHORT,
	type Bridges
} from '../src/routes/ant-trails/model';

const SEEDS = [1, 2, 3, 4, 5, 6];
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('scent left alone halves in its half-life', () => {
	const f = field({ ants: 0 });
	f.scentMap[500] = 8;
	runField(f, FIELD_HALF_LIFE);
	expect(scentOf(f, 500)).toBeCloseTo(4, 6);
	runField(f, 3 * FIELD_HALF_LIFE);
	expect(scentOf(f, 500)).toBeCloseTo(1, 6);
});

test('with a scent, a trail forms and far more sugar comes home than with none', () => {
	const withScent = SEEDS.map((seed) => runField(field({ seed }), 90));
	const without = SEEDS.map((seed) => runField(field({ seed, scent: false }), 90));
	const line = (fs: ReturnType<typeof field>[]) => sum(fs.map((f) => onStraightLine(f)));
	const home = (fs: ReturnType<typeof field>[]) => sum(fs.map((f) => f.home));
	// Most of the 80 ants walk the line between nest and sugar, against a handful by chance.
	expect(line(withScent) / SEEDS.length).toBeGreaterThan(35);
	expect(line(without) / SEEDS.length).toBeLessThan(12);
	expect(home(withScent)).toBeGreaterThan(3 * home(without));
});

test('without a scent, ants that find the sugar do not help the others: the haul grows only steadily', () => {
	const f = field({ seed: 1, scent: false });
	runField(f, 60);
	const first = f.home;
	runField(f, 120);
	// The second minute brings in about as much as the first, not many times more.
	expect(f.home - first).toBeLessThan(2.5 * Math.max(first, 5));
});

test('when the sugar moves, the old trail fades and a new one forms to the new place', () => {
	let formed = 0;
	for (const seed of SEEDS) {
		const f = runField(field({ seed }), 90);
		const oldMid = { x: (120 + f.sugar.x) / 2, y: (270 + f.sugar.y) / 2 };
		f.sugar = { x: 780, y: 420 };
		runField(f, 240);
		if (onStraightLine(f) > 25) formed++;
		// Nobody carries sugar along the old line any more, so its scent has faded away.
		expect(scentAt(f, oldMid.x, oldMid.y)).toBeLessThan(1);
	}
	expect(formed).toBeGreaterThanOrEqual(SEEDS.length - 1);
});

test('the same moved sugar with a scent that never fades leaves the old trail behind as strong as ever', () => {
	const f = runField(field({ seed: 1, fade: false }), 90);
	const mid = { x: (120 + f.sugar.x) / 2, y: (270 + f.sugar.y) / 2 };
	const before = scentAt(f, mid.x, mid.y);
	f.sugar = { x: 780, y: 420 };
	runField(f, 240);
	expect(scentAt(f, mid.x, mid.y)).toBeGreaterThanOrEqual(before);
});

test('a pebble on the trail: nobody walks through it, and the sugar keeps coming home around it', () => {
	for (const seed of SEEDS) {
		const f = runField(field({ seed }), 90);
		const p = pebbleSpot(f);
		dropPebble(f, p);
		const before = f.home;
		let closest = Infinity;
		for (let s = 91; s <= 180; s++) {
			runField(f, s);
			for (let i = 0; i < f.x.length; i++)
				closest = Math.min(closest, Math.hypot(f.x[i] - p.x, f.y[i] - p.y));
		}
		expect(closest).toBeGreaterThanOrEqual(p.r);
		expect(f.home - before).toBeGreaterThan(40);
	}
});

test('the choice at a fork: no scent is a coin toss, and more scent draws more ants', () => {
	expect(choice(0, 0)).toBe(0.5);
	expect(choice(30, 30)).toBe(0.5);
	expect(choice(10, 0)).toBeGreaterThan(0.5);
	expect(choice(100, 0)).toBeGreaterThan(choice(10, 0));
	expect(choice(0, 100)).toBeCloseTo(1 - choice(100, 0), 12);
	// A few dabs hardly matter; a strong trail almost always wins.
	expect(choice(2, 0)).toBeLessThan(0.6);
	expect(choice(200, 0)).toBeGreaterThan(0.97);
});

const winner = (b: Bridges) => {
	const [a, c] = lastChoices(b, 50);
	return a > c ? 0 : 1;
};
const colonies = (o: Parameters<typeof bridges>[0], until: number, n = 40) =>
	Array.from({ length: n }, (_, i) => runBridges(bridges({ ...o, seed: i + 1 }), until));

test('two bridges the same length: the colony crowds onto one, and each wins about as often', () => {
	const runs = colonies({}, 150);
	const top = runs.filter((b) => winner(b) === 0).length;
	expect(top).toBeGreaterThan(12);
	expect(top).toBeLessThan(28);
	// Most colonies end up with a clear favourite (at least four ants in five).
	const clear = runs.filter((b) => Math.max(...lastChoices(b, 50)) >= 40).length;
	expect(clear).toBeGreaterThan(30);
});

test('a short bridge and one twice as long, offered together: the short one usually wins, fading or not', () => {
	for (const fade of [false, true]) {
		const runs = colonies({ lengths: [SHORT, 2 * SHORT], fade }, 150);
		const short = runs.filter((b) => winner(b) === 0).length;
		expect(short).toBeGreaterThan(26);
	}
});

test('ants on the short bridge get back first', () => {
	for (const b of colonies({ lengths: [SHORT, 2 * SHORT] }, 0, 10)) {
		while (b.trips[0] + b.trips[1] === 0) runBridges(b, b.time + 0.05);
		expect(b.trips).toEqual([1, 0]);
	}
});

test('a short bridge opened late: the colony stays on the long one, with or without fading', () => {
	for (const fade of [false, true]) {
		const runs = colonies({ lengths: [SHORT, 2 * SHORT], opens: [40, 0], fade }, 240, 20);
		for (const b of runs) expect(lastChoices(b, 50)[0]).toBeLessThan(10);
	}
});

test('the same colony always ends the same way', () => {
	const a = runField(field({ seed: 3 }), 30);
	const b = runField(field({ seed: 3 }), 30);
	expect([...a.x]).toEqual([...b.x]);
	const c = runBridges(bridges({ seed: 3 }), 60);
	const d = runBridges(bridges({ seed: 3 }), 60);
	expect(c.choices).toEqual(d.choices);
});
