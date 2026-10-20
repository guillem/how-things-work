<script lang="ts">
	/**
	 * Efficiency against pressure ratio, 4 to 70, for the gas turbine alone and for the combined
	 * plant (three levels, 12 MPa, 10 K pinch), with each curve's best ratio marked.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { gasTurbine, plant } from '../model';

	let { params }: StageProps = $props();

	const tit = $derived(Number(params.tit ?? 1650));
	const ratios = Array.from({ length: 67 }, (_, i) => 4 + i);
	const rows = $derived(
		ratios.map((r) => ({
			r,
			gt: gasTurbine(r, tit).efficiency * 100,
			cc: plant({ ratio: r, tit, pHigh: 12, pinch: 10, levels: 3 }).efficiency * 100
		}))
	);
	const bestOf = (key: 'gt' | 'cc') =>
		rows.reduce((b, row) => (row[key] > b[key] ? row : b), rows[0]);
	const bestGt = $derived(bestOf('gt'));
	const bestCc = $derived(bestOf('cc'));
	const sx = scale([4, 70], [90, 880]);
	const sy = scale([20, 70], [520, 70]);
</script>

<g class="cc-ratio">
	<Axes {sx} {sy} xLabel="pressure ratio" yLabel="efficiency (%)" />
	<path
		d={linePath(
			rows,
			(d) => d.r,
			(d) => d.gt,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--cc-gt)"
		stroke-width="3"
	/>
	<path
		d={linePath(
			rows,
			(d) => d.r,
			(d) => d.cc,
			sx,
			sy
		)}
		fill="none"
		stroke="var(--cc-st)"
		stroke-width="3"
	/>
	{#each [{ b: bestGt, key: 'gt' as const, name: 'gas turbine alone', color: 'var(--cc-gt)' }, { b: bestCc, key: 'cc' as const, name: 'combined plant', color: 'var(--cc-st)' }] as m (m.key)}
		<line
			x1={sx(m.b.r)}
			y1={sy(m.b[m.key])}
			x2={sx(m.b.r)}
			y2={sy(20)}
			stroke={m.color}
			stroke-dasharray="4 4"
		/>
		<circle cx={sx(m.b.r)} cy={sy(m.b[m.key])} r="6" fill={m.color} />
		<Readout
			id="cc-best-{m.key}"
			order={m.key === 'cc' ? 1 : 2}
			label="Best for the {m.name}"
			value="ratio {m.b.r}: {m.b[m.key].toFixed(1)}%"
		>
			<Label
				x={sx(m.b.r)}
				y={sy(m.b[m.key]) - 14}
				text="{m.name}: best at {m.b.r}, {m.b[m.key].toFixed(1)}%"
				anchor={m.b.r > 50 ? 'end' : 'middle'}
				color={m.color}
				weight={700}
			/>
		</Readout>
	{/each}
	<Label x={880} y={60} text="turbine inlet {tit} K" anchor="end" size={12} muted />
</g>
