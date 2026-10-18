/**
 * The positions and counts the narrative quotes (each checked against the
 * searches in e2e/game-tree-search-model.e2e.ts).
 */

/**
 * Noughts and crosses with the computer (O) to move and four squares left:
 * small enough to draw the whole tree (at most 4 + 12 + 24 + 24 positions
 * below the root). In both, exactly one move avoids losing.
 */
export const TREE_PRESETS = [
	{
		id: 'block',
		label: 'You threaten three in a row',
		// X . O / . . X / X . O : X threatens the left column.
		board: 'X.O..XX.O',
		saves: 3
	},
	{
		id: 'fork',
		label: 'A quieter position',
		// . X . / O . X / X O . : the centre looks natural, but X then gets two threats at once.
		board: '.X.O.XXO.',
		saves: 2
	}
] as const;

/**
 * A Connect Four position with the computer (yellow) to move. Red has three
 * discs on the bottom row with room on both sides of two of them: looking
 * one to three moves ahead, the computer takes the centre column, and red's
 * disc in column 6 (index 5) then makes two threats at once; four or more
 * moves ahead, it blocks there first.
 */
export const PUZZLE = '314131130';

/**
 * Positions examined from the empty board, by moves looked ahead, without
 * and with alpha-beta pruning (the page's rule of thumb at the leaves).
 */
export const GROWTH = [
	{ depth: 1, full: 8, pruned: 8 },
	{ depth: 2, full: 57, pruned: 21 },
	{ depth: 3, full: 400, pruned: 76 },
	{ depth: 4, full: 2_801, pruned: 175 },
	{ depth: 5, full: 19_608, pruned: 627 },
	{ depth: 6, full: 137_257, pruned: 1_285 },
	{ depth: 7, full: 960_793, pruned: 5_086 },
	{ depth: 8, full: 6_634_027, pruned: 9_793 }
] as const;

/**
 * Noughts and crosses counted to the end (from `countPositions` and
 * `countGames`): distinct positions by marks on the board, and complete games
 * by the move they end on and who wins.
 */
export const TTT_COUNTS = {
	positions: 5_478,
	treeNodes: 549_946,
	games: 255_168,
	positionsByMarks: [1, 9, 72, 252, 756, 1_260, 1_520, 1_140, 390, 78],
	gamesByLength: [
		{ moves: 5, x: 1_440, o: 0, draw: 0 },
		{ moves: 6, x: 0, o: 5_328, draw: 0 },
		{ moves: 7, x: 47_952, o: 0, draw: 0 },
		{ moves: 8, x: 0, o: 72_576, draw: 0 },
		{ moves: 9, x: 81_792, o: 0, draw: 46_080 }
	]
} as const;

/** The page's rule (four moves ahead) against each opponent of the rule-building step. */
export const OPPONENTS = {
	none4: { rule: 'none', depth: 4, page: { wins: 68, draws: 14, losses: 16 } },
	page4: { rule: 'page', depth: 4, page: { wins: 42, draws: 14, losses: 42 } },
	none6: { rule: 'none', depth: 6, page: { wins: 56, draws: 16, losses: 26 } }
} as const;

/**
 * Matches the last step quotes (98 games each, see `playMatch`), from the
 * first player's side; `rule` is 'page' (the page's rule of thumb) or 'none'.
 */
export const MATCHES = [
	{ a: { rule: 'none', depth: 6 }, b: { rule: 'none', depth: 4 }, wins: 8, draws: 84, losses: 6 },
	{ a: { rule: 'page', depth: 6 }, b: { rule: 'page', depth: 4 }, wins: 44, draws: 27, losses: 27 },
	{ a: { rule: 'page', depth: 4 }, b: { rule: 'none', depth: 6 }, wins: 56, draws: 16, losses: 26 }
] as const;
