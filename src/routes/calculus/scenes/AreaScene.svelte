<script lang="ts">
	/**
	 * The area under the curve, filled with rectangles, and the rectangle
	 * totals closing in on the exact integral.
	 *
	 * Phases (`step.hints.phase`):
	 *   rects    — n rectangles (`params.n`) with left-edge heights; they rise from the
	 *              axis one after another at the start of the step
	 *   converge — the same, with the rule from `params.rule`, and a second plot of the
	 *              total against n (doubling steps) with the exact area as a line
	 *   integral — no rectangles: the exact area, above the axis and below it in two
	 *              colours, and the signed total
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { X0, X1, integral, rectangles, riemann, type Rule } from '../calculus';
	import Frame from './Frame.svelte';
	import KnotHandles from './KnotHandles.svelte';
	import {
		F_RANGE,
		LEFT,
		PANEL,
		RIGHT,
		fnPath,
		layout,
		niceRange,
		num,
		signedAreaPaths,
		stepCurve,
		sx
	} from './plot';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'rects'));
	const curve = $derived(stepCurve(step, params));
	const isBall = $derived(curve.id === 'ball');
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);
	const n = $derived(Math.max(1, Math.min(100, Math.round(Number(params.n) || 4))));
	const rule = $derived<Rule>(
		has('rule') && ['left', 'mid', 'right'].includes(String(params.rule))
			? (String(params.rule) as Rule)
			: 'left'
	);

	// ---- phase cross-fades -----------------------------------------------------------
	const tween = (v: number) => new Tween(v, { duration: 700, easing: cubicInOut });
	const wRects = tween(0);
	const wSplit = tween(0);
	const wExact = tween(0);
	const wKnots = tween(0);
	$effect(() => {
		const p = phase;
		const knots = curve.id === 'custom';
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			wRects.set(p === 'integral' ? 0 : 1, o);
			wSplit.set(p === 'converge' ? 1 : 0, o);
			wExact.set(p === 'integral' ? 1 : 0, o);
			wKnots.set(knots ? 1 : 0, o);
		});
	});

	const boxes = $derived(layout(wSplit.current));
	const sy = $derived(scale(F_RANGE, [boxes.upper.bottom, boxes.upper.top]));
	const curvePath = $derived(fnPath(curve.f, sy));
	const exact = $derived(integral(curve.f, X0, X1));
	const areas = $derived(signedAreaPaths(curve.f, sy, X0, X1));
	const above = $derived(integral((v) => Math.max(0, curve.f(v)), X0, X1, 2000));
	const below = $derived(exact - above);

	// ---- the rectangles ------------------------------------------------------------------
	const rects = $derived(rectangles(curve.f, X0, X1, n, rule));
	const total = $derived(riemann(curve.f, X0, X1, n, rule));
	// On the first step they rise from the axis one after another.
	const grow = (i: number) => {
		if (phase !== 'rects' || reduced) return 1;
		const start = 0.2 + (1.2 * i) / n;
		return smoothstep(start, start + 0.45, t);
	};
	const rectPaths = $derived.by(() => {
		const y0 = sy(0);
		let pos = '';
		let neg = '';
		rects.forEach((r, i) => {
			const top = sy(r.height * grow(i));
			const d = `M${sx(r.x).toFixed(1)} ${y0.toFixed(1)}V${top.toFixed(1)}H${sx(r.x + r.width).toFixed(1)}V${y0.toFixed(1)}Z`;
			if (r.height >= 0) pos += d;
			else neg += d;
		});
		return { pos, neg };
	});
	const offset = $derived(rule === 'left' ? 0 : rule === 'mid' ? 0.5 : 1);
	const ruleText = $derived(
		rule === 'left'
			? 'heights at left edges'
			: rule === 'mid'
				? 'heights at midpoints'
				: 'heights at right edges'
	);

	// ---- the totals against n (doubling steps on the axis) ---------------------------------
	const NMAX = 100;
	const sums = $derived(
		Array.from({ length: NMAX }, (_, i) => riemann(curve.f, X0, X1, i + 1, rule))
	);
	const sxN = scale([0, Math.log2(NMAX)], [LEFT, RIGHT]);
	const nTicks = [0, 1, 2, 3, 4, 5, 6, Math.log2(NMAX)];
	const sumRange = $derived(niceRange(Math.min(exact, ...sums), Math.max(exact, ...sums)));
	const lo = tween(0);
	const hi = tween(10);
	let first = true;
	$effect(() => {
		const [a, b] = sumRange;
		untrack(() => {
			const o = { duration: reduced || first ? 0 : 600 };
			first = false;
			lo.set(a, o);
			hi.set(b, o);
		});
	});
	const syN = $derived(scale([lo.current, hi.current], [boxes.lower.bottom, boxes.lower.top]));
	const sumPath = $derived(
		sums
			.map((s, i) => `${i ? 'L' : 'M'}${sxN(Math.log2(i + 1)).toFixed(1)} ${syN(s).toFixed(1)}`)
			.join('')
	);
	const nDot = $derived({ x: sxN(Math.log2(n)), y: syN(total) });
	const error = $derived(total - exact);
	// How much one doubling of n shrinks the error (blank when the error is already ~0).
	const shrink = $derived.by(() => {
		const next = riemann(curve.f, X0, X1, 2 * n, rule) - exact;
		return Math.abs(next) < 1e-9 || Math.abs(error) < 1e-9 ? null : Math.abs(error / next);
	});
	const nLabelRight = $derived(nDot.x < RIGHT - 150);
	// Below the dot when the totals come up from below, above it otherwise (and never
	// on the axis labels or above the plot).
	const nLabelY = $derived.by(() => {
		const below = nDot.y + 22;
		const above = nDot.y - 12;
		if (total <= exact) return below < boxes.lower.bottom - 6 ? below : above;
		return above > boxes.lower.top + 14 ? above : below;
	});
	// The exact-area label goes on the side of the line away from the totals' curve.
	const exactLabelY = $derived.by(() => {
		const y = syN(exact);
		const fromBelow = sums[NMAX - 1] <= exact;
		if (fromBelow && y - boxes.lower.top > 14) return y - 7;
		if (!fromBelow && boxes.lower.bottom - y > 20) return y + 17;
		return fromBelow ? y + 17 : y - 7;
	});
</script>

<g>
	<defs>
		<clipPath id="calc-area-upper">
			<rect
				x={LEFT}
				y={boxes.upper.top}
				width={RIGHT - LEFT}
				height={boxes.upper.bottom - boxes.upper.top}
			/>
		</clipPath>
	</defs>

	<!-- <Readout>: on narrow screens these are hidden or listed as HTML under the stage -->
	<Readout id="formula" order={1} label="Curve" value={curve.formula} color="var(--calc-curve)">
		<Label
			anchor="start"
			x={LEFT + 44}
			y={28}
			text={curve.formula}
			size={15}
			weight={600}
			color="var(--calc-curve)"
		/>
	</Readout>
	<Frame
		{sx}
		{sy}
		yName={isBall ? 'h (m)' : 'y'}
		xName={wSplit.current < 0.5 ? (isBall ? 't (s)' : 'x') : undefined}
	/>

	<g clip-path="url(#calc-area-upper)">
		<!-- the exact area: faint under the rectangles (the slivers show), full on its own -->
		<g opacity={0.1 + 0.25 * wExact.current}>
			<path d={areas.above} fill="var(--calc-area)" />
			<path d={areas.below} fill="var(--calc-neg)" />
		</g>
		{#if wRects.current > 0.01}
			<g opacity={wRects.current}>
				<path
					d={rectPaths.pos}
					fill="var(--calc-area)"
					fill-opacity="0.3"
					stroke="var(--calc-area)"
					stroke-opacity={n > 40 ? 0.35 : 0.8}
					stroke-width="1"
				/>
				<path
					d={rectPaths.neg}
					fill="var(--calc-neg)"
					fill-opacity="0.3"
					stroke="var(--calc-neg)"
					stroke-opacity={n > 40 ? 0.35 : 0.8}
					stroke-width="1"
				/>
				{#if n <= 16}
					{#each rects as r, i (i)}
						<circle
							cx={sx(r.x + offset * r.width)}
							cy={sy(r.height)}
							r="3.5"
							fill="var(--stage-ink)"
							opacity={grow(i)}
						/>
					{/each}
				{/if}
			</g>
		{/if}
		<path
			d={curvePath}
			fill="none"
			stroke="var(--calc-curve)"
			stroke-width="3"
			stroke-linecap="round"
		/>
	</g>

	<!-- ============ totals against n ============ -->
	{#if wSplit.current > 0.01}
		<g opacity={smoothstep(0.4, 1, wSplit.current)}>
			<Frame
				sx={sxN}
				sy={syN}
				yName="total of the rectangles"
				yColor="var(--calc-area)"
				xName="number of rectangles n"
				xTicks={nTicks}
				xFormat={(v) => String(Math.round(2 ** v))}
			/>
			<line
				x1={LEFT}
				x2={RIGHT}
				y1={syN(exact)}
				y2={syN(exact)}
				stroke="var(--stage-ink)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
			/>
			<Readout id="exact-label">
				<Label
					x={RIGHT - 4}
					y={exactLabelY}
					text="exact area {num(exact)}"
					anchor="end"
					size={12}
					weight={600}
				/>
			</Readout>
			<path
				d={sumPath}
				fill="none"
				stroke="var(--calc-area)"
				stroke-width="2.5"
				stroke-linejoin="round"
			/>
			<circle
				cx={nDot.x}
				cy={nDot.y}
				r="6"
				fill="var(--calc-area)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Readout id="n-pill">
				<Label
					x={nDot.x + (nLabelRight ? 14 : -14)}
					y={nLabelY}
					text="n = {n}: {num(total)}"
					anchor={nLabelRight ? 'start' : 'end'}
					size={13}
					weight={600}
					pill
				/>
			</Readout>
		</g>
	{/if}

	{#if wKnots.current > 0.01}
		<KnotHandles {curve} {sy} opacity={wKnots.current} {setParam} />
	{/if}

	<!-- ============ readout panel ============ -->
	{#if wRects.current > 0.01}
		{@const fr = smoothstep(0.5, 1, wRects.current)}
		{@const errText =
			Math.abs(error) < 0.005
				? 'error = 0.00'
				: `${num(Math.abs(error))} too ${error < 0 ? 'little' : 'much'}`}
		<g opacity={fr}>
			<Readout
				id="n"
				order={2}
				label="Rectangles"
				value="n = {n}"
				note="each {num((X1 - X0) / n, 3)} wide, {ruleText}"
				opacity={fr}
			>
				<Label
					anchor="start"
					x={PANEL}
					y={84}
					text="n = {n} rectangle{n === 1 ? '' : 's'}"
					size={15}
					weight={600}
				/>
				<Label
					anchor="start"
					x={PANEL}
					y={108}
					text="each {num((X1 - X0) / n, 3)} wide"
					size={13}
					muted
				/>
				<Label anchor="start" x={PANEL} y={128} text={ruleText} size={13} muted />
			</Readout>
			<Readout
				id="total"
				order={3}
				label="Total of the rectangles"
				value={num(total)}
				color="var(--calc-area)"
				opacity={fr}
			>
				<Label anchor="start" x={PANEL} y={168} text="total of the rectangles" size={12} muted />
				<Label
					anchor="start"
					x={PANEL}
					y={198}
					text={num(total)}
					size={26}
					weight={700}
					color="var(--calc-area)"
				/>
			</Readout>
			{#if phase === 'converge'}
				<Readout
					id="exact"
					order={4}
					label="Exact area"
					value={num(exact)}
					note={shrink !== null ? `${errText}; double n: error ÷ ${num(shrink, 1)}` : errText}
					opacity={fr}
				>
					<Label anchor="start" x={PANEL} y={240} text="exact area = {num(exact)}" size={14} />
					<Label anchor="start" x={PANEL} y={264} text={errText} size={14} weight={600} />
					{#if shrink !== null}
						<Label
							anchor="start"
							x={PANEL}
							y={288}
							text="double n: error ÷ {num(shrink, 1)}"
							size={13}
							muted
						/>
					{/if}
				</Readout>
			{/if}
		</g>
	{/if}
	{#if wExact.current > 0.01}
		{@const fe = smoothstep(0.5, 1, wExact.current)}
		<g opacity={fe}>
			<Readout
				id="above"
				order={2}
				label="Area above the axis"
				value="+{num(above)}"
				color="var(--calc-area)"
				opacity={fe}
			>
				<Label anchor="start" x={PANEL} y={84} text="area above the axis" size={12} muted />
				<Label
					anchor="start"
					x={PANEL}
					y={106}
					text="+{num(above)}"
					size={17}
					weight={600}
					color="var(--calc-area)"
				/>
			</Readout>
			<Readout
				id="below"
				order={3}
				label="Area below the axis"
				value={Math.abs(below) < 0.005 ? '0.00' : num(below)}
				color="var(--calc-neg)"
				opacity={fe}
			>
				<Label anchor="start" x={PANEL} y={136} text="area below the axis" size={12} muted />
				<Label
					anchor="start"
					x={PANEL}
					y={158}
					text={Math.abs(below) < 0.005 ? '0.00' : num(below)}
					size={17}
					weight={600}
					color="var(--calc-neg)"
				/>
			</Readout>
			<Readout
				id="integral"
				order={4}
				label="Integral = signed total"
				value="∫₀³ f(x) dx = {num(exact)}"
				opacity={fe}
			>
				<Label anchor="start" x={PANEL} y={200} text="integral = signed total" size={12} muted />
				<Label
					anchor="start"
					x={PANEL}
					y={232}
					text="∫₀³ f(x) dx = {num(exact)}"
					size={20}
					weight={700}
				/>
			</Readout>
		</g>
	{/if}
</g>
