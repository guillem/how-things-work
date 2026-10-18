<script lang="ts">
	/**
	 * The phase portrait of a linear system v′ = A·v, with the panel (A, the
	 * kind of fixed point, the eigenvalues, trace and determinant) and the
	 * trace–determinant chart marking the system.
	 *
	 * Phases (`step.hints.phase`):
	 *   plane — the portrait of A from the sliders a, b, c, d (`hints.m` suffixes the ids)
	 *   eigen — the same, with the real eigenvectors drawn as lines through the origin
	 *   kinds — A built from eigenvalues dragged on the complex plane (params l1, l2, w)
	 *   chart — the portrait beside a larger chart with its regions named
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, VectorHandle, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		classify,
		det,
		eigenvalues,
		eigenvector,
		fromEigenvalues,
		linearField,
		trace,
		type Mat
	} from '../phase';
	import {
		LINEAR_STARTS,
		PANEL,
		PLANE,
		eigenText,
		fixed,
		kindColor,
		matText,
		scales,
		type Rect
	} from './layout';
	import EigenPlane from './EigenPlane.svelte';
	import Portrait from './Portrait.svelte';
	import TraceDet from './TraceDet.svelte';

	let { step, t, params, setParam }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'plane'));
	const suffix = $derived(String(step.hints?.m ?? ''));
	const num = (id: string, fallback: number) => {
		const v = Number(params[id]);
		return Number.isFinite(v) ? v : fallback;
	};
	const l1 = $derived(num('l1', -0.5));
	const l2 = $derived(num('l2', -2));
	const w = $derived(num('w', 0));
	const A = $derived.by((): Mat => {
		if (phase === 'kinds') return fromEigenvalues(l1, w > 0 ? l1 : l2, w);
		const s = suffix;
		return [num('a' + s, 0), num('b' + s, 1), num('c' + s, -1), num('d' + s, -0.5)];
	});

	// A complex pair has one real part: keep λ₂'s slider on it, so that the pair
	// lands back on the double root when ω returns to 0.
	const pairOff = $derived(phase === 'kinds' && w > 0 && l2 !== l1);
	$effect(() => {
		if (pairOff) untrack(() => setParam('l2', l1));
	});

	const tau = $derived(trace(A));
	const delta = $derived(det(A));
	const eig = $derived(eigenvalues(A));
	const cls = $derived(classify(tau, delta));
	const color = $derived(kindColor(cls.kind));
	const field = $derived(linearField(A));

	const BOX = { x: [-3, 3] as [number, number], y: [-3, 3] as [number, number] };
	const sc = scales(PLANE, BOX);

	// ---- eigenvectors (real, distinct eigenvalues) ----------------------------------
	const showVecs = $derived(phase === 'eigen' || phase === 'kinds');
	const vecs = $derived.by(() => {
		if (!showVecs || eig.im[0] !== 0 || cls.kind === 'non-isolated') return [];
		if (Math.abs(eig.re[0] - eig.re[1]) < 1e-9) return [];
		return [0, 1].flatMap((k) => {
			const v = eigenvector(A, eig.re[k]);
			if (!v) return [];
			// a line through the origin across the window, labelled near its end
			const L = 4.5;
			const sxv = Math.abs(v[0]) > 1e-9 ? 2.95 / Math.abs(v[0]) : Infinity;
			const syv = Math.abs(v[1]) > 1e-9 ? 2.95 / Math.abs(v[1]) : Infinity;
			const s = Math.min(sxv, syv, L);
			const end = { x: sc.sx(v[0] * s), y: sc.sy(v[1] * s) };
			// label the end that sits higher on the stage (away from the axis titles)
			const sign = end.y < sc.sy(0) || (end.y === sc.sy(0) && end.x > sc.sx(0)) ? 1 : -1;
			// beside the line, not on it: 14 units along its normal, on the upper side
			const ex = end.x - sc.sx(0);
			const ey = end.y - sc.sy(0);
			const n = Math.hypot(ex, ey) || 1;
			let nx = -ey / n;
			let ny = ex / n;
			if (ny > 0) [nx, ny] = [-nx, -ny];
			const lx = sc.sx(sign * v[0] * s * 0.7) + nx * 20;
			const ly = sc.sy(sign * v[1] * s * 0.7) + ny * 16;
			const anchor: 'start' | 'middle' | 'end' =
				Math.abs(nx) > 0.6 ? (nx > 0 ? 'start' : 'end') : 'middle';
			return [
				{
					k,
					x1: sc.sx(-v[0] * s),
					y1: sc.sy(-v[1] * s),
					x2: end.x,
					y2: end.y,
					lx,
					ly,
					anchor,
					text: `λ${k ? '₂' : '₁'} = ${fixed(eig.re[k])}: ${eig.re[k] > 0 ? 'out' : eig.re[k] < 0 ? 'in' : 'still'}`
				}
			];
		});
	});

	// ---- layout of the panel's charts ---------------------------------------------------
	const k = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'kinds' ? 1 : 0;
		untrack(() => k.set(v));
	});
	const lerp = (a: Rect, b: Rect, u: number): Rect => ({
		left: a.left + (b.left - a.left) * u,
		right: a.right + (b.right - a.right) * u,
		top: a.top + (b.top - a.top) * u,
		bottom: a.bottom + (b.bottom - a.bottom) * u
	});
	const CHART_BIG: Rect = { left: 652, right: 930, top: 216, bottom: 520 };
	const CHART_SMALL: Rect = { left: 652, right: 930, top: 420, bottom: 550 };
	const chartRect = $derived(lerp(CHART_BIG, CHART_SMALL, k.current));
	const EIG: Rect = { left: 652, right: 930, top: 212, bottom: 366 };
	const eigSc = scales(EIG, { x: [-2.5, 2.5], y: [-1.45, 1.45] });

	// ---- eigenvalue handles --------------------------------------------------------------
	const snap = (v: number) => Math.round(v * 20) / 20;
	const clampRe = (v: number) => Math.min(2, Math.max(-2, snap(v)));
	function moveEigen(which: 1 | 2, re: number, im: number) {
		const x = clampRe(re);
		const lift = Math.min(1.4, snap(Math.abs(im)));
		if (w > 0) {
			// a complex pair: either dot moves the pair
			setParam('l1', x);
			setParam('l2', x);
			setParam('w', lift >= 0.05 ? lift : 0);
			return;
		}
		const other = which === 1 ? l2 : l1;
		if (Math.abs(x - other) < 0.06) {
			// on the other eigenvalue: a double root, which can leave the axis as a pair
			setParam('l1', other);
			setParam('l2', other);
			if (lift >= 0.05) setParam('w', lift);
		} else setParam(which === 1 ? 'l1' : 'l2', x);
	}
	const handles = $derived(
		phase === 'kinds'
			? [
					{ which: 1 as const, re: l1, im: w },
					{ which: 2 as const, re: w > 0 ? l1 : l2, im: -w }
				]
			: []
	);

	const pairText = $derived(
		w > 0
			? `built as [[λ, −ω], [ω, λ]]`
			: Math.abs(l1 - l2) < 1e-9
				? 'built as λ·I'
				: 'built as P·diag(λ₁, λ₂)·P⁻¹'
	);
	const kindLine = $derived(
		cls.kind === 'non-isolated' ? 'Δ = 0: a line of fixed points' : `origin: ${cls.kind}`
	);
	const periodText = $derived(
		cls.kind === 'centre' ? `closed orbits, period 2π/ω = ${fixed((2 * Math.PI) / eig.im[0])}` : ''
	);
</script>

<g>
	<!-- ================================================================ the phase plane -->
	<Axes
		sx={sc.sx}
		sy={sc.sy}
		xLabel="x"
		yLabel="y"
		xTicks={[-3, -2, -1, 0, 1, 2, 3]}
		yTicks={[-3, -2, -1, 0, 1, 2, 3]}
		xFormat={(v: number) => fixed(v, 0)}
		yFormat={(v: number) => fixed(v, 0)}
		grid={false}
	/>
	<line
		x1={PLANE.left}
		x2={PLANE.right}
		y1={sc.sy(0)}
		y2={sc.sy(0)}
		stroke="var(--stage-grid)"
		stroke-width="1"
	/>
	<line
		x1={sc.sx(0)}
		x2={sc.sx(0)}
		y1={PLANE.top}
		y2={PLANE.bottom}
		stroke="var(--stage-grid)"
		stroke-width="1"
	/>
	{#each vecs as v (v.k)}
		<line
			x1={v.x1}
			y1={v.y1}
			x2={v.x2}
			y2={v.y2}
			stroke="var(--pp-eig)"
			stroke-width="3.5"
			opacity="0.75"
			stroke-linecap="round"
		/>
	{/each}
	<Portrait rect={PLANE} box={BOX} {field} starts={LINEAR_STARTS} {t} id="pp-lin" tMax={10} />
	{#each vecs as v (v.k)}
		<Readout id="vec-{v.k}">
			<Label x={v.lx} y={v.ly - 10} text={v.text} size={12} weight={600} color="var(--pp-eig)" />
		</Readout>
	{/each}
	<circle
		cx={sc.sx(0)}
		cy={sc.sy(0)}
		r="7"
		fill={cls.kind.startsWith('stable') ? color : 'var(--stage-bg)'}
		stroke={color}
		stroke-width="2.5"
	/>

	<!-- ================================================================ the panel -->
	<Readout id="system" order={1} label="System" value="v′ = A·v, A = {matText(A)}">
		<Label x={PANEL} y={58} text="v′ = A·v" anchor="start" size={15} weight={600} />
		<Label x={PANEL} y={84} text="A = {matText(A)}" anchor="start" size={14} tabular />
	</Readout>
	{#if phase === 'kinds'}
		<Readout id="built" order={2}>
			<Label x={PANEL} y={104} text={pairText} anchor="start" size={11} muted />
		</Readout>
	{/if}
	<Readout id="kind" order={3} label="Fixed point" value={kindLine} {color}>
		<Label x={PANEL} y={132} text={kindLine} anchor="start" size={16} weight={700} {color} />
	</Readout>
	<Readout
		id="eigs"
		order={4}
		label="Eigenvalues"
		value="λ = {eigenText(eig)}; τ = {fixed(tau)}, Δ = {fixed(delta)}"
	>
		<Label
			x={PANEL}
			y={156}
			text="eigenvalues λ = {eigenText(eig)}"
			anchor="start"
			size={13}
			tabular
		/>
		<Label
			x={PANEL}
			y={176}
			text="trace τ = {fixed(tau)}, det Δ = {fixed(delta)}"
			anchor="start"
			size={13}
			tabular
			muted
		/>
	</Readout>
	{#if periodText && phase !== 'kinds'}
		<Readout id="period" order={5} label="Centre" value={periodText}>
			<Label x={PANEL} y={196} text={periodText} anchor="start" size={12} muted tabular />
		</Readout>
	{/if}

	{#if phase === 'kinds'}
		<g opacity={k.current}>
			<EigenPlane rect={EIG} re={[-2.5, 2.5]} im={[-1.45, 1.45]} eigen={eig} {color} />
		</g>
		{#each handles as hd (hd.which)}
			<VectorHandle
				x={eigSc.sx(hd.re)}
				y={eigSc.sy(hd.im)}
				label="Eigenvalue λ{hd.which === 1 ? '₁' : '₂'}"
				value={hd.re}
				valuetext="λ = {fixed(hd.re)}{hd.im !== 0
					? ` ${hd.im > 0 ? '+' : '−'} ${fixed(Math.abs(hd.im))}i`
					: ''}"
				{color}
				r={9}
				onmove={(p: Point) => moveEigen(hd.which, eigSc.sx.invert(p.x), eigSc.sy.invert(p.y))}
				onkey={(dx: number, dy: number) =>
					moveEigen(hd.which, hd.re + dx * 0.05, hd.im + dy * 0.05)}
			/>
		{/each}
	{/if}
	<TraceDet rect={chartRect} {tau} {delta} {color} names={phase !== 'kinds' || k.current < 0.5} />
</g>
