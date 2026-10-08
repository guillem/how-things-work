<script lang="ts">
	/**
	 * Sample means: a starting distribution (top), one sample of n values drawn
	 * from it and averaged (middle strip), and the histogram of many such
	 * averages (bottom), all on the same x axis from 0 to 1.
	 *
	 * Phases (`step.hints.phase`):
	 *   samples — the averages accumulate; readouts n, samples, means, spreads
	 *   clt     — same, plus the bell curve normalDensity(x, μ, σ/√n) scaled to
	 *             the count, the ±σ span above the top chart and the ±σ/√n
	 *             span on the bell; arriving here with n = 1, n is set to 30
	 *             once (n = 1 shows no bell)
	 *
	 * The run: `COUNT` samples of n draws from `sampler(shape, seed)` (seed =
	 * 1 + restart presses); averaging each n draws gives exactly the sequence of
	 * `sampleMeans(shape, n, COUNT, seed)`, and keeping the draws lets the middle
	 * strip show one sample's values. Sample k counts once k / samplePace seconds
	 * of the run have passed (a pure function of the run's elapsed time); the run
	 * restarts when the shape, n, the pace or the restart count change (start
	 * time kept in a plain variable inside a `$derived`). Every PERIOD seconds the
	 * strip replays the newest sample slowly: its values drop from the top chart,
	 * their average is marked and slides into the bottom chart.
	 *
	 * The reader draws a shape by dragging over the top chart (or, focused, with
	 * ←/→ to pick a bar and ↑/↓ to change it); it is stored in
	 * `params['shape:drawn']` as 20 comma-separated heights (0–1) and the
	 * `shape` control switches to "drawn".
	 *
	 * Bottom-chart bins: the averages of n grid values lie on a grid of spacing
	 * 1 / (20 n); the bin count is 20·d with d | n (d ≤ 4) so each bin covers the
	 * same number of grid points (no aliasing stripes).
	 *
	 * Reduced motion: every sample has been taken; sample 0 rests in the strip.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp, smoothstep, scale, startDrag, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { BINS, SHAPES, mean, normalDensity, sampler, sd } from '../clt';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const COUNT = 2500;
	const PERIOD = 2.6;

	const phase = $derived(String(step.hints?.phase ?? 'samples'));
	const cltAmt = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'clt' ? 1 : 0;
		untrack(() => cltAmt.set(v));
	});
	// Arriving at the clt step with n = 1 would show two humps under a flat
	// bell, the opposite of what the step says: bump n once, on arrival only
	// (never in reaction to n, so the reader can still slide back to 1).
	let prevPhase = '';
	$effect(() => {
		const p = phase;
		untrack(() => {
			if (p === 'clt' && prevPhase !== 'clt' && n === 1) setParam('sampleSize', 30);
			prevPhase = p;
		});
	});

	// ---- the starting distribution --------------------------------------------------
	const NAMES: Record<string, string> = {
		flat: 'Flat',
		skewed: 'Lopsided',
		twoHumps: 'Two humps',
		dice: 'Spiky',
		drawn: 'Your own'
	};
	const shapeId = $derived(String(params.shape ?? 'twoHumps'));
	const toUnit = (w: number[]) => {
		const m = Math.max(...w, 1e-9);
		return w.map((v) => Math.max(0, v) / m);
	};
	const drawnRaw = $derived(String(params['shape:drawn'] ?? ''));
	const drawn = $derived.by(() => {
		const v = drawnRaw.split(',').map(Number);
		return v.length === BINS && v.every((x) => Number.isFinite(x)) ? v.map((x) => clamp(x)) : null;
	});
	/** Bar heights 0–1 of the starting distribution (presets scaled to their tallest bar). */
	const heights = $derived(
		shapeId === 'drawn'
			? (drawn ?? toUnit(SHAPES.twoHumps))
			: toUnit(SHAPES[shapeId] ?? SHAPES.twoHumps)
	);
	const mu = $derived(mean(heights));
	const sigma = $derived(sd(heights));

	const n = $derived(clamp(Math.round(Number(params.sampleSize ?? 1)), 1, 50));
	const pace = $derived(clamp(Number(params.samplePace ?? 8), 1, 200));
	const restarts = $derived(Number(params.restart ?? 0));

	// ---- the run (draws and their averages) ---------------------------------------------
	const run = $derived.by(() => {
		const draw = sampler(heights, 1 + restarts);
		const draws = new Float64Array(COUNT * n);
		const means = new Float64Array(COUNT);
		// prefix sums of the means and their squares, for the running mean and spread
		const s1 = new Float64Array(COUNT + 1);
		const s2 = new Float64Array(COUNT + 1);
		for (let k = 0; k < COUNT; k++) {
			let s = 0;
			for (let j = 0; j < n; j++) {
				const v = draw();
				draws[k * n + j] = v;
				s += v;
			}
			means[k] = s / n;
			s1[k + 1] = s1[k] + means[k];
			s2[k + 1] = s2[k] + means[k] * means[k];
		}
		return { draws, means, s1, s2 };
	});

	const runKey = $derived(`${shapeId}|${drawnRaw}|${n}|${pace}|${restarts}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0; // a new step started
		return Math.max(0, t - t0);
	});
	const taken = $derived(Math.min(COUNT, Math.floor(elapsed * pace) + 1));

	// ---- geometry ------------------------------------------------------------------------
	const X0 = 64;
	const X1 = 616;
	const sx = scale([0, 1], [X0, X1]);
	const TOP_Y = 44;
	const TOP_BOT = 168;
	const STRIP_TOP = 192;
	const STRIP_BOT = 300;
	const BOT_TOP = 326;
	const BOT_BOT = 546;
	const barW = (X1 - X0) / BINS;
	const BAR_IDS = Array.from({ length: BINS }, (_, i) => i);
	const barH = (i: number) => heights[i] * (TOP_BOT - TOP_Y - 6);

	// ---- bottom histogram --------------------------------------------------------------------
	const counts = $derived.by(() => {
		const c: number[] = new Array(B).fill(0);
		for (let k = 0; k < taken; k++) c[Math.min(B - 1, Math.floor(run.means[k] * B + 1e-9))]++;
		return c;
	});
	const sdN = $derived(sigma / Math.sqrt(n));
	/** Bins: 20·d with d dividing n, about four per σ/√n, at most 100. */
	const B = $derived.by(() => {
		const target = clamp(4 / Math.max(sdN, 1e-6), BINS, 100);
		let d = 1;
		for (let q = 1; q <= n && BINS * q <= target; q++) if (n % q === 0) d = q;
		return BINS * d;
	});
	const bellPeak = $derived((taken / B) * normalDensity(mu, mu, Math.max(sdN, 1e-6)));
	const H = BOT_BOT - BOT_TOP;
	const unit = $derived(Math.min(H / 12, (H * 0.9) / Math.max(1, ...counts, bellPeak)));
	const bellPath = $derived.by(() => {
		let d = '';
		const N = 160;
		for (let i = 0; i <= N; i++) {
			const x = i / N;
			const y = BOT_BOT - (taken / B) * normalDensity(x, mu, Math.max(sdN, 1e-6)) * unit;
			d += `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${Math.max(BOT_TOP - 10, y).toFixed(1)}`;
		}
		return d;
	});
	/** Height of the bell at ±1 standard deviation (where its slope is steepest). */
	const bellAtSd = $derived(
		BOT_BOT - (taken / B) * normalDensity(mu + sdN, mu, Math.max(sdN, 1e-6)) * unit
	);

	/** Highest bar (smallest y) of the bottom histogram over the pixel range [x0, x1]. */
	function barTop(x0: number, x1: number) {
		const w = (X1 - X0) / B;
		let top = BOT_BOT;
		for (let b = Math.max(0, Math.floor((x0 - X0) / w)); b < B && X0 + b * w < x1; b++)
			if (counts[b] > 0) top = Math.min(top, BOT_BOT - counts[b] * unit);
		return top;
	}
	const LABEL_W = 34;
	/** Where the σ/√n label goes: right of the span, else left of it, else above the bell's top — never on the bars. */
	const sdnLabel = $derived.by(() => {
		const y = bellAtSd + 4;
		const xr = sx(Math.min(1, mu + sdN)) + 8;
		if (xr + LABEL_W <= X1 + 24 && barTop(xr - 2, xr + LABEL_W) > y + 4)
			return { x: xr, y, anchor: 'start' };
		const xl = sx(Math.max(0, mu - sdN)) - 8;
		if (xl - LABEL_W >= X0 - 40 && barTop(xl - LABEL_W, xl + 2) > y + 4)
			return { x: xl, y, anchor: 'end' };
		const peak = Math.max(BOT_TOP - 10, BOT_BOT - bellPeak * unit);
		const x = clamp(sx(mu), X0 + LABEL_W / 2, X1 - LABEL_W / 2);
		return {
			x,
			y: Math.min(peak, barTop(x - LABEL_W / 2, x + LABEL_W / 2)) - 8,
			anchor: 'middle'
		};
	});
	/** The σ label of the starting distribution's span (above the top chart). */
	const sdLabel = $derived.by(() => {
		const xr = sx(Math.min(1, mu + sigma)) + 8;
		if (xr + 10 <= X1 + 24) return { x: xr, anchor: 'start' };
		return { x: sx(Math.max(0, mu - sigma)) - 8, anchor: 'end' };
	});

	const meanOfMeans = $derived(run.s1[taken] / taken);
	const sdOfMeans = $derived(
		Math.sqrt(Math.max(0, run.s2[taken] / taken - (run.s1[taken] / taken) ** 2))
	);

	// ---- the showcased sample in the strip -----------------------------------------------------
	const show = $derived.by(() => {
		const cyc = reduced ? 0 : Math.floor(elapsed / PERIOD);
		const k = Math.min(taken - 1, Math.floor(cyc * PERIOD * pace));
		const u = reduced ? 1.45 : elapsed - cyc * PERIOD; // seconds into the replay
		const vals = Array.from(run.draws.subarray(k * n, k * n + n));
		// stack equal values in the strip
		const seen: Record<string, number> = {};
		const slot = vals.map((v) => {
			const s = seen[v] ?? 0;
			seen[v] = s + 1;
			return s;
		});
		const maxStack = Math.max(...Object.values(seen));
		const gap = Math.min(10, (STRIP_BOT - STRIP_TOP - 34) / Math.max(1, maxStack - 1));
		const r = clamp(gap / 2 - 0.4, 2, 4.5);
		const fade = reduced ? 1 : 1 - smoothstep(PERIOD - 0.35, PERIOD, u);
		const dots = vals.map((v, j) => {
			const i = Math.min(BINS - 1, Math.floor(v * BINS));
			const start = (0.7 * j) / Math.max(1, n);
			const a = clamp((u - start) / 0.4);
			const y0 = TOP_BOT - barH(i);
			const y1 = STRIP_BOT - r - 2 - slot[j] * gap;
			return { j, x: sx(v), y: lerp(y0, y1, a * a), o: smoothstep(0, 0.15, a) * fade };
		});
		const m = run.means[k];
		const markAmt = smoothstep(1.15, 1.4, u) * fade;
		const slide = clamp((u - 1.6) / 0.6);
		const binTop = BOT_BOT - counts[Math.min(B - 1, Math.floor(m * B + 1e-9))] * unit;
		return {
			k,
			dots,
			r,
			mean: m,
			markAmt,
			slideAmt: slide > 0 && slide < 1 ? 1 : slide >= 1 ? 1 - smoothstep(0, 0.2, u - 2.2) : 0,
			slideY: lerp(STRIP_BOT - 6, binTop - 6, slide * slide)
		};
	});

	// ---- drawing the starting shape --------------------------------------------------------------
	let sel = $state(10);
	let focused = $state(false);
	let last = -1;
	function setHeights(next: number[]) {
		setParam('shape:drawn', next.map((v) => v.toFixed(2)).join(','));
		if (shapeId !== 'drawn') setParam('shape', 'drawn');
	}
	function paint(p: Point) {
		const i = clamp(Math.floor((p.x - X0) / barW), 0, BINS - 1);
		const h = clamp((TOP_BOT - p.y) / (TOP_BOT - TOP_Y - 6));
		const next = heights.slice();
		const from = last < 0 ? i : last;
		const lo = Math.min(from, i);
		const hi = Math.max(from, i);
		for (let q = lo; q <= hi; q++) next[q] = h;
		last = i;
		sel = i;
		setHeights(next);
	}
	function onPointerDown(e: PointerEvent) {
		last = -1;
		startDrag(e, paint, () => (last = -1));
	}
	function onKey(e: KeyboardEvent) {
		const big = e.shiftKey ? 0.25 : 0.05;
		if (e.key === 'ArrowLeft') sel = Math.max(0, sel - 1);
		else if (e.key === 'ArrowRight') sel = Math.min(BINS - 1, sel + 1);
		else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			const next = heights.slice();
			next[sel] = clamp(next[sel] + (e.key === 'ArrowUp' ? big : -big));
			setHeights(next);
		} else if (e.key === 'Home') sel = 0;
		else if (e.key === 'End') sel = BINS - 1;
		else return;
		e.preventDefault();
	}

	// ---- panel -----------------------------------------------------------------------------------------
	const PL = 646;
	const fmt = (v: number) => v.toLocaleString('en-US');
	const f2 = (v: number) => v.toFixed(2);
	const f3 = (v: number) => v.toFixed(3);
	const TICKS = [0, 0.25, 0.5, 0.75, 1];
</script>

{#snippet txt(
	x: number,
	y: number,
	text: string,
	size: number,
	opts: {
		anchor?: string;
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
		tabular?: boolean;
	} = {}
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
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet span(cx: number, half: number, y: number, color: string)}
	{@const a = sx(Math.max(0, cx - half))}
	{@const b = sx(Math.min(1, cx + half))}
	<g>
		<line x1={a} x2={b} y1={y} y2={y} stroke={color} stroke-width="2" />
		<line x1={a} x2={a} y1={y - 5} y2={y + 5} stroke={color} stroke-width="2" />
		<line x1={b} x2={b} y1={y - 5} y2={y + 5} stroke={color} stroke-width="2" />
	</g>
{/snippet}

<g>
	<!-- shared x axis: grid lines through all three bands -->
	{#each TICKS as v (v)}
		<line
			x1={sx(v)}
			x2={sx(v)}
			y1={TOP_Y - 6}
			y2={BOT_BOT}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		{@render txt(sx(v), 566, String(v), 11, { anchor: 'middle', muted: true })}
	{/each}
	{@render txt((X0 + X1) / 2, 586, 'value', 11, { anchor: 'middle', muted: true })}

	<!-- the starting distribution -->
	<g
		class="draw"
		class:focused
		role="slider"
		tabindex="0"
		aria-label="Starting distribution: drag to draw it; arrows pick a bar and change its height"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={Math.round(heights[sel] * 100)}
		aria-valuetext="bar {sel + 1} of {BINS}, height {Math.round(heights[sel] * 100)}%"
		onpointerdown={onPointerDown}
		onkeydown={onKey}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	>
		<rect
			x={X0 - 6}
			y={TOP_Y - 10}
			width={X1 - X0 + 12}
			height={TOP_BOT - TOP_Y + 14}
			rx="6"
			fill="var(--stage-bg)"
			fill-opacity="0.01"
			class="hit"
		/>
		{#each BAR_IDS as i (i)}
			<rect
				x={X0 + i * barW + 1.5}
				y={TOP_BOT - barH(i)}
				width={barW - 3}
				height={barH(i)}
				rx="2"
				fill="var(--clt-source)"
				opacity={focused && i === sel ? 1 : 0.75}
				stroke={focused && i === sel ? 'var(--focus)' : 'none'}
				stroke-width="2"
			/>
		{/each}
		<rect
			class="ring"
			x={X0 - 6}
			y={TOP_Y - 10}
			width={X1 - X0 + 12}
			height={TOP_BOT - TOP_Y + 14}
			rx="6"
			fill="none"
			stroke="var(--focus)"
			stroke-width="2"
		/>
	</g>
	<line x1={X0} x2={X1} y1={TOP_BOT} y2={TOP_BOT} stroke="var(--stage-line)" stroke-width="1.5" />

	<!-- the mean, through all three bands -->
	<line
		x1={sx(mu)}
		x2={sx(mu)}
		y1={TOP_Y - 14}
		y2={BOT_BOT}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-dasharray="4 4"
		opacity="0.55"
	/>
	{@render txt(sx(mu), TOP_Y - 18, `mean ${f2(mu)}`, 12, { anchor: 'middle', weight: 600 })}

	<!-- ±σ on the starting distribution (clt) -->
	{#if cltAmt.current > 0.01}
		<g opacity={cltAmt.current}>
			{@render span(mu, sigma, TOP_Y - 3, 'var(--clt-source)')}
			{@render txt(sdLabel.x, TOP_Y + 1, 'σ', 12, {
				anchor: sdLabel.anchor,
				color: 'var(--clt-source)',
				weight: 600
			})}
		</g>
	{/if}

	<!-- the sample strip -->
	<line
		x1={X0}
		x2={X1}
		y1={STRIP_BOT}
		y2={STRIP_BOT}
		stroke="var(--stage-line)"
		stroke-width="1"
		opacity="0.6"
	/>
	{#each show.dots as d (d.j)}
		<circle cx={d.x} cy={d.y} r={show.r} fill="var(--clt-source)" opacity={d.o} />
	{/each}
	{#if show.markAmt > 0.01}
		<g opacity={show.markAmt}>
			<line
				x1={sx(show.mean)}
				x2={sx(show.mean)}
				y1={STRIP_TOP + 22}
				y2={STRIP_BOT}
				stroke="var(--clt-means)"
				stroke-width="2.5"
			/>
			{@render txt(sx(show.mean), STRIP_TOP + 16, `average ${f2(show.mean)}`, 12, {
				anchor: sx(show.mean) > X1 - 50 ? 'end' : sx(show.mean) < X0 + 50 ? 'start' : 'middle',
				weight: 600,
				color: 'var(--clt-means)'
			})}
		</g>
	{/if}

	<!-- the histogram of averages -->
	{#each counts as c, b (b)}
		{#if c > 0}
			<rect
				x={X0 + (b * (X1 - X0)) / B + 0.5}
				y={BOT_BOT - c * unit}
				width={(X1 - X0) / B - 1}
				height={c * unit}
				rx="1.5"
				fill="var(--clt-means)"
				opacity="0.8"
			/>
		{/if}
	{/each}
	<line x1={X0} x2={X1} y1={BOT_BOT} y2={BOT_BOT} stroke="var(--stage-line)" stroke-width="1.5" />

	{#if show.slideAmt > 0.01}
		<circle
			cx={sx(show.mean)}
			cy={show.slideY}
			r="5"
			fill="var(--clt-means)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={show.slideAmt}
		/>
	{/if}

	{#if cltAmt.current > 0.01}
		<g opacity={cltAmt.current}>
			<path d={bellPath} fill="none" stroke="var(--clt-bell)" stroke-width="2.5" />
			{@render span(mu, sdN, bellAtSd, 'var(--clt-bell)')}
			{@render txt(sdnLabel.x, sdnLabel.y, 'σ/√n', 12, {
				anchor: sdnLabel.anchor,
				color: 'var(--clt-bell)',
				weight: 600
			})}
		</g>
	{/if}

	<!-- panel -->
	{@render txt(PL, 52, 'starting distribution', 13, { muted: true })}
	{@render txt(PL, 76, NAMES[shapeId] ?? 'Two humps', 17, { weight: 600 })}
	{@render txt(PL, 98, `mean ${f2(mu)} · spread σ = ${f2(sigma)}`, 12, { tabular: true })}
	{@render txt(PL, 120, 'Drag over the chart to draw your own.', 12, { muted: true })}

	{@render txt(PL, 212, `one sample: n = ${n} value${n === 1 ? '' : 's'}`, 13, { muted: true })}
	{@render txt(PL, 238, `their average ${f2(show.mean)}`, 16, {
		weight: 600,
		color: 'var(--clt-means)',
		opacity: Math.max(0.6, show.markAmt)
	})}
	{#if n === 1}
		{@render txt(PL, 260, 'n = 1: each average is just one value', 12, { muted: true })}
	{/if}

	{@render txt(PL, 344, 'samples taken', 13, { muted: true })}
	{@render txt(PL, 376, fmt(taken), 28, { weight: 600, tabular: true })}
	{@render txt(PL, 400, `each one the average of ${n} value${n === 1 ? '' : 's'}`, 12, {
		muted: true
	})}
	{@render txt(PL, 426, `mean of the averages ${f2(meanOfMeans)}`, 12, { tabular: true })}
	{@render txt(PL, 446, `spread of the averages ${f3(sdOfMeans)}`, 12, { tabular: true })}
	{@render txt(PL, 466, `σ/√n = ${f3(sigma)}/√${n} = ${f3(sdN)}`, 12, {
		tabular: true,
		muted: cltAmt.current < 0.5,
		color: cltAmt.current >= 0.5 ? 'var(--clt-bell)' : undefined,
		weight: cltAmt.current >= 0.5 ? 600 : 500
	})}
	{#if cltAmt.current > 0.01}
		<g opacity={cltAmt.current}>
			<line x1={PL} x2={PL + 26} y1={496} y2={496} stroke="var(--clt-bell)" stroke-width="2.5" />
			{@render txt(PL + 36, 500, 'bell curve: centre μ, width σ/√n', 12)}
			{@render txt(PL, 524, '4 × the sample → ½ the spread', 12, { muted: true })}
		</g>
	{/if}
</g>

<style>
	.draw {
		cursor: crosshair;
		outline: none;
		touch-action: none;
	}
	.draw .ring {
		opacity: 0;
	}
	.draw:focus-visible .ring {
		opacity: 1;
	}
</style>
