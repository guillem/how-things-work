<script lang="ts">
	/**
	 * Tides, seen from above the North Pole. One scene, two phases:
	 * - `moon`: the Moon alone stretches the ocean into two bulges; a town on the
	 *   equator turns through both bulges and both dips each lunar day, and a tide
	 *   gauge traces the water height there (two highs and two lows);
	 * - `sun`: the Sun's tide is added; the `moon` control (days since new Moon)
	 *   sets the Moon–Sun angle, so the bulges add (spring) or partly cancel (neap).
	 *
	 * Heights come from `tideHeight` in `sky.ts` (equilibrium tide on the equator).
	 * The Moon-only tide is `tideHeight` averaged with the Sun moved by 90°, which
	 * cancels the Sun term exactly, so no formula is re-derived here.
	 *
	 * Simplification: while the Earth turns, the Moon and Sun are held still (the
	 * Moon's phase is whatever the slider says), so each lunar day repeats exactly.
	 *
	 * Text sizes and colours use `style:` because the stage's CSS overrides SVG
	 * presentation attributes (docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { SUN_TIDE_RATIO, SYNODIC_MONTH, phaseName, tidalRange, tideHeight } from '../sky';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const rad = (d: number) => (d * Math.PI) / 180;
	const mod = (v: number, m: number) => ((v % m) + m) % m;
	/** Point at `r` from (cx, cy) at angle `a` (degrees, counter-clockwise on screen, 0 = right). */
	const pt = (cx: number, cy: number, r: number, a: number) => ({
		x: cx + r * Math.cos(rad(a)),
		y: cy - r * Math.sin(rad(a))
	});
	const f1 = (v: number) => v.toFixed(1);

	/** Hours for the Earth to turn once relative to the Moon (the lunar day): 24 h 50 min. */
	const LUNAR_DAY = 24 / (1 - 1 / SYNODIC_MONTH);
	const SECONDS_PER_LUNAR_DAY = 12;
	/** Clock shown under reduced motion: a quarter of the way from high to low. */
	const FROZEN_HOURS = 3.1;
	const SUN_DIR = 180;

	const hm = (h: number) => {
		const m = Math.round(h * 60);
		return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
	};

	// ---- phase and controls ---------------------------------------------------------
	const phase = $derived(step.hints?.phase === 'sun' ? 'sun' : 'moon');
	const days = $derived(Number(params.moon ?? 4) || 0);
	const running = $derived(params.run !== false);
	/** Moon direction: fixed to the right with the Moon alone; set by the phase otherwise. */
	const moonTarget = $derived(phase === 'sun' ? SUN_DIR + (360 * days) / SYNODIC_MONTH : 0);

	const initialSun = untrack(() => (phase === 'sun' ? 1 : 0));
	const sunW = new Tween(initialSun, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const v = phase === 'sun' ? 1 : 0;
		untrack(() => sunW.set(v, { duration: reduced ? 0 : 800 }));
	});
	const moonAng = new Tween(
		untrack(() => moonTarget),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const a = moonTarget;
		untrack(() => {
			// Shortest way round, so 29.5 days → 0 days is a small step, not a full turn.
			const cur = moonAng.target;
			const d = mod(a - cur + 180, 360) - 180;
			moonAng.set(cur + d, { duration: reduced || dragging ? 0 : 700 });
		});
	});
	// Dragging the Moon ('sun' phase) writes the `moon` control, so the slider follows.
	let dragging = $state(false);
	/** Elongation under the pointer while dragging (unsnapped, so the Moon follows smoothly). */
	let dragElong = $state<number | null>(null);
	// Snapped to the slider's step (0.25 day).
	const setDays = (d: number) => setParam('moon', clamp(Math.round(d * 4) / 4, 0, 29.5));
	function onMoonMove(p: Point) {
		const a = (Math.atan2(-(p.y - EY), p.x - EX) * 180) / Math.PI;
		dragElong = mod(a - SUN_DIR, 360);
		setDays((dragElong / 360) * SYNODIC_MONTH);
	}
	function onMoonKey(k: number | 'start' | 'end') {
		setDays(k === 'start' ? 0 : k === 'end' ? 29.5 : days + 0.5 * k);
	}
	const w = $derived(sunW.current);
	const mAng = $derived(
		dragging && dragElong !== null && phase === 'sun' ? SUN_DIR + dragElong : moonAng.current
	);
	// Text blocks that share a place swap (one fades out, then the other in) rather than overlap.
	const swap = (v: number) => smoothstep(0.5, 1, v);
	/** Moon–Sun angle (elongation), 0 at new Moon, as the scene currently shows it. */
	const elong = $derived(mod(mAng - SUN_DIR, 360));

	// ---- clock ------------------------------------------------------------------------
	// Sanctioned accumulator (docs/scene-guide.md): the Earth's turning is the integral
	// of a rate that the `run` toggle switches on and off, and it must stop where it is
	// rather than snap. Plain (non-reactive) variables; dt ≤ 0 (pause, step reset) is
	// ignored; static under reduced motion.
	let clock = 0;
	let prevT = 0;
	const hours = $derived.by(() => {
		const now = t;
		const dt = now - prevT;
		prevT = now;
		if (reduced) return FROZEN_HOURS;
		if (dt > 0 && running) clock += (Math.min(dt, 0.25) * LUNAR_DAY) / SECONDS_PER_LUNAR_DAY;
		return clock;
	});
	/** Hours since the town last passed under the Moon. */
	const tau = $derived(mod(hours, LUNAR_DAY));

	// ---- tide model ---------------------------------------------------------------------
	/** Moon-only equilibrium tide: the Sun term of `tideHeight` cancels when averaged over s and s + 90°. */
	const moonTide = (p: number, m: number) => (tideHeight(p, m, 0) + tideHeight(p, m, 90)) / 2;
	/** Water height at longitude `p` (Sun's share faded in by the phase weight). */
	const height = (p: number, m: number, sunWeight: number) => {
		const mo = moonTide(p, m);
		return mo + sunWeight * (tideHeight(p, m, SUN_DIR) - mo);
	};
	/**
	 * `tidalRange` is high − low in units of the Moon-alone amplitude, so the Moon
	 * alone gives a range of 2: divide by this to get "× the Moon alone".
	 */
	const MOON_RANGE = moonTide(0, 0) - moonTide(90, 0);
	const heightAt = (tauH: number) => height(mAng + (360 * tauH) / LUNAR_DAY, mAng, w);
	const townAng = $derived(mAng + (360 * tau) / LUNAR_DAY);

	// ---- globe ----------------------------------------------------------------------------
	const EX = 284;
	const EY = 290;
	const R_LAND = 90;
	const R_SEA = 122;
	/** Exaggeration of the bulges: drawing units per unit of `tideHeight`. */
	const K = 19;
	const ORBIT = 175;
	const R_MOON = 17;
	const seaR = (h: number) => R_SEA + K * h;

	const ocean = $derived.by(() => {
		let d = '';
		for (let i = 0; i < 180; i++) {
			const a = i * 2;
			const p = pt(EX, EY, seaR(height(a, mAng, w)), a);
			d += `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`;
		}
		return d + 'Z';
	});
	const moonPos = $derived(pt(EX, EY, ORBIT, mAng));
	const town = $derived(pt(EX, EY, R_LAND, townAng));
	const townH = $derived(heightAt(tau));
	const townSurf = $derived(pt(EX, EY, seaR(townH), townAng));
	const townLabel = $derived(pt(EX, EY, 64, townAng));
	/** Moon label: above the Moon near the top, beside it near the bottom, below it otherwise. */
	const moonLabel = $derived.by(() => {
		const s = Math.sin(rad(mAng));
		if (s > 0.45) return { x: moonPos.x, y: moonPos.y - R_MOON - 8, anchor: 'middle' };
		if (s < -0.45) return { x: moonPos.x + R_MOON + 8, y: moonPos.y + 4, anchor: 'start' };
		return { x: moonPos.x, y: moonPos.y + R_MOON + 16, anchor: 'middle' };
	});
	const spin = (() => {
		const a = pt(EX, EY, 30, 205);
		const b = pt(EX, EY, 30, 335);
		const tip = pt(EX, EY, 30, 340);
		const l = pt(EX, EY, 25, 330);
		const r = pt(EX, EY, 35, 330);
		return {
			arc: `M${f1(a.x)} ${f1(a.y)} A30 30 0 0 0 ${f1(b.x)} ${f1(b.y)}`,
			head: `M${f1(l.x)} ${f1(l.y)} L${f1(tip.x)} ${f1(tip.y)} L${f1(r.x)} ${f1(r.y)}`
		};
	})();

	// ---- tide gauge -------------------------------------------------------------------
	const GX0 = 616;
	const GX1 = 890;
	const GY0 = 104;
	const GY1 = 272;
	const gx = scale([0, 25], [GX0, GX1]);
	const gy = scale([-1.6, 1.6], [GY1, GY0]);
	const N_GAUGE = 200;
	const curve = $derived.by(() => {
		const pts: { x: number; y: number }[] = [];
		for (let i = 0; i <= N_GAUGE; i++) {
			const h = (25 * i) / N_GAUGE;
			pts.push({ x: gx(h), y: gy(heightAt(h)) });
		}
		return pts;
	});
	const toPath = (pts: { x: number; y: number }[]) =>
		pts.map((p, i) => `${i ? 'L' : 'M'}${f1(p.x)} ${f1(p.y)}`).join('');
	const ghost = $derived(toPath(curve));
	const traceEnd = $derived(reduced ? 25 : tau);
	const trace = $derived.by(() => {
		const n = Math.floor((traceEnd / 25) * N_GAUGE);
		const pts = curve.slice(0, n + 1);
		pts.push({ x: gx(traceEnd), y: gy(heightAt(traceEnd)) });
		return toPath(pts);
	});
	/** Highs and lows within one lunar day, found by sampling. */
	const extrema = $derived.by(() => {
		const n = 360;
		const v = Array.from({ length: n }, (_, i) => heightAt((LUNAR_DAY * i) / n));
		const highs: number[] = [];
		const lows: number[] = [];
		for (let i = 0; i < n; i++) {
			const a = v[(i + n - 1) % n];
			const b = v[(i + 1) % n];
			if (v[i] >= a && v[i] > b) highs.push((LUNAR_DAY * i) / n);
			if (v[i] <= a && v[i] < b) lows.push((LUNAR_DAY * i) / n);
		}
		// Every repeat of each extremum that falls inside the chart's 0–25 h window.
		const inWindow = (xs: number[]) =>
			xs
				.flatMap((x) => [x - LUNAR_DAY, x, x + LUNAR_DAY])
				.filter((x) => x > -0.1 && x < 25.1)
				.sort((p, q) => p - q);
		return {
			highs: inWindow(highs),
			lows: inWindow(lows),
			max: Math.max(...v),
			min: Math.min(...v)
		};
	});
	const bracketY = $derived(gy(extrema.max) - 14);
	const pairHighs = $derived(extrema.highs.length >= 2 ? extrema.highs.slice(0, 2) : null);

	// ---- month chart ('sun') ------------------------------------------------------------
	const MX0 = 616;
	const MX1 = 890;
	const MY0 = 380;
	const MY1 = 484;
	const mx = scale([0, SYNODIC_MONTH], [MX0, MX1]);
	const my = scale([0, 1.5], [MY1, MY0]);
	const rangeAt = (d: number) => tidalRange((360 * d) / SYNODIC_MONTH) / MOON_RANGE;
	const monthPath = (() => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const day = (SYNODIC_MONTH * i) / 120;
			d += `${i ? 'L' : 'M'}${f1(mx(day))} ${f1(my(rangeAt(day)))}`;
		}
		return d;
	})();
	const markDay = $derived((elong / 360) * SYNODIC_MONTH);
	const rangeNow = $derived(tidalRange(elong) / MOON_RANGE);
	/** Spring / neap labels fade while the "now" marker passes over them. */
	const clearOf = (f: number) =>
		0.15 + 0.85 * smoothstep(1, 2.2, Math.abs(markDay - f * SYNODIC_MONTH));
	const springNeap = (tidalRange(0) / tidalRange(90)).toFixed(1);
	const sunHalf = SUN_TIDE_RATIO.toFixed(2);
	const geometry = $derived.by(() => {
		const c = Math.cos(2 * rad(elong));
		if (c > 0.9) return 'Sun and Moon in line: their bulges add — spring tides';
		if (c < -0.9) return 'Sun and Moon at right angles: bulges partly cancel — neap tides';
		return 'Between spring and neap tides';
	});
	const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

	const ink = 'var(--stage-ink)';
	const muted = 'var(--stage-ink-muted)';
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
		halo?: boolean;
		opacity?: number;
	} = {}
)}
	<text
		{x}
		{y}
		class:halo={opts.halo ?? true}
		class:muted={opts.muted}
		text-anchor={opts.anchor ?? 'start'}
		font-weight={opts.weight ?? 500}
		opacity={opts.opacity ?? 1}
		style:font-size="{size}px"
		style:fill={opts.color}>{text}</text
	>
{/snippet}

{#snippet arrowH(x: number, y: number, len: number, color: string)}
	<line x1={x} x2={x + len - 3} y1={y} y2={y} stroke={color} stroke-width="2" />
	<path d="M{x + len - 7} {y - 4} L{x + len} {y} L{x + len - 7} {y + 4} Z" fill={color} />
{/snippet}

<g>
	<!-- ============================================================ the view from above -->
	<rect x="16" y="16" width="536" height="568" rx="14" fill="var(--sky-space)" />
	{@render txt(32, 44, 'Seen from above the North Pole', 15, { weight: 600 })}
	{@render txt(32, 64, 'Water layer and bulges hugely exaggerated · not to scale', 12, {
		muted: true
	})}

	<!-- Moon's orbit and the direction lines -->
	<circle
		cx={EX}
		cy={EY}
		r={ORBIT}
		fill="none"
		stroke="var(--sky-orbit)"
		stroke-width="1"
		stroke-dasharray="3 5"
	/>
	<line
		x1={EX}
		y1={EY}
		x2={moonPos.x}
		y2={moonPos.y}
		stroke={muted}
		stroke-width="1"
		stroke-dasharray="2 4"
		opacity="0.6"
	/>

	<!-- Sun, far off to the left -->
	<g opacity={w}>
		{#each Array.from({ length: 8 }, (_, i) => i * 45) as a (a)}
			{@const p = pt(44, EY, 15, a)}
			{@const q = pt(44, EY, 21, a)}
			<line
				x1={p.x}
				y1={p.y}
				x2={q.x}
				y2={q.y}
				stroke="var(--sky-sun)"
				stroke-width="2"
				stroke-linecap="round"
			/>
		{/each}
		<circle cx="44" cy={EY} r="12" fill="var(--sky-sun)" />
		{@render txt(44, EY + 42, 'Sun', 12, { anchor: 'middle' })}
		{@render txt(44, EY + 57, '(far off)', 11, { anchor: 'middle', muted: true })}
		<line
			x1="70"
			y1={EY}
			x2={EX - 160}
			y2={EY}
			stroke="var(--sky-sun)"
			stroke-width="1"
			stroke-dasharray="2 4"
			opacity="0.8"
		/>
	</g>

	<!-- the Earth: ocean (exaggerated), land, mean water level -->
	<path d={ocean} fill="var(--sky-ocean)" />
	<circle
		cx={EX}
		cy={EY}
		r={R_SEA}
		fill="none"
		stroke={ink}
		stroke-width="1"
		stroke-dasharray="3 4"
		opacity="0.35"
	/>
	<circle cx={EX} cy={EY} r={R_LAND} fill="var(--sky-land)" />
	<circle cx={EX} cy={EY} r="2.5" fill={ink} opacity="0.6" />
	<g opacity={running ? 0.75 : 0.3}>
		<path d={spin.arc} fill="none" stroke={ink} stroke-width="1.5" />
		<path d={spin.head} fill="none" stroke={ink} stroke-width="1.5" stroke-linejoin="round" />
	</g>
	<!-- night side, away from the Sun -->
	<clipPath id="tides-night-clip">
		<rect x={EX} y={EY - 170} width="180" height="340" />
	</clipPath>
	<path d={ocean} fill="var(--sky-night)" opacity={w * 0.75} clip-path="url(#tides-night-clip)" />

	<!-- the town and its tide gauge -->
	<line
		x1={town.x}
		y1={town.y}
		x2={townSurf.x}
		y2={townSurf.y}
		stroke={ink}
		stroke-width="2.5"
		stroke-linecap="round"
	/>
	<circle cx={town.x} cy={town.y} r="5.5" fill={ink} stroke="var(--stage-bg)" stroke-width="1.5" />
	{@render txt(townLabel.x, townLabel.y + 4, 'town', 12, { anchor: 'middle', weight: 600 })}

	<!-- the Moon: lit on the Sun's side once the Sun is in the picture -->
	<circle cx={moonPos.x} cy={moonPos.y} r={R_MOON} fill="var(--sky-moon)" />
	<path
		d="M{moonPos.x} {moonPos.y - R_MOON} A{R_MOON} {R_MOON} 0 0 1 {moonPos.x} {moonPos.y +
			R_MOON} Z"
		fill="var(--sky-moon-dark)"
		opacity={w}
	/>
	<circle
		cx={moonPos.x}
		cy={moonPos.y}
		r={R_MOON}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	{@render txt(moonLabel.x, moonLabel.y, 'Moon', 12, { anchor: moonLabel.anchor })}

	{#if phase === 'sun'}
		<Handle
			x={moonPos.x}
			y={moonPos.y}
			r={5}
			label="Moon"
			value={days}
			min={0}
			max={29.5}
			valuetext="{days.toFixed(1)} days since new Moon, {phaseName((360 * days) / SYNODIC_MONTH)}"
			onmove={onMoonMove}
			onkey={onMoonKey}
			ondragstart={() => (dragging = true)}
			ondragend={() => {
				dragging = false;
				dragElong = null;
			}}
		/>
	{/if}

	<!-- Moon only: the two bulges and the uneven pull -->
	<g opacity={swap(1 - w)}>
		{@render txt(446, 196, 'near-side bulge', 12, { anchor: 'middle' })}
		{@render txt(122, 196, 'far-side bulge', 12, { anchor: 'middle' })}
		{@render txt(
			EX,
			516,
			"The Moon's pull: stronger on the near side, weaker on the far side",
			12,
			{ anchor: 'middle' }
		)}
		{#each [{ x: EX - 94, len: 20, name: 'far side' }, { x: EX, len: 30, name: 'centre' }, { x: EX + 94, len: 44, name: 'near side' }] as a (a.name)}
			<circle cx={a.x} cy={538} r="3" fill={ink} />
			{@render arrowH(a.x + 4, 538, a.len, 'var(--stage-ink)')}
			{@render txt(a.x, 557, a.name, 11, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt(EX, 576, 'the difference stretches the oceans into two bulges', 12, {
			anchor: 'middle',
			muted: true
		})}
	</g>

	<!-- Moon and Sun: phase and what it does -->
	<g opacity={swap(w)}>
		{@render txt(EX, 528, `${cap(phaseName(elong))} · ${markDay.toFixed(1)} days`, 14, {
			anchor: 'middle',
			weight: 600
		})}
		{@render txt(EX, 550, geometry, 12, { anchor: 'middle' })}
		{@render txt(EX, 570, `The Sun's tide is about half the Moon's (${sunHalf}×)`, 12, {
			anchor: 'middle',
			muted: true
		})}
	</g>

	<!-- ============================================================ tide gauge -->
	{@render txt(584, 44, 'Water height at the town', 15, { weight: 600 })}
	{@render txt(928, 44, hm(reduced ? FROZEN_HOURS : tau), 13, {
		anchor: 'end',
		muted: true
	})}
	<g opacity={swap(1 - w)}>
		{@render txt(584, 64, "Moon only (the Sun's tide left out)", 12, { muted: true })}
	</g>
	<g opacity={swap(w)}>
		{@render txt(584, 64, 'Moon and Sun together · dotted: the Moon alone', 12, { muted: true })}
	</g>

	<line x1={GX0} x2={GX1} y1={gy(0)} y2={gy(0)} stroke="var(--stage-line)" stroke-dasharray="3 4" />
	{@render txt(GX0 - 6, gy(0) + 4, 'mean', 11, { anchor: 'end', muted: true })}
	<line x1={GX0} x2={GX1} y1={GY1 + 14} y2={GY1 + 14} stroke="var(--stage-line)" />
	{#each [0, 6, 12, 18, 24] as h (h)}
		<line x1={gx(h)} x2={gx(h)} y1={GY1 + 14} y2={GY1 + 18} stroke="var(--stage-line)" />
		{@render txt(gx(h), GY1 + 32, `${h} h`, 11, { anchor: 'middle', muted: true })}
	{/each}
	{@render txt((GX0 + GX1) / 2, GY1 + 50, 'hours since the town passed under the Moon', 11, {
		anchor: 'middle',
		muted: true
	})}

	<!-- Moon alone, for comparison once the Sun joins in -->
	<g opacity={w * 0.9}>
		{#each [1, -1] as v (v)}
			<line
				x1={GX0}
				x2={GX1}
				y1={gy(v)}
				y2={gy(v)}
				stroke={muted}
				stroke-width="1"
				stroke-dasharray="1 4"
			/>
		{/each}
	</g>

	<path d={ghost} fill="none" stroke={muted} stroke-width="1.5" opacity="0.45" />
	<path
		d={trace}
		fill="none"
		stroke="var(--sky-ocean)"
		stroke-width="3"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	{#if !reduced}
		<line
			x1={gx(tau)}
			x2={gx(tau)}
			y1={gy(townH)}
			y2={GY1 + 14}
			stroke="var(--sky-ocean)"
			stroke-width="1"
			opacity="0.5"
		/>
	{/if}
	<circle
		cx={gx(reduced ? FROZEN_HOURS : tau)}
		cy={gy(heightAt(reduced ? FROZEN_HOURS : tau))}
		r="5"
		fill={ink}
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<!-- highs (bracketed: 12 h 25 min apart) and lows -->
	{#if pairHighs}
		{@const [a, b] = pairHighs}
		<path
			d="M{gx(a)} {bracketY + 6} V{bracketY} H{gx(b)} V{bracketY + 6}"
			fill="none"
			stroke={ink}
			stroke-width="1"
		/>
		{@render txt((gx(a) + gx(b)) / 2, bracketY - 5, `highs ${hm(b - a)} apart`, 12, {
			anchor: 'middle'
		})}
	{/if}
	{#each extrema.highs as h, i (i)}
		<circle cx={gx(h)} cy={gy(extrema.max)} r="3" fill={ink} />
	{/each}
	{#each extrema.lows as h, i (i)}
		<circle cx={gx(h)} cy={gy(extrema.min)} r="3" fill={ink} />
		{@render txt(gx(h), gy(extrema.min) + 17, 'low', 12, { anchor: 'middle' })}
	{/each}

	<!-- range bar -->
	<g opacity={w}>
		<line
			x1="904"
			x2="904"
			y1={gy(extrema.max)}
			y2={gy(extrema.min)}
			stroke="var(--sky-ocean)"
			stroke-width="2"
		/>
		<line x1="899" x2="909" y1={gy(extrema.max)} y2={gy(extrema.max)} stroke="var(--sky-ocean)" />
		<line x1="899" x2="909" y1={gy(extrema.min)} y2={gy(extrema.min)} stroke="var(--sky-ocean)" />
		{@render txt(926, gy(0) + 4, 'range', 11, { anchor: 'middle', muted: true })}
	</g>

	<!-- ============================================================ lower right -->
	<g opacity={swap(1 - w)}>
		{@render txt(584, 370, 'Two high tides and two low tides', 15, { weight: 600 })}
		{@render txt(584, 392, `every ${hm(LUNAR_DAY)}, one lunar day`, 15, { weight: 600 })}
		{@render txt(584, 424, 'The Earth turns once in 24 h, but meanwhile the', 12, {
			muted: true
		})}
		{@render txt(584, 442, 'Moon moves on along its orbit: the town needs', 12, {
			muted: true
		})}
		{@render txt(584, 460, `${hm(LUNAR_DAY)} to come back under it, so`, 12, {
			muted: true
		})}
		{@render txt(584, 478, `high tides are ${hm(LUNAR_DAY / 2)} apart.`, 12, { muted: true })}
	</g>

	<g opacity={swap(w)}>
		{@render txt(584, 350, 'Tidal range through the month', 14, { weight: 600 })}
		{@render txt(928, 350, '× the Moon alone', 11, { anchor: 'end', muted: true })}
		{#each [0, 0.5, 1, 1.5] as v (v)}
			<line x1={MX0} x2={MX1} y1={my(v)} y2={my(v)} stroke="var(--stage-grid)" stroke-width="1" />
			{@render txt(MX0 - 6, my(v) + 4, `${v}×`, 11, { anchor: 'end', muted: true })}
		{/each}
		<path d={monthPath} fill="none" stroke="var(--sky-ocean)" stroke-width="2" />
		{#each [0, 7, 15, 22, 29] as d (d)}
			{@render txt(mx(d), MY1 + 18, `${d}`, 11, { anchor: 'middle', muted: true })}
		{/each}
		{@render txt((MX0 + MX1) / 2, MY1 + 36, 'days since new Moon', 11, {
			anchor: 'middle',
			muted: true
		})}
		{#each [0, 0.5, 1] as f (f)}
			{@render txt(mx(f * SYNODIC_MONTH), my(rangeAt(0)) - 8, 'spring', 11, {
				anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle',
				opacity: clearOf(f)
			})}
		{/each}
		{#each [0.25, 0.75] as f (f)}
			{@render txt(mx(f * SYNODIC_MONTH), my(rangeAt(SYNODIC_MONTH / 4)) + 18, 'neap', 11, {
				anchor: 'middle',
				opacity: clearOf(f)
			})}
		{/each}
		<line
			x1={mx(markDay)}
			x2={mx(markDay)}
			y1={MY0 - 4}
			y2={MY1}
			stroke={ink}
			stroke-width="1"
			opacity="0.5"
		/>
		<circle
			cx={mx(markDay)}
			cy={my(rangeNow)}
			r="5"
			fill={ink}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		{@render txt(584, 552, `Spring tides ≈ ${springNeap}× neap tides`, 14, { weight: 600 })}
		{@render txt(584, 572, `Range now: ${rangeNow.toFixed(2)}× the Moon's alone`, 12, {
			muted: true
		})}
	</g>
</g>
