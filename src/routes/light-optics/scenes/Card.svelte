<script lang="ts">
	/**
	 * A readout card: a row of cells, each a small label, a big value and an
	 * optional note. Sizes are set with `style:` because the stage CSS overrides
	 * SVG font-size attributes.
	 */
	import type { Cell } from './ui';
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		cells: Cell[];
	}
	let { x, y, w, h = 84, cells }: Props = $props();

	const cw = $derived(w / Math.max(1, cells.length));
</script>

<g style:pointer-events="none">
	<rect {x} {y} width={w} height={h} rx="12" fill="var(--surface)" stroke="var(--border)" />
	{#each cells as c, i (c.id)}
		{@const cx = x + 14 + i * cw}
		{#if i > 0}
			<line x1={x + i * cw} x2={x + i * cw} y1={y + 14} y2={y + h - 14} stroke="var(--border)" />
		{/if}
		<text x={cx} y={y + 24} class="muted" style:font-size="12px" font-weight="500">{c.label}</text>
		<text x={cx} y={y + 50} style:font-size="18px" style:fill={c.color} font-weight="700"
			>{c.value}</text
		>
		{#if c.sub}
			<text x={cx} y={y + 70} class="muted" style:font-size="11px">{c.sub}</text>
		{/if}
	{/each}
</g>
