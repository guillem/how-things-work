<script lang="ts">
	/**
	 * A clock lowered on a cable towards the horizon, compared with an identical
	 * clock far away. Drawn to scale vertically: the hole's centre is below the
	 * panel, 80 px per r_s, so the clock's height on screen is its distance from
	 * the centre. The lowered clock ticks at `clockRate(r)` = √(1 − r_s/r) of
	 * the far one; each of its ticks sends a green flash (530 nm) up the cable
	 * and across to the far clock, stretched on the way to 530 nm × rate(r_e) /
	 * rate(r) at each height (the gravitational redshift).
	 *
	 * Phases (`step.hints.phase`): clock — height from `params.clockR`;
	 * edge — from `params.edgeR` (near the horizon), with a note on what the
	 * far observer and the clock itself see.
	 *
	 * The lowered clock's hand is the integral of a rate that the reader
	 * changes: a frame-to-frame accumulator inside a $derived (the scene guide's
	 * sanctioned exception), ignoring dt ≤ 0 and static under reduced motion.
	 * The flashes in flight are a function of that hand and the current rate.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, wavelengthToColor, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { RS, clockRate } from '../blackhole';
	import Card from './Card.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const PX0 = 16;
	const PY0 = 16;
	const PX1 = 640;
	const PY1 = 584;
	const CX = 660;
	const CW = 284;
	const HX = 190; // the hole's centre (below the panel) and the cable
	const HY = 540 + 80; // horizon top at y = 540
	const PER_RS = 80; // px per r_s
	const R_MIN = 1.01;
	const R_MAX = 6;
	const TICK = 1.5; // seconds of the far clock's time per tick
	const LAMBDA0 = 530; // nm, green
	const SPEED = 190; // px/s, flashes on screen

	const phase = $derived(String(step.hints?.phase ?? 'clock'));
	const id = $derived(phase === 'edge' ? 'edgeR' : 'clockR');
	const rRs = $derived(Number(params[id] ?? (phase === 'edge' ? 1.05 : 2)));
	const rate = $derived(clockRate(rRs * RS));

	// The clock's height eases to the slider so a jump does not snap.
	const shown = new Tween(2, { duration: 500, easing: cubicInOut });
	$effect(() => {
		const r = rRs;
		untrack(() => shown.set(r, { duration: reduced ? 0 : 500 }));
	});
	const yOf = (r: number) => HY - r * PER_RS;
	const clockY = $derived(yOf(shown.current));

	// ---- the two clocks' time -------------------------------------------------------------
	const farTime = $derived(reduced ? 2.5 : t);
	let acc = { t: 0, own: 0 };
	const ownTime = $derived.by(() => {
		if (reduced) return 2.5 * rate;
		const dt = t - acc.t;
		if (dt > 0 && dt < 0.5) acc = { t, own: acc.own + dt * rate };
		else if (dt !== 0) acc = { t, own: dt < 0 ? t * rate : acc.own };
		return acc.own;
	});
	const farTicks = $derived(Math.floor(farTime / TICK));
	const ownTicks = $derived(Math.floor(ownTime / TICK));
	const hand = (time: number) => (time / TICK) * 2 * Math.PI;

	// ---- flashes: up the cable to the top, then across to the far clock ------------------
	const FAR = { X: 500, Y: 110 };
	const TOP_Y = FAR.Y;
	const path = $derived.by(() => {
		const up = clockY - 40 - TOP_Y; // from just above the clock's dial
		const across = FAR.X - 44 - HX;
		return { up: Math.max(0, up), across, total: Math.max(0, up) + across };
	});
	/** Local clock rate at a point on the flash's path (height on the cable; 1 far away). */
	function rateAt(s: number) {
		if (s <= path.up) {
			const y = clockY - 40 - s;
			return clockRate(((HY - y) / PER_RS) * RS);
		}
		const f = (s - path.up) / Math.max(1, path.across);
		const top = clockRate(((HY - TOP_Y) / PER_RS) * RS);
		return top + (1 - top) * f;
	}
	const flashes = $derived.by(() => {
		const out: { k: number; X: number; Y: number; nm: number }[] = [];
		const last = Math.floor(ownTime / TICK);
		for (let j = 0; j < 12; j++) {
			const k = last - j;
			if (k < 1) break;
			// Far-clock seconds since this flash left (the rate is taken as steady).
			const ago = (ownTime - k * TICK) / Math.max(rate, 1e-3);
			const s = ago * SPEED;
			if (s > path.total) break;
			const X = s <= path.up ? HX : HX + (s - path.up);
			const Y = s <= path.up ? clockY - 40 - s : TOP_Y;
			// Measured by a clock held at that height: λ = λ₀ × rate(here) / rate(emitter).
			out.push({ k, X, Y, nm: (LAMBDA0 * rateAt(s)) / Math.max(rate, 1e-6) });
		}
		return out;
	});
	const arrivingNm = $derived(LAMBDA0 / Math.max(rate, 1e-6));
	const colorOf = (nm: number) => (nm > 760 ? 'var(--bh-captured)' : wavelengthToColor(nm));
	const nmText = (nm: number) =>
		nm > 760
			? `${nm > 99999 ? '>100 000' : Math.round(nm).toLocaleString('en').replace(/,/g, ' ')} nm, infrared`
			: `${Math.round(nm)} nm, ${nm < 570 ? 'green' : nm < 590 ? 'yellow' : nm < 620 ? 'orange' : 'red'}`;

	// ---- dragging the clock ---------------------------------------------------------------
	function moveTo(y: number) {
		const r = Math.max(R_MIN, Math.min(R_MAX, (HY - y) / PER_RS));
		setParam(id, Math.round(r * 100) / 100);
	}
	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') setParam(id, R_MIN);
		else if (k === 'end') setParam(id, R_MAX);
		else setParam(id, Math.max(R_MIN, Math.min(R_MAX, Math.round((rRs + 0.01 * k) * 100) / 100)));
	}

	// ---- the rate curve -------------------------------------------------------------------
	const G = { x: CX + 44, y: PY0 + 226, w: CW - 72, h: 88 };
	const gx = (r: number) => G.x + ((r - 1) / (R_MAX - 1)) * G.w;
	const gy = (v: number) => G.y + G.h - v * G.h;
	const curve = (() => {
		let d = '';
		for (let i = 0; i <= 100; i++) {
			const r = 1 + ((R_MAX - 1) * i) / 100;
			d += `${i ? 'L' : 'M'}${gx(r).toFixed(1)} ${gy(clockRate(r * RS)).toFixed(1)}`;
		}
		return d;
	})();
	const shownRate = $derived(clockRate(shown.current * RS));
</script>

{#snippet dial(X: number, Y: number, angle: number, color: string)}
	<circle cx={X} cy={Y} r="30" fill="var(--surface)" stroke={color} stroke-width="2.5" />
	{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as k (k)}
		<line
			x1={X + 24 * Math.sin((k * Math.PI) / 6)}
			y1={Y - 24 * Math.cos((k * Math.PI) / 6)}
			x2={X + 27 * Math.sin((k * Math.PI) / 6)}
			y2={Y - 27 * Math.cos((k * Math.PI) / 6)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
	{/each}
	<line
		x1={X}
		y1={Y}
		x2={X + 22 * Math.sin(angle)}
		y2={Y - 22 * Math.cos(angle)}
		stroke={color}
		stroke-width="2.5"
		stroke-linecap="round"
	/>
	<circle cx={X} cy={Y} r="2.5" fill={color} />
{/snippet}

{#snippet row(y: number, label: string, value: string, color?: string)}
	<T x={CX + 16} {y} text={label} size={12.5} muted />
	<T x={CX + CW - 16} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
{/snippet}

<g>
	<defs>
		<clipPath id="clock-clip">
			<rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} rx="14" />
		</clipPath>
	</defs>
	<rect
		x={PX0}
		y={PY0}
		width={PX1 - PX0}
		height={PY1 - PY0}
		rx="14"
		fill="var(--bh-space)"
		stroke="var(--border)"
	/>

	<g clip-path="url(#clock-clip)">
		<!-- height marks, in r_s from the centre -->
		{#each [2, 3, 4, 5, 6] as r (r)}
			<line x1={HX + 46} x2={PX1 - 16} y1={yOf(r)} y2={yOf(r)} stroke="var(--stage-grid)" />
		{/each}
		<!-- the hole -->
		<circle
			cx={HX}
			cy={HY}
			r={PER_RS}
			fill="var(--bh-hole)"
			stroke="var(--bh-horizon)"
			stroke-width="1.2"
		/>
		<!-- the cable -->
		<line
			x1={HX}
			x2={HX}
			y1={PY0}
			y2={clockY - 30}
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
		<!-- flashes in flight -->
		{#each flashes as f (f.k)}
			<circle cx={f.X} cy={f.Y} r="9" fill={colorOf(f.nm)} opacity={f.nm > 760 ? 0.25 : 0.35} />
			<circle cx={f.X} cy={f.Y} r="4.5" fill={colorOf(f.nm)} opacity={f.nm > 760 ? 0.5 : 1} />
		{/each}
	</g>

	{#each [2, 3, 4, 5, 6] as r (r)}
		<T x={PX1 - 20} y={yOf(r) - 5} text="{r} r_s" size={11} anchor="end" muted />
	{/each}
	<T x={HX + 100} y={HY - PER_RS + 32} text="horizon, 1 r_s" size={12} weight={600} />

	<!-- the far clock -->
	<rect
		x={FAR.X - 70}
		y={FAR.Y - 66}
		width="140"
		height="126"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
		opacity="0.9"
	/>
	{@render dial(FAR.X, FAR.Y, hand(farTime), 'var(--stage-ink)')}
	<T x={FAR.X} y={FAR.Y - 44} text="far away" size={12.5} anchor="middle" weight={700} />
	<T x={FAR.X} y={FAR.Y + 50} text="{farTicks} ticks" size={12.5} anchor="middle" weight={600} />

	<!-- the lowered clock -->
	{@render dial(HX, clockY, hand(ownTime), 'var(--bh-probe)')}
	<T
		x={HX + 42}
		y={clockY - 4}
		text="lowered clock"
		size={12.5}
		weight={700}
		color="var(--bh-probe)"
	/>
	<T x={HX + 42} y={clockY + 14} text="{ownTicks} ticks" size={12.5} weight={600} />
	<Handle
		x={HX}
		y={clockY + 40}
		r={7}
		label="Height of the lowered clock"
		value={rRs}
		min={R_MIN}
		max={R_MAX}
		valuetext="{rRs.toFixed(2)} Schwarzschild radii from the centre"
		color="var(--bh-probe)"
		onmove={(p: Point) => moveTo(p.y - 40)}
		{onkey}
	/>

	<!-- readouts -->
	<Card x={CX} y={PY0} w={CW} h={phase === 'edge' ? 196 : 168} />
	<T
		x={CX + 16}
		y={PY0 + 28}
		text={phase === 'edge' ? 'Just above the horizon' : 'A clock held low'}
		size={15}
		weight={700}
	/>
	{@render row(PY0 + 60, 'Height', `${rRs.toFixed(2)} r_s`)}
	{@render row(
		PY0 + 88,
		'Ticks per 100 far ticks',
		(rate * 100).toFixed(rate < 0.1 ? 1 : 0),
		'var(--bh-probe)'
	)}
	{@render row(
		PY0 + 116,
		'1 hour down there',
		`${(1 / Math.max(rate, 1e-9)).toFixed(2)} h far away`
	)}
	{@render row(PY0 + 144, 'Its green flash arrives', '')}
	<T
		x={CX + CW - 16}
		y={PY0 + 164}
		text={nmText(arrivingNm)}
		size={13}
		anchor="end"
		weight={650}
		color={colorOf(arrivingNm)}
	/>
	{#if phase === 'edge'}
		<T x={CX + 16} y={PY0 + 188} text="Closer still: slower and redder, no limit" size={12} muted />
	{/if}

	<Card x={CX} y={PY0 + (phase === 'edge' ? 212 : 184)} w={CW} h={phase === 'edge' ? 128 : 156} />
	{#if phase === 'edge'}
		<T x={CX + 16} y={PY0 + 238} text="Two true stories" size={13.5} weight={700} />
		<T x={CX + 16} y={PY0 + 260} text="Far away: a falling clock slows, reddens" size={12.5} />
		<T x={CX + 16} y={PY0 + 280} text="and fades just above the horizon." size={12.5} />
		<T x={CX + 16} y={PY0 + 302} text="The clock itself: nothing special; it" size={12.5} />
		<T x={CX + 16} y={PY0 + 322} text="crosses in a short time and goes on." size={12.5} />
	{:else}
		<T x={CX + 16} y={PY0 + 210} text="Rate: √(1 − r_s / r)" size={13.5} weight={700} />
		<!-- the rate curve -->
		<line x1={G.x} x2={G.x + G.w} y1={G.y + G.h} y2={G.y + G.h} stroke="var(--stage-line)" />
		<line x1={G.x} x2={G.x} y1={G.y} y2={G.y + G.h} stroke="var(--stage-line)" />
		<path d={curve} fill="none" stroke="var(--bh-probe)" stroke-width="2" />
		<circle cx={gx(shown.current)} cy={gy(shownRate)} r="5" fill="var(--bh-probe)" />
		<T x={G.x - 6} y={G.y + 4} text="1" size={11} anchor="end" muted />
		<T x={G.x - 6} y={G.y + G.h + 4} text="0" size={11} anchor="end" muted />
		<T x={G.x} y={G.y + G.h + 16} text="1 r_s" size={11} anchor="middle" muted />
		<T x={G.x + G.w} y={G.y + G.h + 16} text="6 r_s" size={11} anchor="middle" muted />
	{/if}

	<Card x={CX} y={PY1 - 76} w={CW} h={76} />
	<T x={CX + 16} y={PY1 - 48} text="GPS clocks, 20 200 km up, gain" size={12.5} />
	<T x={CX + 16} y={PY1 - 28} text="45 µs a day from gravity alone." size={12.5} />
</g>
