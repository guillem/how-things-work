<script lang="ts">
	/**
	 * A row of small bits of a material, each drawn over a faint mark at its resting place and
	 * shifted by `shifts` (scene units, one per bit). The `marked` bit is larger and orange.
	 */
	interface Props {
		x: number;
		y: number;
		spacing: number;
		shifts: readonly number[];
		marked?: number;
		r?: number;
		opacity?: number;
	}
	let { x, y, spacing, shifts, marked = -1, r = 5, opacity = 0.8 }: Props = $props();
</script>

<g>
	{#each shifts as shift, k (k)}
		{@const cx = x + k * spacing}
		<path
			d={`M${cx} ${y - 13} V${y + 13}`}
			stroke="var(--stage-line)"
			stroke-width="1"
			opacity="0.6"
		/>
		<circle
			cx={cx + shift}
			cy={y}
			r={k === marked ? r + 3 : r}
			fill={k === marked ? 'var(--vs-marked)' : 'var(--vs-wave)'}
			{opacity}
		/>
	{/each}
</g>
