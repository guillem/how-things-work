/**
 * Noughts and crosses (tic-tac-toe), searched to the end by minimax, with or
 * without alpha-beta pruning.
 *
 * A board is a 9-character string read row by row, '.' for an empty square;
 * X always moves first, so whose turn it is follows from the counts. Scores
 * are from X's side: a win for X is worth +(10 − plies to reach it), a win for
 * O the negative, a draw 0. Preferring the quickest win (and the slowest loss)
 * keeps the computer from dawdling with a won game; the page shows only the
 * sign: win, draw or loss.
 */

export type Mark = 'X' | 'O';
export type Board = string;

export const EMPTY: Board = '.........';

const LINES = [
	[0, 1, 2],
	[3, 4, 5],
	[6, 7, 8],
	[0, 3, 6],
	[1, 4, 7],
	[2, 5, 8],
	[0, 4, 8],
	[2, 4, 6]
] as const;

/** The three squares of the completed line, or null. */
export function winningLine(b: Board): readonly [number, number, number] | null {
	for (const l of LINES) {
		const c = b[l[0]];
		if (c !== '.' && c === b[l[1]] && c === b[l[2]]) return l;
	}
	return null;
}

export function winner(b: Board): Mark | null {
	const l = winningLine(b);
	return l ? (b[l[0]] as Mark) : null;
}

export const isFull = (b: Board) => !b.includes('.');
export const isOver = (b: Board) => winner(b) !== null || isFull(b);

export function toMove(b: Board): Mark {
	let x = 0;
	let o = 0;
	for (const c of b) {
		if (c === 'X') x++;
		else if (c === 'O') o++;
	}
	return x === o ? 'X' : 'O';
}

export function moves(b: Board): number[] {
	const m: number[] = [];
	for (let i = 0; i < 9; i++) if (b[i] === '.') m.push(i);
	return m;
}

export function play(b: Board, square: number): Board {
	if (b[square] !== '.' || isOver(b)) throw new Error(`illegal move ${square} on ${b}`);
	return b.slice(0, square) + toMove(b) + b.slice(square + 1);
}

/** A board from a list of squares played in order (X first). */
export function fromMoves(list: readonly number[]): Board {
	return list.reduce<Board>((b, s) => play(b, s), EMPTY);
}

/** Score of a finished game from X's side, or null while it goes on. */
function terminalScore(b: Board, ply: number): number | null {
	const w = winner(b);
	if (w === 'X') return 10 - ply;
	if (w === 'O') return ply - 10;
	return isFull(b) ? 0 : null;
}

/** −1, 0 or +1: the outcome a score stands for, from X's side. */
export const outcome = (score: number) => Math.sign(score);

/** One position of a recorded search tree. */
export interface TreeNode {
	board: Board;
	/** The square just played to reach this position (−1 at the root). */
	move: number;
	ply: number;
	/** X's score; for a cut-off node under pruning, only a bound (see `bound`). */
	score: number;
	/** 'exact', or under pruning 'lower' (at least `score`) or 'upper' (at most `score`). */
	bound: 'exact' | 'lower' | 'upper';
	/** False when pruning skipped this position: it was never examined. */
	visited: boolean;
	/** The order in which the search finished with this position (0 first), −1 if skipped. */
	order: number;
	children: TreeNode[];
}

export interface SearchResult {
	/** X's score of the position under perfect play. */
	score: number;
	/** The square chosen for the side to move (−1 if the game is over). */
	best: number;
	/** Positions examined, the start position included. */
	nodes: number;
}

/**
 * Minimax to the end of the game: the side to move takes the child with the
 * best score for it (X the highest, O the lowest). With `prune`, alpha-beta:
 * a position is abandoned as soon as it is clear the side above would never
 * let the game reach it. The value and the chosen move are the same either
 * way (children are tried in the same order and a later child replaces the
 * best only if strictly better).
 */
export function search(b: Board, prune = false): SearchResult {
	let nodes = 0;
	const rec = (pos: Board, ply: number, alpha: number, beta: number): [number, number] => {
		nodes++;
		const t = terminalScore(pos, ply);
		if (t !== null) return [t, -1];
		const max = toMove(pos) === 'X';
		let best = max ? -Infinity : Infinity;
		let bestMove = -1;
		for (const m of moves(pos)) {
			const [v] = rec(play(pos, m), ply + 1, alpha, beta);
			if (max ? v > best : v < best) {
				best = v;
				bestMove = m;
			}
			if (prune) {
				if (max) alpha = Math.max(alpha, v);
				else beta = Math.min(beta, v);
				if (alpha >= beta) break;
			}
		}
		return [best, bestMove];
	};
	const ply = 9 - moves(b).length;
	const [score, best] = rec(b, ply, -Infinity, Infinity);
	return { score, best, nodes };
}

/**
 * The whole search tree below `b`, every position included, with the scores
 * minimax gives them; with `prune`, the positions alpha-beta skips are marked
 * unvisited and the scores of cut-off positions are bounds.
 */
export function searchTree(b: Board, prune = false): TreeNode {
	let order = 0;
	const build = (pos: Board, move: number, ply: number): TreeNode => ({
		board: pos,
		move,
		ply,
		score: 0,
		bound: 'exact',
		visited: false,
		order: -1,
		children: isOver(pos) ? [] : moves(pos).map((m) => build(play(pos, m), m, ply + 1))
	});
	const root = build(b, -1, 9 - moves(b).length);
	const rec = (n: TreeNode, alpha: number, beta: number): number => {
		n.visited = true;
		const t = terminalScore(n.board, n.ply);
		if (t !== null) {
			n.score = t;
			n.order = order++;
			return t;
		}
		const max = toMove(n.board) === 'X';
		const a0 = alpha;
		const b0 = beta;
		let best = max ? -Infinity : Infinity;
		for (const c of n.children) {
			const v = rec(c, alpha, beta);
			if (max ? v > best : v < best) best = v;
			if (prune) {
				if (max) alpha = Math.max(alpha, v);
				else beta = Math.min(beta, v);
				if (alpha >= beta) break;
			}
		}
		n.score = best;
		n.bound = !prune ? 'exact' : best <= a0 ? 'upper' : best >= b0 ? 'lower' : 'exact';
		n.order = order++;
		return best;
	};
	rec(root, -Infinity, Infinity);
	return root;
}

/** Every complete game from the empty board: how many, and how they end. */
export function countGames() {
	let games = 0;
	let xWins = 0;
	let oWins = 0;
	let draws = 0;
	/** Games that end after each number of moves (index = moves). */
	const byLength = new Array<number>(10).fill(0);
	const rec = (b: Board, ply: number) => {
		const w = winner(b);
		if (w || isFull(b)) {
			games++;
			byLength[ply]++;
			if (w === 'X') xWins++;
			else if (w === 'O') oWins++;
			else draws++;
			return;
		}
		for (const m of moves(b)) rec(play(b, m), ply + 1);
	};
	rec(EMPTY, 0);
	return { games, xWins, oWins, draws, byLength };
}

/**
 * The distinct positions that can arise in a game (the empty board included;
 * a game stops at a win), by number of marks on the board, and the size of
 * the full game tree (every node, counting the same position once per way of
 * reaching it).
 */
export function countPositions() {
	const seen = new Set<Board>();
	const byPly = new Array<number>(10).fill(0);
	let treeNodes = 0;
	const rec = (b: Board, ply: number) => {
		treeNodes++;
		if (!seen.has(b)) {
			seen.add(b);
			byPly[ply]++;
		}
		if (isOver(b)) return;
		for (const m of moves(b)) rec(play(b, m), ply + 1);
	};
	rec(EMPTY, 0);
	return { positions: seen.size, byPly, treeNodes };
}
