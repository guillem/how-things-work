<script lang="ts">
	/**
	 * Two views of one train: the top row in the platform frame (the platform
	 * stands still, the train moves right), the bottom row in the train frame
	 * (the train stands still, the platform moves left).
	 *
	 * Phases (`step.hints.phase`):
	 *   light    — a lamp in the middle of the carriage flashes and a ball is
	 *              thrown forwards at 0.5 c (in the train); the flash moves at c
	 *              in both rows, the ball at (0.5 + β)/(1 + 0.5β) on the platform
	 *   clock    — light clocks on the train and on the platform (a station
	 *              clock under the canopy); `hints.rest` holds the train at rest
	 *   dilation — the same at the slider's speed: the moving clock's light runs
	 *              a zig-zag and its ticks are γ times longer, in both rows
	 *
	 * Moving things are drawn contracted by 1/γ along the track (heights not).
	 * Light moves at C_PX on screen in every row and phase.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, cycle, pingpong, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { addVelocities, gamma, num, tickAtRest } from '../relativity';
	import { C_PX, duration, edgeFade, wrap, wrapShift } from './shared';
	import T from './T.svelte';
	import Train from './Train.svelte';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'dilation'));
	const rest = $derived(Boolean(step.hints?.rest));
	const target = $derived(rest ? 0 : clamp(Number(params.beta ?? 0.6), 0, 0.99));

	// The displayed speed eases to the slider (and to 0 on the step at rest).
	const betaT = new Tween(0.6, { duration: 700, easing: cubicInOut });
	const lightW = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const b = target;
		const l = phase === 'light' ? 1 : 0;
		untrack(() => {
			betaT.set(b, { duration: reduced ? 0 : 700 });
			lightW.set(l, { duration: reduced ? 0 : 700 });
		});
	});
	const beta = $derived(betaT.current);
	const g = $derived(gamma(beta));
	const k = $derived(1 / g);
	const v = $derived(beta * C_PX);
	const wl = $derived(lightW.current);
	const wc = $derived(1 - wl);

	// ---- geometry ------------------------------------------------------------------
	const ROWS = [14, 300];
	const XA = 70; // moving things wrap round between XA and XB
	const XB = 890;
	const CAR = 240; // carriage length at rest
	const LCAR = 480; // the longer carriage of the light phase
	const XL = 280; // top row, light phase: where the lamp flashes
	const CAR_H = 104;
	const G = 64; // mirror gap, both clocks
	const T0 = (2 * G) / C_PX; // one tick at rest, in seconds of animation
	const XS = 480; // top row: where the station clock is, and where the train starts
	const XT = 480; // bottom row: where the train stands
	// Within a row (offsets from the row top):
	const RAIL = 262;
	const CAR_TOP = RAIL - 10 - CAR_H;
	const CM_TOP = CAR_TOP + 16; // carriage clock's mirrors
	const SM_TOP = 68; // station clock's mirrors
	const CANOPY = 54;
	const DECK = RAIL + 2;

	// ---- clocks ----------------------------------------------------------------------
	/** Height above the bottom mirror of a clock's light pulse, ticking every `period`. */
	const lift = (time: number, period: number) => G * pingpong(time, period);
	const flash = (time: number, period: number) =>
		reduced ? 0 : 1 - smoothstep(0, 0.12, cycle(time, period));

	// Top row: the train moves right; the station clock stands at XS.
	const carU = $derived(XS + v * t); // unwrapped
	const carX = $derived(wrap(carU, XA, XB));
	const carShift = $derived(wrapShift(carU, XA, XB));
	// Bottom row: the platform moves left; the station clock starts above the train.
	const stU = $derived(XT - v * t);
	const stX = $derived(wrap(stU, XA, XB));
	const stShift = $derived(wrapShift(stU, XA, XB));

	const ticksRest = $derived(Math.floor(t / T0 + 1e-9));
	const ticksMoving = $derived(Math.floor(t / (g * T0) + 1e-9));

	/** The zig-zag of a moving clock's light over the last 1.5 ticks, in one row. */
	function trail(u0: number, vel: number, shift: number, top: number) {
		const period = g * T0;
		const span = Math.min(1.5 * period, t);
		const n = 36;
		let d = '';
		for (let i = 0; i <= n; i++) {
			const time = t - span + (span * i) / n;
			const x = u0 + vel * time - shift;
			if (x < XA - 1 || x > XB + 1) continue;
			const y = top + G - lift(time, period);
			d += `${d ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
		}
		return d;
	}
	const trailTop = $derived(beta > 0.005 ? trail(XS, v, carShift, ROWS[0] + CM_TOP) : '');
	const trailBottom = $derived(beta > 0.005 ? trail(XT, -v, stShift, ROWS[1] + SM_TOP) : '');

	// ---- the lamp and the ball (phase light) -----------------------------------------
	const P = 4.2; // loop
	const TE = 0.3; // the lamp flashes 0.3 s into each loop
	const BALL = 0.5; // the ball's speed in the train, as a fraction of c
	const tau = $derived(reduced ? 1.9 : t % P);
	const loopFade = $derived(
		reduced ? 1 : smoothstep(0, 0.25, tau) * (1 - smoothstep(P - 0.4, P, tau))
	);
	const wBall = $derived(addVelocities(BALL, beta));

	interface Shot {
		car: number; // carriage centre now
		hw: number; // half length of the carriage now (contracted)
		pulses: { x: number; o: number; key: string }[];
		hits: { x: number; o: number; key: string }[];
		ball: number | null;
		ballDone: boolean;
	}
	/** One row of the light phase: carriage centre at emission `xe`, its velocity `vel`. */
	function shot(xe: number, vel: number, hw: number): Shot {
		const car = xe + vel * (tau - TE);
		const s = tau - TE;
		const pulses: Shot['pulses'] = [];
		const hits: Shot['hits'] = [];
		let ball: number | null = null;
		if (s >= 0) {
			// Front pulse x = xe + c s meets the front wall xe + hw + vel s.
			const sf = hw / (C_PX - vel);
			const sb = hw / (C_PX + vel);
			if (s < sf) pulses.push({ x: xe + C_PX * s, o: 1, key: 'f' });
			else hits.push({ x: xe + hw + vel * s, o: 1 - smoothstep(sf + 0.6, sf + 1.2, s), key: 'f' });
			if (s < sb) pulses.push({ x: xe - C_PX * s, o: 1, key: 'b' });
			else hits.push({ x: xe - hw + vel * s, o: 1 - smoothstep(sb + 0.6, sb + 1.2, s), key: 'b' });
		}
		return { car, hw, pulses, hits, ball, ballDone: false };
	}
	const topShot = $derived.by(() => {
		const hw = (LCAR / 2) * k;
		const sh = shot(XL, v, hw);
		const s = tau - TE;
		const wall = sh.car + hw - 8;
		sh.ball = s < 0 ? sh.car : Math.min(XL + wBall * C_PX * s, wall);
		sh.ballDone = sh.ball >= wall;
		return sh;
	});
	const bottomShot = $derived.by(() => {
		const hw = LCAR / 2;
		const sh = shot(XT, 0, hw);
		const s = tau - TE;
		sh.ball = s < 0 ? XT : Math.min(XT + BALL * C_PX * s, XT + hw - 8);
		sh.ballDone = sh.ball >= XT + hw - 8;
		return sh;
	});

	// ---- readouts --------------------------------------------------------------------
	const tick0 = tickAtRest();
	const restTick = duration(tick0);
	const movingTick = $derived(duration(tick0 * g));
	const plural = (n: number) => `${n} tick${n === 1 ? '' : 's'}`;

	// Deck marks (posts every 80 units), sliding left in the bottom row.
	const POSTS = Array.from({ length: 13 }, (_, i) => i);
	const postOffset = $derived(-((((v * t) % 80) + 80) % 80));
</script>

{#snippet deck(top: number, offset: number)}
	<line
		x1="16"
		x2="944"
		y1={top + RAIL}
		y2={top + RAIL}
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<rect x="16" y={top + DECK} width="928" height="10" rx="2" fill="var(--rel-deck)" />
	{#each POSTS as i (i)}
		{@const x = 40 + i * 80 + offset}
		{#if x > 18 && x < 942}
			<line
				x1={x}
				x2={x}
				y1={top + DECK}
				y2={top + DECK + 10}
				stroke="var(--stage-ink-muted)"
				opacity="0.5"
			/>
		{/if}
	{/each}
	<line
		x1="16"
		x2="944"
		y1={top + CANOPY}
		y2={top + CANOPY}
		stroke="var(--stage-line)"
		stroke-width="2"
		opacity={wc}
	/>
{/snippet}

{#snippet clock(
	x: number,
	top: number,
	period: number,
	time: number,
	color: string,
	box: boolean,
	opacity: number,
	name: string
)}
	{@const yb = top + G}
	<g {opacity}>
		{#if box}
			<line x1={x} x2={x} y1={top - 14} y2={top - 8} stroke="var(--stage-line)" stroke-width="2" />
			<rect
				x={x - 22}
				y={top - 8}
				width="44"
				height={G + 16}
				rx="5"
				fill="var(--surface)"
				stroke={color}
				stroke-width="1.5"
			/>
		{/if}
		<line x1={x - 16} x2={x + 16} y1={top} y2={top} stroke={color} stroke-width="3" />
		<line x1={x - 16} x2={x + 16} y1={yb} y2={yb} stroke={color} stroke-width="3" />
		<circle cx={x} cy={yb} r={8} fill="var(--rel-light)" opacity={0.5 * flash(time, period)} />
		<circle
			cx={x}
			cy={yb - lift(time, period)}
			r="4.5"
			fill="var(--rel-light)"
			filter="url(#glow)"
		/>
		<T x={x + 28} y={top + G / 2 + 4} text={name} size={12} muted />
	</g>
{/snippet}

<g>
	<!-- ===================== top row: the platform frame ===================== -->
	{@render deck(ROWS[0], 0)}
	<T x={24} y={ROWS[0] + 18} text="Platform frame" size={15} weight={650} color="var(--rel-plat)" />

	<!-- the station clock, at rest -->
	{@render clock(XS, ROWS[0] + SM_TOP, T0, t, 'var(--rel-plat)', true, wc, 'platform clock')}

	{#if wc > 0.01}
		<!-- the train, with its light clock: the light runs a zig-zag -->
		{@const fade = edgeFade(carX, XA, XB, 40)}
		<g opacity={wc * fade}>
			<Train x={carX} y={ROWS[0] + RAIL} length={CAR} height={CAR_H} {k} windows={5} clockGap />
			{#if trailTop}
				<path
					d={trailTop}
					fill="none"
					stroke="var(--rel-light)"
					stroke-width="1.5"
					stroke-dasharray="3 3"
					opacity="0.8"
				/>
			{/if}
			{@render clock(
				carX,
				ROWS[0] + CM_TOP,
				g * T0,
				t,
				'var(--rel-train)',
				false,
				1,
				'train clock'
			)}
		</g>
		<g opacity={wc}>
			<T
				x={936}
				y={ROWS[0] + 18}
				anchor="end"
				size={13}
				text="one tick, timed on the platform:"
				muted
			/>
			<T
				x={936}
				y={ROWS[0] + 33}
				anchor="end"
				size={13}
				weight={600}
				text="platform clock {restTick} · train clock {movingTick}"
			/>
			<T
				x={936}
				y={ROWS[0] + 47}
				anchor="end"
				size={12}
				muted
				text="count so far: platform {plural(ticksRest)}, train {plural(ticksMoving)}"
			/>
		</g>
	{/if}

	{#if wl > 0.01}
		{@const s = topShot}
		<g opacity={wl * loopFade}>
			<Train x={s.car} y={ROWS[0] + RAIL} length={LCAR} height={CAR_H} {k} windows={9} />
			{@render lamp(s.car, ROWS[0])}
			{@render light(s, ROWS[0], `${num(wBall, 3)} c`)}
		</g>
		<g opacity={wl}>
			<T
				x={936}
				y={ROWS[0] + 18}
				anchor="end"
				text="the flash: c forwards, c backwards"
				weight={600}
			/>
			<T
				x={936}
				y={ROWS[0] + 33}
				anchor="end"
				weight={600}
				text="the ball: {num(wBall, 3)} c{beta >= 0.005
					? ` — not 0.5 + ${num(beta)} = ${num(0.5 + beta)} c`
					: ''}"
			/>
		</g>
	{/if}

	<!-- ===================== bottom row: the train frame ===================== -->
	{@render deck(ROWS[1], postOffset)}
	<T x={24} y={ROWS[1] + 18} text="Train frame" size={15} weight={650} color="var(--rel-train)" />

	{#if wc > 0.01}
		<g opacity={wc}>
			<Train x={XT} y={ROWS[1] + RAIL} length={CAR} height={CAR_H} windows={5} clockGap />
			{@render clock(XT, ROWS[1] + CM_TOP, T0, t, 'var(--rel-train)', false, 1, 'train clock')}
		</g>
		<!-- the station clock moves past; its light runs the zig-zag -->
		{@const fade = edgeFade(stX, XA, XB, 40)}
		<g opacity={wc * fade}>
			{#if trailBottom}
				<path
					d={trailBottom}
					fill="none"
					stroke="var(--rel-light)"
					stroke-width="1.5"
					stroke-dasharray="3 3"
					opacity="0.8"
				/>
			{/if}
			{@render clock(
				stX,
				ROWS[1] + SM_TOP,
				g * T0,
				t,
				'var(--rel-plat)',
				true,
				1,
				'platform clock'
			)}
		</g>
		<g opacity={wc}>
			<T
				x={936}
				y={ROWS[1] + 18}
				anchor="end"
				size={13}
				text="one tick, timed on the train:"
				muted
			/>
			<T
				x={936}
				y={ROWS[1] + 33}
				anchor="end"
				size={13}
				weight={600}
				text="train clock {restTick} · platform clock {movingTick}"
			/>
			<T
				x={936}
				y={ROWS[1] + 47}
				anchor="end"
				size={12}
				muted
				text="count so far: train {plural(ticksRest)}, platform {plural(ticksMoving)}"
			/>
		</g>
	{/if}

	{#if wl > 0.01}
		{@const s = bottomShot}
		<g opacity={wl * loopFade}>
			<Train x={XT} y={ROWS[1] + RAIL} length={LCAR} height={CAR_H} windows={9} />
			{@render lamp(XT, ROWS[1])}
			{@render light(s, ROWS[1], '0.5 c')}
		</g>
		<g opacity={wl}>
			<T
				x={936}
				y={ROWS[1] + 18}
				anchor="end"
				text="the flash: c forwards, c backwards"
				weight={600}
			/>
			<T x={936} y={ROWS[1] + 33} anchor="end" weight={600} text="the ball: 0.5 c" />
		</g>
	{/if}

	<!-- the train's speed -->
	<T
		x={232}
		y={ROWS[0] + 18}
		size={13}
		muted
		text={beta < 0.005
			? 'train at rest: both frames agree'
			: `train at ${num(beta)} c · γ = ${num(g, 3)}`}
	/>
</g>

{#snippet lamp(x: number, top: number)}
	<rect x={x - 6} y={top + CAR_TOP - 2} width="12" height="7" rx="2" fill="var(--rel-light)" />
{/snippet}

{#snippet light(s: Shot, top: number, ballText: string)}
	{@const y = top + CAR_TOP + 62}
	{#each s.pulses as p (p.key)}
		{@const dir = p.key === 'f' ? 1 : -1}
		<line
			x1={p.x - dir * 34}
			x2={p.x}
			y1={y}
			y2={y}
			stroke="var(--rel-light)"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.35"
		/>
		<rect
			x={p.x - 8}
			y={y - 3}
			width="16"
			height="6"
			rx="3"
			fill="var(--rel-light)"
			filter="url(#glow)"
		/>
		<T x={p.x - dir * 6} y={y - 9} text="c" size={13} weight={650} anchor="middle" italic />
	{/each}
	{#each s.hits as h (h.key)}
		<circle cx={h.x} cy={y} r="11" fill="var(--rel-light)" opacity={0.55 * h.o} />
	{/each}
	{#if s.ball !== null}
		{@const bo = s.ballDone ? 0 : 1}
		<circle cx={s.ball} cy={top + RAIL - 22} r="7" fill="var(--rel-strike)" />
		<T
			opacity={bo}
			x={s.ball}
			y={top + RAIL - 34}
			text={ballText}
			size={12}
			weight={600}
			anchor="middle"
		/>
	{/if}
{/snippet}
