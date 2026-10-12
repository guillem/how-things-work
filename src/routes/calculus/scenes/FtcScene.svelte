<script lang="ts">
	/**
	 * The fundamental theorem of calculus, in both directions.
	 *
	 * Phases (`step.hints.phase`):
	 *   running — the area under the curve from 0 to x, and the running area A(x)
	 *             plotted below; at the start of the step the edge sweeps in from 0
	 *   strip   — a thin strip f(x)·dx at the edge, and the tangent of A at x, whose
	 *             slope is f(x)
	 *   undo    — the slope curve f′ below, with the area under it from 0 to x, and
	 *             the rise f(x) − f(0) on the curve above: the two are equal
	 *   motion  — the same for the thrown ball (forced by `hints.curve`): height above
	 *             with its tangent (slope = velocity), velocity below, and the ball
	 *
	 * The edge / point x lives in `params.x`, shared with the slider.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { X0, X1, accumulate, integral, runningArea } from '../calculus';
	import Frame from './Frame.svelte';
	import KnotHandles from './KnotHandles.svelte';
	import PointHandle from './PointHandle.svelte';
	import Txt from './Txt.svelte';
	import {
		F_RANGE,
		LEFT,
		PANEL,
		RIGHT,
		fnPath,
		layout,
		niceRange,
		num,
		pointX,
		signedAreaPaths,
		stepCurve,
		sx
	} from './plot';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'running'));
	const curve = $derived(stepCurve(step, params));
	const isBall = $derived(curve.id === 'ball');
	const forced = $derived(Boolean(step.hints?.curve));
	const areaBelow = $derived(phase === 'running' || phase === 'strip');

	// On the first step the edge sweeps in from 0 to where the reader left it (display only).
	const sweep = $derived(phase === 'running' && !reduced ? smoothstep(0.2, 2, t) : 1);
	const x = $derived(X0 + (pointX(params) - X0) * sweep);

	// ---- phase cross-fades -----------------------------------------------------------
	const tween = (v: number) => new Tween(v, { duration: 700, easing: cubicInOut });
	const wArea = tween(0);
	const wStrip = tween(0);
	const wUndo = tween(0);
	const wKnots = tween(0);
	$effect(() => {
		const p = phase;
		const knots = curve.id === 'custom' && !forced;
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			wArea.set(p === 'running' || p === 'strip' ? 1 : 0, o);
			wStrip.set(p === 'strip' ? 1 : 0, o);
			wUndo.set(p === 'undo' || p === 'motion' ? 1 : 0, o);
			wKnots.set(knots ? 1 : 0, o);
		});
	});

	// ---- plots ------------------------------------------------------------------------
	const boxes = layout(1);
	const sy = $derived(scale(F_RANGE, [boxes.upper.bottom, boxes.upper.top]));
	const curvePath = $derived(fnPath(curve.f, sy));
	const SAMPLES = 121;
	const step_ = (X1 - X0) / (SAMPLES - 1);
	const runSamples = $derived(accumulate(curve.f, X0, X1, SAMPLES));
	// The lower plot: the running area A, or the slope f′. Its range tweens between them.
	const lowerRange = $derived.by(() => {
		const vals = areaBelow
			? runSamples
			: Array.from({ length: SAMPLES }, (_, i) => curve.df(X0 + i * step_));
		return niceRange(Math.min(...vals), Math.max(...vals));
	});
	const lo = tween(0);
	const hi = tween(10);
	let first = true;
	$effect(() => {
		const [a, b] = lowerRange;
		untrack(() => {
			const o = { duration: reduced || first ? 0 : 600 };
			first = false;
			lo.set(a, o);
			hi.set(b, o);
		});
	});
	const syL = $derived(scale([lo.current, hi.current], [boxes.lower.bottom, boxes.lower.top]));

	// ---- values at x ----------------------------------------------------------------------
	const fx = $derived(curve.f(x));
	const f0 = $derived(curve.f(X0));
	const dfx = $derived(curve.df(x));
	const A = $derived(runningArea(curve.f, X0, x));
	const P = $derived({ x: sx(x), y: sy(fx) });

	// The running area A(x): the whole curve faint, solid up to x.
	const runPath = (upTo: number) => {
		let d = '';
		const last = Math.min(SAMPLES - 1, Math.floor((upTo - X0) / step_ + 1e-9));
		for (let i = 0; i <= last; i++)
			d += `${i ? 'L' : 'M'}${sx(X0 + i * step_).toFixed(1)} ${syL(runSamples[i]).toFixed(1)}`;
		if (upTo > X0 + last * step_ + 1e-9) d += `L${sx(upTo).toFixed(1)} ${syL(A).toFixed(1)}`;
		return d;
	};
	const runFull = $derived(runPath(X1));
	const runSoFar = $derived(runPath(x));
	const slopeFull = $derived(fnPath(curve.df, syL));

	// Areas: under the curve up to x (upper plot), under the slope curve up to x (lower).
	const areaUpper = $derived(signedAreaPaths(curve.f, sy, X0, x));
	const areaLower = $derived(signedAreaPaths(curve.df, syL, X0, x));

	// The strip at the edge: dx wide, as tall as the curve at x.
	const DX = 0.12;
	const stripX = $derived(x + DX > X1 ? x - DX : x);
	const strip = $derived({
		x: sx(stripX),
		w: sx(stripX + DX) - sx(stripX),
		y: Math.min(sy(0), sy(fx)),
		h: Math.abs(sy(fx) - sy(0))
	});

	// Tangents, 120 px each way along the curve on screen: of A (slope f(x)) and of the curve.
	const tangentAt = (px: number, py: number, slope: number, ys: typeof sy) => {
		const ux = sx(X0 + 1) - sx(X0);
		const uy = ys(slope) - ys(0);
		const k = 120 / Math.hypot(ux, uy);
		return `M${px - ux * k} ${py - uy * k} L${px + ux * k} ${py + uy * k}`;
	};
	const Adot = $derived({ x: sx(x), y: syL(A) });
	const slopeDot = $derived({ x: sx(x), y: syL(dfx) });
	const tangentA = $derived(tangentAt(Adot.x, Adot.y, fx, syL));
	const tangentF = $derived(tangentAt(P.x, P.y, dfx, sy));

	const rise = $derived(fx - f0);
	// Measured separately from the rise: that the two agree is the point of the step.
	const areaDf = $derived(integral(curve.df, X0, x));
	const riseColor = $derived(rise >= 0 ? 'var(--calc-area)' : 'var(--calc-neg)');
	const lowerDot = $derived(areaBelow ? Adot : slopeDot);
	const labelRight = $derived(P.x < RIGHT - 170);

	// ---- names and units ----------------------------------------------------------------------
	const xName = $derived(curve.xName);
	const xUnit = $derived(isBall ? ' s' : '');
	const yUnit = $derived(isBall ? ' m' : '');
	const vUnit = $derived(isBall ? ' m/s' : '');
	const lowerName = $derived(
		areaBelow ? 'running area A(x)' : isBall ? 'velocity v (m/s)' : 'slope f′(x)'
	);
	const lowerColor = $derived(areaBelow ? 'var(--calc-area)' : 'var(--calc-slope)');
</script>

<g>
	<defs>
		<clipPath id="calc-ftc-upper">
			<rect
				x={LEFT}
				y={boxes.upper.top}
				width={RIGHT - LEFT}
				height={boxes.upper.bottom - boxes.upper.top}
			/>
		</clipPath>
		<clipPath id="calc-ftc-lower">
			<rect
				x={LEFT}
				y={boxes.lower.top}
				width={RIGHT - LEFT}
				height={boxes.lower.bottom - boxes.lower.top}
			/>
		</clipPath>
	</defs>

	<!-- ============ the curve ============ -->
	<Txt x={LEFT + 44} y={28} text={curve.formula} size={15} weight={600} color="var(--calc-curve)" />
	<Frame {sx} {sy} yName={isBall ? 'h (m)' : 'y'} />
	<g clip-path="url(#calc-ftc-upper)">
		{#if wArea.current > 0.01}
			<g opacity={wArea.current}>
				<path d={areaUpper.above} fill="var(--calc-area)" opacity="0.3" />
				<path d={areaUpper.below} fill="var(--calc-neg)" opacity="0.3" />
				<line x1={P.x} x2={P.x} y1={sy(0)} y2={P.y} stroke="var(--stage-ink)" stroke-width="1.5" />
			</g>
		{/if}
		{#if wStrip.current > 0.01}
			<rect
				x={strip.x}
				y={strip.y}
				width={strip.w}
				height={strip.h}
				fill={fx >= 0 ? 'var(--calc-area)' : 'var(--calc-neg)'}
				opacity={0.7 * wStrip.current}
			/>
		{/if}
		<path
			d={curvePath}
			fill="none"
			stroke="var(--calc-curve)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{#if wUndo.current > 0.01}
			<g opacity={wUndo.current}>
				<!-- the level the curve started from, and the rise since -->
				<line
					x1={sx(X0)}
					x2={P.x}
					y1={sy(f0)}
					y2={sy(f0)}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="4 4"
				/>
				<line
					x1={P.x}
					x2={P.x}
					y1={sy(f0)}
					y2={P.y}
					stroke={riseColor}
					stroke-width="4"
					stroke-linecap="round"
				/>
				{#if phase === 'motion'}
					<path d={tangentF} stroke="var(--calc-slope)" stroke-width="2.6" stroke-linecap="round" />
				{/if}
			</g>
		{/if}
	</g>
	{#if wStrip.current > 0.01 && strip.h > 4}
		<Txt
			x={labelRight ? strip.x + strip.w + 10 : strip.x - 10}
			y={(sy(0) + P.y) / 2 + 5}
			text="strip ≈ f(x) × dx"
			anchor={labelRight ? 'start' : 'end'}
			size={12}
			weight={600}
			opacity={wStrip.current}
		/>
	{/if}
	{#if wUndo.current > 0.01 && Math.abs(sy(f0) - P.y) > 22}
		<Txt
			x={labelRight ? P.x + 12 : P.x - 12}
			y={(sy(f0) + P.y) / 2 + 5}
			text="rise {num(rise)}{yUnit}"
			anchor={labelRight ? 'start' : 'end'}
			size={13}
			weight={600}
			color={riseColor}
			opacity={wUndo.current}
		/>
	{/if}

	<!-- ============ the lower plot ============ -->
	<Frame {sx} sy={syL} yName={lowerName} yColor={lowerColor} xName={isBall ? 't (s)' : 'x'} />
	<g clip-path="url(#calc-ftc-lower)">
		{#if wArea.current > 0.01}
			<g opacity={wArea.current}>
				<path
					d={runFull}
					fill="none"
					stroke="var(--calc-area)"
					stroke-width="2"
					opacity="0.3"
					stroke-dasharray="5 5"
				/>
				<path
					d={runSoFar}
					fill="none"
					stroke="var(--calc-area)"
					stroke-width="3"
					stroke-linecap="round"
				/>
				{#if wStrip.current > 0.01}
					<path
						d={tangentA}
						stroke="var(--calc-curve)"
						stroke-width="2.4"
						stroke-linecap="round"
						opacity={wStrip.current}
					/>
				{/if}
			</g>
		{/if}
		{#if wUndo.current > 0.01}
			<g opacity={wUndo.current}>
				<path d={areaLower.above} fill="var(--calc-area)" opacity="0.3" />
				<path d={areaLower.below} fill="var(--calc-neg)" opacity="0.3" />
				<path
					d={slopeFull}
					fill="none"
					stroke="var(--calc-slope)"
					stroke-width="3"
					stroke-linecap="round"
				/>
			</g>
		{/if}
	</g>
	<line
		x1={P.x}
		x2={P.x}
		y1={P.y + 10}
		y2={lowerDot.y - 8}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
		opacity="0.5"
	/>
	<circle
		cx={lowerDot.x}
		cy={lowerDot.y}
		r="6"
		fill={areaBelow ? 'var(--calc-area)' : 'var(--calc-slope)'}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	{#if wArea.current > 0.5}
		<Txt
			x={Adot.x + (labelRight ? 14 : -14)}
			y={Adot.y - 12}
			text="A = {num(A)}"
			anchor={labelRight ? 'start' : 'end'}
			size={13}
			weight={600}
			color="var(--calc-area)"
			pill
		/>
	{/if}

	<!-- ============ handles ============ -->
	{#if wKnots.current > 0.01}
		<KnotHandles {curve} {sy} opacity={wKnots.current} {setParam} />
	{/if}
	<PointHandle
		{x}
		y={P.y}
		label={phase === 'running' || phase === 'strip'
			? 'Right edge of the area'
			: 'Point on the curve'}
		unit={isBall ? 'seconds' : ''}
		{t}
		{reduced}
		{setParam}
	/>

	<!-- the ball, at its height on the same scale as the graph -->
	{#if phase === 'motion'}
		<line
			x1={932}
			x2={932}
			y1={sy(0)}
			y2={sy(11.5)}
			stroke="var(--stage-line)"
			stroke-dasharray="2 4"
		/>
		<line x1={918} x2={946} y1={sy(0)} y2={sy(0)} stroke="var(--stage-ink-muted)" />
		<circle
			cx={932}
			cy={sy(fx) - 7}
			r="7"
			fill="var(--explainer-accent)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- ============ readout panel ============ -->
	<g>
		<Txt x={PANEL} y={84} text="{xName} = {num(x)}{xUnit}" size={15} weight={600} />
		{#if phase === 'running'}
			<Txt x={PANEL} y={124} text="area from 0 to x" size={12} muted />
			<Txt
				x={PANEL}
				y={154}
				text="A(x) = {num(A)}"
				size={22}
				weight={700}
				color="var(--calc-area)"
			/>
			<Txt x={PANEL} y={180} text="height f(x) = {num(fx)}" size={13} muted />
		{:else if phase === 'strip'}
			<Txt x={PANEL} y={124} text="slope of A at x" size={12} muted />
			<Txt x={PANEL} y={150} text={num(fx)} size={22} weight={700} color="var(--calc-curve)" />
			<Txt x={PANEL} y={186} text="height of the curve" size={12} muted />
			<Txt
				x={PANEL}
				y={212}
				text="f(x) = {num(fx)}"
				size={22}
				weight={700}
				color="var(--calc-curve)"
			/>
			<Txt x={PANEL} y={244} text="the same number" size={13} weight={600} />
			<Txt x={PANEL} y={264} text="wherever x is" size={13} muted />
		{:else if phase === 'undo'}
			<Txt x={PANEL} y={124} text="area under f′, 0 to x" size={12} muted />
			<Txt x={PANEL} y={150} text={num(areaDf)} size={22} weight={700} color="var(--calc-slope)" />
			<Txt x={PANEL} y={186} text="rise of f since x = 0" size={12} muted />
			<Txt
				x={PANEL}
				y={212}
				text="f(x) − f(0) = {num(rise)}"
				size={18}
				weight={700}
				color={riseColor}
			/>
		{:else}
			<Txt x={PANEL} y={108} text="height h = {num(fx)} m" size={14} muted />
			<Txt x={PANEL} y={146} text="velocity = slope of h" size={12} muted />
			<Txt
				x={PANEL}
				y={172}
				text="v = {num(dfx)}{vUnit}"
				size={20}
				weight={700}
				color="var(--calc-slope)"
			/>
			<Txt x={PANEL} y={208} text="area under v, 0 to t" size={12} muted />
			<Txt x={PANEL} y={234} text="= {num(areaDf)} m" size={20} weight={700} color={riseColor} />
			<Txt x={PANEL} y={258} text="the height gained" size={12} muted />
		{/if}
	</g>
</g>
