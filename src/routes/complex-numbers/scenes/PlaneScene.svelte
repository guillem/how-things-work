<script lang="ts">
	/**
	 * The complex plane with a draggable point z = a + bi.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   i      — the number line, then the imaginary axis growing out of it;
	 *            1, i, −1, −i marked; no point to drag yet
	 *   plane  — z = a + bi: its real and imaginary parts as coloured legs,
	 *            and (when it fits) the slide z → z + (1 + 2i)
	 *   times  — z, iz, i²z = −z, i³z: four quarter turns; a marker walks
	 *            round them (a function of t; hidden under reduced motion)
	 *   polar  — the length |z| and the angle φ; z shrunk onto the unit circle
	 *
	 * z lives in `params.zRe` / `params.zIm` (the sliders); the handle writes
	 * them, rounded to the slider step of 0.1.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { I, abs, add, arg, c, fmt, mul, num, pow, reduce, short } from '../complex';
	import PointHandle from './PointHandle.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ------------------------------------------------------------------
	const CX = 300;
	const CY = 300;
	const U = 84; // one unit, in stage units
	const LIM = 3; // the plane runs from −3 to 3 both ways
	const E = LIM * U + 18; // half-length of the drawn axes
	const sx = (re: number) => CX + re * U;
	const sy = (im: number) => CY - im * U;
	const PX = 624; // readout panel
	const GRID = [-3, -2, -1, 1, 2, 3];

	const phases = ['i', 'plane', 'times', 'polar'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'plane') as Phase);

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
	const w = $derived({
		i: weights.i.current,
		plane: weights.plane.current,
		times: weights.times.current,
		polar: weights.polar.current
	});
	// Panel blocks share lines: the old one is gone halfway through the tween.
	const panel = (v: number) => smoothstep(0.5, 1, v);
	const hasZ = $derived(1 - w.i);

	// ---- the point ---------------------------------------------------------------------
	const round1 = (v: number) => Math.round(clamp(v, -LIM, LIM) * 10) / 10;
	const z = $derived(c(round1(Number(params.zRe ?? 2)), round1(Number(params.zIm ?? 1))));
	const Z = $derived({ x: sx(z.re), y: sy(z.im) });
	const r = $derived(abs(z));
	const phi = $derived(reduce(arg(z)));

	function onmove(p: Point) {
		setParam('zRe', round1((p.x - CX) / U));
		setParam('zIm', round1((CY - p.y) / U));
	}
	function onkey(dx: number, dy: number) {
		setParam('zRe', round1(z.re + dx / 10));
		setParam('zIm', round1(z.im + dy / 10));
	}

	// ---- phase i: the imaginary axis grows out of the number line ------------------------
	const grow = $derived(phase === 'i' ? smoothstep(0.6, 2.2, reduced ? 2.5 : t) : 1);

	// ---- phase plane: the slide z → z + (1 + 2i) ------------------------------------------
	const shift = c(1, 2);
	const zs = $derived(add(z, shift));
	const slideFits = $derived(Math.abs(zs.re) <= LIM && Math.abs(zs.im) <= LIM);

	// ---- phase times: four quarter turns -----------------------------------------------------
	const turns = $derived([0, 1, 2, 3].map((k) => mul(pow(I, k), z)));
	const turnNames = ['z', 'iz', 'i²z = −z', 'i³z = −iz'];
	// The marker: 2 s per quarter turn, 1.2 s moving then 0.8 s resting.
	const marker = $derived.by(() => {
		const u = (t % 8) / 2;
		const k = Math.floor(u);
		const f = smoothstep(0, 0.6, u - k);
		const a = ((phi + 90 * (k + f)) * Math.PI) / 180;
		return { x: CX + r * U * Math.cos(a), y: CY - r * U * Math.sin(a) };
	});
	/** Arc of radius `rad` (stage units) from angle a0 to a1 (degrees, anticlockwise). */
	function arc(rad: number, a0: number, a1: number) {
		const p = (a: number) =>
			`${(CX + rad * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(CY - rad * Math.sin((a * Math.PI) / 180)).toFixed(1)}`;
		const large = a1 - a0 > 180 ? 1 : 0;
		return `M${p(a0)} A${rad} ${rad} 0 ${large} 0 ${p(a1)}`;
	}
	/** Where the name of turn k goes: outside the point, away from the centre. */
	const nameAt = (p: { re: number; im: number }) => {
		const len = Math.hypot(p.re, p.im) || 1;
		return { x: sx(p.re) + (22 * p.re) / len, y: sy(p.im) - (22 * p.im) / len + 5 };
	};

	// ---- phase polar -------------------------------------------------------------------------
	const unitPt = $derived(r > 0 ? { x: CX + (U * z.re) / r, y: CY - (U * z.im) / r } : null);
	const arcR = 30;
	const phiLabel = $derived.by(() => {
		const m = ((phi / 2) * Math.PI) / 180;
		return { x: CX + (arcR + 16) * Math.cos(m), y: CY - (arcR + 16) * Math.sin(m) + 5 };
	});
	// "|z|" sits beside the middle of the radius, on its clockwise side.
	const lenLabel = $derived.by(() => {
		const a = (phi * Math.PI) / 180;
		const n = { x: Math.sin(a), y: Math.cos(a) };
		return {
			x: CX + (r * U * Math.cos(a)) / 2 + 16 * n.x,
			y: CY - (r * U * Math.sin(a)) / 2 + 16 * n.y + 4 + 4 * n.y,
			anchor: Math.abs(n.x) < 0.2 ? 'middle' : n.x > 0 ? 'start' : 'end'
		};
	});

	// Inviting pulse on the handle at the start of a step.
	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));

	const zText = $derived(fmt(z, 1));
	// The "b = …" label goes outside the leg, except at the plane's edges.
	const bRight = $derived(z.re >= 0 ? z.re <= 2.3 : z.re < -2.3);
	// The plane and polar phases label z with its value; the others just "z".
	const showPill = $derived(w.plane > 0.5 || w.polar > 0.5);
	const pillW = (text: string, size: number) => text.length * size * 0.52 + 16;
	// The pill with z's value: above the point, or below it when z is near the top.
	// Up and to the side away from the slide arrow (which goes up and right), or
	// below when z is near the top.
	const zPill = $derived({
		x: z.re >= 0 ? Z.x - 16 : Z.x + 16,
		y: z.im > 2.3 ? Z.y + 36 : Z.y - 20,
		anchor: z.re >= 0 ? 'end' : 'start'
	});
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
		italic?: boolean;
		pill?: boolean;
	} = {}
)}
	{#if opts.pill}
		{@const pw = pillW(text, size)}
		<rect
			x={opts.anchor === 'start' ? x - 8 : opts.anchor === 'end' ? x - pw + 8 : x - pw / 2}
			y={y - size * 0.75 - 5}
			width={pw}
			height={size + 10}
			rx={(size + 10) / 2}
			fill="var(--surface)"
			stroke="var(--border)"
			opacity={opts.opacity ?? 1}
		/>
	{/if}
	<text
		{x}
		{y}
		class={opts.pill ? undefined : 'halo'}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:font-style={opts.italic ? 'italic' : undefined}
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- grid (the plane appears with the imaginary axis) -->
	<g opacity={grow}>
		{#each GRID as g (g)}
			<line x1={sx(g)} x2={sx(g)} y1={sy(LIM)} y2={sy(-LIM)} stroke="var(--stage-grid)" />
			<line x1={sx(-LIM)} x2={sx(LIM)} y1={sy(g)} y2={sy(g)} stroke="var(--stage-grid)" />
		{/each}
	</g>

	<!-- the real axis: the number line -->
	<line
		x1={CX - E}
		x2={CX + E}
		y1={CY}
		y2={CY}
		stroke="var(--stage-line)"
		stroke-width={1.5 + 1.5 * w.i}
	/>
	{#each GRID as g (g)}
		<line x1={sx(g)} x2={sx(g)} y1={CY - 5} y2={CY + 5} stroke="var(--stage-line)" />
		{@render txt(sx(g), CY + 20, num(g, 0), 12, {
			anchor: 'middle',
			muted: true,
			opacity: Math.abs(g) === 1 ? 1 - w.i : 1
		})}
	{/each}
	{@render txt(CX - 8, CY + 20, '0', 12, { anchor: 'end', muted: true })}
	{@render txt(CX + E, CY - 10, 'real', 12, { anchor: 'end', muted: true })}

	<!-- the imaginary axis, grown from 0 -->
	<line
		x1={CX}
		x2={CX}
		y1={CY - E * grow}
		y2={CY + E * grow}
		stroke="var(--stage-line)"
		stroke-width={1.5 + 1.5 * w.i}
	/>
	<g opacity={grow}>
		{#each GRID as g (g)}
			<line x1={CX - 5} x2={CX + 5} y1={sy(g)} y2={sy(g)} stroke="var(--stage-line)" />
			{@render txt(CX - 9, sy(g) + 4, g === 1 ? 'i' : g === -1 ? '−i' : `${num(g, 0)}i`, 12, {
				anchor: 'end',
				muted: true,
				opacity: Math.abs(g) === 1 ? 1 - w.i : 1
			})}
		{/each}
		{@render txt(CX + 10, CY - E + 8, 'imaginary', 12, { muted: true })}
	</g>

	<!-- ============ phase i: 1, i, −1, −i ============ -->
	{#if w.i > 0.01}
		<g opacity={w.i}>
			{#each [{ id: '1', p: c(1) }, { id: '−1', p: c(-1) }, { id: 'i', p: c(0, 1) }, { id: '−i', p: c(0, -1) }] as m (m.id)}
				{@const onLine = m.p.im === 0}
				<g opacity={onLine ? 1 : grow}>
					<circle
						cx={sx(m.p.re)}
						cy={sy(m.p.im)}
						r="7"
						fill={onLine ? 'var(--cx-re)' : 'var(--cx-im)'}
						stroke="var(--stage-bg)"
						stroke-width="2"
					/>
					{@render txt(
						sx(m.p.re) + (onLine ? 0 : 14),
						sy(m.p.im) + (onLine ? -16 : m.p.im > 0 ? -8 : 18),
						m.id,
						17,
						{
							anchor: onLine ? 'middle' : 'start',
							weight: 700,
							color: onLine ? 'var(--cx-re)' : 'var(--cx-im)'
						}
					)}
				</g>
			{/each}
		</g>
		<g opacity={panel(w.i)}>
			{@render txt(PX, 120, 'i² = −1', 34, { weight: 700, color: 'var(--cx-im)' })}
			{@render txt(PX, 150, 'the one new rule', 13, { muted: true })}
			{@render txt(PX, 210, 'On the number line, squares are never negative:', 13)}
			{#each ['2² = 4', '(−2)² = 4', '0² = 0'] as sq, k (sq)}
				{@render txt(PX + k * 104, 240, sq, 15, { weight: 600 })}
			{/each}
			{@render txt(PX, 300, 'So i is not on the line. It gets its own', 13)}
			{@render txt(PX, 320, 'direction: an axis at right angles to it.', 13)}
			<g opacity={grow}>
				{@render txt(PX, 380, '−i is the other square root of −1:', 13, { muted: true })}
				{@render txt(PX, 404, '(−i)² = i² = −1', 15, { weight: 600 })}
			</g>
		</g>
	{/if}

	<!-- ============ phase plane: the parts of z ============ -->
	{#if w.plane > 0.01}
		<g opacity={w.plane}>
			{#if slideFits}
				<!-- the slide z → z + (1 + 2i), head to tail -->
				<line
					x1={CX}
					y1={CY}
					x2={sx(shift.re)}
					y2={sy(shift.im)}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					stroke-dasharray="4 4"
					opacity="0.6"
				/>
				<line
					x1={Z.x}
					y1={Z.y}
					x2={sx(zs.re)}
					y2={sy(zs.im)}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.8"
					stroke-dasharray="4 4"
					marker-end="url(#arrowhead)"
				/>
				<circle cx={sx(zs.re)} cy={sy(zs.im)} r="5" fill="var(--stage-ink-muted)" />
			{/if}
			<line
				x1={Z.x}
				x2={Z.x}
				y1={CY}
				y2={Z.y}
				stroke="var(--cx-im)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<line
				x1={CX}
				x2={Z.x}
				y1={CY}
				y2={CY}
				stroke="var(--cx-re)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<line
				x1={CX}
				x2={Z.x}
				y1={Z.y}
				y2={Z.y}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
			{#if Math.abs(z.re) >= 0.3}
				{@render txt((CX + Z.x) / 2, CY + (z.im >= 0 ? 38 : -28), `a = ${short(z.re, 1)}`, 13, {
					anchor: 'middle',
					weight: 600,
					color: 'var(--cx-re)'
				})}
			{/if}
			{#if Math.abs(z.im) >= 0.3}
				{@render txt(Z.x + (bRight ? 12 : -12), (CY + Z.y) / 2 + 5, `b = ${short(z.im, 1)}`, 13, {
					anchor: bRight ? 'start' : 'end',
					weight: 600,
					color: 'var(--cx-im)'
				})}
			{/if}
		</g>
		<g opacity={panel(w.plane)}>
			{@render txt(PX, 112, `z = ${zText}`, 30, { weight: 700, color: 'var(--cx-z)' })}
			{@render txt(PX, 140, `the point (${short(z.re, 1)}, ${short(z.im, 1)})`, 14, {
				muted: true
			})}
			{@render txt(PX, 196, `real part  a = ${short(z.re, 1)}`, 15, {
				weight: 600,
				color: 'var(--cx-re)'
			})}
			{@render txt(PX, 216, 'how far along the real axis', 12, { muted: true })}
			{@render txt(PX, 256, `imaginary part  b = ${short(z.im, 1)}`, 15, {
				weight: 600,
				color: 'var(--cx-im)'
			})}
			{@render txt(PX, 276, 'how far up the imaginary axis', 12, { muted: true })}
			{@render txt(PX, 340, 'Adding works part by part:', 13)}
			{@render txt(PX, 366, `(${zText}) + (1 + 2i) = ${fmt(zs, 1)}`, 15, { weight: 600 })}
			{@render txt(
				PX,
				388,
				slideFits ? 'the dashed arrow: a slide by 1 + 2i' : '(off this piece of the plane)',
				12,
				{ muted: true }
			)}
		</g>
	{/if}

	<!-- ============ phase times: quarter turns ============ -->
	{#if w.times > 0.01 && r > 0}
		<defs>
			<clipPath id="plane-clip">
				<rect
					x={sx(-LIM) - 14}
					y={sy(LIM) - 14}
					width={2 * LIM * U + 28}
					height={2 * LIM * U + 28}
				/>
			</clipPath>
		</defs>
		<g opacity={w.times}>
			<g clip-path="url(#plane-clip)">
				<circle
					cx={CX}
					cy={CY}
					r={r * U}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-dasharray="2 5"
					opacity="0.6"
				/>
				{#each [0, 1, 2, 3] as k (k)}
					<path
						d={arc(r * U, phi + 90 * k + 9, phi + 90 * (k + 1) - 9)}
						fill="none"
						stroke="var(--explainer-accent)"
						stroke-width="2"
						marker-end="url(#arrowhead)"
						opacity={k === 0 ? 1 : 0.45}
					/>
				{/each}
			</g>
			{#each turns as p, k (k)}
				<line
					x1={CX}
					y1={CY}
					x2={sx(p.re)}
					y2={sy(p.im)}
					stroke="var(--cx-z)"
					stroke-width={k === 0 ? 2.4 : 1.6}
					opacity={k === 0 ? 1 : 0.55}
				/>
				{#if k > 0}
					<circle cx={sx(p.re)} cy={sy(p.im)} r="6" fill="var(--cx-z)" opacity="0.65" />
					{@const n = nameAt(p)}
					{@render txt(n.x, n.y, ['', 'iz', '−z', '−iz'][k], 15, {
						anchor: 'middle',
						weight: 700,
						color: 'var(--cx-z)'
					})}
				{/if}
			{/each}
			<!-- right angle between z and iz -->
			{#if r * U > 30}
				{@const a = (phi * Math.PI) / 180}
				{@const s = 13}
				<path
					d="M{CX + s * Math.cos(a)} {CY - s * Math.sin(a)} L{CX +
						s * Math.cos(a) -
						s * Math.sin(a)} {CY - s * Math.sin(a) - s * Math.cos(a)} L{CX - s * Math.sin(a)} {CY -
						s * Math.cos(a)}"
					fill="none"
					stroke="var(--explainer-accent)"
					stroke-width="1.5"
				/>
			{/if}
			{#if !reduced}
				<circle
					clip-path="url(#plane-clip)"
					cx={marker.x}
					cy={marker.y}
					r="5"
					fill="var(--explainer-accent)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			{/if}
		</g>
	{/if}
	{#if w.times > 0.01}
		<g opacity={panel(w.times)}>
			{@render txt(PX, 104, 'Multiply by i again and again', 15, { weight: 600 })}
			{@render txt(PX, 126, 'each time a quarter turn, 90° anticlockwise', 12, { muted: true })}
			{#each turns as p, k (k)}
				{@const y = 172 + k * 44}
				{@render txt(PX, y, turnNames[k], 15, {
					weight: 600,
					color: 'var(--cx-z)',
					opacity: k === 0 ? 1 : 0.85
				})}
				{@render txt(PX + 300, y, `= ${fmt(p, 1)}`, 16, { anchor: 'end', weight: 600 })}
			{/each}
			{@render txt(PX, 172 + 4 * 44, 'i⁴z = z', 15, { weight: 600, color: 'var(--cx-z)' })}
			{@render txt(PX + 300, 172 + 4 * 44, 'back home', 13, { anchor: 'end', muted: true })}
			{@render txt(PX, 418, '(a, b)  →  (−b, a)', 16, { weight: 600 })}
			{@render txt(PX, 440, 'what ×i does to every point', 12, { muted: true })}
			{@render txt(PX, 486, 'Two quarter turns make a half turn:', 13)}
			{@render txt(PX, 508, 'i² = −1', 16, { weight: 700, color: 'var(--explainer-accent)' })}
		</g>
	{/if}

	<!-- ============ phase polar: length and angle ============ -->
	{#if w.polar > 0.01}
		<g opacity={w.polar}>
			<circle
				cx={CX}
				cy={CY}
				r={U}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="1.4"
				opacity="0.55"
			/>
			{@render txt(sx(-0.72), sy(-0.82), 'unit circle', 11, { anchor: 'end', muted: true })}
			{#if r > 0}
				<line
					x1={CX}
					x2={Z.x}
					y1={CY}
					y2={CY}
					stroke="var(--cx-re)"
					stroke-width="3"
					opacity="0.6"
				/>
				<line
					x1={Z.x}
					x2={Z.x}
					y1={CY}
					y2={Z.y}
					stroke="var(--cx-im)"
					stroke-width="3"
					opacity="0.6"
				/>
				<line
					x1={CX}
					y1={CY}
					x2={Z.x}
					y2={Z.y}
					stroke="var(--cx-z)"
					stroke-width="2.6"
					stroke-linecap="round"
				/>
				<path
					d={arc(arcR, 0, phi)}
					fill="none"
					stroke="var(--explainer-accent)"
					stroke-width="2.2"
				/>
				{#if phi > 14}
					{@render txt(phiLabel.x, phiLabel.y, 'φ', 15, {
						anchor: 'middle',
						weight: 700,
						color: 'var(--explainer-accent)'
					})}
				{/if}
				{#if r >= 0.7}
					{@render txt(lenLabel.x, lenLabel.y, `|z| = ${num(r)}`, 13, {
						anchor: lenLabel.anchor,
						weight: 600
					})}
				{/if}
				{#if unitPt && Math.abs(r - 1) > 0.25}
					<circle
						cx={unitPt.x}
						cy={unitPt.y}
						r="5"
						fill="var(--explainer-accent)"
						stroke="var(--stage-bg)"
						stroke-width="1.5"
					/>
				{/if}
			{/if}
		</g>
		<g opacity={panel(w.polar)}>
			{@render txt(PX, 112, `z = ${zText}`, 26, { weight: 700, color: 'var(--cx-z)' })}
			{@render txt(PX, 172, 'length (Pythagoras)', 12, { muted: true })}
			{@render txt(
				PX,
				198,
				`|z| = √(${short(z.re, 1)}² + ${short(z.im, 1)}²) = ${num(r)}`
					.replace(/√\(−([\d.]+)²/, '√((−$1)²')
					.replace(/\+ −([\d.]+)²/, '+ (−$1)²'),
				16,
				{ weight: 600 }
			)}
			{@render txt(PX, 250, 'angle from the positive real axis', 12, { muted: true })}
			{@render txt(PX, 276, r > 0 ? `φ ≈ ${num(phi, 1)}°` : 'φ: none (0 has no direction)', 16, {
				weight: 600,
				color: 'var(--explainer-accent)'
			})}
			{@render txt(PX, 330, 'shrunk to length 1, on the unit circle:', 12, { muted: true })}
			{@render txt(
				PX,
				356,
				r > 0 ? `(cos φ, sin φ) = (${num(z.re / r)}, ${num(z.im / r)})` : '—',
				15,
				{ weight: 600 }
			)}
			{@render txt(PX, 420, 'so  z = |z| · (cos φ + i sin φ)', 15, { weight: 600 })}
			{@render txt(
				PX,
				446,
				r > 0 ? `= ${num(r)} · (${num(z.re / r)} + ${num(z.im / r)}i)`.replace('+ −', '− ') : '',
				14,
				{ muted: true }
			)}
		</g>
	{/if}

	<!-- ============ the point z ============ -->
	{#if hasZ > 0.01}
		<g opacity={hasZ}>
			{#if pulse > 0.01}
				<circle
					cx={Z.x}
					cy={Z.y}
					r={16 + 10 * pulse}
					fill="none"
					stroke="var(--cx-z)"
					stroke-width="2"
					opacity={0.5 * pulse}
				/>
			{/if}
			{#if showPill}
				{@render txt(zPill.x, zPill.y, `z = ${zText}`, 14, {
					anchor: zPill.anchor,
					weight: 600,
					pill: true,
					color: 'var(--cx-z)'
				})}
			{/if}
			<PointHandle
				x={Z.x}
				y={Z.y}
				label="The point z"
				value={phi}
				valuetext="z = {zText}"
				color="var(--cx-z)"
				name={showPill ? undefined : 'z'}
				nameDx={z.re >= 0 ? 14 : -14}
				nameDy={z.im > 2.3 ? 20 : -12}
				{onmove}
				{onkey}
			/>
		</g>
	{/if}
</g>
