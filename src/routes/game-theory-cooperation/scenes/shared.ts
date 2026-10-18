/** What the game-theory scenes share: the payoffs from the controls and the colours. */
import type { Params } from '#lib/explainer/index.ts';
import { CLASSIC, type Move, type Payoffs, type StrategyId } from '../model';

/** The payoffs set by the reader (Axelrod's 5, 3, 1, 0 until changed). */
export function payoffsOf(params: Params): Payoffs {
	const v = (id: keyof Payoffs) => {
		const x = Number(params[id]);
		return Number.isFinite(x) ? x : CLASSIC[id];
	};
	return { T: v('T'), R: v('R'), P: v('P'), S: v('S') };
}

export const strategyColor = (id: StrategyId) => `var(--gt-${id})`;

export const moveColor = (m: Move) => (m === 'C' ? 'var(--gt-coop)' : 'var(--gt-cheat)');

/** Points with at most `digits` decimals and no trailing zeros. */
export const pts = (v: number, digits = 2) => String(Number(v.toFixed(digits)));
