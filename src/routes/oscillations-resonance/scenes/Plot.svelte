<script lang="ts">
	/**
	 * Plot frame shared by the oscillation scenes: horizontal grid lines at the
	 * y ticks, the axes and 11 px tick labels (the stage CSS ignores font-size
	 * attributes, so sizes are set with style).
	 */
	import type { Scale } from '#lib/draw/index.ts';

	interface Props {
		sx: Scale;
		sy: Scale;
		xTicks: number[];
		yTicks: number[];
		xFormat?: (v: number) => string;
		yFormat?: (v: number) => string;
		opacity?: number;
	}
	let {
		sx,
		sy,
		xTicks,
		yTicks,
		xFormat = (v) => String(v),
		yFormat = (v) => String(v),
		opacity = 1
	}: Props = $props();

	const left = $derived(Math.min(...sx.range));
	const right = $derived(Math.max(...sx.range));
	const top = $derived(Math.min(...sy.range));
	const bottom = $derived(Math.max(...sy.range));
</script>

<g {opacity} style:pointer-events="none">
	{#each yTicks as v (v)}
		<line x1={left} x2={right} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		<text x={left - 8} y={sy(v) + 4} text-anchor="end" class="muted" style:font-size="11px"
			>{yFormat(v)}</text
		>
	{/each}
	<line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--stage-line)" />
	<line x1={left} x2={left} y1={top} y2={bottom} stroke="var(--stage-line)" />
	{#each xTicks as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={bottom} y2={bottom + 4} stroke="var(--stage-line)" />
		<text x={sx(v)} y={bottom + 17} text-anchor="middle" class="muted" style:font-size="11px"
			>{xFormat(v)}</text
		>
	{/each}
</g>
