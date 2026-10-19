<script lang="ts">
	/**
	 * The innovations as a health check (./runs.ts `checkRun`): 200 s of the plane tracker on a
	 * drive simulated from its motion model (σ 0.4 m/s²), GPS σ 5 m, the filter's process noise
	 * set to the `ratio` control times the true one. Top, each second's innovation along x
	 * divided by the σ the filter predicted for it (the first 10 s left out), with the ±2 band;
	 * bottom, the innovations' autocorrelation at lags of 1 to 10 s (the mean of the x and y
	 * axes) against the white-noise band ±2/√N, and the spread and correlation readouts. The
	 * innovations are drawn over the first 4 s, then the bars grow (reduced motion: all).
	 */
	import { Axes, Label, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { autocorrelation, mahalanobis2 } from '../model';
	import { CHECK, checkRun } from './runs';

	let { t, params, reduced }: StageProps = $props();

	const ratio = $derived(Number(params.ratio ?? 1));
	const run = $derived(checkRun(ratio));
	const FROM = 10;
	const steps = $derived(run.steps.slice(FROM));
	const nx = $derived(steps.map((s) => s.innov![0] / Math.sqrt(s.S![0][0])));
	const ny = $derived(steps.map((s) => s.innov![1] / Math.sqrt(s.S![1][1])));
	const ac = $derived.by(() => {
		const a = autocorrelation(nx, 10);
		const b = autocorrelation(ny, 10);
		return a.map((v, i) => (v + b[i]) / 2);
	});
	const M = $derived(nx.length);
	const band = $derived(2 / Math.sqrt(2 * M));
	const spread = $derived(
		Math.sqrt(steps.reduce((s, st) => s + mahalanobis2(st.innov!, st.S!), 0) / (2 * M))
	);
	const within = $derived([...nx, ...ny].filter((v) => Math.abs(v) <= 2).length / (2 * M));
	const lagsOut = $derived(ac.filter((v) => Math.abs(v) > band).length);

	const shown = $derived(reduced ? M : clamp(Math.floor(t * 50), 0, M));
	const grow = $derived(reduced ? 1 : smoothstep(4, 5, t));

	const sx = scale([FROM, CHECK.n - 1], [96, 900]);
	const sy = scale([-4.5, 4.5], [310, 90]);
	const LX0 = 96;
	const LX1 = 470;
	const lx = scale([0.5, 10.5], [LX0, LX1]);
	const ly = scale([-0.6, 0.6], [560, 400]);
	const verdict = $derived(
		lagsOut <= 1 && spread > 0.85 && spread < 1.15
			? 'no mismatch seen: white, with the spread it predicted'
			: ac[0] > band
				? 'correlated and too wide: the filter lags (process noise too small)'
				: ac[0] < -band
					? 'negatively correlated: the filter chases the noise (too big)'
					: 'off the spread it predicted'
	);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Innovations"
		value="the filter's process noise × {ratio} the true one"
	>
		<Label
			x={24}
			y={34}
			text="190 innovations along x, each ÷ the σ the filter predicted · its process noise × {ratio} the truth's"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={[10, 50, 100, 150, 200]}
		yTicks={[-4, -2, 0, 2, 4]}
		xLabel="seconds"
		yLabel="ν ÷ σ"
	/>
	<rect
		x={sx(FROM)}
		y={sy(2)}
		width={sx(CHECK.n - 1) - sx(FROM)}
		height={sy(-2) - sy(2)}
		fill="var(--kf-est)"
		opacity="0.08"
	/>
	{#each nx.slice(0, shown) as v, i (i)}
		{@const c = clamp(v, -4.5, 4.5)}
		<line
			x1={sx(FROM + i)}
			x2={sx(FROM + i)}
			y1={sy(0)}
			y2={sy(c)}
			stroke={Math.abs(v) > 2 ? 'var(--kf-bad)' : 'var(--kf-meas)'}
			stroke-width="2"
		/>
	{/each}

	<!-- autocorrelation -->
	<Readout id="actitle">
		<Label
			x={LX0}
			y={386}
			text="correlation with the innovation k seconds earlier"
			size={12}
			anchor="start"
			weight={600}
		/>
	</Readout>
	<Axes
		sx={lx}
		sy={ly}
		xTicks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
		yTicks={[-0.5, 0, 0.5]}
		xLabel="lag k (s)"
		grid={false}
	/>
	<rect
		x={LX0}
		y={ly(band)}
		width={LX1 - LX0}
		height={ly(-band) - ly(band)}
		fill="var(--kf-est)"
		opacity="0.14"
	/>
	<line x1={LX0} x2={LX1} y1={ly(0)} y2={ly(0)} stroke="var(--stage-line)" />
	{#each ac as v, i (i)}
		{@const h = clamp(v, -0.6, 0.6) * grow}
		<rect
			x={lx(i + 1) - 11}
			y={Math.min(ly(0), ly(h))}
			width="22"
			height={Math.abs(ly(h) - ly(0))}
			rx="2"
			fill={Math.abs(v) > band ? 'var(--kf-bad)' : 'var(--kf-est)'}
			opacity="0.85"
		/>
	{/each}

	<g opacity={grow}>
		<Readout
			id="lag1"
			order={2}
			label="Lag-1 correlation"
			value="{ac[0] >= 0 ? '+' : '−'}{Math.abs(ac[0]).toFixed(2)} (white: within ±{band.toFixed(
				2
			)})"
		>
			<Label
				x={540}
				y={420}
				text="lag-1 correlation {ac[0] >= 0 ? '+' : '−'}{Math.abs(ac[0]).toFixed(
					2
				)} (white: within ±{band.toFixed(2)})"
				size={13}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout
			id="spread"
			order={3}
			label="Spread ÷ predicted"
			value="{spread.toFixed(2)} ({Math.round(within * 100)} % within ±2)"
		>
			<Label
				x={540}
				y={446}
				text="spread ÷ predicted σ: {spread.toFixed(2)} · {Math.round(within * 100)} % within ±2"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="verdict" order={4} label="Verdict" value={verdict}>
			<Label
				x={540}
				y={484}
				text={verdict}
				size={12}
				anchor="start"
				weight={600}
				color={verdict.startsWith('no mismatch') ? 'var(--kf-fused)' : 'var(--kf-bad-text)'}
			/>
		</Readout>
	</g>
</g>
