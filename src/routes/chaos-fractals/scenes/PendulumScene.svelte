<script lang="ts">
	/**
	 * The double pendulum, and two twins that drift apart.
	 *
	 * Phases (`step.hints.phase`), cross-faded with a layout tween:
	 *   one   — one pendulum drawn large, released from `params.angle` (both rods),
	 *           with a fading trail of the lower weight and a live energy readout
	 *   twins — two pendulums on one pivot, released from 120° with the first rod
	 *           of the second one `params.nudge` degrees further round; to the right,
	 *           the distance between their lower weights on a log scale
	 *
	 * The motion is precomputed once per start with `swing` (40 s at 60 samples
	 * per second) and replayed in real time from the moment of release. The clock
	 * restarts when the step, the angle, the nudge or the "Release again" count
	 * changes (see `since`); after 40 s it loops.
	 *
	 * When the nudge changes, the previous nudge's curve stays on the graph as a
	 * faint ghost, so the reader can compare how much longer the twins stay
	 * together.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes (see docs/BACKLOG.md).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { clamp, lerp } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { bobs, energy, separation, swing, type PendulumState } from '../chaos';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- constants ----------------------------------------------------------------------
	const SECONDS = 40; // simulated length of every run
	const RATE = 60; // samples per second
	const TWIN_ANGLE = 120; // the twins step has no angle control
	const TRAIL = 3; // s of trail behind the lower weight
	const TRAIL_SEGS = 6;
	const APART = 0.1; // m: "visibly apart"
	const STILL_ONE = 6.3; // s: the reduced-motion frame of the single pendulum

	// ---- phase and inputs ---------------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'one'));
	const twins = $derived(phase === 'twins');
	const angle = $derived(
		twins ? TWIN_ANGLE : clamp(Math.round(Number(params.angle ?? 120)), 5, 170)
	);
	const NUDGES = ['1', '0.01', '0.001', '0.000001'];
	const nudge = $derived(NUDGES.includes(String(params.nudge)) ? String(params.nudge) : '0.001');
	const presses = $derived(Number(params.release ?? 0));

	const w = new Tween(0, { duration: 800, easing: cubicInOut });
	$effect(() => {
		const target = twins ? 1 : 0;
		untrack(() => w.set(target, { duration: reduced ? 0 : 800 }));
	});

	// ---- graph geometry -------------------------------------------------------------------
	const GL = 534; // plot left
	const GR = 930; // plot right
	const GT = 84; // plot top (10 m)
	const GB = 424; // plot bottom (1 nm)
	const TMAX = 20; // s shown on the time axis
	const LMIN = -9;
	const LMAX = 1;
	const gx = (s: number) => GL + (s / TMAX) * (GR - GL);
	const gy = (l: number) => GB - ((l - LMIN) / (LMAX - LMIN)) * (GB - GT);
	const lg = (m: number) => Math.log10(Math.max(1e-9, m));
	const DECADES = Array.from({ length: LMAX - LMIN + 1 }, (_, k) => LMIN + k);
	const DECADE_LABELS: Record<number, string> = {
		[-9]: '1 nm',
		[-6]: '1 µm',
		[-3]: '1 mm',
		[0]: '1 m',
		[1]: '10 m'
	};
	const TIME_TICKS = [0, 5, 10, 15, 20];

	// ---- the runs (computed once per start, never per frame) -----------------------------
	const runA = $derived(swing(angle, angle, SECONDS, 1 / RATE));

	interface Curve {
		nudge: string;
		run: PendulumState[];
		/** Separation (m) of the lower weights at every sample. */
		sep: number[];
		/** First time the separation passes APART (s), or Infinity. */
		apart: number;
		/** SVG path of log10(separation) against time (first TMAX s, graph units). */
		d: string;
		/** Least-squares line of log10(sep) against t over [0, apart]: log10 = a + b·t. */
		fit: { a: number; b: number } | null;
	}

	// The twins' reference run (120°, 120°) is the same for every nudge: cache the
	// curves per nudge, so switching back and forth (and the ghost) costs nothing.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- a plain, non-reactive memo
	const cache = new Map<string, Curve>();
	let reference: PendulumState[] | null = null;
	function curveFor(n: string): Curve {
		const hit = cache.get(n);
		if (hit) return hit;
		const ref = (reference ??= swing(TWIN_ANGLE, TWIN_ANGLE, SECONDS, 1 / RATE));
		const run = swing(TWIN_ANGLE + Number(n), TWIN_ANGLE, SECONDS, 1 / RATE);
		const sep = run.map((s, i) => separation(ref[i], s));
		const k = sep.findIndex((v) => v > APART);
		const apart = k < 0 ? Infinity : k / RATE;
		let d = '';
		const last = Math.min(sep.length - 1, TMAX * RATE);
		for (let i = 0; i <= last; i += 2) {
			d += `${i === 0 ? 'M' : 'L'}${gx(i / RATE).toFixed(1)} ${gy(lg(sep[i])).toFixed(1)}`;
		}
		let fit: Curve['fit'] = null;
		// Only when the climb spans a few seconds (with a 1° nudge it is too short to fit).
		if (k >= 4 * RATE) {
			let sx = 0;
			let sy = 0;
			let sxx = 0;
			let sxy = 0;
			let m = 0;
			for (let i = 0; i <= k; i += 2) {
				const x = i / RATE;
				const y = lg(sep[i]);
				sx += x;
				sy += y;
				sxx += x * x;
				sxy += x * y;
				m++;
			}
			const b = (m * sxy - sx * sy) / (m * sxx - sx * sx);
			fit = { a: (sy - b * sx) / m, b };
		}
		const c = { nudge: n, run, sep, apart, d, fit };
		cache.set(n, c);
		return c;
	}

	const curve = $derived(twins ? curveFor(nudge) : null);

	// The previous nudge's curve, kept as a faint ghost (strings and numbers only).
	let ghost = $state.raw<{ nudge: string; d: string; apart: number } | null>(null);
	let prev: string | null = null;
	$effect(() => {
		const c = curve;
		untrack(() => {
			if (!c) return;
			if (prev !== null && prev !== c.nudge) {
				const p = curveFor(prev);
				ghost = { nudge: p.nudge, d: p.d, apart: p.apart };
			}
			prev = c.nudge;
		});
	});

	// ---- the clock ------------------------------------------------------------------------
	// Time since release. The run restarts when the step, angle, nudge or "Release
	// again" count changes: remember the clock reading at that moment (a frame-to-
	// frame memo inside a $derived, the sanctioned restart approach for a value a
	// pure function of t cannot hold). While the angle slider is dragged the key
	// changes every move, so the pendulum waits at its release pose.
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (reduced) return t;
		const key = `${phase}|${angle}|${nudge}|${presses}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	// Reduced motion: a frozen moment. Twins: clearly apart, both trails drawn.
	const still = $derived(twins ? Math.max(10, (curve?.apart ?? 7.6) + 2.5) : STILL_ONE);
	const elapsed = $derived(reduced ? still : Math.max(0, since) % SECONDS);
	const idx = $derived(Math.min(runA.length - 1, Math.floor(elapsed * RATE)));

	// ---- layout (tweened between the two steps) -------------------------------------------
	const PX = $derived(lerp(400, 240, w.current));
	const PY = 300;
	const SC = $derived(lerp(128, 104, w.current)); // px per metre
	const BOB = $derived(lerp(15, 12, w.current));

	interface Pose {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	}
	const pose = (s: PendulumState): Pose => {
		const b = bobs(s);
		return { x1: PX + b.x1 * SC, y1: PY - b.y1 * SC, x2: PX + b.x2 * SC, y2: PY - b.y2 * SC };
	};

	/** The lower weight's path over the last TRAIL seconds, as segments fading into the past. */
	function trail(states: PendulumState[], i: number) {
		const per = Math.round((TRAIL * RATE) / TRAIL_SEGS);
		const segs: { id: number; pts: string; o: number }[] = [];
		const at = (j: number) => {
			const b = bobs(states[j]);
			return `${(PX + b.x2 * SC).toFixed(1)},${(PY - b.y2 * SC).toFixed(1)}`;
		};
		for (let s = 0; s < TRAIL_SEGS; s++) {
			const hi = i - s * per;
			const lo = Math.max(0, hi - per);
			if (hi <= 0) break;
			let pts = '';
			for (let j = lo; j < hi; j++) pts += at(j) + ' ';
			pts += at(hi);
			segs.push({ id: s, pts, o: 0.85 * (1 - s / TRAIL_SEGS) });
		}
		return segs;
	}

	const poseA = $derived(pose(runA[idx]));
	const poseB = $derived(curve ? pose(curve.run[idx]) : null);
	const trailA = $derived(trail(runA, idx));
	const trailB = $derived(curve ? trail(curve.run, idx) : []);
	const startPose = $derived(pose(runA[0]));

	// ---- readouts -------------------------------------------------------------------------
	const fmt = (v: number) => (v >= 10 ? v.toFixed(1) : v.toPrecision(3));
	const eNow = $derived(energy(runA[idx]));
	const sepNow = $derived(curve ? curve.sep[idx] : 0);
	const sep0 = $derived(curve ? curve.sep[0] : 0);
	function metres(m: number) {
		if (m >= 1) return `${m.toFixed(2)} m`;
		if (m >= 0.01) return `${(m * 100).toFixed(m >= 0.1 ? 0 : 1)} cm`;
		if (m >= 1e-3) return `${(m * 1e3).toFixed(1)} mm`;
		if (m >= 1e-6) return `${(m * 1e6).toFixed(m >= 1e-5 ? 0 : 1)} µm`;
		return `${Math.max(1, m * 1e9).toFixed(0)} nm`;
	}
	const deg = (n: string) => `${n}°`;
	const isApart = $derived(!!curve && elapsed >= curve.apart);
	const revealX = $derived(gx(Math.min(TMAX, elapsed)));
	const markerOn = $derived(elapsed <= TMAX);
	const factor = $derived(curve?.fit ? Math.pow(10, curve.fit.b) : 0);
	const ghostShown = $derived(ghost && curve && ghost.nudge !== curve.nudge ? ghost : null);
	const gap = $derived(ghostShown && curve ? curve.apart - ghostShown.apart : 0);
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
		tabular?: boolean;
	} = {}
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
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}

{#snippet trailLines(segs: { id: number; pts: string; o: number }[], color: string)}
	{#each segs as s (s.id)}
		<polyline
			points={s.pts}
			fill="none"
			stroke={color}
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity={s.o}
		/>
	{/each}
{/snippet}

{#snippet rods(p: Pose, opacity: number)}
	<polyline
		points="{PX},{PY} {p.x1},{p.y1} {p.x2},{p.y2}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
		{opacity}
	/>
{/snippet}

<!-- Solid weights, or (the second twin) rings over a light fill, so a twin on top
     of the other reads as one weight with a coloured rim. -->
{#snippet weights(p: Pose, color: string, opacity: number, ring = false)}
	{#each [p.x1, p.x2] as cx, k (k)}
		<circle
			{cx}
			cy={k === 0 ? p.y1 : p.y2}
			r={BOB}
			fill={color}
			fill-opacity={ring ? 0.25 : 1}
			stroke={ring ? color : 'var(--stage-bg)'}
			stroke-width={ring ? 3 : 1.5}
			{opacity}
		/>
	{/each}
{/snippet}

<g>
	<defs>
		<clipPath id="pendulum-graph-clip">
			<rect x={GL - 4} y={GT - 10} width={Math.max(0, revealX - GL + 4)} height={GB - GT + 20} />
		</clipPath>
	</defs>

	<!-- the reach of the lower weight (2 m), straight down, and the release pose -->
	<circle
		cx={PX}
		cy={PY}
		r={2 * SC}
		fill="none"
		stroke="var(--stage-grid)"
		stroke-width="1"
		stroke-dasharray="3 5"
	/>
	<line
		x1={PX}
		y1={PY}
		x2={PX}
		y2={PY + 2 * SC}
		stroke="var(--stage-grid)"
		stroke-width="1"
		stroke-dasharray="4 4"
	/>
	<g opacity="0.55">
		<polyline
			points="{PX},{PY} {startPose.x1},{startPose.y1} {startPose.x2},{startPose.y2}"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			stroke-linejoin="round"
		/>
		<circle cx={startPose.x1} cy={startPose.y1} r="4" fill="var(--stage-ink-muted)" />
		<circle cx={startPose.x2} cy={startPose.y2} r="4" fill="var(--stage-ink-muted)" />
	</g>

	<!-- trails, then the pendulums -->
	{@render trailLines(trailA, 'var(--chaos-a)')}
	{#if curve}
		<g opacity={w.current}>{@render trailLines(trailB, 'var(--chaos-b)')}</g>
	{/if}
	{@render rods(poseA, 1)}
	{#if poseB}
		{@render rods(poseB, 0.6 * w.current)}
	{/if}
	{@render weights(poseA, 'var(--chaos-a)', 1)}
	{#if poseB}
		{@render weights(poseB, 'var(--chaos-b)', w.current, true)}
	{/if}
	<!-- the pivot -->
	<rect
		x={PX - 22}
		y={PY - 10}
		width="44"
		height="6"
		rx="2"
		fill="var(--stage-ink-muted)"
		opacity="0.7"
	/>
	<circle cx={PX} cy={PY} r="5" fill="var(--surface)" stroke="var(--stage-ink)" stroke-width="2" />

	<!-- single pendulum: readout card -->
	{#if w.current < 0.5}
		<g opacity={clamp(1 - 2 * w.current, 0, 1)}>
			<rect
				x="704"
				y="220"
				width="236"
				height="160"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			{@render txt(722, 250, `Released from ${angle}°`, 15, { weight: 600 })}
			{@render txt(722, 268, 'both rods, at rest (dashed)', 11, { muted: true })}
			{@render txt(722, 298, `Time since release  ${elapsed.toFixed(1)} s`, 13, {
				tabular: true
			})}
			{@render txt(722, 328, `Energy  ${fmt(eNow)} J`, 13, {
				tabular: true,
				color: 'var(--chaos-a)',
				weight: 600
			})}
			{@render txt(722, 346, 'stays constant, a check that', 11, { muted: true })}
			{@render txt(722, 362, 'the computation is accurate', 11, { muted: true })}
		</g>
	{/if}

	<!-- twins: the graph and readouts -->
	{#if curve && w.current > 0.5}
		<g opacity={clamp(2 * w.current - 1, 0, 1)}>
			{@render txt(GL, 46, 'Distance between the two lower weights', 14, { weight: 600 })}
			{@render txt(GL, 64, 'each line is ten times the one below', 11, { muted: true })}

			{#each DECADES as l (l)}
				<line
					x1={GL}
					x2={GR}
					y1={gy(l)}
					y2={gy(l)}
					stroke={DECADE_LABELS[l] ? 'var(--stage-line)' : 'var(--stage-grid)'}
					stroke-width="1"
					opacity={DECADE_LABELS[l] ? 0.6 : 1}
				/>
				{#if DECADE_LABELS[l]}
					{@render txt(GL - 8, gy(l) + 4, DECADE_LABELS[l], 11, { anchor: 'end', muted: true })}
				{/if}
			{/each}
			{#each TIME_TICKS as s (s)}
				<line x1={gx(s)} x2={gx(s)} y1={GB} y2={GB + 5} stroke="var(--stage-line)" />
				{@render txt(gx(s), GB + 18, `${s} s`, 11, { anchor: 'middle', muted: true })}
			{/each}
			<line x1={GL} x2={GR} y1={GB} y2={GB} stroke="var(--stage-line)" />

			<!-- 10 cm: visibly apart -->
			<line
				x1={GL}
				x2={GR}
				y1={gy(-1)}
				y2={gy(-1)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="6 4"
			/>
			{@render txt(GL - 8, gy(-1) + 4, '10 cm', 11, { anchor: 'end', muted: true })}
			{@render txt(GR, gy(-1) - 6, 'visibly apart', 11, { anchor: 'end', muted: true })}

			<!-- the previous nudge, faint -->
			{#if ghostShown}
				<path
					d={ghostShown.d}
					fill="none"
					stroke="var(--stage-ink-muted)"
					stroke-width="1.5"
					opacity="0.45"
					stroke-linejoin="round"
				/>
				{#if ghostShown.apart <= TMAX}
					<circle
						cx={gx(ghostShown.apart)}
						cy={gy(-1)}
						r="4"
						fill="var(--stage-ink-muted)"
						opacity="0.7"
					/>
				{/if}
			{/if}

			<!-- the straight line the curve follows on this scale -->
			{#if curve.fit && isApart}
				<line
					x1={gx(0)}
					y1={gy(curve.fit.a)}
					x2={gx(curve.apart)}
					y2={gy(curve.fit.a + curve.fit.b * curve.apart)}
					stroke="var(--stage-ink)"
					stroke-width="1.4"
					stroke-dasharray="2 4"
					stroke-linecap="round"
				/>
			{/if}

			<!-- the separation so far -->
			<path
				d={curve.d}
				fill="none"
				stroke="var(--chaos-b)"
				stroke-width="2.4"
				stroke-linejoin="round"
				clip-path="url(#pendulum-graph-clip)"
			/>
			{#if markerOn}
				<line
					x1={revealX}
					x2={revealX}
					y1={GT}
					y2={GB}
					stroke="var(--stage-ink-muted)"
					stroke-width="1"
					opacity="0.5"
				/>
				<circle
					cx={revealX}
					cy={gy(lg(sepNow))}
					r="4.5"
					fill="var(--chaos-b)"
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
			{#if isApart && curve.apart <= TMAX}
				<circle
					cx={gx(curve.apart)}
					cy={gy(-1)}
					r="5.5"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
			{/if}

			<!-- readouts -->
			{@render txt(GL, 470, `Starting difference  ${deg(nudge)}`, 13, { weight: 600 })}
			{@render txt(GL, 486, `lower weights ${metres(sep0)} apart`, 11, { muted: true })}
			{@render txt(GR, 470, `t = ${elapsed.toFixed(1)} s`, 13, {
				anchor: 'end',
				tabular: true
			})}
			{@render txt(GR, 486, `now ${metres(sepNow)} apart`, 11, {
				anchor: 'end',
				tabular: true,
				color: 'var(--chaos-b)'
			})}
			{#if isApart}
				{@render txt(GL, 516, `Visibly apart after ${curve.apart.toFixed(1)} s`, 14, {
					weight: 600,
					color: 'var(--chaos-b)'
				})}
				{#if curve.fit}
					{@render txt(
						GL,
						534,
						`Until then: about ×${factor.toFixed(1)} further apart every second (dotted)`,
						11,
						{ muted: true }
					)}
				{/if}
			{:else}
				{@render txt(GL, 516, 'Still moving as one: less than 10 cm apart', 14, {
					muted: true
				})}
			{/if}
			{#if ghostShown}
				{@render txt(
					GL,
					560,
					`Grey curve: ${deg(ghostShown.nudge)}, apart after ${ghostShown.apart.toFixed(1)} s`,
					12
				)}
				{@render txt(
					GL,
					577,
					`${deg(nudge)} stays together ${Math.abs(gap).toFixed(1)} s ${gap >= 0 ? 'longer' : 'less'}`,
					12,
					{ weight: 600 }
				)}
			{/if}

			<!-- legend for the twins -->
			<circle cx="30" cy="556" r="6" fill="var(--chaos-a)" />
			{@render txt(42, 560, `released from ${TWIN_ANGLE}°`, 12)}
			<circle cx="30" cy="578" r="6" fill="var(--chaos-b)" />
			{@render txt(42, 582, `released from ${TWIN_ANGLE}° + ${deg(nudge)}`, 12)}
		</g>
	{/if}
</g>
