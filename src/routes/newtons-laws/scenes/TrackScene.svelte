<script lang="ts">
	/**
	 * A car on a roller-coaster track the reader shapes, with its energy in bars.
	 *
	 * Phases (`step.hints.phase`):
	 *   free     — no friction: kinetic + potential is constant, the car swings for
	 *              ever and never climbs above its release height
	 *   friction — μ from `params.mu`: each climb is lower (turning points marked),
	 *              the lost energy shows up as heat, the total stays the same
	 *
	 * The six control heights live in `params.track` ("10,2,6.5,1,4.5,11.5"),
	 * written by the round handles, so they survive the move between the steps.
	 * The ride is computed once per track/μ (`ride` in physics.ts) and replayed
	 * as a function of the time since it was released (see `since` below).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { G, ride, trackThrough } from '../physics';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- geometry: one scale for both axes, so drawn slopes are true slopes --------
	const LENGTH = 25; // m
	const S = 24; // px per metre
	const X0 = 72;
	const GY = 520; // ground
	const X1 = X0 + LENGTH * S;
	const HMIN = 0.5;
	const HMAX = 12;
	const MASS = 1; // kg
	const DEFAULT = [10, 2, 6.5, 1, 4.5, 11.5];
	const N = DEFAULT.length;
	const HOLD = 0.6; // s at rest at the release point before the car rolls
	const CAR = 18; // half the car's length, px
	const sx = (x: number) => X0 + x * S;
	const sy = (h: number) => GY - h * S;
	const handleX = (i: number) => sx((i * LENGTH) / (N - 1));
	const pillW = (text: string, size: number) => text.length * size * 0.52 + 16;

	const phase = $derived(String(step.hints?.phase ?? 'free'));
	const friction = $derived(phase === 'friction');
	// `params.mu` holds the slider's value on every step: the first step has none.
	const mu = $derived(friction ? Math.max(0, Number(params.mu ?? 0.04)) : 0);

	const heights = $derived.by(() => {
		const raw = String(params.track ?? '')
			.split(',')
			.map(Number);
		return raw.length === N && raw.every(Number.isFinite)
			? raw.map((h) => Math.min(HMAX, Math.max(HMIN, h)))
			: DEFAULT;
	});
	const track = $derived(trackThrough(heights, LENGTH));
	const h0 = $derived(heights[0]);
	const E0 = $derived(MASS * G * h0);

	// ---- the ride (precomputed; ~3–10 ms) --------------------------------------------
	const SAMPLE = 0.02; // ride() records every 20 ms
	const motion = $derived.by(() => {
		const duration = mu > 0 ? 120 : 60;
		const samples = ride(track, MASS, mu, duration);
		// Turning points: v changes sign while slow (a buffer bounce flips v at
		// speed), away from the buffers, and not within 0.5 s of the last one (a
		// car pinned against a buffer jitters).
		const turns: { t: number; x: number; h: number }[] = [];
		let settled = Infinity;
		let period = 0;
		for (let i = 1; i < samples.length; i++) {
			const a = samples[i - 1];
			const b = samples[i];
			if (mu > 0 && b.v === 0 && a.v !== 0) {
				settled = b.t;
				break;
			}
			if (Math.sign(a.v) !== Math.sign(b.v) && Math.abs(a.v) + Math.abs(b.v) < 1) {
				const u = Math.abs(a.v) / (Math.abs(a.v) + Math.abs(b.v) || 1);
				const x = a.x + (b.x - a.x) * u;
				const tt = a.t + (b.t - a.t) * u;
				// Without friction the motion repeats exactly once the car is back at
				// the release point, at rest: replay it from there for ever.
				if (mu === 0 && x < 0.05 && tt > 1) {
					period = tt;
					break;
				}
				const last = turns[turns.length - 1];
				if (x > 0.05 && x < LENGTH - 0.05 && (!last || tt - last.t > 0.5))
					turns.push({ t: tt, x, h: track.h(x) });
			}
		}
		// A car that never moves (a flat start with friction) is settled at once.
		if (mu > 0 && samples.every((s) => s.v === 0)) settled = 0;
		// A track that climbs (or runs level) from the release point: the car only
		// presses against the left buffer (the integrator would leave some jitter).
		const pinned = track.dh(0) >= 0;
		return { samples, turns, settled, period, duration, pinned };
	});

	// Time since release. The ride restarts when the track or μ changes: remember
	// the clock reading at that moment (a frame-to-frame memo inside a $derived, the
	// guide's sanctioned exception for state a pure function of t cannot hold).
	// While a handle is dragged the key changes every move, so the car waits at the
	// top. Under reduced motion t is frozen (see `elapsed`).
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (reduced) return t;
		const key = `${heights.join(',')}|${mu}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	// The still, reduced-motion frame: the car rolling down from a turning point
	// (the first one without friction, the fourth with it), so that the marks
	// and the heat bar agree; 1.9 s into the ride when there are not that many.
	const still = $derived.by(() => {
		const turn = motion.turns[friction ? 3 : 0];
		return turn ? turn.t + 1.5 : 2.5 - HOLD;
	});
	const elapsed = $derived(reduced ? still : Math.max(0, since - HOLD));
	const tau = $derived(
		motion.period > 0 ? elapsed % motion.period : Math.min(elapsed, motion.duration)
	);

	const now = $derived.by(() => {
		if (motion.pinned) return { x: 0, speed: 0, kinetic: 0, potential: E0, heat: 0 };
		const s = motion.samples;
		const f = Math.min(s.length - 1, tau / SAMPLE);
		const i = Math.max(0, Math.min(s.length - 2, Math.floor(f)));
		const u = Math.min(1, f - i);
		const a = s[i];
		const b = s[i + 1];
		// Interpolate the size of the speed (a buffer bounce flips its sign between samples).
		const speed = Math.abs(a.v) + (Math.abs(b.v) - Math.abs(a.v)) * u;
		// Across a bounce x folds back at the buffer: take the nearer sample instead.
		const bounce = Math.sign(a.v) !== Math.sign(b.v) && Math.abs(a.v) > 0.5;
		const x = bounce ? (u < 0.5 ? a.x : b.x) : a.x + (b.x - a.x) * u;
		const kinetic = 0.5 * MASS * speed * speed;
		const potential = MASS * G * track.h(x);
		// Whatever is missing went into heat (the same bookkeeping as ride()).
		const heat = mu > 0 ? Math.max(0, E0 - kinetic - potential) : 0;
		return { x, speed, kinetic, potential, heat };
	});

	// ---- drawing the track ------------------------------------------------------------
	const trackPath = $derived.by(() => {
		const pts: string[] = [];
		for (let i = 0; i <= LENGTH * 10; i++) {
			const x = i / 10;
			pts.push(`${sx(x).toFixed(1)} ${sy(track.h(x)).toFixed(1)}`);
		}
		return 'M' + pts.join(' L');
	});
	// Straight run-outs past both ends, to the buffers (as long as half the car).
	const ends = $derived(
		[0, LENGTH].map((x) => {
			const dir = x === 0 ? -1 : 1;
			const s = track.dh(x);
			const n = Math.hypot(1, s);
			const p = { x: sx(x), y: sy(track.h(x)) };
			const q = { x: p.x + (dir * (CAR + 4)) / n, y: p.y - (dir * (CAR + 4) * s) / n };
			return { id: x, p, q, angle: (-Math.atan(s) * 180) / Math.PI };
		})
	);
	const supports = $derived(
		Array.from({ length: LENGTH + 1 }, (_, i) => ({ x: sx(i), y: sy(track.h(i)) }))
	);

	// The car, standing on the rails and tilted with them.
	const car = $derived({
		x: sx(now.x),
		y: sy(track.h(now.x)),
		angle: (-Math.atan(track.dh(now.x)) * 180) / Math.PI
	});

	// Turning points reached so far (none for a car that never leaves the buffer).
	const turnsShown = $derived.by(() => {
		const list = motion.pinned ? [] : motion.turns.filter((p) => p.t <= elapsed).slice(0, 24);
		const out: {
			key: number;
			x: number;
			y: number;
			h: number;
			lx: number;
			ly: number;
			anchor: string;
			label: boolean;
		}[] = [];
		for (const p of list) {
			const x = sx(p.x);
			const y = sy(p.h);
			if (out.some((o) => Math.hypot(o.x - x, o.y - y) < 5)) continue;
			// Label in the open air above the track, along its upward normal.
			const s = track.dh(p.x);
			const n = Math.hypot(1, s);
			// On a steep slope that is beside it: the text then runs away from the track.
			const nx = -s / n;
			const lx = x + nx * 32;
			let ly = y - (1 / n) * 32 + 4;
			// Keep clear of the dashed release line (just below it is open air).
			const line = sy(h0);
			if (ly > line - 3 && ly < line + 12) ly = line + 14;
			const anchor = nx < -0.45 ? 'end' : nx > 0.45 ? 'start' : 'middle';
			const mid = (o: { lx: number; anchor: string }) =>
				o.anchor === 'end' ? o.lx - 17 : o.anchor === 'start' ? o.lx + 17 : o.lx;
			const label = !out.some(
				(o) => o.label && Math.abs(mid(o) - mid({ lx, anchor })) < 42 && Math.abs(o.ly - ly) < 16
			);
			out.push({ key: p.t, x, y, h: p.h, lx, ly, anchor, label });
		}
		return out;
	});
	// A label fades while the car passes over it.
	const clearOfCar = (p: { lx: number; ly: number; anchor: string }) => {
		const cx = p.anchor === 'end' ? p.lx - 16 : p.anchor === 'start' ? p.lx + 16 : p.lx;
		const n = Math.hypot(1, track.dh(now.x));
		// the middle of the car's body, ~15 px above the rails
		const bx = car.x - (15 * -track.dh(now.x)) / n;
		const by = car.y - 15 / n;
		const nearCar = smoothstep(30, 48, Math.hypot(cx - bx, p.ly - 4 - by));
		// …and under the "at rest" callout.
		const underPill =
			!motion.pinned &&
			Math.abs(cx - restPill.x) < restPill.w / 2 + 20 &&
			Math.abs(p.ly - restPill.y) < 20;
		return nearCar * (underPill ? 1 - atRest : 1);
	};

	// The release-height label sits above the dashed line, where the track (and the
	// car on it) stays below it.
	// Two short lines (the second only without friction), placed as one block.
	const releaseLines = $derived(
		mu > 0
			? [`released from ${h0.toFixed(1)} m`]
			: [`released from ${h0.toFixed(1)} m`, 'the car never climbs above this line']
	);
	const releaseLabel = $derived.by(() => {
		const w = Math.max(...releaseLines.map((l) => l.length)) * 6.2;
		const up = (releaseLines.length - 1) * 15; // extra height of the block
		const y = sy(h0);
		for (let x = sx(0) + 40; x <= X1 - w; x += 8) {
			let clear = true;
			for (let px = x - 6; px <= x + w + 6 && clear; px += 6) {
				const xm = Math.min(LENGTH, Math.max(0, (px - X0) / S));
				if (sy(track.h(xm)) < y + 30) clear = false; // room for the car below it
			}
			if (clear) return { x, y: y - 8 - up };
		}
		// Otherwise just below the line, under a track that climbs above it…
		for (let x = sx(0) + 40; x <= X1 - w; x += 8) {
			let clear = y + 18 + up < GY - 4;
			for (let px = x - 6; px <= x + w + 6 && clear; px += 6) {
				const xm = Math.min(LENGTH, Math.max(0, (px - X0) / S));
				if (sy(track.h(xm)) > y - 12) clear = false;
			}
			if (clear) return { x, y: y + 18 };
		}
		// …or, on a track that runs along the line, above the car.
		return { x: sx(0) + 40, y: y - 38 - up };
	});

	// ---- energy bars --------------------------------------------------------------------
	const BASE = 470;
	const PER_J = 2.5; // px per joule: 120 J fills a column
	const BW = 34;
	const cols = { kinetic: 744, potential: 800, heat: 856, total: 904 };
	const bar = (j: number) => Math.max(0, j * PER_J);
	// Whole joules that add up to the shown total (largest remainder).
	const shown = $derived.by(() => {
		const parts = [now.kinetic, now.potential, now.heat];
		const total = Math.round(E0);
		const whole = parts.map(Math.floor);
		let left = total - whole.reduce((a, b) => a + b, 0);
		const order = parts.map((p, i) => ({ i, r: p - Math.floor(p) })).sort((a, b) => b.r - a.r);
		for (const o of order) {
			if (left <= 0) break;
			whole[o.i] += 1;
			left -= 1;
		}
		return { kinetic: whole[0], potential: whole[1], heat: whole[2], total };
	});
	const columns = $derived([
		{
			id: 'kinetic',
			j: now.kinetic,
			n: shown.kinetic,
			color: 'var(--mech-kinetic)',
			x: cols.kinetic
		},
		{
			id: 'potential',
			j: now.potential,
			n: shown.potential,
			color: 'var(--mech-potential)',
			x: cols.potential
		},
		{ id: 'heat', j: now.heat, n: shown.heat, color: 'var(--mech-heat)', x: cols.heat }
	]);

	// ---- phase focus ----------------------------------------------------------------------
	const heatFocus = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const on = friction;
		untrack(() => heatFocus.set(on ? 1 : 0, { duration: reduced ? 0 : 800 }));
	});
	const heatW = $derived(heatFocus.current);
	// The car has come to rest for good.
	const restText = $derived.by(() => {
		if (motion.pinned)
			return Math.abs(track.dh(0)) < 0.02
				? 'The car stays put: nothing pulls it along a level track.'
				: 'The car stays put against the buffer: the track climbs from the release point.';
		if (!(motion.settled < Infinity)) return '';
		const x =
			motion.samples[Math.min(motion.samples.length - 1, Math.round(motion.settled / SAMPLE))].x;
		const h = track.h(x);
		const valley = [-0.6, 0.6].every(
			(d) => track.h(Math.min(LENGTH, Math.max(0, x + d))) >= h - 0.02
		);
		return valley ? 'at rest in a valley' : 'at rest';
	});
	const atRest = $derived(
		motion.pinned
			? smoothstep(0.2, 0.8, elapsed)
			: friction && motion.settled < Infinity
				? smoothstep(0.4, 1.2, tau - motion.settled)
				: 0
	);
	const restPill = $derived({ x: car.x, y: car.y - 48, w: pillW(restText, 12) });

	// Inviting pulse on the handles at the start of the first step.
	const pulse = $derived(
		reduced || friction ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5))
	);

	// ---- interaction ----------------------------------------------------------------------
	function setHeight(i: number, h: number) {
		const next = heights.slice();
		next[i] = Math.round(Math.min(HMAX, Math.max(HMIN, h)) * 10) / 10;
		if (next[i] === heights[i]) return;
		setParam('track', next.join(','));
	}
	const onmove = (i: number) => (p: Point) => setHeight(i, (GY - p.y) / S);
	const onkey = (i: number) => (k: number | 'start' | 'end') =>
		setHeight(i, k === 'start' ? HMIN : k === 'end' ? HMAX : heights[i] + k * 0.5);

	const fmt = (v: number) => (Math.abs(v) < 0.05 ? '0' : v.toFixed(1));
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
		style:fill={opts.color}>{text}</text
	>
{/snippet}

<g>
	<!-- height grid and scale -->
	{#each [0, 2, 4, 6, 8, 10, 12] as h (h)}
		<line x1={X0 - 24} x2={X1} y1={sy(h)} y2={sy(h)} stroke="var(--stage-grid)" />
		{@render txt(X0 - 30, sy(h) + 4, h === 12 ? '12 m' : String(h), 11, {
			anchor: 'end',
			muted: true
		})}
	{/each}

	<!-- ground -->
	<rect x={X0 - 24} y={GY} width={X1 - X0 + 54} height="10" rx="3" fill="var(--mech-ground)" />

	<!-- supports -->
	{#each supports as s, i (i)}
		<line x1={s.x} x2={s.x} y1={s.y + 3} y2={GY} stroke="var(--stage-line)" stroke-width="1" />
	{/each}

	<!-- release height: the ceiling without friction -->
	<line
		x1={sx(0)}
		x2={X1 + 8}
		y1={sy(h0)}
		y2={sy(h0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.3"
		stroke-dasharray="6 5"
	/>
	{#each releaseLines as line, i (i)}
		{@render txt(releaseLabel.x, releaseLabel.y + i * 15, line, 12, { muted: true })}
	{/each}

	<!-- rails, run-outs and buffers -->
	<path
		d={trackPath}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="3"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	{#each ends as e (e.id)}
		<line
			x1={e.p.x}
			y1={e.p.y}
			x2={e.q.x}
			y2={e.q.y}
			stroke="var(--stage-ink)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<g transform="translate({e.q.x} {e.q.y}) rotate({e.angle})">
			<rect x="-3.5" y="-24" width="7" height="27" rx="2.5" fill="var(--stage-ink-muted)" />
		</g>
		{@render txt(e.q.x, GY + 28, 'buffer', 11, { anchor: 'middle', muted: true })}
	{/each}

	<!-- turning points: where the car stopped climbing and rolled back -->
	{#each turnsShown as p (p.key)}
		<circle
			cx={p.x}
			cy={p.y}
			r="4"
			fill="var(--stage-bg)"
			stroke="var(--mech-heat)"
			stroke-width="2"
		/>
		{#if p.label}
			{@render txt(p.lx, p.ly, `${p.h.toFixed(1)} m`, 12, {
				anchor: p.anchor,
				weight: 600,
				opacity: clearOfCar(p)
			})}
		{/if}
	{/each}

	<!-- the car -->
	<g transform="translate({car.x} {car.y}) rotate({car.angle})">
		<rect
			x={-CAR}
			y="-25"
			width={CAR * 2}
			height="16"
			rx="4"
			fill="var(--mech-cart)"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		{#each [-10, 10] as wx (wx)}
			<circle cx={wx} cy="-5" r="5" fill="var(--stage-ink)" />
			{#if heatW > 0.01 && now.heat > 0}
				<!-- warm wheels -->
				<circle
					cx={wx}
					cy="-5"
					r="3"
					fill="var(--mech-heat)"
					opacity={heatW * Math.min(1, (1.4 * now.heat) / E0)}
				/>
			{/if}
		{/each}
	</g>
	{#if atRest > 0.01 && motion.pinned}
		{@render txt(X0 - 30, 92, restText, 13, { weight: 600, opacity: atRest })}
	{:else if atRest > 0.01}
		{@render txt(
			Math.min(944 - restPill.w / 2, Math.max(16 + restPill.w / 2, restPill.x)),
			restPill.y,
			restText,
			12,
			{
				anchor: 'middle',
				weight: 600,
				opacity: atRest,
				pill: true
			}
		)}
	{/if}

	<!-- handles -->
	{#each heights as h, i (i)}
		{#if pulse > 0.01}
			<circle
				cx={handleX(i)}
				cy={sy(h)}
				r={16 + 10 * pulse}
				fill="none"
				stroke="var(--explainer-accent)"
				stroke-width="2"
				opacity={0.5 * pulse}
			/>
		{/if}
		<Handle
			x={handleX(i)}
			y={sy(h)}
			r={8}
			label={i === 0 ? 'Release height' : `Track height ${i + 1}`}
			value={h}
			min={HMIN}
			max={HMAX}
			valuetext="{h.toFixed(1)} metres"
			onmove={onmove(i)}
			onkey={onkey(i)}
		/>
	{/each}

	<!-- legend -->
	{#if !friction}
		{@render txt(X0 - 30, 40, 'Drag the round handles up or down to reshape the track', 12, {
			muted: true
		})}
	{/if}
	<circle
		cx={X0 - 26}
		cy={60}
		r="4"
		fill="var(--stage-bg)"
		stroke="var(--mech-heat)"
		stroke-width="2"
	/>
	{@render txt(X0 - 16, 64, 'where the car turned back, and the height it reached', 12, {
		muted: true
	})}

	<!-- ================= energy bars ================= -->
	{@render txt(716, 40, 'Energy of the 1 kg car', 15, { weight: 600 })}
	{@render txt(716, 60, friction ? 'kinetic + potential + heat' : 'kinetic + potential', 12, {
		muted: true
	})}

	{#each columns as c (c.id)}
		<g opacity={c.id === 'heat' ? 0.4 + 0.6 * heatW : 1}>
			<rect
				x={c.x - BW / 2}
				y={BASE - 120 * PER_J}
				width={BW}
				height={120 * PER_J}
				rx="4"
				fill="var(--stage-grid)"
			/>
			<rect x={c.x - BW / 2} y={BASE - bar(c.j)} width={BW} height={bar(c.j)} fill={c.color} />
			{@render txt(c.x, BASE - bar(c.j) - 8, `${c.n} J`, 13, { anchor: 'middle', weight: 600 })}
			{@render txt(c.x, BASE + 20, c.id, 12, { anchor: 'middle', color: c.color, weight: 600 })}
		</g>
	{/each}

	<!-- total: the three stacked -->
	<line x1="879" x2="879" y1={BASE - 120 * PER_J} y2={BASE + 36} stroke="var(--stage-line)" />
	<rect
		x={cols.total - BW / 2}
		y={BASE - 120 * PER_J}
		width={BW}
		height={120 * PER_J}
		rx="4"
		fill="var(--stage-grid)"
	/>
	<rect
		x={cols.total - BW / 2}
		y={BASE - bar(now.potential)}
		width={BW}
		height={bar(now.potential)}
		fill="var(--mech-potential)"
	/>
	<rect
		x={cols.total - BW / 2}
		y={BASE - bar(now.potential + now.kinetic)}
		width={BW}
		height={bar(now.kinetic)}
		fill="var(--mech-kinetic)"
	/>
	<rect
		x={cols.total - BW / 2}
		y={BASE - bar(now.potential + now.kinetic + now.heat)}
		width={BW}
		height={bar(now.heat)}
		fill="var(--mech-heat)"
	/>
	<!-- the energy at release -->
	<line
		x1={cols.kinetic - BW / 2 - 4}
		x2={cols.total + BW / 2 + 4}
		y1={BASE - bar(E0)}
		y2={BASE - bar(E0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.3"
		stroke-dasharray="6 5"
	/>
	{@render txt(cols.total, BASE - bar(E0) - 8, `${shown.total} J`, 13, {
		anchor: 'middle',
		weight: 700
	})}
	{@render txt(cols.total, BASE + 20, 'total', 12, { anchor: 'middle', weight: 600 })}
	{@render txt(cols.total, BASE + 35, 'never changes', 11, { anchor: 'middle', muted: true })}

	<!-- readout -->
	{@render txt(716, 540, `speed ${fmt(now.speed)} m/s`, 13, { weight: 600 })}
	{@render txt(716, 560, `height ${fmt(track.h(now.x))} m`, 13, { weight: 600 })}
	{#if friction}
		{@render txt(944, 560, `μ = ${mu.toFixed(2)}`, 13, { anchor: 'end', muted: true })}
	{/if}
</g>
