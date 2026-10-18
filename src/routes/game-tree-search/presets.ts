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
