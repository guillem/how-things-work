<script lang="ts">
	/**
	 * A signal and its spectrum (steps `spectrum`, `edit`, `draw-wave`).
	 *
	 * Top: one second of the chosen waveform (`params.shape`: a preset or the
	 * reader's drawing in `params['ft:wave']`). Bottom: its spectrum, a bar for
	 * each frequency from 0 Hz (the average, which can be negative) to 16 Hz.
	 *
	 * Phases (`step.hints.phase`):
	 *   view — the waveform and its bars; a line sweeps across the waveform with
	 *          its value at that moment of the second.
	 *   edit — each bar has a handle; the edited heights live in
	 *          `params['ft:bars']` as "<waveform>|<heights>" (empty, or made for
	 *          another waveform: the waveform's own bars). The signal
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
	import { cycle, Handle, smoothstep, startDrag, type Point } from '#lib/draw/index.ts';
	import DrawButton from '../DrawButton.svelte';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
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
	const BU = 95; // px per unit on the bars
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
	// Stored as "<waveform>|<heights>": edits made to another waveform (the
	// waveform can also be changed on the circles and winding steps, where
	// this scene is not mounted to clear them) are ignored.
	const edits = $derived.by(() => {
		const [owner, heights] = editedText.split('|');
		return owner === shape && heights !== undefined ? unpack(heights, BARS + 1) : null;
	});
	const bars = $derived(editing && edits ? edits : baseBars);
	const MAX_TERMS = 50; // the terms slider's top
	const termsN = $derived(Math.max(1, Math.min(MAX_TERMS, Math.round(Number(params.terms ?? 5)))));

	// Bars grow in when the step starts (a function of t) and tween when the waveform changes.
	const shownBars = Tween.of(() => baseBars, { duration: 600, easing: cubicInOut });
	const grow = (n: number) =>
		reduced || editing ? 1 : smoothstep(0.15 + 0.06 * n, 0.55 + 0.06 * n, t);
	const barValue = (n: number) => (editing ? bars[n] : (reduced ? baseBars : shownBars.current)[n]);

	// The 0 Hz bar is the average and may be negative. The editor stops at −0.75
	// (MIN0), which fits at the full unit (71 px of the 80 below the baseline),
	// but a drawn waveform hugging the bottom of the graph can average lower
	// still (a wave flat at −1.2 averages −1.2), and that bar used to be drawn
	// cut off. Instead the chart's unit shrinks so the waveform's own average
	// fits between the baseline and the stage floor. The unit depends on the
	// waveform only, never on the edits, so the scale holds while editing (and
	// the editor's floor, shallower than such an average, fits too).
	const MIN0 = -0.75;
	const unit = $derived(baseBars[0] < MIN0 ? Math.min(BU, 80 / -baseBars[0]) : BU);

	// The signal drawn thick: the original (view), rebuilt from the bars (edit) or from 1 … terms Hz (draw).
	const rebuilt = $derived.by(() => {
		if (!spectrum || !samples) return null;
		if (editing) return partialSamples(editedSpectrum(spectrum, bars), BARS, N_WAVE);
		if (drawPhase) return partialSamples(spectrum, termsN, N_WAVE);
		return null;
	});
	// A rebuilt signal can be taller than the panel (extreme bar edits, or the
	// overshoot of a drawing that fills the graph): zoom the vertical scale out
	// (signal, ghost and the ±1 gridlines together) so it is never clipped.
	// While editing the zoom follows the edited signal. On the draw step it is
	// the tallest rebuild over every number of frequencies the slider offers,
	// so the scale holds steady per waveform as the slider moves.
	const FIT = (CY - TOP) / U - 0.03; // units that fit above (and below) the middle line
	const tallestRebuild = $derived.by(() => {
		if (!spectrum) return 1;
		let top = 1;
		for (let i = 0; i < N_WAVE; i++) {
			const u = i / N_WAVE;
			let v = spectrum[0].amp;
			for (let n = 1; n <= MAX_TERMS && n < spectrum.length; n++) {
				const h = spectrum[n];
				v += h.amp * Math.sin(2 * Math.PI * h.n * u + h.phase);
				top = Math.max(top, Math.abs(v));
			}
		}
		return top;
	});
	const yZoom = $derived.by(() => {
		if (!rebuilt) return 1;
		let top = 1;
		if (drawPhase) top = tallestRebuild;
		else for (const v of rebuilt) top = Math.max(top, Math.abs(v));
		return Math.max(1, top / FIT);
	});
	const US = $derived(U / yZoom);
	const mainPath = $derived(
		rebuilt
			? samplesPath(rebuilt, X0, X1, CY, US)
			: samples
				? samplesPath(samples, X0, X1, CY, US)
				: ''
	);
	const ghostPath = $derived(rebuilt && samples ? samplesPath(samples, X0, X1, CY, US) : '');

	// A line sweeps across the signal on the spectrum step (the bars are still;
	// the wave runs through its second), so the frame is not a static picture.
	const sweep = $derived(cycle(reduced ? 2.5 : t, 8));
	const sweepV = $derived(
		!editing && !drawPhase && samples
			? samples[Math.min(N_WAVE - 1, Math.floor(sweep * N_WAVE))]
			: null
	);
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
	function setBar(n: number, v: number) {
		const lo = n === 0 ? MIN0 : 0;
		const next = [...bars];
		next[n] = Math.round(Math.max(lo, Math.min(BMAX, v)) * 100) / 100;
		setParam('ft:bars', `${shape}|${pack(next)}`);
	}
	const barMove = (n: number) => (p: Point) => setBar(n, (BY - p.y) / unit);
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
					`${i ? 'L' : 'M'}${(X0 + (X1 - X0) * p.u).toFixed(1)} ${(CY - US * p.y).toFixed(1)}`
			)
			.join(' ')
	);
	/** A finger draws only after the Draw button; otherwise it scrolls the page. */
	let armed = $state(false);
	function ondraw(event: PointerEvent) {
		if (event.pointerType === 'touch' && !armed) return;
		stroke = [];
		const add = (p: Point) => {
			// A little beyond either end still counts as the start or the end of the second.
			const raw = (p.x - X0) / (X1 - X0);
			if (raw < -0.03 || raw > 1.03) return;
			const u = Math.max(0, Math.min(0.9999, raw));
			const y = Math.max(-1.2, Math.min(1.2, (CY - p.y) / US));
			stroke.push({ u, y });
		};
		// startDrag reports the first point too.
		startDrag(event, add, () => {
			armed = false;
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

	// Phone readouts: the spectrum's notes in one line.
	const spectrumNote = $derived(
		[
			samples && !editing ? summary : '',
			'0 Hz: the average, which can be negative',
			drawPhase && termsN > BARS ? `+ ${termsN - BARS} more (17–${termsN} Hz) not shown` : ''
		]
			.filter(Boolean)
			.join(' · ')
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
		font-size={size}
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
	<!-- <Readout>: on narrow screens these are listed as HTML under the stage -->
	<Readout
		id="signal"
		order={1}
		label="Top graph"
		value={cap(title)}
		color={rebuilt ? 'var(--ft-sum)' : undefined}
	>
		{@render txt(X0, 34, cap(title), 17, {
			weight: 600,
			color: rebuilt ? 'var(--ft-sum)' : 'var(--stage-ink)'
		})}
	</Readout>
	<Readout id="draw-hint">
		<g class="fine-only">
			{@render txt(
				X1,
				34,
				ghostPath
					? 'dashed: the original · drag across to draw your own'
					: 'drag across this graph to draw your own',
				12,
				{ anchor: 'end', muted: true }
			)}
		</g>
	</Readout>
	{#if ghostPath}
		<Readout id="original-key" order={10} label="dashed: the original" color="var(--ft-target)">
			<g class="coarse-only">
				{@render txt(X1 - 124, 34, 'dashed: the original', 12, { anchor: 'end', muted: true })}
			</g>
		</Readout>
	{/if}
	{#each [-1, 1] as v (v)}
		<line x1={X0} x2={X1} y1={CY - US * v} y2={CY - US * v} stroke="var(--stage-grid)" />
		{@render txt(X0 - 10, CY - US * v + 4, v > 0 ? '+1' : '−1', 12, { anchor: 'end', muted: true })}
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
		{#if sweepV !== null}
			<!-- the sweep: the signal's value at this moment of its second -->
			<line
				x1={X0 + (X1 - X0) * sweep}
				x2={X0 + (X1 - X0) * sweep}
				y1={TOP}
				y2={BOTTOM}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
			<circle
				cx={X0 + (X1 - X0) * sweep}
				cy={CY - US * sweepV}
				r="6"
				fill="var(--stage-ink)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/if}
	</g>
	{#if sweepV !== null}
		<!-- in the title row, between the title and the drawing hint (or the Draw
		     button); anchored at its start so it doesn't shift as the value changes -->
		<Readout
			id="sweep"
			order={2}
			label="At the line"
			value="at {num(sweep, 2)} s the signal is at {num(sweepV)}"
		>
			{@render txt(X0 + 290, 34, `at ${num(sweep, 2)} s the signal is at ${num(sweepV)}`, 13, {
				weight: 600
			})}
		</Readout>
	{/if}
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
		<Readout
			id="empty"
			order={3}
			label="Drag across the top graph to draw a waveform"
			value="from left to right: one second of a repeating signal"
			note="with a finger: tap Draw first"
			color="var(--ft-bar)"
		>
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
			<g class="coarse-only">
				{@render txt((X0 + X1) / 2, CY + 42, 'with a finger: tap Draw first', 13, {
					anchor: 'middle',
					muted: true
				})}
			</g>
		</Readout>
	{/if}

	{#if armed}
		<rect
			x={X0 - 4}
			y={TOP + 2}
			width={X1 - X0 + 8}
			height={BOTTOM - TOP - 4}
			rx="8"
			fill="none"
			stroke="var(--ft-bar)"
			stroke-width="2"
			stroke-dasharray="8 6"
		/>
	{/if}

	<!-- the drawing surface over the signal -->
	<rect
		class="draw"
		class:armed
		x={X0 - 14}
		y={TOP}
		width={X1 - X0 + 28}
		height={BOTTOM - TOP}
		fill="transparent"
		role="presentation"
		onpointerdown={ondraw}
	/>
	<DrawButton x={X1} y={12} {armed} ontoggle={() => (armed = !armed)} />

	<!-- ================= the spectrum ================= -->
	<Readout
		id="spectrum"
		order={4}
		label="The spectrum"
		value={editing ? 'drag the bars' : 'amplitude of each frequency'}
		note={spectrumNote}
		color="var(--ft-bar)"
	>
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
	</Readout>
	{#each [0.5, 1, 1.5] as v (v)}
		<line x1={X0} x2={X1} y1={BY - unit * v} y2={BY - unit * v} stroke="var(--stage-grid)" />
		{@render txt(X0 - 10, BY - unit * v + 4, num(v, 1), 12, { anchor: 'end', muted: true })}
	{/each}
	<line x1={X0} x2={X0} y1={BY - unit * BMAX} y2={BY + 4} stroke="var(--stage-line)" />

	{#each IDX as n (n)}
		{@const v = barValue(n) * grow(n)}
		{@const used = !drawPhase || n <= termsN}
		{@const x = barX(n)}
		{@const top = BY - unit * Math.max(0, v)}
		{@const h = unit * Math.abs(v)}
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
			<!-- a negative bar's value goes under it, or beside it when the bar is too deep -->
			{@const beside = v < 0 && h > unit / 2}
			<Readout id="bar-{n}">
				{@render txt(
					beside ? x + BW / 2 + 4 : x,
					v >= 0 ? top - 6 : beside ? BY + h / 2 + 4 : BY + h + 14,
					num(v),
					11,
					{
						anchor: beside ? 'start' : 'middle',
						muted: !used,
						opacity: grow(n)
					}
				)}
			</Readout>
		{/if}
		{@render txt(x, v < -0.005 ? BY - 8 : BY + 18, `${n}`, 12, {
			anchor: 'middle',
			weight: used ? 600 : 400,
			muted: !used
		})}
	{/each}
	<line x1={X0} x2={X1} y1={BY} y2={BY} stroke="var(--stage-line)" stroke-width="1.5" />
	{@render txt(X1, BY + 38, 'frequency (Hz) →', 12, { anchor: 'end', muted: true })}
	<Readout id="spectrum-notes">
		{@render txt(X1, BY + 55, '0 Hz: the average, which can be negative', 12, {
			anchor: 'end',
			muted: true
		})}
		{#if drawPhase && termsN > BARS}
			{@render txt(
				X1,
				BY + 72,
				`+ ${termsN - BARS} more frequencies (17–${termsN} Hz) not shown`,
				12,
				{
					anchor: 'end',
					muted: true
				}
			)}
		{/if}
	</Readout>

	{#if editing && samples}
		{#each bars as v, n (n)}
			<Handle
				x={barX(n)}
				y={BY - unit * v}
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
	}
	/* A finger scrolls the page unless the Draw button was pressed. */
	.draw.armed {
		touch-action: none;
	}
	.coarse-only {
		display: none;
	}
	@media (any-pointer: coarse) {
		.coarse-only {
			display: inline;
		}
		.fine-only {
			display: none;
		}
	}
</style>
