<script lang="ts" module>
	export interface Cell {
		id: string;
		label: string;
		value: string;
		sub?: string;
		color?: string;
	}
</script>

<script lang="ts">
	/**
	 * Readout card shared by the ocean scenes: a box of cells, each a small
	 * label, a big value and an optional note, stacked vertically (or side by
	 * side when `row` is set). Text sizes are set with `style:` because the
	 * stage CSS overrides SVG presentation attributes.
	 */
	interface Props {
		x: number;
		y: number;
		w: number;
		cells: Cell[];
		/** Height of one cell. */
		cellH?: number;
		/** Lay the cells out side by side instead of stacked. */
		row?: boolean;
	}
	let { x, y, w, cells, cellH = 74, row = false }: Props = $props();

	const cw = $derived(row ? w / Math.max(1, cells.length) : w);
	const h = $derived(row ? cellH : cellH * cells.length);
</script>

<g style:pointer-events="none">
	<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
	{#each cells as c, i (c.id)}
		{@const cx = row ? x + i * cw : x}
		{@const cy = row ? y : y + i * cellH}
		{#if i > 0}
			{#if row}
				<line x1={cx} x2={cx} y1={y + 14} y2={y + h - 14} stroke="var(--border)" />
			{:else}
				<line x1={x + 14} x2={x + w - 14} y1={cy} y2={cy} stroke="var(--border)" />
			{/if}
		{/if}
		<text x={cx + 14} y={cy + 22} class="muted" style:font-size="12px" font-weight="500"
			>{c.label}</text
		>
		<text x={cx + 14} y={cy + 46} style:font-size="19px" style:fill={c.color} font-weight="700"
			>{c.value}</text
		>
		{#if c.sub}
			<text x={cx + 14} y={cy + 64} class="muted" style:font-size="11px">{c.sub}</text>
		{/if}
	{/each}
</g>
