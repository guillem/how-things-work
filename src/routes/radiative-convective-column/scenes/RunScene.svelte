<script lang="ts">
	/**
	 * The reader's column (τ∞ from the slider, in equilibrium) is given twice the absorber.
	 * `phase` 'instant': the temperatures held, the emission level jumps up into colder air and
	 * the outgoing infrared drops below the sunlight absorbed (bars on the right). 'run': real time
	 * from a day to 30 years on a log scale (the step's clock runs it in about 16 s): the profile
	 * moves from the old equilibrium (dashed) toward the new one (dotted), and the charts on the
	 * right trace the outgoing infrared and the change at the ground and in the stratosphere.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		PS,
		TAU_N,
		absorbedSolar,
		altitudeAt,
		diagnose,
		instantOLR,
		temperatureAt
	} from '../model';
	import { C, dK, fmtK, fmtKm, fmtW, runOf, settingsOf, solve } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'run'));
	const s = $derived(settingsOf(params, step));
	const before = $derived(solve(s));
	const afterSettings = $derived({ ...s, tau: 2 * s.tau });
	const after = $derived(solve(afterSettings));
	const solar = absorbedSolar();
	const olrInstant = $derived(instantOLR(before.column, afterSettings));

	const LAST_DAY = 365.25 * 30;
	const run = $derived(runOf(s, before.column, LAST_DAY));

	// ---- time ----------------------------------------------------------------
	const RUN_SECONDS = 16;
	const u = $derived(phase === 'instant' ? 0 : reduced ? 1 : clamp((t - 0.8) / RUN_SECONDS));
	const logLast = Math.log10(LAST_DAY);
	/** Index into the run (0 is the moment of the change; 1… are log-spaced from day 1). */
	const idx = $derived(u <= 0 ? 0 : 1 + Math.round(u * (run.length - 2)));
	const snap = $derived(run[Math.min(idx, run.length - 1)]);
	const col = $derived({ ...before.column, settings: afterSettings, ts: snap.ts, T: snap.T });
	const dNow = $derived(diagnose(col));
	const when = (days: number) =>
		days < 1
			? 'the moment of the change'
			: days < 60
				? `day ${Math.round(days)}`
				: days < 730
					? `month ${Math.round(days / 30.44)}`
					: `year ${(days / 365.25).toFixed(days < 3650 ? 1 : 0)}`;

	// ---- profile chart -------------------------------------------------------
	const Z_MAX = 40;
	const Y0 = 494;
	const Y1 = 100;
	const sy = scale([0, Z_MAX], [Y0, Y1]);
	const sxT = scale([170, 380], [96, 520]);
	const path = (ts: number, T: number[], z: number[], convective: boolean) => {
		let d = convective
			? `M${sxT(ts).toFixed(1)} ${sy(0).toFixed(1)}`
			: `M${sxT(T[0]).toFixed(1)} ${sy(z[0]).toFixed(1)}`;
		for (let k = 0; k < T.length && z[k] <= Z_MAX + 2; k++)
			d += `L${sxT(T[k]).toFixed(1)} ${sy(z[k]).toFixed(1)}`;
		return d;
	};
	const beforePath = $derived(path(before.column.ts, before.column.T, before.d.z, s.convection));
	const afterPath = $derived(path(after.column.ts, after.column.T, after.d.z, s.convection));
	const nowPath = $derived(path(col.ts, col.T, dNow.z, s.convection));

	/** The new emission level (τ = 1 for twice the absorber) on the column of this moment. */
	const pNew = $derived(PS * (2 * s.tau) ** (-1 / TAU_N));
	const zNew = $derived(altitudeAt(col.grid, dNow.z, pNew));
	const tNew = $derived(temperatureAt(col, pNew));
	const zOld = $derived(before.d.emissionZ);
	const tOld = $derived(before.d.emissionT);

	// ---- time charts ---------------------------------------------------------
	const R = { x0: 640, x1: 912 };
	const sxTime = scale([0, logLast], [R.x0, R.x1]);
	const timeTicks = [1, 7, 30.44, 365.25, 3652.5, LAST_DAY].map(Math.log10);
	const timeNames = ['1 d', 'wk', 'mo', '1 yr', '10 yr', '30 yr'];
	const syOLR = scale([180, 250], [236, 96]);
	const syDT = scale([-10, 20], [494, 312]);
	const series = $derived(
		run.slice(1).map((r) => ({
			x: Math.log10(r.days),
			olr: r.olr,
			ground: r.ts - before.column.ts,
			strat: temperatureAt({ ...before.column, T: r.T }, 10) - temperatureAt(before.column, 10)
		}))
	);
	const shownSeries = $derived(series.slice(0, Math.max(0, idx)));
	const stratNow = $derived(temperatureAt(col, 10) - temperatureAt(before.column, 10));
	const stratEnd = $derived(temperatureAt(after.column, 10) - temperatureAt(before.column, 10));

	// ---- instant bars --------------------------------------------------------
	const sxBar = scale([0, 260], [R.x0 + 8, R.x1 - 8]);
</script>

<g>
	<Axes
		sx={sxT}
		{sy}
		xTicks={[180, 210, 240, 270, 300, 330, 360]}
		yTicks={[0, 10, 20, 30, 40]}
		xLabel="temperature (K)"
		yLabel="altitude (km)"
	/>
	<path d={beforePath} fill="none" stroke={C.ref} stroke-width="1.8" stroke-dasharray="7 5" />
	{#if phase === 'run'}
		<path
			d={afterPath}
			fill="none"
			stroke={C.tropo}
			stroke-width="1.5"
			stroke-dasharray="2 4"
			opacity="0.8"
		/>
	{/if}
	<path d={nowPath} fill="none" stroke={C.tropo} stroke-width="3" stroke-linejoin="round" />
	<circle
		cx={sxT(Math.min(375, col.ts))}
		cy={sy(0)}
		r="6.5"
		fill={C.tropo}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>

	<!-- emission levels: old (dashed) and new -->
	{#if zOld !== null}
		<line
			x1={sxT(170)}
			x2={sxT(380)}
			y1={sy(zOld)}
			y2={sy(zOld)}
			stroke={C.emission}
			stroke-width="1.2"
			stroke-dasharray="5 4"
			opacity="0.75"
		/>
		<Readout id="em-old">
			<Label
				x={sxT(380) - 4}
				y={sy(zOld) + 16}
				anchor="end"
				text="old: {fmtKm(zOld)} · {Math.round(tOld ?? 0)} K"
				size={11}
				color={C.emissionText}
				tabular
			/>
		</Readout>
	{/if}
	{#if 2 * s.tau > 1}
		<line
			x1={sxT(170)}
			x2={sxT(380)}
			y1={sy(zNew)}
			y2={sy(zNew)}
			stroke={C.emission}
			stroke-width="2"
		/>
		<circle cx={sxT(tNew)} cy={sy(zNew)} r="5" fill={C.emission} />
		<Readout
			id="em-new"
			order={2}
			label="New emission level"
			value="{fmtKm(zNew)}, {fmtK(tNew)}"
			color={C.emission}
		>
			<Label
				x={sxT(380) - 4}
				y={sy(zNew) - 24}
				anchor="end"
				text="new emission level (τ = 1)"
				size={12}
				weight={600}
				color={C.emissionText}
			/>
			<Label
				x={sxT(380) - 4}
				y={sy(zNew) - 8}
				anchor="end"
				text="{fmtKm(zNew)} · {fmtK(tNew)}"
				size={12}
				weight={600}
				color={C.emissionText}
				tabular
			/>
		</Readout>
	{/if}
	{#if phase === 'run'}
		<Readout id="key">
			<Label
				x={sxT(
					Math.max(
						before.column.T[before.column.T.length - 1],
						after.column.T[after.column.T.length - 1]
					)
				) + 10}
				y={sy(36)}
				anchor="start"
				text="dashed: before · dotted: the new balance"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- header -->
	<Readout
		id="when"
		order={1}
		label={phase === 'instant' ? 'Temperatures held' : 'Time since the change'}
		value={phase === 'instant'
			? `τ∞ ${s.tau.toFixed(1)} → ${(2 * s.tau).toFixed(1)}`
			: when(snap.days)}
	>
		<Label
			x={96}
			y={36}
			anchor="start"
			text={phase === 'instant'
				? `τ∞ ${s.tau.toFixed(1)} → ${(2 * s.tau).toFixed(1)}, temperatures held`
				: `τ∞ ${s.tau.toFixed(1)} → ${(2 * s.tau).toFixed(1)} · ${when(snap.days)}`}
			size={16}
			weight={700}
			tabular
		/>
		<Label
			x={96}
			y={58}
			anchor="start"
			text="ground {fmtK(col.ts)} ({dK(col.ts - before.column.ts)}) · outgoing {fmtW(
				phase === 'instant' ? olrInstant : dNow.olr
			)}"
			size={12}
			muted
			tabular
		/>
	</Readout>

	{#if phase === 'instant'}
		<!-- sunlight in against infrared out -->
		<Readout id="bars-title">
			<Label
				x={R.x0}
				y={160}
				anchor="start"
				text="the planet's energy budget"
				size={13}
				weight={600}
			/>
		</Readout>
		{#each [{ id: 'in', y: 190, v: solar, c: C.sun, tc: C.sunText, name: 'sunlight absorbed' }, { id: 'was', y: 260, v: before.d.olr, c: C.ref, tc: 'var(--stage-ink-muted)', name: 'infrared out before' }, { id: 'out', y: 330, v: olrInstant, c: C.ir, tc: C.irText, name: 'infrared out now' }] as b (b.id)}
			<rect
				x={sxBar(0)}
				y={b.y}
				width={sxBar(b.v) - sxBar(0)}
				height="22"
				rx="4"
				fill={b.c}
				opacity="0.9"
			/>
			<Readout id="bar-{b.id}" order={3} label={b.name} value={fmtW(b.v)} color={b.c}>
				<Label
					x={sxBar(0)}
					y={b.y - 8}
					anchor="start"
					text="{b.name} · {fmtW(b.v)}"
					size={12}
					color={b.tc}
					tabular
				/>
			</Readout>
		{/each}
		<rect
			x={R.x0}
			y="388"
			width={R.x1 - R.x0}
			height="64"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Readout
			id="forcing"
			order={4}
			label="Forcing"
			value="{fmtW(solar - olrInstant)} in, not out"
			color={C.ir}
		>
			<Label
				x={R.x0 + 14}
				y={414}
				anchor="start"
				text="forcing {fmtW(solar - olrInstant)}: more in than out"
				size={14}
				weight={700}
				tabular
			/>
			<Label
				x={R.x0 + 14}
				y={436}
				anchor="start"
				text="so the column warms until it balances"
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<!-- outgoing infrared -->
		<Axes
			sx={sxTime}
			sy={syOLR}
			xTicks={timeTicks}
			xFormat={() => ''}
			yTicks={[180, 200, 220, 240]}
		/>
		<line
			x1={R.x0}
			x2={R.x1}
			y1={syOLR(solar)}
			y2={syOLR(solar)}
			stroke={C.sun}
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<Readout id="sunline">
			<Label
				x={R.x1 - 4}
				y={syOLR(solar) - 7}
				anchor="end"
				text="sunlight in, {fmtW(solar)}"
				size={11}
				color={C.sunText}
			/>
		</Readout>
		<path
			d={linePath(
				shownSeries,
				(p) => p.x,
				(p) => clamp(p.olr, 180, 250),
				sxTime,
				syOLR
			)}
			fill="none"
			stroke={C.ir}
			stroke-width="2.5"
		/>
		<Readout id="olr" order={3} label="Infrared out" value={fmtW(dNow.olr)} color={C.ir}>
			<Label
				x={R.x0}
				y={80}
				anchor="start"
				text="infrared out {fmtW(dNow.olr)}"
				size={12}
				weight={600}
				color={C.irText}
				tabular
			/>
		</Readout>

		<!-- temperature changes -->
		<Axes
			sx={sxTime}
			sy={syDT}
			xTicks={timeTicks}
			xFormat={(v: number) => timeNames[timeTicks.indexOf(v)] ?? ''}
			yTicks={[-10, 0, 10, 20]}
		/>
		<path
			d={linePath(
				shownSeries,
				(p) => p.x,
				(p) => clamp(p.ground, -10, 20),
				sxTime,
				syDT
			)}
			fill="none"
			stroke={C.tropo}
			stroke-width="2.5"
		/>
		<path
			d={linePath(
				shownSeries,
				(p) => p.x,
				(p) => clamp(p.strat, -10, 20),
				sxTime,
				syDT
			)}
			fill="none"
			stroke={C.strat}
			stroke-width="2.5"
		/>
		<Readout
			id="dground"
			order={4}
			label="Ground"
			value={dK(col.ts - before.column.ts)}
			color={C.tropo}
		>
			<Label
				x={R.x0}
				y={282}
				anchor="start"
				text="change at the ground {dK(col.ts - before.column.ts)} (to {dK(
					after.column.ts - before.column.ts
				)})"
				size={12}
				weight={600}
				color={C.tropoText}
				tabular
			/>
		</Readout>
		<Readout
			id="dstrat"
			order={5}
			label="Stratosphere (10 hPa)"
			value="{dK(stratNow)} (to {dK(stratEnd)})"
			color={C.strat}
		>
			<Label
				x={R.x0}
				y={300}
				anchor="start"
				text="stratosphere, 10 hPa {dK(stratNow)} (to {dK(stratEnd)})"
				size={12}
				weight={600}
				color={C.stratText}
				tabular
			/>
		</Readout>
	{/if}
</g>
