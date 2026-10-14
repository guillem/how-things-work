/**
 * Seconds since the scene's inputs (`key`) last changed, so that a run
 * replays from its start when the reader moves a control or presses a
 * button. The memo is plain (not reactive) state read inside a `$derived`
 * of `t`; it resets when `t` goes back (a new step or a restart).
 */
export function replayClock() {
	let memo = { key: '', start: 0 };
	return (key: string, t: number) => {
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return Math.max(0, t - memo.start);
	};
}
