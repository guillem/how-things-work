/**
 * The prisoner's dilemma and the evolution of cooperation: the one-shot game, repeated games
 * between classic strategies, Axelrod's round-robin tournament (Axelrod 1984, "The Evolution of
 * Cooperation"), a population whose shares grow with their scores (discrete-generation
 * replicator dynamics), mistaken moves (noise), and Nowak & May's (1992) spatial game on a grid.
 *
 * Everything random is drawn from a seeded generator, so every run is reproducible.
 */

export type Move = 'C' | 'D';

/** The four payoffs, points to the row player: T(emptation), R(eward), P(unishment), S(ucker). */
export interface Payoffs {
	T: number;
	R: number;
	P: number;
	S: number;
}

/** Axelrod's tournament payoffs. */
export const CLASSIC: Payoffs = { T: 5, R: 3, P: 1, S: 0 };

/** Points to a player who plays `me` against `them`. */
export function payoff(p: Payoffs, me: Move, them: Move): number {
	if (me === 'C') return them === 'C' ? p.R : p.S;
	return them === 'C' ? p.T : p.P;
}

/** A prisoner's dilemma: temptation > reward > punishment > sucker's payoff. */
export function isDilemma(p: Payoffs): boolean {
	return p.T > p.R && p.R > p.P && p.P > p.S;
}

/**
 * In a repeated game, cooperating every round must pay more than taking turns at exploiting
 * each other (2R > T + S); otherwise alternating C and D is the best way to play together.
 */
export function rewardsCooperation(p: Payoffs): boolean {
	return 2 * p.R > p.T + p.S;
}

/** The move that earns more against a given move of the other player, in a single game. */
export function bestReply(p: Payoffs, them: Move): Move {
	return payoff(p, 'D', them) > payoff(p, 'C', them) ? 'D' : 'C';
}

// ---- random numbers ------------------------------------------------------------------------

/** mulberry32: a small, fast seeded generator returning numbers in [0, 1). */
export function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ---- strategies ------------------------------------------------------------------------------

export type StrategyId = 'alld' | 'allc' | 'tft' | 'grim' | 'random' | 'tf2t' | 'gtft';

interface Context {
	mine: readonly Move[];
	theirs: readonly Move[];
	rand: () => number;
	payoffs: Payoffs;
}

export interface Strategy {
	id: StrategyId;
	name: string;
	/** One line on how it plays. */
	rule: string;
	/** Never the first to defect. */
	nice: boolean;
	decide: (c: Context) => Move;
}

/**
 * How often generous tit for tat forgives a defection: the largest generosity that still
 * doesn't let always-defect invade, min(1 − (T − R)/(R − S), (R − P)/(T − P)) (Nowak &
 * Sigmund 1992); 1/3 for Axelrod's payoffs.
 */
export function generosity(p: Payoffs): number {
	const g = Math.min(1 - (p.T - p.R) / (p.R - p.S), (p.R - p.P) / (p.T - p.P));
	return Number.isFinite(g) ? Math.max(0, Math.min(1, g)) : 0;
}

const last = (h: readonly Move[]) => h[h.length - 1];

export const STRATEGIES: readonly Strategy[] = [
	{
		id: 'tft',
		name: 'Tit for tat',
		rule: 'cooperates first, then copies your last move',
		nice: true,
		decide: ({ theirs }) => (theirs.length === 0 ? 'C' : last(theirs))
	},
	{
		id: 'alld',
		name: 'Always cheat',
		rule: 'cheats every round',
		nice: false,
		decide: () => 'D'
	},
	{
		id: 'allc',
		name: 'Always cooperate',
		rule: 'cooperates every round',
		nice: true,
		decide: () => 'C'
	},
	{
		id: 'grim',
		name: 'Grudger',
		rule: 'cooperates until you cheat once, then cheats forever',
		nice: true,
		decide: ({ theirs }) => (theirs.includes('D') ? 'D' : 'C')
	},
	{
		id: 'random',
		name: 'Random',
		rule: 'flips a coin every round',
		nice: false,
		decide: ({ rand }) => (rand() < 0.5 ? 'C' : 'D')
	},
	{
		id: 'tf2t',
		name: 'Tit for two tats',
		rule: 'cheats only after you cheat twice in a row',
		nice: true,
		decide: ({ theirs }) =>
			theirs.length >= 2 && last(theirs) === 'D' && theirs[theirs.length - 2] === 'D' ? 'D' : 'C'
	},
	{
		id: 'gtft',
		name: 'Generous tit for tat',
		rule: 'like tit for tat, but forgives a cheat one time in three',
		nice: true,
		decide: ({ theirs, rand, payoffs }) =>
			theirs.length === 0 || last(theirs) === 'C' || rand() < generosity(payoffs) ? 'C' : 'D'
	}
];

export const strategy = (id: StrategyId): Strategy =>
	STRATEGIES.find((s) => s.id === id) ?? STRATEGIES[0];

export const ALL_IDS: readonly StrategyId[] = STRATEGIES.map((s) => s.id);

// ---- one repeated game -------------------------------------------------------------------

export interface MatchOptions {
	rounds: number;
	payoffs?: Payoffs;
	/** Chance that a player's move comes out as the opposite of what it meant (0–1). */
	noise?: number;
	seed?: number;
}

export interface Match {
	a: Move[];
	b: Move[];
	/** Each player's points round by round. */
	pa: number[];
	pb: number[];
	scoreA: number;
	scoreB: number;
	/** Rounds in which a move came out wrong (player 0 or 1). */
	slips: { round: number; player: 0 | 1 }[];
}

export function playMatch(a: StrategyId, b: StrategyId, opts: MatchOptions): Match {
	const payoffs = opts.payoffs ?? CLASSIC;
	const noise = opts.noise ?? 0;
	const rand = rng(opts.seed ?? 1);
	const sa = strategy(a);
	const sb = strategy(b);
	const m: Match = { a: [], b: [], pa: [], pb: [], scoreA: 0, scoreB: 0, slips: [] };
	for (let r = 0; r < opts.rounds; r++) {
		let x = sa.decide({ mine: m.a, theirs: m.b, rand, payoffs });
		let y = sb.decide({ mine: m.b, theirs: m.a, rand, payoffs });
		if (noise > 0 && rand() < noise) {
			x = x === 'C' ? 'D' : 'C';
			m.slips.push({ round: r, player: 0 });
		}
		if (noise > 0 && rand() < noise) {
			y = y === 'C' ? 'D' : 'C';
			m.slips.push({ round: r, player: 1 });
		}
		m.a.push(x);
		m.b.push(y);
		const px = payoff(payoffs, x, y);
		const py = payoff(payoffs, y, x);
		m.pa.push(px);
		m.pb.push(py);
		m.scoreA += px;
		m.scoreB += py;
	}
	return m;
}

// ---- the round-robin tournament ------------------------------------------------------------

export interface TournamentOptions {
	rounds: number;
	payoffs?: Payoffs;
	noise?: number;
	/** Games per pairing, averaged (chance strategies and noise make single games vary). */
	repeats?: number;
	seed?: number;
}

export interface Tournament {
	ids: StrategyId[];
	/** perRound[i][j]: i's average points per round against j (j = i: against its twin). */
	perRound: number[][];
	/** Each entrant's average points per round over all its games. */
	score: number[];
	/** Entrant indices, best first. */
	ranking: number[];
	/** wins[i]: games in which i scored more than its opponent (twins excluded). */
	wins: number[];
}

/**
 * Every entrant plays every other, and a copy of itself, as Axelrod's did: `repeats` games of
 * `rounds` rounds per pairing.
 */
export function tournament(ids: readonly StrategyId[], opts: TournamentOptions): Tournament {
	const n = ids.length;
	const repeats = opts.repeats ?? 10;
	const perRound = ids.map(() => ids.map(() => 0));
	const wins = ids.map(() => 0);
	let seed = opts.seed ?? 1984;
	for (let i = 0; i < n; i++) {
		for (let j = i; j < n; j++) {
			let si = 0;
			let sj = 0;
			for (let k = 0; k < repeats; k++) {
				const m = playMatch(ids[i], ids[j], { ...opts, seed: seed++ });
				si += m.scoreA;
				sj += m.scoreB;
				if (i !== j && m.scoreA > m.scoreB) wins[i]++;
				if (i !== j && m.scoreB > m.scoreA) wins[j]++;
			}
			const games = repeats * opts.rounds;
			if (i === j) {
				perRound[i][i] = (si + sj) / (2 * games);
			} else {
				perRound[i][j] = si / games;
				perRound[j][i] = sj / games;
			}
		}
	}
	const score = perRound.map((row) => row.reduce((a, b) => a + b, 0) / n);
	const ranking = ids.map((_, i) => i).sort((x, y) => score[y] - score[x] || x - y);
	return { ids: [...ids], perRound, score, ranking, wins };
}

// ---- evolution: shares grow with score -----------------------------------------------------

export interface Evolution {
	ids: StrategyId[];
	/** shares[g][i]: strategy i's share of the population in generation g (they sum to 1). */
	shares: number[][];
	/** Average points per round of each strategy in each generation. */
	fitness: number[][];
}

/**
 * Discrete generations: everyone meets everyone (in proportion to the shares), and a
 * strategy's share in the next generation is its share times its average score, divided by
 * the population's average score. Strategies whose players score above the average spread;
 * those below shrink.
 */
export function evolve(t: Tournament, start: readonly number[], generations: number): Evolution {
	const sum0 = start.reduce((a, b) => a + b, 0);
	let x = start.map((v) => v / sum0);
	const shares = [x];
	const fitness: number[][] = [];
	for (let g = 0; g <= generations; g++) {
		const f = x.map((_, i) => t.perRound[i].reduce((a, m, j) => a + m * x[j], 0));
		fitness.push(f);
		if (g === generations) break;
		const mean = x.reduce((a, xi, i) => a + xi * f[i], 0);
		if (mean <= 0) {
			shares.push(x);
			continue;
		}
		const next = x.map((xi, i) => (xi * f[i]) / mean);
		// drop shares that have fallen below one player in a billion
		const kept = next.map((v) => (v < 1e-9 ? 0 : v));
		const s = kept.reduce((a, b) => a + b, 0);
		x = kept.map((v) => v / s);
		shares.push(x);
	}
	return { ids: [...t.ids], shares, fitness };
}

// ---- Nowak & May: the game on a grid -------------------------------------------------------

/**
 * Nowak & May (1992), "Evolutionary games and spatial chaos", Nature 359, 826–829. Every cell of
 * a square grid (wrapping round at the edges) is a cooperator or a defector and plays the
 * one-shot game with its eight neighbours and itself, with R = 1, T = b, S = P = 0. Then every
 * cell, all at once, takes the strategy of the highest scorer among those nine (itself
 * included). No memory, no repeated games: only the neighbourhood.
 */
export interface Grid {
	size: number;
	/** cells[k] = 1 for a cooperator, 0 for a defector. */
	cells: Uint8Array;
}

export function randomGrid(size: number, cooperators: number, seed = 92): Grid {
	const rand = rng(seed);
	const cells = new Uint8Array(size * size);
	for (let k = 0; k < cells.length; k++) cells[k] = rand() < cooperators ? 1 : 0;
	return { size, cells };
}

/** All cooperators except one defector in the middle (Nowak & May's kaleidoscope). */
export function oneDefector(size: number): Grid {
	const cells = new Uint8Array(size * size).fill(1);
	const c = Math.floor(size / 2);
	cells[c * size + c] = 0;
	return { size, cells };
}

const NEIGHBOURS = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[0, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1]
] as const;

/** One generation of the spatial game with temptation `b`. */
export function gridStep(g: Grid, b: number): Grid {
	const { size, cells } = g;
	const at = (x: number, y: number) => ((y + size) % size) * size + ((x + size) % size);
	const score = new Float64Array(cells.length);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			let c = 0;
			for (const [dx, dy] of NEIGHBOURS) c += cells[at(x + dx, y + dy)];
			// a cooperator gets 1 from each cooperator (itself included); a defector b from each
			score[y * size + x] = cells[y * size + x] ? c : b * c;
		}
	}
	const next = new Uint8Array(cells.length);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const k = y * size + x;
			let best = k;
			for (const [dx, dy] of NEIGHBOURS) {
				const n = at(x + dx, y + dy);
				if (score[n] > score[best]) best = n;
			}
			next[k] = cells[best];
		}
	}
	return { size, cells: next };
}

/** The grid's generations 0…`generations`. */
export function gridRun(start: Grid, b: number, generations: number): Grid[] {
	const out = [start];
	for (let i = 0; i < generations; i++) out.push(gridStep(out[i], b));
	return out;
}

export const cooperatorShare = (g: Grid) => g.cells.reduce((a, c) => a + c, 0) / g.cells.length;
