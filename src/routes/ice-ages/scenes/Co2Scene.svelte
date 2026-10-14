<script lang="ts">
	/**
	 * CO₂ from the bubbles in Antarctic ice (Bereiter et al. 2015) over the
	 * Dome C temperature, 800,000 years ago to 1850, on two aligned axes
	 * (CO₂ on the right, temperature on the left), drawn from the oldest ice
	 * forwards; then today's CO₂ (NOAA GML) appears far above the record.
	 * Readouts: the correlation, the glacial and interglacial levels and the
	 * forcing of the glacial drop, all computed from the data.
	 */
	import { Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		CO2,
		CO2_NOW,
		CO2_PREINDUSTRIAL,
		TEMPERATURE,
		co2Forcing,
		correlation,
		resample,
		valueAt
	} from '../milankovitch';

	let { t, reduced }: StageProps = $props();

	const X0 = 96;
	const X1 = 860;
	const sx = scale([800, 0], [X0, X1]);
	const sc = scale([160, 440], [530, 76]);
	/** Temperature drawn so that −10 °C sits at 180 ppm and +4 °C at 300 ppm. */
	const st = scale([-10, 4], [sc(180), sc(300)]);

	const r = correlation(resample(TEMPERATURE, 800, 0), resample(CO2, 800, 0));
	const lgm = valueAt(CO2, 21);
	const max = CO2.reduce((a, b) => (b.v > a.v ? b : a));
	const forcing = co2Forcing(lgm, CO2_PREINDUSTRIAL);

	const reveal = $derived(reduced ? 0 : 800 * (1 - smoothstep(0.4, 9, t)));
	const nowOn = $derived(reduced ? 1 : smoothstep(9.5, 11, t));
	const co2Path = $derived(
		linePath(
			CO2.filter((p) => p.ka >= reveal),
			(p) => p.ka,
			(p) => p.v,
			sx,
			sc
		)
	);
	const tempPath = $derived(
		linePath(
			TEMPERATURE.filter((p) => p.ka >= reveal),
			(p) => p.ka,
			(p) => p.v,
			sx,
			st
		)
	);
</script>

<g>
	<Readout id="title" order={0} label="Antarctic ice" value="CO₂ in the bubbles and temperature">
		<Label
			x={X0}
			y={40}
			text="CO₂ in air bubbles from Antarctic ice, and Antarctic temperature"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	<!-- axes -->
	{#each [180, 220, 260, 300, 340, 380, 420] as v (v)}
		<line x1={X0} x2={X1} y1={sc(v)} y2={sc(v)} stroke="var(--stage-grid)" />
		<text x={X1 + 8} y={sc(v) + 4} font-size="11" class="muted" style:fill="var(--ia-co2)">{v}</text
		>
	{/each}
	<text x={X1 + 8} y={sc(440) - 8} font-size="11" font-weight="600" style:fill="var(--ia-co2)"
		>CO₂, ppm</text
	>
	{#each [-10, -5, 0, 4] as v (v)}
		<text
			x={X0 - 8}
			y={st(v) + 4}
			text-anchor="end"
			font-size="11"
			class="muted"
			style:fill="var(--ia-temp)">{v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}</text
		>
	{/each}
	<text
		x={X0 - 8}
		y={st(4) - 18}
		text-anchor="end"
		font-size="11"
		font-weight="600"
		style:fill="var(--ia-temp)">°C</text
	>
	<line x1={X0} x2={X1} y1={530} y2={530} stroke="var(--stage-line)" />
	{#each [800, 700, 600, 500, 400, 300, 200, 100, 0] as v (v)}
		<text x={sx(v)} y={548} text-anchor="middle" font-size="11" class="muted"
			>{v === 0 ? 'today' : v}</text
		>
	{/each}
	<text x={X1} y={566} text-anchor="end" font-size="11" class="muted">thousand years ago</text>

	<path d={tempPath} fill="none" stroke="var(--ia-temp)" stroke-width="1.4" opacity="0.8" />
	<path d={co2Path} fill="none" stroke="var(--ia-co2)" stroke-width="2" />

	<Readout id="key" order={1} label="Correlation" value="CO₂ and temperature: {r.toFixed(2)}">
		<Label
			x={X0 + 10}
			y={100}
			text="CO₂"
			anchor="start"
			size={13}
			weight={700}
			color="var(--ia-co2)"
		/>
		<Label
			x={X0 + 48}
			y={100}
			text="Antarctic temperature"
			anchor="start"
			size={13}
			weight={700}
			color="var(--ia-temp)"
		/>
		<Label
			x={X0 + 10}
			y={122}
			text="correlation {r.toFixed(2)}"
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>
	{#if reveal <= 20}
		<Readout
			id="levels"
			order={2}
			label="Glacial maximum"
			value="{lgm.toFixed(0)} ppm: {forcing
				.toFixed(1)
				.replace('-', '−')} W/m² vs {CO2_PREINDUSTRIAL}"
			color="var(--ia-co2)"
		>
			<Label
				x={sx(21) - 6}
				y={sc(lgm) + 22}
				text="{lgm.toFixed(0)} ppm 21,000 years ago: {forcing.toFixed(1).replace('-', '−')} W/m²"
				anchor="end"
				size={12}
				weight={600}
				color="var(--ia-co2)"
			/>
		</Readout>
	{/if}

	<!-- today -->
	<g opacity={nowOn}>
		<line
			x1={sx(max.ka) - 30}
			x2={X1}
			y1={sc(max.v)}
			y2={sc(max.v)}
			stroke="var(--ia-co2)"
			stroke-dasharray="4 3"
		/>
		<line
			x1={X1}
			x2={X1}
			y1={sc(280)}
			y2={sc(CO2_NOW.ppm)}
			stroke="var(--ia-now)"
			stroke-width="2.5"
		/>
		<circle
			cx={X1}
			cy={sc(CO2_NOW.ppm)}
			r="7"
			fill="var(--ia-now)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<Readout
			id="now"
			order={3}
			label="Today ({CO2_NOW.year})"
			value="{CO2_NOW.ppm.toFixed(0)} ppm; the record's highest was {max.v.toFixed(0)}"
			color="var(--ia-now)"
		>
			<Label
				x={X1 - 14}
				y={sc(CO2_NOW.ppm) + 5}
				text="{CO2_NOW.year}: {CO2_NOW.ppm.toFixed(0)} ppm"
				anchor="end"
				size={14}
				weight={700}
				color="var(--ia-now)"
			/>
			<Label
				x={sx(max.ka) - 36}
				y={sc(max.v) + 4}
				text="highest in 800,000 years: {max.v.toFixed(0)}"
				anchor="end"
				size={11}
				weight={600}
				color="var(--ia-co2)"
			/>
		</Readout>
	</g>
</g>
