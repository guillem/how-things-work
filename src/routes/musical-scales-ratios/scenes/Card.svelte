<script lang="ts">
	/**
	 * A readout card shared by the twelve-notes scenes: a row of cells, each a small
	 * label, a big value and an optional note. On narrow screens (<Readout>)
	 * the card leaves the drawing and each cell is a row under the stage.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import type { Cell } from './ui';
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		cells: Cell[];
	}
	let { x, y, w, h = 92, cells }: Props = $props();

	const cw = $derived(w / Math.max(1, cells.length));
</script>

{#each cells as c, i (c.id)}
	<Readout
		id="card-{c.id}"
		order={i + 1}
		label={c.label}
		value={c.value}
		note={c.sub}
		color={c.color}
	/>
{/each}
<Readout id="card">
	<g style:pointer-events="none">
		<rect {x} {y} width={w} height={h} rx="14" fill="var(--surface)" stroke="var(--border)" />
		{#each cells as c, i (c.id)}
			{@const cx = x + 18 + i * cw}
			{#if i > 0}
				<line x1={x + i * cw} x2={x + i * cw} y1={y + 16} y2={y + h - 16} stroke="var(--border)" />
			{/if}
			<text x={cx} y={y + 28} class="muted" font-size="12" font-weight="500">{c.label}</text>
			<text x={cx} y={y + 55} font-size="19" style:fill={c.color} font-weight="700">{c.value}</text>
			{#if c.sub}
				<text x={cx} y={y + 76} class="muted" font-size="11">{c.sub}</text>
			{/if}
		{/each}
	</g>
</Readout>
