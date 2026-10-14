<script lang="ts">
	/**
	 * Warming against the CO₂ emitted since 1850 (as in IPCC AR6 SPM Fig. SPM.10):
	 * the model's total warming in each scenario (all feedbacks, AR6 forcing),
	 * with AR6's TCRE (0.45 °C per 1,000 GtCO₂, likely 0.27–0.63) as a fan from
	 * the origin. A dot runs along the chosen scenario, 1850–2100. The bracket on
	 * the axis is the remaining budget from 2020 for a 50% chance of 1.5 °C
	 * (500 GtCO₂, Table SPM.2).
	 */
	import { Axes, Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SCENARIOS, TCRE, scenarioRun, type ScenarioId } from '../climate';
	import { signed } from './ir';

	let { t, params, reduced }: StageProps = $props();

	const chosen = $derived(
		(SCENARIOS.some((s) => s.id === params.scenario) ? params.scenario : 'ssp245') as ScenarioId
	);
	const runs = Object.fromEntries(
		SCENARIOS.map((s) => [s.id, scenarioRun(s.id).filter((y) => y.year >= 1850)])
	) as Record<ScenarioId, ReturnType<typeof scenarioRun>>;

	const sx = scale([0, 11000], [96, 860]);
	const sy = scale([0, 5.5], [540, 80]);
	const color = (id: ScenarioId) => `var(--gh-${id})`;
	const path = (id: ScenarioId, a: number, b: number) =>
		linePath(
			runs[id].filter((y) => y.year >= a && y.year <= b),
			(d) => d.cumulative,
			(d) => d.T,
			sx,
			sy
		);
	const fan = (k: number) => `M${sx(0)} ${sy(0)} L${sx(11000)} ${sy((k * 11000) / 1000)}`;
	const fanArea = `M${sx(0)} ${sy(0)} L${sx(11000)} ${sy((TCRE[2] * 11000) / 1000)} L${sx(11000)} ${sy((TCRE[1] * 11000) / 1000)} Z`;

	const u = $derived(reduced ? 1 : smoothstep(0.5, 14, t));
	const year = $derived(Math.round(1850 + 250 * u));
	const now = $derived(runs[chosen][year - 1850]);
	const y2020 = runs.ssp245[2020 - 1850];
	const name = $derived(SCENARIOS.find((s) => s.id === chosen)!.name);
</script>

<g>
	<Axes
		{sx}
		{sy}
		xTicks={[0, 2000, 4000, 6000, 8000, 10000]}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xFormat={(v: number) => v.toLocaleString('en-US')}
		yFormat={(v: number) => (v > 0 ? `+${v}` : '0')}
		xLabel="CO₂ emitted since 1850, billion tonnes"
		yLabel="warming since 1850–1900, °C"
	/>
	<clipPath id="budget-clip">
		<rect x={sx(0)} y={sy(5.5)} width={sx(11000) - sx(0)} height={sy(0) - sy(5.5)} />
	</clipPath>
	<g clip-path="url(#budget-clip)">
		<path d={fanArea} fill="var(--stage-ink-muted)" opacity="0.12" />
		<path d={fan(TCRE[0])} stroke="var(--stage-ink-muted)" stroke-dasharray="5 4" fill="none" />
	</g>
	<Readout
		id="tcre"
		order={2}
		label="TCRE (IPCC)"
		value="0.45 °C per 1,000 Gt CO₂ (likely 0.27–0.63)"
	>
		<Label
			x={sx(10400)}
			y={sy((TCRE[0] * 10400) / 1000) + 18}
			text="IPCC: 0.45 °C per 1,000 Gt"
			anchor="end"
			size={12}
			weight={600}
			muted
		/>
		<Label
			x={sx(10400)}
			y={sy((TCRE[0] * 10400) / 1000) + 33}
			text="shaded: likely 0.27–0.63"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>

	<path d={path('ssp245', 1850, 2014)} fill="none" stroke="var(--stage-ink)" stroke-width="2.5" />
	{#each SCENARIOS as s (s.id)}
		<path
			d={path(s.id, 2014, 2100)}
			fill="none"
			stroke={color(s.id)}
			stroke-width={s.id === chosen ? 3.2 : 1.5}
			opacity={s.id === chosen ? 1 : 0.55}
		/>
		{@const end = runs[s.id][runs[s.id].length - 1]}
		<Readout id="end-{s.id}">
			<Label
				x={sx(end.cumulative) + 8}
				y={sy(end.T) + 4}
				text="{s.name} in 2100"
				anchor="start"
				size={11}
				weight={s.id === chosen ? 700 : 500}
				color={color(s.id)}
			/>
		</Readout>
	{/each}

	<!-- 2020 and the 1.5 °C budget -->
	<circle cx={sx(y2020.cumulative)} cy={sy(y2020.T)} r="4" fill="var(--stage-ink)" />
	<Readout id="y2020">
		<Label
			x={sx(y2020.cumulative) - 8}
			y={sy(y2020.T) - 10}
			text="2020"
			anchor="end"
			size={11}
			weight={600}
		/>
	</Readout>
	<line
		x1={sx(y2020.cumulative)}
		x2={sx(y2020.cumulative + 500)}
		y1={sy(0) - 14}
		y2={sy(0) - 14}
		stroke="var(--gh-warm)"
		stroke-width="3"
	/>
	<line
		x1={sx(y2020.cumulative + 500)}
		x2={sx(y2020.cumulative + 500)}
		y1={sy(0) - 22}
		y2={sy(0) - 6}
		stroke="var(--gh-warm)"
		stroke-width="2"
	/>
	<Readout
		id="budget"
		order={3}
		label="Left for 1.5 °C (50% chance)"
		value="about 500 Gt CO₂ from 2020"
	>
		<Label
			x={sx(y2020.cumulative + 500) + 8}
			y={sy(0) - 10}
			text="500 more from 2020: an even chance of 1.5 °C"
			anchor="start"
			size={11}
			weight={600}
			color="var(--gh-warm)"
		/>
	</Readout>

	<circle
		cx={sx(now.cumulative)}
		cy={sy(now.T)}
		r="6"
		fill={color(chosen)}
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout
		id="now"
		order={0}
		label={name}
		value="{year}: {Math.round(now.cumulative).toLocaleString('en-US')} Gt emitted, {signed(
			now.T,
			1
		)} °C"
		color={color(chosen)}
	>
		<Label
			x={110}
			y={100}
			text="{name} · {year}: {Math.round(now.cumulative).toLocaleString(
				'en-US'
			)} Gt CO₂ emitted, {signed(now.T, 1)} °C"
			anchor="start"
			size={13}
			weight={700}
			color={color(chosen)}
		/>
		<Label
			x={110}
			y={118}
			text="{((now.T / Math.max(1, now.cumulative)) * 1000).toFixed(2)} °C per 1,000 Gt so far"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
</g>
