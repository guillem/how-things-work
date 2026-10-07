<script lang="ts">
	/**
	 * A ball launched from the ground, drawn to scale (equal metres on both axes).
	 *
	 * Phases (`step.hints.phase`), cross-faded with tweens:
	 *   basic — one flight; at the ball, the two parts of the velocity (horizontal,
	 *           constant; vertical, shrinking and reversing) and the weight; dots
	 *           at equal time intervals show the equal steps sideways
	 *   range — faint paths for 15°…75° at the same speed, with their landing
	 *           marks (15°/75° and 30°/60° land together, 45° furthest)
	 *   drag  — the flight with air resistance (bold) next to the same throw in a
	 *           vacuum (dashed), the forces on the ball (weight and air), and the
	 *           best angle with this air (a dotted path)
	 *
	 * Air resistance only applies where the step offers the `air` control: the
	 * other steps say "ignoring the air", whatever the slider was left at.
	 *
	 * The ball is a pure function of t: it replays the flight every flight time
	 * + 1.5 s (very short flights are shown in slow motion, and say so). The
	 * replay jumps when a control changes the flight time mid-flight; the full
	 * path is always drawn faintly, so the drawing follows the sliders at once.
	 *
	 * The distance scale depends on the launch speed only (never on the angle,
	 * so paths at different angles compare), stepping between "nice" axis
	 * lengths with a tween: within a band, faster throws visibly go further.
	 *
	 * The launch arrow's tip is a Handle: dragging it sets speed and angle; its
	 * keys change the angle (a Handle reports one value).
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { G, at, bestAngle, flight, summary, type Sample2D } from '../physics';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	// ---- layout ----------------------------------------------------------------
	const X0 = 84; // launch point
	const GY = 500; // ground
	const W = 750; // width of the axis length `xmax`
	const RULER = 60; // x of the height ruler
	const VS = 4.5; // velocity arrows: px per m/s
	const WEIGHT = 34; // length of the weight arrow (px)
	const PX = 612; // readout panel
	const COL1 = 800; // panel value columns (right edges)
	const COL2 = 912;
	const PAUSE = 1.5; // seconds between replays
	const MIN_SHOWN = 1.6; // shorter flights are replayed in slow motion

	// ---- inputs ----------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'basic'));
	const offered = $derived(new Set((step.controls ?? []).map((c) => c.id)));
	const speed = $derived(clamp(Number(params.speed ?? 18), 5, 30));
	const angle = $derived(clamp(Number(params.angle ?? 45), 5, 85));
	const k = $derived(offered.has('air') ? clamp(Number(params.air ?? 0), 0, 0.05) : 0);

	// ---- flights (recomputed only when a control changes) ------------------------
	interface Flight {
		raw: Sample2D[];
		/** Evenly spaced in time, for drawing. */
		pts: Sample2D[];
		/** Arc length (m) up to each of `pts`. */
		cum: number[];
		time: number;
		range: number;
		height: number;
		land: Sample2D;
	}
	const N = 160;
	function prep(raw: Sample2D[]): Flight {
		const s = summary(raw);
		const pts: Sample2D[] = [];
		const cum: number[] = [];
		let c = 0;
		for (let i = 0; i <= N; i++) {
			const p = at(raw, (s.time * i) / N);
			if (i > 0) c += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
			pts.push(p);
			cum.push(c);
		}
		return {
			raw,
			pts,
			cum,
			time: s.time,
			range: s.range,
			height: s.height,
			land: raw[raw.length - 1]
		};
	}
	const main = $derived(prep(flight(speed, angle, k)));
	const vacuum = $derived(k > 0 ? prep(flight(speed, angle, 0)) : main);

	const GHOSTS = [15, 30, 45, 60, 75];
	const ghosts = $derived(GHOSTS.map((a) => ({ a, f: prep(flight(speed, a, 0, 0.01)) })));

	// bestAngle runs 81 flights: cache it per (speed, air).
	// A plain cache, deliberately outside reactivity (written inside a $derived).
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const bestCache = new Map<string, number>();
	const best = $derived.by(() => {
		if (!offered.has('air')) return 45;
		const key = `${speed}|${k}`;
		let b = bestCache.get(key);
		if (b === undefined) {
			b = bestAngle(speed, k);
			bestCache.set(key, b);
		}
		return b;
	});
	const bestFlight = $derived(offered.has('air') ? prep(flight(speed, best, k)) : main);

	// "Double the speed → 4× the range": compare with half (or double) the speed.
	const other = $derived.by(() => {
		const v = speed > 15 ? speed / 2 : speed * 2;
		return { v, range: summary(flight(v, angle, 0)).range };
	});

	// ---- scale -----------------------------------------------------------------
	const NICE = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100];
	const xmaxTarget = $derived(NICE.find((n) => n >= (speed * speed) / G) ?? 100);
	const xmax = new Tween(0, { duration: 800, easing: cubicInOut });

	// ---- phase cross-fades --------------------------------------------------------
	const phases = ['basic', 'range', 'drag'] as const;
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<(typeof phases)[number], Tween<number>>;
	let first = true;
	$effect(() => {
		const current = phase;
		const target = xmaxTarget;
		untrack(() => {
			const d = first || reduced ? 0 : 1;
			for (const p of phases) weights[p].set(p === current ? 1 : 0, { duration: 700 * d });
			xmax.set(target, { duration: 800 * d });
			first = false;
		});
	});
	const w = $derived({
		basic: weights.basic.current,
		range: weights.range.current,
		drag: weights.drag.current
	});
	// Panel blocks share lines: the old one goes in the first half of the fade.
	const panel = $derived({
		basic: smoothstep(0.5, 1, w.basic),
		range: smoothstep(0.5, 1, w.range),
		drag: smoothstep(0.5, 1, w.drag)
	});

	const xm = $derived(xmax.current || xmaxTarget);
	const s = $derived(W / xm); // px per metre
	const px = (x: number) => X0 + x * s;
	const py = (y: number) => GY - y * s;
	const pathD = (f: Flight) =>
		f.pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join('');

	const mainD = $derived(pathD(main));
	const vacuumD = $derived(pathD(vacuum));
	const bestD = $derived(pathD(bestFlight));
	const ghostDs = $derived(
		w.range > 0.01 ? ghosts.map((g) => ({ a: g.a, f: g.f, d: pathD(g.f) })) : []
	);

	// Axis ticks: at most 8 per axis length.
	const tickStep = $derived([0.5, 1, 2, 5, 10, 20].find((st) => xm / st <= 8) ?? 20);
	const xTicks = $derived.by(() => {
		const out: number[] = [];
		for (let v = 0; px(v) <= 930; v += tickStep) out.push(v);
		return out;
	});
	const yTicks = $derived.by(() => {
		const out: number[] = [];
		for (let v = tickStep; py(v) >= 120; v += tickStep) out.push(v);
		return out;
	});

	// ---- time ------------------------------------------------------------------
	const shown = $derived(Math.max(main.time, MIN_SHOWN));
	const slow = $derived(shown / main.time); // slow-motion factor (1 = real time)
	const period = $derived(shown + PAUSE);
	const u = $derived(reduced ? 0.25 * shown : t % period);
	const tf = $derived(Math.min(u, shown) / slow); // time into the flight (s)
	const ball = $derived(at(main.raw, tf));
	// After landing the arrows go; at the end of the pause, the ball and trace too.
	const arrowsOn = $derived(reduced ? 1 : 1 - smoothstep(shown, shown + 0.25, u));
	const replayFade = $derived(reduced ? 1 : 1 - smoothstep(period - 0.35, period, u));
	const traceLen = $derived.by(() => {
		if (reduced) return main.cum[N];
		const i = clamp((tf / main.time) * N, 0, N);
		const lo = Math.floor(i);
		const hi = Math.min(N, lo + 1);
		return main.cum[lo] + (main.cum[hi] - main.cum[lo]) * (i - lo);
	});

	// Dots at equal time intervals (basic phase): at most 8 of them.
	const dotEvery = $derived([0.1, 0.2, 0.25, 0.5, 1].find((d) => main.time / d <= 8) ?? 1);
	const dots = $derived.by(() => {
		const out: { id: number; p: Sample2D }[] = [];
		for (let i = 1; i * dotEvery < main.time - 1e-6; i++)
			out.push({ id: i, p: at(main.raw, i * dotEvery) });
		return out;
	});

	// ---- arrows at the ball ---------------------------------------------------------
	const B = $derived({ x: px(ball.x), y: py(ball.y) });
	const vxLen = $derived(ball.vx * VS);
	const vyLen = $derived(ball.vy * VS); // + is up
	const vNow = $derived(Math.hypot(ball.vx, ball.vy));
	// Air force relative to the weight: k·v² / g (same mass).
	const airLen = $derived((WEIGHT * k * vNow * vNow) / G);
	const airDir = $derived(vNow > 1e-6 ? { x: -ball.vx / vNow, y: ball.vy / vNow } : { x: 0, y: 0 });

	// The horizontal part's label goes just past its arrowhead, on the arrow's
	// line (the vertical label is then above or below it); near the right edge
	// it moves over the arrow, on the side away from the vertical arrow.
	const hLabel = $derived(
		B.x + vxLen + 64 <= 944
			? { x: B.x + vxLen + 8, y: B.y + 4, anchor: 'start' }
			: { x: B.x + vxLen / 2, y: B.y + (ball.vy >= 0 ? 19 : -9), anchor: 'middle' }
	);

	// The vertical part's label: while rising, on the left (the path ahead
	// climbs to the right), unless that would leave the stage; while falling, on
	// the right (the weight and its label are on the left).
	const vLabelLeft = $derived(ball.vy >= 0 && B.x - 90 >= RULER + 8);
	// The weight's label: left of its arrow, unless the height ruler is there.
	const weightLeft = $derived(B.x - 64 >= RULER + 8);

	// The air arrow lies along the trace behind the ball: its label goes beside
	// its middle, on the upper side (the path curves away below its tangent).
	const airLabel = $derived.by(() => {
		const n = airDir.x >= 0 ? { x: airDir.y, y: -airDir.x } : { x: -airDir.y, y: airDir.x };
		const m = 8 + airLen / 2;
		return {
			x: B.x + airDir.x * m + n.x * 10,
			y: B.y + airDir.y * m + n.y * 10 + 4,
			anchor: n.x < -0.3 ? 'end' : n.x > 0.3 ? 'start' : 'middle'
		};
	});

	// ---- launch arrow & handle --------------------------------------------------------
	const rad = $derived((angle * Math.PI) / 180);
	const tip = $derived({
		x: X0 + VS * speed * Math.cos(rad),
		y: GY - VS * speed * Math.sin(rad)
	});
	function onmove(p: Point) {
		const dx = p.x - X0;
		const dy = GY - p.y;
		const a = (Math.atan2(dy, dx) * 180) / Math.PI;
		setParam('angle', clamp(Math.round(a), 5, 85));
		setParam('speed', clamp(Math.round(Math.hypot(dx, dy) / VS), 5, 30));
	}
	function onkey(key: number | 'start' | 'end') {
		if (key === 'start') return setParam('angle', 5);
		if (key === 'end') return setParam('angle', 85);
		setParam('angle', clamp(angle + key, 5, 85));
	}

	// ---- text ------------------------------------------------------------------
	const m1 = (v: number) => `${v.toFixed(1)} m`;
	const sec = (v: number) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} s`;
	const ms = (v: number) => `${Math.abs(v).toFixed(1)} m/s`;
	const vText = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
	const landAngle = (f: Flight) => Math.round((Math.atan2(-f.land.vy, f.land.vx) * 180) / Math.PI);
	const pillW = (text: string, size: number) => text.length * size * 0.52 + 14;
	const tickText = (v: number) => (v === 0 ? '0' : `${Number(v.toFixed(1))} m`);
	const dotLabel = $derived(dotEvery === 1 ? 'every second' : `every ${dotEvery} s`);

	// Landing marks of the range phase.
	const pairs = $derived(
		w.range > 0.01
			? [
					{ id: 'p15', x: ghosts[0].f.range, text: '15° and 75°' },
					{ id: 'p30', x: ghosts[1].f.range, text: '30° and 60°' },
					{ id: 'p45', x: ghosts[2].f.range, text: '45°: furthest' }
				]
			: []
	);

	const bestShown = $derived(k > 0 && best !== angle);
	const bestText = $derived(
		k === 0
			? 'no air: the same path as in a vacuum'
			: best >= 45
				? 'best angle with this air: still 45°'
				: `best angle with this air: ${best}° (vacuum: 45°)`
	);
	const rangePill = $derived(m1(main.range));
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
			x={opts.anchor === 'start' ? x - 7 : opts.anchor === 'end' ? x - pw + 7 : x - pw / 2}
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

{#snippet arrow(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: string,
	opacity: number,
	width = 2.2
)}
	{#if Math.hypot(x2 - x1, y2 - y1) > 10 && opacity > 0.01}
		<line
			{x1}
			{y1}
			{x2}
			{y2}
			stroke={color}
			stroke-width={width}
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
			{opacity}
		/>
	{/if}
{/snippet}

<g>
	<!-- ================= ground, axes ================= -->
	<rect x="16" y={GY} width="928" height="7" rx="2" fill="var(--mech-ground)" />
	<line x1="16" x2="944" y1={GY} y2={GY} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each xTicks as v (v)}
		<line x1={px(v)} x2={px(v)} y1={GY} y2={GY + 12} stroke="var(--stage-line)" />
		{@render txt(px(v), GY + 27, tickText(v), 12, { anchor: 'middle', muted: true })}
	{/each}
	<!-- height ruler (same scale as the ground) -->
	{#if yTicks.length}
		<line
			x1={RULER}
			x2={RULER}
			y1={GY}
			y2={py(yTicks[yTicks.length - 1])}
			stroke="var(--stage-line)"
		/>
		{#each yTicks as v (v)}
			<line x1={RULER - 5} x2={RULER + 5} y1={py(v)} y2={py(v)} stroke="var(--stage-line)" />
			{@render txt(RULER - 8, py(v) + 4, tickText(v), 12, { anchor: 'end', muted: true })}
		{/each}
		{@render txt(RULER, py(yTicks[yTicks.length - 1]) - 14, 'height', 11, {
			anchor: 'middle',
			muted: true
		})}
	{/if}

	<!-- ================= range: other angles ================= -->
	{#if w.range > 0.01}
		<g opacity={w.range}>
			{#each ghostDs as g (g.a)}
				<path
					d={g.d}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.3"
					opacity="0.75"
				/>
				{#if g.a !== angle}
					{@render txt(px(g.f.range / 2), py(g.f.height) - 7, `${g.a}°`, 11, {
						anchor: 'middle',
						muted: true
					})}
				{/if}
			{/each}
			{#each pairs as m (m.id)}
				<circle cx={px(m.x)} cy={GY} r="4" fill="var(--stage-ink-muted)" />
				{@render txt(px(m.x), GY + (m.id === 'p45' ? 72 : 52), m.text, 12, {
					anchor: 'middle',
					weight: m.id === 'p45' ? 600 : 500,
					opacity: smoothstep(0.5, 1, w.range) / Math.max(w.range, 0.01)
				})}
			{/each}
		</g>
	{/if}

	<!-- ================= drag: vacuum and best angle ================= -->
	{#if w.drag > 0.01 && k > 0}
		<g opacity={w.drag}>
			<path
				d={vacuumD}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.6"
				stroke-dasharray="6 5"
			/>
			<circle cx={px(vacuum.range)} cy={GY} r="4" fill="var(--stage-ink-muted)" />
			{#if bestShown}
				<path
					d={bestD}
					fill="none"
					stroke="var(--explainer-accent)"
					stroke-width="1.8"
					stroke-dasharray="1.5 4"
					stroke-linecap="round"
				/>
				<circle cx={px(bestFlight.range)} cy={GY} r="3.5" fill="var(--explainer-accent)" />
			{/if}
		</g>
	{/if}

	<!-- ================= the current flight ================= -->
	<!-- the full path, faint: it follows the controls at once -->
	<path
		d={mainD}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="1.4"
		opacity={reduced ? 0 : 0.22}
	/>
	<!-- the trace behind the ball -->
	<path
		d={mainD}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2.6"
		stroke-linecap="round"
		stroke-dasharray="{(traceLen * s).toFixed(1)} 100000"
		opacity={0.9 * replayFade}
	/>

	<!-- equal time steps (basic) -->
	{#if w.basic > 0.01}
		<g opacity={w.basic * replayFade}>
			{#each dots as d (d.id)}
				{#if reduced || tf >= d.p.t}
					<line
						x1={px(d.p.x)}
						x2={px(d.p.x)}
						y1={py(d.p.y) + 5}
						y2={GY}
						stroke="var(--stage-line)"
						stroke-dasharray="2 4"
					/>
					<circle cx={px(d.p.x)} cy={py(d.p.y)} r="3.5" fill="var(--stage-ink-muted)" />
				{/if}
			{/each}
		</g>
	{/if}

	<!-- landing mark and range -->
	<circle cx={px(main.range)} cy={GY} r="4.5" fill="var(--stage-ink)" />
	{@render txt(
		clamp(px(main.range), 16 + pillW(rangePill, 13) / 2, 944 - pillW(rangePill, 13) / 2),
		GY + 52,
		rangePill,
		13,
		{ anchor: 'middle', weight: 600, pill: true, opacity: 1 - smoothstep(0, 0.5, w.range) }
	)}
	{#if w.drag > 0.01 && bestShown}
		{@render txt(px(bestFlight.range), GY + 76, `best: ${best}°`, 12, {
			anchor: 'middle',
			weight: 600,
			color: 'var(--explainer-accent)',
			opacity: w.drag
		})}
	{/if}

	<!-- ================= launcher, ball and arrows ================= -->
	<path
		d="M{X0 - 13} {GY} A13 13 0 0 1 {X0 + 13} {GY} Z"
		fill="var(--mech-cart)"
		stroke="var(--stage-ink)"
		stroke-width="1"
		stroke-opacity="0.4"
	/>
	{@render arrow(X0, GY, tip.x, tip.y, 'var(--mech-velocity)', 0.55, 2.4)}

	<g opacity={replayFade}>
		<!-- basic: the two parts of the velocity, and the weight -->
		{#if w.basic > 0.01}
			{@const o = w.basic * arrowsOn}
			{@render arrow(B.x, B.y, B.x + vxLen, B.y, 'var(--mech-velocity)', o)}
			{@render arrow(B.x, B.y, B.x, B.y - vyLen, 'var(--mech-velocity)', o)}
			{@render arrow(B.x - 12, B.y + 6, B.x - 12, B.y + 6 + WEIGHT, 'var(--mech-force)', o)}
			{#if o > 0.01}
				{@render txt(hLabel.x, hLabel.y, ms(ball.vx), 12, {
					anchor: hLabel.anchor,
					weight: 600,
					color: 'var(--mech-velocity)',
					opacity: o
				})}
				{#if Math.abs(vyLen) > 10}
					{@render txt(
						vLabelLeft ? B.x - 9 : B.x + 9,
						ball.vy >= 0
							? Math.min(B.y - vyLen / 2 + 4, B.y - 12)
							: Math.max(B.y - vyLen / 2 + 4, B.y + 22),
						`${ms(ball.vy)} ${ball.vy >= 0 ? 'up' : 'down'}`,
						12,
						{
							anchor: vLabelLeft ? 'end' : 'start',
							weight: 600,
							color: 'var(--mech-velocity)',
							opacity: o
						}
					)}
				{/if}
				{@render txt(
					weightLeft ? B.x - 18 : B.x - 12,
					B.y + 6 + WEIGHT + (weightLeft ? 0 : 16),
					'weight',
					12,
					{
						anchor: weightLeft ? 'end' : 'middle',
						weight: 600,
						color: 'var(--mech-force)',
						opacity: o
					}
				)}
			{/if}
		{/if}
		<!-- drag: the forces, weight and air -->
		{#if w.drag > 0.01}
			{@const o = w.drag * arrowsOn}
			{@render arrow(B.x, B.y + 6, B.x, B.y + 6 + WEIGHT, 'var(--mech-force)', o)}
			{@render arrow(
				B.x + airDir.x * 8,
				B.y + airDir.y * 8,
				B.x + airDir.x * (8 + airLen),
				B.y + airDir.y * (8 + airLen),
				'var(--mech-force)',
				o
			)}
			{#if o > 0.01}
				{@render txt(B.x + 8, B.y + 6 + WEIGHT, 'weight', 12, {
					weight: 600,
					color: 'var(--mech-force)',
					opacity: o
				})}
				{#if airLen > 10}
					{@render txt(airLabel.x, airLabel.y, 'air', 12, {
						anchor: airLabel.anchor,
						weight: 600,
						color: 'var(--mech-force)',
						opacity: o
					})}
				{/if}
			{/if}
		{/if}
		<circle
			cx={B.x}
			cy={B.y}
			r="7"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	</g>

	<Handle
		x={tip.x}
		y={tip.y}
		r={7}
		color="var(--mech-velocity)"
		label="Launch arrow: drag to set speed and angle; arrow keys change the angle"
		value={angle}
		min={5}
		max={85}
		valuetext="{angle} degrees at {speed} metres per second"
		{onmove}
		{onkey}
	/>

	<!-- ================= readout panel ================= -->
	<g>
		{@render txt(PX, 48, `Launched at ${speed} m/s, ${angle}°`, 16, { weight: 600 })}
		{#if slow > 1.05}
			{@render txt(PX, 68, `replayed ${slow.toFixed(slow < 10 ? 1 : 0)}× slower`, 11, {
				muted: true
			})}
		{/if}

		<!-- table: with air | vacuum (drag); a single column otherwise -->
		{#if panel.drag > 0.01}
			<g opacity={panel.drag}>
				<line
					x1={COL1 - 82}
					x2={COL1 - 60}
					y1={88}
					y2={88}
					stroke="var(--stage-ink)"
					stroke-width="2.6"
				/>
				{@render txt(COL1, 92, k > 0 ? 'with air' : 'air: none', 12, {
					anchor: 'end',
					muted: true
				})}
				<line
					x1={COL2 - 76}
					x2={COL2 - 54}
					y1={88}
					y2={88}
					stroke="var(--stage-ink-muted)"
					stroke-width="1.6"
					stroke-dasharray="6 5"
				/>
				{@render txt(COL2, 92, 'vacuum', 12, { anchor: 'end', muted: true })}
			</g>
		{/if}
		{#each [{ id: 'range', label: 'range', a: m1(main.range), b: m1(vacuum.range) }, { id: 'peak', label: 'peak height', a: m1(main.height), b: m1(vacuum.height) }, { id: 'time', label: 'flight time', a: sec(main.time), b: sec(vacuum.time) }] as row, i (row.id)}
			{@const y = 118 + 22 * i}
			{@render txt(PX, y, row.label, 13, { muted: true })}
			{@render txt(COL1, y, row.a, 14, { anchor: 'end', weight: 600 })}
			{#if panel.drag > 0.01}
				{@render txt(COL2, y, row.b, 14, { anchor: 'end', weight: 600, opacity: panel.drag })}
			{/if}
		{/each}
		{#if panel.drag > 0.01}
			<g opacity={panel.drag}>
				{@render txt(PX, 184, 'comes down at', 13, { muted: true })}
				{@render txt(COL1, 184, `${landAngle(main)}°`, 14, { anchor: 'end', weight: 600 })}
				{@render txt(COL2, 184, `${landAngle(vacuum)}°`, 14, { anchor: 'end', weight: 600 })}
			</g>
		{/if}

		{#if panel.basic > 0.01}
			<g opacity={panel.basic}>
				{@render txt(PX, 196, `horizontal speed stays ${ms(main.raw[0].vx)}`, 14, {
					weight: 600,
					color: 'var(--mech-velocity)'
				})}
				{@render txt(PX, 218, `vertical speed loses ${G.toFixed(1)} m/s each second`, 14, {
					weight: 600,
					color: 'var(--mech-velocity)'
				})}
				{@render txt(
					PX,
					240,
					`after ${tf.toFixed(1)} s: ${ms(ball.vy)} ${ball.vy >= 0 ? 'up' : 'down'}`,
					13,
					{ muted: true }
				)}
				<circle cx={PX + 4} cy={258} r="3.5" fill="var(--stage-ink-muted)" />
				{@render txt(PX + 14, 262, `dots: ${dotLabel} — equal steps sideways`, 12, {
					muted: true
				})}
			</g>
		{/if}

		{#if panel.range > 0.01}
			<g opacity={panel.range}>
				{@render txt(PX, 216, 'range grows with speed²', 15, { weight: 600 })}
				{@render txt(PX, 238, 'double the speed → 4× the range', 14)}
				{@render txt(
					PX,
					260,
					speed > 15
						? `${vText(other.v)} m/s: ${m1(other.range)}  ·  ${speed} m/s: ${m1(main.range)}`
						: `${speed} m/s: ${m1(main.range)}  ·  ${vText(other.v)} m/s: ${m1(other.range)}`,
					13,
					{ muted: true }
				)}
			</g>
		{/if}

		{#if panel.drag > 0.01}
			<g opacity={panel.drag}>
				{#if bestShown}
					<line
						x1={PX}
						x2={PX + 20}
						y1={214}
						y2={214}
						stroke="var(--explainer-accent)"
						stroke-width="1.8"
						stroke-dasharray="1.5 4"
						stroke-linecap="round"
					/>
				{/if}
				{@render txt(PX + (bestShown ? 28 : 0), 218, bestText, 14, { weight: 600 })}
				{#if k > 0 && best === angle}
					{@render txt(PX, 240, 'this throw is already at the best angle', 13, {
						muted: true
					})}
				{/if}
			</g>
		{/if}
	</g>
</g>
