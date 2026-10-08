// Checks the Q-learning model behind the reinforcement-learning explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import {
	DEFAULTS,
	MAPS,
	PENALTY,
	REWARD,
	SMALL,
	bestValue,
	distances,
	episodeAt,
	greedyPath,
	move,
	parseRows,
	parseWorld,
	qAt,
	serializeWorld,
	train,
	valueIteration,
	type Cell,
	type Run,
	type World
} from '../src/routes/reinforcement-learning/qlearning';

const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const goal = (w: World, kind: Cell = REWARD) => w.cells.indexOf(kind);
const endsOn = (w: World, run: Run) => w.cells[greedyPath(w, run.snapshots.at(-1)!).at(-1)!];
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test('moves: walls and edges leave the agent in place', () => {
	const w = parseRows(['S#.', '...']);
	expect(move(w, 0, 1)).toBe(0); // right into the wall
	expect(move(w, 0, 0)).toBe(0); // up off the edge
	expect(move(w, 0, 2)).toBe(3); // down
	expect(move(w, 3, 1)).toBe(4);
});

test('value iteration satisfies the Bellman equation: Q* = r + γ · max Q*(next)', () => {
	const w = MAPS.maze;
	const q = valueIteration(w, 0.9);
	const d = distances(w);
	// A square d moves from the reward (with no pit in between) is worth 10 · γ^(d − 1).
	expect(d[goal(w)]).toBe(13);
	expect(bestValue(q, w.start)).toBeCloseTo(10 * 0.9 ** 12, 10);
	expect(10 * 0.9 ** 12).toBeCloseTo(2.82, 2);
	expect(10 * 0.5 ** 12).toBeCloseTo(0.002, 3);
	// Next to the reward 10, then 9, then 8.1.
	expect(bestValue(q, 3 * 10 + 7)).toBeCloseTo(10, 10);
	expect(bestValue(q, 3 * 10 + 6)).toBeCloseTo(9, 10);
	expect(bestValue(q, 2 * 10 + 6)).toBeCloseTo(8.1, 10);
	for (let s = 0; s < w.cells.length; s++) {
		if (w.cells[s] !== 0) continue;
		for (let a = 0; a < 4; a++) {
			const n = move(w, s, a);
			const target =
				w.cells[n] === REWARD ? 10 : w.cells[n] === PENALTY ? -10 : 0.9 * bestValue(q, n);
			expect(q[s * 4 + a]).toBeCloseTo(target, 9);
		}
	}
});

test('the first credit: 0.5 × 10 = 5, then 0.5 × (0 + 0.9 × 5) = 2.25', () => {
	const run = train(MAPS.maze, DEFAULTS);
	const first = run.moves.find((m) => m.r === 10)!;
	expect(first.before).toBe(0);
	expect(first.after).toBe(5);
	// No move earns credit before the first reward: every estimate is still 0 until then.
	const i = run.moves.indexOf(first);
	expect(run.moves.slice(0, i).every((m) => m.after <= 0)).toBe(true);
	const passed = run.moves.find((m) => m.r === 0 && m.bestNext > 0)!;
	expect(passed.bestNext).toBe(5);
	expect(passed.after).toBeCloseTo(2.25, 12);
	// With a learning rate of 1 the estimate jumps straight to the target.
	const fast = train(MAPS.maze, { ...DEFAULTS, alpha: 1 });
	expect(fast.moves.find((m) => m.r === 10)!.after).toBe(10);
});

test('Q-learning converges to the exact values and the shortest route on the maze', () => {
	const w = MAPS.maze;
	const run = train(w, DEFAULTS);
	const q = run.snapshots.at(-1)!;
	const exact = valueIteration(w, 0.9);
	expect(bestValue(q, w.start)).toBeCloseTo(bestValue(exact, w.start), 3);
	const path = greedyPath(w, q);
	expect(path.length - 1).toBe(13);
	expect(w.cells[path.at(-1)!]).toBe(REWARD);
	// Along the learnt route every estimate matches Q*.
	for (const s of path.slice(0, -1)) expect(bestValue(q, s)).toBeCloseTo(bestValue(exact, s), 3);
	// Most runs find the 13-move route; a few settle on a 15-move one (ε = 0.1 explores little).
	const lengths = seeds(30).map(
		(seed) => greedyPath(w, train(w, { ...DEFAULTS, seed }).snapshots.at(-1)!).length - 1
	);
	expect(lengths.filter((n) => n === 13).length).toBeGreaterThanOrEqual(25);
	expect(lengths.every((n) => n === 13 || n === 15)).toBe(true);
});

test('limits: α = 0 learns nothing; γ = 0 values only the very next reward', () => {
	const frozen = train(MAPS.maze, { ...DEFAULTS, alpha: 0, episodes: 20 });
	expect(frozen.snapshots.at(-1)!.every((v) => v === 0)).toBe(true);
	const w = MAPS.maze;
	const myopic = train(w, { ...DEFAULTS, gamma: 0 }).snapshots.at(-1)!;
	for (let s = 0; s < w.cells.length; s++)
		for (let a = 0; a < 4; a++) {
			const n = move(w, s, a);
			if (w.cells[n] !== REWARD && w.cells[n] !== PENALTY) expect(myopic[s * 4 + a]).toBe(0);
		}
	expect(Math.max(...myopic)).toBeGreaterThan(9);
});

test('early episodes wander, late ones take about 15 moves (shortest 13)', () => {
	const w = MAPS.maze;
	const firsts: number[] = [];
	const pits: number[] = [];
	const after50: number[] = [];
	const late: number[] = [];
	for (const seed of seeds(50)) {
		const run = train(w, { ...DEFAULTS, seed });
		firsts.push(run.episodes[0].length);
		pits.push(run.episodes.slice(0, 20).filter((e) => e.end === PENALTY).length);
		after50.push(avg(run.episodes.slice(50, 100).map((e) => e.length)));
		late.push(avg(run.episodes.slice(200).map((e) => e.length)));
	}
	firsts.sort((a, b) => a - b);
	// "The first episode usually takes well over a hundred moves."
	expect(firsts[25]).toBeGreaterThan(100);
	// "A third of the first twenty episodes end in a pit" (on average).
	expect(avg(pits)).toBeGreaterThan(5);
	expect(avg(pits)).toBeLessThan(9);
	// "After about fifty episodes it takes about 15 moves; never quite 13 every time."
	expect(avg(after50)).toBeGreaterThan(13.5);
	expect(avg(after50)).toBeLessThan(16.5);
	expect(avg(late)).toBeGreaterThan(13.5);
	expect(avg(late)).toBeLessThan(16);
	// A purely random walker (ε = 1) does not improve.
	const random = train(w, { ...DEFAULTS, epsilon: 1 });
	expect(avg(random.episodes.slice(200).map((e) => e.length))).toBeGreaterThan(60);
});

test('exploration: too little settles for +1, too much never uses what it learnt', () => {
	const w = MAPS.choice;
	const d = distances(w);
	expect(d[goal(w, SMALL)]).toBe(4);
	expect(d[goal(w)]).toBe(8);
	// The +10 is worth more from the start: 10 · 0.9⁷ ≈ 4.8 against 1 · 0.9³ ≈ 0.73.
	const exact = valueIteration(w, 0.9);
	expect(bestValue(exact, w.start)).toBeCloseTo(10 * 0.9 ** 7, 10);
	expect(w.cells[greedyPath(w, exact).at(-1)!]).toBe(REWARD);
	const stats = (epsilon: number, decay = false) => {
		let big = 0;
		const late: number[] = [];
		for (const seed of seeds(30)) {
			const run = train(w, { ...DEFAULTS, seed, epsilon, decay });
			if (endsOn(w, run) === REWARD) big++;
			late.push(avg(run.episodes.slice(250).map((e) => e.reward)));
		}
		return { big, late: avg(late) };
	};
	const none = stats(0);
	const little = stats(0.1);
	const lots = stats(0.7);
	const always = stats(1);
	const curious = stats(1, true);
	// "With little or no exploration it settles for the +1 in most runs" (≥ 4 in 5).
	expect(none.big).toBeLessThanOrEqual(6);
	expect(little.big).toBeLessThanOrEqual(6);
	// "Exploring 70% of the time it finds the +10 in almost every run."
	expect(lots.big).toBe(28);
	// "Always exploring: it learns the right route but collects less than half of 10 per episode."
	expect(always.big).toBe(30);
	expect(always.late).toBeLessThan(5);
	expect(always.late).toBeGreaterThan(3.5); // "about 4"
	// "Start curious, settle down: it finds the +10 and in the end takes it every time."
	expect(curious.big).toBe(30);
	expect(curious.late).toBe(10);
	expect(curious.late).toBeGreaterThan(lots.late);
	// The page's own run (seed 9) shows the same.
	expect(endsOn(w, train(w, DEFAULTS))).toBe(SMALL);
	expect(endsOn(w, train(w, { ...DEFAULTS, epsilon: 0.7 }))).toBe(REWARD);
	expect(endsOn(w, train(w, { ...DEFAULTS, epsilon: 1 }))).toBe(REWARD);
	expect(endsOn(w, train(w, { ...DEFAULTS, epsilon: 1, decay: true }))).toBe(REWARD);
});

test('a low discount prefers the near +1 to the far +10', () => {
	const w = MAPS.choice;
	// 1 · 0.5³ = 0.125 against 10 · 0.5⁷ ≈ 0.078.
	const q = valueIteration(w, 0.5);
	expect(w.cells[greedyPath(w, q).at(-1)!]).toBe(SMALL);
	expect(w.cells[greedyPath(w, valueIteration(w, 0.9)).at(-1)!]).toBe(REWARD);
});

test('cliff walking (Sutton & Barto, example 6.6): Q-learning learns the edge route', () => {
	// 4 × 12, start bottom-left, goal bottom-right, the cliff between; −1 per move, γ = 1.
	const w = parseRows(['............', '............', '............', 'SXXXXXXXXXXR']);
	const run = train(w, {
		alpha: 0.5,
		gamma: 1,
		epsilon: 0.1,
		episodes: 500,
		seed: 3,
		stepReward: -1
	});
	const path = greedyPath(w, run.snapshots.at(-1)!);
	expect(path.length - 1).toBe(13);
	// It runs right along the edge of the cliff (row 3 of 4).
	expect(path.slice(1, -1).every((s) => Math.floor(s / 12) === 2)).toBe(true);
});

test('replay: qAt rebuilds the estimates at any move', () => {
	const run = train(MAPS.maze, DEFAULTS);
	expect(qAt(run, run.moves.length)).toEqual(run.snapshots.at(-1));
	for (const e of [0, 1, 7, 150]) {
		expect(qAt(run, run.episodes[e].first)).toEqual(run.snapshots[e]);
		expect(episodeAt(run, run.episodes[e].first)).toBe(e);
		expect(episodeAt(run, run.episodes[e].first + run.episodes[e].length - 1)).toBe(e);
	}
	const k = run.episodes[3].first + 5;
	const m = run.moves[k - 1];
	expect(qAt(run, k)[m.s * 4 + m.a]).toBe(m.after);
	// Deterministic: same seed, same run.
	expect(train(MAPS.maze, DEFAULTS).moves.length).toBe(run.moves.length);
});

test('maps survive being stored in a control', () => {
	for (const w of Object.values(MAPS)) expect(parseWorld(serializeWorld(w))).toEqual(w);
	expect(parseWorld('3,2,1,000')).toBeNull();
	expect(parseWorld('3,1,1,010')).toBeNull(); // start on a wall
});

test('in an open field it often settles for a slightly longer route; exploring more fixes it', () => {
	const w = MAPS.open;
	const shortest = distances(w)[goal(w)];
	expect(shortest).toBe(10);
	const found = (settings: Partial<typeof DEFAULTS> & { decay?: boolean }) =>
		seeds(20).filter(
			(seed) =>
				greedyPath(w, train(w, { ...DEFAULTS, ...settings, seed }).snapshots.at(-1)!).length - 1 ===
				shortest
		).length;
	const usual = found({});
	expect(usual).toBeGreaterThanOrEqual(5);
	expect(usual).toBeLessThanOrEqual(15);
	expect(found({ epsilon: 1, decay: true })).toBeGreaterThanOrEqual(18);
	// The page's own run finds the shortest route.
	expect(greedyPath(w, train(w, DEFAULTS).snapshots.at(-1)!).length - 1).toBe(shortest);
});
