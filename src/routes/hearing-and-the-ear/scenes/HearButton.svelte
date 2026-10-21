<script lang="ts">
	/**
	 * A "hear it" button drawn in the scene: plays the notes, quietly, for about a second (the
	 * cochlea page's player: nothing plays by itself, and every sound is silent under browser
	 * automation). The model's loudness is not reproduced: a speaker's real level is unknown.
	 */
	import { onDestroy } from 'svelte';
	import { playTones, stopAll } from '../../cochlea-hearing/scenes/audio';

	interface Props {
		x: number;
		y: number;
		/** The notes' pitches, shakes a second. */
		notes: readonly number[];
		text?: string;
	}
	let { x, y, notes, text = '▶ Hear it' }: Props = $props();

	const W = 120;
	const H = 36;
	function play() {
		playTones(notes.map((f) => ({ f, level: 60 })));
	}
	function key(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		play();
	}
	onDestroy(stopAll);
</script>

<g
	class="he-hear"
	role="button"
	tabindex="0"
	aria-label={notes.length > 1 ? 'Hear the notes' : 'Hear the note'}
	onclick={play}
	onkeydown={key}
>
	<rect
		x={x - W / 2}
		y={y - H / 2}
		width={W}
		height={H}
		rx={H / 2}
		fill="var(--surface)"
		stroke="var(--he-accent)"
		stroke-width="2"
	/>
	<text {x} y={y + 5} text-anchor="middle" font-size="15" font-weight="600" fill="var(--he-accent)"
		>{text}</text
	>
</g>

<style>
	.he-hear {
		cursor: pointer;
		outline: none;
	}
	.he-hear:focus-visible rect {
		stroke-width: 3.5;
	}
</style>
