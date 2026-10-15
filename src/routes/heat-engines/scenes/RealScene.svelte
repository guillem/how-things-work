<script lang="ts">
	/**
	 * Step 10: measured efficiencies of real engines and power stations
	 * (`real-data.ts`, every value with its source), as horizontal bars from 0
	 * to 100%. The best petrol engine carries a tick at its ideal Otto cycle
	 * (13 : 1). The bars grow in over the first second.
	 */
	import { Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ottoEfficiency } from '../engine';
	import { REAL } from '../real-data';
	import { pct } from './colors';

	let { t, reduced }: StageProps = $props();
	const grow = $derived(reduced ? 1 : smoothstep(0.1, 1.2, t));

	const sx = scale([0, 1], [430, 900]);
	const ROW = 48;
	const rowY = (i: number) => 120 + i * ROW + (i >= 2 ? 40 : 0);
	const ideal = ottoEfficiency(13);
	const fmtV = (v: number | readonly [number, number]) =>
		typeof v === 'number' ? pct(v, v === 0.6222 ? 1 : 0) : `${pct(v[0])}–${pct(v[1])}`;
</script>

<g>
	<Readout id="groups">
		<text x={40} y={92} font-size="13" font-weight="600">Cars</text>
		<text x={40} y={rowY(2) - 28} font-size="13" font-weight="600">Power stations</text>
	</Readout>
	{#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
		<line
			x1={sx(v)}
			x2={sx(v)}
			y1={96}
			y2={rowY(REAL.length - 1) + 22}
			stroke="var(--stage-grid)"
		/>
		<text x={sx(v)} y={rowY(REAL.length - 1) + 40} font-size="11" text-anchor="middle" class="muted"
			>{pct(v)}</text
		>
	{/each}
	<text x={900} y={rowY(REAL.length - 1) + 58} font-size="11" text-anchor="end" class="muted"
		>share of the fuel's heat turned into work or electricity</text
	>
	{#each REAL as e, i (e.id)}
		{@const y = rowY(i)}
		{@const lo = typeof e.value === 'number' ? 0 : e.value[0]}
		{@const hi = typeof e.value === 'number' ? e.value : e.value[1]}
		<Readout
			id="r-{e.id}"
			order={i + 1}
			label={e.label}
			value={fmtV(e.value)}
			note={e.source}
			marker={i + 1}
			at={[400, y]}
		>
			<text x={410} y={y + 5} font-size="13" text-anchor="end">{e.label}</text>
			<text x={410} y={y + 20} font-size="11" text-anchor="end" class="muted">{e.source}</text>
		</Readout>
		<rect
			x={sx(lo * grow)}
			y={y - 12}
			width={Math.max(0, sx(hi * grow) - sx(lo * grow))}
			height="24"
			rx="4"
			fill={e.id === 'record'
				? 'var(--he-work)'
				: e.group === 'car'
					? 'var(--he-loop)'
					: 'var(--he-cold)'}
			opacity={typeof e.value === 'number' ? 0.8 : 0.45}
		/>
		<Label
			x={sx(hi * grow) + 8}
			y={y + 5}
			text={fmtV(e.value)}
			anchor="start"
			size={13}
			weight={600}
		/>
	{/each}
	<!-- the ideal cycle of the best petrol engine -->
	<line
		x1={sx(ideal)}
		x2={sx(ideal)}
		y1={rowY(1) - 16}
		y2={rowY(1) + 16}
		stroke="var(--he-loop)"
		stroke-width="2.5"
		stroke-dasharray="3 3"
		opacity={grow}
	/>
	<Readout id="ideal" order={10} label="Its ideal Otto cycle (13 : 1)" value={pct(ideal)}>
		<Label
			x={sx(ideal) + 6}
			y={rowY(1) - 20}
			text="its ideal cycle at 13 : 1: {pct(ideal)}"
			anchor="start"
			size={11}
			color="var(--he-loop)"
			opacity={grow}
		/>
	</Readout>
</g>
