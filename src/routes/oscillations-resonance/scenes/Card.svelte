<script lang="ts">
	/**
	 * The readout card shared by the oscillation scenes: a row of cells, each a
	 * small label, a big value and an optional note or bar.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import { CARD, type Cell } from './osc';
	interface Props {
		cells: Cell[];
	}
	let { cells }: Props = $props();

	const w = $derived(CARD.w / Math.max(1, cells.length));
</script>

<!-- phones: the cells are listed under the stage instead -->
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
		<rect
			x={CARD.x}
			y={CARD.y}
			width={CARD.w}
			height={CARD.h}
			rx="14"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		{#each cells as c, i (c.id)}
			{@const x = CARD.x + 18 + i * w}
			{#if i > 0}
				<line
					x1={CARD.x + i * w}
					x2={CARD.x + i * w}
					y1={CARD.y + 18}
					y2={CARD.y + CARD.h - 18}
					stroke="var(--border)"
				/>
			{/if}
			<text {x} y={CARD.y + 30} class="muted" font-size="12" font-weight="500">{c.label}</text>
			<text {x} y={CARD.y + 57} font-size="19" style:fill={c.color} font-weight="700"
				>{c.value}</text
			>
			{#if c.bar !== undefined}
				<rect {x} y={CARD.y + 69} width={w - 36} height="8" rx="4" fill="var(--stage-grid)" />
				<rect
					{x}
					y={CARD.y + 69}
					width={Math.max(0, Math.min(1, c.bar)) * (w - 36)}
					height="8"
					rx="4"
					fill={c.barColor ?? 'var(--osc-trace)'}
				/>
			{:else if c.sub}
				<text {x} y={CARD.y + 80} class="muted" font-size="11">{c.sub}</text>
			{/if}
		{/each}
	</g>
</Readout>
