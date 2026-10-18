<script lang="ts">
	/**
	 * A function, its Taylor polynomial of degree n, and (from the `disk` step
	 * on) the complex plane underneath on the same x scale, with the disk of
	 * convergence and the singularities that stop it.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   copy      — eˣ and P_n about 0; the panel compares them at x = 2
	 *   bound     — sin x or eˣ; the error at a draggable point against the
	 *               degree, with Taylor's bound dashed
	 *   wall      — 1/(1 + x²) or log(1 + x): the band |x − a| < R where the
	 *               polynomials fit; the same error chart
	 *   disk      — the complex plane: the disk grows from the centre until it
	 *               touches the nearest singularity (a function of t, complete
	 *               under reduced motion); the root test on the coefficients
	 *   recentre  — the same, with the centre a draggable along the real axis
	 *   chebyshev — 1/(1 + x²) with the Chebyshev interpolant of the same degree,
	 *               its nodes, and Bernstein's ellipse through ±i in the plane
	 *
	 * The function is `hints.fn` when the step fixes it, else the step's select
	 * (`fnEntire` or `fn`). The degree is `params.n`; the error point is
	 * `params.probe` or `params.probeOut` (whichever the step offers); the
	 * centre is `params.a` on the step that offers it and 0 elsewhere.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Handle,
		Label,
		clamp,
		niceMax,
		scale,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		chebyshev,
		fnFor,
		maxError,
		radius,
		radiusFromCoefficients,
		remainderBound,
		taylor
	} from '../taylor';
	import {
		LEFT,
		NAMES,
		PANEL,
		PLANE,
		PLANE_Y0,
		RIGHT,
		U,
		X0,
		X1,
		Y_RANGE,
		fixed,
		fnPath,
		num,
		plotBox,
		pow10,
		sub,
		sx
	} from './plot';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'copy'));
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);

	// ---- what is shown -------------------------------------------------------------
	const fnId = $derived(
		step.hints?.fn ?? (has('fnEntire') ? params.fnEntire : has('fn') ? params.fn : 'runge')
	);
	const fn = $derived(fnFor(fnId));
	const n = $derived(clamp(Math.round(Number(params.n ?? 6)), 0, 30));
	const a = $derived(
		has('a') ? clamp(Number(params.a ?? 0), fn.centre[0], fn.centre[1]) : Math.max(0, fn.centre[0])
	);
	const probeId = $derived(has('probe') ? 'probe' : has('probeOut') ? 'probeOut' : null);
	const probe = $derived(probeId ? clamp(Number(params[probeId] ?? 1.5), X0, X1) : null);
	const showCheb = $derived(phase === 'chebyshev' && params.cheb !== false);

	const R = $derived(radius(fn, a));
	/** On the disk step the disk grows out from the centre (complete at t = 1.8 s). */
	const grow = $derived(phase === 'disk' ? smoothstep(0.3, 1.8, reduced ? 2.5 : t) : 1);
	const P = $derived(taylor(fn, a, n));

	// ---- cross-fades -----------------------------------------------------------------
	const tween = () => new Tween(0, { duration: 700, easing: cubicInOut });
	const wSplit = tween();
	const wBand = tween();
	const wErr = tween();
	const wCoef = tween();
	const wCheb = tween();
	const wChebPanel = tween();
	const wCopy = tween();
	$effect(() => {
		const p = phase;
		const cheb = showCheb;
		untrack(() => {
			const o = { duration: reduced ? 0 : 700 };
			const plane = p === 'disk' || p === 'recentre' || p === 'chebyshev';
			wSplit.set(plane ? 1 : 0, o);
			wBand.set(p === 'wall' || plane ? 1 : 0, o);
			wErr.set(p === 'bound' || p === 'wall' ? 1 : 0, o);
			wCoef.set(p === 'disk' || p === 'recentre' ? 1 : 0, o);
			wCheb.set(cheb ? 1 : 0, o);
			wChebPanel.set(p === 'chebyshev' ? 1 : 0, o);
			wCopy.set(p === 'copy' ? 1 : 0, o);
		});
	});
	// Panel blocks share the same lines: the old one is gone halfway through the tween.
	const panel = (v: number) => smoothstep(0.5, 1, v);

	// ---- the plot of the curve ---------------------------------------------------------
	const box = $derived(plotBox(wSplit.current));
	const sy = $derived(scale(Y_RANGE[fn.id], [box.bottom, box.top]));
	const fPath = $derived(fnPath(fn.f, sy));
	const pPath = $derived(fnPath(P, sy));
	const cheby = $derived(phase === 'chebyshev' ? chebyshev(fn.f, X0, X1, n) : null);
	const cPath = $derived(cheby ? fnPath(cheby.at, sy) : '');
	const inPlot = (y: number) => Number.isFinite(y) && y >= sy.domain[0] && y <= sy.domain[1];

	/**
	 * The band of the real line where the series converges, clipped to the plot;
	 * on the disk step it grows with the disk.
	 */
	const Rb = $derived(R * grow);
	const band = $derived({
		x0: Number.isFinite(R) ? Math.max(LEFT, sx(a - Rb)) : LEFT,
		x1: Number.isFinite(R) ? Math.min(RIGHT, sx(a + Rb)) : RIGHT
	});
	const bandEdges = $derived(
		Number.isFinite(R) ? [a - Rb, a + Rb].filter((v) => v > X0 && v < X1) : []
	);

	// ---- the probe and the error chart ---------------------------------------------------
	const round05 = (v: number) => Math.round(clamp(v, X0, X1) * 20) / 20;
	const errAt = (k: number, x: number) => Math.abs(taylor(fn, a, k)(x) - fn.f(x));
	const DEG = Array.from({ length: 31 }, (_, k) => k);
	const LOG_FLOOR = -14;
	const LOG_CEIL = 10;
	const lg = (v: number) => clamp(v > 0 ? Math.log10(v) : LOG_FLOOR, LOG_FLOOR, LOG_CEIL);
	const errs = $derived(probe === null ? [] : DEG.map((k) => errAt(k, probe)));
	const bounds = $derived(
		probe === null || phase !== 'bound' ? [] : DEG.map((k) => remainderBound(fn, a, probe, k))
	);
	const CH = { left: 734, right: 930, top: 250, bottom: 508 };
	const ex = scale([0, 30], [CH.left, CH.right]);
	const ey = scale([LOG_FLOOR, LOG_CEIL], [CH.bottom, CH.top]);
	const linePts = (vals: number[]) =>
		vals.map((v, k) => `${k ? 'L' : 'M'}${ex(k).toFixed(1)} ${ey(lg(v)).toFixed(1)}`).join('');

	// ---- the coefficients: |c_k|^(1/k) tends to 1/R --------------------------------------
	const KMAX = 60;
	const coefPts = $derived.by(() => {
		const c = fn.coefficients(a, KMAX);
		const out: { k: number; v: number }[] = [];
		for (let k = 1; k < KMAX; k++) {
			// Skip coefficients that are 0 up to rounding (the odd ones of 1/(1 + x²) about 0,
			// the even ones of sin about 0): far smaller than both neighbours.
			const side = Math.max(Math.abs(c[k - 1]), Math.abs(c[k + 1]));
			if (Math.abs(c[k]) > side * 1e-9) out.push({ k, v: Math.pow(Math.abs(c[k]), 1 / k) });
		}
		return out;
	});
	const coefMax = $derived(
		niceMax(Math.max(Number.isFinite(R) ? 1.15 / R : 0, ...coefPts.map((p) => p.v)))
	);
	const kx = scale([0, KMAX], [CH.left, CH.right]);
	const ky = $derived(scale([0, coefMax], [CH.bottom, CH.top]));
	const rootR = $derived(Number.isFinite(R) ? radiusFromCoefficients(fn, a) : Infinity);

	// ---- Chebyshev against Taylor: worst error on [−4, 4] ---------------------------------
	// Only 1/(1 + x²) about 0 (the Chebyshev step fixes both), so computed once.
	const worst = (() => {
		const f = fnFor('runge');
		return DEG.map((k) => ({
			taylor: maxError(f.f, taylor(f, 0, k), X0, X1, 400),
			cheb: maxError(f.f, chebyshev(f.f, X0, X1, k).at, X0, X1, 400)
		}));
	})();
	const WY = scale([-4, 20], [CH.bottom, CH.top]);
	const wlg = (v: number) => clamp(Math.log10(Math.max(v, 1e-4)), -4, 20);
	const worstLine = (pick: (w: (typeof worst)[number]) => number) =>
		worst
			.map((w, k) => `${k ? 'L' : 'M'}${ex(k).toFixed(1)} ${WY(wlg(pick(w))).toFixed(1)}`)
			.join('');
	const taylorWorstPath = worstLine((w) => w.taylor);
	const chebWorstPath = worstLine((w) => w.cheb);

	// ---- the complex plane ------------------------------------------------------------------
	const Y0 = PLANE_Y0;
	const diskR = $derived(Number.isFinite(R) ? R * U * grow : 0);
	const nearest = $derived.by(() => {
		let best: { re: number; im: number } | null = null;
		for (const s of fn.singularities)
			if (!best || Math.hypot(s.re - a, s.im) < Math.hypot(best.re - a, best.im)) best = s;
		return best;
	});
	const near = $derived(nearest ? { x: sx(nearest.re), y: Y0 - nearest.im * U } : null);
	const singName = $derived(fn.id === 'runge' ? '±i' : '−1');
	/** Bernstein's ellipse through ±i with foci at ±4: semi-axes √17 and 1. */
	const ELLIPSE = { rx: Math.sqrt(17) * U, ry: U };

	function moveA(v: number) {
		setParam('a', Math.round(clamp(v, fn.centre[0], fn.centre[1]) * 20) / 20);
	}

	// ---- panel text -------------------------------------------------------------------------
	const aText = $derived(fixed(a, 2));
	const polyText = $derived(`P${sub(n)}: degree ${n} about a = ${aText}`);
	const fitText = $derived(
		Number.isFinite(R) ? `${fixed(a - R)} < x < ${fixed(a + R)}` : 'the whole real line'
	);
	const pAt = $derived(probe === null ? NaN : P(probe));
	const fAt = $derived(probe === null ? NaN : fn.f(probe));
	const errNow = $derived(errs[n] ?? NaN);
	const boundNow = $derived(bounds[n] ?? NaN);
	const pText = $derived(probe === null ? '' : fixed(probe));
	const worstNow = $derived(worst[n]);
</script>

<g>
	<defs>
		<clipPath id="taylor-plot-clip">
			<rect x={LEFT} y={box.top} width={RIGHT - LEFT} height={box.bottom - box.top} />
		</clipPath>
		<clipPath id="taylor-plane-clip">
			<rect x={LEFT} y={PLANE.top} width={RIGHT - LEFT} height={PLANE.bottom - PLANE.top} />
		</clipPath>
	</defs>

	<!-- ================================================================ the curve -->
	<g>
		<!-- where the series converges -->
		<g opacity={wBand.current}>
			<rect
				x={band.x0}
				y={box.top}
				width={Math.max(0, band.x1 - band.x0)}
				height={box.bottom - box.top}
				fill="var(--ts-disk)"
				opacity="0.12"
			/>
			{#each bandEdges as v, i (i)}
				<line
					x1={sx(v)}
					x2={sx(v)}
					y1={box.top}
					y2={box.bottom}
					stroke="var(--ts-disk)"
					stroke-width="1.2"
					stroke-dasharray="5 4"
				/>
			{/each}
		</g>
		<Axes
			{sx}
			{sy}
			xTicks={[-4, -3, -2, -1, 0, 1, 2, 3, 4]}
			xFormat={(v: number) => fixed(v, 0)}
			yFormat={(v: number) => fixed(v, Number.isInteger(v) ? 0 : 1)}
			xLabel={wSplit.current > 0.5 ? undefined : 'x'}
		/>
		<g clip-path="url(#taylor-plot-clip)">
			{#if sy.domain[0] < 0 && sy.domain[1] > 0}
				<line
					x1={LEFT}
					x2={RIGHT}
					y1={sy(0)}
					y2={sy(0)}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					opacity="0.6"
				/>
			{/if}
			<path d={fPath} fill="none" stroke="var(--ts-f)" stroke-width="2.5" />
			{#if wCheb.current > 0.01 && cheby}
				<g opacity={wCheb.current}>
					<path d={cPath} fill="none" stroke="var(--ts-cheb)" stroke-width="2.2" />
					{#each cheby.nodes as x, i (i)}
						<circle
							cx={sx(x)}
							cy={sy(cheby.values[i])}
							r="3.2"
							fill="var(--ts-cheb)"
							stroke="var(--stage-bg)"
						/>
					{/each}
				</g>
			{/if}
			<path
				d={pPath}
				fill="none"
				stroke="var(--ts-taylor)"
				stroke-width="2.5"
				opacity={phase === 'chebyshev' ? 0.75 : 1}
			/>
			{#if probe !== null}
				<line
					x1={sx(probe)}
					x2={sx(probe)}
					y1={box.top}
					y2={box.bottom}
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="3 4"
				/>
				{#if inPlot(fAt)}
					<circle cx={sx(probe)} cy={sy(fAt)} r="4.5" fill="var(--ts-f)" />
				{/if}
				{#if inPlot(pAt)}
					<circle
						cx={sx(probe)}
						cy={sy(pAt)}
						r="4.5"
						fill="var(--ts-taylor)"
						stroke="var(--stage-bg)"
					/>
				{/if}
			{/if}
		</g>
		<!-- the centre on the x axis -->
		<path
			d="M{sx(a)} {box.bottom - 1} l-6 -10 h12 z"
			fill="var(--ts-taylor)"
			stroke="var(--stage-bg)"
		/>
		{#if probe !== null && probeId}
			<Handle
				x={sx(probe)}
				y={box.bottom}
				label="Point where the error is measured"
				value={probe}
				min={X0}
				max={X1}
				valuetext="x = {pText}"
				color="var(--stage-ink)"
				r={7}
				onmove={(p: Point) => setParam(probeId, round05(sx.invert(p.x)))}
				onkey={(s) =>
					setParam(
						probeId,
						s === 'start' ? X0 : s === 'end' ? X1 : round05((probe ?? 0) + s * 0.05)
					)}
			/>
		{/if}
	</g>

	<!-- ================================================================ the complex plane -->
	{#if wSplit.current > 0.01}
		<g opacity={smoothstep(0.3, 1, wSplit.current)}>
			<rect
				x={LEFT}
				y={PLANE.top}
				width={RIGHT - LEFT}
				height={PLANE.bottom - PLANE.top}
				rx="6"
				fill="var(--ts-plane)"
				stroke="var(--border)"
			/>
			<g clip-path="url(#taylor-plane-clip)">
				{#each [-3, -2, -1, 1, 2, 3] as v (v)}
					<line x1={sx(v)} x2={sx(v)} y1={PLANE.top} y2={PLANE.bottom} stroke="var(--stage-grid)" />
				{/each}
				{#each [-1, 1] as v (v)}
					<line x1={LEFT} x2={RIGHT} y1={Y0 - v * U} y2={Y0 - v * U} stroke="var(--stage-grid)" />
				{/each}
				<!-- the disk of convergence -->
				{#if Number.isFinite(R)}
					<circle
						cx={sx(a)}
						cy={Y0}
						r={diskR}
						fill="var(--ts-disk-fill)"
						stroke="var(--ts-disk)"
						stroke-width="2"
					/>
				{:else}
					<rect
						x={LEFT}
						y={PLANE.top}
						width={RIGHT - LEFT}
						height={PLANE.bottom - PLANE.top}
						fill="var(--ts-disk)"
						opacity={0.14 * grow}
					/>
				{/if}
				{#if wChebPanel.current > 0.01}
					<ellipse
						cx={sx(0)}
						cy={Y0}
						rx={ELLIPSE.rx}
						ry={ELLIPSE.ry}
						fill="none"
						stroke="var(--ts-cheb)"
						stroke-width="2"
						stroke-dasharray="7 5"
						opacity={wChebPanel.current * (showCheb ? 1 : 0.4)}
					/>
				{/if}
				<line x1={LEFT} x2={RIGHT} y1={Y0} y2={Y0} stroke="var(--stage-line)" />
				<line x1={sx(0)} x2={sx(0)} y1={PLANE.top} y2={PLANE.bottom} stroke="var(--stage-line)" />
				{#if fn.id === 'log'}
					<!-- log(1 + z) has no single value round −1: the usual cut along the real axis -->
					<line
						x1={LEFT}
						x2={sx(-1)}
						y1={Y0}
						y2={Y0}
						stroke="var(--ts-sing)"
						stroke-width="2.5"
						stroke-dasharray="4 4"
					/>
				{/if}
				<!-- the radius, to the nearest singularity -->
				{#if near && grow > 0.98}
					<line
						x1={sx(a)}
						y1={Y0}
						x2={near.x}
						y2={near.y}
						stroke="var(--ts-disk)"
						stroke-width="1.6"
					/>
				{/if}
			</g>
			<!-- links from the disk to the band on the curve's plot -->
			{#each bandEdges as v, i (i)}
				<line
					x1={sx(v)}
					x2={sx(v)}
					y1={box.bottom + 24}
					y2={Y0}
					stroke="var(--ts-disk)"
					stroke-dasharray="3 4"
					opacity={0.7 * grow}
				/>
			{/each}
			{#each fn.singularities as s (s.im)}
				{@const x = sx(s.re)}
				{@const y = Y0 - s.im * U}
				<circle
					cx={x}
					cy={y}
					r="8"
					fill="var(--stage-bg)"
					stroke="var(--ts-sing)"
					stroke-width="2"
				/>
				<path
					d="M{x - 4} {y - 4} L{x + 4} {y + 4} M{x + 4} {y - 4} L{x - 4} {y + 4}"
					stroke="var(--ts-sing)"
					stroke-width="2"
				/>
			{/each}
			<Readout id="plane-labels">
				<Label
					x={LEFT + 10}
					y={PLANE.top + 18}
					text="complex plane, z = x + iy"
					anchor="start"
					size={12}
					weight={600}
					muted
				/>
				<Label x={RIGHT - 8} y={Y0 - 7} text="real axis" anchor="end" size={11} muted />
				<Label x={sx(0) - 14} y={Y0 - U + 4} text="i" anchor="end" size={12} italic muted />
				<Label x={sx(0) - 14} y={Y0 + U + 4} text="−i" anchor="end" size={12} italic muted />
				{#if fn.id === 'runge'}
					<Label
						x={sx(0) + 14}
						y={Y0 - U - 8}
						text="1 + z² = 0 at ±i"
						anchor="start"
						size={12}
						color="var(--ts-sing)"
						weight={600}
					/>
				{:else if fn.id === 'log'}
					<Label
						x={sx(-1) - 12}
						y={Y0 - 14}
						text="log(1 + z) → −∞ at −1"
						anchor="end"
						size={12}
						color="var(--ts-sing)"
						weight={600}
					/>
				{:else}
					<Label
						x={(LEFT + RIGHT) / 2 + 60}
						y={PLANE.bottom - 16}
						text="no singularities anywhere: the disk is the whole plane"
						size={12}
						color="var(--ts-disk)"
						weight={600}
						opacity={grow}
					/>
				{/if}
				{#if wChebPanel.current > 0.5}
					<Label
						x={RIGHT - 10}
						y={PLANE.bottom - 14}
						text="ellipse with foci ±4 through ±i"
						anchor="end"
						size={12}
						color="var(--ts-cheb)"
						weight={600}
						opacity={showCheb ? 1 : 0.5}
					/>
				{/if}
			</Readout>
			{#if near && grow > 0.98}
				<Readout id="plane-r">
					<Label
						x={(sx(a) + near.x) / 2 + (fn.id === 'log' ? 0 : 10)}
						y={(Y0 + near.y) / 2 + (fn.id === 'log' ? 34 : 4)}
						text="R = {fixed(R)}"
						anchor={fn.id === 'log' ? 'middle' : 'start'}
						size={13}
						weight={600}
						color="var(--ts-disk)"
						tabular
					/>
				</Readout>
			{/if}
			{#if phase === 'recentre'}
				<Handle
					x={sx(a)}
					y={Y0}
					label="Centre of the series"
					value={a}
					min={fn.centre[0]}
					max={fn.centre[1]}
					valuetext="a = {aText}"
					color="var(--ts-taylor)"
					onmove={(p: Point) => moveA(sx.invert(p.x))}
					onkey={(s) =>
						moveA(s === 'start' ? fn.centre[0] : s === 'end' ? fn.centre[1] : a + s * 0.05)}
				/>
			{:else}
				<circle
					cx={sx(a)}
					cy={Y0}
					r="5"
					fill="var(--ts-taylor)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			{/if}
		</g>
	{/if}

	<!-- ================================================================ the panel -->
	<g>
		<Readout id="fn" order={1} label="Function" value="f(x) = {NAMES[fn.id]}" color="var(--ts-f)">
			<line x1={PANEL} x2={PANEL + 22} y1={60} y2={60} stroke="var(--ts-f)" stroke-width="3" />
			<Label
				x={PANEL + 30}
				y={65}
				text="f(x) = {NAMES[fn.id]}"
				anchor="start"
				size={15}
				weight={600}
			/>
		</Readout>
		<Readout
			id="poly"
			order={2}
			label="Taylor polynomial"
			value={polyText}
			color="var(--ts-taylor)"
		>
			<line x1={PANEL} x2={PANEL + 22} y1={88} y2={88} stroke="var(--ts-taylor)" stroke-width="3" />
			<Label x={PANEL + 30} y={93} text={polyText} anchor="start" size={13} tabular />
		</Readout>

		{#if wCopy.current > 0.01}
			{@const pc = panel(wCopy.current)}
			<Readout
				id="copy"
				order={3}
				label="At x = 2"
				value="P{sub(n)}(2) = {num(P(2))}, e² = {num(Math.exp(2))}"
				opacity={pc}
			>
				<Label x={PANEL} y={128} text="at x = 2:" anchor="start" size={13} muted opacity={pc} />
				<Label
					x={PANEL}
					y={150}
					text="P{sub(n)}(2) = {num(P(2))}"
					anchor="start"
					size={14}
					color="var(--ts-taylor)"
					weight={600}
					tabular
					opacity={pc}
				/>
				<Label
					x={PANEL}
					y={172}
					text="e² = {num(Math.exp(2))}"
					anchor="start"
					size={14}
					weight={600}
					tabular
					opacity={pc}
				/>
				<Label
					x={PANEL}
					y={194}
					text="off by {num(Math.abs(P(2) - Math.exp(2)))}"
					anchor="start"
					size={13}
					muted
					tabular
					opacity={pc}
				/>
			</Readout>
		{/if}

		{#if wErr.current > 0.01 && probe !== null}
			{@const pe = panel(wErr.current)}
			<Readout
				id="probe"
				order={3}
				label="At x = {pText}"
				value="f = {num(fAt)}, P{sub(n)} = {num(pAt)}"
				opacity={pe}
			>
				<Label
					x={PANEL}
					y={128}
					text="at x = {pText}:"
					anchor="start"
					size={13}
					muted
					opacity={pe}
					tabular
				/>
				<Label
					x={PANEL}
					y={150}
					text="f = {num(fAt)}"
					anchor="start"
					size={14}
					weight={600}
					tabular
					opacity={pe}
				/>
				<Label
					x={PANEL}
					y={172}
					text="P{sub(n)} = {num(pAt)}"
					anchor="start"
					size={14}
					weight={600}
					color="var(--ts-taylor)"
					tabular
					opacity={pe}
				/>
			</Readout>
			<Readout
				id="err"
				order={4}
				label="Error"
				value={num(errNow) + (phase === 'bound' ? ` (bound ${num(boundNow)})` : '')}
				opacity={pe}
			>
				<Label
					x={PANEL}
					y={194}
					text="error {num(errNow)}"
					anchor="start"
					size={13}
					tabular
					opacity={pe}
				/>
				{#if phase === 'bound'}
					<Label
						x={PANEL}
						y={214}
						text="Taylor's bound {num(boundNow)}"
						anchor="start"
						size={13}
						muted
						tabular
						opacity={pe}
					/>
				{:else if Number.isFinite(R)}
					<Label
						x={PANEL}
						y={214}
						text="fits for {fitText}"
						anchor="start"
						size={13}
						color="var(--ts-disk)"
						tabular
						opacity={pe}
					/>
				{/if}
			</Readout>
			<g opacity={pe}>
				<Axes
					sx={ex}
					sy={ey}
					xTicks={[0, 10, 20, 30]}
					yTicks={[-12, -8, -4, 0, 4, 8]}
					yFormat={pow10}
					xLabel="degree n"
					yLabel="error at x = {pText}"
				/>
				{#if bounds.length}
					<path
						d={linePts(bounds)}
						fill="none"
						stroke="var(--ts-bound)"
						stroke-width="1.6"
						stroke-dasharray="5 4"
					/>
				{/if}
				<path d={linePts(errs)} fill="none" stroke="var(--ts-taylor)" stroke-width="2" />
				<circle
					cx={ex(n)}
					cy={ey(lg(errNow))}
					r="5"
					fill="var(--ts-taylor)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
				{#if bounds.length}
					<Readout id="bound-key">
						<Label
							x={CH.right}
							y={CH.top + 14}
							text="dashed: Taylor's bound"
							anchor="end"
							size={11}
							muted
						/>
					</Readout>
				{/if}
			</g>
		{/if}

		{#if wCoef.current > 0.01}
			{@const pk = panel(wCoef.current)}
			<Readout
				id="radius"
				order={3}
				label="Radius"
				value={Number.isFinite(R)
					? `R = ${fixed(R)}, the distance to ${singName}`
					: 'R = ∞ (no singularity)'}
				color="var(--ts-disk)"
				opacity={pk}
			>
				<Label
					x={PANEL}
					y={128}
					text={Number.isFinite(R)
						? `R = ${fixed(R)}: distance to ${singName}`
						: 'R = ∞: no singularity'}
					anchor="start"
					size={14}
					weight={600}
					color="var(--ts-disk)"
					tabular
					opacity={pk}
				/>
			</Readout>
			<Readout
				id="root"
				order={4}
				label="Root test, c₁₀₀ to c₂₀₀"
				value={Number.isFinite(rootR) ? `R ≈ ${fixed(rootR)}` : 'R → ∞'}
				opacity={pk}
			>
				<Label
					x={PANEL}
					y={150}
					text={Number.isFinite(rootR)
						? `root test, c₁₀₀…c₂₀₀: R ≈ ${fixed(rootR)}`
						: 'root test: |cₖ|^(1/k) → 0'}
					anchor="start"
					size={13}
					tabular
					opacity={pk}
				/>
			</Readout>
			<Readout id="fits" order={5} label="Fits for" value={fitText} opacity={pk}>
				<Label
					x={PANEL}
					y={172}
					text="fits for {fitText}"
					anchor="start"
					size={13}
					muted
					tabular
					opacity={pk}
				/>
			</Readout>
			<g opacity={pk}>
				<Axes sx={kx} sy={ky} xTicks={[0, 20, 40, 60]} xLabel="k" yLabel="|cₖ|^(1/k)" />
				{#if Number.isFinite(R)}
					<line
						x1={CH.left}
						x2={CH.right}
						y1={ky(1 / R)}
						y2={ky(1 / R)}
						stroke="var(--ts-disk)"
						stroke-width="1.6"
						stroke-dasharray="5 4"
					/>
					<Readout id="coef-key">
						<Label
							x={CH.right}
							y={ky(1 / R) - 7}
							text="1/R = {fixed(1 / R)}"
							anchor="end"
							size={12}
							color="var(--ts-disk)"
							weight={600}
						/>
					</Readout>
				{/if}
				{#each coefPts as p (p.k)}
					<circle cx={kx(p.k)} cy={ky(p.v)} r="2.6" fill="var(--ts-taylor)" />
				{/each}
			</g>
		{/if}

		{#if wChebPanel.current > 0.01}
			{@const pw = panel(wChebPanel.current)}
			<Readout
				id="cheb"
				order={3}
				label="Chebyshev interpolant"
				value="degree {n}, {n + 1} points"
				color="var(--ts-cheb)"
				opacity={pw * wCheb.current}
			>
				<line
					x1={PANEL}
					x2={PANEL + 22}
					y1={116}
					y2={116}
					stroke="var(--ts-cheb)"
					stroke-width="3"
					opacity={pw * wCheb.current}
				/>
				<Label
					x={PANEL + 30}
					y={121}
					text="Chebyshev, {n + 1} points"
					anchor="start"
					size={13}
					opacity={pw * wCheb.current}
				/>
			</Readout>
			<Readout
				id="worst"
				order={4}
				label="Worst error on [−4, 4]"
				value="Taylor {num(worstNow.taylor)}, Chebyshev {num(worstNow.cheb)}"
				opacity={pw}
			>
				<Label
					x={PANEL}
					y={156}
					text="worst error on [−4, 4]:"
					anchor="start"
					size={13}
					muted
					opacity={pw}
				/>
				<Label
					x={PANEL}
					y={178}
					text="Taylor {num(worstNow.taylor)}"
					anchor="start"
					size={14}
					weight={600}
					color="var(--ts-taylor)"
					tabular
					opacity={pw}
				/>
				<Label
					x={PANEL}
					y={200}
					text="Chebyshev {num(worstNow.cheb)}"
					anchor="start"
					size={14}
					weight={600}
					color="var(--ts-cheb)"
					tabular
					opacity={pw}
				/>
			</Readout>
			<g opacity={pw}>
				<Axes
					sx={ex}
					sy={WY}
					xTicks={[0, 10, 20, 30]}
					yTicks={[-4, 0, 4, 8, 12, 16, 20]}
					yFormat={pow10}
					xLabel="degree n"
					yLabel="worst error on [−4, 4]"
				/>
				<path d={taylorWorstPath} fill="none" stroke="var(--ts-taylor)" stroke-width="2" />
				<path d={chebWorstPath} fill="none" stroke="var(--ts-cheb)" stroke-width="2" />
				<circle
					cx={ex(n)}
					cy={WY(wlg(worstNow.taylor))}
					r="4.5"
					fill="var(--ts-taylor)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
				<circle
					cx={ex(n)}
					cy={WY(wlg(worstNow.cheb))}
					r="4.5"
					fill="var(--ts-cheb)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			</g>
		{/if}
	</g>
</g>
