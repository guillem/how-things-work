<script lang="ts">
	/**
	 * Stopping distances from 100 km/h on the chosen road: a locked wheel, the best constant pedal
	 * (found by bisection), ABS, and the floor set by the peak friction held all the way.
	 */
	import { Label, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { compareStops, SURFACES, type Surface } from '../model';

	let { params }: StageProps = $props();

	const surface = $derived(String(params.surface ?? 'dry') as Surface);

	const list = $derived(compareStops(surface));
	const sx = $derived(scale([0, niceMax(list[0].d * 1.05)], [290, 880]));
	const colour = (i: number) =>
		i === 0 ? 'var(--ab-lock)' : i === 3 ? 'var(--ab-band)' : `var(--ab-${surface})`;
</script>

<g class="ab-compare">
	<Label
		x={480}
		y={60}
		text="Stopping from 100 km/h on {SURFACES[surface].label.toLowerCase()}"
		anchor="middle"
		size={20}
		weight={700}
	/>
	{#each list as r, i (r.label)}
		{@const y = 130 + i * 105}
		<Readout id="ab-bar-{i}" order={i + 1} label={r.label} value="{r.d.toFixed(0)} m ({r.note})">
			<Label x={270} y={y + 6} text={r.label} anchor="end" size={16} weight={600} />
			<Label x={270} y={y + 28} text={r.note} anchor="end" size={12} muted />
			<rect
				x={sx(0)}
				y={y - 16}
				width={sx(r.d) - sx(0)}
				height="40"
				rx="6"
				fill={colour(i)}
				opacity={i === 3 ? 0.35 : 0.85}
			/>
			<Label
				x={sx(r.d) + 10}
				y={y + 10}
				text="{r.d.toFixed(0)} m"
				anchor="start"
				size={18}
				weight={700}
				tabular
			/>
		</Readout>
	{/each}
</g>
