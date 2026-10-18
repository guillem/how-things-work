/**
 * Connect Four (7 columns × 6 rows), searched a fixed number of moves ahead
 * by minimax, with or without alpha-beta pruning, and the positions at the
 * end of the look-ahead scored by a rule of thumb built from features.
 *
 * A game is the list of columns played (0–6, left to right), written as a
 * string of digits ("3324"); the first player is "red", the second "yellow".
 * Scores are from the side to move (negamax): a win is worth WIN minus the
 * number of moves it takes, so the search prefers the quickest win and the
 * slowest loss; any score of magnitude > WIN − 100 is a forced result the
 * search has seen to the end, the rest are the rule of thumb's estimates.
 *
 * Facts quoted on the page (sources in docs/DATA-SOURCES.md): the first
 * player wins with perfect play, by starting in the centre column (James D.
 * Allen and Victor Allis, independently, 1988); 4,531,985,219,092 positions
 * can arise (Edelkamp & Kissmann 2008; OEIS A212693).
 */

export const COLS = 7;
export const ROWS = 6;
export const WIN = 1_000_000;
/** Scores above this are forced wins (below its negative, forced losses). */
export const FORCED = WIN - 100;
/** Centre-first: the order in which every search tries the columns. */
export const ORDER = [3, 2, 4, 1, 5, 0, 6] as const;

/** Points for each feature of a position, counted for the side to move minus the opponent. */
export interface Rule {
	/** Per disc in the centre column. */
	centre: number;
	/** Per line of four holding two of one's discs and two empty squares. */
	two: number;
	/** Per line of four holding three of one's discs and one empty square. */
	three: number;
}

/** The page's own rule. */
export const PAGE_RULE: Rule = { centre: 3, two: 2, three: 5 };
/** No rule of thumb at all: only a finished game scores. */
export const NO_RULE: Rule = { centre: 0, two: 0, three: 0 };

/** The 69 lines of four squares, as indices `col * ROWS + row`. */
export const WINDOWS: readonly (readonly number[])[] = (() => {
	const w: number[][] = [];
	const at = (c: number, r: number) => c * ROWS + r;
	for (let c = 0; c < COLS; c++)
		for (let r = 0; r < ROWS; r++)
			for (const [dc, dr] of [
				[1, 0],
				[0, 1],
				[1, 1],
				[1, -1]
			]) {
				const ec = c + 3 * dc;
				const er = r + 3 * dr;
				if (ec < 0 || ec >= COLS || er < 0 || er >= ROWS) continue;
				w.push([0, 1, 2, 3].map((k) => at(c + k * dc, r + k * dr)));
			}
	return w;
})();
/** The same lines flattened, four indices each, for the rule of thumb's inner loop. */
const FLAT = Uint8Array.from(WINDOWS.flat());

/** A position that can be played forward and taken back (for the search). */
export class Position {
	/** 0 empty, 1 red, 2 yellow; index `col * ROWS + row`, row 0 at the bottom. */
	readonly cells = new Uint8Array(COLS * ROWS);
	readonly heights = new Uint8Array(COLS);
	moves: number[] = [];
	/** Set when the last move completed four in a row. */
	won = false;

	static from(game: string): Position {
		const p = new Position();
		for (const ch of game) {
			const c = Number(ch);
			if (!p.canPlay(c)) throw new Error(`illegal move ${ch} in ${game}`);
			p.play(c);
		}
		return p;
	}

	get ply() {
		return this.moves.length;
	}
	/** 1 (red) or 2 (yellow): who moves next. */
	get toMove() {
		return (this.moves.length % 2) + 1;
	}
	get full() {
		return this.moves.length === COLS * ROWS;
	}
	get over() {
		return this.won || this.full;
	}
	canPlay(c: number) {
		return c >= 0 && c < COLS && this.heights[c] < ROWS && !this.won;
	}
	play(c: number) {
		const r = this.heights[c];
		const who = this.toMove;
		this.cells[c * ROWS + r] = who;
		this.heights[c] = r + 1;
		this.moves.push(c);
		this.won = this.fourThrough(c, r, who);
	}
	undo() {
		const c = this.moves.pop()!;
		const r = --this.heights[c];
		this.cells[c * ROWS + r] = 0;
		this.won = false;
	}
	at(c: number, r: number) {
		return c < 0 || c >= COLS || r < 0 || r >= ROWS ? -1 : this.cells[c * ROWS + r];
	}
	/** Does the disc at (c, r) complete four in a row? Only the lines through it can. */
	private fourThrough(c: number, r: number, who: number) {
		for (const [dc, dr] of [
			[1, 0],
			[0, 1],
			[1, 1],
			[1, -1]
		]) {
			let n = 1;
			for (let k = 1; this.at(c + k * dc, r + k * dr) === who; k++) n++;
			for (let k = 1; this.at(c - k * dc, r - k * dr) === who; k++) n++;
			if (n >= 4) return true;
		}
		return false;
	}
	/** The four squares of a completed line (indices), or null. */
	winningLine(): number[] | null {
		for (const w of WINDOWS) {
			const v = this.cells[w[0]];
			if (v && w.every((i) => this.cells[i] === v)) return [...w];
		}
		return null;
	}
	get game() {
		return this.moves.join('');
	}
}

/** The rule of thumb's score of a position, for the side to move. */
export function evaluate(p: Position, rule: Rule): number {
	const me = p.toMove;
	let s = 0;
	if (rule.centre) {
		for (let r = 0; r < ROWS; r++) {
			const v = p.cells[3 * ROWS + r];
			if (v) s += v === me ? rule.centre : -rule.centre;
		}
	}
	if (rule.two || rule.three) {
		const cells = p.cells;
		for (let k = 0; k < FLAT.length; k += 4) {
			let mine = 0;
			let theirs = 0;
			for (let j = k; j < k + 4; j++) {
				const v = cells[FLAT[j]];
				if (v === me) mine++;
				else if (v) theirs++;
			}
			if (theirs === 0) {
				if (mine === 3) s += rule.three;
				else if (mine === 2) s += rule.two;
			} else if (mine === 0) {
				if (theirs === 3) s -= rule.three;
				else if (theirs === 2) s -= rule.two;
			}
		}
	}
	return s;
}

export interface SearchOptions {
	depth: number;
	prune: boolean;
	rule?: Rule;
	/** Stop after this many positions (the answer is then the best found so far). */
	budget?: number;
}

/** What the search found for one of the moves at the root. */
export interface RootMove {
	col: number;
	/** The mover's score of this move; under pruning, an upper bound when `bound` is 'upper'. */
	score: number;
	bound: 'exact' | 'upper';
	/** Positions examined below this move (itself included). */
	nodes: number;
	/** Per reply column (index 0–6): was the reply examined at all (false if pruned or illegal)? */
	replies: (boolean | null)[];
}

export interface SearchResult {
	/** The column chosen, −1 if the game is over. */
	best: number;
	/** The mover's score of the position at this depth. */
	score: number;
	/** Positions examined, the root included. */
	nodes: number;
	/** True when the budget ran out before the search finished. */
	stopped: boolean;
	root: RootMove[];
}

/**
 * Looks `depth` moves ahead from `game` (negamax: each side takes the move
 * that is best for itself, so a score for one side is the negative for the
 * other). With `prune`, alpha-beta: a line is abandoned as soon as it is
 * clear the opponent would never allow it. Columns are tried centre first,
 * and a move replaces the best so far only if strictly better, so the chosen
 * move and the score are the same with pruning on or off.
 */
export function search(game: string | Position, opts: SearchOptions): SearchResult {
	const p = typeof game === 'string' ? Position.from(game) : game;
	const rule = opts.rule ?? PAGE_RULE;
	const budget = opts.budget ?? Infinity;
	let nodes = 1;
	let stopped = false;
	// The reply grid of the move being searched at the root.
	let replies: (boolean | null)[] = [];

	const rec = (depth: number, alpha: number, beta: number, ply: number): number => {
		nodes++;
		if (p.won) return -(WIN - ply); // the opponent's last move won
		if (p.full) return 0;
		if (depth === 0) return evaluate(p, rule);
		if (nodes > budget) {
			stopped = true;
			return evaluate(p, rule);
		}
		let best = -Infinity;
		for (const c of ORDER) {
			if (!p.canPlay(c)) continue;
			if (ply === 1) replies[c] = true;
			p.play(c);
			const v = -rec(depth - 1, -beta, -alpha, ply + 1);
			p.undo();
			if (v > best) best = v;
			if (opts.prune) {
				if (v > alpha) alpha = v;
				if (alpha >= beta) break;
			}
		}
		return best;
	};

	const root: RootMove[] = [];
	let best = -1;
	let bestScore = -Infinity;
	if (!p.over) {
		let alpha = -Infinity;
		for (const c of ORDER) {
			if (!p.canPlay(c)) continue;
			const before = nodes;
			p.play(c);
			replies = Array.from({ length: COLS }, (_, i) => (p.canPlay(i) ? false : null));
			// A winning move or the end of the look-ahead: nothing to reply.
			if (p.won || opts.depth <= 1) replies = replies.map(() => null);
			const v = -rec(opts.depth - 1, -Infinity, opts.prune ? -alpha : Infinity, 1);
			p.undo();
			root.push({
				col: c,
				score: v,
				bound: opts.prune && v <= alpha ? 'upper' : 'exact',
				nodes: nodes - before,
				replies
			});
			if (v > bestScore) {
				bestScore = v;
				best = c;
			}
			if (v > alpha) alpha = v;
		}
	}
	root.sort((a, b) => a.col - b.col);
	// A finished game: lost for the side 'to move' if the last move won, a draw if the board is full.
	return { best, score: p.won ? -WIN : p.full ? 0 : bestScore, nodes, stopped, root };
}

/** The result of a game between two players, from red's side: 1 red won, −1 yellow won, 0 a draw. */
export interface Player {
	depth: number;
	rule: Rule;
}

/**
 * Plays one game to the end: `red` moves first; `opening` (a string of
 * columns) is played before the players take over. Pruning on: the moves are
 * the same as without, only faster.
 */
export function playGame(red: Player, yellow: Player, opening = '') {
	const p = Position.from(opening);
	while (!p.over) {
		const who = p.toMove === 1 ? red : yellow;
		const r = search(p, { depth: who.depth, prune: true, rule: who.rule });
		p.play(r.best);
	}
	const result = p.won ? (p.toMove === 2 ? 1 : -1) : 0;
	return { result, game: p.game };
}

/**
 * A match of 98 games: every opening of two moves (7 × 7), each played twice
 * so both players take both colours. The players never choose at random, so
 * the openings are what makes the games differ. Results from player A's side.
 */
export function playMatch(a: Player, b: Player) {
	const games: { opening: string; aIsRed: boolean; result: number; game: string }[] = [];
	for (let c1 = 0; c1 < COLS; c1++) {
		for (let c2 = 0; c2 < COLS; c2++) {
			const opening = `${c1}${c2}`;
			for (const aIsRed of [true, false]) {
				const g = aIsRed ? playGame(a, b, opening) : playGame(b, a, opening);
				games.push({ opening, aIsRed, result: aIsRed ? g.result : -g.result, game: g.game });
			}
		}
	}
	const wins = games.filter((g) => g.result > 0).length;
	const losses = games.filter((g) => g.result < 0).length;
	return { games, wins, losses, draws: games.length - wins - losses };
}

/** The features the rule of thumb counts, for one side (1 red, 2 yellow). */
export function features(p: Position, who: number) {
	let centre = 0;
	for (let r = 0; r < ROWS; r++) if (p.cells[3 * ROWS + r] === who) centre++;
	const twos: (readonly number[])[] = [];
	const threes: (readonly number[])[] = [];
	for (const w of WINDOWS) {
		let mine = 0;
		let theirs = 0;
		for (const i of w) {
			const v = p.cells[i];
			if (v === who) mine++;
			else if (v) theirs++;
		}
		if (theirs === 0 && mine === 2) twos.push(w);
		if (theirs === 0 && mine === 3) threes.push(w);
	}
	return { centre, twos, threes };
}
