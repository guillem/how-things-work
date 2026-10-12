<script lang="ts">
	/**
	 * A closed curve drawn by a chain of turning circles (steps `epicycles`,
	 * `draw-curve`).
	 *
	 * The chosen curve (`params.curve`: a preset or the reader's drawing in
	 * `params['ft:curve']`) is read as a complex signal and transformed
	 * (`curveCircles`). The first `params.circles` circles, biggest first, are
	 * chained from the curve's centre (the 0 Hz term); the last point is the
	 * pen. The pen goes round once every PERIOD seconds, leaving a fading
	 * trail; the whole curve those circles draw is shown faintly, over the
	 * original (dashed). Right: the radius of every circle against its
	 * frequency, anticlockwise (k > 0) and clockwise (k < 0), the ones in use
	 * highlighted.
	 *
	 * The reader can draw a loop on the left at any time: the stroke is kept
	 * locally while drawing, then normalised, written to `params['ft:curve']`
	 * and the curve switched to "Your drawing" when the pointer is released.
	 */
	import { cycle, startDrag, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { chain, curveCircles, num, pack, pen, type Complex } from '../fourier';
	import { curveSource, normaliseLoop } from '../signals';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const PERIOD = 12; // seconds per trip round the curve
	const CX = 318;
	const CY = 318;
	const S = 215; // px per unit
	const AREA = { x0: 40, x1: 596, y0: 84, y1: 586 };
	const MAX_DRAWN = 60; // circles drawn as circles; smaller ones only as arms
	const KMAX = 20; // frequencies shown on the chart: −KMAX … KMAX
	const BX0 = 640;
	const BX1 = 930;
	const BY = 440;
	const BH = 170;
	const TRACE = 400; // points on the drawn curve

	const NAMES: Record<string, string> = {
		heart: 'heart',
		star: 'star',
		square: 'square',
		drawn: 'your drawing'
	};

	const phase = $derived(String(step.hints?.phase ?? 'preset'));
	const name = $derived(String(params.curve ?? 'heart'));
	const points = $derived(curveSource(name, String(params['ft:curve'] ?? '')));
	const circles = $derived(points ? curveCircles(points) : null);
	const count = $derived(Math.max(1, Math.min(100, Math.round(Number(params.circles ?? 12)))));

	const toScreen = (z: Complex) => ({ x: CX + S * z.re, y: CY - S * z.im });

	// The curve these circles draw, once round, and the original.
	const traced = $derived.by(() => {
		if (!circles) return [];
		return Array.from({ length: TRACE }, (_, i) => toScreen(pen(circles, count, i / TRACE)));
	});
	const pathOf = (pts: { x: number; y: number }[], close = true) =>
		pts.length
			? pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
				(close ? ' Z' : '')
			: '';
	const tracedPath = $derived(pathOf(traced));
	const originalPath = $derived(points ? pathOf(points.map(toScreen)) : '');

	// The pen and its trail (the last ~half turn), a pure function of t.
	const u = $derived(cycle(reduced ? 2.5 : t, PERIOD));
	const links = $derived(circles ? chain(circles, count, u).map(toScreen) : []);
	const tip = $derived(links.length ? links[links.length - 1] : { x: CX, y: CY });
	const trail = $derived.by(() => {
		if (!traced.length || reduced) return [];
		const end = Math.floor(u * TRACE);
		const len = Math.min(end + 1, TRACE / 2);
		// Segments of the trail fade from old to new: four pieces, each brighter.
		const out: { d: string; o: number }[] = [];
		for (let q = 0; q < 4; q++) {
			const a = end - len + Math.floor((q * len) / 4);
			const b = end - len + Math.floor(((q + 1) * len) / 4);
			const pts: { x: number; y: number }[] = [];
			for (let i = a; i <= b; i++) pts.push(traced[((i % TRACE) + TRACE) % TRACE]);
			pts.push(q === 3 ? tip : pts[pts.length - 1]);
			out.push({ d: pathOf(pts, false), o: 0.25 + 0.25 * q });
		}
		return out;
	});
	const arms = $derived(pathOf(links, false));
	const radii = $derived(circles ? circles.slice(1, count + 1).map((c) => c.radius * S) : []);

	// ---- the chart of circle sizes -----------------------------------------------------
	const used = $derived(new Set(circles ? circles.slice(1, count + 1).map((c) => c.k) : []));
	const chartMax = $derived(circles ? Math.max(...circles.slice(1).map((c) => c.radius), 0.05) : 1);
	/** Radius of the circle of each frequency −KMAX … KMAX (index k + KMAX). */
	const byK = $derived.by(() => {
		const a = new Array<number>(2 * KMAX + 1).fill(0);
		for (const c of circles ?? []) if (Math.abs(c.k) <= KMAX) a[c.k + KMAX] = c.radius;
		return a;
	});
	const slot = (BX1 - BX0) / (2 * KMAX + 1);
	const bx = (k: number) => BX0 + slot * (k + KMAX + 0.5);
	const KS = Array.from({ length: 2 * KMAX + 1 }, (_, i) => i - KMAX);
	const beyond = $derived(
		circles ? circles.slice(1, count + 1).filter((c) => Math.abs(c.k) > KMAX).length : 0
	);
	const biggest = $derived(circles && circles.length > 1 ? circles[1] : null);

	// ---- drawing a loop ----------------------------------------------------------------
	let stroke = $state<Point[]>([]);
	const strokePath = $derived(pathOf(stroke, false));
	function ondraw(event: PointerEvent) {
		stroke = [];
		startDrag(
			event,
			(p) => {
				stroke.push({
					x: Math.max(AREA.x0, Math.min(AREA.x1, p.x)),
					y: Math.max(AREA.y0, Math.min(AREA.y1, p.y))
				});
			},
			() => {
				const loop = normaliseLoop(stroke.map((p) => ({ re: (p.x - CX) / S, im: (CY - p.y) / S })));
				stroke = [];
				if (!loop) return;
				setParam('ft:curve', pack(loop.flatMap((z) => [z.re, z.im])));
				setParam('curve', 'drawn');
			}
		);
	}
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
	<!-- ================= the drawing ================= -->
	{#if circles}
		{@render txt(
			40,
			40,
			`${count} circle${count === 1 ? '' : 's'} drawing ${name === 'drawn' ? 'your drawing' : `the ${NAMES[name] ?? name}`}`,
			20,
			{ weight: 600, color: 'var(--ft-pen)' }
		)}
		{@render txt(
			40,
			64,
			phase === 'draw'
				? 'draw a loop here to replace it · biggest circles first'
				: 'biggest circles first · dashed: the original',
			13,
			{ muted: true }
		)}

		<path
			d={originalPath}
			fill="none"
			stroke="var(--ft-target)"
			stroke-width="1.6"
			stroke-dasharray="5 5"
			opacity="0.7"
		/>
		<path
			d={tracedPath}
			fill="none"
			stroke="var(--ft-pen)"
			stroke-width={reduced ? 2.8 : 1.6}
			opacity={reduced ? 1 : 0.4}
			stroke-linejoin="round"
		/>
		{#each trail as s, i (i)}
			<path
				d={s.d}
				fill="none"
				stroke="var(--ft-pen)"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity={s.o}
			/>
		{/each}

		<!-- the circles and their arms -->
		{#each radii.slice(0, MAX_DRAWN) as r, i (i)}
			{#if r > 1.2}
				<circle
					cx={links[i].x}
					cy={links[i].y}
					{r}
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width={i === 0 ? 1.3 : 1}
					opacity={i < 3 ? 0.45 : 0.28}
				/>
			{/if}
		{/each}
		<path
			d={arms}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.6"
			stroke-linejoin="round"
			opacity="0.8"
		/>
		<circle cx={links[0].x} cy={links[0].y} r="3.5" fill="var(--stage-ink)" />
		<circle
			cx={tip.x}
			cy={tip.y}
			r="6"
			fill="var(--ft-pen)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{:else if !stroke.length}
		<rect
			x={AREA.x0 + 20}
			y={AREA.y0 + 20}
			width={AREA.x1 - AREA.x0 - 40}
			height={AREA.y1 - AREA.y0 - 40}
			rx="10"
			fill="none"
			stroke="var(--ft-pen)"
			stroke-dasharray="6 6"
			opacity="0.7"
		/>
		{@render txt(CX, CY - 8, 'Draw a loop here', 20, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--ft-pen)'
		})}
		{@render txt(CX, CY + 18, 'with the mouse or a finger; it closes when you let go', 13, {
			anchor: 'middle',
			muted: true
		})}
	{/if}

	{#if strokePath}
		<path
			d={strokePath}
			fill="none"
			stroke="var(--ft-bar)"
			stroke-width="3"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}

	<!-- the drawing surface -->
	<rect
		class="draw"
		x={AREA.x0}
		y={AREA.y0}
		width={AREA.x1 - AREA.x0}
		height={AREA.y1 - AREA.y0}
		fill="transparent"
		role="presentation"
		onpointerdown={ondraw}
	/>

	<!-- ================= the circles by frequency ================= -->
	{#if circles}
		{@render txt(BX0, 120, 'Radius of each circle', 15, { weight: 600 })}
		{@render txt(BX0, 140, 'by frequency (turns per trip round the curve)', 12, { muted: true })}
		{@render txt(BX0, 172, '● clockwise (k < 0)', 13, { weight: 600, color: 'var(--ft-pen)' })}
		{@render txt(BX1, 172, 'anticlockwise (k > 0) ●', 13, {
			anchor: 'end',
			weight: 600,
			color: 'var(--ft-sum)'
		})}
		{#each KS as k (k)}
			{@const r = byK[k + KMAX]}
			{@const h = k === 0 ? 0 : (BH * r) / chartMax}
			{@const on = used.has(k)}
			{#if h > 0.3}
				<rect
					x={bx(k) - slot * 0.35}
					y={BY - h}
					width={slot * 0.7}
					height={h}
					rx="1.5"
					fill={k > 0 ? 'var(--ft-sum)' : 'var(--ft-pen)'}
					opacity={on ? 0.95 : 0.22}
				/>
			{/if}
		{/each}
		<line x1={BX0} x2={BX1} y1={BY} y2={BY} stroke="var(--stage-line)" stroke-width="1.5" />
		{#each [-20, -10, 0, 10, 20] as k (k)}
			<line x1={bx(k)} x2={bx(k)} y1={BY} y2={BY + 5} stroke="var(--stage-line)" />
			{@render txt(bx(k), BY + 20, `${k}`.replace('-', '−'), 12, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt(bx(0), BY + 40, '0: the centre, not a circle', 12, {
			anchor: 'middle',
			muted: true
		})}
		{#if beyond > 0}
			{@render txt(BX1, BY + 60, `+ ${beyond} in use beyond ±${KMAX}, not shown`, 12, {
				anchor: 'end',
				muted: true
			})}
		{/if}
		{#if biggest}
			{@render txt(
				BX0,
				BY + 86,
				`Biggest: k = ${`${biggest.k}`.replace('-', '−')}, radius ${num(biggest.radius)},`,
				13,
				{ weight: 600 }
			)}
			{@render txt(
				BX0,
				BY + 104,
				`${Math.abs(biggest.k)} turn${Math.abs(biggest.k) === 1 ? '' : 's'} ${biggest.k > 0 ? 'anticlockwise' : 'clockwise'} per trip`,
				13,
				{ weight: 600 }
			)}
		{/if}
	{/if}
</g>

<style>
	.draw {
		cursor: crosshair;
		touch-action: none;
	}
</style>
