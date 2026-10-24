<script lang="ts">
	/** The button drawn in the scene that twangs the ruler (or rings the bell) and plays its note. */
	interface Props {
		/** Centre of the button. */
		x: number;
		y: number;
		text: string;
		onplay: () => void;
	}
	let { x, y, text, onplay }: Props = $props();

	const W = 225;
	const H = 48;
	function key(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		onplay();
	}
</script>

<g class="vs-play" role="button" tabindex="0" aria-label={text} onclick={onplay} onkeydown={key}>
	<rect
		x={x - W / 2}
		y={y - H / 2}
		width={W}
		height={H}
		rx={H / 2}
		fill="var(--surface)"
		stroke="var(--vs-wave)"
		stroke-width="2"
	/>
	<path d={`M${x - 89} ${y - 8} l0 16 l13 -8 Z`} fill="var(--vs-wave-text)" />
	<text
		x={x + 9}
		y={y + 7}
		text-anchor="middle"
		font-size="19"
		font-weight="600"
		fill="var(--vs-wave-text)">{text}</text
	>
</g>

<style>
	.vs-play {
		cursor: pointer;
		outline: none;
	}
	.vs-play:focus-visible rect {
		stroke-width: 3.5;
	}
</style>
