<script lang="ts">
	/**
	 * The "Draw" toggle of the drawing scenes, shown only on touch screens. A
	 * finger on a drawing area scrolls the page as usual; after this button is
	 * pressed, the next finger stroke draws instead (mouse and pen draw directly).
	 */
	let { x, y, armed, ontoggle }: { x: number; y: number; armed: boolean; ontoggle: () => void } =
		$props();
	const W = 112;
	const H = 30;
</script>

<g
	class="draw-button"
	role="button"
	tabindex="0"
	aria-pressed={armed}
	aria-label={armed ? 'Cancel drawing' : 'Draw with a finger'}
	onclick={ontoggle}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ontoggle();
		}
	}}
>
	<rect
		x={x - W}
		{y}
		width={W}
		height={H}
		rx={H / 2}
		fill={armed ? 'var(--ft-bar)' : 'var(--stage-bg)'}
		stroke="var(--ft-bar)"
		stroke-width="2"
	/>
	<text
		x={x - W / 2}
		y={y + H / 2 + 5}
		text-anchor="middle"
		font-weight="600"
		font-size="14"
		style:fill={armed ? 'var(--stage-bg)' : 'var(--ft-bar)'}>{armed ? '✕ Cancel' : '✎ Draw'}</text
	>
</g>

<style>
	.draw-button {
		display: none;
		cursor: pointer;
	}
	@media (any-pointer: coarse) {
		.draw-button {
			display: inline;
		}
	}
	.draw-button:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 3;
	}
	.draw-button:focus {
		outline: none;
	}
</style>
