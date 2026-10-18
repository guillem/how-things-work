<script lang="ts">
	/**
	 * The rate equations integrated from switch-on: the pump comes on at 0 with an empty upper
	 * level and an empty cavity. Top: the laser with its shutter, at the moment the traces have
	 * reached. Middle: output power against time (linear on the spiking step, logarithmic on the
	 * Q-switch step, where a zoom on the pulse sits beside it). Bottom: the inversion relative to
	 * threshold. The traces are computed once per setting and revealed as the step plays; under
	 * reduced motion they are shown whole.
	 */
	import { Axes, Label, clamp, niceMax, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		energyBetween,
		indexAt,
		peaks,
		pulseWidth,
		qSwitchTheory,
		relaxation,
		run,
		steadyState,
		pumpRate,
		thresholdInversion,
		thresholdPump
	} from '../laser';
	import { pow10, sci, tracePath, watts } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const R = 0.95;
	const q = $derived(String(step.hints?.phase ?? 'spiking') === 'qswitch');
	const pump = $derived(Number(q ? (params.qPump ?? 5) : (params.spikePump ?? 3)));
	const holdUs = $derived(q ? Number(params.hold ?? 400) : 0);
	const windowUs = $derived(q ? holdUs + 300 : 1000);
	const nth = thresholdInversion(R);

	const trace = $derived(run({ R, pump, openAt: holdUs * 1e-6, until: windowUs * 1e-6 }));
	const tUs = $derived(Float64Array.from(trace.t, (v) => v * 1e6));
	const inv = $derived(Float64Array.from(trace.n2, (v) => v / nth));
	const cw = $derived(steadyState({ medium: 'four', R }, pumpRate(pump)).out);

	/** Simulated time reached: the whole window in 9 s of the step. */
	const PLAY = 9;
	const nowUs = $derived(reduced ? windowUs : clamp(t / PLAY) * windowUs);
	const iNow = $derived(indexAt(trace, nowUs * 1e-6));
	const shutterOpen = $derived(nowUs >= holdUs);

	// ---------------------------------------------------------------- charts
	const X0 = 96;
	const X1 = $derived(q ? 600 : 900);
	const sx = $derived(scale([0, windowUs], [X0, X1]));
	const outMax = $derived(niceMax(Math.max(...peaks(trace).map((p) => p.out), cw) * 1.05));
	const LOG_LO = -3;
	const LOG_HI = 5;
	const syLin = $derived(scale([0, outMax], [360, 196]));
	const syLog = scale([LOG_LO, LOG_HI], [360, 196]);
	const yOut = $derived((w: number) =>
		q ? syLog(clamp(Math.log10(Math.max(w, 1e-30)), LOG_LO, LOG_HI)) : syLin(w)
	);
	const outPath = $derived(tracePath(tUs, trace.out, sx, yOut, 0, windowUs));
	const invMax = $derived(q ? niceMax(Math.max(1, ...inv) * 1.05) : 2);
	const syInv = $derived(scale([0, invMax], [560, 420]));
	const invPath = $derived(tracePath(tUs, inv, sx, (v) => syInv(Math.min(v, invMax)), 0, windowUs));

	// spiking: the period of the late, small oscillations against the linearised formula
	const r = $derived(pump / thresholdPump(R));
	const theory = $derived(relaxation(R, r));
	/** Period of the spikes in the last 30% of the trace, and whether they are small by then. */
	const measured = $derived.by(() => {
		const late = peaks(trace, windowUs * 0.7e-6);
		if (late.length < 3) return null;
		const swing = Math.max(...late.map((p) => p.out)) / cw - 1;
		return {
			period: ((late[late.length - 1].t - late[0].t) / (late.length - 1)) * 1e6,
			small: swing < 0.3
		};
	});
	const formula = $derived(`2π/ω = ${(1e6 / theory.freq).toFixed(2)} µs`);
	const spikeText = $derived(
		!measured
			? ''
			: measured.small
				? `late spikes every ${measured.period.toFixed(2)} µs · formula ${formula}`
				: `spikes every ${measured.period.toFixed(2)} µs: still too large for ${formula}`
	);
	const firstSpike = $derived(peaks(trace)[0] ?? null);

	// Q-switch: the pulse, its numbers and Wagner–Lengyel's prediction
	const pulse = $derived.by(() => {
		if (!q || holdUs === 0) return null;
		const ni = trace.n2[indexAt(trace, holdUs * 1e-6)];
		if (ni <= nth) return null;
		const th = qSwitchTheory(ni, nth);
		const width = pulseWidth(trace) * 1e9;
		/** Half the zoom window, ns: two widths either side of the peak. */
		const span = niceMax(Math.max(40, 2 * width));
		const i0 = indexAt(trace, trace.peak.t - span * 1e-9);
		const i1 = indexAt(trace, trace.peak.t + span * 1e-9);
		let nf = Infinity;
		for (let i = i0; i < Math.min(trace.t.length, i1 + 2000); i++) nf = Math.min(nf, trace.n2[i]);
		const rel = Float64Array.from(trace.t.subarray(i0, i1 + 1), (v) => (v - trace.peak.t) * 1e9);
		const pw = trace.out.subarray(i0, i1 + 1);
		return {
			ni,
			nf,
			nfTheory: th.nf,
			rel,
			pw,
			width,
			span,
			energy: energyBetween(trace, holdUs * 1e-6, trace.peak.t + 1e-6)
		};
	});
	const span = $derived(pulse?.span ?? 80);
	const zx = $derived(scale([-span, span], [690, 920]));
	/** The zoom's power unit: kW for a giant pulse, W for a weak one. */
	const zUnit = $derived(trace.peak.out >= 1e3 ? 1e3 : 1);
	const zy = $derived(scale([0, niceMax(trace.peak.out / zUnit)], [360, 196]));
	const pulsePath = $derived(
		pulse ? tracePath(pulse.rel, pulse.pw, zx, (v) => zy(v / zUnit), -span, span) : ''
	);
	const pulseShown = $derived(pulse !== null && nowUs * 1e-6 >= trace.peak.t);

	// ---------------------------------------------------------------- the laser on top
	const AX = 82;
	const outNow = $derived(trace.out[iNow]);
	const beamW = $derived(
		shutterOpen && outNow > 1e-3 ? 2 + 16 * clamp((Math.log10(outNow) + 3) / 8) : 0
	);
</script>

<g>
	<defs>
		<clipPath id="ls-dyn-clip">
			<rect x={X0 - 4} y="180" width={Math.max(0, sx(nowUs) - X0 + 4)} height="400" />
		</clipPath>
	</defs>

	<!-- the laser -->
	<rect x="56" y={AX - 40} width="8" height="80" rx="2" fill="var(--ls-mirror)" />
	<rect
		x="140"
		y={AX - 22}
		width="230"
		height="44"
		rx="10"
		fill="var(--ls-rod)"
		stroke="var(--ls-rod-edge)"
		stroke-width="1.5"
	/>
	<rect x="160" y={AX + 30} width="190" height="7" rx="3" fill="var(--ls-pump)" opacity="0.8" />
	<Readout id="pumplbl"
		><Label
			x={150}
			y={AX + 52}
			text="pump {pump.toFixed(1)} W from 0 µs"
			size={12}
			anchor="start"
		/></Readout
	>
	{#if q}
		<rect
			x="420"
			y={AX - 26}
			width="56"
			height="52"
			rx="6"
			fill={shutterOpen ? 'none' : 'var(--ls-shutter)'}
			fill-opacity="0.25"
			stroke="var(--ls-shutter)"
			stroke-width="2"
		/>
		{#if !shutterOpen}
			<line
				x1="428"
				x2="468"
				y1={AX - 18}
				y2={AX + 18}
				stroke="var(--ls-shutter)"
				stroke-width="3"
			/>
			<line
				x1="468"
				x2="428"
				y1={AX - 18}
				y2={AX + 18}
				stroke="var(--ls-shutter)"
				stroke-width="3"
			/>
		{/if}
		<Readout
			id="shutter"
			order={2}
			label="Shutter"
			value={holdUs === 0 ? 'never closed' : `closed until ${holdUs} µs, then open`}
		>
			<Label
				x={448}
				y={AX + 52}
				text={shutterOpen ? 'shutter open' : 'shutter closed'}
				size={12}
				weight={600}
				color="var(--ls-shutter)"
			/>
		</Readout>
	{/if}
	<rect x="540" y={AX - 40} width="8" height="80" rx="2" fill="var(--ls-mirror)" opacity="0.9" />
	{#if beamW > 0}
		<rect x="64" y={AX - 3} width="476" height="6" fill="var(--ls-beam)" opacity="0.35" />
		<rect
			x="548"
			y={AX - beamW / 2}
			width="210"
			height={beamW}
			fill="var(--ls-beam)"
			opacity="0.8"
		/>
	{/if}
	<Readout id="now" order={1} label="Time" value="{nowUs.toFixed(0)} µs after switch-on">
		<Label
			x={940}
			y={AX - 14}
			text="t = {nowUs.toFixed(0)} µs"
			size={14}
			weight={600}
			anchor="end"
			tabular
		/>
		<Label x={940} y={AX + 8} text="output {watts(outNow)}" size={12} anchor="end" tabular />
	</Readout>

	<!-- output against time -->
	{#if q}
		<Axes
			{sx}
			sy={syLog}
			xLabel="µs"
			yLabel="output (W)"
			yTicks={[-3, -1, 1, 3, 5]}
			yFormat={(v: number) => pow10(v)}
		/>
		{#if holdUs > 0}
			<rect
				x={X0}
				y="196"
				width={sx(holdUs) - X0}
				height="164"
				fill="var(--ls-shutter)"
				opacity="0.08"
			/>
			<Readout id="closedlbl"
				><Label
					x={X0 + 8}
					y={212}
					anchor="start"
					text="shutter closed"
					size={11}
					color="var(--ls-shutter)"
				/></Readout
			>
		{/if}
	{:else}
		<Axes {sx} sy={syLin} xLabel="µs" yLabel="output (W)" />
		<line
			x1={X0}
			x2={X1}
			y1={syLin(cw)}
			y2={syLin(cw)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<Readout id="steadylbl"
			><Label
				x={X0 + 60}
				y={186}
				text="- - - steady output {watts(cw)}"
				size={11}
				muted
				anchor="start"
			/></Readout
		>
	{/if}
	<g clip-path="url(#ls-dyn-clip)">
		<path d={outPath} fill="none" stroke="var(--ls-beam)" stroke-width="1.6" />
	</g>

	<!-- inversion against time -->
	<Axes {sx} sy={syInv} xLabel="µs" yLabel="ΔN / Nₜₕ" yTicks={q ? undefined : [0, 1, 2]} />
	<line
		x1={X0}
		x2={X1}
		y1={syInv(1)}
		y2={syInv(1)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout id="thl"
		><Label x={X1} y={syInv(1) - 6} text="threshold" size={11} muted anchor="end" /></Readout
	>
	<g clip-path="url(#ls-dyn-clip)">
		<path d={invPath} fill="none" stroke="var(--ls-inv)" stroke-width="2" />
	</g>
	{#if !reduced && nowUs < windowUs}
		<line
			x1={sx(nowUs)}
			x2={sx(nowUs)}
			y1="222"
			y2="560"
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			opacity="0.6"
		/>
	{/if}

	{#if q}
		<!-- the pulse, zoomed -->
		{#if pulse}
			<g opacity={pulseShown ? 1 : 0.25}>
				<Axes
					sx={zx}
					sy={zy}
					xLabel="ns"
					yLabel={zUnit === 1 ? 'W' : 'kW'}
					xTicks={[-span, -span / 2, 0, span / 2, span]}
				/>
				{#if pulseShown}
					<path d={pulsePath} fill="none" stroke="var(--ls-beam)" stroke-width="2.2" />
				{/if}
				<Readout id="zoomlbl"
					><Label x={805} y={186} text="the pulse, zoomed" size={12} weight={600} /></Readout
				>
			</g>
			<Readout
				id="peak"
				order={3}
				label="Pulse"
				value="peak {watts(trace.peak.out)}, {pulse.width.toFixed(0)} ns wide, {(
					pulse.energy * 1e3
				).toFixed(2)} mJ"
				opacity={pulseShown ? 1 : 0}
			>
				<Label
					x={690}
					y={410}
					text="peak {watts(trace.peak.out)}"
					size={14}
					weight={600}
					anchor="start"
					opacity={pulseShown ? 1 : 0}
				/>
				<Label
					x={690}
					y={432}
					text="{pulse.width.toFixed(0)} ns wide (half height)"
					size={12}
					anchor="start"
					opacity={pulseShown ? 1 : 0}
				/>
				<Label
					x={690}
					y={452}
					text="energy {(pulse.energy * 1e3).toFixed(2)} mJ"
					size={12}
					anchor="start"
					opacity={pulseShown ? 1 : 0}
				/>
				<Label
					x={690}
					y={472}
					text="{sci(trace.peak.out / cw, 2)} × the steady {watts(cw)}"
					size={12}
					anchor="start"
					opacity={pulseShown ? 1 : 0}
				/>
			</Readout>
			<Readout
				id="wagner"
				order={4}
				label="Inversion before / after"
				value="{(pulse.ni / nth).toFixed(2)} → {(pulse.nf / nth).toFixed(
					3
				)} Nₜₕ (Wagner–Lengyel, pump and decay neglected: {(pulse.nfTheory / nth).toFixed(3)})"
				opacity={pulseShown ? 1 : 0}
			>
				<Label
					x={690}
					y={502}
					text="inversion {(pulse.ni / nth).toFixed(2)} → {(pulse.nf / nth).toFixed(3)} Nₜₕ"
					size={12}
					anchor="start"
					tabular
					opacity={pulseShown ? 1 : 0}
				/>
				<Label
					x={690}
					y={522}
					text="Wagner–Lengyel predicts {(pulse.nfTheory / nth).toFixed(3)} Nₜₕ"
					size={12}
					muted
					anchor="start"
					tabular
					opacity={pulseShown ? 1 : 0}
				/>
				<Label
					x={690}
					y={540}
					text="(neglecting pump and decay during the pulse)"
					size={11}
					muted
					anchor="start"
					opacity={pulseShown ? 1 : 0}
				/>
			</Readout>
		{:else}
			<Readout
				id="nopulse"
				order={3}
				label="Pulse"
				value={holdUs === 0
					? 'none: the laser only spikes'
					: 'none yet: the inversion never passed threshold before the shutter opened'}
			>
				<Label
					x={690}
					y={260}
					text={holdUs === 0
						? 'no shutter: the laser only spikes'
						: 'shutter opened below threshold:'}
					size={12}
					anchor="start"
				/>
				{#if holdUs > 0}
					<Label x={690} y={280} text="no giant pulse" size={12} anchor="start" />
				{/if}
			</Readout>
		{/if}
	{:else}
		<Readout
			id="period"
			order={2}
			label="Spike period, late in the trace"
			value={spikeText || '—'}
			opacity={nowUs > windowUs * 0.95 ? 1 : 0}
		>
			<Label
				x={X1}
				y={186}
				text={spikeText}
				size={12}
				anchor="end"
				tabular
				opacity={nowUs > windowUs * 0.95 ? 1 : 0}
			/>
		</Readout>
		{#if firstSpike}
			<Readout
				id="first"
				order={3}
				label="First spike"
				value="{watts(firstSpike.out)} at {(firstSpike.t * 1e6).toFixed(0)} µs"
				opacity={nowUs * 1e-6 >= firstSpike.t ? 1 : 0}
			>
				<Label
					x={sx(firstSpike.t * 1e6) + 10}
					y={yOut(firstSpike.out) + 12}
					text="first spike {watts(firstSpike.out)}"
					size={12}
					anchor="start"
					opacity={nowUs * 1e-6 >= firstSpike.t ? 1 : 0}
				/>
			</Readout>
		{/if}
	{/if}
</g>
