/**
 * Reinforcement learning in a grid world: tabular Q-learning with ε-greedy
 * exploration (Watkins, 1989), recorded move by move so a scene can replay it.
 *
 * The world: a grid of squares. Each square is open floor, a wall, a reward
 * (+10), a small reward (+1) or a penalty (−10). The agent starts every
 * episode on its start square and moves up, right, down or left; a move into
 * a wall or off the edge leaves it where it is. Stepping onto a reward or a
 * penalty pays that amount and ends the episode; every other move pays
 * `stepReward` (0 on the page). An episode is also cut off after `maxSteps`
 * moves, so a world whose rewards cannot be reached still finishes.
 *
 * The learner keeps one number per square and move, Q(s, a): its estimate of
 * the total discounted reward it will collect after making move a in square s
 * and choosing well from then on. After each move s →a→ s′ paying r it nudges
 * that estimate towards what it just saw:
 *
 *   Q(s, a) ← Q(s, a) + α · (r + γ · max Q(s′, ·) − Q(s, a))
 *
 * with the bracket's max term left out when s′ ends the episode. α is the
 * learning rate, γ the discount factor. It chooses its moves ε-greedily: with
 * probability ε a random move (exploring), otherwise the move with the highest
 * Q (exploiting), ties broken at random. All estimates start at 0.
 *
 * Simplifications, stated on the page: moves are deterministic (no wind or
 * slipping), the agent sees exactly which square it is in, and the table has
 * one entry per square and move (no neural network, so nothing carries over
 * between similar squares).
 *
 * `valueIteration` computes the exact optimal values Q* of the same world by
 * repeated Bellman updates; with enough exploration, Q-learning's estimates
 * converge to them (Watkins & Dayan, 1992). The tests check both.
 *
 * Everything random comes from a seeded generator, so a run is a pure function
 * of the world, the settings and the seed.
 */
import { rng } from '#lib/draw/math.ts';

/** 0 floor, 1 wall, 2 reward (+10), 3 small reward (+1), 4 penalty (−10). */
export type Cell = 0 | 1 | 2 | 3 | 4;
export const FLOOR = 0;
export const WALL = 1;
export const REWARD = 2;
export const SMALL = 3;
export const PENALTY = 4;

/** What stepping onto a square pays. */
export const PAYOFF: Record<Cell, number> = { 0: 0, 1: 0, 2: 10, 3: 1, 4: -10 };

export interface World {
	cols: number;
	rows: number;
	/** Row-major. */
	cells: Cell[];
	/** Where every episode starts (never a wall or an ending square). */
	start: number;
}

/** Up, right, down, left (as column, row offsets). */
export const MOVES: readonly (readonly [number, number])[] = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0]
];
export const MOVE_NAMES = ['up', 'right', 'down', 'left'] as const;

export const isEnd = (w: World, s: number) =>
	w.cells[s] === REWARD || w.cells[s] === SMALL || w.cells[s] === PENALTY;

/** The square reached by move `a` from `s` (the same square if a wall or the edge is in the way). */
export function move(w: World, s: number, a: number): number {
	const c = (s % w.cols) + MOVES[a][0];
	const r = Math.floor(s / w.cols) + MOVES[a][1];
	if (c < 0 || c >= w.cols || r < 0 || r >= w.rows) return s;
	const n = r * w.cols + c;
	return w.cells[n] === WALL ? s : n;
}

export interface Settings {
	/** Learning rate α (0–1): how far each estimate moves towards the new evidence. */
	alpha: number;
	/** Discount factor γ (0–1): how much a reward one move later is worth now. */
	gamma: number;
	/** Exploration rate ε (0–1): the chance of a random move. */
	epsilon: number;
	/** Number of episodes to train for. */
	episodes: number;
	seed: number;
	/** Reward for a move that does not end the episode (default 0). */
	stepReward?: number;
	/** Moves after which an episode is cut off (default 400). */
	maxSteps?: number;
	/** Lower ε steadily from its value in the first episode to 0 in the last (default false). */
	decay?: boolean;
}

export interface Transition {
	s: number;
	a: number;
	r: number;
	/** The square the move led to. */
	next: number;
	/** Q(s, a) before and after the update. */
	before: number;
	after: number;
	/** The best estimate in the next square (0 if the episode ended there). */
	bestNext: number;
	/** A random (exploring) move rather than the best-looking one. */
	explored: boolean;
}

export interface Episode {
	/** Index of its first move in `Run.moves`. */
	first: number;
	/** Number of moves. */
	length: number;
	/** Total (undiscounted) reward collected. */
	reward: number;
	/** The kind of square it ended on, or null if it was cut off. */
	end: Cell | null;
}

export interface Run {
	world: World;
	settings: Settings;
	/** Every move of every episode, in order. */
	moves: Transition[];
	episodes: Episode[];
	/** Q at the start of each episode (and, last, at the end of training): index s·4 + a. */
	snapshots: Float64Array[];
}

/** Index of the largest entry among Q(s, ·), ties broken by `rand`. */
export function bestMove(q: ArrayLike<number>, s: number, rand: () => number): number {
	let best = -Infinity;
	let ties = 0;
	let pick = 0;
	for (let a = 0; a < 4; a++) {
		const v = q[s * 4 + a];
		if (v > best + 1e-12) {
			best = v;
			pick = a;
			ties = 1;
		} else if (Math.abs(v - best) <= 1e-12) {
			ties++;
			// Reservoir choice: each tied move is kept with equal probability.
			if (rand() * ties < 1) pick = a;
		}
	}
	return pick;
}

/** max over a of Q(s, a). */
export function bestValue(q: ArrayLike<number>, s: number): number {
	return Math.max(q[s * 4], q[s * 4 + 1], q[s * 4 + 2], q[s * 4 + 3]);
}

/** Train a fresh learner (all estimates 0) for `settings.episodes` episodes. */
export function train(world: World, settings: Settings): Run {
	const { alpha, gamma, epsilon, episodes: count, seed } = settings;
	const stepReward = settings.stepReward ?? 0;
	const maxSteps = settings.maxSteps ?? 400;
	const rand = rng(seed);
	const q = new Float64Array(world.cells.length * 4);
	const moves: Transition[] = [];
	const episodes: Episode[] = [];
	const snapshots: Float64Array[] = [];
	for (let e = 0; e < count; e++) {
		snapshots.push(q.slice());
		const eps = settings.decay ? epsilonAt(settings, e) : epsilon;
		const first = moves.length;
		let s = world.start;
		let reward = 0;
		let end: Cell | null = null;
		for (let n = 0; n < maxSteps; n++) {
			const explored = rand() < eps;
			const a = explored ? Math.floor(rand() * 4) : bestMove(q, s, rand);
			const next = move(world, s, a);
			const done = isEnd(world, next);
			const r = done ? PAYOFF[world.cells[next]] : stepReward;
			const bestNext = done ? 0 : bestValue(q, next);
			const before = q[s * 4 + a];
			const after = before + alpha * (r + gamma * bestNext - before);
			q[s * 4 + a] = after;
			moves.push({ s, a, r, next, before, after, bestNext, explored });
			reward += r;
			s = next;
			if (done) {
				end = world.cells[next];
				break;
			}
		}
		episodes.push({ first, length: moves.length - first, reward, end });
	}
	snapshots.push(q.slice());
	return { world, settings, moves, episodes, snapshots };
}

/** The exploration rate in episode `e` (0-based). */
export const epsilonAt = (s: Settings, e: number) =>
	s.decay && s.episodes > 1 ? s.epsilon * (1 - e / (s.episodes - 1)) : s.epsilon;

/** The learner's estimates after the first `k` moves of the run (0 ≤ k ≤ moves.length). */
export function qAt(run: Run, k: number): Float64Array {
	const kk = Math.max(0, Math.min(run.moves.length, Math.floor(k)));
	const e = episodeAt(run, kk);
	if (e >= run.episodes.length) return run.snapshots[run.snapshots.length - 1].slice();
	const q = run.snapshots[e].slice();
	for (let i = run.episodes[e].first; i < kk; i++) {
		const m = run.moves[i];
		q[m.s * 4 + m.a] = m.after;
	}
	return q;
}

/** The episode that move `k` belongs to (episodes.length once training is over). */
export function episodeAt(run: Run, k: number): number {
	const eps = run.episodes;
	if (k >= run.moves.length) return eps.length;
	let lo = 0;
	let hi = eps.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (eps[mid].first <= k) lo = mid;
		else hi = mid - 1;
	}
	return lo;
}

/**
 * The exact optimal values Q*(s, a) of the world, by value iteration:
 * Q(s, a) = r + γ · max Q(s′, ·), repeated until nothing changes.
 */
export function valueIteration(world: World, gamma: number, stepReward = 0): Float64Array {
	const n = world.cells.length;
	const q = new Float64Array(n * 4);
	for (let sweep = 0; sweep < 10_000; sweep++) {
		let change = 0;
		for (let s = 0; s < n; s++) {
			if (world.cells[s] === WALL || isEnd(world, s)) continue;
			for (let a = 0; a < 4; a++) {
				const next = move(world, s, a);
				const v = isEnd(world, next)
					? PAYOFF[world.cells[next]]
					: stepReward + gamma * bestValue(q, next);
				change = Math.max(change, Math.abs(v - q[s * 4 + a]));
				q[s * 4 + a] = v;
			}
		}
		if (change < 1e-12) break;
	}
	return q;
}

/** The squares visited by always taking the best-looking move from `from` (ties: first move), until an end, a repeat or `limit` moves. */
export function greedyPath(world: World, q: ArrayLike<number>, from = world.start, limit = 100) {
	const path = [from];
	const seen = new Set(path);
	let s = from;
	for (let n = 0; n < limit && !isEnd(world, s); n++) {
		const v = bestValue(q, s);
		let a = 0;
		while (q[s * 4 + a] !== v) a++;
		if (v === 0 && q[s * 4] === 0 && q[s * 4 + 1] === 0 && q[s * 4 + 2] === 0 && q[s * 4 + 3] === 0)
			break; // nothing learnt here yet
		s = move(world, s, a);
		path.push(s);
		if (seen.has(s)) break;
		seen.add(s);
	}
	return path;
}

/** Fewest moves from `from` to each square (Infinity if unreachable); ending squares are not passed through. */
export function distances(world: World, from = world.start): number[] {
	const d = new Array<number>(world.cells.length).fill(Infinity);
	d[from] = 0;
	const queue = [from];
	for (let i = 0; i < queue.length; i++) {
		const s = queue[i];
		if (isEnd(world, s)) continue;
		for (let a = 0; a < 4; a++) {
			const n = move(world, s, a);
			if (d[n] === Infinity) {
				d[n] = d[s] + 1;
				queue.push(n);
			}
		}
	}
	return d;
}

// ---- maps -------------------------------------------------------------------------

const LETTERS: Record<string, Cell> = { '.': 0, '#': 1, R: 2, r: 3, X: 4, S: 0 };
const CHARS = ['.', '#', 'R', 'r', 'X'];

/** A map from rows of characters: . floor, # wall, R reward, r small reward, X penalty, S start. */
export function parseRows(rows: string[]): World {
	const cells: Cell[] = [];
	let start = 0;
	rows.forEach((line, r) =>
		[...line].forEach((ch, c) => {
			if (ch === 'S') start = r * line.length + c;
			cells.push(LETTERS[ch] ?? 0);
		})
	);
	return { cols: rows[0].length, rows: rows.length, cells, start };
}

/** "cols,rows,start,cells" (cells as digits), for storing an edited map in a control value. */
export const serializeWorld = (w: World) => `${w.cols},${w.rows},${w.start},${w.cells.join('')}`;

export function parseWorld(v: unknown): World | null {
	if (typeof v !== 'string') return null;
	const m = /^(\d+),(\d+),(\d+),([0-4]+)$/.exec(v);
	if (!m) return null;
	const cols = Number(m[1]);
	const rows = Number(m[2]);
	const start = Number(m[3]);
	if (m[4].length !== cols * rows || start >= cols * rows) return null;
	const cells = [...m[4]].map(Number) as Cell[];
	if (cells[start] !== FLOOR) return null;
	return { cols, rows, cells, start };
}

export const worldRows = (w: World) =>
	Array.from({ length: w.rows }, (_, r) =>
		w.cells
			.slice(r * w.cols, (r + 1) * w.cols)
			.map((c, i) => (r * w.cols + i === w.start ? 'S' : CHARS[c]))
			.join('')
	);

/** The page's maps (10 × 6). */
export const MAPS: Record<string, World> = {
	// A reward behind a wall, with two pits along the way.
	maze: parseRows([
		'..........',
		'..#....X..',
		'S.#..#....',
		'..#..#..R.',
		'.....#X...',
		'..........'
	]),
	// A small reward a few squares to the left, a big one further away to the right.
	choice: parseRows([
		'..........',
		'..........',
		'r...S.....',
		'..........',
		'..........',
		'.........R'
	]),
	// An open field for the reader to paint.
	open: parseRows([
		'..........',
		'..........',
		'S.........',
		'..........',
		'........R.',
		'..........'
	])
};

/** The page's default settings, and the length of a run. */
export const DEFAULTS = { alpha: 0.5, gamma: 0.9, epsilon: 0.1, episodes: 300, seed: 9 };
