<script lang="ts">
	/**
	 * Frame of one plot: light grid lines, the zero line drawn firmer, tick
	 * labels on the left and along the bottom, and the axis names.
	 */
	import type { Scale } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';
	import { niceTicks, num } from './plot';

	interface Props {
		sx: Scale;
		sy: Scale;
		/** Name of the vertical quantity, shown above the axis ("y", "slope f′(x)"). */
		yName: string;
		yColor?: string;
		/** Name of the horizontal quantity, shown at the right end ("x", "t (s)"). */
		xName?: string;
		xTicks?: number[];
		xFormat?: (v: number) => string;
		opacity?: number;
	}
	let {
		sx,
		sy,
		yName,
		yColor,
		xName,
		xTicks = [0, 0.5, 1, 1.5, 2, 2.5, 3],
		xFormat = (v) => num(v, v % 1 === 0 ? 0 : 1),
		opacity = 1
	}: Props = $props();

	const left = $derived(Math.min(...sx.range));
	const right = $derived(Math.max(...sx.range));
	const top = $derived(Math.min(...sy.range));
	const bottom = $derived(Math.max(...sy.range));
	const ys = $derived(niceTicks(sy.domain[0], sy.domain[1], bottom - top > 300 ? 8 : 4));
	const zeroY = $derived(sy(0));
	// As many decimals as the tick spacing needs (0.25 → 2, 2.5 → 1, 5 → 0).
	const decimals = $derived.by(() => {
		const gap = ys.length > 1 ? ys[1] - ys[0] : 1;
		for (let d = 0; d < 3; d++)
			if (Math.abs(gap * 10 ** d - Math.round(gap * 10 ** d)) < 1e-6) return d;
		return 3;
	});
</script>

<g {opacity} style:pointer-events="none">
	{#each ys as v (v)}
		<line x1={left} x2={right} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		<!-- <Readout>: tick labels and axis names are hidden on narrow screens -->
		<Readout id="frame-y{v}">
			<Label x={left - 8} y={sy(v) + 4} text={num(v, decimals)} size={11} anchor="end" muted />
		</Readout>
	{/each}
	{#each xTicks as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={bottom} y2={bottom + 4} stroke="var(--stage-line)" />
		<Readout id="frame-x{v}">
			<Label x={sx(v)} y={bottom + 17} text={xFormat(v)} size={11} anchor="middle" muted />
		</Readout>
	{/each}
	<line x1={left} x2={left} y1={top} y2={bottom} stroke="var(--stage-line)" />
	<line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--stage-line)" />
	{#if zeroY > top + 0.5 && zeroY < bottom - 0.5}
		<line
			x1={left}
			x2={right}
			y1={zeroY}
			y2={zeroY}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
		/>
	{/if}
	<Readout id="frame-names">
		<Label
			anchor="start"
			x={left - 8}
			y={top - 12}
			text={yName}
			size={12}
			weight={600}
			color={yColor}
		/>
		{#if xName}
			<Label x={right} y={bottom + 34} text={xName} size={12} anchor="end" muted />
		{/if}
	</Readout>
</g>
