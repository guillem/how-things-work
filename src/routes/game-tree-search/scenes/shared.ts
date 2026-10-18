/** Helpers shared by the game-tree-search scenes. */

/** Win, draw or loss, from the side whose score this is. */
export type Outcome = 'win' | 'draw' | 'loss';

export const outcomeOf = (score: number): Outcome =>
	score > 0 ? 'win' : score < 0 ? 'loss' : 'draw';

export const outcomeColor: Record<Outcome, string> = {
	win: 'var(--gt-win)',
	draw: 'var(--gt-draw)',
	loss: 'var(--gt-loss)'
};
export const outcomeText: Record<Outcome, string> = {
	win: 'var(--gt-win-text)',
	draw: 'var(--gt-draw-text)',
	loss: 'var(--gt-loss-text)'
};
export const outcomeLetter: Record<Outcome, string> = { win: 'W', draw: 'D', loss: 'L' };

/** Enter or Space on a focused SVG button. */
export function onKey(e: KeyboardEvent, act: () => void) {
	if (e.key !== 'Enter' && e.key !== ' ') return;
	e.preventDefault();
	act();
}

export const fmt = (n: number) => n.toLocaleString('en-US');

/** "Start again"-style actions: true once per new press of the action `id`. */
export function pressWatcher(initial: number) {
	let seen = initial;
	return (presses: number) => {
		const fresh = presses > seen;
		seen = presses;
		return fresh;
	};
}
