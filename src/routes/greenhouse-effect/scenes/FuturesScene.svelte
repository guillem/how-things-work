<script lang="ts">
	/**
	 * The five AR6 scenarios to 2100. Upper chart: CO₂ emissions (history, then
	 * each scenario; the chosen one bold). Lower chart: the two-layer model's
	 * warming, driven by AR6's forcing for each scenario, with the feedbacks the
	 * reader leaves on; the chosen scenario is drawn year by year from 2015.
	 * Right: IPCC AR6 SPM Table SPM.1's warming for 2081–2100 (very likely range
	 * and best estimate) with this model's value as a dot.
	 */
	import { Axes, Label, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ALL_FEEDBACKS,
		SCENARIOS,
		SPM1,
		periodMean,
		scenarioRun,
		type Feedbacks,
		type ScenarioId
	} from '../climate';
	import { signed } from './ir';

	let { step, t, params, reduced }: StageProps = $props();

	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const on = (id: string) => !offered.has(id) || params[id] !== false;
	const fb: Feedbacks = $derived({ water: on('water'), ice: on('ice'), clouds: on('clouds') });
	const changed = $derived(!fb.water || !fb.ice || !fb.clouds);
	const chosen = $derived(
		(SCENARIOS.some((s) => s.id === params.scenario) ? params.scenario : 'ssp245') as ScenarioId
	);

	const Y0 = 1950;
	const Y1 = 2100;
	const sx = scale([Y0, Y1], [90, 690]);
	const ey = scale([-20, 140], [226, 56]);
	const ty = scale([-0.5, 6.5], [556, 300]);

	const baseRuns = Object.fromEntries(
		SCENARIOS.map((s) => [s.id, scenarioRun(s.id, ALL_FEEDBACKS)])
	) as Record<ScenarioId, ReturnType<typeof scenarioRun>>;
	const runs = $derived(
		changed
			? (Object.fromEntries(SCENARIOS.map((s) => [s.id, scenarioRun(s.id, fb)])) as typeof baseRuns)
			: baseRuns
	);
	const longTerm = $derived(
		Object.fromEntries(SCENARIOS.map((s) => [s.id, periodMean(runs[s.id], 2081, 2100)])) as Record<
			ScenarioId,
			number
		>
	);
	const visible = (run: ReturnType<typeof scenarioRun>, a: number, b: number) =>
		run.filter((y) => y.year >= a && y.year <= b);

	const u = $derived(reduced ? 1 : smoothstep(0.5, 15, t));
	const year = $derived(Math.round(2015 + (Y1 - 2015) * u));
	const color = (id: ScenarioId) => `var(--gh-${id})`;

	const emPath = (id: ScenarioId, to = Y1) =>
		linePath(
			visible(baseRuns[id], 2014, to),
			(d) => d.year,
			(d) => d.emissions,
			sx,
			ey
		);
	const histEm = linePath(
		visible(baseRuns.ssp245, Y0, 2014),
		(d) => d.year,
		(d) => d.emissions,
		sx,
		ey
	);
	const tPath = (run: ReturnType<typeof scenarioRun>, a: number, b: number) =>
		linePath(
			visible(run, a, b),
			(d) => d.year,
			(d) => d.T,
			sx,
			ty
		);
	const now = $derived(runs[chosen][year - 1750]);
	const name = $derived(SCENARIOS.find((s) => s.id === chosen)!.name);

	// SPM.1 column
	const BX = 740;
	const BW = 38;
</script>

<g>
	<!-- emissions -->
	<Axes
		{sx}
		sy={ey}
		xTicks={[1950, 2000, 2050, 2100]}
		yTicks={[0, 40, 80, 120]}
		xFormat={(v: number) => String(v)}
		yLabel="CO₂ emissions, billion tonnes a year"
	/>
	<line
		x1={sx(Y0)}
		x2={sx(Y1)}
		y1={ey(0)}
		y2={ey(0)}
		stroke="var(--stage-ink-muted)"
		opacity="0.6"
	/>
	<path d={histEm} fill="none" stroke="var(--stage-ink)" stroke-width="2" />
	{#each SCENARIOS as s (s.id)}
		<path
			d={emPath(s.id)}
			fill="none"
			stroke={color(s.id)}
			stroke-width={s.id === chosen ? 3 : 1.5}
			opacity={s.id === chosen ? 1 : 0.55}
		/>
	{/each}
	{#each SCENARIOS as s (s.id)}
		{@const end = baseRuns[s.id][Y1 - 1750].emissions}
		<Readout id="em-{s.id}">
			<Label
				x={sx(Y1) + 6}
				y={ey(end) + 4 + (s.id === 'ssp126' ? -6 : s.id === 'ssp119' ? 6 : 0)}
				text={s.name}
				anchor="start"
				size={11}
				weight={s.id === chosen ? 700 : 500}
				color={color(s.id)}
			/>
		</Readout>
	{/each}

	<!-- warming -->
	<Axes
		{sx}
		sy={ty}
		xTicks={[1950, 2000, 2050, 2100]}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xFormat={(v: number) => String(v)}
		yFormat={(v: number) => (v > 0 ? `+${v}` : String(v))}
		yLabel="warming since 1850–1900, °C"
	/>
	<line
		x1={sx(Y0)}
		x2={sx(Y1)}
		y1={ty(1.5)}
		y2={ty(1.5)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	<Readout id="15">
		<Label x={sx(Y0) + 6} y={ty(1.5) - 6} text="1.5 °C" anchor="start" size={11} muted />
	</Readout>
	<path d={tPath(runs.ssp245, Y0, 2014)} fill="none" stroke="var(--stage-ink)" stroke-width="2" />
	{#each SCENARIOS as s (s.id)}
		{#if s.id !== chosen}
			<path
				d={tPath(runs[s.id], 2014, Y1)}
				fill="none"
				stroke={color(s.id)}
				stroke-width="1.3"
				opacity="0.45"
			/>
		{/if}
	{/each}
	{#if changed}
		<path
			d={tPath(baseRuns[chosen], Y0, Y1)}
			fill="none"
			stroke={color(chosen)}
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.8"
		/>
	{/if}
	<path d={tPath(runs[chosen], 2014, year)} fill="none" stroke={color(chosen)} stroke-width="3.2" />
	<circle cx={sx(year)} cy={ty(now.T)} r="4.5" fill={color(chosen)} />
	<Readout
		id="now"
		order={0}
		label={name}
		value="{year}: {now.emissions.toFixed(0)} Gt CO₂ a year, {now.ppm.toFixed(0)} ppm, {signed(
			now.T,
			1
		)} °C"
		color={color(chosen)}
	>
		<Label
			x={100}
			y={318}
			text="{name} · {year}: {now.ppm.toFixed(0)} ppm, {signed(now.T, 1)} °C"
			anchor="start"
			size={13}
			weight={700}
			color={color(chosen)}
		/>
	</Readout>
	{#if changed}
		<Readout id="ghost">
			<Label x={100} y={334} text="dashed: all feedbacks on" anchor="start" size={11} muted />
		</Readout>
	{/if}

	<!-- SPM.1 2081–2100 -->
	<Readout id="spm-title">
		<Label x={BX + 100} y={250} text="Warming in 2081–2100" size={13} weight={700} />
		<Label x={BX + 100} y={266} text="bar: IPCC, very likely range" size={11} muted />
		<Label x={BX + 100} y={281} text="dot: this model" size={11} muted />
	</Readout>
	<line
		x1={BX - 6}
		x2={BX + 5 * BW}
		y1={ty(1.5)}
		y2={ty(1.5)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	{#each SCENARIOS as s, i (s.id)}
		{@const [best, lo, hi] = SPM1[s.id].long}
		{@const x = BX + i * BW + BW / 2}
		{@const sel = s.id === chosen}
		<rect
			x={x - 9}
			y={ty(hi)}
			width="18"
			height={ty(lo) - ty(hi)}
			rx="4"
			fill={color(s.id)}
			opacity={sel ? 0.55 : 0.25}
		/>
		<line
			x1={x - 12}
			x2={x + 12}
			y1={ty(best)}
			y2={ty(best)}
			stroke={color(s.id)}
			stroke-width="3"
		/>
		<circle
			cx={x}
			cy={ty(longTerm[s.id])}
			r={sel ? 5 : 4}
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width={sel ? 2.2 : 1.5}
		/>
		<Readout id="spm-{s.id}">
			<Label
				{x}
				y={574}
				text={s.name.slice(3)}
				size={11}
				weight={sel ? 700 : 500}
				color={color(s.id)}
			/>
		</Readout>
		{#if sel}
			<Readout
				id="spm-sel"
				order={1}
				label="2081–2100"
				value="IPCC {best} °C ({lo}–{hi}) · model {longTerm[s.id].toFixed(1)} °C"
			>
				<Label
					x={BX + 100}
					y={308}
					text="IPCC {best} °C · model {longTerm[s.id].toFixed(1)}"
					size={12}
					weight={700}
				/>
			</Readout>
		{/if}
	{/each}
</g>
