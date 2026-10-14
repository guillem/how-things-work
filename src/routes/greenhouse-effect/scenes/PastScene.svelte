<script lang="ts">
	/**
	 * 1850–2020. Upper chart: AR6's effective radiative forcing, CO₂ alone and
	 * everything together. Lower chart: the two-layer model driven by that
	 * forcing (all feedbacks, AR6's sensitivity) against the measured global
	 * temperature (AR6's four-dataset mean), both relative to 1850–1900. A cursor
	 * sweeps through the years; reduced motion shows the finished chart.
	 */
	import { Axes, Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { periodMean, scenarioRun } from '../climate';
	import { GMST, GMST_FIRST_YEAR } from '../scenarios-data';
	import { signed } from './ir';

	let { t, reduced }: StageProps = $props();

	const Y0 = 1850;
	const Y1 = 2020;
	const run = scenarioRun('ssp245').filter((y) => y.year >= Y0 && y.year <= Y1);
	const obs = GMST.map((v, i) => ({ year: GMST_FIRST_YEAR + i, v })).filter((d) => d.year <= Y1);
	const modelMean = periodMean(run, 2011, 2020);
	const obsMean = obs.filter((d) => d.year >= 2011).reduce((a, d) => a + d.v, 0) / 10;

	const sx = scale([Y0, Y1], [96, 900]);
	const fy = scale([-2, 3.5], [240, 60]);
	const ty = scale([-0.6, 1.4], [550, 310]);

	const u = $derived(reduced ? 1 : smoothstep(0.5, 14, t));
	const year = $derived(Math.round(Y0 + (Y1 - Y0) * u));
	const upTo = <T extends { year: number }>(a: readonly T[]) => a.filter((d) => d.year <= year);

	const co2Path = $derived(
		linePath(
			upTo(run),
			(d) => d.year,
			(d) => d.co2,
			sx,
			fy
		)
	);
	const totalPath = $derived(
		linePath(
			upTo(run),
			(d) => d.year,
			(d) => d.co2 + d.other,
			sx,
			fy
		)
	);
	const modelPath = $derived(
		linePath(
			upTo(run),
			(d) => d.year,
			(d) => d.T,
			sx,
			ty
		)
	);
	const obsPath = $derived(
		linePath(
			upTo(obs),
			(d) => d.year,
			(d) => d.v,
			sx,
			ty
		)
	);
	const now = $derived(run[year - Y0]);
	const done = $derived(year >= Y1);
	const volcanoes = [
		{ year: 1883, name: 'Krakatoa' },
		{ year: 1963, name: 'Agung' },
		{ year: 1991, name: 'Pinatubo' }
	];
</script>

<g>
	<!-- forcing -->
	<Axes
		{sx}
		sy={fy}
		xTicks={[1850, 1900, 1950, 2000, 2020]}
		yTicks={[-2, -1, 0, 1, 2, 3]}
		xFormat={(v: number) => String(v)}
		yLabel="forcing, W/m²"
	/>
	<line
		x1={sx(Y0)}
		x2={sx(Y1)}
		y1={fy(0)}
		y2={fy(0)}
		stroke="var(--stage-ink-muted)"
		opacity="0.5"
	/>
	<path d={totalPath} fill="none" stroke="var(--stage-ink-muted)" stroke-width="2" />
	<path d={co2Path} fill="none" stroke="var(--gh-co2)" stroke-width="2.5" />
	<Readout id="f-key">
		<Label x={110} y={78} text="CO₂" anchor="start" size={12} weight={700} color="var(--gh-co2)" />
		<Label
			x={146}
			y={78}
			text="everything: other gases, aerosols (cooling), the Sun, volcanoes"
			anchor="start"
			size={12}
			weight={600}
			muted
		/>
	</Readout>
	<Readout
		id="f-now"
		order={1}
		label="Forcing in {year}"
		value="CO₂ {now.co2.toFixed(2)}, all {(now.co2 + now.other).toFixed(2)} W/m²"
	>
		<Label
			x={sx(Y1) + 8}
			y={fy(now.co2) + 4}
			text={now.co2.toFixed(1)}
			anchor="start"
			size={11}
			color="var(--gh-co2)"
		/>
	</Readout>

	<!-- temperature -->
	<Axes
		{sx}
		sy={ty}
		xTicks={[1850, 1900, 1950, 2000, 2020]}
		yTicks={[-0.5, 0, 0.5, 1]}
		xFormat={(v: number) => String(v)}
		yFormat={(v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')}
		yLabel="warming since 1850–1900, °C"
	/>
	<path d={obsPath} fill="none" stroke="var(--stage-ink-muted)" stroke-width="1.3" />
	<path d={modelPath} fill="none" stroke="var(--gh-warm)" stroke-width="3" />
	{#each volcanoes as v (v.year)}
		{#if year >= v.year + 2}
			<Readout id="v-{v.year}">
				<line
					x1={sx(v.year + 1)}
					x2={sx(v.year + 1)}
					y1={ty(run[v.year + 1 - Y0].T) + 8}
					y2={ty(-0.42)}
					stroke="var(--stage-line)"
					stroke-dasharray="2 2"
				/>
				<Label x={sx(v.year + 1)} y={ty(-0.42) + 14} text={v.name} size={11} muted />
			</Readout>
		{/if}
	{/each}
	<Readout id="t-key">
		<Label
			x={110}
			y={330}
			text="model"
			anchor="start"
			size={12}
			weight={700}
			color="var(--gh-warm)"
		/>
		<Label x={160} y={330} text="measured" anchor="start" size={12} weight={600} muted />
	</Readout>
	<Readout
		id="year"
		order={0}
		label="Year"
		value="{year}: CO₂ {now.ppm.toFixed(0)} ppm, model {signed(now.T, 2)} °C"
	>
		<Label
			x={900}
			y={44}
			text="{year} · CO₂ {now.ppm.toFixed(0)} ppm"
			anchor="end"
			size={13}
			weight={700}
		/>
	</Readout>
	{#if done}
		<Readout
			id="check"
			order={2}
			label="2011–2020"
			value="model {signed(modelMean, 2)} °C · measured {signed(obsMean, 2)} °C"
			color="var(--gh-warm)"
		>
			<Label
				x={110}
				y={360}
				text="2011–2020: model {signed(modelMean, 2)} °C · measured {signed(obsMean, 2)} °C"
				anchor="start"
				size={13}
				weight={700}
			/>
		</Readout>
	{/if}
</g>
