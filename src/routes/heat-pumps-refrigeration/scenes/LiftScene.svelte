<script lang="ts">
	/**
	 * Heating COP against condensing temperature for the ideal R-134a cycle at the chosen
	 * evaporating temperature, under the Carnot reference for the same two temperatures.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle } from '../model';

	let { params }: StageProps = $props();

	const K = (c: number) => c + 273.15;
	const tEvap = $derived(Number(params.tevap ?? 0));
	const tCond = $derived(Number(params.tcond ?? 40));
	const temps = $derived(
		Array.from({ length: 46 }, (_, i) => 25 + i).filter((t) => t > tEvap + 10)
	);
	const rows = $derived(
		temps.map((t) => {
			const c = cycle({ fluid: 'r134a', tEvap: K(tEvap), high: { tCond: K(t) } });
			return { t, cop: c.copHeating, carnot: c.carnotHeating };
		})
	);
	const now = $derived(cycle({ fluid: 'r134a', tEvap: K(tEvap), high: { tCond: K(tCond) } }));
	const sx = scale([25, 70], [90, 880]);
	const sy = scale([0, 16], [520, 70]);
	const clip = (v: number) => Math.min(16, v);
</script>

<g class="hp-lift">
	<Axes {sx} {sy} xLabel="condensing temperature (°C)" yLabel="heating COP" />
	<path
		d={linePath(
			rows,
			(r) => r.t,
			(r) => clip(r.carnot),
			sx,
			sy
		)}
		fill="none"
		stroke="var(--text-muted)"
		stroke-width="2.5"
		stroke-dasharray="7 5"
	/>
	<path
		d={linePath(
			rows,
			(r) => r.t,
			(r) => clip(r.cop),
			sx,
			sy
		)}
		fill="none"
		stroke="var(--hp-hot)"
		stroke-width="3.5"
	/>
	<line
		x1={sx(tCond)}
		y1={sy(0)}
		x2={sx(tCond)}
		y2={sy(clip(now.carnotHeating))}
		stroke="var(--text)"
		stroke-dasharray="4 4"
	/>
	<circle cx={sx(tCond)} cy={sy(clip(now.copHeating))} r="7" fill="var(--hp-hot)" />
	<circle cx={sx(tCond)} cy={sy(clip(now.carnotHeating))} r="5" fill="var(--text-muted)" />
	<Readout
		id="hp-lift-now"
		order={1}
		label="At {tCond} °C"
		value="COP {now.copHeating.toFixed(2)}, Carnot {now.carnotHeating.toFixed(2)}"
	>
		<Label
			x={880}
			y={84}
			text="lift {tCond - tEvap} K: COP {now.copHeating.toFixed(2)}"
			anchor="end"
			size={18}
			weight={700}
			color="var(--hp-hot)"
			tabular
		/>
		<Label
			x={880}
			y={108}
			text="Carnot reference {now.carnotHeating.toFixed(2)}"
			anchor="end"
			size={13}
			muted
			tabular
		/>
		<Label
			x={880}
			y={128}
			text="R-134a, ideal compressor, boiling at {tEvap} °C"
			anchor="end"
			size={12}
			muted
		/>
	</Readout>
	<Readout id="hp-lift-key" order={2} label="Lines" value="red: the R-134a cycle; dashed: Carnot">
		<Label
			x={sx(27)}
			y={sy(clip(rows[0]?.carnot ?? 0)) - 10}
			text="Carnot"
			anchor="start"
			size={12}
			muted
		/>
	</Readout>
</g>
