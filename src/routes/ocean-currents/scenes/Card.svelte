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
	 * side when `row` is set). On phones the card leaves the drawing and each
	 * cell is a row of the readout panel under the stage (`<Readout>`).
	 */
	import { Readout } from '#lib/explainer/index.ts';

	interface Props {
		/** Prefix of the cells' readout ids, unique within the scene. */
		id: string;
		x: number;
		y: number;
		w: number;
		cells: Cell[];
		/** Height of one cell. */
		cellH?: number;
		/** Lay the cells out side by side instead of stacked. */
		row?: boolean;
		/** Panel position of the first cell. */
		order?: number;
		/** The scene's fade of the card, for the panel. */
		opacity?: number;
	}
	let { id, x, y, w, cells, cellH = 74, row = false, order = 0, opacity = 1 }: Props = $props();

	const cw = $derived(row ? w / Math.max(1, cells.length) : w);
	const h = $derived(row ? cellH : cellH * cells.length);
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
</script>

<g style:pointer-events="none">
	<Readout id="{id}-card">
		<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
	</Readout>
	{#each cells as c, i (c.id)}
		{@const cx = row ? x + i * cw : x}
		{@const cy = row ? y : y + i * cellH}
		<Readout
			id="{id}-{c.id}"
			order={order + i}
			label={cap(c.label)}
			value={c.value}
			note={c.sub || undefined}
			color={c.color}
			{opacity}
		>
			{#if i > 0}
				{#if row}
					<line x1={cx} x2={cx} y1={y + 14} y2={y + h - 14} stroke="var(--border)" />
				{:else}
					<line x1={x + 14} x2={x + w - 14} y1={cy} y2={cy} stroke="var(--border)" />
				{/if}
			{/if}
			<text x={cx + 14} y={cy + 22} class="muted" font-size="12" font-weight="500">{c.label}</text>
			<text x={cx + 14} y={cy + 46} font-size="19" style:fill={c.color} font-weight="700"
				>{c.value}</text
			>
			{#if c.sub}
				<text x={cx + 14} y={cy + 64} class="muted" font-size="11">{c.sub}</text>
			{/if}
		</Readout>
	{/each}
</g>
