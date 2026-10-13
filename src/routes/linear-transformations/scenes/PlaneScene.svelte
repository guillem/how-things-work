<script lang="ts">
	/**
	 * The plain grid with a draggable vector v (steps "arrows" and "basis").
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   arrows — v as an arrow and a pair of numbers; a faint copy s·v whose
	 *            factor s sweeps from −1 to 2 and back (a function of t)
	 *   basis  — î and ĵ, and v built tip to tail from x copies of î and y
	 *            copies of ĵ; a dot walks that route (hidden under reduced motion)
	 *
	 * v lives in `params.vx` / `params.vy` (the sliders, step 0.5); the handle
	 * writes them, snapped to that step.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { VectorHandle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { angleOf, num } from '../matrix';
	import Arrow from './Arrow.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ------------------------------------------------------------------
	const CX = 300;
	const CY = 300;
	const U = 60; // one unit, in stage units
	const LIM = 4.5; // the drawn plane runs from −4.5 to 4.5 both ways
	const sx = (x: number) => CX + x * U;
	const sy = (y: number) => CY - y * U;
	const P = (x: number, y: number): Point => ({ x: sx(x), y: sy(y) });
	const O = P(0, 0);
	const PX = 620; // readout panel
	const GRID = [-4, -3, -2, -1, 1, 2, 3, 4];

	const phases = ['arrows', 'basis'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'arrows') as Phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	$effect(() => {
		const current = phase;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
		});
	});
	const w = $derived({ arrows: weights.arrows.current, basis: weights.basis.current });
	const panel = (v: number) => smoothstep(0.5, 1, v);

	// ---- the vector v ----------------------------------------------------------------
	const snap = (v: number) => Math.round(clamp(v, -4, 4) * 2) / 2;
	const vx = $derived(snap(Number(params.vx ?? 2)));
	const vy = $derived(snap(Number(params.vy ?? 1)));
	const V = $derived(P(vx, vy));
	const vText = $derived(`(${num(vx)}, ${num(vy)})`);
	/** A factor in a product: negatives in brackets. */
	const fb = (n: number, d = 2) => (num(n, d).startsWith('−') ? `(${num(n, d)})` : num(n, d));

	function onmove(p: Point) {
		setParam('vx', snap((p.x - CX) / U));
		setParam('vy', snap((CY - p.y) / U));
	}
	function onkey(dx: number, dy: number) {
		// A key moves v by half a step; with Shift (|dx| or |dy| = 5), by a whole step.
		const k = Math.abs(dx) + Math.abs(dy) > 1 ? 1 : 0.5;
		setParam('vx', snap(vx + Math.sign(dx) * k));
		setParam('vy', snap(vy + Math.sign(dy) * k));
	}

	// Inviting pulse on the handle at the start of a step.
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	// ---- phase arrows: s·v with s sweeping between −1 and 2 --------------------------
	const s = $derived(Math.round((0.5 + 1.5 * Math.sin((2 * Math.PI * t) / 8)) * 10) / 10);
	const SV = $derived(P(s * vx, s * vy));
	const isZero = $derived(vx === 0 && vy === 0);
	/** The line through the origin along v, across the drawn plane. */
	const vLine = $derived.by(() => {
		if (isZero) return null;
		const k = (LIM * 1.5) / Math.max(Math.abs(vx), Math.abs(vy));
		return { a: P(-k * vx, -k * vy), b: P(k * vx, k * vy) };
	});
	// Words for the panel: "2 steps right, 1 step up".
	const steps = (n: number, pos: string, neg: string) => {
		if (n === 0) return null;
		const a = Math.abs(n);
		return `${num(a)} step${a === 1 ? '' : 's'} ${n > 0 ? pos : neg}`;
	};
	const words = $derived(
		[steps(vx, 'right', 'left'), steps(vy, 'up', 'down')].filter(Boolean).join(', ') ||
			'no steps at all: the zero vector'
	);
	// s·v's label goes beside its tip, on the anticlockwise side of the line (the
	// steps x and y are drawn on the other side).
	const svLabel = $derived.by(() => {
		const len = Math.hypot(SV.x - O.x, SV.y - O.y);
		if (len < 30) return null;
		const nx = (SV.x - O.x) / len;
		const ny = (SV.y - O.y) / len;
		const side = vx * vy >= 0 ? 1 : -1;
		return {
			x: SV.x + side * ny * 20,
			y: SV.y - side * nx * 20 + 5,
			right: side * ny >= 0
		};
	});

	// ---- phase basis: x copies of î then y copies of ĵ -------------------------------
	/** Pieces of length ≤ 1 from 0 to n along one axis (a last half piece if n ends in .5). */
	const pieces = (n: number) => {
		const out: [number, number][] = [];
		const dir = Math.sign(n);
		for (let k = 0; k < Math.abs(n); k++) out.push([dir * k, dir * Math.min(k + 1, Math.abs(n))]);
		return out;
	};
	const iPieces = $derived(pieces(vx));
	const jPieces = $derived(pieces(vy));
	// The walking dot: 0.7 s per unit, a 1.2 s rest at v's tip.
	const walk = $derived.by(() => {
		const L = Math.abs(vx) + Math.abs(vy);
		if (L === 0) return null;
		const T0 = 0.7 * L;
		const u = t % (T0 + 1.2);
		const d = Math.min(u / 0.7, L);
		const p =
			d <= Math.abs(vx) ? P(Math.sign(vx) * d, 0) : P(vx, Math.sign(vy) * (d - Math.abs(vx)));
		return { p, fade: 1 - smoothstep(T0 + 0.6, T0 + 1.2, u) };
	});
	const sumText = $derived(
		`${num(vx)}·î ${vy < 0 ? '−' : '+'} ${num(Math.abs(vy))}·ĵ`
			.replace(/^1·/, '')
			.replace(/ 1·ĵ$/, ' ĵ')
	);

	// Axis names fade while v sits on them.
	const clearOf = (x: number, y: number) =>
		0.15 + 0.85 * smoothstep(28, 48, Math.hypot(V.x - x, V.y - y));
</script>

<g>
	<defs>
		<clipPath id="lt-plane-clip">
			<rect x={sx(-LIM)} y={sy(LIM)} width={2 * LIM * U} height={2 * LIM * U} />
		</clipPath>
	</defs>
	<!-- the grid and the axes -->
	{#each GRID as g (g)}
		<line x1={sx(g)} x2={sx(g)} y1={sy(LIM)} y2={sy(-LIM)} stroke="var(--stage-grid)" />
		<line x1={sx(-LIM)} x2={sx(LIM)} y1={sy(g)} y2={sy(g)} stroke="var(--stage-grid)" />
	{/each}
	<line x1={sx(-LIM)} x2={sx(LIM)} y1={CY} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={CX} x2={CX} y1={sy(LIM)} y2={sy(-LIM)} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each GRID as g (g)}
		<T x={sx(g)} y={CY + 18} text={num(g)} size={11} anchor="middle" muted />
		<T x={CX - 8} y={sy(g) + 4} text={num(g)} size={11} anchor="end" muted />
	{/each}
	<T
		x={sx(LIM)}
		y={CY - 8}
		text="x"
		size={13}
		anchor="end"
		muted
		italic
		opacity={clearOf(sx(LIM) - 6, CY - 12)}
	/>
	<T
		x={CX + 9}
		y={sy(LIM) + 10}
		text="y"
		size={13}
		muted
		italic
		opacity={clearOf(CX + 12, sy(LIM) + 6)}
	/>

	<!-- ============ phase arrows: v and s·v ============ -->
	{#if w.arrows > 0.01}
		<g opacity={w.arrows}>
			{#if vLine}
				<line
					clip-path="url(#lt-plane-clip)"
					x1={vLine.a.x}
					y1={vLine.a.y}
					x2={vLine.b.x}
					y2={vLine.b.y}
					stroke="var(--lt-v)"
					stroke-dasharray="2 6"
					opacity="0.5"
				/>
			{/if}
			<!-- the two numbers as steps along the axes -->
			{#if vx !== 0}
				<line
					x1={CX}
					y1={CY}
					x2={V.x}
					y2={CY}
					stroke="var(--lt-v)"
					stroke-width="3"
					opacity="0.45"
				/>
				<T
					x={(CX + V.x) / 2}
					y={CY + (vy >= 0 ? 36 : -12)}
					text="x = {num(vx)}"
					anchor="middle"
					weight={600}
				/>
			{/if}
			{#if vy !== 0}
				<line
					x1={V.x}
					y1={CY}
					x2={V.x}
					y2={V.y}
					stroke="var(--lt-v)"
					stroke-width="3"
					opacity="0.45"
				/>
				<T
					x={V.x + (vx >= 0 ? 10 : -10)}
					y={(CY + V.y) / 2 + 4}
					text="y = {num(vy)}"
					anchor={vx >= 0 ? 'start' : 'end'}
					weight={600}
				/>
			{/if}
			{#if !isZero}
				<Arrow from={O} to={SV} color="var(--lt-v)" width={2} opacity={0.45} dashed />
				{#if svLabel}
					<T
						x={svLabel.x}
						y={svLabel.y}
						text="{num(s, 1)}·v"
						anchor={svLabel.right ? 'start' : 'end'}
						color="var(--lt-v)"
						weight={600}
						opacity={0.8}
					/>
				{/if}
			{/if}
		</g>
		<g opacity={panel(w.arrows)}>
			<T x={PX} y={110} text="v = {vText}" size={30} weight={700} color="var(--lt-v)" />
			<T x={PX} y={140} text={words} size={14} muted />
			<T x={PX} y={210} text="Scaling by a number s:" size={14} weight={600} />
			<T x={PX} y={236} text="s·v = ({fb(s, 1)} × {fb(vx)}, {fb(s, 1)} × {fb(vy)})" size={15} />
			<T
				x={PX}
				y={260}
				text="= ({num(s * vx)}, {num(s * vy)})"
				size={15}
				weight={600}
				color="var(--lt-v)"
			/>
			<T x={PX} y={300} text="the same line through the origin," size={13} muted />
			<T
				x={PX}
				y={320}
				text={s < 0 ? 'turned round (s is negative)' : `${num(Math.abs(s), 1)} times as long`}
				size={13}
				muted
			/>
			<T x={PX} y={400} text="Drag the tip of v, or focus it" size={13} muted />
			<T x={PX} y={420} text="and use the arrow keys." size={13} muted />
		</g>
	{/if}

	<!-- ============ phase basis: v = x·î + y·ĵ ============ -->
	{#if w.basis > 0.01}
		<g opacity={w.basis}>
			{#each iPieces as [a, b] (a)}
				<Arrow
					from={P(a, 0)}
					to={P(b, 0)}
					color="var(--lt-i)"
					width={3.5}
					head={12}
					opacity={0.85}
				/>
			{/each}
			{#each jPieces as [a, b] (a)}
				<Arrow
					from={P(vx, a)}
					to={P(vx, b)}
					color="var(--lt-j)"
					width={3.5}
					head={12}
					opacity={0.85}
				/>
			{/each}
			{#if walk && !reduced}
				<circle
					cx={walk.p.x}
					cy={walk.p.y}
					r="6"
					fill="var(--stage-ink)"
					stroke="var(--stage-bg)"
					stroke-width="2"
					opacity={walk.fade}
				/>
			{/if}
			<!-- î and ĵ themselves, at the origin -->
			<Arrow from={O} to={P(1, 0)} color="var(--lt-i)" width={5} head={16} />
			<Arrow from={O} to={P(0, 1)} color="var(--lt-j)" width={5} head={16} />
			<T
				x={sx(0.5)}
				y={CY + (vx > 0 && vy < 0 ? -12 : 26)}
				text="î"
				size={18}
				weight={700}
				anchor="middle"
				color="var(--lt-i)"
			/>
			<T
				x={CX + (vx < 0 && vy > 0 ? 14 : -14)}
				y={sy(0.5) + 6}
				text="ĵ"
				size={18}
				weight={700}
				anchor={vx < 0 && vy > 0 ? 'start' : 'end'}
				color="var(--lt-j)"
			/>
		</g>
		<g opacity={panel(w.basis)}>
			<T x={PX} y={70} text="the basis" size={13} muted />
			<T x={PX} y={98} text="î = (1, 0)" size={20} weight={700} color="var(--lt-i)" />
			<T x={PX + 150} y={98} text="ĵ = (0, 1)" size={20} weight={700} color="var(--lt-j)" />
			<T x={PX} y={170} text="v = {vText}" size={26} weight={700} color="var(--lt-v)" />
			<T x={PX} y={206} text="= {sumText}" size={22} weight={600} />
			<T
				x={PX}
				y={248}
				text="{num(Math.abs(vx))} step{Math.abs(vx) === 1 ? '' : 's'} of {vx < 0
					? '−î'
					: 'î'}, then {num(Math.abs(vy))} of {vy < 0 ? '−ĵ' : 'ĵ'}"
				size={14}
				muted
			/>
			<T x={PX} y={312} text="Adding tip to tail, number by number:" size={13} />
			<T x={PX} y={338} text="({num(vx)}, 0) + (0, {num(vy)}) = {vText}" size={16} weight={600} />
			<T x={PX} y={410} text="Every vector is built from î and ĵ" size={14} weight={600} />
			<T x={PX} y={432} text="in exactly one way." size={14} weight={600} />
		</g>
	{/if}

	<!-- ============ v and its handle ============ -->
	{#if !isZero}
		<Arrow from={O} to={V} color="var(--lt-v)" width={4} head={18} />
	{/if}
	{#if pulse > 0.01}
		<circle
			cx={V.x}
			cy={V.y}
			r={18 + 10 * pulse}
			fill="none"
			stroke="var(--lt-v)"
			stroke-width="2"
			opacity={0.5 * pulse}
		/>
	{/if}
	<T
		x={V.x + (vx >= 0 ? 16 : -16)}
		y={V.y + (vy >= 0 ? -14 : 26)}
		text="v"
		size={20}
		weight={700}
		italic
		anchor={vx >= 0 ? 'start' : 'end'}
		color="var(--lt-v)"
	/>
	<VectorHandle
		x={V.x}
		y={V.y}
		label="Tip of the vector v"
		value={angleOf({ x: vx, y: vy })}
		valuetext="v = {vText}"
		color="var(--lt-v)"
		{onmove}
		{onkey}
	/>
</g>
