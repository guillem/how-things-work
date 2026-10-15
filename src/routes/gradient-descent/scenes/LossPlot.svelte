<script lang="ts">
	/**
	 * The loss after every step so far, one curve per run. The step axis grows
	 * with the run; a loss above the top of the plot (a diverging run) leaves
	 * through the top, with a note.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import { Label, niceMax, scale, ticks } from '#lib/draw/index.ts';
	import { LOSS, fmt } from './shared';

	interface Series {
		key: string;
		color: string;
		losses: number[];
	}
	interface Props {
		series: Series[];
		/** The loss the plot's top is set from (the start). */
		top: number;
		/** The lowest possible loss, drawn as a dashed line when above 0. */
		floor: number;
		/** Steps taken so far (may be fractional): sets the length of the step axis. */
		shown: number;
	}
	let { series, top, floor, shown }: Props = $props();

	const yMax = $derived(niceMax(top * 1.08));
	const xMax = $derived(Math.max(20, shown * 1.12));
	const sx = $derived(scale([0, xMax], [LOSS.x, LOSS.x + LOSS.w]));
	const sy = $derived(scale([0, yMax], [LOSS.y + LOSS.h, LOSS.y]));
	const xTicks = $derived(ticks(0, xMax, 4).filter((v) => v <= xMax));
	const yTicks = $derived(ticks(0, yMax, 2));

	const curves = $derived(
		series.map((s) => {
			let d = '';
			let over = false;
			s.losses.forEach((l, i) => {
				const y = l > yMax * 1.5 ? yMax * 1.5 : l;
				if (l > yMax) over = true;
				d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(y).toFixed(1)}`;
			});
			return { key: s.key, color: s.color, d, over };
		})
	);
	const anyOver = $derived(curves.some((c) => c.over));
</script>

<g style:pointer-events="none">
	<defs>
		<clipPath id="gd-loss-clip">
			<rect x={LOSS.x} y={LOSS.y} width={LOSS.w + 4} height={LOSS.h + 2} />
		</clipPath>
	</defs>
	<line
		x1={LOSS.x}
		x2={LOSS.x + LOSS.w}
		y1={LOSS.y + LOSS.h}
		y2={LOSS.y + LOSS.h}
		stroke="var(--stage-line)"
	/>
	<line x1={LOSS.x} x2={LOSS.x} y1={LOSS.y} y2={LOSS.y + LOSS.h} stroke="var(--stage-line)" />
	{#each yTicks as v (v)}
		<line x1={LOSS.x} x2={LOSS.x + LOSS.w} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
	{/each}
	{#if floor > 0}
		<line
			x1={LOSS.x}
			x2={LOSS.x + LOSS.w}
			y1={sy(floor)}
			y2={sy(floor)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
	{/if}
	<g clip-path="url(#gd-loss-clip)">
		{#each curves as c (c.key)}
			<path d={c.d} fill="none" stroke={c.color} stroke-width="2.2" stroke-linejoin="round" />
		{/each}
	</g>
	<Readout id="loss-axes">
		{#each yTicks as v (v)}
			<Label x={LOSS.x - 6} y={sy(v) + 4} text={fmt(v)} anchor="end" size={11} muted />
		{/each}
		{#each xTicks as v (v)}
			<Label x={sx(v)} y={LOSS.y + LOSS.h + 15} text={String(v)} anchor="middle" size={11} muted />
		{/each}
		<Label
			x={LOSS.x + LOSS.w}
			y={LOSS.y + LOSS.h + 30}
			text="step →"
			anchor="end"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={LOSS.x - 52}
			y={LOSS.y - 10}
			text="loss after each step"
			size={12}
			muted
		/>
		{#if anyOver}
			<Label
				x={LOSS.x + LOSS.w - 4}
				y={LOSS.y + 12}
				text="↑ off the top"
				anchor="end"
				size={12}
				color="var(--gd-run3)"
			/>
		{/if}
	</Readout>
</g>
