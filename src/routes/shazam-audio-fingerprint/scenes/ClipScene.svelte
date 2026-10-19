<script lang="ts">
	/**
	 * One tune of the library, scrolling by: its waveform on top, its spectrogram below, and its
	 * constellation of peaks over the spectrogram. Six seconds are in view and the view moves at
	 * the speed of the music, looping over the 12-second tune.
	 *
	 * Phases (`step.hints.phase`): wave (the waveform in focus), spec (the spectrogram), peaks
	 * (the spectrogram dimmed under its peaks). Params: `tune`, `play` (an action).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BINS, BIN_HZ, CLIPS, CLIP_S, FRAME_S, SAMPLE_RATE, clipPrint, render } from '../model';
	import { dots, fmt, spectrogramUrl, thousands, tuneOf } from './shared';
	import { playSamples, stopSound } from './sound';

	let { step, t, params, reduced, dark }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'wave'));
	const id = $derived(tuneOf(params));
	const info = $derived(CLIPS[id]);
	const fp = $derived(clipPrint(id));
	const samples = $derived(render(id));

	// ---- sound -------------------------------------------------------------------------
	let lastPlay: number | undefined;
	$effect(() => {
		const c = Number(params.play ?? 0);
		untrack(() => {
			if (lastPlay !== undefined && c !== lastPlay) playSamples(samples);
			lastPlay = c;
		});
	});
	$effect(() => {
		void step.id;
		void id;
		return () => stopSound();
	});

	// ---- layout -------------------------------------------------------------------------
	const X0 = 96;
	const X1 = 920;
	const VIEW_S = 6;
	const PX_S = (X1 - X0) / VIEW_S;
	const WAVE_Y = 128;
	const WAVE_H = 46;
	const SPEC_Y0 = 206;
	const SPEC_Y1 = 528;
	const yOfBin = (b: number) => SPEC_Y1 - ((b + 0.5) / BINS) * (SPEC_Y1 - SPEC_Y0);
	const xOfFrame = (f: number) => (f * FRAME_S + 0.032) * PX_S;

	/** Seconds of the tune at the left edge of the view; the view loops over the tune. */
	const view = $derived(((reduced ? 2.5 : t) * 1) % CLIP_S);
	const shift = $derived(X0 - view * PX_S);

	const waveD = $derived.by(() => {
		const cols = Math.round(CLIP_S * PX_S);
		const per = samples.length / cols;
		let peak = 0;
		for (const v of samples) peak = Math.max(peak, Math.abs(v));
		const top: string[] = [];
		const bot: string[] = [];
		for (let c = 0; c < cols; c++) {
			let lo = 0;
			let hi = 0;
			for (let i = Math.floor(c * per); i < Math.floor((c + 1) * per); i++) {
				if (samples[i] < lo) lo = samples[i];
				if (samples[i] > hi) hi = samples[i];
			}
			top.push(`${c} ${(WAVE_Y - (hi / peak) * WAVE_H).toFixed(1)}`);
			bot.push(`${c} ${(WAVE_Y - (lo / peak) * WAVE_H).toFixed(1)}`);
		}
		return `M${top.join('L')}L${bot.reverse().join('L')}Z`;
	});
	const specUrl = $derived(spectrogramUrl(fp.spec, dark));
	const specW = $derived(fp.spec.frames * FRAME_S * PX_S);
	const peakD = $derived(dots(fp.peaks.map((p) => ({ x: xOfFrame(p.t), y: yOfBin(p.f) }))));

	// ---- focus --------------------------------------------------------------------------
	const target = $derived(
		phase === 'wave'
			? { wave: 1, spec: 0.22, peaks: 0 }
			: phase === 'spec'
				? { wave: 0.4, spec: 1, peaks: 0 }
				: { wave: 0.4, spec: 0.3, peaks: 1 }
	);
	const o = new Tween({ wave: 1, spec: 0.22, peaks: 0 }, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = target;
		untrack(() => o.set(v));
	});

	const cells = $derived(fp.spec.frames * BINS);
	const perSecond = $derived(fp.peaks.length / CLIP_S);
	const kHz = [0, 1000, 2000, 3000, 4000];
	const ticks = $derived.by(() => {
		const out: { s: number; x: number }[] = [];
		for (let s = Math.ceil(view); s <= view + VIEW_S + 1e-9; s++)
			out.push({ s: s % CLIP_S, x: X0 + (s - view) * PX_S });
		return out;
	});
</script>

<defs>
	<clipPath id="clip-scene-view">
		<rect x={X0} y={60} width={X1 - X0} height={SPEC_Y1 - 60 + 2} />
	</clipPath>
</defs>

<g>
	<Readout
		id="tune"
		order={1}
		label="Tune"
		value={info.name}
		note="{info.bpm} beats a minute · {info.key} · {info.instrument}"
	>
		<Label x={X0} y={42} text={info.name} anchor="start" size={16} weight={700} halo={false} />
		<Label
			x={X0 + info.name.length * 9.5 + 16}
			y={42}
			text="{info.bpm} beats a minute · {info.key} · {info.instrument}"
			anchor="start"
			muted
			halo={false}
		/>
	</Readout>

	<!-- waveform -->
	<g opacity={o.current.wave}>
		<Readout id="wave-label">
			<Label
				x={X0 - 12}
				y={WAVE_Y + 4}
				text="air pressure"
				anchor="end"
				size={11}
				muted
				halo={false}
			/>
		</Readout>
		<line x1={X0} x2={X1} y1={WAVE_Y} y2={WAVE_Y} stroke="var(--stage-grid)" />
		<g clip-path="url(#clip-scene-view)">
			{#each [0, 1] as k (k)}
				<path
					d={waveD}
					transform="translate({shift + k * CLIP_S * PX_S} 0)"
					fill="var(--sz-wave)"
					stroke="none"
				/>
			{/each}
		</g>
	</g>

	<!-- spectrogram -->
	<rect
		x={X0}
		y={SPEC_Y0}
		width={X1 - X0}
		height={SPEC_Y1 - SPEC_Y0}
		fill="var(--stage-bg)"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<g clip-path="url(#clip-scene-view)">
		{#each [0, 1] as k (k)}
			<image
				href={specUrl}
				x={shift + k * CLIP_S * PX_S + 0.032 * PX_S - (FRAME_S * PX_S) / 2}
				y={SPEC_Y0}
				width={specW}
				height={SPEC_Y1 - SPEC_Y0}
				preserveAspectRatio="none"
				opacity={o.current.spec}
			/>
			<path
				d={peakD}
				transform="translate({shift + k * CLIP_S * PX_S} 0)"
				stroke="var(--sz-peak)"
				stroke-width="5.5"
				stroke-linecap="round"
				opacity={o.current.peaks}
			/>
		{/each}
	</g>
	<!-- frequency axis -->
	{#each kHz as f (f)}
		{@const y = SPEC_Y1 - (f / (BINS * BIN_HZ)) * (SPEC_Y1 - SPEC_Y0)}
		<line x1={X0 - 5} x2={X0} y1={y} y2={y} stroke="var(--stage-line)" />
		<Label
			x={X0 - 9}
			y={y + 4}
			text={f === 0 ? '0' : `${f / 1000} kHz`}
			anchor="end"
			size={11}
			muted
			halo={false}
		/>
	{/each}
	<Readout id="freq-axis">
		<Label
			x={30}
			y={(SPEC_Y0 + SPEC_Y1) / 2}
			text="pitch (frequency)"
			rotate={-90}
			size={12}
			muted
			halo={false}
		/>
	</Readout>
	<!-- time axis -->
	{#each ticks as tk (tk.x)}
		<line x1={tk.x} x2={tk.x} y1={SPEC_Y1} y2={SPEC_Y1 + 5} stroke="var(--stage-line)" />
		<Label x={tk.x} y={SPEC_Y1 + 19} text="{tk.s} s" size={11} muted halo={false} />
	{/each}

	<!-- captions -->
	{#if phase === 'wave'}
		<Readout
			id="rate"
			order={2}
			label="Samples"
			value="{thousands(SAMPLE_RATE)} a second"
			note="{thousands(samples.length)} numbers for the whole tune"
		>
			<Label
				x={X1}
				y={78}
				text="{thousands(SAMPLE_RATE)} samples a second · {thousands(
					samples.length
				)} numbers in {CLIP_S} s"
				anchor="end"
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{:else if phase === 'spec'}
		<Readout
			id="slices"
			order={2}
			label="Spectrogram"
			value="{fp.spec.frames} slices × {BINS} frequencies"
			note="a 64 ms slice every 32 ms, {fmt(BIN_HZ, 1)} Hz apart"
		>
			<Label
				x={X1}
				y={78}
				text="a 64 ms slice every 32 ms · {BINS} frequencies {fmt(BIN_HZ, 1)} Hz apart · {dark
					? 'brighter'
					: 'darker'} = louder"
				anchor="end"
				size={12}
				muted
				halo={false}
			/>
		</Readout>
	{:else}
		<Readout
			id="kept"
			order={2}
			label="Peaks kept"
			value="{fp.peaks.length} of {thousands(cells)} points"
			note="{fmt(perSecond, 0)} a second · {fmt(
				(100 * fp.peaks.length) / cells,
				2
			)}% of the spectrogram"
		>
			<Label
				x={X1}
				y={78}
				text="{fp.peaks.length} peaks kept of {thousands(cells)} points ({fmt(
					(100 * fp.peaks.length) / cells,
					2
				)}%) · {fmt(perSecond, 0)} a second"
				anchor="end"
				size={12}
				weight={600}
				color="var(--sz-peak-text)"
				halo={false}
			/>
		</Readout>
	{/if}
	<Readout id="loop">
		<Label
			x={X1}
			y={SPEC_Y1 + 40}
			text="time in the tune (the view loops every {CLIP_S} s)"
			anchor="end"
			size={11}
			muted
			halo={false}
		/>
	</Readout>
</g>
