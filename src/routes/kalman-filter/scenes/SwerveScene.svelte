<script lang="ts">
	/**
	 * A corner (../model.ts `swerve`, ./runs.ts `swerveRun`): 20 s straight at 8 m/s, a quarter
	 * turn to the left over 6 s, straight again; GPS σ 3 m. The filter allows for the
	 * `allowance` control's acceleration. Left, the map: the true path, the estimate's trail
	 * with its 95 % ellipse at every second, red where the truth is outside it, with a red line
	 * from the estimate to the truth. Right, the miss against time with the long semi-axis of
	 * the 95 % ellipse shaded (what the filter claims), and the counts. A second every 0.45 s
	 * (reduced motion: the whole run).
	 */
	import { Axes, Label, clamp, linePath, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ellipse, inside95, positionCov, rms, SWERVE } from '../model';
	import { bounds, ellipseAttrs, fit, fmt, swerveRun } from './runs';

	let { t, params, reduced }: StageProps = $props();

	const q = $derived(Number(params.allowance ?? 0.03));
	const run = $derived(swerveRun(q));
	const N = SWERVE.n;
	const k = $derived(reduced ? N - 1 : clamp(Math.floor(t / 0.45), 1, N - 1));
	const idx = Array.from({ length: N }, (_, i) => i);
	const shown = $derived(idx.slice(0, k + 1));

	const TRUTH = swerveRun(1).truth.states; // the same path whatever the allowance
	const box = bounds(TRUTH);
	const map = fit(box, { x: 24, y: 76, w: 560, h: 480 }, 16);
	const truthPath = TRUTH.map(
		(s, i) => `${i ? 'L' : 'M'}${map.x(s[0]).toFixed(1)} ${map.y(s[1]).toFixed(1)}`
	).join(' ');

	const radius = $derived(run.steps.map((s) => ellipse(positionCov(s.post.P)).a));
	const ins = $derived(run.steps.map((s, i) => inside95(run.truth.states[i], s.post)));
	const trail = $derived(
		shown
			.map((i) => {
				const x = run.steps[i].post.x;
				return `${i ? 'L' : 'M'}${map.x(x[0]).toFixed(1)} ${map.y(x[1]).toFixed(1)}`;
			})
			.join(' ')
	);

	const CX0 = 650;
	const CX1 = 930;
	const sx = scale([0, N - 1], [CX0, CX1]);
	const ymax = $derived(niceMax(Math.max(...run.errors, ...radius) * 1.05));
	const sy = $derived(scale([0, ymax], [330, 100]));
	const errPath = $derived(
		linePath(
			shown,
			(i) => i,
			(i) => run.errors[i],
			sx,
			sy
		)
	);
	const claimPath = $derived(
		`${linePath(
			shown,
			(i) => i,
			(i) => radius[i],
			sx,
			sy
		)} L${sx(k).toFixed(1)} ${sy(0).toFixed(1)} L${sx(0).toFixed(1)} ${sy(0).toFixed(1)} Z`
	);

	const worst = $derived(Math.max(...run.errors));
	const worstAt = $derived(run.errors.indexOf(worst));
	const outside = $derived(ins.filter((v) => !v).length);
	const straight = $derived(rms(run.errors.slice(8, SWERVE.straight)));
	const turnX0 = sx(SWERVE.straight);
	const turnX1 = sx(SWERVE.straight + SWERVE.turn);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="A corner"
		value="the filter allows for {q} m/s² of acceleration"
	>
		<Label
			x={24}
			y={34}
			text="a car turns a corner; the filter allows for σ {q} m/s² of acceleration"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={48} y1={58} y2={58} stroke="var(--stage-ink)" stroke-width="1.6" />
		<Label x={54} y={62} text="true path" size={11} anchor="start" muted />
		<line x1={130} x2={154} y1={58} y2={58} stroke="var(--kf-est)" stroke-width="2.4" />
		<Label
			x={160}
			y={62}
			text="estimate, 95 % ellipse each second"
			size={11}
			anchor="start"
			muted
		/>
		<line x1={360} x2={384} y1={58} y2={58} stroke="var(--kf-bad)" stroke-width="2" />
		<Label x={390} y={62} text="truth outside it" size={11} anchor="start" muted />
	</Readout>

	<!-- the map -->
	<path d={truthPath} fill="none" stroke="var(--stage-ink)" stroke-width="1.6" opacity="0.6" />
	{#each run.fixes.slice(0, k + 1) as z, i (i)}
		{#if z}
			<circle cx={map.x(z[0])} cy={map.y(z[1])} r="2" fill="var(--kf-meas)" opacity="0.5" />
		{/if}
	{/each}
	{#each shown as i (i)}
		{@const b = run.steps[i].post}
		{@const bad = !ins[i]}
		<ellipse
			{...ellipseAttrs(b.P, map.x(b.x[0]), map.y(b.x[1]), map.s)}
			fill={bad ? 'var(--kf-bad)' : 'var(--kf-est)'}
			fill-opacity={i === k ? 0.3 : 0.12}
			stroke={bad ? 'var(--kf-bad)' : 'var(--kf-est)'}
			stroke-width={i === k ? 2 : 1}
			opacity={i === k ? 1 : 0.8}
		/>
		{#if bad}
			<line
				x1={map.x(b.x[0])}
				y1={map.y(b.x[1])}
				x2={map.x(run.truth.states[i][0])}
				y2={map.y(run.truth.states[i][1])}
				stroke="var(--kf-bad)"
				stroke-width="1"
				opacity="0.7"
			/>
		{/if}
	{/each}
	<path d={trail} fill="none" stroke="var(--kf-est)" stroke-width="2" />
	<circle
		cx={map.x(run.truth.states[k][0])}
		cy={map.y(run.truth.states[k][1])}
		r="4.5"
		fill="var(--stage-ink)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>
	<Readout id="scalebar">
		<line
			x1={24}
			x2={24 + 50 * map.s}
			y1={570}
			y2={570}
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<Label x={30 + 50 * map.s} y={574} text="50 m" size={11} anchor="start" muted />
	</Readout>

	<!-- the miss against what the filter claims -->
	<rect
		x={turnX0}
		y={100}
		width={turnX1 - turnX0}
		height={230}
		fill="var(--stage-grid)"
		opacity="0.6"
	/>
	<Label x={(turnX0 + turnX1) / 2} y={96} text="turn" size={11} muted />
	<Axes {sx} {sy} xTicks={[0, 10, 20, 30, 40]} yLabel="m" xLabel="seconds" />
	<path d={claimPath} fill="var(--kf-est)" opacity="0.25" />
	<path d={errPath} fill="none" stroke="var(--kf-bad)" stroke-width="2.2" />
	<Readout id="chartkey">
		<rect x={CX0} y={382} width="16" height="10" fill="var(--kf-est)" opacity="0.35" />
		<Label x={CX0 + 22} y={391} text="what it claims (95 %)" size={11} anchor="start" muted />
		<line
			x1={CX0 + 160}
			x2={CX0 + 180}
			y1={387}
			y2={387}
			stroke="var(--kf-bad)"
			stroke-width="2.2"
		/>
		<Label x={CX0 + 186} y={391} text="its real miss" size={11} anchor="start" muted />
	</Readout>

	<Readout
		id="worst"
		order={2}
		label="Worst miss"
		value="{fmt(worst)} m, claiming ±{fmt(radius[worstAt])} m"
		color="var(--kf-bad-text)"
	>
		<Label
			x={CX0}
			y={426}
			text="worst miss {fmt(worst)} m"
			size={15}
			weight={700}
			anchor="start"
			color="var(--kf-bad-text)"
			tabular
		/>
		<Label
			x={CX0}
			y={446}
			text="while claiming 95 % within {fmt(radius[worstAt])} m"
			size={12}
			anchor="start"
			muted
			tabular
		/>
	</Readout>
	<Readout id="outside" order={3} label="Truth outside the 95 % ellipse" value="{outside} of {N} s">
		<Label
			x={CX0}
			y={476}
			text="truth outside its 95 % ellipse: {outside} of {N} s"
			size={13}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="straight" order={4} label="On the straight" value="rms miss {fmt(straight)} m">
		<Label
			x={CX0}
			y={502}
			text="on the straight: typical miss {fmt(straight)} m (GPS alone {fmt(3 * Math.SQRT2)} m)"
			size={12}
			anchor="start"
			muted
			tabular
		/>
	</Readout>
</g>
