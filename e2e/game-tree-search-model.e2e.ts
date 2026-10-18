// Checks the game searches behind the game-tree-search explainer. Runs in Node.
import { expect, test } from '@playwright/test';
import * as N from '../src/routes/game-tree-search/noughts';
import * as C from '../src/routes/game-tree-search/connect-four';
import {
	GROWTH,
	MATCHES,
	OPPONENTS,
	PUZZLE,
	TREE_PRESETS,
	TTT_COUNTS
} from '../src/routes/game-tree-search/presets';

test.describe('noughts and crosses', () => {
	test('there are 255,168 possible games: 131,184 won by X, 77,904 by O, 46,080 drawn', () => {
		const c = N.countGames();
		expect(c.games).toBe(255_168);
		expect([c.xWins, c.oWins, c.draws]).toEqual([131_184, 77_904, 46_080]);
		// The quickest win takes five moves (X's third); 127,872 games fill the board.
		expect(c.byLength.findIndex((n) => n > 0)).toBe(5);
		expect(c.byLength[9]).toBe(127_872);
	});

	test('5,478 distinct positions can arise, the empty board included; the full tree has 549,946', () => {
		const p = N.countPositions();
		expect(p.positions).toBe(5_478);
		expect(p.byPly[1]).toBe(9);
		// Every position after one move of each side: 9 × 8 = 72 (no two coincide yet).
		expect(p.byPly[2]).toBe(72);
		expect(p.treeNodes).toBe(549_946);
	});

	test('the counting chart holds the real counts', () => {
		const p = N.countPositions();
		const g = N.countGames();
		expect([p.positions, p.treeNodes, g.games]).toEqual([
			TTT_COUNTS.positions,
			TTT_COUNTS.treeNodes,
			TTT_COUNTS.games
		]);
		expect(p.byPly).toEqual(TTT_COUNTS.positionsByMarks);
		for (const row of TTT_COUNTS.gamesByLength) {
			expect(row.x + row.o + row.draw).toBe(g.byLength[row.moves]);
		}
		const sum = (k: 'x' | 'o' | 'draw') => TTT_COUNTS.gamesByLength.reduce((s, r) => s + r[k], 0);
		expect([sum('x'), sum('o'), sum('draw')]).toEqual([g.xWins, g.oWins, g.draws]);
	});

	test('the computer the reader plays: it never loses, and its scores agree with the search', () => {
		for (const b of [N.EMPTY, N.fromMoves([4]), ...TREE_PRESETS.map((t) => t.board)]) {
			const a = N.analyse(b);
			const s = N.search(b);
			expect(a.best).toBe(s.best);
			expect(a.nodes).toBe(s.nodes);
		}
		// Whatever X plays, a computer playing O by `analyse` never loses.
		const games = (b: N.Board): N.Board[] => {
			if (N.isOver(b)) return [b];
			if (N.toMove(b) === 'O') return games(N.play(b, N.analyse(b).best));
			return N.moves(b).flatMap((m) => games(N.play(b, m)));
		};
		expect(games(N.EMPTY).every((b) => N.winner(b) !== 'X')).toBe(true);
	});

	test('perfect play from the empty board is a draw', () => {
		expect(N.outcome(N.search(N.EMPTY).score)).toBe(0);
	});

	test('a win in one is taken, and a threat is blocked', () => {
		// X X . / O O . / . . .  with X to move: X wins on square 2.
		expect(N.search(N.fromMoves([0, 3, 1, 4])).best).toBe(2);
		// X X . / O O . / . . X  with O to move: O wins on square 5 rather than block.
		const b = N.fromMoves([0, 3, 1, 4, 8]);
		expect(N.search(b).best).toBe(5);
		expect(N.outcome(N.search(b).score)).toBe(-1);
		// X X . / . O . / . . .  with O to move: O must block on square 2.
		expect(N.search(N.fromMoves([0, 4, 1])).best).toBe(2);
	});

	test('alpha-beta finds the same value and move as minimax, examining far fewer positions', () => {
		const positions = [
			N.EMPTY,
			N.fromMoves([4]),
			N.fromMoves([0, 4]),
			...TREE_PRESETS.map((p) => p.board)
		];
		for (const b of positions) {
			const full = N.search(b);
			const cut = N.search(b, true);
			expect(cut.score).toBe(full.score);
			expect(cut.best).toBe(full.best);
			expect(cut.nodes).toBeLessThan(full.nodes);
		}
		// From the empty board: the whole tree against a few percent of it.
		expect(N.search(N.EMPTY).nodes).toBe(549_946);
		expect(N.search(N.EMPTY, true).nodes).toBeLessThan(549_946 / 20);
	});

	test('the recorded tree agrees with the search, and pruning only skips positions', () => {
		for (const p of TREE_PRESETS) {
			const full = N.searchTree(p.board);
			const cut = N.searchTree(p.board, true);
			expect(full.score).toBe(N.search(p.board).score);
			expect(cut.score).toBe(full.score);
			const all = (n: N.TreeNode): N.TreeNode[] => [n, ...n.children.flatMap(all)];
			expect(all(full).every((n) => n.visited)).toBe(true);
			const visited = all(cut).filter((n) => n.visited).length;
			expect(visited).toBe(N.search(p.board, true).nodes);
			expect(visited).toBeLessThan(all(full).length);
			// An exact score under pruning is the true minimax score.
			const pairs = all(cut).map((n, i) => [n, all(full)[i]] as const);
			for (const [c, f] of pairs) {
				if (!c.visited) continue;
				if (c.bound === 'exact') expect(c.score).toBe(f.score);
				if (c.bound === 'lower') expect(f.score).toBeGreaterThanOrEqual(c.score);
				if (c.bound === 'upper') expect(f.score).toBeLessThanOrEqual(c.score);
			}
		}
	});

	test('the tree presets: the computer (O) to move, four squares left, only one move avoids losing', () => {
		for (const p of TREE_PRESETS) {
			expect(N.toMove(p.board)).toBe('O');
			expect(N.moves(p.board)).toHaveLength(4);
			const tree = N.searchTree(p.board);
			// O minimises X's score; seen from O, the outcomes of its four moves.
			const forO = tree.children.map((c) => -N.outcome(c.score));
			expect(forO.filter((v) => v >= 0)).toHaveLength(1);
			expect(tree.children[forO.indexOf(Math.max(...forO))].move).toBe(p.saves);
		}
	});
});

test.describe('Connect Four', () => {
	test('a column fills after six discs, and four in a row in any direction wins', () => {
		const p = C.Position.from('333333');
		expect(p.canPlay(3)).toBe(false);
		expect(C.Position.from('0101010').won).toBe(true); // vertical
		expect(C.Position.from('0011223').won).toBe(true); // along the bottom
		expect(C.Position.from('01123223433').won).toBe(true); // diagonal
		expect(C.Position.from('010101').won).toBe(false);
	});

	test('with pruning off, every extra move of look-ahead multiplies the positions examined by about seven', () => {
		for (let d = 1; d <= 6; d++) {
			const n = C.search('', { depth: d, prune: false }).nodes;
			// No game can end in the first six moves: exactly 1 + 7 + … + 7^d positions.
			expect(n).toBe((7 ** (d + 1) - 1) / 6);
		}
		const n6 = C.search('', { depth: 6, prune: false }).nodes;
		const n7 = C.search('', { depth: 7, prune: false }).nodes;
		expect(n7 / n6).toBeGreaterThan(6.9);
		expect(n7 / n6).toBeLessThan(7.1);
	});

	test('pruning returns the same move and score with far fewer positions examined', () => {
		for (const game of ['', '3', '33', '3324', PUZZLE, '3323442105']) {
			for (const depth of [2, 4, 6]) {
				const a = C.search(game, { depth, prune: false });
				const b = C.search(game, { depth, prune: true });
				expect(b.best, `${game} @${depth}`).toBe(a.best);
				expect(b.score).toBe(a.score);
				if (depth >= 4) expect(b.nodes).toBeLessThan(a.nodes / 4);
			}
		}
	});

	test('the growth chart holds the counts the search really makes', () => {
		for (const row of GROWTH) {
			expect(C.search('', { depth: row.depth, prune: false }).nodes).toBe(row.full);
		}
		for (const row of GROWTH) {
			expect(C.search('', { depth: row.depth, prune: true }).nodes).toBe(row.pruned);
		}
	});

	test('a winning move is taken, and a one-move threat is blocked, even one move ahead', () => {
		// Red has three in column 0 and is to move: it wins there.
		expect(C.search('010101', { depth: 1, prune: true }).best).toBe(0);
		// Yellow to move must block column 0.
		expect(C.search('01010', { depth: 2, prune: true }).best).toBe(0);
	});

	test('the puzzle: two or three moves ahead the computer takes the centre and loses; four or more, it blocks', () => {
		const p = C.Position.from(PUZZLE);
		expect(p.toMove).toBe(2); // the computer is yellow
		for (const depth of [1, 2, 3]) expect(C.search(PUZZLE, { depth, prune: true }).best).toBe(3);
		for (const depth of [4, 5, 6, 7, 8])
			expect(C.search(PUZZLE, { depth, prune: true }).best).toBe(5);
		// After the centre, red forces a win in its next two moves (four discs on): a double threat.
		const after = C.search(PUZZLE + '3', { depth: 3, prune: true });
		expect(after.score).toBe(C.WIN - 3);
		expect(after.best).toBe(5);
		// After column 5, red has no forced win within eight moves.
		expect(C.search(PUZZLE + '5', { depth: 8, prune: true }).score).toBeLessThan(C.FORCED);
	});

	test('the quoted matches: a better rule of thumb beats a deeper search', () => {
		const rule = (r: string) => (r === 'page' ? C.PAGE_RULE : C.NO_RULE);
		for (const q of MATCHES) {
			const m = C.playMatch(
				{ depth: q.a.depth, rule: rule(q.a.rule) },
				{ depth: q.b.depth, rule: rule(q.b.rule) }
			);
			expect(m.games).toHaveLength(98);
			expect([m.wins, m.draws, m.losses]).toEqual([q.wins, q.draws, q.losses]);
		}
		for (const [id, o] of Object.entries(OPPONENTS)) {
			const m = C.playMatch(
				{ depth: 4, rule: C.PAGE_RULE },
				{ depth: o.depth, rule: rule(o.rule) }
			);
			expect([m.wins, m.draws, m.losses], id).toEqual([o.page.wins, o.page.draws, o.page.losses]);
		}
		// A rule of centre points alone plays exactly like no rule (the centre is tried first anyway).
		const centre = C.playMatch(
			{ depth: 4, rule: { centre: 1, two: 0, three: 0 } },
			{ depth: 4, rule: C.PAGE_RULE }
		);
		const none = C.playMatch({ depth: 4, rule: C.NO_RULE }, { depth: 4, rule: C.PAGE_RULE });
		expect(centre.games.map((g) => g.game)).toEqual(none.games.map((g) => g.game));
		// With the same rule, looking further ahead wins more than it loses…
		expect(MATCHES[1].wins).toBeGreaterThan(MATCHES[1].losses);
		// …but the page's rule four moves ahead beats no rule six moves ahead.
		expect(MATCHES[2].wins).toBeGreaterThan(2 * MATCHES[2].losses);
	});

	test('matches are deterministic', () => {
		const a = C.playMatch({ depth: 3, rule: C.PAGE_RULE }, { depth: 3, rule: C.NO_RULE });
		const b = C.playMatch({ depth: 3, rule: C.PAGE_RULE }, { depth: 3, rule: C.NO_RULE });
		expect(a.games.map((g) => g.game)).toEqual(b.games.map((g) => g.game));
	});
});
