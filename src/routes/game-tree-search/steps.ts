import type { Control, ExplainerSpec } from '#lib/explainer/index.ts';
import type { RangeControl } from '#lib/explainer/types.ts';
import { TREE_PRESETS } from './presets';

const tttFirst: Control = {
	type: 'select',
	id: 'tttFirst',
	label: 'Who starts',
	default: 'you',
	options: [
		{ value: 'you', label: 'You (X)' },
		{ value: 'computer', label: 'The computer (X)' }
	],
	help: 'Whoever starts plays X. Changing it starts a new game.'
};

const tttNew: Control = {
	type: 'action',
	id: 'tttNew',
	label: 'New game',
	action: 'New game'
};

const treePos: Control = {
	type: 'select',
	id: 'treePos',
	label: 'Position',
	default: TREE_PRESETS[0].id,
	options: TREE_PRESETS.map((p) => ({ value: p.id, label: p.label }))
};

/** Alpha-beta pruning; off by default so the reader switches it on. One id on every step that offers it. */
const prune: Control = {
	type: 'toggle',
	id: 'prune',
	label: 'Pruning (alpha-beta)',
	default: false,
	help: 'Skip every line the side to move would never allow. The move chosen stays the same.'
};

const depth: RangeControl = {
	type: 'range',
	id: 'depth',
	label: 'Moves ahead',
	min: 1,
	max: 8,
	step: 1,
	default: 4,
	format: (v) => (v === 1 ? '1 move' : `${v} moves`),
	help: 'How far the computer looks: each move is one disc, by either player.'
};

/** The same control where pruning can be off: unpruned, eight moves ahead would take seconds. */
const depthCapped: RangeControl = {
	...depth,
	bounds: (p): readonly [number, number] => (p.prune === true ? [1, 8] : [1, 7]),
	help: 'Without pruning the page stops at 7: 8 moves ahead would examine millions of positions per move.'
};

const c4New: Control = {
	type: 'action',
	id: 'c4New',
	label: 'New game',
	action: 'New game',
	help: 'You play red and move first: click a column, or Tab to a column and press Enter or Space.'
};

const c4Reset: Control = {
	type: 'action',
	id: 'c4Reset',
	label: 'Back to the puzzle',
	action: 'Back to the puzzle'
};

const weight = (id: string, label: string, max: number, def: number, help: string): Control => ({
	type: 'range',
	id,
	label,
	min: 0,
	max,
	step: 1,
	default: def,
	format: (v) => (v === 1 ? '1 point' : `${v} points`),
	help
});

const wCentre = weight('wCentre', 'Centre column', 5, 0, 'Per disc in the middle column.');
const wTwo = weight(
	'wTwo',
	'Two in a line',
	5,
	0,
	'Per line of four with two of your discs and two empty squares.'
);
const wThree = weight(
	'wThree',
	'Three in a line',
	10,
	0,
	'Per line of four with three of your discs and one empty square.'
);

const opponent: Control = {
	type: 'select',
	id: 'opponent',
	label: 'Opponent',
	default: 'none4',
	options: [
		{ value: 'none4', label: 'No rule, 4 moves ahead' },
		{ value: 'page4', label: 'The page’s rule, 4 moves ahead' },
		{ value: 'none6', label: 'No rule, 6 moves ahead' }
	]
};

const runMatch: Control = {
	type: 'action',
	id: 'runMatch',
	label: 'Test your rule',
	action: 'Play the match',
	help: '98 games: your rule looks four moves ahead, the opponent as chosen. Every two-move opening is played with both colours.'
};

/**
 * Scenes: `ttt` (play noughts and crosses against a full minimax search, with the computer's
 * moves and their outcomes), `tree` (the whole tree below a position with four squares left; hint
 * `phase`: 'leaves' | 'up' | 'prune'), `count` (the whole game of noughts and crosses counted),
 * `c4` (Connect Four against a search with a set depth, its seven moves and the replies it
 * examined; hint `mode`: 'play' | 'puzzle'), `growth` (positions examined against moves ahead,
 * without and with pruning), `match` (build a rule of thumb and test it; hint `phase`: 'build' |
 * 'quoted').
 */
export const spec: ExplainerSpec = {
	slug: 'game-tree-search',
	title: 'How a computer plays a game: the search tree',
	summary:
		'Play noughts and crosses and Connect Four against the page and open its mind: the tree of moves it looks through, the scores passed up from the end of each line, how fast the tree grows, the branches pruning skips, and the rule of thumb that scores the positions it cannot see past.',
	chapters: [
		{ id: 'ahead', title: 'Looking ahead' },
		{ id: 'big', title: 'A tree too big to search' },
		{ id: 'prune', title: 'Pruning' },
		{ id: 'rule', title: 'The rule of thumb' }
	],
	steps: [
		// ------------------------------------------------------------------ ahead
		{
			id: 'play',
			chapter: 'ahead',
			title: 'A game against the page',
			scene: 'ttt',
			duration: 22,
			controls: [tttFirst, tttNew],
			body: `
<p>Play noughts and crosses against the computer: click a square (or Tab to a square, then press Enter or Space). Try to beat it.</p>
<p>You can't. Before every move it tries <em>each</em> square it could take, then every reply you could make, then every answer to that, all the way to the end of the game. Under the board you can see what it found for each of its moves: a <strong>win</strong>, a <strong>draw</strong> or a <strong>loss</strong>, if both sides play as well as they can from there. It takes a move with the best outcome for itself.</p>
<p>That is all there is to it. It doesn't plan like a person, with ideas such as "take a corner"; it counts, very fast.</p>`
		},
		{
			id: 'leaves',
			chapter: 'ahead',
			title: 'The tree of moves',
			scene: 'tree',
			hints: { phase: 'leaves' },
			duration: 20,
			controls: [treePos],
			body: `
<p>Here is everything the computer looks at in one position, drawn as a <dfn data-def="A drawing of every way a game can go from one position: each position is a node, and each move is a branch to the position it leads to.">game tree</dfn>. It plays O, and four squares are left. At the top is the position now; below it, the four positions its four possible moves lead to; below each of those, your three possible replies; and so on, one row per move.</p>
<p>A line stops where the game ends: someone completes three in a row, or the board fills up. These ends are the <strong>leaves</strong> of the tree, and they are the only positions that can be scored straight away, by looking at them: a <strong>win</strong>, a <strong>draw</strong> or a <strong>loss</strong> for the computer.</p>
<p>But the computer has to choose a move now, at the top. How do the scores of the leaves get up there?</p>`
		},
		{
			id: 'minimax',
			chapter: 'ahead',
			title: 'Best for me, worst for me',
			scene: 'tree',
			hints: { phase: 'up' },
			duration: 24,
			controls: [treePos],
			body: `
<p>Work upwards from the leaves, one row at a time. In a position where it is the <strong>computer's</strong> turn, it will take the move that is best for it, so that position is worth the <em>best</em> of the scores below it. In a position where it is <strong>your</strong> turn, the computer assumes you will play your best too, which is the <em>worst</em> for it: that position is worth the <em>worst</em> of the scores below it.</p>
<p>Passing the scores up like this is called <dfn data-def="Scoring a game tree from its leaves upwards: a position where the player to move is 'max' gets the highest score below it, a position where the opponent moves gets the lowest. The move at the top with the best score is the one to play.">minimax</dfn>: maximise on your own turns, minimise on the opponent's. At the top, each of the computer's moves now carries the outcome it can <em>guarantee</em>, whatever you do, and it plays the best one: the only move here that doesn't lose.</p>
<p>Notice that the computer never hopes you will blunder. A move that wins if you slip, but loses if you don't, is scored as a loss.</p>`,
			notes: `<p>The page scores a quicker win a little higher than a slower one (and a slower loss higher than a quicker one), so that the computer takes a win when it sees one instead of dawdling; the tree shows only win, draw or loss.</p>`
		},
		{
			id: 'whole-game',
			chapter: 'ahead',
			title: 'The whole game, counted',
			scene: 'count',
			duration: 20,
			body: `
<p>The same search from the empty board covers the whole game. There are <strong>255,168</strong> different ways a game of noughts and crosses can go, from the first move to a win or a full board; along the way they pass through only <strong>5,478</strong> different positions, because different orders of moves often lead to the same board.</p>
<p>The computer's tree from the empty board has 549,946 positions in it (a position counts once for each way of reaching it). A computer runs through that in well under a second, and the score at the top is a <strong>draw</strong>: if both players play perfectly, nobody wins. That is why your games against it end in a draw at best.</p>
<p>So in noughts and crosses the computer really does see every possible game. In most games it can't.</p>`
		},
		// ------------------------------------------------------------------ big
		{
			id: 'connect-four',
			chapter: 'big',
			title: 'Connect Four: too big to see to the end',
			scene: 'c4',
			hints: { mode: 'play' },
			duration: 26,
			controls: [depth, c4New],
			body: `
<p>In <strong>Connect Four</strong> you drop discs into seven columns and try to get four in a row. It can be played as perfectly as noughts and crosses: in 1988 James Allen and Victor Allis, working separately, showed that the first player wins by starting in the middle column. It took clever programming and a lot of computer time, because about <strong>4.5 trillion</strong> different positions can arise.</p>
<p>So the page's computer looks only a few moves ahead (here a move is one disc, by either player) and then stops. At the end of each line the game usually isn't over, so instead of win or loss it gives the position a score from a <dfn data-def="A quick estimate of how good a position is, without looking any further ahead. In games programs it is often called the evaluation function.">rule of thumb</dfn>: points for discs in the centre column and for lines of four that are partly filled with its own discs and still open, minus the same for you. Minimax then passes these scores up as before.</p>
<p>You play red. Set how far ahead it looks and try to beat it. Under the board: its seven moves, the score each got, and how many positions it examined.</p>`
		},
		{
			id: 'depth',
			chapter: 'big',
			title: 'Looking further ahead',
			scene: 'c4',
			hints: { mode: 'puzzle' },
			duration: 24,
			controls: [depth, c4Reset],
			body: `
<p>Here the computer is yellow and must move. Red has discs in columns 4 and 5 along the bottom row, with both ends still open.</p>
<p>Looking <strong>2 or 3 moves ahead</strong>, the computer takes the centre column, which its rule of thumb likes. Then red drops a disc in column 6: three in a row along the bottom, with columns 3 and 7 both open. Yellow can block one; red wins on the other. Looking <strong>4 moves ahead</strong> or more, the computer sees that line through to red's win and blocks column 6 first.</p>
<p>Click a column to make red's reply yourself and see. At 2 moves ahead the computer blunders all the time; at 6 it is hard to beat. Why not always look far ahead? Watch the count of positions examined as you raise it.</p>`
		},
		{
			id: 'growth',
			chapter: 'big',
			title: 'Sevenfold per move',
			scene: 'growth',
			duration: 22,
			controls: [prune],
			body: `
<p>From the empty board, Connect Four offers 7 moves; each of those, 7 replies; each of those, 7 more. Every extra move of look-ahead multiplies the number of positions to examine by about <strong>seven</strong>: 57 positions for 2 moves ahead, 2,801 for 4, 137,257 for 6, more than 6.6 million for 8. Each grid line on the chart is ten times the one below.</p>
<p>The tree grows <dfn data-def="Multiplying by the same factor at every step: 7, 49, 343, 2,401… Each extra move of look-ahead costs as much as all the ones before it, several times over.">exponentially</dfn>, and that is what limits how far a program can look: a computer a thousand times faster sees only about three and a half moves further. A whole game of Connect Four can last 42 moves; chess, where a position offers about 30 to 35 legal moves, has a tree so big that Claude Shannon in 1950 put the number of possible games at more than 10¹²⁰.</p>
<p>There is a way to search much less without missing anything. Switch pruning on.</p>`
		},
		// ------------------------------------------------------------------ prune
		{
			id: 'pruning',
			chapter: 'prune',
			title: 'Branches not worth searching',
			scene: 'tree',
			hints: { phase: 'prune' },
			duration: 26,
			controls: [prune, treePos],
			body: `
<p>Back to the noughts-and-crosses tree. Switch pruning on, and many branches turn grey: the search never looks at them, yet it reaches the same score and the same move.</p>
<p>The idea: the computer searches its moves one after another. Suppose it has already found a move that guarantees a draw. Searching its next move, it finds one reply of yours that leaves it a draw at best. It can stop right there: whatever your other replies would do, this move can't beat the one it already has, so the rest of your replies, and their whole branches, are skipped.</p>
<p>This is <dfn data-def="A way of searching a game tree that skips every branch which cannot change the move chosen, keeping track of the best score each side is already sure of (alpha for one side, beta for the other).">alpha-beta pruning</dfn>. Scores written ≤ or ≥ are bounds: enough to know the branch won't be chosen, without its exact value.</p>`,
			notes: `<p>Alpha-beta keeps two numbers as it searches: alpha, the best score the computer is already sure of, and beta, the best you are already sure of. A branch is abandoned as soon as it can no longer end up between the two. Pruning never changes the result; how much it saves depends on the order the moves are tried in: the sooner the best move is tried, the more is cut. In the best case it lets a program search about twice as many moves ahead in the same time.</p>`
		},
		{
			id: 'c4-pruning',
			chapter: 'prune',
			title: 'Pruning in Connect Four',
			scene: 'c4',
			hints: { mode: 'puzzle' },
			duration: 26,
			controls: [prune, depthCapped, c4Reset],
			body: `
<p>The same puzzle, now with the replies the computer examined drawn under each of its seven moves. With pruning off, every reply to every move is searched. Switch pruning on: whole branches go grey, the count of positions examined falls steeply (at 6 moves ahead from 123,449 to 5,867), and the move chosen stays exactly the same.</p>
<p>Go back to the growth chart with pruning on: the count now grows by about three times per move instead of seven, so in the same time the computer can look nearly twice as far ahead. Chess programs have used alpha-beta since the early 1960s, trying the most promising moves first to make the most of it.</p>`
		},
		// ------------------------------------------------------------------ rule
		{
			id: 'rule',
			chapter: 'rule',
			title: 'Build your own rule of thumb',
			scene: 'match',
			hints: { phase: 'build' },
			duration: 30,
			controls: [wCentre, wTwo, wThree, opponent, runMatch],
			body: `
<p>Where the look-ahead stops, everything depends on the rule of thumb. Build your own from three features: discs in the <strong>centre column</strong> (it is part of more lines of four than any other), lines of four holding <strong>two</strong> of your discs and two empty squares, and lines holding <strong>three</strong> of your discs and one empty square. Each counts for you and, with the same points, against you for the opponent's discs.</p>
<p>Then test it: your rule, looking four moves ahead, plays a match of 98 games against the opponent you choose. A rule of all zeros scores only wins and losses it can see. Try a single feature, then mixes. Can you beat the page's own rule (centre 3, two 2, three 5)?</p>`,
			notes: `<p>The computer already tries the centre column first when moves score the same, so in these matches a rule of centre points alone plays exactly the same games as no rule at all (in some other positions it does choose differently). Neither side ever picks a move at random: the 49 different two-move openings are what make the games differ.</p>`
		},
		{
			id: 'better-rule',
			chapter: 'rule',
			title: 'A better rule beats a deeper search',
			scene: 'match',
			hints: { phase: 'quoted' },
			duration: 26,
			body: `
<p>Three matches of 98 games. With no rule of thumb, looking 6 moves ahead instead of 4 hardly helps: almost every game is a draw, because neither side can tell a promising position from a poor one until a win is in sight. With the page's rule, looking further ahead does win more games than it loses.</p>
<p>But the page's rule looking only <strong>4</strong> moves ahead beats no rule looking <strong>6</strong> moves ahead: 56 wins to 26, while examining far fewer positions. A program doesn't see every possible game, only a few moves of it, and at the end of every line it trusts a rule of thumb. Knowing what makes a position good can be worth more than looking further.</p>
<p>That is the whole method: look ahead down the tree, assume the opponent plays its best, and take the move whose worst case is best, looking as deep as the tree's growth allows. When the search reaches the end of the game, as in noughts and crosses, that worst case is a guaranteed outcome; when it stops earlier, it is only an estimate. Strong chess programs still work this way, with a finely tuned rule of thumb (today often a small neural network) and many refinements of alpha-beta.</p>`
		}
	]
};
