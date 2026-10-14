<script lang="ts">
	/**
	 * A 2 × 2 matrix of numbers in brackets, its top-left at (x, y): each column right-aligned,
	 * so the numbers stay put while their values change.
	 */
	interface Props {
		x: number;
		y: number;
		cells: readonly (readonly string[])[];
		size?: number;
		/** Width of a column, in stage units. */
		col?: number;
		color?: string;
		opacity?: number;
	}
	let { x, y, cells, size = 20, col = 64, color, opacity = 1 }: Props = $props();

	const rowH = $derived(size * 1.35);
	const h = $derived(rowH * cells.length + size * 0.3);
	const wTotal = $derived(col * (cells[0]?.length ?? 2) + 18);
</script>

<g {opacity}>
	<path
		d="M{x + 7} {y} H{x} V{y + h} H{x + 7} M{x + wTotal - 7} {y} H{x + wTotal} V{y + h} H{x +
			wTotal -
			7}"
		fill="none"
		stroke={color ?? 'var(--stage-ink)'}
		stroke-width="1.8"
	/>
	{#each cells as row, r (r)}
		{#each row as cell, c (c)}
			<text
				x={x + 8 + col * (c + 1) - 6}
				y={y + rowH * (r + 1) - size * 0.15}
				text-anchor="end"
				font-weight="700"
				style:font-size="{size}px"
				style:fill={color}>{cell}</text
			>
		{/each}
	{/each}
</g>
