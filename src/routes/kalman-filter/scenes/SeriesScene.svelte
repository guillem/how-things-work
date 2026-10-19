<script lang="ts">
	/**
	 * The scalar random walk over 80 s (../model.ts `randomWalk`, `scalarFilter`): the buoy's
	 * true position (line), the sensor's readings (dots), the filter's estimate with its own
	 * ±2σ band; below, the gain at each reading against the steady gain from the Riccati
	 * equation (dashed). Hint `compare` adds the running mean and the mean of the last 10
	 * readings, with each one's error. The run is drawn a reading every 0.3 s (reduced motion:
	 * all of it). The noise streams are fixed, so the controls rescale the same run.
	 */
	import { Axes, Label, areaPath, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { movingAverage, randomWalk, rms, runningMean, scalarFilter, steadyGain } from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const N = 80;
	const q = $derived(Number(params.walkQ ?? 0.5));
	const r = $derived(Number(params.walkR ?? 2));
	const compare = $derived(step.hints?.compare === true);

	// seed 35: a run whose errors are close to the long-run averages the model tests check
	const run = $derived(randomWalk(N, q, r, 35, 0));
	const f = $derived(scalarFilter(run.z, q, r));
	const mean = $derived(runningMean(run.z));
	const ma = $derived(movingAverage(run.z, 10));
	const ss = $derived(q > 0 ? steadyGain(q, r) : null);

	const k = $derived(reduced ? N : clamp(Math.floor(t / 0.3) + 1, 1, N));
	const idx = Array.from({ length: N }, (_, i) => i);
	const shown = $derived(idx.slice(0, k));

	const X0 = 96;
	const X1 = 900;
	const sx = scale([0, N - 1], [X0, X1]);
	// y range: the truth and readings, rounded out
	const yr = $derived.by(() => {
		const lo = Math.min(...run.truth, ...run.z);
		const hi = Math.max(...run.truth, ...run.z);
		const pad = Math.max(1, (hi - lo) * 0.08);
		return [Math.floor(lo - pad), Math.ceil(hi + pad)] as [number, number];
	});
	const sy = $derived(scale(yr, [350, 100]));
	const ticksY = $derived.by(() => {
		const span = yr[1] - yr[0];
		const stepY = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : 2;
		const out: number[] = [];
		for (let v = Math.ceil(yr[0] / stepY) * stepY; v <= yr[1]; v += stepY) out.push(v);
		return out;
	});
	const ky = scale([0, 1], [548, 428]);

	const truthPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => run.truth[i],
			sx,
			sy
		)
	);
	const estPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => f[i].est,
			sx,
			sy
		)
	);
	// the band starts at the second reading (the first one's σ is the sensor's, often off the chart)
	const band = $derived(
		areaPath(
			shown.slice(1),
			(i) => i,
			(i) => f[i].est - 2 * Math.sqrt(f[i].variance),
			(i) => f[i].est + 2 * Math.sqrt(f[i].variance),
			sx,
			sy
		)
	);
	const meanPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => mean[i],
			sx,
			sy
		)
	);
	const maPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => ma[i],
			sx,
			sy
		)
	);
	const gainPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => f[i].K,
			sx,
			ky
		)
	);

	const last = $derived(f[k - 1]);
	const err = (xs: readonly number[]) => rms(xs.slice(10).map((v, i) => v - run.truth[i + 10]));
	const eRaw = $derived(err(run.z));
	const eKf = $derived(err(f.map((s) => s.est)));
	const eMean = $derived(err(mean));
	const eMa = $derived(err(ma));
	const fmt = (v: number, d = 2) => v.toFixed(d);
	const clampY = (v: number) => clamp(v, yr[0], yr[1]);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="A drifting buoy"
		value="drift σ {fmt(q)} m a second, sensor σ {fmt(r)} m"
	>
		<Label
			x={24}
			y={34}
			text="a buoy drifting {q > 0
				? `by σ ${fmt(q)} m a second`
				: 'not at all'}, read by a sensor with σ {fmt(r)} m"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={48} y1={58} y2={58} stroke="var(--stage-ink)" stroke-width="1.6" />
		<Label x={54} y={62} text="true position" size={11} anchor="start" muted />
		<circle cx={150} cy={58} r="3" fill="var(--kf-meas)" />
		<Label x={158} y={62} text="readings" size={11} anchor="start" muted />
		<line x1={226} x2={250} y1={58} y2={58} stroke="var(--kf-est)" stroke-width="2.4" />
		<rect x={256} y={52} width="14" height="12" fill="var(--kf-est)" opacity="0.2" />
		<Label x={276} y={62} text="Kalman estimate ± 2σ" size={11} anchor="start" muted />
		{#if compare}
			<line
				x1={420}
				x2={444}
				y1={58}
				y2={58}
				stroke="var(--kf-pred)"
				stroke-width="2"
				stroke-dasharray="6 4"
			/>
			<Label x={450} y={62} text="mean of all readings" size={11} anchor="start" muted />
			<line
				x1={582}
				x2={606}
				y1={58}
				y2={58}
				stroke="var(--kf-fused)"
				stroke-width="2"
				stroke-dasharray="2 3"
			/>
			<Label x={612} y={62} text="mean of the last 10" size={11} anchor="start" muted />
		{/if}
	</Readout>

	<Axes {sx} {sy} xTicks={[]} yTicks={ticksY} yLabel="position (m)" />
	<path d={band} fill="var(--kf-est)" opacity="0.18" />
	{#each shown as i (i)}
		<circle cx={sx(i)} cy={sy(clampY(run.z[i]))} r="2.6" fill="var(--kf-meas)" opacity="0.75" />
	{/each}
	<path d={truthPath} fill="none" stroke="var(--stage-ink)" stroke-width="1.6" />
	{#if compare}
		<path
			d={meanPath}
			fill="none"
			stroke="var(--kf-pred)"
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
		<path d={maPath} fill="none" stroke="var(--kf-fused)" stroke-width="2" stroke-dasharray="2 3" />
	{/if}
	<path d={estPath} fill="none" stroke="var(--kf-est)" stroke-width="2.4" />

	<!-- the gain -->
	<Axes
		{sx}
		sy={ky}
		xTicks={[0, 10, 20, 30, 40, 50, 60, 70]}
		yTicks={[0, 0.5, 1]}
		yLabel="gain K"
		xLabel="seconds"
	/>
	{#if ss}
		<line
			x1={X0}
			x2={X1}
			y1={ky(ss.K)}
			y2={ky(ss.K)}
			stroke="var(--stage-ink)"
			stroke-dasharray="5 4"
			opacity="0.6"
		/>
	{/if}
	<path d={gainPath} fill="none" stroke="var(--kf-est)" stroke-width="2.2" />
	{#each shown as i (i)}
		<circle cx={sx(i)} cy={ky(f[i].K)} r="2.2" fill="var(--kf-est)" />
	{/each}
	<Readout
		id="gain"
		order={2}
		label="Gain"
		value={ss
			? `K = ${fmt(last.K)} now; settles at ${fmt(ss.K)} (Riccati)`
			: `K = 1/k = ${fmt(last.K, 3)}: the running mean`}
		color="var(--kf-est)"
	>
		<Label
			x={X1}
			y={412}
			text={ss
				? `gain now ${fmt(last.K)} · settles at ${fmt(ss.K)} (dashed)`
				: `no drift: K = 1/k, now ${fmt(last.K, 3)}`}
			size={12}
			anchor="end"
			weight={600}
			tabular
		/>
	</Readout>

	{#if compare}
		<Readout
			id="err"
			order={3}
			label="Typical error (rms)"
			value="readings {fmt(eRaw)} · last 10 {fmt(eMa)} · all {fmt(eMean)} · Kalman {fmt(eKf)} m"
		>
			<rect
				x={X1 - 300}
				y={360}
				width="300"
				height="34"
				rx="6"
				fill="var(--surface)"
				stroke="var(--border)"
				opacity="0.92"
			/>
			<Label
				x={X1 - 290}
				y={374}
				text="typical error: readings {fmt(eRaw)} m · Kalman {fmt(eKf)} m"
				size={11}
				anchor="start"
				halo={false}
				tabular
			/>
			<Label
				x={X1 - 290}
				y={388}
				text="mean of the last 10 {fmt(eMa)} m · of all {fmt(eMean)} m"
				size={11}
				anchor="start"
				halo={false}
				muted
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="sigma"
			order={3}
			label="Estimate's σ"
			value="{fmt(Math.sqrt(last.variance))} m (sensor {fmt(r)} m)"
		>
			<Label
				x={X1}
				y={382}
				text="estimate's σ now {fmt(Math.sqrt(last.variance))} m · the sensor's {fmt(r)} m"
				size={12}
				anchor="end"
				tabular
			/>
		</Readout>
	{/if}
</g>
