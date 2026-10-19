<script lang="ts">
	/**
	 * Sensor fusion (./runs.ts `fuseRun`): a 90 s drive, GPS fixes (σ 8 m) every `every`
	 * seconds and an accelerometer good to 0.05 m/s². Three navigators: GPS only (the
	 * constant-velocity filter of the last chapter), the accelerometer only (dead reckoning from
	 * the known start), and both (the accelerometer drives the prediction, GPS corrects it).
	 * Left, the map with each one's trail and 95 % ellipse; right, each one's distance from the
	 * truth against time, and the rms of each. A second of the drive every 0.3 s (reduced
	 * motion: all of it).
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { rms } from '../model';
	import { FUSE, bounds, ellipseAttrs, fit, fmt, fuseRun } from './runs';

	let { t, params, reduced }: StageProps = $props();

	const every = $derived(Math.round(Number(params.every ?? 1)));
	const run = $derived(fuseRun(every));
	const N = FUSE.n;
	const k = $derived(reduced ? N - 1 : clamp(Math.floor(t / 0.3), 1, N - 1));

	const base = fuseRun(1);
	const box = bounds([...base.truth.states, ...base.dead.steps.map((s) => s.post.x)]);
	const map = fit(box, { x: 24, y: 76, w: 540, h: 480 }, 14);
	const pathOf = (pts: readonly (readonly number[])[]) =>
		pts
			.map((p, i) => `${i ? 'L' : 'M'}${map.x(p[0]).toFixed(1)} ${map.y(p[1]).toFixed(1)}`)
			.join(' ');

	const navs = $derived([
		{ id: 'dead', label: 'accelerometer only', color: 'var(--kf-dead)', ...run.dead },
		{ id: 'gps', label: 'GPS only', color: 'var(--kf-gps)', ...run.gps },
		{ id: 'fused', label: 'both, fused', color: 'var(--kf-fused)', ...run.fused }
	]);
	const truthDone = $derived(pathOf(run.truth.states.slice(0, k + 1)));
	const truthAll = pathOf(base.truth.states);
	const fixes = $derived(run.fixes.slice(0, k + 1).flatMap((z, i) => (z ? [{ z, i }] : [])));

	const CX0 = 640;
	const CX1 = 930;
	const sx = scale([0, N - 1], [CX0, CX1]);
	const sy = scale([0, 40], [330, 100]);
	const errPath = (e: readonly number[]) =>
		linePath(
			e.slice(0, k + 1).map((v, i) => ({ i, v: Math.min(v, 40) })),
			(d) => d.i,
			(d) => d.v,
			sx,
			sy
		);
	const score = (e: readonly number[]) => rms(e.slice(5));
</script>

<g>
	<defs>
		<clipPath id="kf-fuse-map">
			<rect x="16" y="70" width="576" height="490" />
		</clipPath>
	</defs>
	<Readout
		id="title"
		order={1}
		label="Fusion"
		value="GPS σ 8 m every {every} s, accelerometer σ 0.05 m/s²"
	>
		<Label
			x={24}
			y={34}
			text="GPS (σ 8 m, a fix every {every === 1
				? 'second'
				: `${every} seconds`}) and an accelerometer (σ 0.05 m/s²)"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={48} y1={58} y2={58} stroke="var(--stage-ink)" stroke-width="1.6" />
		<Label x={54} y={62} text="true path" size={11} anchor="start" muted />
		<circle cx={128} cy={58} r="3" fill="var(--kf-meas)" />
		<Label x={136} y={62} text="GPS fixes" size={11} anchor="start" muted />
	</Readout>

	<!-- the map -->
	<path d={truthAll} fill="none" stroke="var(--stage-ink)" stroke-width="1.2" opacity="0.2" />
	<path d={truthDone} fill="none" stroke="var(--stage-ink)" stroke-width="1.6" opacity="0.75" />
	{#each fixes as f (f.i)}
		<circle cx={map.x(f.z[0])} cy={map.y(f.z[1])} r="2.6" fill="var(--kf-meas)" opacity="0.7" />
	{/each}
	{#each navs as n (n.id)}
		{@const b = n.steps[k].post}
		<path
			d={pathOf(n.steps.slice(0, k + 1).map((s) => s.post.x))}
			fill="none"
			stroke={n.color}
			stroke-width="2.2"
			opacity="0.9"
		/>
		<!-- dead reckoning's ellipse grows large: outlined only, and kept on the map -->
		<ellipse
			{...ellipseAttrs(b.P, map.x(b.x[0]), map.y(b.x[1]), map.s)}
			fill={n.color}
			fill-opacity={n.id === 'dead' ? 0.04 : 0.18}
			stroke={n.color}
			stroke-width="1.6"
			stroke-dasharray={n.id === 'dead' ? '6 4' : undefined}
			clip-path="url(#kf-fuse-map)"
		/>
	{/each}
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

	<!-- the errors against time -->
	<Readout id="charttitle">
		<Label
			x={CX0 + 28}
			y={92}
			text="distance from the truth"
			size={12}
			anchor="start"
			weight={600}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={[0, 30, 60, 90]}
		yTicks={[0, 10, 20, 30, 40]}
		xLabel="seconds"
		yLabel="m"
	/>
	{#each navs as n (n.id)}
		<path d={errPath(n.errors)} fill="none" stroke={n.color} stroke-width="2" />
	{/each}

	{#each navs as n, i (n.id)}
		<Readout
			id={n.id}
			order={2 + i}
			label={n.label}
			value="typical miss {fmt(score(n.errors))} m"
			color={n.color}
		>
			<line
				x1={CX0}
				x2={CX0 + 22}
				y1={404 + i * 30}
				y2={404 + i * 30}
				stroke={n.color}
				stroke-width="3"
			/>
			<Label x={CX0 + 30} y={408 + i * 30} text={n.label} size={13} anchor="start" weight={600} />
			<Label
				x={CX1}
				y={408 + i * 30}
				text="{fmt(score(n.errors))} m"
				size={13}
				anchor="end"
				weight={700}
				color={n.color}
				tabular
			/>
		</Readout>
	{/each}
	<Readout id="rmsnote">
		<Label
			x={CX0}
			y={382}
			text="typical miss over the drive (rms distance)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>
</g>
