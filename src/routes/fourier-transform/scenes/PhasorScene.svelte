<script lang="ts">
	/**
	 * Sine waves as turning circles (step `circles`).
	 *
	 * Each frequency n of the chosen waveform is a circle of radius A_n that
	 * turns n times per second from its starting angle φ_n; the circles are
	 * chained, each centred on the turning point of the one before, so the
	 * height of the last point is the sum of the first `params.terms`
	 * frequencies. That height is traced to the right, newest at the left:
	 * the last second of the rebuilt signal, over the original (dashed).
	 *
	 * Time is slowed down: one second of signal takes PERIOD seconds of
	 * animation. Everything is a pure function of t; the rebuilt period is
	 * computed once per change of the controls and looked up per frame.
	 */
	import { cycle } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { num, partialSamples, waveSpectrum } from '../fourier';
	import { N_WAVE, theWave, waveSource } from '../signals';

	let { t, params, reduced }: StageProps = $props();

	const TAU = 2 * Math.PI;
	const PERIOD = 6; // seconds of animation per second of signal
	const CX = 236;
	const CY = 300;
	const TX0 = 500; // the trace: now …
	const TX1 = 920; // … one second earlier
	const MAX_CIRCLES = 60; // circles drawn; smaller ones only as arms

	const shape = $derived(String(params.shape ?? 'square'));
	const samples = $derived(waveSource(shape, String(params['ft:wave'] ?? '')));
	const spectrum = $derived(samples ? waveSpectrum(samples) : null);
	const termsN = $derived(Math.max(1, Math.min(50, Math.round(Number(params.terms ?? 5)))));

	// Vertical scale: the waveform's biggest value fills 125 px.
	const U = $derived.by(() => {
		if (!samples) return 120;
		const m = Math.max(...samples.map(Math.abs), 0.2);
		return 125 / m;
	});

	const u = $derived(cycle(reduced ? 2.5 : t, PERIOD));
	const avg = $derived(spectrum ? spectrum[0].amp : 0);

	/** The chain at time u: start (the average), then the end of each circle's arm. */
	const chain = $derived.by(() => {
		if (!spectrum) return [];
		let x = CX;
		let y = CY - U * avg;
		const pts = [{ x, y, r: 0 }];
		for (let n = 1; n <= termsN && n < spectrum.length; n++) {
			const h = spectrum[n];
			if (h.amp < 1e-9) continue;
			const a = TAU * n * u + h.phase;
			const r = U * h.amp;
			x += r * Math.cos(a);
			y -= r * Math.sin(a);
			pts.push({ x, y, r });
		}
		return pts;
	});
	const tip = $derived(chain.length ? chain[chain.length - 1] : { x: CX, y: CY, r: 0 });
	const arms = $derived(
		chain.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
	);
	const circleCount = $derived(chain.length - 1);

	// One period of the rebuilt signal and of the original, for the trace.
	const rebuilt = $derived(spectrum ? partialSamples(spectrum, termsN, N_WAVE) : []);
	const at = (arr: readonly number[], v: number) => {
		const N = arr.length;
		const f = (((v % 1) + 1) % 1) * N;
		const i = Math.floor(f);
		const k = f - i;
		return arr[i % N] * (1 - k) + arr[(i + 1) % N] * k;
	};
	const tracePath = (arr: readonly number[]) => {
		if (!arr.length) return '';
		let d = '';
		const n = 240;
		for (let i = 0; i <= n; i++) {
			const s = i / n; // seconds before now
			d += `${i ? 'L' : 'M'}${(TX0 + (TX1 - TX0) * s).toFixed(1)} ${(CY - U * at(arr, u - s)).toFixed(1)}`;
		}
		return d;
	};
	const trace = $derived(tracePath(rebuilt));
	const original = $derived(samples ? tracePath(samples) : '');
	const first = $derived(spectrum && spectrum[1].amp > 1e-6 ? spectrum[1] : null);
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; muted?: boolean; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	{#if !spectrum}
		{@render txt(480, 280, 'Nothing drawn yet', 22, { anchor: 'middle', weight: 600 })}
		{@render txt(
			480,
			312,
			'Draw a waveform on the top graph of “The spectrum” or “Draw any waveform”,',
			14,
			{ anchor: 'middle', muted: true }
		)}
		{@render txt(480, 334, 'or pick one of the other waveforms.', 14, {
			anchor: 'middle',
			muted: true
		})}
	{:else}
		<!-- axes of the circles and of the trace -->
		<line x1={CX} x2={CX} y1={CY - 175} y2={CY + 175} stroke="var(--stage-grid)" />
		<line x1="30" x2={TX1} y1={CY} y2={CY} stroke="var(--stage-line)" />
		<line x1={TX0} x2={TX0} y1={CY - 160} y2={CY + 160} stroke="var(--stage-line)" />
		{@render txt(TX0, CY + 186, 'now', 12, { anchor: 'middle', muted: true })}
		{@render txt(TX1, CY + 186, '1 second earlier', 12, { anchor: 'end', muted: true })}

		<!-- the circles, biggest first -->
		{#each chain.slice(0, Math.min(chain.length - 1, MAX_CIRCLES)) as p, i (i)}
			{@const r = chain[i + 1].r}
			{#if r > 1.2}
				<circle
					cx={p.x}
					cy={p.y}
					{r}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width={i === 0 ? 1.4 : 1}
					opacity={i === 0 ? 0.5 : 0.32}
				/>
			{/if}
		{/each}
		{#if Math.abs(avg) > 1e-6}
			<line
				x1={CX}
				x2={CX}
				y1={CY}
				y2={CY - U * avg}
				stroke="var(--ft-bar)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{@render txt(CX - 10, CY - (U * avg) / 2 + 4, `0 Hz: average ${num(avg)}`, 12, {
				anchor: 'end',
				weight: 600,
				color: 'var(--ft-bar)'
			})}
		{/if}
		<path
			d={arms}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.8"
			stroke-linejoin="round"
			opacity="0.85"
		/>
		<circle cx={chain[0].x} cy={chain[0].y} r="3.5" fill="var(--stage-ink)" />

		<!-- the trace: the original (dashed) and the rebuilt signal -->
		<path
			d={original}
			fill="none"
			stroke="var(--ft-target)"
			stroke-width="1.8"
			stroke-dasharray="6 5"
			opacity="0.75"
		/>
		<path d={trace} fill="none" stroke="var(--ft-sum)" stroke-width="3" stroke-linejoin="round" />
		<line
			x1={tip.x}
			x2={TX0}
			y1={tip.y}
			y2={tip.y}
			stroke="var(--ft-sum)"
			stroke-dasharray="4 4"
			opacity="0.8"
		/>
		<circle
			cx={tip.x}
			cy={tip.y}
			r="6"
			fill="var(--ft-sum)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		<circle
			cx={TX0}
			cy={tip.y}
			r="6"
			fill="var(--ft-sum)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>

		<!-- readouts -->
		{@render txt(32, 44, `${circleCount} turning circle${circleCount === 1 ? '' : 's'}`, 20, {
			weight: 600,
			color: 'var(--ft-sum)'
		})}
		{@render txt(
			32,
			68,
			`rebuilding ${theWave(shape)} from 1 Hz to ${termsN} Hz (frequencies with no amount are left out)`,
			13,
			{ muted: true }
		)}
		{#if first}
			{@render txt(
				32,
				560,
				`The 1 Hz circle: radius ${num(first.amp)}, one turn per second of signal; the n Hz circle turns n times`,
				13,
				{ weight: 600 }
			)}
		{/if}
		{@render txt(32, 582, `Slowed down: one second of signal takes ${PERIOD} s here.`, 12, {
			muted: true
		})}
		{@render txt(TX1, 44, 'dashed: the original', 13, {
			anchor: 'end',
			weight: 600,
			color: 'var(--ft-target)'
		})}
	{/if}
</g>
