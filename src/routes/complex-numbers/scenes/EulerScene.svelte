<script lang="ts">
	/**
	 * e^(iθ) on the unit circle.
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   euler    — the point e^(iθ) (draggable, or the θ slider); its real part
	 *              (cos θ) and imaginary part (sin θ) as coloured legs, and as
	 *              the cosine and sine curves on the right, traced up to θ
	 *   compound — the path 1, (1 + iθ/n), (1 + iθ/n)², … (1 + iθ/n)ⁿ, drawn
	 *              step by step (complete by t ≈ 2.2 s, and at once under
	 *              reduced motion); the view zooms out when the path is big
	 *   identity — θ sweeps from 0 to π by itself (done by t = 2.4 s) and
	 *              e^(iπ) lands on −1; the summary on the right
	 *
	 * e^(iθ) comes from the model's power series (`expi`), not from cos/sin;
	 * the compounding path from `compound`. θ lives in `params.theta`
	 * (degrees), shared with the slider; `params.n` is the number of steps.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		abs,
		add,
		arg,
		compound,
		expi,
		fmt,
		num,
		radText,
		reduce,
		toDeg,
		toRad
	} from '../complex';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry ------------------------------------------------------------------
	const CX = 252;
	const CY = 318;
	const R0 = 150; // one unit, in stage units, when not zoomed out
	const FIT = 236; // the compounding path must fit within this radius
	const PX = 560; // right-hand column
	const PW = 360;

	const phases = ['euler', 'compound', 'identity'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'euler') as Phase);
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
		euler: weights.euler.current,
		compound: weights.compound.current,
		identity: weights.identity.current
	});
	const panel = (v: number) => smoothstep(0.5, 1, v);
	const tt = $derived(reduced ? 2.5 : t);

	// ---- θ -----------------------------------------------------------------------------
	const sliderTheta = $derived(clamp(Math.round(Number(params.theta ?? 60)), 0, 360));
	// In the identity step θ sweeps from 0 to 180° by itself.
	const sweep = $derived(180 * smoothstep(0.4, 2.4, tt));
	const thetaDeg = $derived(phase === 'identity' ? sweep : sliderTheta);
	const th = $derived(toRad(thetaDeg));
	const E = $derived(expi(th)); // e^(iθ) from the power series

	// ---- compounding ---------------------------------------------------------------------
	const n = $derived(clamp(Math.round(Number(params.n ?? 6)), 1, 100));
	const path = $derived(compound(th, n));
	const end = $derived(path[n]);
	const reach = $derived(Math.max(1, ...path.map(abs)));
	// Zoom out so the whole path fits (only in the compound step).
	const unitTarget = $derived(phase === 'compound' ? Math.min(R0, FIT / reach) : R0);
	const unit = Tween.of(() => unitTarget, { duration: 600, easing: cubicInOut });
	const U = $derived(reduced ? unitTarget : unit.current);
	// The path is drawn one step at a time.
	const shown = $derived(n * smoothstep(0.3, 2.2, tt));
	const sx = (re: number) => CX + re * U;
	const sy = (im: number) => CY - im * U;
	const pathD = $derived.by(() => {
		const k = Math.floor(shown);
		const pts = path.slice(0, k + 1);
		if (k < n) {
			const f = shown - k;
			pts.push(
				add(path[k], {
					re: (path[k + 1].re - path[k].re) * f,
					im: (path[k + 1].im - path[k].im) * f
				})
			);
		}
		return pts
			.map((p, i) => `${i ? 'L' : 'M'}${sx(p.re).toFixed(1)} ${sy(p.im).toFixed(1)}`)
			.join(' ');
	});
	const stepZ = $derived(path[1]); // 1 + iθ/n
	const gap = $derived(abs(add(end, { re: -E.re, im: -E.im })));
	const endShown = $derived(smoothstep(n - 0.05, n, shown));

	// ---- the point and its parts ------------------------------------------------------------
	const P = $derived({ x: sx(E.re), y: sy(E.im) });
	const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
	const cosV = $derived(clean(E.re));
	const sinV = $derived(clean(E.im));

	function onmove(p: Point) {
		const raw = reduce(toDeg(Math.atan2(CY - p.y, p.x - CX)));
		const v = Math.round(raw);
		setParam('theta', v === 0 || v === 360 ? (sliderTheta > 180 ? 360 : 0) : v);
	}
	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') return setParam('theta', 0);
		if (k === 'end') return setParam('theta', 360);
		setParam('theta', clamp(sliderTheta + k, 0, 360));
	}

	const arcR = $derived(Math.min(34, 0.45 * U));
	const arcD = $derived.by(() => {
		if (thetaDeg < 0.5) return '';
		if (thetaDeg > 359.5)
			return `M${CX + arcR} ${CY} A${arcR} ${arcR} 0 1 0 ${CX - arcR} ${CY} A${arcR} ${arcR} 0 1 0 ${CX + arcR} ${CY}`;
		const large = thetaDeg > 180 ? 1 : 0;
		return `M${CX + arcR} ${CY} A${arcR} ${arcR} 0 ${large} 0 ${(CX + arcR * Math.cos(th)).toFixed(1)} ${(CY - arcR * Math.sin(th)).toFixed(1)}`;
	});
	// The θ label halfway round the arc, kept off the axes.
	const thetaLabel = $derived.by(() => {
		let m = thetaDeg / 2;
		const axis = Math.round(m / 90) * 90;
		if (axis !== 0 && Math.abs(m - axis) < 14) m = axis - 14;
		const r = toRad(m);
		return { x: CX + (arcR + 16) * Math.cos(r), y: CY - (arcR + 16) * Math.sin(r) + 5 };
	});
	// A trail of the identity sweep: the upper half circle up to θ.
	const sweepD = $derived(
		thetaDeg < 0.5
			? ''
			: `M${CX + U} ${CY} A${U} ${U} 0 0 0 ${(CX + U * Math.cos(th)).toFixed(1)} ${(CY - U * Math.sin(th)).toFixed(1)}`
	);

	// ---- the curves on the right (euler phase) ------------------------------------------------
	const GX = PX + 20;
	const GW = PW - 30;
	const AMP = 58;
	const plots = [
		{ id: 're', y: 210, color: 'var(--cx-re)', f: Math.cos, title: 'real part', fn: 'cos θ' },
		{ id: 'im', y: 420, color: 'var(--cx-im)', f: Math.sin, title: 'imaginary part', fn: 'sin θ' }
	];
	const gx = (deg: number) => GX + (deg / 360) * GW;
	const curve = (f: (x: number) => number, y0: number, upTo: number) => {
		const pts: string[] = [];
		const N = Math.max(2, Math.ceil(upTo / 6));
		for (let k = 0; k <= N; k++) {
			const d = (upTo * k) / N;
			pts.push(`${k ? 'L' : 'M'}${gx(d).toFixed(1)} ${(y0 - AMP * f(toRad(d))).toFixed(1)}`);
		}
		return pts.join(' ');
	};
	const fullCurves = plots.map((p) => curve(p.f, p.y, 360));

	// Inviting pulse on the handle at the start of the step.
	const pulse = $derived(
		reduced || phase === 'identity'
			? 0
			: (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5))
	);
	const thetaText = $derived(
		`θ = ${Math.round(thetaDeg)}° ${radText(Math.round(thetaDeg)).includes('π') || thetaDeg === 0 ? '=' : '≈'} ${radText(Math.round(thetaDeg))} rad`
	);
	// The pill naming the point sits outside the circle.
	// Near the real axis it goes above the axis, clear of the axis labels.
	const pointLabel = $derived({
		x: CX + (U + 34) * Math.cos(th),
		y: CY - (U + 26) * Math.sin(th) + 5 - (Math.abs(Math.sin(th)) < 0.3 ? 16 : 0)
	});
	// The drawn axes: fixed lengths (the circle shrinks inside them when zoomed out).
	const ext = 240;
	// Tick labels hide when the circle gets too small for them.
	const ticks = $derived((1 - w.identity) * smoothstep(60, 90, U));
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

<!-- "e" with a superscript exponent, then the rest: e^(iθ) = … -->
{#snippet ex(
	x: number,
	y: number,
	sup: string,
	rest: string,
	size: number,
	opts: { anchor?: string; color?: string; weight?: number; opacity?: number } = {}
)}
	<text
		{x}
		{y}
		class="halo"
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 600}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}
		>e<tspan dy={-size * 0.42} style:font-size="{Math.round(size * 0.66)}px">{sup}</tspan><tspan
			dy={size * 0.42}>{rest}</tspan
		></text
	>
{/snippet}

<g>
	<!-- axes, ticks and the unit circle -->
	<line x1={CX - ext} x2={CX + ext} y1={CY} y2={CY} stroke="var(--stage-line)" stroke-width="1.5" />
	<line x1={CX} x2={CX} y1={CY - 270} y2={CY + 266} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each [-1, 1] as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={CY - 5} y2={CY + 5} stroke="var(--stage-line)" />
		<line x1={CX - 5} x2={CX + 5} y1={sy(v)} y2={sy(v)} stroke="var(--stage-line)" />
		{@render txt(sx(v) + (v > 0 ? 6 : -6), CY + 18, v > 0 ? '1' : '−1', 12, {
			anchor: v > 0 ? 'start' : 'end',
			muted: true,
			opacity: ticks
		})}
		{@render txt(CX - 8, sy(v) + (v > 0 ? -6 : 16), v > 0 ? 'i' : '−i', 12, {
			anchor: 'end',
			muted: true,
			opacity: ticks
		})}
	{/each}
	{@render txt(CX + ext, CY - 8, 'real', 12, { anchor: 'end', muted: true })}
	{@render txt(CX + 8, CY - 270 + 10, 'imaginary', 12, { muted: true })}
	<circle
		cx={CX}
		cy={CY}
		r={U}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.6"
		opacity="0.6"
	/>

	<!-- ===== euler: the real and imaginary parts as legs ===== -->
	{#if w.euler > 0.01}
		<g opacity={w.euler}>
			<line
				x1={P.x}
				x2={P.x}
				y1={CY}
				y2={P.y}
				stroke="var(--cx-im)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<line
				x1={CX}
				x2={P.x}
				y1={CY}
				y2={CY}
				stroke="var(--cx-re)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			{#if Math.abs(cosV) > 0.15}
				{@render txt((CX + P.x) / 2, CY + (sinV >= 0 ? 22 : -12), 'cos θ', 13, {
					anchor: 'middle',
					weight: 600,
					color: 'var(--cx-re)'
				})}
			{/if}
			{#if Math.abs(sinV) > 0.15}
				{@render txt(P.x + (cosV >= 0 ? 10 : -10), (CY + P.y) / 2 + 5, 'sin θ', 13, {
					anchor: cosV >= 0 ? 'start' : 'end',
					weight: 600,
					color: 'var(--cx-im)'
				})}
			{/if}
		</g>
	{/if}

	<!-- ===== compound: the path of small turns ===== -->
	{#if w.compound > 0.01}
		<g opacity={w.compound}>
			<path
				d={pathD}
				fill="none"
				stroke="var(--cx-prod)"
				stroke-width="2.2"
				stroke-linejoin="round"
			/>
			{#if n <= 40}
				{#each path.slice(1, Math.floor(shown) + 1) as p, k (k)}
					<circle cx={sx(p.re)} cy={sy(p.im)} r="3.2" fill="var(--cx-prod)" />
				{/each}
			{/if}
			<circle cx={sx(1)} cy={CY} r="4" fill="var(--stage-ink)" />
		</g>
	{/if}

	<!-- ===== identity: the half turn ===== -->
	{#if w.identity > 0.01}
		<g opacity={w.identity}>
			<path
				d={sweepD}
				fill="none"
				stroke="var(--explainer-accent)"
				stroke-width="4"
				stroke-linecap="round"
				opacity="0.55"
			/>
			<circle cx={sx(1)} cy={CY} r="5" fill="var(--stage-ink)" />
			{@render ex(sx(1) + 10, CY + 24, 'i·0', ' = 1', 14, {})}
			<g opacity={smoothstep(2.2, 2.5, tt)}>
				{@render ex(sx(-1) - 12, CY + 30, 'iπ', ' = −1', 18, {
					anchor: 'end',
					color: 'var(--explainer-accent)',
					weight: 700
				})}
			</g>
		</g>
	{/if}

	<!-- the radius, the angle, and the point e^(iθ) -->
	<line
		x1={CX}
		y1={CY}
		x2={P.x}
		y2={P.y}
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-linecap="round"
		opacity={1 - 0.5 * w.compound}
	/>
	<path d={arcD} fill="none" stroke="var(--explainer-accent)" stroke-width="2.2" />
	{#if thetaDeg > 18}
		{@render txt(thetaLabel.x, thetaLabel.y, 'θ', 15, {
			anchor: 'middle',
			weight: 700,
			color: 'var(--explainer-accent)'
		})}
	{/if}
	<circle cx={CX} cy={CY} r="3.5" fill="var(--stage-ink)" />
	{#if pulse > 0.01}
		<circle
			cx={P.x}
			cy={P.y}
			r={16 + 10 * pulse}
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="2"
			opacity={0.5 * pulse}
		/>
	{/if}
	{#if phase === 'identity'}
		<circle
			cx={P.x}
			cy={P.y}
			r="9"
			fill="var(--explainer-accent)"
			stroke="var(--stage-bg)"
			stroke-width="2.5"
		/>
	{:else}
		<Handle
			x={P.x}
			y={P.y}
			label="The point e to the i theta"
			value={sliderTheta}
			min={0}
			max={360}
			valuetext="θ = {sliderTheta} degrees, {radText(sliderTheta)} radians"
			{onmove}
			{onkey}
		/>
	{/if}
	{#if w.identity < 0.99}
		{@render ex(pointLabel.x, pointLabel.y, 'iθ', '', 16, {
			anchor: Math.cos(th) >= 0 ? 'start' : 'end',
			color: 'var(--explainer-accent)',
			weight: 700,
			opacity: 1 - w.identity
		})}
	{/if}

	<!-- the end of the compounding path, over the handle (it does not catch the pointer) -->
	{#if w.compound > 0.01}
		<circle
			cx={sx(end.re)}
			cy={sy(end.im)}
			r="7"
			fill="var(--cx-prod)"
			stroke="var(--stage-bg)"
			stroke-width="2"
			opacity={endShown * w.compound}
			pointer-events="none"
		/>
	{/if}

	<!-- ================= the formula, top left ================= -->
	{@render ex(24, 46, 'iθ', ' = cos θ + i sin θ', 22, { weight: 700, opacity: 1 - w.identity })}
	{@render txt(24, 72, thetaText, 13, { muted: true, opacity: 1 - w.identity })}

	<!-- ================= right column ================= -->
	{#if w.euler > 0.01}
		<g opacity={panel(w.euler)}>
			{@render ex(PX, 60, 'iθ', ` = ${num(cosV)} + ${num(sinV)}i`.replace('+ −', '− '), 22, {
				weight: 700
			})}
			{@render txt(PX, 86, 'the point at angle θ on the unit circle', 13, { muted: true })}
			{#each plots as p, k (p.id)}
				{@const v = k === 0 ? cosV : sinV}
				{@render txt(GX - 20, p.y - AMP - 22, `${p.title} = ${p.fn} = ${num(v)}`, 14, {
					weight: 600,
					color: p.color
				})}
				<line x1={GX} x2={GX + GW} y1={p.y} y2={p.y} stroke="var(--stage-line)" />
				<line x1={GX} x2={GX} y1={p.y - AMP - 6} y2={p.y + AMP + 6} stroke="var(--stage-line)" />
				{#each [1, -1] as s (s)}
					<line
						x1={GX}
						x2={GX + GW}
						y1={p.y - s * AMP}
						y2={p.y - s * AMP}
						stroke="var(--stage-grid)"
					/>
					{@render txt(GX - 6, p.y - s * AMP + 4, s > 0 ? '1' : '−1', 11, {
						anchor: 'end',
						muted: true
					})}
				{/each}
				{#each [90, 180, 270, 360] as d (d)}
					<line x1={gx(d)} x2={gx(d)} y1={p.y - 4} y2={p.y + 4} stroke="var(--stage-line)" />
					{@render txt(gx(d), p.y + AMP + 20, radText(d), 11, { anchor: 'middle', muted: true })}
				{/each}
				<path d={fullCurves[k]} fill="none" stroke={p.color} stroke-width="1.5" opacity="0.3" />
				<path d={curve(p.f, p.y, thetaDeg)} fill="none" stroke={p.color} stroke-width="2.6" />
				<line
					x1={gx(thetaDeg)}
					x2={gx(thetaDeg)}
					y1={p.y}
					y2={p.y - AMP * v}
					stroke={p.color}
					stroke-width="3"
					opacity="0.5"
				/>
				<circle
					cx={gx(thetaDeg)}
					cy={p.y - AMP * v}
					r="5.5"
					fill={p.color}
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
			{/each}
			{@render txt(GX + GW, 420 + AMP + 40, 'θ in radians', 11, { anchor: 'end', muted: true })}
		</g>
	{/if}

	{#if w.compound > 0.01}
		<g opacity={panel(w.compound)}>
			{@render txt(PX, 60, `(1 + iθ/n)ⁿ  with  n = ${n}`, 22, {
				weight: 700,
				color: 'var(--cx-prod)'
			})}
			{@render txt(PX, 86, 'n small steps, each one a tiny turn', 13, { muted: true })}

			{@render txt(PX, 136, 'each step multiplies by', 13, { muted: true })}
			{@render txt(PX, 162, `1 + iθ/n = ${fmt(stepZ, 3)}`, 17, { weight: 600 })}
			{@render txt(
				PX,
				186,
				`a turn of ${num(arg(stepZ), 1)}°, a stretch of ${num(abs(stepZ), 3)}`,
				13,
				{ muted: true }
			)}

			{@render txt(PX, 240, `after ${n} step${n === 1 ? '' : 's'}`, 13, { muted: true })}
			{@render txt(PX, 266, `(1 + iθ/n)ⁿ ≈ ${fmt(end)}`, 17, {
				weight: 700,
				color: 'var(--cx-prod)'
			})}
			{@render txt(PX, 290, `length ${num(abs(end))}, angle ${num(reduce(arg(end)), 1)}°`, 13, {
				muted: true
			})}

			{@render txt(PX, 344, 'the point at angle θ', 13, { muted: true })}
			{@render ex(PX, 370, 'iθ', ` ≈ ${fmt(E)}`, 17, {
				color: 'var(--explainer-accent)',
				weight: 700
			})}

			{@render txt(PX, 424, 'distance still to go', 13, { muted: true })}
			{@render txt(PX, 450, num(gap, 3), 17, { weight: 700 })}
			<rect x={PX} y={466} width={PW - 20} height="10" rx="5" fill="var(--stage-grid)" />
			<rect
				x={PX}
				y={466}
				width={(PW - 20) * clamp(gap / 3.5)}
				height="10"
				rx="5"
				fill="var(--cx-prod)"
			/>
			{@render txt(PX, 508, 'More steps: the path hugs the circle', 13)}
			{@render txt(PX, 528, 'and the gap shrinks towards 0.', 13)}
		</g>
	{/if}

	{#if w.identity > 0.01}
		<g opacity={panel(w.identity)}>
			{@render ex(PX, 74, 'iπ', ' = −1', 34, { weight: 700, color: 'var(--explainer-accent)' })}
			{@render ex(PX, 116, 'iπ', ' + 1 = 0', 20, { weight: 600 })}
			{@render txt(PX, 140, 'half a turn round the unit circle', 13, { muted: true })}

			<line x1={PX} x2={PX + PW - 20} y1={176} y2={176} stroke="var(--border)" />
			{@render txt(PX, 210, 'Angles add when you multiply:', 14, { weight: 600 })}
			<text x={PX} y={242} class="halo" font-weight="600" style:font-size="17px"
				>e<tspan dy="-7" style:font-size="11px">iα</tspan><tspan dy="7">&nbsp;·&nbsp;e</tspan><tspan
					dy="-7"
					style:font-size="11px">iβ</tspan
				><tspan dy="7">&nbsp;=&nbsp;e</tspan><tspan dy="-7" style:font-size="11px">i(α + β)</tspan
				></text
			>

			<line x1={PX} x2={PX + PW - 20} y1={280} y2={280} stroke="var(--border)" />
			{@render txt(PX, 316, 'The takeaway', 14, { weight: 700 })}
			{@render txt(PX, 344, 'Multiplying by a complex number', 14)}
			{@render txt(PX, 366, 'turns by its angle and stretches', 14)}
			{@render txt(PX, 388, 'by its length.', 14)}
			{@render ex(PX, 428, 'iθ', ' is the point at angle θ', 14, { weight: 500 })}
			{@render txt(PX, 450, 'on the unit circle: (cos θ, sin θ).', 14)}
		</g>
	{/if}
</g>
