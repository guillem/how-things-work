<script lang="ts">
	/**
	 * Positions examined from the empty Connect Four board against moves looked ahead (GROWTH,
	 * checked against the search in the model tests), on a scale that goes up ten times per grid
	 * line: without pruning (bars, about ×7 per move) and, with `params.prune`, with alpha-beta
	 * (a second set of bars fading in). The bars appear one depth after another over the first
	 * three seconds.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { GROWTH } from '../presets';
	import { fmt } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const tt = $derived(reduced ? 1e6 : t);
	const on = new Tween(0, { duration: 800, easing: cubicInOut });
	const pruneOn = $derived(params.prune === true);
	$effect(() => {
		const v = pruneOn ? 1 : 0;
		untrack(() => on.set(v, { duration: reduced ? 0 : 800 }));
	});

	const P = { x: 120, y: 96, w: 780, h: 400 };
	const sx = scale([0.4, 8.6], [P.x, P.x + P.w]);
	const sy = scale([0, 7], [P.y + P.h, P.y]);
	const yTicks = [0, 1, 2, 3, 4, 5, 6, 7];
	const yFormat = (v: number) =>
		['1', '10', '100', '1,000', '10,000', '100,000', '1 million', '10 million'][v] ?? '';
	const BW = 30;
	const appear = (d: number) => smoothstep(0.2 + d * 0.35, 0.5 + d * 0.35, tt);
	const h = (n: number) => P.y + P.h - sy(Math.log10(n));
</script>

<g>
	<Readout id="g-title">
		<Label
			x={P.x}
			y={48}
			text="Positions examined from the empty board"
			size={16}
			weight={700}
			anchor="start"
		/>
		<Label
			x={P.x}
			y={70}
			text="each grid line is ten times the one below"
			size={12}
			muted
			anchor="start"
		/>
	</Readout>
	<Axes {sx} {sy} {yTicks} {yFormat} xTicks={[1, 2, 3, 4, 5, 6, 7, 8]} xLabel="moves ahead" />

	{#each GROWTH as row (row.depth)}
		{@const a = appear(row.depth)}
		{@const x = sx(row.depth)}
		{@const shift = on.current * (BW / 2 + 2)}
		<rect
			x={x - BW / 2 - shift}
			y={P.y + P.h - h(row.full) * a}
			width={BW}
			height={h(row.full) * a}
			rx="3"
			fill="var(--accent)"
			opacity="0.8"
		/>
		<Readout id="g-full-{row.depth}">
			<Label
				x={x - shift}
				y={P.y + P.h - h(row.full) - 8}
				text={fmt(row.full)}
				size={11}
				opacity={smoothstep(0.85, 1, a)}
				tabular
			/>
		</Readout>
		{#if on.current > 0.01}
			<rect
				x={x + 2}
				y={P.y + P.h - h(row.pruned) * a * on.current}
				width={BW}
				height={h(row.pruned) * a * on.current}
				rx="3"
				fill="var(--gt-win)"
				opacity="0.8"
			/>
			<Readout id="g-cut-{row.depth}">
				<Label
					x={x + BW / 2 + 2}
					y={P.y + P.h - h(row.pruned) - 8}
					text={fmt(row.pruned)}
					size={11}
					opacity={smoothstep(0.85, 1, a) * on.current}
					color="var(--gt-win-text)"
					tabular
				/>
			</Readout>
		{/if}
		{#if row.depth > 1 && on.current < 0.99}
			<Readout id="g-x7-{row.depth}">
				<Label
					x={(x + sx(row.depth - 1)) / 2 - shift - 10}
					y={P.y + P.h - (h(row.full) + h(GROWTH[row.depth - 2].full)) / 2 - 4}
					text="×7"
					size={11}
					weight={700}
					muted
					opacity={a * (1 - on.current)}
				/>
			</Readout>
		{/if}
	{/each}

	<Readout
		id="g-key-full"
		order={1}
		label="Without pruning"
		value="about ×7 per move"
		color="var(--accent)"
	>
		<rect
			x={P.x + 16}
			y={P.y + 6}
			width="14"
			height="14"
			rx="3"
			fill="var(--accent)"
			opacity="0.8"
		/>
		<Label
			x={P.x + 38}
			y={P.y + 18}
			text="without pruning: about ×7 per move"
			size={12}
			anchor="start"
		/>
	</Readout>
	<Readout
		id="g-key-cut"
		order={2}
		label="With pruning"
		value="about ×3 per move"
		color="var(--gt-win)"
		opacity={on.current}
	>
		<g opacity={on.current}>
			<rect
				x={P.x + 16}
				y={P.y + 28}
				width="14"
				height="14"
				rx="3"
				fill="var(--gt-win)"
				opacity="0.8"
			/>
			<Label
				x={P.x + 38}
				y={P.y + 40}
				text="with pruning: about ×3 per move, same moves chosen"
				size={12}
				anchor="start"
			/>
		</g>
	</Readout>
</g>
