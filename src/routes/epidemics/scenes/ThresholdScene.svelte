<script lang="ts">
	/**
	 * The herd-immunity threshold: R₀ across, the immune share up, and the
	 * curve 1 − 1/R₀ between "an outbreak can grow" (below) and "outbreaks die
	 * out" (above). The point is the sliders' (R₀, vaccinated); the panel on the
	 * right reads it out: the threshold for that R₀, the effective reproduction
	 * number R = R₀ × (1 − v), and how many would be infected if an outbreak
	 * took off (final-size equation).
	 *
	 * X axis: linear, 0–10. The slider (0.5–8) then gets three quarters of the
	 * width, and the text's "90% for 10" lands on the end of the axis. A linear
	 * axis to 20 would squeeze the whole slider range (and seasonal flu, at
	 * 1.3) against the y axis just to fit measles, so measles (R₀ often quoted
	 * 12–18, threshold 92–94%) is shown as a bracket just past the end of the
	 * axis, marked as off the axis.
	 *
	 * Motion: the curve draws itself in over the first ~1.6 s and the regions
	 * fade in after it (pure functions of `t`, complete by 2.2 s, so the
	 * reduced-motion frame at 2.5 s is whole); the point glides with two
	 * `Tween.of` (one per slider) and pulses gently. Every readout comes from
	 * the tweened values, so the numbers never disagree with the point.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		areaPath,
		clamp,
		cycle,
		easeInOut,
		linePath,
		scale,
		smoothstep
	} from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { effectiveR, finalSize, herdThreshold } from '../model';
	import { settings } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const opts = $derived(settings(step, params));

	// ---- the point, smoothed -----------------------------------------------------
	const GLIDE = { duration: 800, easing: cubicInOut };
	const r0Tween = Tween.of(() => opts.r0, GLIDE);
	const vTween = Tween.of(() => opts.vaccinated, GLIDE);
	const r0 = $derived(reduced ? opts.r0 : r0Tween.current);
	const v = $derived(reduced ? opts.vaccinated : vTween.current);

	const threshold = $derived(herdThreshold(r0));
	const rEff = $derived(effectiveR(r0, 1 - v));
	/** One predicate for the colour, the verdict and the outbreak size. */
	const grows = $derived(rEff > 1 + 1e-9);
	const size = $derived(grows ? finalSize(r0, v) : 0);

	// ---- the chart ---------------------------------------------------------------
	const X0 = 92;
	const X1 = 596;
	const Y0 = 500; // 0% immune
	const Y1 = 124; // 100% immune
	const R_MAX = 10;
	const sx = scale([0, R_MAX], [X0, X1]);
	const sy = scale([0, 1], [Y0, Y1]);

	/** The threshold curve, sampled densely where it bends (R₀ 1–2). */
	const curve = [
		0,
		1,
		...Array.from({ length: 40 }, (_, k) => 1 + (k + 1) * 0.025),
		...Array.from({ length: 80 }, (_, k) => 2 + (k + 1) * 0.1)
	].map((r) => ({ r, h: herdThreshold(r) }));
	const curvePath = linePath(
		curve,
		(d) => d.r,
		(d) => d.h,
		sx,
		sy
	);
	const above = areaPath(
		curve,
		(d) => d.r,
		(d) => d.h,
		() => 1,
		sx,
		sy
	);
	const below = areaPath(
		curve,
		(d) => d.r,
		() => 0,
		(d) => d.h,
		sx,
		sy
	);

	const draw = $derived(reduced ? 1 : easeInOut(smoothstep(0.2, 1.6, t)));
	const shade = $derived(reduced ? 1 : smoothstep(0.9, 1.8, t));
	const notes = $derived(reduced ? 1 : smoothstep(1.4, 2.2, t));

	const px = $derived(sx(r0));
	const py = $derived(sy(v));
	const pointColor = $derived(grows ? 'var(--sir-i)' : 'var(--sir-v)');
	const pulse = $derived(cycle(t, 2.4));

	/** Distance in drawing units from the point to a box (0 inside it). */
	function gap(box: { x: number; y: number; w: number; h: number }) {
		const dx = Math.max(box.x - px, 0, px - (box.x + box.w));
		const dy = Math.max(box.y - py, 0, py - (box.y + box.h));
		return Math.hypot(dx, dy);
	}
	/** Labels the point can reach step aside: they fade while it is close. */
	const proximity = (box: { x: number; y: number; w: number; h: number }) =>
		0.15 + 0.85 * smoothstep(8, 28, gap(box));

	// Region label in the top-left (always above the curve).
	const dieOut = { x: sx(0.3), y: sy(0.88) };
	const dieOutBox = { x: dieOut.x - 4, y: dieOut.y - 14, w: 136, h: 20 };
	// Labels in the column past R₀ = 8, which the point only grazes.
	const LX = X1 - 6;
	const growY = sy(0.34);
	const growBox = { x: LX - 80, y: growY - 14, w: 80, h: 36 };
	const curveY = sy(0.77);
	const curveBox = { x: LX - 90, y: curveY - 12, w: 90, h: 32 };

	// Seasonal flu, R₀ ≈ 1.3: a ring on the curve with a leader to its label,
	// which moves up if the point is on it.
	const FLU = 1.3;
	const flu = { x: sx(FLU), y: sy(herdThreshold(FLU)) };
	const fluSpots = [
		{ x: sx(2.3), y: sy(0.1) },
		{ x: sx(2.3), y: sy(0.32) }
	];
	const fluLabel = $derived(
		gap({ x: fluSpots[0].x - 6, y: fluSpots[0].y - 26, w: 136, h: 34 }) > 14
			? fluSpots[0]
			: fluSpots[1]
	);

	// Measles: 12–18, off the end of the axis.
	const MX = X1 + 20;
	const measlesLo = sy(herdThreshold(12));
	const measlesHi = sy(herdThreshold(18));

	// ---- readouts ----------------------------------------------------------------
	const pct = (x: number) => `${Math.round(100 * x)}%`;
	/** A share of people, never rounded to 0% or 100% when it is not. */
	function share(x: number) {
		const p = 100 * x;
		if (p > 0 && Math.round(p) === 0) return '<1%';
		if (p < 100 && Math.round(p) === 100) return '>99%';
		return `${Math.round(p)}%`;
	}
	/** The threshold, with a decimal when rounding would blur it against v. */
	const thresholdText = $derived.by(() => {
		const p = 100 * threshold;
		const close = Math.abs(p - 100 * v) < 1.5 && Math.abs(p - Math.round(p)) > 0.05;
		return close ? `${p.toFixed(1)}%` : `${Math.round(p)}%`;
	});
	/**
	 * R, never rounded onto or across 1 (near 1 it is rounded away from it) and
	 * never onto 0 (small values keep two decimals). Rounded to hundredths
	 * first, so that 3.5 × 30% (1.0500…03 in floating point) reads 1.05.
	 */
	const rText = $derived.by(() => {
		const d = Math.abs(rEff - 1);
		if (d <= 1e-9) return '1.0';
		if (d >= 0.06 && rEff >= 0.095) return rEff.toFixed(1);
		let r2 = Math.round(rEff * 100) / 100;
		if (r2 === 1) r2 = grows ? 1.01 : 0.99;
		return r2 === 0 ? '<0.01' : r2.toFixed(2);
	});
	const verdict = $derived(
		grows
			? 'above 1: an outbreak can grow'
			: rEff > 1 - 1e-9
				? 'exactly 1: an outbreak cannot grow'
				: 'below 1: chains of infection die out'
	);

	/**
	 * Below 1, the chain from one case is finite: on average 1 / (1 − R) cases
	 * in all, counting the first (a branching process; the text of the
	 * vaccination step promises "a handful … sometimes a few dozen").
	 */
	const chainText = $derived.by(() => {
		if (rEff > 1 - 1e-9) return 'chains of infection die out, but can run long';
		const n = 1 / (1 - rEff);
		return n < 1.5
			? 'the first case rarely infects anyone'
			: `one case leads to about ${Math.round(n)} cases in all`;
	});

	const PX0 = 676;
	const PX1 = 944;
	const GAUGE = 8;
	const gx = scale([0, GAUGE], [PX0, PX1]);

	// 100 people, row by row: vaccinated, then those an outbreak would reach,
	// then those who escape it. The three counts always add up to 100.
	// Nobody is drawn as escaping only if nobody does: when a few in 1,000
	// escape (R₀ = 8, nobody vaccinated), one dot stays blue, as ">99%" says.
	const nv = $derived(Math.round(100 * v));
	const ni = $derived(
		Math.min(100 - nv - (grows && 1 - v - size > 1e-6 ? 1 : 0), Math.round(100 * size))
	);
	const ne = $derived(100 - nv - ni);
	const CELL = 15;
	const GX = PX0 + 7;
	const GY = 368;
	const people = Array.from({ length: 100 }, (_, k) => ({
		k,
		x: GX + (k % 10) * CELL,
		y: GY + Math.floor(k / 10) * CELL
	}));
	const legend = $derived([
		{ id: 'v', n: nv, label: 'vaccinated', color: 'var(--sir-v)' },
		{ id: 'i', n: ni, label: 'catch it', color: 'var(--sir-i)' },
		{ id: 's', n: ne, label: 'escape it', color: 'var(--sir-s)' }
	]);
</script>

<!--
	The stage's CSS sets fill and font-size on every <text>, which beats SVG
	presentation attributes, so text here sets both through `style:` (the
	attributes are kept so that the drawing reads the same without that CSS).
-->
{#snippet say(
	x: number,
	y: number,
	text: string,
	size: number,
	o: {
		color?: string;
		anchor?: 'start' | 'middle' | 'end';
		weight?: number;
		muted?: boolean;
		halo?: boolean;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={o.halo ?? true}
		class:muted={o.muted}
		text-anchor={o.anchor ?? 'start'}
		font-size={size}
		font-weight={o.weight ?? 400}
		style:font-size="{size}px"
		style:fill={o.color}
		style:pointer-events="none">{text}</text
	>
{/snippet}

<g style:font-variant-numeric="tabular-nums">
	<!-- title -->
	{@render say(X0, 56, 'The herd-immunity threshold', 16, { weight: 600 })}
	{@render say(X0, 78, 'An outbreak cannot grow once the immune share is above 1 − 1/R₀', 12, {
		muted: true
	})}

	<!-- regions -->
	<g opacity={shade}>
		<path d={above} fill="var(--sir-v)" opacity="0.1" />
		<path d={below} fill="var(--sir-i)" opacity="0.08" />
	</g>

	<Axes
		{sx}
		{sy}
		xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
		yFormat={(y) => pct(y)}
		xLabel="R₀: people each case infects when nobody is immune"
		yLabel="immune share (vaccinated)"
	/>

	<!-- region labels -->
	<g opacity={shade}>
		<g opacity={proximity(dieOutBox)}>
			{@render say(dieOut.x, dieOut.y, 'outbreaks die out', 13, {
				weight: 600,
				color: 'var(--sir-v)'
			})}
		</g>
		<g opacity={proximity(growBox)}>
			{@render say(LX, growY, 'an outbreak', 13, {
				weight: 600,
				anchor: 'end',
				color: 'var(--sir-i)'
			})}
			{@render say(LX, growY + 17, 'can grow', 13, {
				weight: 600,
				anchor: 'end',
				color: 'var(--sir-i)'
			})}
		</g>
		<g opacity={proximity(curveBox)}>
			{@render say(LX, curveY, 'herd-immunity', 12, { anchor: 'end' })}
			{@render say(LX, curveY + 15, 'threshold', 12, { anchor: 'end' })}
		</g>
	</g>

	<!-- the threshold curve, drawing itself in -->
	<path
		d={curvePath}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2.6"
		stroke-linejoin="round"
		stroke-linecap="round"
		pathLength="1"
		stroke-dasharray="1 1"
		stroke-dashoffset={1 - draw}
	/>

	<!-- reference diseases (the two figures quoted in the notes) -->
	<g opacity={notes}>
		<line
			x1={flu.x + 4}
			y1={flu.y + 2}
			x2={fluLabel.x - 5}
			y2={fluLabel.y - 4}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<circle
			cx={flu.x}
			cy={flu.y}
			r="4"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		{@render say(fluLabel.x, fluLabel.y, 'seasonal flu, about 1.3', 12)}
		{@render say(fluLabel.x, fluLabel.y + 15, `threshold ${pct(herdThreshold(FLU))}`, 11, {
			muted: true
		})}

		<!-- measles: past the end of the axis -->
		<line
			x1={X1}
			y1={sy(0.9)}
			x2={MX - 5}
			y2={(measlesLo + measlesHi) / 2}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="2 3"
		/>
		<path
			d="M{MX - 4} {measlesLo}H{MX + 4}M{MX} {measlesLo}V{measlesHi}M{MX - 4} {measlesHi}H{MX + 4}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<line
			x1={MX}
			y1={measlesHi - 4}
			x2={MX}
			y2={Y1 - 22}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		{@render say(MX + 6, Y1 - 26, 'measles (R₀ often 12–18, off the axis): 92–94%', 12, {
			anchor: 'end'
		})}
	</g>

	<!-- the current point, and the threshold for its R₀ on the curve -->
	<g opacity={shade}>
		<circle
			cx={px}
			cy={sy(threshold)}
			r="3.5"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
	</g>
	{#if !reduced}
		<circle
			cx={px}
			cy={py}
			r={9 + 8 * pulse}
			fill="none"
			stroke={pointColor}
			stroke-width="1.5"
			opacity={0.45 * (1 - pulse)}
		/>
	{/if}
	<circle cx={px} cy={py} r="8" fill={pointColor} stroke="var(--stage-bg)" stroke-width="2" />

	<!-- readouts -->
	{@render say(PX0, 130, `Threshold for R₀ = ${r0.toFixed(1)}`, 12, { muted: true, halo: false })}
	{@render say(PX0, 160, `${thresholdText} immune`, 26, {
		weight: 600,
		color: 'var(--sir-v)',
		halo: false
	})}
	{@render say(
		PX0,
		180,
		r0 > 1 + 1e-9 ? `1 − 1/R₀ = 1 − 1/${r0.toFixed(1)}` : 'R₀ of 1 or less: no immunity needed',
		11,
		{ muted: true, halo: false }
	)}

	{@render say(PX0, 222, 'Each case now infects', 13, { weight: 600, halo: false })}
	{@render say(PX1, 222, `${rText} people`, 13, {
		weight: 600,
		anchor: 'end',
		color: pointColor,
		halo: false
	})}
	<rect x={PX0} y={234} width={PX1 - PX0} height="10" rx="5" fill="var(--stage-grid)" />
	<rect
		x={PX0}
		y={234}
		width={Math.max(0, gx(clamp(rEff, 0, GAUGE)) - PX0)}
		height="10"
		rx="5"
		fill={pointColor}
	/>
	<line x1={gx(1)} x2={gx(1)} y1={228} y2={250} stroke="var(--stage-ink)" stroke-width="1.5" />
	{@render say(gx(1), 264, '1', 11, { anchor: 'middle', muted: true, halo: false })}
	{@render say(
		PX0,
		286,
		`R = ${r0.toFixed(1)} × ${Math.round(100 * (1 - v))}% not immune = ${rText}`,
		12,
		{ halo: false }
	)}
	{@render say(PX0, 304, verdict, 12, { weight: 600, color: pointColor, halo: false })}

	<!-- 100 people -->
	{@render say(PX0, 340, grows ? 'If an outbreak takes off' : 'If a case arrives', 13, {
		weight: 600,
		halo: false
	})}
	{@render say(
		PX0,
		356,
		grows
			? v < 0.005
				? `${share(size)} of everyone`
				: `${share(size)} of everyone, ${share(size / (1 - v))} of the unvaccinated`
			: chainText,
		11,
		{ muted: true, halo: false }
	)}
	{#each people as p (p.k)}
		{#if p.k < nv}
			<circle cx={p.x} cy={p.y} r="4.3" fill="none" stroke="var(--sir-v)" stroke-width="2" />
		{:else if p.k < nv + ni}
			<circle cx={p.x} cy={p.y} r="5" fill="var(--sir-i)" />
		{:else}
			<circle cx={p.x} cy={p.y} r="5" fill="var(--sir-s)" />
		{/if}
	{/each}
	{#each legend as item, i (item.id)}
		{@const ly = GY + 8 + i * 26}
		{@const lx = GX + 10 * CELL + 12}
		{#if item.id === 'v'}
			<circle cx={lx + 5} cy={ly - 4} r="4.3" fill="none" stroke={item.color} stroke-width="2" />
		{:else}
			<circle cx={lx + 5} cy={ly - 4} r="5" fill={item.color} />
		{/if}
		{@render say(lx + 15, ly, `${item.n} ${item.label}`, 12, { halo: false })}
	{/each}
	{@render say(GX - 5, GY + 10 * CELL + 8, 'out of 100 people', 11, { muted: true, halo: false })}
</g>
