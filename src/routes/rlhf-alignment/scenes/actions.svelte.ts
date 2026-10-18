/**
 * Runs `run` when an action button's press count changes (not on mount: a count carried over
 * from another step was already acted on there). Call during a scene's initialisation.
 */
import { untrack } from 'svelte';

export function onPress(count: () => number, run: () => void) {
	let last = untrack(count);
	$effect(() => {
		const n = count();
		if (n === last) return;
		last = n;
		untrack(run);
	});
}

/** The press count of an action control. */
export const presses = (v: unknown) => (typeof v === 'number' ? v : 0);
