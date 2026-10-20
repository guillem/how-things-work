<script lang="ts">
	/**
	 * Rule 184 as traffic: cars (blue) on a ring road of 120 cells over 70 generations, time running
	 * down; beside it the share of cars moving against how full the road is, the flow law
	 * min(1, (1 - d) / d) and this road's measured value.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { evolve, live, randomRow, trafficSpeed } from '../model';
	import { runs } from '../runs';

	let { params }: StageProps = $props();

	const density = $derived(Number(params.density ?? 0.35));
	const W = 120;
	const G = 70;
	const rows = $derived(evolve(184, randomRow(W, density, 11), G - 1));
	const cells = $derived(runs(rows, 30, 60, 4, 6.6));
	const cars = $derived(live(rows[0]));
	const speed = $derived(trafficSpeed(density));
	const law = (d: number) => Math.min(1, (1 - d) / d);
	const curve = Array.from({ length: 91 }, (_, i) => 0.05 + i * 0.01);
	const sx = scale([0, 1], [560, 920]);
	const sy = scale([0, 1], [440, 120]);
</script>

<g class="ca-traffic">
	<rect x={30} y={60} width={W * 4} height={G * 6.6} fill="none" stroke="var(--border-strong)" />
	{#each cells as c, i (i)}
		<rect x={c.x} y={c.y} width={c.w} height={c.h} fill="var(--ca-car)" />
	{/each}
	<Label
		x={30}
		y={44}
		text="cars drive right →   time runs down ↓"
		anchor="start"
		size={12}
		muted
	/>
	<Readout
		id="ca-cars"
		order={1}
		label="Cars"
		value="{cars} on a road of {W} cells (the same in every row)"
	>
		<Label
			x={30 + W * 4}
			y={44}
			text="{cars} cars, every row"
			anchor="end"
			size={12}
			weight={600}
			tabular
		/>
	</Readout>

	<Axes {sx} {sy} xLabel="how full the road is" yLabel="share of cars moving" />
	<line
		x1={sx(0.5)}
		y1={sy(0)}
		x2={sx(0.5)}
		y2={sy(1)}
		stroke="var(--text-muted)"
		stroke-dasharray="4 4"
	/>
	<path
		d={linePath(curve, (d) => d, law, sx, sy)}
		fill="none"
		stroke="var(--ca-repeats)"
		stroke-width="3"
	/>
	<circle cx={sx(density)} cy={sy(speed)} r="7" fill="var(--ca-changing)" />
	<Readout
		id="ca-speed"
		order={2}
		label="Moving"
		value="{Math.round(speed * 100)}% of cars move each step (flow law {Math.round(
			law(density) * 100
		)}%)"
	>
		<Label
			x={920}
			y={100}
			text="{Math.round(speed * 100)}% of cars moving"
			anchor="end"
			size={18}
			weight={700}
			color="var(--ca-changing)"
			tabular
		/>
		<Label x={sx(0.5) + 6} y={sy(1) + 14} text="half full" anchor="start" size={11} muted />
		<Label
			x={920}
			y={126}
			text={density <= 0.5 ? 'free flow: jams dissolve' : 'jammed: waves drift backwards'}
			anchor="end"
			size={13}
			weight={600}
		/>
	</Readout>
</g>
