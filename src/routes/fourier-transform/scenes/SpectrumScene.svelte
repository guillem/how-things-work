<script lang="ts">
	/**
	 * A signal and its spectrum (steps `spectrum`, `edit`, `draw-wave`).
	 *
	 * Top: one second of the chosen waveform (`params.shape`: a preset or the
	 * reader's drawing in `params['ft:wave']`). Bottom: its spectrum, a bar for
	 * each frequency from 0 Hz (the average, which can be negative) to 16 Hz.
	 *
	 * Phases (`step.hints.phase`):
	 *   view — the waveform and its bars.
	 *   edit — each bar has a handle; the edited heights live in
	 *          `params['ft:bars']` (empty: the waveform's own bars). The signal
	 *          is rebuilt from the 17 bars (inverse transform), over the
	 *          original (dashed). Changing the waveform or "Reset the bars"
	 *          clears the edits.
	 *   draw — the signal is rebuilt from 1 to `params.terms` Hz over the
	 *          original, and the bars taking part are highlighted.
	 *
	 * In every phase the reader can drag across the top graph to draw a new
	 * waveform: the stroke is kept locally while drawing and written to
	 * `params['ft:wave']` (and the waveform switched to "Your drawing") when the
	 * pointer is released.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, smoothstep, startDrag, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { num, pack, partialSamples, unpack, waveFromStroke, waveSpectrum } from '../fourier';
	import { BARS, N_WAVE, WAVE_NAMES, editedSpectrum, samplesPath, waveSource } from '../signals';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ----------------------------------------------------------
	const X0 = 110;
	const X1 = 910;
	const CY = 170; // middle line of the signal
	const U = 92; // px per unit on the signal
	const TOP = 52; // the signal panel's top and bottom (clipped)
	const BOTTOM = 292;
	const BY = 512; // baseline of the bars
	const BU = 110; // px per unit on the bars
	const BMAX = 1.6; // tallest bar the editor allows
	const SLOT = (X1 - X0) / (BARS + 1);
	const barX = (n: number) => X0 + SLOT * (n + 0.5);
	const BW = 24;

	const phase = $derived(String(step.hints?.phase ?? 'view'));
	const editing = $derived(phase === 'edit');
	const drawPhase = $derived(phase === 'draw');

	// ---- the waveform and its spectrum -----------------------------------------
	const shape = $derived(String(params.shape ?? 'square'));
	const samples = $derived(waveSource(shape, String(params['ft:wave'] ?? '')));
	const spectrum = $derived(samples ? waveSpectrum(samples) : null);
	const baseBars = $derived(
		spectrum ? spectrum.slice(0, BARS + 1).map((h) => h.amp) : new Array<number>(BARS + 1).fill(0)
	);
	const editedText = $derived(String(params['ft:bars'] ?? ''));
	const edits = $derived(unpack(editedText, BARS + 1));
	const bars = $derived(editing && edits ? edits : baseBars);
	const termsN = $derived(Math.max(1, Math.min(50, Math.round(Number(params.terms ?? 5)))));

	// Bars grow in when the step starts (a function of t) and tween when the waveform changes.
	const shownBars = Tween.of(() => baseBars, { duration: 600, easing: cubicInOut });
	const grow = (n: number) =>
		reduced || editing ? 1 : smoothstep(0.15 + 0.06 * n, 0.55 + 0.06 * n, t);
	const barValue = (n: number) => (editing ? bars[n] : (reduced ? baseBars : shownBars.current)[n]);

	// The signal drawn thick: the original (view), rebuilt from the bars (edit) or from 1 … terms Hz (draw).
	const rebuilt = $derived.by(() => {
		if (!spectrum || !samples) return null;
		if (editing) return partialSamples(editedSpectrum(spectrum, bars), BARS, N_WAVE);
		if (drawPhase) return partialSamples(spectrum, termsN, N_WAVE);
		return null;
	});
	const mainPath = $derived(
		rebuilt
			? samplesPath(rebuilt, X0, X1, CY, U)
			: samples
				? samplesPath(samples, X0, X1, CY, U)
				: ''
	);
	const ghostPath = $derived(rebuilt && samples ? samplesPath(samples, X0, X1, CY, U) : '');
	const edited = $derived(
		editing && edits !== null && edits.some((v, i) => Math.abs(v - baseBars[i]) > 5e-4)
	);

	// What the bars show, worked out from the model: which frequencies are missing.
	const summary = $derived.by(() => {
		if (!spectrum) return '';
		const top = Math.max(...baseBars.slice(1));
		const zero = baseBars.map((a, n) => n >= 1 && a < 1e-3 * top);
		const missing = zero.flatMap((z, n) => (z ? [n] : []));
		const evens = Array.from({ length: BARS / 2 }, (_, i) => 2 * (i + 1));
		if (missing.length === 0) return 'every frequency from 1 Hz up';
		if (missing.length === evens.length && missing.every((n) => n % 2 === 0))
			return 'only odd frequencies: 1, 3, 5, 7 … Hz';
		return `none of ${missing.join(', ')} Hz`;
	});

	// ---- clearing the edits ----------------------------------------------------------
	// A new waveform, or "Reset the bars", starts from the waveform's own bars.
	let lastShape: string | null = null;
	let lastWave: string | null = null;
	let lastReset: number | null = null;
	$effect(() => {
		const s = shape;
		const w = String(params['ft:wave'] ?? '');
		const r = Number(params.resetBars ?? 0);
		untrack(() => {
			const changed =
				(lastShape !== null && s !== lastShape) ||
				(lastWave !== null && w !== lastWave) ||
				(lastReset !== null && r !== lastReset);
			if (changed && params['ft:bars']) setParam('ft:bars', '');
			lastShape = s;
			lastWave = w;
			lastReset = r;
		});
	});

	// ---- the bar editor ----------------------------------------------------------------
	const MIN0 = -1.5; // the 0 Hz bar is the average and may be negative
	function setBar(n: number, v: number) {
		const lo = n === 0 ? MIN0 : 0;
		const next = [...bars];
		next[n] = Math.round(Math.max(lo, Math.min(BMAX, v)) * 100) / 100;
		setParam('ft:bars', pack(next));
	}
	const barMove = (n: number) => (p: Point) => setBar(n, (BY - p.y) / BU);
	const barKey = (n: number) => (k: number | 'start' | 'end') => {
		if (k === 'start') return setBar(n, n === 0 ? MIN0 : 0);
		if (k === 'end') return setBar(n, BMAX);
		setBar(n, bars[n] + 0.02 * k);
	};

	// ---- drawing a waveform -----------------------------------------------------------
	let stroke = $state<{ u: number; y: number }[]>([]);
	const strokePath = $derived(
		stroke
			.map(
				(p, i) =>
					`${i ? 'L' : 'M'}${(X0 + (X1 - X0) * p.u).toFixed(1)} ${(CY - U * p.y).toFixed(1)}`
			)
			.join(' ')
	);
	function ondraw(event: PointerEvent) {
		stroke = [];
		const add = (p: Point) => {
			// A little beyond either end still counts as the start or the end of the second.
			const raw = (p.x - X0) / (X1 - X0);
			if (raw < -0.03 || raw > 1.03) return;
			const u = Math.max(0, Math.min(0.9999, raw));
			const y = Math.max(-1.25, Math.min(1.25, (CY - p.y) / U));
			stroke.push({ u, y });
		};
		// startDrag reports the first point too.
		startDrag(event, add, () => {
			const wave = waveFromStroke(stroke, N_WAVE);
			stroke = [];
			if (!wave) return;
			setParam('ft:wave', pack(wave));
			setParam('shape', 'drawn');
		});
	}

	const ticks = [0, 0.25, 0.5, 0.75, 1];
	const IDX = Array.from({ length: BARS + 1 }, (_, n) => n);
	const name = $derived(WAVE_NAMES[shape] ?? shape);
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	/** "The square wave" / "Your drawing". */
	const theName = $derived(shape === 'drawn' ? 'Your drawing' : `The ${name}`);
	const title = $derived(
		editing
			? `The signal rebuilt from these bars${edited ? ' (edited)' : ''}`
			: drawPhase
				? `${theName} rebuilt from ${termsN === 1 ? '1 Hz only' : `1 to ${termsN} Hz`}`
				: `The signal: ${name}`
	);
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
	<defs>
		<clipPath id="spectrum-signal-clip">
			<rect x={X0 - 2} y={TOP} width={X1 - X0 + 4} height={BOTTOM - TOP} />
		</clipPath>
	</defs>

	<!-- ================= the signal ================= -->
	{@render txt(X0, 34, cap(title), 17, {
		weight: 600,
		color: rebuilt ? 'var(--ft-sum)' : 'var(--stage-ink)'
	})}
	{@render txt(
		X1,
		34,
		ghostPath
			? 'dashed: the original · drag across to draw your own'
			: 'drag across this graph to draw your own',
		12,
		{ anchor: 'end', muted: true }
	)}
	{#each [-1, 1] as v (v)}
		<line x1={X0} x2={X1} y1={CY - U * v} y2={CY - U * v} stroke="var(--stage-grid)" />
		{@render txt(X0 - 10, CY - U * v + 4, v > 0 ? '+1' : '−1', 12, { anchor: 'end', muted: true })}
	{/each}
	<line x1={X0} x2={X1} y1={CY} y2={CY} stroke="var(--stage-line)" />
	<line x1={X0} x2={X0} y1={TOP} y2={BOTTOM} stroke="var(--stage-line)" />
	{#each ticks as u (u)}
		{@render txt(X0 + (X1 - X0) * u, BOTTOM + 18, `${u} s`, 12, { anchor: 'middle', muted: true })}
	{/each}

	<g clip-path="url(#spectrum-signal-clip)">
		{#if ghostPath}
			<path
				d={ghostPath}
				fill="none"
				stroke="var(--ft-target)"
				stroke-width="1.8"
				stroke-dasharray="6 5"
				opacity="0.8"
			/>
		{/if}
		{#if mainPath}
			<path
				d={mainPath}
				fill="none"
				stroke={rebuilt ? 'var(--ft-sum)' : 'var(--stage-ink)'}
				stroke-width="3"
				stroke-linejoin="round"
				opacity={stroke.length ? 0.25 : 1}
			/>
		{/if}
		{#if strokePath}
			<path
				d={strokePath}
				fill="none"
				stroke="var(--ft-bar)"
				stroke-width="3"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
		{/if}
	</g>
	{#if !samples && !stroke.length}
		<rect
			x={X0 + 6}
			y={TOP + 6}
			width={X1 - X0 - 12}
			height={BOTTOM - TOP - 12}
			rx="8"
			fill="none"
			stroke="var(--ft-bar)"
			stroke-dasharray="6 6"
			opacity="0.7"
		/>
		{@render txt((X0 + X1) / 2, CY - 6, 'Drag across this graph to draw a waveform', 18, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--ft-bar)'
		})}
		{@render txt(
			(X0 + X1) / 2,
			CY + 20,
			'from left to right: one second of a repeating signal',
			13,
			{
				anchor: 'middle',
				muted: true
			}
		)}
	{/if}

	<!-- the drawing surface over the signal -->
	<rect
		class="draw"
		x={X0 - 14}
		y={TOP}
		width={X1 - X0 + 28}
		height={BOTTOM - TOP}
		fill="transparent"
		role="presentation"
		onpointerdown={ondraw}
	/>

	<!-- ================= the spectrum ================= -->
	{@render txt(
		X0,
		338,
		editing ? 'The spectrum: drag the bars' : 'The spectrum: amplitude of each frequency',
		17,
		{ weight: 600, color: 'var(--ft-bar)' }
	)}
	{#if samples && !editing}
		{@render txt(X1, 338, summary, 13, { anchor: 'end', weight: 600 })}
	{/if}
	{#each [0.5, 1, 1.5] as v (v)}
		<line x1={X0} x2={X1} y1={BY - BU * v} y2={BY - BU * v} stroke="var(--stage-grid)" />
		{@render txt(X0 - 10, BY - BU * v + 4, num(v, 1), 12, { anchor: 'end', muted: true })}
	{/each}
	<line x1={X0} x2={X0} y1={BY - BU * BMAX} y2={BY + 4} stroke="var(--stage-line)" />

	{#each IDX as n (n)}
		{@const v = barValue(n) * grow(n)}
		{@const used = !drawPhase || n <= termsN}
		{@const x = barX(n)}
		{@const top = BY - BU * Math.max(0, v)}
		{@const h = BU * Math.abs(v)}
		<rect
			x={x - BW / 2}
			y={v >= 0 ? top : BY}
			width={BW}
			height={Math.max(0, h)}
			rx="3"
			fill={n === 0 ? 'var(--stage-ink-muted)' : 'var(--ft-bar)'}
			opacity={used ? 0.9 : 0.25}
		/>
		{#if Math.abs(v) > 0.005 && !editing}
			{@render txt(x, v >= 0 ? top - 6 : BY + h + 14, num(v), 11, {
				anchor: 'middle',
				muted: !used,
				opacity: grow(n)
			})}
		{/if}
		{@render txt(x, v < -0.005 ? BY - 8 : BY + 18, `${n}`, 12, {
			anchor: 'middle',
			weight: used ? 600 : 400,
			muted: !used
		})}
	{/each}
	<line x1={X0} x2={X1} y1={BY} y2={BY} stroke="var(--stage-line)" stroke-width="1.5" />
	{@render txt(X1, BY + 42, 'frequency (Hz) →', 12, { anchor: 'end', muted: true })}
	{@render txt(barX(0) + 26, BY + 42, '0 Hz: the average, which can be negative', 12, {
		muted: true
	})}
	{#if drawPhase && termsN > BARS}
		{@render txt(
			X1,
			BY + 62,
			`+ ${termsN - BARS} more frequencies (17–${termsN} Hz) not shown`,
			12,
			{
				anchor: 'end',
				muted: true
			}
		)}
	{/if}

	{#if editing && samples}
		{#each bars as v, n (n)}
			<Handle
				x={barX(n)}
				y={BY - BU * v}
				r={7}
				color="var(--ft-bar)"
				label="Amount of {n} Hz"
				value={v}
				min={n === 0 ? MIN0 : 0}
				max={BMAX}
				valuetext="{n} hertz: {num(v)}"
				onmove={barMove(n)}
				onkey={barKey(n)}
			/>
		{/each}
	{/if}
</g>

<style>
	.draw {
		cursor: crosshair;
		touch-action: none;
	}
</style>
