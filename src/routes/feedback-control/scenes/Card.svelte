<script lang="ts">
	/**
	 * The readout card of the feedback-control scenes: a row of cells, each a small
	 * label, a big value and an optional note (as in oscillations-resonance). On phones
	 * the cells are listed under the stage instead.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import type { Cell } from './shared';
	interface Props {
		cells: Cell[];
		x: number;
		y: number;
		w: number;
		h?: number;
	}
	let { cells, x, y, w, h = 70 }: Props = $props();

	const cw = $derived(w / Math.max(1, cells.length));
</script>

{#each cells as c, i (c.id)}
	<Readout
		id="cell-{c.id}"
		order={i}
		label={c.label[0].toUpperCase() + c.label.slice(1)}
		value={c.value}
		note={c.sub}
		color={c.color}
	/>
{/each}
<Readout id="card">
	<g style:pointer-events="none">
		<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
		{#each cells as c, i (c.id)}
			{@const cx = x + 16 + i * cw}
			{#if i > 0}
				<line x1={x + i * cw} x2={x + i * cw} y1={y + 14} y2={y + h - 14} stroke="var(--border)" />
			{/if}
			<text x={cx} y={y + 22} class="muted" font-size="12" font-weight="500">{c.label}</text>
			<text x={cx} y={y + 45} font-size="18" style:fill={c.color} font-weight="700">{c.value}</text>
			{#if c.sub}
				<text x={cx} y={y + 61} class="muted" font-size="11">{c.sub}</text>
			{/if}
		{/each}
	</g>
</Readout>
