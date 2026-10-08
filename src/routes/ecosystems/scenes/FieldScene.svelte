<script lang="ts">
	/**
	 * Rabbits (and foxes) on a field, with their numbers as curves.
	 *
	 * Phases (`step.hints.phase`):
	 *   growth — rabbits alone, logistic growth from 10 towards the carrying
	 *            capacity K (`params.room`), drawn as a dashed line
	 *   cycles — Lotka–Volterra rabbits and foxes from LV_START: the populations
	 *            cycle, the foxes' peaks after the rabbits'; the cycle length is
	 *            measured from the run (time between two rabbit peaks)
	 *   loop   — the same run as foxes against rabbits: a closed loop round the
	 *            balance point (`lvEquilibrium`), with the four quarters labelled
	 *
	 * The run is computed once per set of rates (eco.ts, RK4) and replayed at one
	 * simulated year per second of animation. Each icon on the field stands for N
	 * animals (N chosen per run so that there are at most 120 rabbit and 40 fox
	 * icons); icon i is shown while population / N > i, so icons keep their
	 * identity, and the top one fades in or out as the count passes it.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, clamp, scale, smoothstep, TAU, type Scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { LV_START, logisticGrowth, lotkaVolterra, lvEquilibrium, run } from '../eco';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- layout -------------------------------------------------------------------
	const FX0 = 24;
	const FY0 = 60;
	const FW = 420;
	const FH = 468;
	const PX0 = 532;
	const PX1 = 896;
	const PY0 = 96;
	const PY1 = 470;
	const YEARS_PER_SECOND = 1;
	const SAMPLE = 0.05; // years between stored samples
	const START_RABBITS = 10; // growth step
	const C = 0.1; // how efficiently eaten rabbits become foxes
	const MAX_RABBIT_ICONS = 120;
	const MAX_FOX_ICONS = 40;

	// ---- step and controls --------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'growth'));
	const growth = $derived(phase === 'growth');
	const loop = $derived(phase === 'loop');
	const birth = $derived(Number(params.birth ?? 1));
	const room = $derived(Number(params.room ?? 600));
	const predation = $derived(Number(params.predation ?? 0.02));
	const death = $derived(Number(params.death ?? 0.6));
	const restarts = $derived(Number(params.restart ?? 0));
	const WINDOW = $derived(growth ? 40 : 60); // years shown on the time chart
	const RUN_YEARS = $derived(growth ? 120 : 300);

	/** "Nice" number of animals per icon: 1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, … */
	function perIcon(v: number) {
		for (let mag = 1; ; mag *= 10) {
			for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
				const n = m * mag;
				if (Number.isInteger(n) && n >= v) return n;
			}
		}
	}

	/** A round axis maximum ≥ v (1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ), so the curves fill the chart. */
	function niceTop(v: number) {
		const mag = Math.pow(10, Math.floor(Math.log10(v)));
		return ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
			.map((m) => m * mag)
			.find((n) => n >= v - 1e-9) ?? 10 * mag) as number;
	}

	// ---- the run (recomputed only when the rates change) ---------------------------
	const sim = $derived.by(() => {
		const states = growth
			? run(logisticGrowth(birth, room), [START_RABBITS], RUN_YEARS, SAMPLE)
			: run(lotkaVolterra({ a: birth, b: predation, c: C, d: death }), LV_START, RUN_YEARS, SAMPLE);
		const H = states.map((s) => s[0]);
		const P = states.map((s) => (growth ? 0 : s[1]));
		let maxH = 0;
		let minH = Infinity;
		let maxP = 0;
		for (let i = 0; i < H.length; i++) {
			maxH = Math.max(maxH, H[i]);
			minH = Math.min(minH, H[i]);
			maxP = Math.max(maxP, P[i]);
		}
		if (growth) maxH = Math.max(maxH, room);
		// A run that starts exactly at the balance point stays there.
		const still = !growth && maxH - minH < 1;
		// Rabbit peaks (local maxima, refined with a parabola through three samples).
		const peaks: number[] = [];
		if (!growth && !still) {
			for (let i = 1; i < H.length - 1; i++) {
				if (H[i] > H[i - 1] && H[i] >= H[i + 1]) {
					const den = H[i - 1] - 2 * H[i] + H[i + 1];
					const off = den === 0 ? 0 : (0.5 * (H[i - 1] - H[i + 1])) / den;
					peaks.push((i + off) * SAMPLE);
				}
			}
		}
		const period = peaks.length >= 2 ? peaks[1] - peaks[0] : 0;
		// Extreme points of the first lap, for the loop's arrows and quarter labels.
		const lapEnd =
			period > 0 ? Math.min(H.length - 2, Math.ceil(period / SAMPLE) + 1) : H.length - 2;
		const ext = { minP: 1, maxH: 1, maxP: 1, minH: 1 };
		for (let i = 1; i <= lapEnd; i++) {
			if (P[i] < P[ext.minP]) ext.minP = i;
			if (P[i] > P[ext.maxP]) ext.maxP = i;
			if (H[i] > H[ext.maxH]) ext.maxH = i;
			if (H[i] < H[ext.minH]) ext.minH = i;
		}
		const n = perIcon(Math.max(maxH / MAX_RABBIT_ICONS, maxP / MAX_FOX_ICONS, 1));
		return { H, P, maxH, maxP, still, peaks, period, ext, n };
	});

	const eq = $derived(lvEquilibrium({ a: birth, b: predation, c: C, d: death }));

	// ---- time ----------------------------------------------------------------------
	// The run restarts when a rate changes or "Start again" is pressed: remember the
	// clock reading at that moment (a frame-to-frame memo inside a $derived, the
	// guide's sanctioned exception, as in newtons-laws TrackScene).
	let memo = { key: '', start: 0 };
	const since = $derived.by(() => {
		if (reduced) return t;
		const key = `${phase}|${birth}|${room}|${predation}|${death}|${restarts}`;
		if (key !== memo.key || t < memo.start) memo = { key, start: memo.key === '' ? 0 : t };
		return t - memo.start;
	});
	// Reduced motion: the whole window drawn; icons, readouts and the "now" marker at
	// one representative year (the end of the window for growth, a late rabbit peak
	// for the cycles).
	const stillYear = $derived.by(() => {
		if (growth || sim.peaks.length === 0) return WINDOW;
		const late = sim.peaks.filter((p) => p <= WINDOW * 0.8);
		return late.length ? late[late.length - 1] : WINDOW;
	});
	const year = $derived(reduced ? stillYear : Math.min(since * YEARS_PER_SECOND, RUN_YEARS));
	const drawnTo = $derived(reduced ? WINDOW : year);
	const lo = $derived(Math.max(0, drawnTo - WINDOW));
	const appear = $derived(reduced ? 1 : smoothstep(0, 0.6, since));

	const at = (arr: number[], y: number) => {
		const f = clamp(y / SAMPLE, 0, arr.length - 1);
		const i = Math.min(arr.length - 2, Math.floor(f));
		return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
	};
	const rabbits = $derived(at(sim.H, year));
	const foxes = $derived(growth ? 0 : at(sim.P, year));

	// ---- scales --------------------------------------------------------------------
	const tw = { duration: 600, easing: cubicInOut };
	const hTop = Tween.of(() => (growth ? 1100 : niceTop(sim.maxH * 1.04)), tw);
	const pTop = Tween.of(() => niceTop(sim.maxP * 1.04 || 1), tw);
	const sx = $derived(scale([lo, lo + WINDOW], [PX0, PX1]));
	const syH = $derived(scale([0, hTop.current], [PY1, PY0]));
	const syP = $derived(scale([0, pTop.current], [PY1, PY0]));
	// Phase plot: rabbits across, foxes up.
	const qx = $derived(scale([0, hTop.current], [PX0, PX1]));
	const qy = $derived(scale([0, pTop.current], [PY1, PY0]));

	/** Path of a series against time from `from` to `to` years (≤ ~300 points). */
	function seriesPath(arr: number[], from: number, to: number, x: Scale, y: Scale) {
		const i0 = Math.ceil(from / SAMPLE);
		const i1 = Math.floor(to / SAMPLE);
		if (i1 < i0) return '';
		const stride = Math.max(1, Math.ceil((i1 - i0) / 300));
		let d = `M${x(from).toFixed(1)} ${y(at(arr, from)).toFixed(1)}`;
		for (let i = Math.ceil(i0 / stride) * stride; i <= i1; i += stride)
			d += `L${x(i * SAMPLE).toFixed(1)} ${y(arr[i]).toFixed(1)}`;
		return d + `L${x(to).toFixed(1)} ${y(at(arr, to)).toFixed(1)}`;
	}
	/** Path of the loop (foxes against rabbits) from `from` to `to` years. */
	function loopPath(from: number, to: number) {
		const { H, P } = sim;
		const i0 = Math.ceil(from / SAMPLE);
		const i1 = Math.floor(to / SAMPLE);
		const stride = Math.max(1, Math.ceil((i1 - i0) / 360));
		let d = `M${qx(at(H, from)).toFixed(1)} ${qy(at(P, from)).toFixed(1)}`;
		for (let i = Math.ceil(i0 / stride) * stride; i <= i1; i += stride)
			d += `L${qx(H[i]).toFixed(1)} ${qy(P[i]).toFixed(1)}`;
		return d + `L${qx(at(H, to)).toFixed(1)} ${qy(at(P, to)).toFixed(1)}`;
	}

	const rabbitPath = $derived(seriesPath(sim.H, lo, drawnTo, sx, syH));
	const foxPath = $derived(growth ? '' : seriesPath(sim.P, lo, drawnTo, sx, syP));
	// The loop: the first lap is traced as it happens; after that, the last full lap.
	const loopD = $derived.by(() => {
		if (!loop || sim.still) return '';
		const end = reduced ? Math.max(drawnTo, sim.period) : year;
		const from = sim.period > 0 && end > sim.period ? end - sim.period - SAMPLE : 0;
		return loopPath(from, Math.max(end, SAMPLE));
	});

	// ---- loop decorations ------------------------------------------------------------
	const quarters = $derived.by(() => {
		if (!loop || sim.still) return [];
		const { H, P, ext } = sim;
		const seen = reduced ? Infinity : year;
		const items = [
			{ id: 'rr', i: ext.minP, text: 'rabbits rise', side: 'below' },
			{ id: 'fr', i: ext.maxH, text: 'foxes rise', side: 'right' },
			{ id: 'rf', i: ext.maxP, text: 'rabbits fall', side: 'above' },
			{ id: 'ff', i: ext.minH, text: 'foxes fall', side: 'left' }
		] as const;
		return items.map((q) => {
			const x = qx(H[q.i]);
			const y = qy(P[q.i]);
			const ang =
				(Math.atan2(qy(P[q.i + 1]) - qy(P[q.i - 1]), qx(H[q.i + 1]) - qx(H[q.i - 1])) * 180) /
				Math.PI;
			const w = q.text.length * 6.6;
			let lx = x;
			let ly: number;
			let anchor: 'start' | 'middle' | 'end' = 'middle';
			if (q.side === 'below') ly = y + 22 > PY1 - 6 ? y - 12 : y + 22;
			else if (q.side === 'above') ly = y - 14 < PY0 + 6 ? y + 24 : y - 14;
			else if (q.side === 'right') {
				ly = y + 4;
				// No room outside: inside the loop, off the balance line (clear of the cross).
				if (x + 14 + w < PX1) [lx, anchor] = [x + 14, 'start'];
				else [lx, ly, anchor] = [x - 14, y + 22, 'end'];
			} else {
				ly = y + 4;
				if (x - 14 - w > PX0 + 4) [lx, anchor] = [x - 14, 'end'];
				else [lx, ly, anchor] = [x + 14, y - 14, 'start'];
			}
			if (anchor === 'middle') lx = clamp(lx, PX0 + w / 2 + 4, PX1 - w / 2 - 4);
			const show = smoothstep(0, 0.8, seen - q.i * SAMPLE);
			return { ...q, x, y, ang, lx, ly, anchor, show };
		});
	});

	// The balance point slides to its new place when a rate changes; the old one
	// stays faintly for a moment. The effect reads only `eq` (never `t`).
	const eqT = new Tween({ prey: 300, predators: 50 }, tw);
	const ghostFade = new Tween(0, { duration: 1600 });
	let ghost = $state({ prey: 300, predators: 50 });
	let lastEq: { prey: number; predators: number } | null = null;
	$effect(() => {
		const e = eq;
		untrack(() => {
			if (lastEq === null) eqT.set(e, { duration: 0 });
			else if (lastEq.prey !== e.prey || lastEq.predators !== e.predators) {
				if (ghostFade.current < 0.05) {
					ghost = lastEq;
					ghostFade.set(1, { duration: 0 });
					ghostFade.set(0);
				}
				eqT.set(e);
			}
			lastEq = e;
		});
	});

	// ---- field icons -----------------------------------------------------------------
	// Spread over the field with a low-discrepancy (R2) sequence, so any first k
	// icons cover it evenly; each wanders on its own slow loop (a pure function of t).
	const frac = (v: number) => v - Math.floor(v);
	const h3 = (i: number, s: number) => frac(Math.sin(i * 127.1 + s * 311.7) * 43758.5453);
	const rabbitIcons = $derived.by(() => {
		const count = rabbits / sim.n;
		const out = [];
		for (let i = 0; i < Math.min(MAX_RABBIT_ICONS, Math.ceil(count)); i++) {
			const hx = FX0 + 30 + frac(0.5 + i * 0.7548776662) * (FW - 60);
			const hy = FY0 + 28 + frac(0.5 + i * 0.5698402911) * (FH - 52);
			const w = 0.35 + 0.3 * h3(i, 1);
			const ph = TAU * h3(i, 2);
			const x = hx + 14 * Math.sin(w * t + ph);
			const y = hy + 9 * Math.sin(0.7 * w * t + 1.7 * ph);
			const hop = 3 * Math.abs(Math.sin(TAU * (t * (0.7 + 0.5 * h3(i, 3)) + h3(i, 4))));
			const face = Math.cos(w * t + ph) >= 0 ? 1 : -1;
			out.push({ i, x, y: y - hop, face, o: clamp(count - i) * appear });
		}
		return out;
	});
	const foxIcons = $derived.by(() => {
		const count = foxes / sim.n;
		const out = [];
		for (let i = 0; i < Math.min(MAX_FOX_ICONS, Math.ceil(count)); i++) {
			const hx = FX0 + 46 + frac(0.21 + i * 0.7548776662) * (FW - 92);
			const hy = FY0 + 34 + frac(0.83 + i * 0.5698402911) * (FH - 64);
			const w = 0.22 + 0.15 * h3(i, 5);
			const ph = TAU * h3(i, 6);
			const x = hx + 26 * Math.sin(w * t + ph);
			const y = hy + 14 * Math.sin(0.8 * w * t + 2.3 * ph);
			const face = Math.cos(w * t + ph) >= 0 ? 1 : -1;
			out.push({ i, x, y, face, o: clamp(count - i) * appear });
		}
		return out;
	});
	// A few static tufts of grass.
	const tufts = Array.from({ length: 14 }, (_, k) => ({
		k,
		x: FX0 + 24 + frac(0.37 + k * 0.7548776662) * (FW - 48),
		y: FY0 + 22 + frac(0.11 + k * 0.5698402911) * (FH - 36)
	}));

	const RABBIT =
		'M-6 0a6 4.6 0 1 0 12 0a6 4.6 0 1 0-12 0Z M3 -3a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z ' +
		'M6.3 -5L5.4 -11.6L3.2 -11.5L4.4 -4.6Z M7.9 -4.3L9.4 -10.8L7.4 -11.4L6.4 -5Z ' +
		'M-8.2 -1.2a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z';
	const FOX =
		'M-8 0a8 4.2 0 1 0 16 0a8 4.2 0 1 0-16 0Z M5.5 3L14 0.2L5.5 -4Z M10.2 -2.2L7.6 -9L6.2 -3.2Z ' +
		'M-7 -1.5C-11 -6 -17 -5 -19.5 -1C-16 2 -11 2.5 -7 1.8Z M-5 2.5L-5.6 7.5L-4 7.5L-3 3Z M4 2.5L4.4 7.5L6 7.5L6 2.5Z';

	// ---- readouts --------------------------------------------------------------------
	const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
	const cycleText = $derived.by(() => {
		if (growth) return '';
		if (sim.still) return 'No cycle: the run starts at the balance point';
		if (sim.peaks.length >= 2 && (reduced || year >= sim.peaks[1]))
			return `One cycle ≈ ${sim.period.toFixed(1)} years`;
		return 'Cycle length: measuring…';
	});
	// The bracket under "one cycle": the latest pair of rabbit peaks already drawn.
	const bracket = $derived.by(() => {
		if (growth || loop || sim.still) return null;
		const done = sim.peaks.filter((p) => p <= drawnTo && p >= lo);
		if (done.length < 2) return null;
		return { x0: sx(done[done.length - 2]), x1: sx(done[done.length - 1]) };
	});
</script>

<g>
	<!-- ===================================================== field -->
	<rect
		x={FX0}
		y={FY0}
		width={FW}
		height={FH}
		rx="18"
		fill="var(--eco-grass)"
		stroke="var(--border)"
	/>
	{#each tufts as g (g.k)}
		<path
			d="M{g.x - 5} {g.y + 3} q2 -6 3 -9 M{g.x} {g.y + 3} q0 -7 0 -11 M{g.x + 5} {g.y +
				3} q-2 -6 -3 -9"
			fill="none"
			stroke="var(--eco-willow)"
			stroke-width="1.2"
			stroke-linecap="round"
			opacity="0.35"
		/>
	{/each}
	{#each rabbitIcons as r (r.i)}
		<path
			d={RABBIT}
			transform="translate({r.x.toFixed(1)} {r.y.toFixed(1)}) scale({r.face} 1)"
			fill="var(--eco-prey)"
			opacity={r.o}
		/>
	{/each}
	{#each foxIcons as f (f.i)}
		<path
			d={FOX}
			transform="translate({f.x.toFixed(1)} {f.y.toFixed(1)}) scale({f.face} 1)"
			fill="var(--eco-predator)"
			opacity={f.o}
		/>
	{/each}

	<!-- readouts over the field -->
	{@render txt(FX0 + 2, 40, `Rabbits ${fmt(rabbits)}`, 16, {
		color: 'var(--eco-prey)',
		weight: 650,
		tabular: true
	})}
	{#if !growth}
		{@render txt(FX0 + 150, 40, `Foxes ${fmt(foxes)}`, 16, {
			color: 'var(--eco-predator)',
			weight: 650,
			tabular: true
		})}
	{/if}
	{@render txt(FX0 + FW - 2, 40, `year ${Math.floor(year)}`, 14, {
		anchor: 'end',
		muted: true,
		tabular: true
	})}

	<!-- legend under the field -->
	<path d={RABBIT} transform="translate({FX0 + 12} 556)" fill="var(--eco-prey)" />
	{#if growth}
		{@render txt(FX0 + 28, 560, `each rabbit icon = ${sim.n} rabbits`, 13, { muted: true })}
	{:else}
		<path d={FOX} transform="translate({FX0 + 44} 556)" fill="var(--eco-predator)" />
		{@render txt(FX0 + 66, 560, `each icon = ${sim.n} rabbits or ${sim.n} foxes`, 13, {
			muted: true
		})}
	{/if}

	<!-- ===================================================== chart -->
	{#if loop}
		{@render txt(PX0, 40, 'Foxes against rabbits', 15, { weight: 650 })}
		<Axes sx={qx} sy={qy} xLabel="rabbits →" yLabel="foxes ↑" />
		<!-- the balance point lines, where each population stops changing -->
		<g opacity="0.5">
			<line
				x1={qx(eqT.current.prey)}
				x2={qx(eqT.current.prey)}
				y1={PY0}
				y2={PY1}
				stroke="var(--stage-line)"
				stroke-dasharray="3 5"
			/>
			<line
				x1={PX0}
				x2={PX1}
				y1={qy(eqT.current.predators)}
				y2={qy(eqT.current.predators)}
				stroke="var(--stage-line)"
				stroke-dasharray="3 5"
			/>
		</g>
		{#if !reduced && ghostFade.current > 0.01 && ghost.prey <= qx.domain[1] && ghost.predators <= qy.domain[1]}
			<path
				d="M{qx(ghost.prey) - 6} {qy(ghost.predators) - 6} l12 12 m0 -12 l-12 12"
				stroke="var(--stage-ink-muted)"
				stroke-width="2"
				opacity={0.6 * ghostFade.current}
			/>
		{/if}
		<path
			d={loopD}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
			stroke-linejoin="round"
			opacity="0.85"
		/>
		{#each quarters as q (q.id)}
			<g opacity={q.show}>
				<path
					d="M-6 -6 L5 0 L-6 6 Z"
					transform="translate({q.x.toFixed(1)} {q.y.toFixed(1)}) rotate({q.ang.toFixed(1)})"
					fill="var(--stage-ink)"
				/>
				{@render txt(q.lx, q.ly, q.text, 13, {
					anchor: q.anchor,
					color: q.id.startsWith('r') ? 'var(--eco-prey)' : 'var(--eco-predator)',
					weight: 600
				})}
			</g>
		{/each}
		{@const ex = qx(eqT.current.prey)}
		{@const ey = qy(eqT.current.predators)}
		<path
			d="M{ex - 7} {ey - 7} l14 14 m0 -14 l-14 14"
			stroke="var(--stage-ink)"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
		<!-- the balance point's key, in the header (the loop's inside is often too small) -->
		<path
			d="M{PX0 + 1} {57} l10 10 m0 -10 l-10 10"
			stroke="var(--stage-ink)"
			stroke-width="2.2"
			stroke-linecap="round"
		/>
		{@render txt(PX0 + 20, 66, 'balance point:', 13, { weight: 650 })}
		{@render txt(PX0 + 116, 66, `${fmt(eq.prey)} rabbits, ${fmt(eq.predators)} foxes`, 13, {
			muted: true,
			tabular: true
		})}
		<!-- now -->
		<circle
			cx={qx(rabbits)}
			cy={qy(foxes)}
			r="6.5"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{:else}
		<!-- legend -->
		<line
			x1={PX0}
			x2={PX0 + 22}
			y1={35}
			y2={35}
			stroke="var(--eco-prey)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		{@render txt(PX0 + 30, 40, growth ? 'rabbits' : 'rabbits (left scale)', 13, {
			color: 'var(--eco-prey)',
			weight: 600
		})}
		{#if growth}
			<line
				x1={PX0 + 104}
				x2={PX0 + 128}
				y1={35}
				y2={35}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			{@render txt(PX0 + 136, 40, 'carrying capacity K', 13, { muted: true })}
		{:else}
			<line
				x1={PX0 + 170}
				x2={PX0 + 192}
				y1={35}
				y2={35}
				stroke="var(--eco-predator)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			{@render txt(PX0 + 200, 40, 'foxes (right scale)', 13, {
				color: 'var(--eco-predator)',
				weight: 600
			})}
		{/if}

		<Axes
			{sx}
			sy={syH}
			xLabel="years"
			yTicks={growth ? [0, 250, 500, 750, 1000] : undefined}
			xFormat={(v) => String(v)}
		/>
		{#if !growth}
			<Axes {sx} sy={syP} yRight grid={false} />
		{/if}

		{#if growth}
			<line
				x1={PX0}
				x2={PX1}
				y1={syH(room)}
				y2={syH(room)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="6 5"
			/>
			{@render txt(PX1 - 4, syH(room) - 8, `carrying capacity K = ${fmt(room)}`, 13, {
				anchor: 'end',
				muted: true,
				weight: 600
			})}
		{/if}

		{#if bracket}
			<path
				d="M{bracket.x0} {PY0 - 4} v-6 H{bracket.x1} v6"
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
			/>
			{@render txt((bracket.x0 + bracket.x1) / 2, PY0 - 15, 'one cycle', 12, {
				anchor: 'middle',
				muted: true
			})}
		{/if}

		<path
			d={rabbitPath}
			fill="none"
			stroke="var(--eco-prey)"
			stroke-width="2.6"
			stroke-linejoin="round"
		/>
		{#if !growth}
			<path
				d={foxPath}
				fill="none"
				stroke="var(--eco-predator)"
				stroke-width="2.6"
				stroke-linejoin="round"
			/>
		{/if}

		<!-- now -->
		<line
			x1={sx(year)}
			x2={sx(year)}
			y1={PY0}
			y2={PY1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 4"
		/>
		<circle
			cx={sx(year)}
			cy={syH(rabbits)}
			r="5.5"
			fill="var(--eco-prey)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		{#if !growth}
			<circle
				cx={sx(year)}
				cy={syP(foxes)}
				r="5.5"
				fill="var(--eco-predator)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
		{/if}
	{/if}

	<!-- under the chart -->
	{#if cycleText}
		{@render txt(PX0, 560, cycleText, 14, { weight: 650 })}
	{/if}
	{@render txt(944, 584, '1 second ≈ 1 year', 12, { anchor: 'end', muted: true })}
</g>

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
		style:font-size="{size}px"
		style:fill={opts.color}
		style:font-variant-numeric={opts.tabular ? 'tabular-nums' : undefined}>{text}</text
	>
{/snippet}
