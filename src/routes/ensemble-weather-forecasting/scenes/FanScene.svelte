<script lang="ts">
	/**
	 * A 51-member ensemble of Lorenz 96 seen at one cell ("your town"): the truth, the members
	 * and their average against time, revealed day by day; underneath, the ensemble's spread
	 * against the error of its average (RMS over the 40 cells).
	 *
	 * Hints: `focus` 'fan' (this day's spread and error) | 'stats' (spread, error of the average
	 * and error of the control, averaged over 40 start days, with the climate's levels σ and
	 * √2·σ, for the chosen forecast model). `seed`: the day. Reduced motion shows all 20 days.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { CLIMATE, STEPS_PER_DAY } from '../model';
	import { MEMBERS, TOWN, cachedForecast, cachedVerify, settings, sig } from '../look';

	let { step, t, reduced, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'fan'));
	const s = $derived(settings(step, params));
	const DAYS = 20;
	const SPEED = 1.2;
	const shown = $derived(reduced ? DAYS : Math.min(DAYS, t * SPEED));
	const now = $derived(Math.min(DAYS * STEPS_PER_DAY, Math.floor(shown * STEPS_PER_DAY)));

	const F = $derived(focus === 'stats' ? s.F : 8);
	const f = $derived(cachedForecast(s.seed, s.obsErr, MEMBERS, F, DAYS));
	const idx = Array.from({ length: DAYS * STEPS_PER_DAY + 1 }, (_, i) => i);
	const town = (run: readonly Float64Array[]) => run.map((x) => x[TOWN]);
	const members = $derived([f.control, ...f.members].map(town));
	const truth = $derived(town(f.truth));
	const mean = $derived(idx.map((i) => members.reduce((a, m) => a + m[i], 0) / members.length));
	const avg = $derived(focus === 'stats' ? cachedVerify(0.3, MEMBERS, F, DAYS) : null);
	const lines = $derived(
		avg
			? { meanErr: avg.meanErr, spread: avg.spread, err: avg.err }
			: { meanErr: f.meanErr, spread: f.spread, err: null }
	);

	// ---- geometry ----------------------------------------------------------------------------
	const X0 = 90;
	const X1 = 900;
	const sx = scale([0, DAYS], [X0, X1]);
	const sy = scale([-8, 14], [300, 84]);
	const sy2 = scale([0, 6.5], [540, 384]);
	const day = (i: number) => i / STEPS_PER_DAY;
	const series = (v: readonly number[], y: typeof sy) => {
		let d = '';
		for (const i of idx) {
			const yv = Math.max(y.domain[0], Math.min(y.domain[1], v[i]));
			d += `${i ? 'L' : 'M'}${sx(day(i)).toFixed(1)} ${y(yv).toFixed(1)}`;
		}
		return d;
	};
	const at = (v: readonly number[]) => v[now];
	const ROOT2 = Math.SQRT2 * CLIMATE.sd;
</script>

<g>
	<defs>
		<clipPath id="ewf-fan-clip">
			<rect x="0" y="0" width={sx(shown)} height="600" />
		</clipPath>
	</defs>

	<Readout
		id="title"
		order={1}
		label="Your town (cell 21)"
		value="{MEMBERS} forecasts{focus === 'stats' && s.model !== 'perfect' ? ', wrong model' : ''}"
	>
		<Label
			x={40}
			y={36}
			text="your town: {MEMBERS} forecasts{focus === 'stats'
				? s.model === 'perfect'
					? ', perfect model'
					: `, model heating F = ${F}`
				: ''}"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="day" order={2} label="Time" value="day {shown.toFixed(1)}">
		<Label x={925} y={36} text="day {shown.toFixed(1)}" size={14} anchor="end" tabular />
	</Readout>

	<!-- the plume -->
	<Axes {sx} {sy} yLabel="value" xTicks={[0, 5, 10, 15, 20]} yTicks={[-5, 0, 5, 10]} />
	<g clip-path="url(#ewf-fan-clip)">
		{#each members as m, i (i)}
			<path
				d={series(m, sy)}
				fill="none"
				stroke="var(--ewf-member)"
				stroke-width="1"
				opacity="0.4"
			/>
		{/each}
		<path
			d={series(mean, sy)}
			fill="none"
			stroke="var(--ewf-mean)"
			stroke-width="2.2"
			stroke-dasharray="7 4"
		/>
		<path d={series(truth, sy)} fill="none" stroke="var(--ewf-error)" stroke-width="2.4" />
	</g>
	<Readout id="key-truth" order={5} label="Truth" color="var(--ewf-error)">
		<line x1={560} x2={584} y1={60} y2={60} stroke="var(--ewf-error)" stroke-width="2.4" />
		<Label x={590} y={64} text="truth" size={12} anchor="start" />
	</Readout>
	<Readout id="key-members" order={6} label="Members" color="var(--ewf-member)">
		<line x1={640} x2={664} y1={60} y2={60} stroke="var(--ewf-member)" stroke-width="1.5" />
		<Label x={670} y={64} text="members" size={12} anchor="start" />
	</Readout>
	<Readout id="key-mean" order={7} label="Their average" color="var(--ewf-mean)">
		<line
			x1={745}
			x2={769}
			y1={60}
			y2={60}
			stroke="var(--ewf-mean)"
			stroke-width="2.2"
			stroke-dasharray="7 4"
		/>
		<Label x={775} y={64} text="their average" size={12} anchor="start" />
	</Readout>

	<!-- spread against error -->
	<Axes
		{sx}
		sy={sy2}
		xLabel="days"
		yLabel="RMS"
		xTicks={[0, 5, 10, 15, 20]}
		yTicks={[0, 2, 4, 6]}
	/>
	<Readout id="lower-title">
		<Label
			x={X1}
			y={374}
			text={avg
				? 'over the whole circle, averaged over 40 start days'
				: 'over the whole circle, this day'}
			size={12}
			weight={600}
			anchor="end"
		/>
	</Readout>
	{#if avg}
		{#each [CLIMATE.sd, ROOT2] as lv (lv)}
			<line
				x1={X0}
				x2={X1}
				y1={sy2(lv)}
				y2={sy2(lv)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1"
				stroke-dasharray="3 4"
			/>
		{/each}
		<Readout id="lv1">
			<Label x={X1 - 4} y={sy2(CLIMATE.sd) + 14} text="σ = 3.6" size={11} muted anchor="end" />
			<Label x={X1 - 4} y={sy2(ROOT2) - 6} text="√2·σ = 5.1" size={11} muted anchor="end" />
		</Readout>
	{/if}
	<g clip-path="url(#ewf-fan-clip)">
		{#if lines.err}
			<path
				d={series(lines.err, sy2)}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
				stroke-dasharray="2 3"
			/>
		{/if}
		<path d={series(lines.meanErr, sy2)} fill="none" stroke="var(--ewf-error)" stroke-width="2.2" />
		<path d={series(lines.spread, sy2)} fill="none" stroke="var(--ewf-spread)" stroke-width="2.2" />
	</g>
	<Readout
		id="spread"
		order={3}
		label="Spread"
		value={sig(at(lines.spread))}
		color="var(--ewf-spread)"
	>
		<Label
			x={X0 + 8}
			y={400}
			text="spread {sig(at(lines.spread))}"
			size={13}
			weight={600}
			color="var(--ewf-spread)"
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="error" order={4} label="Error of the average" value={sig(at(lines.meanErr))}>
		<Label
			x={X0 + 120}
			y={400}
			text="error of the average {sig(at(lines.meanErr))}"
			size={13}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	{#if lines.err}
		<Readout id="control" order={5} label="Error of one forecast" value={sig(at(lines.err))}>
			<Label
				x={X0 + 330}
				y={400}
				text="one forecast {sig(at(lines.err))}"
				size={13}
				muted
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}
</g>
