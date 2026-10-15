<script lang="ts">
	/**
	 * The real GW150914 strain at Hanford and Livingston (Abbott et al. 2016,
	 * Fig. 1 data from GWOSC; see gw150914.ts), 0.25–0.46 s after 09:50:45 UTC.
	 *
	 * Phases (`step.hints.phase`):
	 *   data — Hanford above, Livingston below. `params.align` slides Hanford 6.9 ms
	 *          earlier, flips it and lays it over Livingston (tweened, as an SVG
	 *          transform of the fixed path); `params.nr` overlays the
	 *          numerical-relativity waveform filtered the same way; `params.hearData`
	 *          plays Livingston's excerpt three times. A playhead sweeps the 0.21 s in 7 s.
	 *   fit  — the two averaged (signal.ts), and below it the frequency from its
	 *          zero crossings (dots) with the leading-order track for
	 *          `params.fitMc`, its coalescence time fitted (gw.ts `fitCoalescence`).
	 * Reduced motion: no playhead; everything else is static anyway.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		GW150914,
		fitChirpMass,
		fitCoalescence,
		frequencyAt,
		horizonRadius,
		minTotalMass,
		separation
	} from '../gw';
	import {
		FIT_WINDOW,
		RATE,
		T0,
		combined,
		hanford,
		livingston,
		measuredTrack,
		nrHanford,
		nrLivingston
	} from '../signal';
	import Row from './Row.svelte';
	import { playSamples, stopAll } from './sound';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'data'));

	const X0 = 84;
	const X1 = 924;
	const TA = 0.25;
	const TB = 0.46;
	const sx = scale([TA, TB], [X0, X1]);
	const AMP = 70; // px per 10⁻²¹
	const pts = (y: readonly number[]) => y.map((v, i) => ({ t: T0 + i / RATE, v }));
	/** A series as a path around y = 0 (up = positive strain). */
	const path = (y: readonly number[]) =>
		linePath(
			pts(y),
			(d) => d.t,
			(d) => d.v,
			sx,
			scale([0, 1], [0, -AMP])
		);
	const pH = path(hanford);
	const pL = path(livingston);
	const pNH = path(nrHanford);
	const pNL = path(nrLivingston);

	// ---- data phase ----------------------------------------------------------------------
	const YH = 150;
	const YL = 380;
	const k = new Tween(0, { duration: 900, easing: cubicInOut });
	$effect(() => {
		const v = params.align ? 1 : 0;
		untrack(() => k.set(v, { duration: reduced ? 0 : 900 }));
	});
	const shiftPx = (GW150914.delay * (X1 - X0)) / (TB - TA);
	const hTransform = $derived(
		`translate(${(-shiftPx * k.current).toFixed(2)} ${(YH + (YL - YH) * k.current).toFixed(1)}) scale(1 ${(1 - 2 * k.current).toFixed(3)})`
	);
	const showNr = $derived(Boolean(params.nr));
	const head = $derived(reduced ? null : TA + ((t % 9) / 7) * (TB - TA));

	let lastHear: number | undefined;
	$effect(() => {
		const c = Number(params.hearData ?? 0);
		untrack(() => {
			if (lastHear !== undefined && c !== lastHear) playSamples(livingston, RATE, 3);
			lastHear = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	// ---- fit phase -------------------------------------------------------------------------
	const best = fitChirpMass(measuredTrack);
	const mc = $derived(Number(params.fitMc ?? 15));
	const fit = $derived(fitCoalescence(measuredTrack, mc));
	const FA = 0.33;
	const FB = 0.43;
	const fx = scale([FA, FB], [X0, X1]);
	const FY0 = 300;
	const FY1 = 500;
	const fy = scale([0, 200], [FY1, FY0]);
	const cPath = linePath(
		pts(combined).filter((d) => d.t >= FA && d.t <= FB),
		(d) => d.t,
		(d) => d.v,
		fx,
		scale([0, 1], [160, 160 - AMP])
	);
	const curve = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 160; i++) {
			const tt = FA + ((FB - FA) * i) / 160;
			if (tt >= fit.tc - 1e-4) break;
			const f = frequencyAt(fit.tc - tt, mc);
			if (f > 200) break;
			d += `${d ? 'L' : 'M'}${fx(tt).toFixed(1)} ${fy(f).toFixed(1)}`;
		}
		return d;
	});
	const close = $derived(fit.rms < best.rms * 1.1);
	const Mmin = $derived(minTotalMass(mc));
	const sep150 = $derived(separation(Mmin, 150) / 1000);
	const horizons = $derived((2 * horizonRadius(Mmin / 2)) / 1000);
</script>

<g>
	<rect
		x="16"
		y="16"
		width="928"
		height="568"
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>

	{#if phase === 'data'}
		<!-- axes -->
		{#each [YH, YL] as y (y)}
			<g opacity={y === YH ? 1 - k.current : 1}>
				<line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--stage-grid)" />
				{#each [-1, 1] as v (v)}
					<line
						x1={X0}
						x2={X1}
						y1={y - v * AMP}
						y2={y - v * AMP}
						stroke="var(--stage-grid)"
						stroke-dasharray="2 4"
					/>
					<Label
						x={X0 - 8}
						y={y - v * AMP + 4}
						text={v > 0 ? '1' : '−1'}
						anchor="end"
						size={11.5}
						muted
					/>
				{/each}
			</g>
		{/each}
		<Readout id="d-labels">
			<Label
				anchor="start"
				x={32}
				y={44}
				text="Strain × 10⁻²¹, band-passed 35–350 Hz (LIGO, 14 September 2015)"
				size={13}
				weight={650}
			/>
			<Label
				anchor="start"
				x={X0}
				y={YH - AMP - 14}
				text="Hanford, Washington"
				size={12.5}
				weight={650}
				color="var(--gw-h1)"
				opacity={1 - k.current}
			/>
			<Label
				anchor="start"
				x={X0}
				y={YL - AMP - 14}
				text="Livingston, Louisiana"
				size={12.5}
				weight={650}
				color="var(--gw-l1)"
			/>
			{#if k.current > 0.5}
				<Label
					x={X1}
					y={YL - AMP - 14}
					text="+ Hanford, 6.9 ms earlier and flipped"
					anchor="end"
					size={12.5}
					weight={650}
					color="var(--gw-h1)"
				/>
			{/if}
			{#if showNr}
				<Label
					x={X1}
					y={YH - AMP - 14}
					text="general relativity (numerical)"
					anchor="end"
					size={12}
					weight={600}
					color="var(--gw-nr)"
					opacity={1 - k.current}
				/>
			{/if}
		</Readout>

		<Readout id="key-h" order={3} label="Hanford, Washington" color="var(--gw-h1)" />
		<Readout id="key-l" order={4} label="Livingston, Louisiana" color="var(--gw-l1)" />
		{#if showNr}
			<Readout id="key-nr" order={5} label="General relativity" color="var(--gw-nr)" />
		{/if}
		<path
			d={pL}
			transform="translate(0 {YL})"
			fill="none"
			stroke="var(--gw-l1)"
			stroke-width="1.6"
		/>
		<path
			d={pH}
			transform={hTransform}
			fill="none"
			stroke="var(--gw-h1)"
			stroke-width="1.6"
			opacity={k.current > 0.5 ? 0.85 : 1}
		/>
		{#if showNr}
			<path
				d={pNL}
				transform="translate(0 {YL})"
				fill="none"
				stroke="var(--gw-nr)"
				stroke-width="2"
				opacity="0.8"
			/>
			{#if k.current < 0.5}
				<path
					d={pNH}
					transform="translate(0 {YH})"
					fill="none"
					stroke="var(--gw-nr)"
					stroke-width="2"
					opacity={0.8 * (1 - 2 * k.current)}
				/>
			{/if}
		{/if}

		<!-- time axis -->
		<line x1={X0} x2={X1} y1={490} y2={490} stroke="var(--stage-line)" />
		{#each [0.25, 0.3, 0.35, 0.4, 0.45] as v (v)}
			<line x1={sx(v)} x2={sx(v)} y1={490} y2={495} stroke="var(--stage-line)" />
			<Label x={sx(v)} y={509} text={v.toFixed(2)} anchor="middle" size={11.5} muted />
		{/each}
		<Label x={X1} y={526} text="seconds after 09:50:45 UTC" anchor="end" size={12} muted />
		{#if head !== null && head <= TB}
			<line x1={sx(head)} x2={sx(head)} y1={60} y2={490} stroke="var(--stage-ink)" opacity="0.3" />
		{/if}
		<Row
			id="delay"
			order={1}
			x={32}
			y={556}
			w={400}
			label="Livingston first, by"
			value="6.9 ms (light: up to 10 ms)"
		/>
		<Row
			id="peak"
			order={2}
			x={500}
			y={556}
			w={420}
			label="Peak strain"
			value="1.0 × 10⁻²¹, a chirp 35 → 150 Hz"
		/>
	{:else}
		<!-- the averaged signal -->
		<Readout id="f-labels">
			<Label
				anchor="start"
				x={32}
				y={44}
				text="Livingston and the shifted, flipped Hanford, averaged (strain × 10⁻²¹)"
				size={13}
				weight={650}
			/>
			<Label
				anchor="start"
				x={32}
				y={FY0 - 18}
				text="frequency, Hz: one dot per half cycle, from the zero crossings"
				size={13}
				weight={650}
			/>
		</Readout>
		<line x1={X0} x2={X1} y1={160} y2={160} stroke="var(--stage-grid)" />
		<rect
			x={fx(FIT_WINDOW[0])}
			y={60}
			width={fx(FIT_WINDOW[1]) - fx(FIT_WINDOW[0])}
			height={200}
			fill="var(--gw-crest)"
			opacity="0.06"
		/>
		<path d={cPath} fill="none" stroke="var(--gw-l1)" stroke-width="1.6" />

		<!-- frequency -->
		{#each [0, 50, 100, 150, 200] as f (f)}
			<line x1={X0} x2={X1} y1={fy(f)} y2={fy(f)} stroke="var(--stage-grid)" />
			<Label x={X0 - 8} y={fy(f) + 4} text={String(f)} anchor="end" size={11.5} muted />
		{/each}
		<path d={curve} fill="none" stroke="var(--gw-crest)" stroke-width="2.4" />
		{#each measuredTrack as p (p.t)}
			<circle
				cx={fx(p.t)}
				cy={fy(p.f)}
				r="5"
				fill="var(--gw-l1)"
				stroke="var(--surface)"
				stroke-width="1.5"
			/>
		{/each}
		{#each [0.34, 0.36, 0.38, 0.4, 0.42] as v (v)}
			<line x1={fx(v)} x2={fx(v)} y1={FY1} y2={FY1 + 5} stroke="var(--stage-line)" />
			<Label x={fx(v)} y={FY1 + 19} text={v.toFixed(2)} anchor="middle" size={11.5} muted />
		{/each}
		<line x1={X0} x2={X1} y1={FY1} y2={FY1} stroke="var(--stage-line)" />
		<Readout id="f-axis">
			<Label x={X1} y={FY1 + 34} text="seconds after 09:50:45 UTC" anchor="end" size={12} muted />
		</Readout>

		<Row
			id="mc"
			order={1}
			x={32}
			y={556}
			w={270}
			label="Chirp mass of the curve"
			value="{mc.toFixed(1)} suns"
			color="var(--gw-crest)"
		/>
		<Row
			id="misfit"
			order={2}
			x={330}
			y={556}
			w={250}
			label="Misfit"
			value={close
				? `±${(fit.rms * 100).toFixed(0)}%: best fit ≈ ${best.mc.toFixed(0)}`
				: `±${(fit.rms * 100).toFixed(0)}%`}
		/>
		<Row
			id="implied"
			order={3}
			x={608}
			y={556}
			w={312}
			label="So, at 150 Hz"
			value="≥ {Mmin.toFixed(0)} suns, {sep150.toFixed(0)} km apart"
		/>
		<Readout id="horizons">
			<Label
				anchor="start"
				x={608}
				y={576}
				text="(as two equal black holes: horizons {horizons.toFixed(0)} km wide)"
				size={11.5}
				muted
			/>
		</Readout>
	{/if}
</g>
