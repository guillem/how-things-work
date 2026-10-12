<script lang="ts">
	/**
	 * A point on a curve, the chord to a second point, the tangent, and the
	 * slope plotted as a second curve underneath.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   chord   — the chord from x to x + 1 with its run and rise
	 *   secant  — the same chord with the run h from `params.h`
	 *   tangent — the tangent line at the point and its slope f′(x)
	 *   graph   — and the slope curve f′ on a second plot below
	 *   edit    — the same, with the curve's knots always shown for dragging
	 *
	 * The point's x lives in `params.x` (shared with the slider); the curve is
	 * `params.curve`, and the knots of "your own" curve are in `params.knots`.
	 * Nothing moves on its own except a pulse inviting a drag and, on the graph
	 * step, the slope curve drawing itself in from the left.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { scale, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { X0, X1, chordSlope } from '../calculus';
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
		stepCurve,
		sx
	} from './plot';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'chord'));
	const curve = $derived(stepCurve(step, params));
	const x = $derived(pointX(params));
	const isBall = $derived(curve.id === 'ball');

	// ---- phase cross-fades -----------------------------------------------------------
	const tween = (v: number) => new Tween(v, { duration: 700, easing: cubicInOut });
	const wChord = tween(0);
	const wTangent = tween(0);
	const wSplit = tween(0);
	const wKnots = tween(0);
	const showKnots = $derived(phase === 'edit' || curve.id === 'custom');
	$effect(() => {
		const p = phase;
		const knots = showKnots;
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			wChord.set(p === 'chord' || p === 'secant' ? 1 : 0, o);
			wTangent.set(p === 'tangent' || p === 'graph' || p === 'edit' ? 1 : 0, o);
			wSplit.set(p === 'graph' || p === 'edit' ? 1 : 0, o);
			wKnots.set(knots ? 1 : 0, o);
		});
	});

	// ---- plots ------------------------------------------------------------------------
	const boxes = $derived(layout(wSplit.current));
	const sy = $derived(scale(F_RANGE, [boxes.upper.bottom, boxes.upper.top]));
	// The slope plot's range fits the slope curve, rounded out; it tweens when the curve changes.
	const slopeRange = $derived.by(() => {
		let lo = Infinity;
		let hi = -Infinity;
		for (let i = 0; i <= 120; i++) {
			const v = curve.df(X0 + ((X1 - X0) * i) / 120);
			lo = Math.min(lo, v);
			hi = Math.max(hi, v);
		}
		return niceRange(lo, hi);
	});
	const lo = tween(-10);
	const hi = tween(10);
	let first = true;
	$effect(() => {
		const [a, b] = slopeRange;
		untrack(() => {
			const o = { duration: reduced || first ? 0 : 600 };
			first = false;
			lo.set(a, o);
			hi.set(b, o);
		});
	});
	const syL = $derived(scale([lo.current, hi.current], [boxes.lower.bottom, boxes.lower.top]));

	const curvePath = $derived(fnPath(curve.f, sy));
	// On the graph step the slope curve draws itself in from the left.
	const reveal = $derived(phase === 'graph' && !reduced ? smoothstep(0.2, 2, t) : 1);
	const slopePath = $derived(fnPath(curve.df, syL, X0, X0 + (X1 - X0) * reveal));

	// ---- the point, the chord and the tangent ------------------------------------------
	const fx = $derived(curve.f(x));
	const dfx = $derived(curve.df(x));
	const P = $derived({ x: sx(x), y: sy(fx) });

	const h = $derived(phase === 'secant' ? Math.max(0.01, Number(params.h) || 1) : 1);
	// Past the right edge the chord goes to a point on the left instead.
	const back = $derived(x + h > X1 + 1e-9);
	const x2 = $derived(back ? x - h : x + h);
	const chord = $derived.by(() => {
		const s = back ? chordSlope(curve.f, x, -h) : chordSlope(curve.f, x, h);
		const y2 = curve.f(x2);
		const line = (xx: number) => fx + s * (xx - x);
		return {
			slope: s,
			rise: back ? fx - y2 : y2 - fx,
			Q: { x: sx(x2), y: sy(y2) },
			corner: { x: sx(x2), y: P.y },
			line: `M${LEFT} ${sy(line(X0)).toFixed(1)} L${RIGHT} ${sy(line(X1)).toFixed(1)}`
		};
	});
	// The tangent: a segment 150 px long each way along the curve's direction on screen.
	const tangent = $derived.by(() => {
		const ux = sx(X0 + 1) - sx(X0);
		const uy = sy(dfx) - sy(0);
		const len = Math.hypot(ux, uy);
		const k = 150 / len;
		return `M${P.x - ux * k} ${P.y - uy * k} L${P.x + ux * k} ${P.y + uy * k}`;
	});

	// ---- labels -----------------------------------------------------------------------------
	const xUnit = $derived(isBall ? ' s' : '');
	const yUnit = $derived(isBall ? ' m' : '');
	const slopeUnit = $derived(isBall ? ' m/s' : '');
	const xName = $derived(curve.xName);
	const yName = $derived(isBall ? 'h' : 'f(x)');
	const runLabel = $derived(`run ${phase === 'secant' ? 'h ' : ''}= ${num(h)}`);
	const riseLabel = $derived(`rise = ${num(chord.rise)}`);
	const runPx = $derived(Math.abs(chord.corner.x - P.x));
	const risePx = $derived(Math.abs(chord.Q.y - chord.corner.y));
	// Below the run line when the chord climbs away from it, above when it falls.
	const runBelow = $derived(chord.Q.y <= P.y);
	const slopeDot = $derived({ x: sx(x), y: syL(dfx) });
	const slopeLabelRight = $derived(slopeDot.x < RIGHT - 130);
	const knotHint = $derived(phase === 'edit' ? smoothstep(0.3, 1, reduced ? 1 : t) : 0);
</script>

<g>
	<defs>
		<clipPath id="calc-slope-upper">
			<rect
				x={LEFT}
				y={boxes.upper.top}
				width={RIGHT - LEFT}
				height={boxes.upper.bottom - boxes.upper.top}
			/>
		</clipPath>
		<clipPath id="calc-slope-lower">
			<rect
				x={LEFT}
				y={boxes.lower.top}
				width={RIGHT - LEFT}
				height={boxes.lower.bottom - boxes.lower.top}
			/>
		</clipPath>
	</defs>

	<!-- ============ the curve ============ -->
	<Txt x={LEFT + 24} y={30} text={curve.formula} size={15} weight={600} color="var(--calc-curve)" />
	<Frame
		{sx}
		{sy}
		yName={isBall ? 'h (m)' : 'y'}
		xName={wSplit.current < 0.5 ? (isBall ? 't (s)' : 'x') : undefined}
	/>
	<g clip-path="url(#calc-slope-upper)">
		<path
			d={curvePath}
			fill="none"
			stroke="var(--calc-curve)"
			stroke-width="3"
			stroke-linecap="round"
		/>

		<!-- chord with its run and rise -->
		{#if wChord.current > 0.01}
			<g opacity={wChord.current}>
				<path d={chord.line} stroke="var(--stage-ink)" stroke-width="1.6" opacity="0.75" />
				<line
					x1={P.x}
					y1={P.y}
					x2={chord.corner.x}
					y2={chord.corner.y}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="4 4"
				/>
				<line
					x1={chord.corner.x}
					y1={chord.corner.y}
					x2={chord.Q.x}
					y2={chord.Q.y}
					stroke="var(--explainer-accent)"
					stroke-width="3"
					stroke-linecap="round"
				/>
				<circle cx={chord.Q.x} cy={chord.Q.y} r="5" fill="var(--stage-ink)" />
			</g>
		{/if}

		<!-- tangent -->
		{#if wTangent.current > 0.01}
			<path
				d={tangent}
				stroke="var(--calc-slope)"
				stroke-width="2.6"
				stroke-linecap="round"
				opacity={wTangent.current}
			/>
		{/if}
	</g>

	<!-- run and rise labels (outside the clip so they are never cut) -->
	{#if wChord.current > 0.01}
		<g opacity={wChord.current}>
			{#if runPx > 70}
				<Txt
					x={(P.x + chord.corner.x) / 2}
					y={P.y + (runBelow ? 22 : -12)}
					text={runLabel}
					anchor="middle"
					size={13}
				/>
			{/if}
			{#if risePx > 22}
				<Txt
					x={chord.corner.x + (back ? -10 : 10)}
					y={(chord.corner.y + chord.Q.y) / 2 + 5}
					text={riseLabel}
					anchor={back ? 'end' : 'start'}
					size={13}
					weight={600}
					color="var(--explainer-accent)"
				/>
			{/if}
		</g>
	{/if}

	<!-- ============ the slope curve ============ -->
	{#if wSplit.current > 0.01}
		<g opacity={smoothstep(0.4, 1, wSplit.current)}>
			<Frame
				{sx}
				sy={syL}
				yName={isBall ? 'slope = velocity (m/s)' : 'slope f′(x)'}
				yColor="var(--calc-slope)"
				xName={isBall ? 't (s)' : 'x'}
			/>
			<g clip-path="url(#calc-slope-lower)">
				<path
					d={slopePath}
					fill="none"
					stroke="var(--calc-slope)"
					stroke-width="3"
					stroke-linecap="round"
				/>
			</g>
			<line
				x1={P.x}
				x2={P.x}
				y1={P.y + 10}
				y2={slopeDot.y - 8}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
				opacity="0.6"
			/>
			{#if reveal > 0.99}
				<circle
					cx={slopeDot.x}
					cy={slopeDot.y}
					r="6"
					fill="var(--calc-slope)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
				<Txt
					x={slopeDot.x + (slopeLabelRight ? 14 : -14)}
					y={slopeDot.y - 12}
					text="slope {num(dfx)}{slopeUnit}"
					anchor={slopeLabelRight ? 'start' : 'end'}
					size={13}
					weight={600}
					color="var(--calc-slope)"
					pill
				/>
			{/if}
		</g>
	{/if}

	<!-- ============ handles ============ -->
	{#if wKnots.current > 0.01 && !step.hints?.curve}
		<KnotHandles {curve} {sy} opacity={wKnots.current} {setParam} />
	{/if}
	<PointHandle
		{x}
		y={P.y}
		label="Point on the curve"
		unit={isBall ? 'seconds' : ''}
		{t}
		{reduced}
		{setParam}
	/>

	<!-- ============ readout panel ============ -->
	<g>
		<Txt x={PANEL} y={84} text="{xName} = {num(x)}{xUnit}" size={15} weight={600} />
		<Txt x={PANEL} y={108} text="{yName} = {num(fx)}{yUnit}" size={15} muted />
		{#if wChord.current > 0.01}
			<g opacity={smoothstep(0.5, 1, wChord.current)}>
				<Txt x={PANEL} y={150} text={runLabel} size={14} />
				<Txt
					x={PANEL}
					y={174}
					text={riseLabel}
					size={14}
					color="var(--explainer-accent)"
					weight={600}
				/>
				<Txt x={PANEL} y={214} text="slope of the chord" size={12} muted />
				<Txt x={PANEL} y={244} text="rise ÷ run = {num(chord.slope)}" size={20} weight={600} />
				{#if phase === 'secant'}
					<Txt
						x={PANEL}
						y={278}
						text={back ? 'chord to a point on the left' : `from x = ${num(x)} to ${num(x2)}`}
						size={12}
						muted
					/>
				{/if}
			</g>
		{/if}
		{#if wTangent.current > 0.01}
			<g opacity={smoothstep(0.5, 1, wTangent.current)}>
				<Txt x={PANEL} y={150} text="slope of the tangent" size={12} muted />
				<Txt
					x={PANEL}
					y={180}
					text="f′({xName}) = {num(dfx)}{slopeUnit}"
					size={22}
					weight={600}
					color="var(--calc-slope)"
				/>
				<Txt
					x={PANEL}
					y={208}
					text={Math.abs(dfx) < 0.005
						? 'flat: neither up nor down'
						: dfx > 0
							? 'going up'
							: 'going down'}
					size={12}
					muted
				/>
			</g>
		{/if}
		{#if knotHint > 0.01}
			<g opacity={knotHint}>
				<Txt
					x={PANEL}
					y={250}
					text="Drag the hollow knots"
					size={13}
					weight={600}
					color="var(--calc-curve)"
				/>
				<Txt x={PANEL} y={270} text="up and down to reshape" size={13} muted />
				<Txt x={PANEL} y={290} text="the curve." size={13} muted />
			</g>
		{/if}
	</g>
</g>
