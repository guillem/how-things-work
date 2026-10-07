<script lang="ts">
	/**
	 * The deterministic SIR model: three boxes and the curves they trace.
	 *
	 * Phases (`step.hints.phase`):
	 *   boxes — S → I → R boxes filling and emptying, with the two flows drawn
	 *           as arrows (thickness and dot speed ∝ the current flow), and a
	 *           compact S/I/R chart below
	 *   peak  — the S/I/R chart with the 1/R₀ line, and a chart of the
	 *           effective reproduction number R = R₀ × S/N below it; R crosses
	 *           1 exactly at the peak of I
	 *   final — the end state: the overshoot (people infected after the peak)
	 *           shaded between 1/R₀ and the S curve, and the three shares that
	 *           add up to everyone
	 *
	 * The equations are solved once per (R₀, D) as shares of the population,
	 * from a 0.1 % seed. A cursor sweeps the whole epidemic in SWEEP seconds
	 * (a pure function of t) and then holds the finished picture. The dots on
	 * the arrows sit at the integral of the flow (people moved so far), which
	 * the solution gives directly: S₀ − S for infection, R for recovery.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Label,
		areaPath,
		clamp,
		lerp,
		linePath,
		niceMax,
		scale,
		smoothstep,
		thin,
		ticks
	} from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { effectiveR, finalSize, solveSir, type Sample } from '../model';
	import { settings } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const SEED = 0.001; // share infectious at day 0
	const LEAD = 0.8; // seconds before the cursor starts
	const SWEEP = 13; // seconds for the cursor to cross the whole epidemic

	type Phase = 'boxes' | 'peak' | 'final';
	const phase = $derived(String(step.hints?.phase ?? 'boxes') as Phase);
	const opts = $derived(settings(step, params));
	const r0 = $derived(opts.r0);
	const D = $derived(opts.days);

	// ---- the solution (recomputed only when R₀ or D change) -------------------
	const run = $derived.by(() => {
		const dt = D / 70;
		const raw = solveSir({ r0, days: D, vaccinated: 0, population: 1, initial: SEED }, D * 90, dt);
		let pk = 0;
		for (let k = 1; k < raw.length; k++) if (raw[k].i > raw[pk].i) pk = k;
		// The epidemic is over once I has fallen below 1 % of its peak.
		let end = Math.min(raw.length - 1, Math.round((10 * D) / dt));
		if (r0 > 1) {
			end = raw.length - 1;
			for (let k = pk; k < raw.length; k++)
				if (raw[k].i < 0.01 * raw[pk].i) {
					end = k;
					break;
				}
		}
		const tk = ticks(0, raw[end].day, 5);
		const stepT = tk.length > 1 ? tk[1] - tk[0] : 10;
		const xMax = Math.ceil(raw[end].day / stepT - 1e-9) * stepT;
		const sol = raw.slice(0, Math.min(raw.length, Math.round(xMax / dt) + 2));

		// Peak = the day S crosses 1/R₀ (where dI/dt = 0), interpolated.
		let peakDay = NaN;
		let peakI = 0;
		if (r0 > 1) {
			const th = 1 / r0;
			for (let k = 0; k < sol.length - 1; k++) {
				if (sol[k].s >= th && sol[k + 1].s < th) {
					const f = (sol[k].s - th) / (sol[k].s - sol[k + 1].s);
					peakDay = lerp(sol[k].day, sol[k + 1].day, f);
					peakI = lerp(sol[k].i, sol[k + 1].i, f);
					break;
				}
			}
		}
		// Largest flow, for the arrow thickness and dot speed (with a floor so
		// that a dying-out seed does not look like a full-blown flow).
		let maxFlow = 0.01 / D;
		for (const p of sol) maxFlow = Math.max(maxFlow, (r0 / D) * p.s * p.i, p.i / D);

		return { dt, sol, pts: thin(sol, 320), xMax, peakDay, peakI, maxFlow };
	});
	const outbreak = $derived(Number.isFinite(run.peakDay));

	// Final shares from the final-size equation, rounded so that they add up.
	const shares = $derived.by(() => {
		if (!outbreak) return { sInf: 1, byPeak: 0, after: 0, never: 100, a: 0, b: 0 };
		const sInf = 1 - finalSize(r0);
		const a = Math.round(100 * (1 - 1 / r0));
		const never = Math.round(100 * sInf);
		return { sInf, byPeak: 1 - 1 / r0, after: 1 / r0 - sInf, never, a, b: 100 - a - never };
	});

	// ---- the cursor --------------------------------------------------------------
	const u = $derived(reduced ? 1 : clamp((t - LEAD) / SWEEP));
	const day = $derived(u * run.xMax);
	function at(d: number): Sample {
		const { sol, dt } = run;
		const x = clamp(d / dt, 0, sol.length - 1);
		const k = Math.min(sol.length - 2, Math.floor(x));
		const f = x - k;
		const a = sol[k];
		const b = sol[k + 1];
		return {
			day: d,
			s: lerp(a.s, b.s, f),
			i: lerp(a.i, b.i, f),
			r: lerp(a.r, b.r, f),
			v: 0
		};
	}
	const now = $derived(at(day));
	const shown = $derived.by(() => {
		const out: Sample[] = [];
		for (const p of run.pts) {
			if (p.day >= day) break;
			out.push(p);
		}
		out.push(now);
		return out;
	});

	// ---- layout per phase, tweened between steps ---------------------------------
	const weightsOf = (p: Phase) => ({
		b: p === 'boxes' ? 1 : 0,
		p: p === 'peak' ? 1 : 0,
		f: p === 'final' ? 1 : 0
	});
	const w = new Tween(
		untrack(() => weightsOf(phase)),
		{ duration: 800, easing: cubicInOut }
	);
	$effect(() => {
		const target = weightsOf(phase);
		const duration = untrack(() => (reduced ? 0 : 800));
		untrack(() => w.set(target, { duration }));
	});
	const rects = {
		boxes: { x0: 90, x1: 900, y0: 410, y1: 522 },
		peak: { x0: 90, x1: 900, y0: 100, y1: 262 },
		final: { x0: 90, x1: 600, y0: 100, y1: 430 }
	};
	const mix = (k: 'x0' | 'x1' | 'y0' | 'y1') =>
		w.current.b * rects.boxes[k] + w.current.p * rects.peak[k] + w.current.f * rects.final[k];
	const box = $derived({ x0: mix('x0'), x1: mix('x1'), y0: mix('y0'), y1: mix('y1') });
	/**
	 * Opacity of a phase's own layer from its weight: the outgoing layer is gone
	 * before the incoming one appears (and before the moving chart reaches it),
	 * so the two never overlap mid-transition.
	 */
	const fade = (v: number) => smoothstep(0.8, 1, v);
	const fb = $derived(fade(w.current.b));
	const fp = $derived(fade(w.current.p));
	const ff = $derived(fade(w.current.f));
	/** Layers shared by the peak and final phases. */
	const fChart = $derived(fade(1 - w.current.b));
	/** The settings readout, shared by the boxes and final phases. */
	const fNotPeak = $derived(fade(1 - w.current.p));
	const sx = $derived(scale([0, run.xMax], [box.x0, box.x1]));
	const sy = $derived(scale([0, 1], [box.y1, box.y0]));
	const pct = (v: number) => `${Math.round(v * 100)}%`;
	const fmtDay = (v: number) => Math.floor(v).toLocaleString('en-US');
	const fmt = (v: number) => {
		const p = 100 * Math.max(0, v);
		if (p > 0.0005 && p < 0.05) return '<0.1%';
		return `${p < 9.95 && p >= 0.05 ? p.toFixed(1) : Math.round(p)}%`;
	};

	const curves = $derived([
		{
			id: 'r',
			color: 'var(--sir-r)',
			width: 2,
			opacity: 1 - 0.55 * w.current.f,
			d: linePath(
				shown,
				(p) => p.day,
				(p) => p.r,
				sx,
				sy
			),
			head: now.r
		},
		{
			id: 's',
			color: 'var(--sir-s)',
			width: 2.4,
			opacity: 1,
			d: linePath(
				shown,
				(p) => p.day,
				(p) => p.s,
				sx,
				sy
			),
			head: now.s
		},
		{
			id: 'i',
			color: 'var(--sir-i)',
			width: 2.6,
			opacity: 1,
			d: linePath(
				shown,
				(p) => p.day,
				(p) => p.i,
				sx,
				sy
			),
			head: now.i
		}
	]);
	const legend = [
		{ id: 's', label: 'Susceptible', color: 'var(--sir-s)' },
		{ id: 'i', label: 'Infectious', color: 'var(--sir-i)' },
		{ id: 'r', label: 'Recovered', color: 'var(--sir-r)' }
	];
	const peakDayText = $derived(
		run.peakDay < 10 ? run.peakDay.toFixed(1) : String(Math.round(run.peakDay))
	);
	const reached = $derived(outbreak && day >= run.peakDay);
	const peakShow = $derived(
		outbreak ? (reduced ? 1 : smoothstep(0, 0.6, day - run.peakDay) || 0) : 0
	);

	// ---- boxes phase ---------------------------------------------------------------
	const BY0 = 112;
	const BY1 = 292;
	const BH = BY1 - BY0;
	const BW = 200;
	const MY = (BY0 + BY1) / 2;
	const boxes = $derived([
		{
			id: 's',
			x: 56,
			name: 'Susceptible',
			sub: 'can catch it',
			v: now.s,
			color: 'var(--sir-s)'
		},
		{
			id: 'i',
			x: 380,
			name: 'Infectious',
			sub: 'can pass it on',
			v: now.i,
			color: 'var(--sir-i)'
		},
		{ id: 'r', x: 704, name: 'Recovered', sub: 'immune', v: now.r, color: 'var(--sir-r)' }
	]);
	const infFlow = $derived((r0 / D) * now.s * now.i);
	const recFlow = $derived(now.i / D);
	const SPACING = 20;
	const MAX_SPEED = 80; // px/s of the dots at the largest flow
	// People per dot, so that the fastest flow moves the dots at MAX_SPEED.
	const unit = $derived((run.maxFlow * (run.xMax / SWEEP) * SPACING) / MAX_SPEED);
	const fmtRate = (v: number) => {
		const p = 100 * v;
		if (p < 0.005) return 'under 0.01% a day';
		return `${p < 0.995 ? p.toFixed(2) : p < 9.95 ? p.toFixed(1) : Math.round(p)}% a day`;
	};
	const arrows = $derived([
		{
			id: 'inf',
			x0: 56 + BW + 8,
			x1: 380 - 8,
			flow: infFlow,
			moved: run.sol[0].s - now.s,
			color: 'var(--sir-i)',
			name: 'infection',
			formula: 'β · S · I / N',
			formula2: `β = R₀/D = ${(r0 / D).toFixed(2)}`
		},
		{
			id: 'rec',
			x0: 380 + BW + 8,
			x1: 704 - 8,
			flow: recFlow,
			moved: now.r,
			color: 'var(--sir-r)',
			name: 'recovery',
			formula: `I / D, D = ${D} days`,
			formula2: ''
		}
	]);
	const arrowGeom = $derived(
		arrows.map((a) => {
			const rel = clamp(a.flow / run.maxFlow);
			const h = 3 + 21 * rel;
			const hl = 12;
			const hw = h / 2 + 6;
			const poly = [
				[a.x0, MY - h / 2],
				[a.x1 - hl, MY - h / 2],
				[a.x1 - hl, MY - hw],
				[a.x1, MY],
				[a.x1 - hl, MY + hw],
				[a.x1 - hl, MY + h / 2],
				[a.x0, MY + h / 2]
			]
				.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
				.join(' ');
			const active = smoothstep(0.01, 0.08, rel);
			const phaseU = a.moved / unit;
			const frac = phaseU - Math.floor(phaseU);
			const len = a.x1 - a.x0 - 4;
			const n = Math.ceil(len / SPACING) + 1;
			const dots = Array.from({ length: n }, (_, k) => {
				const x = a.x0 + (k + frac) * SPACING;
				const o =
					active * smoothstep(a.x0, a.x0 + 12, x) * (1 - smoothstep(a.x1 - 22, a.x1 - 8, x));
				return { k, x, o };
			}).filter((d) => d.x <= a.x1 - 8);
			return { ...a, poly, dots };
		})
	);
	const status = $derived.by(() => {
		if (!outbreak)
			return {
				text: 'No outbreak: R₀ ≤ 1, so recoveries outpace infections from the start',
				color: 'var(--sir-s)'
			};
		if (u >= 1 || (day > run.peakDay && now.i < 0.02 * run.peakI))
			return {
				text: `Over. Infections outpaced recoveries until the peak on day ${peakDayText}; ${fmt(now.s)} never caught it`,
				color: 'var(--stage-ink)'
			};
		return infFlow > recFlow
			? {
					text: 'Infections outpace recoveries: the Infectious box fills',
					color: 'var(--sir-i)'
				}
			: {
					text: `Recoveries outpace infections: with under ${fmt(1 / r0)} still susceptible, too few are left to infect`,
					color: 'var(--sir-s)'
				};
	});

	// ---- peak phase: the effective reproduction number -----------------------------
	const RY0 = 356;
	const RY1 = 500;
	const rMax = $derived(Math.max(2, niceMax(r0)));
	const syR = $derived(scale([0, rMax], [RY1, RY0]));
	const rNow = $derived(effectiveR(r0, now.s));
	const rLines = $derived.by(() => {
		const toR = (p: Sample) => effectiveR(r0, p.s);
		if (!outbreak)
			return {
				above: '',
				below: linePath(shown, (p) => p.day, toR, sx, syR)
			};
		const cross: Sample = { day: run.peakDay, s: 1 / r0, i: run.peakI, r: 0, v: 0 };
		const before = shown.filter((p) => p.day < run.peakDay);
		const after = shown.filter((p) => p.day > run.peakDay);
		const above = reached ? [...before, cross] : before;
		const below = reached ? [cross, ...after] : [];
		return {
			above: linePath(above, (p) => p.day, toR, sx, syR),
			below: linePath(below, (p) => p.day, toR, sx, syR)
		};
	});

	// ---- final phase: overshoot ------------------------------------------------------
	const overshoot = $derived.by(() => {
		if (!reached) return '';
		const cross: Sample = { day: run.peakDay, s: 1 / r0, i: run.peakI, r: 0, v: 0 };
		const data = [cross, ...shown.filter((p) => p.day > run.peakDay)];
		return areaPath(
			data,
			(p) => p.day,
			(p) => p.s,
			() => 1 / r0,
			sx,
			sy
		);
	});
	const neverText = $derived(shares.never < 1 ? 'under 1%' : `${shares.never}%`);
	/** 1/R₀ as shown next to the shares, rounded so that the column adds up. */
	const thText = $derived(`${100 - shares.a}%`);
	// The column builds up with the sweep: the share infected by the peak once
	// the peak is passed, the rest once the epidemic is over; dimmed until then.
	const revealA = $derived(reduced ? 1 : peakShow);
	const revealEnd = $derived(reduced ? 1 : smoothstep(0.7, 0.92, u));
	const dimmed = (v: number) => 0.3 + 0.7 * v;
	const BAR_X = 626;
	const BAR_W = 16;
	const LX = BAR_X + BAR_W + 22;
	const column = $derived.by(() => {
		const y0 = rects.final.y0;
		const y1 = rects.final.y1;
		const fy = scale([0, 1], [y1, y0]);
		const segs = outbreak
			? [
					{
						id: 'a',
						top: 1,
						bottom: 1 / r0,
						value: shares.a,
						line1: 'infected by the peak',
						line2: 'above the dashed 1/R₀ line',
						fill: 'var(--sir-r)',
						fo: 1
					},
					{
						id: 'b',
						top: 1 / r0,
						bottom: shares.sInf,
						value: shares.b,
						line1: 'infected after the peak',
						line2: 'the overshoot, shaded',
						fill: 'var(--sir-i)',
						fo: 0.3
					},
					{
						id: 'c',
						top: shares.sInf,
						bottom: 0,
						value: shares.never,
						line1: 'never infected',
						line2: 'below the dotted line',
						fill: 'var(--sir-s)',
						fo: 1
					}
				]
			: [
					{
						id: 'c',
						top: 1,
						bottom: 0,
						value: 100,
						line1: 'never infected',
						line2: '',
						fill: 'var(--sir-s)',
						fo: 1
					}
				];
		// Label positions: at each segment's middle, pushed apart to stay legible.
		const GAP = 46;
		const ys = segs.map((s) => fy((s.top + s.bottom) / 2) + 4);
		for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + GAP);
		ys[ys.length - 1] = Math.min(ys[ys.length - 1], y1 - 14);
		for (let k = ys.length - 2; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - GAP);
		return segs.map((s, k) => ({
			...s,
			yTop: fy(s.top),
			yBottom: fy(s.bottom),
			mid: fy((s.top + s.bottom) / 2),
			ly: ys[k]
		}));
	});
</script>

{#snippet tint(
	x: number,
	y: number,
	text: string,
	color: string,
	size: number,
	anchor: 'start' | 'middle' | 'end',
	opacity: number
)}
	<!-- <Label color> is overridden by the stage's text fill, so tinted labels set style:fill -->
	<text
		{x}
		{y}
		class="halo"
		text-anchor={anchor}
		font-size={size}
		font-weight="600"
		style:fill={color}
		{opacity}
		style:pointer-events="none">{text}</text
	>
{/snippet}

<g style:font-variant-numeric="tabular-nums">
	<!-- header -->
	<Label x={32} y={48} text="Day {fmtDay(day)}" size={16} weight={600} anchor="start" />
	{#if fNotPeak > 0.01}
		<!-- the final count does not depend on D: show it on the final step too -->
		<Label
			x={928}
			y={48}
			text="R₀ = {r0.toFixed(1)} · infectious for {D} days"
			size={13}
			anchor="end"
			muted
			opacity={fNotPeak}
		/>
	{/if}
	{#if fp > 0.01}
		{@render tint(
			928,
			48,
			outbreak
				? `R = ${rNow < 0.005 ? 'under 0.01' : rNow.toFixed(2)} now: cases ${rNow > 1 ? 'rising' : 'falling'}`
				: `R₀ = ${r0.toFixed(1)}: cases only fall`,
			rNow > 1 ? 'var(--sir-i)' : 'var(--sir-s)',
			14,
			'end',
			fp
		)}
	{/if}

	<!-- boxes and arrows -->
	{#if fb > 0.01}
		<g opacity={fb}>
			{#each boxes as b (b.id)}
				<clipPath id="sir-clip-{b.id}">
					<rect x={b.x} y={BY0} width={BW} height={BH} rx="14" />
				</clipPath>
				<rect
					x={b.x}
					y={BY0}
					width={BW}
					height={BH}
					rx="14"
					fill="var(--sir-field)"
					stroke="var(--border)"
				/>
				<g clip-path="url(#sir-clip-{b.id})">
					<rect
						x={b.x}
						y={BY1 - BH * b.v}
						width={BW}
						height={BH * b.v}
						fill={b.color}
						opacity="0.3"
					/>
					{#if b.v > 0.002}
						<line
							x1={b.x}
							x2={b.x + BW}
							y1={BY1 - BH * b.v}
							y2={BY1 - BH * b.v}
							stroke={b.color}
							stroke-width="2"
						/>
					{/if}
				</g>
				<circle cx={b.x + 6} cy={BY0 - 17} r="6" fill={b.color} />
				<text x={b.x + 18} y={BY0 - 12} font-size="14" font-weight="600"
					>{b.name}<tspan fill="var(--stage-ink-muted)" font-size="11" font-weight="400" dx="8"
						>{b.sub}</tspan
					></text
				>
				<Label x={b.x + BW / 2} y={MY + 11} text={fmt(b.v)} size={30} weight={600} />
			{/each}

			{#each arrowGeom as a (a.id)}
				{@const cx = (a.x0 + a.x1) / 2}
				<polygon points={a.poly} fill={a.color} opacity="0.35" />
				{#each a.dots as d (d.k)}
					<circle cx={d.x} cy={MY} r="3.4" fill={a.color} opacity={d.o} />
				{/each}
				<text x={cx} y={MY - 26} font-size="13" font-weight="600" text-anchor="middle"
					>{a.name}</text
				>
				<text x={cx} y={MY + 34} font-size="12" text-anchor="middle">{fmtRate(a.flow)}</text>
				<text x={cx} y={MY + 50} font-size="11" class="muted" text-anchor="middle">{a.formula}</text
				>
				{#if a.formula2}
					<text x={cx} y={MY + 66} font-size="11" class="muted" text-anchor="middle"
						>{a.formula2}</text
					>
				{/if}
			{/each}

			{@render tint(480, 352, status.text, status.color, 14, 'middle', 1)}
		</g>
	{/if}

	<!-- the S/I/R chart (all phases) -->
	<Axes {sx} {sy} xLabel="day" yLabel="% of people" yFormat={pct} />
	{#each legend as item, k (item.id)}
		{@const lx = 300 + k * 104}
		<circle cx={lx} cy={44} r="5" fill={item.color} />
		<text x={lx + 10} y={48} font-size="12">{item.label}</text>
	{/each}

	{#if outbreak && fChart > 0.01}
		<!-- 1/R₀: the susceptible share at which the peak comes -->
		<g opacity={fChart}>
			<line
				x1={box.x0}
				x2={w.current.f > 0.01 ? lerp(box.x1, BAR_X + BAR_W, w.current.f) : box.x1}
				y1={sy(1 / r0)}
				y2={sy(1 / r0)}
				stroke="var(--sir-s)"
				stroke-width="1.5"
				stroke-dasharray="6 4"
			/>
			<!-- near the top (R₀ close to 1) the S curve runs above the line: label below it -->
			{@render tint(
				box.x0 + 8,
				sy(1 / r0) + (1 / r0 > 0.75 ? 16 : -7),
				`1/R₀ = ${fmt(1 / r0)}`,
				'var(--sir-s)',
				12,
				'start',
				fp
			)}
		</g>
	{/if}

	{#if ff > 0.01 && outbreak}
		<g opacity={ff}>
			<path d={overshoot} fill="var(--sir-i)" opacity="0.2" />
			<line
				opacity={dimmed(revealEnd)}
				x1={box.x0}
				x2={BAR_X + BAR_W}
				y1={sy(shares.sInf)}
				y2={sy(shares.sInf)}
				stroke="var(--sir-s)"
				stroke-width="1.5"
				stroke-dasharray="2 4"
			/>
			{@render tint(
				box.x1 - 6,
				sy(1 / r0) - 7,
				`1/R₀ = ${thText}: still susceptible at the peak`,
				'var(--sir-s)',
				12,
				'end',
				1
			)}
		</g>
	{/if}

	{#each curves as c (c.id)}
		<path
			d={c.d}
			fill="none"
			stroke={c.color}
			stroke-width={c.width}
			stroke-linejoin="round"
			opacity={c.opacity}
		/>
		{#if u < 1}
			<circle cx={sx(day)} cy={sy(c.head)} r="3.5" fill={c.color} opacity={c.opacity} />
		{/if}
	{/each}

	<!-- cursor (and its continuation over the R chart, without crossing that chart's title) -->
	{#if u < 1}
		<line
			x1={sx(day)}
			x2={sx(day)}
			y1={box.y0}
			y2={box.y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 3"
			opacity="0.6"
		/>
		{#if fp > 0.01}
			<line
				x1={sx(day)}
				x2={sx(day)}
				y1={RY0}
				y2={RY1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="2 3"
				opacity={0.6 * fp}
			/>
		{/if}
	{/if}

	<!-- the peak: S crosses 1/R₀, I is highest, R crosses 1 -->
	{#if outbreak && peakShow > 0}
		<g opacity={peakShow}>
			<line
				x1={sx(run.peakDay)}
				x2={sx(run.peakDay)}
				y1={box.y0}
				y2={box.y1}
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				stroke-dasharray="5 4"
				opacity="0.7"
			/>
			{#if fp > 0.01}
				<line
					x1={sx(run.peakDay)}
					x2={sx(run.peakDay)}
					y1={RY0}
					y2={RY1}
					stroke="var(--stage-ink)"
					stroke-width="1.2"
					stroke-dasharray="5 4"
					opacity={0.7 * fp}
				/>
			{/if}
			<circle
				cx={sx(run.peakDay)}
				cy={sy(run.peakI)}
				r="4.5"
				fill="var(--stage-bg)"
				stroke="var(--sir-i)"
				stroke-width="2"
			/>
			<circle
				cx={sx(run.peakDay)}
				cy={sy(1 / r0)}
				r="4.5"
				fill="var(--stage-bg)"
				stroke="var(--sir-s)"
				stroke-width="2"
				opacity={fChart}
			/>
			<Label
				x={sx(run.peakDay) - 4}
				y={box.y0 - 8}
				text="peak · day {peakDayText}"
				size={12}
				weight={600}
				anchor="start"
			/>
		</g>
	{/if}

	{#if !outbreak && fChart > 0.01}
		<Label
			x={(box.x0 + box.x1) / 2}
			y={lerp(box.y0, box.y1, 0.55)}
			text="No outbreak: with R₀ ≤ 1, each case infects one person or fewer"
			size={13}
			weight={600}
			pill
			opacity={fChart}
		/>
	{/if}

	<!-- effective reproduction number -->
	{#if fp > 0.01}
		{@const sxR = scale([0, run.xMax], [box.x0, box.x1])}
		<g opacity={fp}>
			<Axes
				sx={sxR}
				sy={syR}
				xLabel="day"
				yLabel="R: people each case infects now (R₀ × share susceptible)"
				grid
			/>
			<line
				x1={box.x0}
				x2={box.x1}
				y1={syR(1)}
				y2={syR(1)}
				stroke="var(--stage-ink)"
				stroke-width="1.2"
			/>
			<Label x={box.x1 - 4} y={syR(1) - 6} text="R = 1" size={12} weight={600} anchor="end" />
			<path
				d={rLines.above}
				fill="none"
				stroke="var(--sir-i)"
				stroke-width="2.6"
				stroke-linejoin="round"
			/>
			<path
				d={rLines.below}
				fill="none"
				stroke="var(--sir-s)"
				stroke-width="2.6"
				stroke-linejoin="round"
			/>
			{#if u < 1}
				<circle
					cx={sxR(day)}
					cy={syR(rNow)}
					r="3.5"
					fill={rNow > 1 ? 'var(--sir-i)' : 'var(--sir-s)'}
				/>
			{/if}
			{#if outbreak && peakShow > 0}
				<circle
					cx={sxR(run.peakDay)}
					cy={syR(1)}
					r="4.5"
					fill="var(--stage-bg)"
					stroke="var(--stage-ink)"
					stroke-width="2"
					opacity={peakShow}
				/>
			{/if}
			<text x={box.x1} y={RY0 - 10} font-size="11" text-anchor="end">
				<tspan fill="var(--sir-i)" font-weight="600">above 1: cases rise</tspan>
				<tspan fill="var(--stage-ink-muted)" dx="6">·</tspan>
				<tspan fill="var(--sir-s)" font-weight="600" dx="6">below 1: cases fall</tspan>
			</text>
		</g>
	{/if}

	<!-- final shares -->
	{#if ff > 0.01}
		<g opacity={ff}>
			{#each column as s (s.id)}
				{@const o = dimmed(s.id === 'a' ? revealA : revealEnd)}
				<rect
					x={BAR_X}
					y={s.yTop}
					width={BAR_W}
					height={Math.max(0, s.yBottom - s.yTop)}
					fill={s.fill}
					opacity={s.fo * o}
				/>
				<g opacity={o}>
					<line
						x1={BAR_X + BAR_W + 3}
						x2={LX - 6}
						y1={s.mid}
						y2={s.ly - 5}
						stroke="var(--stage-line)"
					/>
					<text x={LX} y={s.ly} font-size="18" font-weight="600"
						>{s.id === 'c' && outbreak && s.value < 1 ? '<1' : s.value}%</text
					>
					<text x={LX + 54} y={s.ly - 1} font-size="12">{s.line1}</text>
					{#if s.line2}
						<text x={LX + 54} y={s.ly + 14} font-size="11" class="muted">{s.line2}</text>
					{/if}
				</g>
			{/each}
			<rect
				x={BAR_X}
				y={rects.final.y0}
				width={BAR_W}
				height={rects.final.y1 - rects.final.y0}
				fill="none"
				stroke="var(--border)"
			/>
			{#if outbreak}
				<Label
					x={rects.final.x0}
					y={508}
					text="{shares.a}% by the peak + {shares.b}% after it + {shares.never < 1
						? '<1'
						: shares.never}% never = 100%"
					size={14}
					weight={600}
					anchor="start"
					opacity={dimmed(revealEnd)}
				/>
				<Label
					x={rects.final.x0}
					y={530}
					text="The peak comes at {thText} still susceptible, yet only {neverText} escape in the end"
					size={12}
					anchor="start"
					muted
					opacity={dimmed(revealEnd)}
				/>
			{/if}
		</g>
	{/if}
</g>
