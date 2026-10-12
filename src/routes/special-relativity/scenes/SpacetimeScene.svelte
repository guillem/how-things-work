<script lang="ts">
	/**
	 * The spacetime diagram of the platform frame: x across, c·t up, in metres,
	 * the same scale on both so light runs at 45°. The train frame's axes
	 * (c·t′ along x = β·c·t, x′ along c·t = β·x) tilt towards the light line as
	 * the speed grows; their ticks sit where (c·t)² − x² = ±(100 m)², ±(200 m)²
	 * cross them. The train is the 200 m train of the other scenes, its middle
	 * (the passenger) on the c·t′ axis; the strikes are the same model events.
	 *
	 * Phases (`step.hints.phase`):
	 *   axes     — worldlines; the platform's "now" sweeps upwards
	 *   now      — the two strikes, their flashes, the train's lines of
	 *              simultaneity through each; the train's "now" sweeps
	 *   interval — a draggable event (params ect, ex), its coordinates in both
	 *              frames, and the hyperbola of constant interval through it
	 *   all      — clock ticks, both length measurements and the strikes at once
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		C,
		gamma,
		interval,
		intervalKind,
		lightning,
		num,
		toPlatform,
		toTrain,
		TRAIN_LENGTH,
		type Event
	} from '../relativity';
	import EventHandle from './EventHandle.svelte';
	import T from './T.svelte';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const phases = ['axes', 'now', 'interval', 'all'] as const;
	type Phase = (typeof phases)[number];
	const phase = $derived(String(step.hints?.phase ?? 'axes') as Phase);
	const weights = Object.fromEntries(
		phases.map((p) => [p, new Tween(0, { duration: 700, easing: cubicInOut })])
	) as Record<Phase, Tween<number>>;
	const target = $derived(clamp(Number(params.beta ?? 0.6), 0, 0.99));
	const betaT = new Tween(0.6, { duration: 600, easing: cubicInOut });
	$effect(() => {
		const current = phase;
		const b = target;
		untrack(() => {
			for (const p of phases)
				weights[p].set(p === current ? 1 : 0, { duration: reduced ? 0 : 700 });
			betaT.set(b, { duration: reduced ? 0 : 600 });
		});
	});
	const w = $derived({
		axes: weights.axes.current,
		now: weights.now.current,
		interval: weights.interval.current,
		all: weights.all.current
	});
	const beta = $derived(betaT.current);
	const g = $derived(gamma(beta));

	// ---- the diagram -----------------------------------------------------------------
	const OX = 300;
	const OY = 310;
	const SC = 0.96; // stage units per metre
	const R = 270; // the diagram shows ±270 m both ways
	const P = (x: number, ct: number): Point => ({ x: OX + SC * x, y: OY - SC * ct });
	const BOX = { x: OX - SC * R, y: OY - SC * R, w: 2 * SC * R, h: 2 * SC * R };
	const GRID = [-250, -200, -150, -100, -50, 50, 100, 150, 200, 250];
	const TICKS = [-200, -100, 100, 200];
	const line = (a: Point, b: Point) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
	/** A long line through the event `e` with direction (dx, dct), clipped by the box. */
	const through = (e: Event, dx: number, dct: number) => {
		const k = (3 * R) / Math.max(Math.abs(dx), Math.abs(dct));
		return line(P(e.x - k * dx, e.ct - k * dct), P(e.x + k * dx, e.ct + k * dct));
	};
	/** A train-frame event (c·t′, x′) in platform coordinates. */
	const fromTrain = (ctp: number, xp: number): Event => toPlatform({ ct: ctp, x: xp }, beta);
	/** Metres of c·t as nanoseconds. */
	const ns = (ctm: number) => `${num((ctm / C) * 1e9, 0)} ns`;
	const m = (v: number) => `${num(v, 0)} m`;

	// The 200 m train: its ends and its middle (the passenger).
	const half = $derived(TRAIN_LENGTH / 2 / g);
	const strike = $derived(lightning(beta, TRAIN_LENGTH));
	const strikeT = $derived({
		back: toTrain(strike.back, beta),
		front: toTrain(strike.front, beta)
	});

	// Train-axis ticks: where the calibration hyperbolas cross the c·t′ and x′ axes.
	const trainTicks = $derived(
		TICKS.map((n) => ({ n, time: P(...xy(fromTrain(n, 0))), space: P(...xy(fromTrain(0, n))) }))
	);
	function xy(e: Event): [number, number] {
		return [e.x, e.ct];
	}
	/** The hyperbola (c·t)² − x² = s², branch by `sign`; timelike: ct = ±√(s² + x²). */
	function hyperbola(s2: number, sign: number) {
		let d = '';
		const n = 80;
		for (let i = 0; i <= n; i++) {
			const u = -R * 1.05 + (2.1 * R * i) / n;
			const e =
				s2 >= 0
					? { x: u, ct: sign * Math.sqrt(s2 + u * u) }
					: { ct: u, x: sign * Math.sqrt(-s2 + u * u) };
			const p = P(e.x, e.ct);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
		}
		return d;
	}
	const calibration = [100, 200].flatMap((r) => [
		{ key: `t${r}`, d: hyperbola(r * r, 1) },
		{ key: `-t${r}`, d: hyperbola(r * r, -1) },
		{ key: `x${r}`, d: hyperbola(-r * r, 1) },
		{ key: `-x${r}`, d: hyperbola(-r * r, -1) }
	]);

	// ---- phase axes: the platform's "now" sweeping up -------------------------------
	const sweep = $derived(reduced ? 150 : -230 + ((t * 70) % 490));
	// ---- phase now: the train's "now" sweeping up (c·t′ from −250 to 250) -------------
	const sweepT = $derived(reduced ? 0 : -230 + ((t * 70) % 470));
	const sweepLine = $derived(through(fromTrain(sweepT, 0), 1, beta));
	const passed = (ctp: number) => (reduced ? 1 : smoothstep(ctp, ctp + 8, sweepT));
	// The flashes, drawn growing from each strike (a loop of 7 s; complete when reduced).
	const rayLen = $derived(reduced ? 2 * R : ((t % 7) / 5) * 2 * R);

	// ---- phase interval: the event --------------------------------------------------
	const snap = (v: number) => Math.round(clamp(v, -250, 250) / 10) * 10;
	const ev = $derived<Event>({
		ct: snap(Number(params.ect ?? 200)),
		x: snap(Number(params.ex ?? 100))
	});
	const evT = $derived(toTrain(ev, beta));
	const s2 = $derived(interval(ev));
	const kind = $derived(intervalKind(s2));
	const atOrigin = $derived(ev.ct === 0 && ev.x === 0);
	const E = $derived(P(ev.x, ev.ct));
	// Projections onto the train's axes: along x′ to the c·t′ axis, along c·t′ to the x′ axis.
	const onTime = $derived(P(...xy(fromTrain(evT.ct, 0))));
	const onSpace = $derived(P(...xy(fromTrain(0, evT.x))));
	const evCurve = $derived(
		kind === 'lightlike'
			? null
			: hyperbola(s2, kind === 'timelike' ? Math.sign(ev.ct) : Math.sign(ev.x))
	);
	function onmove(p: Point) {
		setParam('ex', snap((p.x - OX) / SC));
		setParam('ect', snap((OY - p.y) / SC));
	}
	function onkey(dx: number, dy: number) {
		setParam('ex', snap(ev.x + 10 * dx));
		setParam('ect', snap(ev.ct + 10 * dy));
	}
	const sq = (v: number) => (v < -0.5 ? `(${num(v, 0)})²` : `${num(v, 0)}²`);

	// ---- phase all: ticks and lengths -----------------------------------------------
	const clockTicks = $derived(
		[-2, -1, 1, 2]
			.map((n) => ({ n, e: fromTrain(100 * n, 0) }))
			.filter((c) => Math.abs(c.e.ct) <= 220)
	);
	const ruler = $derived({ a: fromTrain(0, -100), b: fromTrain(0, 100) });

	// ---- panel -----------------------------------------------------------------------
	const PX = 600;
	const angle = $derived((Math.atan(beta) * 180) / Math.PI);
</script>

<g>
	<defs>
		<clipPath id="st-clip"><rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} /></clipPath>
	</defs>

	<!-- ============ the grid, the platform's axes and light ============ -->
	<rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} fill="none" stroke="var(--stage-grid)" />
	{#each GRID as v (v)}
		<line {...line(P(v, -R), P(v, R))} stroke="var(--stage-grid)" />
		<line {...line(P(-R, v), P(R, v))} stroke="var(--stage-grid)" />
	{/each}
	<line {...line(P(-R, 0), P(R, 0))} stroke="var(--rel-plat)" stroke-width="1.5" opacity="0.8" />
	<line {...line(P(0, -R), P(0, R))} stroke="var(--rel-plat)" stroke-width="1.5" opacity="0.8" />
	{#each TICKS as v (v)}
		<line
			{...line(P(v, 0), { x: P(v, 0).x, y: P(v, 0).y + 5 })}
			stroke="var(--rel-plat)"
			stroke-width="1.5"
		/>
		<line
			{...line(P(0, v), { x: P(0, v).x - 5, y: P(0, v).y })}
			stroke="var(--rel-plat)"
			stroke-width="1.5"
		/>
		<T x={P(v, 0).x} y={P(v, 0).y + 18} text={String(v)} size={10} anchor="middle" muted />
		<T x={P(0, v).x - 8} y={P(0, v).y + 4} text={String(v)} size={10} anchor="end" muted />
	{/each}
	<T
		x={P(R, 0).x - 4}
		y={P(R, 0).y - 8}
		text="x (m)"
		size={13}
		anchor="end"
		color="var(--rel-plat)"
		weight={650}
	/>
	<T
		x={P(0, R).x - 8}
		y={P(0, R).y + 16}
		text="c·t (m)"
		size={13}
		anchor="end"
		color="var(--rel-plat)"
		weight={650}
	/>

	<g clip-path="url(#st-clip)">
		<line
			{...line(P(-R, -R), P(R, R))}
			stroke="var(--rel-light)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		<line
			{...line(P(R, -R), P(-R, R))}
			stroke="var(--rel-light)"
			stroke-width="1.5"
			stroke-dasharray="6 5"
		/>
		{#if w.axes > 0.01}
			{#each calibration as c (c.key)}
				<path
					d={c.d}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					stroke-dasharray="2 4"
					opacity={0.6 * w.axes}
				/>
			{/each}
		{/if}
	</g>
	<T x={BOX.x + 8} y={BOX.y + 60} text="light" size={12} color="var(--rel-light)" weight={650} />

	<!-- ============ the train: its world-strip and its axes ============ -->
	{#if 1 - w.interval > 0.01}
		<g clip-path="url(#st-clip)" opacity={1 - w.interval}>
			<path
				d="M{P(-half - beta * R * 1.2, -R * 1.2).x} {P(-half, -R * 1.2).y} L{P(
					-half + beta * R * 1.2,
					R * 1.2
				).x} {P(-half, R * 1.2).y} L{P(half + beta * R * 1.2, R * 1.2).x} {P(half, R * 1.2).y} L{P(
					half - beta * R * 1.2,
					-R * 1.2
				).x} {P(half, -R * 1.2).y} Z"
				fill="var(--rel-train)"
				opacity="0.08"
			/>
			<line
				{...through({ ct: 0, x: -half }, beta, 1)}
				stroke="var(--rel-train)"
				stroke-width="1"
				opacity="0.6"
			/>
			<line
				{...through({ ct: 0, x: half }, beta, 1)}
				stroke="var(--rel-train)"
				stroke-width="1"
				opacity="0.6"
			/>
		</g>
	{/if}
	<g clip-path="url(#st-clip)">
		<line {...through({ ct: 0, x: 0 }, beta, 1)} stroke="var(--rel-train)" stroke-width="2.2" />
		<line {...through({ ct: 0, x: 0 }, 1, beta)} stroke="var(--rel-train)" stroke-width="2.2" />
		{#each trainTicks as tk (tk.n)}
			<circle cx={tk.time.x} cy={tk.time.y} r="3.5" fill="var(--rel-train)" />
			<circle cx={tk.space.x} cy={tk.space.y} r="3.5" fill="var(--rel-train)" />
		{/each}
	</g>
	{#if R / g > 30}
		{@const tl = P(...xy(fromTrain(R / g - 10, 0)))}
		{@const xl = P(...xy(fromTrain(0, R / g - 10)))}
		<T
			x={tl.x + 10}
			y={Math.max(tl.y + 6, BOX.y + 14)}
			text="c·t′"
			size={13}
			color="var(--rel-train)"
			weight={650}
		/>
		<T
			x={Math.min(xl.x, BOX.x + BOX.w - 6)}
			y={xl.y + 20}
			text="x′"
			size={13}
			anchor="end"
			color="var(--rel-train)"
			weight={650}
		/>
	{/if}

	<!-- ============ phase axes: the platform's now sweeping ============ -->
	{#if w.axes > 0.01}
		<g opacity={w.axes} clip-path="url(#st-clip)">
			<line
				{...line(P(-R, sweep), P(R, sweep))}
				stroke="var(--rel-plat)"
				stroke-width="1.5"
				stroke-dasharray="4 4"
			/>
			<circle
				cx={P(0, sweep).x}
				cy={P(0, sweep).y}
				r="6"
				fill="var(--rel-plat)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<circle
				cx={P(beta * sweep, sweep).x}
				cy={P(0, sweep).y}
				r="6"
				fill="var(--rel-train)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			{#each [-half, half] as e (e)}
				<circle
					cx={P(e + beta * sweep, sweep).x}
					cy={P(0, sweep).y}
					r="4"
					fill="var(--rel-train)"
					opacity="0.7"
				/>
			{/each}
			{#if sweep > 0}
				<circle
					cx={P(sweep, sweep).x}
					cy={P(0, sweep).y}
					r="5"
					fill="var(--rel-light)"
					filter="url(#glow)"
				/>
			{/if}
		</g>
	{/if}

	<!-- ============ phase now: strikes, flashes and slices ============ -->
	{#if w.now > 0.01 || w.all > 0.01}
		{@const A = P(strike.back.x, 0)}
		{@const B = P(strike.front.x, 0)}
		<g opacity={Math.max(w.now, w.all)} clip-path="url(#st-clip)">
			<line {...line(P(-R, 0), P(R, 0))} stroke="var(--rel-plat)" stroke-width="3" opacity="0.5" />
			<line
				{...through(strike.back, 1, beta)}
				stroke="var(--rel-train)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			<line
				{...through(strike.front, 1, beta)}
				stroke="var(--rel-train)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		</g>
		{#if w.now > 0.01}
			{@const M = P(0, strike.platformMeets.ct)}
			{@const PF = P(strike.passengerFront.x, strike.passengerFront.ct)}
			{@const PB = P(strike.passengerBack.x, strike.passengerBack.ct)}
			<g opacity={w.now} clip-path="url(#st-clip)">
				<line
					x1={A.x}
					y1={A.y}
					x2={A.x + SC * rayLen}
					y2={A.y - SC * rayLen}
					stroke="var(--rel-light)"
					stroke-width="2.5"
				/>
				<line
					x1={B.x}
					y1={B.y}
					x2={B.x - SC * rayLen}
					y2={B.y - SC * rayLen}
					stroke="var(--rel-light)"
					stroke-width="2.5"
				/>
				<line {...sweepLine} stroke="var(--rel-train)" stroke-width="2" opacity="0.8" />
				{#each [{ p: M, ct: strike.platformMeets.ct, c: 'var(--rel-plat)' }, { p: PF, ct: strike.passengerFront.ct, c: 'var(--rel-train)' }, { p: PB, ct: strike.passengerBack.ct, c: 'var(--rel-train)' }] as r (r.ct)}
					<circle
						cx={r.p.x}
						cy={r.p.y}
						r="5"
						fill="var(--stage-bg)"
						stroke={r.c}
						stroke-width="2"
						opacity={rayLen >= r.ct ? 1 : 0}
					/>
				{/each}
			</g>
		{/if}
		<g opacity={Math.max(w.now, w.all)}>
			{#each [{ p: A, e: strikeT.back }, { p: B, e: strikeT.front }] as s (s.e.x)}
				<circle
					cx={s.p.x}
					cy={s.p.y}
					r="7"
					fill="var(--rel-strike)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
				<circle
					cx={s.p.x}
					cy={s.p.y}
					r={10 + 10 * (w.now > 0.5 ? passed(s.e.ct) : 0)}
					fill="none"
					stroke="var(--rel-strike)"
					stroke-width="2"
					opacity={w.now > 0.5
						? passed(s.e.ct) * (reduced ? 1 : 1 - smoothstep(s.e.ct + 8, s.e.ct + 60, sweepT))
						: 0}
				/>
			{/each}
			<T x={A.x - 6} y={A.y + 34} text="back strike" size={11} anchor="end" weight={600} />
			<T x={B.x + 6} y={B.y + 34} text="front strike" size={11} weight={600} />
		</g>
	{/if}

	<!-- ============ phase all: clock ticks and the two lengths ============ -->
	{#if w.all > 0.01}
		<g opacity={w.all}>
			{#each clockTicks as c (c.n)}
				{@const p = P(c.e.x, c.e.ct)}
				<line {...line(p, P(0, c.e.ct))} stroke="var(--rel-train)" stroke-dasharray="2 3" />
				<circle
					cx={p.x}
					cy={p.y}
					r="6"
					fill="var(--rel-train)"
					stroke="var(--stage-bg)"
					stroke-width="2"
				/>
				<T
					x={p.x + 10}
					y={p.y + 4}
					text="tick {num(c.n)}: c·t′ = {num(c.n * 100)} m"
					size={11}
					weight={600}
				/>
				<T
					x={P(0, c.e.ct).x - 8}
					y={P(0, c.e.ct).y - 6}
					text={m(c.e.ct)}
					size={11}
					anchor="end"
					color="var(--rel-train)"
					weight={650}
				/>
			{/each}
			<!-- the platform measures along its now (the x axis) -->
			<line
				{...line(P(-half, 0), P(half, 0))}
				stroke="var(--rel-plat)"
				stroke-width="5"
				stroke-linecap="round"
			/>
			<T
				x={P(0, 0).x}
				y={P(0, 0).y + 54}
				text="platform: {m(2 * half)}"
				size={12}
				anchor="middle"
				color="var(--rel-plat)"
				weight={650}
			/>
			<!-- the train measures along its now (the x′ axis) -->
			<g clip-path="url(#st-clip)">
				<line
					{...line(P(ruler.a.x, ruler.a.ct), P(ruler.b.x, ruler.b.ct))}
					stroke="var(--rel-train)"
					stroke-width="5"
					stroke-linecap="round"
					opacity="0.8"
				/>
			</g>
			{#if Math.abs(ruler.b.x) < R && ruler.b.ct < R}
				<T
					x={P(ruler.b.x, ruler.b.ct).x + 4}
					y={P(ruler.b.x, ruler.b.ct).y - 12}
					text="train: 200 m"
					size={12}
					anchor="end"
					color="var(--rel-train)"
					weight={650}
				/>
			{/if}
		</g>
	{/if}

	<!-- ============ phase interval: the event ============ -->
	{#if w.interval > 0.01}
		<g opacity={w.interval}>
			<g clip-path="url(#st-clip)">
				{#if evCurve}
					<path d={evCurve} fill="none" stroke="var(--rel-strike)" stroke-width="2" opacity="0.8" />
				{/if}
				<line {...line(E, P(0, ev.ct))} stroke="var(--rel-plat)" stroke-dasharray="3 3" />
				<line {...line(E, P(ev.x, 0))} stroke="var(--rel-plat)" stroke-dasharray="3 3" />
				<line {...line(E, onTime)} stroke="var(--rel-train)" stroke-dasharray="3 3" />
				<line {...line(E, onSpace)} stroke="var(--rel-train)" stroke-dasharray="3 3" />
			</g>
			<circle cx={onTime.x} cy={onTime.y} r="3.5" fill="var(--rel-train)" />
			<circle cx={onSpace.x} cy={onSpace.y} r="3.5" fill="var(--rel-train)" />
			<circle
				cx={E.x}
				cy={E.y}
				r="7"
				fill="var(--rel-strike)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<T x={E.x + 12} y={E.y - 10} text="event" size={12} weight={650} />
			{#if w.interval > 0.5}
				<EventHandle
					x={E.x}
					y={E.y}
					label="The event"
					value={ev.ct}
					valuetext="c·t = {m(ev.ct)}, x = {m(ev.x)}"
					color="var(--rel-strike)"
					{onmove}
					{onkey}
				/>
			{/if}
		</g>
	{/if}

	<!-- ============ the panel ============ -->
	<T x={PX} y={44} text="Train at {num(beta)} c · γ = {num(g, 3)}" size={15} weight={650} />
	{#if w.axes > 0.01}
		<g opacity={w.axes}>
			<T
				x={PX}
				y={80}
				text="platform: x across, c·t up"
				size={13}
				color="var(--rel-plat)"
				weight={650}
			/>
			<T
				x={PX}
				y={100}
				text="the observer stays at x = 0: her worldline is the c·t axis"
				size={12}
				muted
			/>
			<T
				x={PX}
				y={132}
				text="train: x′ and c·t′ tilted by {num(angle, 0)}°"
				size={13}
				color="var(--rel-train)"
				weight={650}
			/>
			<T
				x={PX}
				y={152}
				text="c·t′ is the passenger's worldline; the shaded strip"
				size={12}
				muted
			/>
			<T x={PX} y={168} text="is the whole 200 m train moving through time" size={12} muted />
			<T
				x={PX}
				y={200}
				text="light: always at 45°, in every frame"
				size={13}
				color="var(--rel-light)"
				weight={650}
			/>
			<T x={PX} y={232} text="the dashed line is the platform's “now”; dots:" size={12} muted />
			<T x={PX} y={248} text="where the observer, the train and a flash are" size={12} muted />
			<T x={PX} y={280} text="dotted curves: (c·t)² − x² = ±100², ±200²" size={12} muted />
			<T x={PX} y={296} text="they mark 100 m and 200 m on the train's axes" size={12} muted />
			<T
				x={PX}
				y={328}
				text="1 m of c·t: the time light takes to go 1 m, 3.34 ns"
				size={12}
				muted
			/>
		</g>
	{/if}
	{#if w.now > 0.01}
		<g opacity={w.now}>
			<T
				x={PX}
				y={80}
				text="On the platform (along the x axis):"
				size={13}
				color="var(--rel-plat)"
				weight={650}
			/>
			<T x={PX + 12} y={100} text="both strikes at t = 0: simultaneous" size={13} />
			<T
				x={PX}
				y={136}
				text="On the train (along the dashed slices):"
				size={13}
				color="var(--rel-train)"
				weight={650}
			/>
			<T x={PX + 12} y={156} text="front strike at t′ = {ns(strikeT.front.ct)}" size={13} />
			<T x={PX + 12} y={174} text="back strike at t′ = {ns(strikeT.back.ct)}" size={13} />
			<T
				x={PX + 12}
				y={196}
				text={beta < 0.005
					? 'simultaneous too'
					: `the front first, by ${ns(strikeT.back.ct - strikeT.front.ct)}`}
				size={13}
				weight={650}
			/>
			<T x={PX} y={236} text="The solid pink line is the train's “now”," size={12} muted />
			<T x={PX} y={252} text="moving up: it reaches the front strike first." size={12} muted />
			<T x={PX} y={284} text="The flashes (amber) meet on the observer's" size={12} muted />
			<T x={PX} y={300} text="worldline, and cross the passenger's (c·t′)" size={12} muted />
			<T x={PX} y={316} text="front flash first: events every frame agrees on." size={12} muted />
		</g>
	{/if}
	{#if w.interval > 0.01}
		<g opacity={w.interval}>
			<T x={PX} y={84} text="Platform" size={13} color="var(--rel-plat)" weight={650} />
			<T x={PX + 12} y={104} text="c·t = {m(ev.ct)}, x = {m(ev.x)}" size={13} />
			<T
				x={PX + 12}
				y={124}
				text="s² = {sq(ev.ct)} − {sq(ev.x)} = {num(s2, 0)} m²"
				size={13}
				weight={600}
			/>
			<T x={PX} y={160} text="Train" size={13} color="var(--rel-train)" weight={650} />
			<T x={PX + 12} y={180} text="c·t′ = {m(evT.ct)}, x′ = {m(evT.x)}" size={13} />
			<T
				x={PX + 12}
				y={200}
				text="s² = {sq(evT.ct)} − {sq(evT.x)} = {num(interval(evT), 0)} m²"
				size={13}
				weight={600}
			/>
			<T
				x={PX}
				y={240}
				text={atOrigin
					? 'this is the origin itself: s² = 0'
					: kind === 'timelike'
						? 'timelike: something slower than light'
						: kind === 'spacelike'
							? 'spacelike: not even light can get'
							: 'lightlike: a light ray joins the origin'}
				size={13}
				color="var(--rel-strike)"
				weight={650}
			/>
			<T
				x={PX}
				y={258}
				text={atOrigin
					? ''
					: kind === 'timelike'
						? 'can go from one event to the other;'
						: kind === 'spacelike'
							? 'from one event to the other;'
							: 'and the event'}
				size={13}
				color="var(--rel-strike)"
				weight={650}
			/>
			<T
				x={PX}
				y={276}
				text={kind === 'timelike'
					? 'every frame agrees which came first'
					: kind === 'spacelike'
						? 'frames can disagree which came first'
						: ''}
				size={13}
				color="var(--rel-strike)"
				weight={650}
			/>
			<T x={PX} y={312} text="Drag the event (or Tab to it and use the arrows)." size={12} muted />
			<T x={PX} y={328} text="Its train coordinates change with the speed;" size={12} muted />
			<T x={PX} y={344} text="it stays on its hyperbola, and s² stays the same." size={12} muted />
		</g>
	{/if}
	{#if w.all > 0.01}
		<g opacity={w.all}>
			<T x={PX} y={80} text="Time" size={13} color="var(--rel-train)" weight={650} />
			<T x={PX + 12} y={100} text="the passenger's clock ticks every 100 m of c·t′;" size={12} />
			<T
				x={PX + 12}
				y={116}
				text="on the platform's clocks: every {m(100 * g)} (γ × 100 m)"
				size={12}
			/>
			<T x={PX} y={148} text="Length" size={13} color="var(--rel-plat)" weight={650} />
			<T x={PX + 12} y={168} text="along the platform's now (x axis): {m(2 * half)}" size={12} />
			<T x={PX + 12} y={184} text="along the train's now (x′ axis): 200 m" size={12} />
			<T x={PX} y={216} text="Simultaneity" size={13} color="var(--rel-strike)" weight={650} />
			<T
				x={PX + 12}
				y={236}
				text={beta < 0.005
					? 'at rest, the two frames share one now:'
					: "the strikes lie on the platform's now,"}
				size={12}
			/>
			<T
				x={PX + 12}
				y={252}
				text={beta < 0.005
					? 'the strikes are simultaneous for both'
					: "but on two different slices of the train's"}
				size={12}
			/>
			{#if beta >= 0.005}
				<T x={PX + 12} y={268} text="“now”." size={12} />
			{/if}
			<T x={PX} y={296} text="One cause: the same c for everyone." size={14} weight={650} />
		</g>
	{/if}
</g>
