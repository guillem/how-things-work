<script lang="ts">
	/**
	 * A readout card: a row of cells, each a small label, a big value and an
	 * optional note. On phones each cell is listed under the stage
	 * instead (see `Readout`), and the card leaves the drawing.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import type { Cell } from './ui';
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		cells: Cell[];
		/** Where the cells go in the phone list, and the scene's fade (for that list). */
		order?: number;
		opacity?: number;
	}
	let { x, y, w, h = 84, cells, order = 10, opacity = 1 }: Props = $props();

	const cw = $derived(w / Math.max(1, cells.length));
</script>

<g style:pointer-events="none">
	<Readout id="card-{x}-{y}">
		<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
	</Readout>
	{#each cells as c, i (c.id)}
		{@const cx = x + 14 + i * cw}
		<Readout
			id="cell-{c.id}"
			order={order + i}
			label={c.label}
			value={c.value}
			note={c.sub}
			color={c.color}
			{opacity}
		>
			{#if i > 0}
				<line x1={x + i * cw} x2={x + i * cw} y1={y + 14} y2={y + h - 14} stroke="var(--border)" />
			{/if}
			<text x={cx} y={y + 24} class="muted" font-size="12" font-weight="500">{c.label}</text>
			<text x={cx} y={y + 50} font-size="18" style:fill={c.color} font-weight="700">{c.value}</text>
			{#if c.sub}
				<text x={cx} y={y + 70} class="muted" font-size="11">{c.sub}</text>
			{/if}
		</Readout>
	{/each}
</g>
