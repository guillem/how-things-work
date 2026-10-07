<script lang="ts">
	/**
	 * Frame of a plot inside a scene: a light grid, an x axis along the bottom
	 * and a y axis on the left (or right), with tick labels and axis titles.
	 * Map data into the same box with the scales from `chart.ts`:
	 *
	 *   const sx = scale([0, 100], [x, x + width]);
	 *   const sy = scale([0, 1], [y + height, y]);
	 *   <Axes {sx} {sy} xLabel="days" yLabel="people" />
	 *   <path d={linePath(data, (d) => d.day, (d) => d.i, sx, sy)} … />
	 */
	import type { Scale } from './chart';
	import { ticks as niceTicks } from './chart';

	interface Props {
		sx: Scale;
		sy: Scale;
		xLabel?: string;
		yLabel?: string;
		/** Tick values; by default about 5 round values over each domain. */
		xTicks?: number[];
		yTicks?: number[];
		xFormat?: (v: number) => string;
		yFormat?: (v: number) => string;
		/** Draw the y axis on the right-hand side. */
		yRight?: boolean;
		grid?: boolean;
		opacity?: number;
	}
	let {
		sx,
		sy,
		xLabel,
		yLabel,
		xTicks,
		yTicks,
		xFormat = (v) => v.toLocaleString('en-US'),
		yFormat = (v) => v.toLocaleString('en-US'),
		yRight = false,
		grid = true,
		opacity = 1
	}: Props = $props();

	const left = $derived(Math.min(...sx.range));
	const right = $derived(Math.max(...sx.range));
	const top = $derived(Math.min(...sy.range));
	const bottom = $derived(Math.max(...sy.range));
	const xs = $derived(xTicks ?? niceTicks(sx.domain[0], sx.domain[1], 5));
	const ys = $derived(yTicks ?? niceTicks(sy.domain[0], sy.domain[1], 4));
	const axisX = $derived(yRight ? right : left);
</script>

<g {opacity} style:pointer-events="none">
	{#if grid}
		{#each ys as v (v)}
			<line x1={left} x2={right} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		{/each}
	{/if}
	<line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--stage-line)" />
	<line x1={axisX} x2={axisX} y1={top} y2={bottom} stroke="var(--stage-line)" />
	{#each xs as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={bottom} y2={bottom + 4} stroke="var(--stage-line)" />
		<text x={sx(v)} y={bottom + 17} text-anchor="middle" font-size="11" class="muted">
			{xFormat(v)}
		</text>
	{/each}
	{#each ys as v (v)}
		<text
			x={yRight ? axisX + 7 : axisX - 7}
			y={sy(v) + 4}
			text-anchor={yRight ? 'start' : 'end'}
			font-size="11"
			class="muted"
		>
			{yFormat(v)}
		</text>
	{/each}
	{#if xLabel}
		<text x={right} y={bottom + 34} text-anchor="end" font-size="11" class="muted">{xLabel}</text>
	{/if}
	{#if yLabel}
		<text
			x={yRight ? right : left}
			y={top - 10}
			text-anchor={yRight ? 'end' : 'start'}
			font-size="11"
			class="muted">{yLabel}</text
		>
	{/if}
</g>
