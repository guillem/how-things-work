<script lang="ts">
	/**
	 * A rounded card behind a block of readouts. On phones the readouts are
	 * listed under the stage, so the card leaves the drawing with them.
	 */
	import { Readout } from '#lib/explainer/index.ts';

	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		opacity?: number;
	}
	let { x, y, w, h, opacity = 1 }: Props = $props();
</script>

<Readout id="card">
	<rect
		{x}
		{y}
		width={w}
		height={h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
		{opacity}
	/>
</Readout>
