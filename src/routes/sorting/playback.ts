/**
 * Where a replay is, as a function of time and the reader's controls.
 *
 * - Playing: the position advances `pace` operations per second from where it
 *   was when playing started (0 for a new run), and holds at the end.
 * - Paused: the position is `manual` (written by the scene's scrubber or by
 *   the freeze when the reader turns playing off).
 *
 * A new run (different input or algorithm, signalled by `key`) or `t` going
 * backwards (a step restart) starts again from 0. This keeps a little state
 * between frames — the documented exception in docs/scene-guide.md for
 * quantities that depend on when a control changed.
 */
export function createPlayback(lead = 0.6) {
	let key = '';
	let lastT = 0;
	let wasPlaying = false;
	let startedAt = 0;
	let startedFrom = 0;
	let fresh = true;

	return function position(
		t: number,
		o: { key: string; playing: boolean; pace: number; manual: number; total: number }
	): number {
		if (o.key !== key || t < lastT) {
			key = o.key;
			startedAt = t;
			startedFrom = 0;
			fresh = true;
		} else if (o.playing && !wasPlaying) {
			startedAt = t;
			startedFrom = o.manual >= o.total ? 0 : Math.max(0, o.manual);
			fresh = false;
		}
		wasPlaying = o.playing;
		lastT = t;
		if (!o.playing) return Math.max(0, Math.min(o.total, o.manual));
		const elapsed = Math.max(0, t - startedAt - (fresh ? lead : 0));
		return Math.min(o.total, startedFrom + elapsed * o.pace);
	};
}
