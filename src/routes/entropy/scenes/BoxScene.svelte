<script lang="ts">
	/**
	 * The box of gas: 80 particles in a 2 × 1 box, coloured by kinetic energy,
	 * with two thermometers (left and right half) and a chart over time.
	 *
	 * Phases (`step.hints.phase`):
	 *   wall     — the wall stays; the chart shows the two temperatures
	 *   mix      — the wall lifts at 1.5 s; temperatures equalise
	 *   entropy  — as mix, but the chart shows the entropy rise ΔS / k_B
	 *   reverse  — the wall lifts at 1 s, every velocity is reversed 8 s later
	 *              (and whenever the reader presses "reverse"): the gas un-mixes
	 *   nudge    — as reverse, but one particle is moved by 10^nudge of the box
	 *              at each reversal; the exact reversal is drawn dashed
	 *
	 * Everything comes from `GasRun` (see ../gas.ts), which integrates lazily
	 * and caches frames, so the picture is a function of the run's elapsed
	 * time. The run restarts (elapsed = 0) when its temperatures or the restart
	 * count change; that start time and the times of "reverse" presses are the
	 * only remembered values, kept in plain variables inside `$derived`s (as in
	 * the Galton board scene). Reduced motion: a fixed, informative moment per
	 * phase (after the mixing, or back at the start after the backward run); presses are ignored, and so are
	 * presses before the wall has lifted.
	 *
	 * Text sizes and colours are set with `style:` because the stage's CSS
	 * overrides SVG presentation attributes.
	 */
	import { clamp, smoothstep } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		E0,
		FPS,
		GasRun,
		H,
		R,
		W,
		WALL,
		formatCount,
		lnWaysGasMax,
		sup,
		temperature,
		toLog10
	} from '../gas';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'wall'));
	const isEntropy = $derived(phase !== 'wall' && phase !== 'mix');
	const canReverse = $derived(phase === 'reverse' || phase === 'nudge');

	const tLeft = $derived(clamp(Number(params.tLeft ?? 4), 0.5, 8));
	const tRight = $derived(clamp(Number(params.tRight ?? 1), 0.5, 8));
	const restarts = $derived(Number(params.restart ?? 0));
	const presses = $derived(Number(params.reverse ?? 0));
	const nudgeExp = $derived(clamp(Math.round(Number(params.nudge ?? -9)), -12, -3));

	const WALL_LIFT_MIX = 1.5;
	const WALL_LIFT_REV = 1;
	const REDUCED_T: Record<string, number> = {
		wall: 6,
		mix: 14,
		entropy: 16,
		reverse: 17,
		nudge: 17
	};

	// The reversal phases always start from the default 4 / 1 gas.
	const temps = $derived(canReverse ? { l: 4, r: 1 } : { l: tLeft, r: tRight });
	const wallUntil = $derived(
		phase === 'wall' ? Infinity : canReverse ? WALL_LIFT_REV : WALL_LIFT_MIX
	);
	const autoReverse = $derived(canReverse ? WALL_LIFT_REV + 8 : -1);

	// ---- run clock: restarts when the run's settings change ----------------------
	const runKey = $derived(`${phase}|${temps.l}|${temps.r}|${restarts}`);
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return REDUCED_T[phase] ?? 10;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0; // a new step started (t went back to 0)
		return Math.max(0, t - t0);
	});

	// ---- reversals: the automatic one plus one per press (frame-aligned) -----------
	let pressTimes: number[] = [];
	let pressKey = '';
	let lastPresses = -1;
	let lastElapsed = 0;
	const reversals = $derived.by(() => {
		const el = elapsed;
		const key = runKey;
		if (key !== pressKey || el < lastElapsed) {
			pressKey = key;
			pressTimes = [];
			lastPresses = presses;
		}
		lastElapsed = el;
		if (presses !== lastPresses) {
			lastPresses = presses;
			if (canReverse && !reduced && el > WALL_LIFT_REV)
				pressTimes = [...pressTimes, Math.round(el * FPS) / FPS];
		}
		return pressTimes;
	});
	const reversalList = $derived.by(() => {
		const list = [...reversals];
		if (autoReverse > 0 && !list.some((r) => Math.abs(r - autoReverse) < 0.02))
			list.push(autoReverse);
		return list.sort((a, b) => a - b);
	});
	const reversalKey = $derived(reversalList.join(','));

	const baseConfig = $derived({
		n: 80,
		tLeft: temps.l,
		tRight: temps.r,
		layout: 'split' as const,
		wallUntil,
		seed: 1 + restarts
	});
	const run = $derived(
		new GasRun({
			...baseConfig,
			reversals: reversalKey ? reversalKey.split(',').map(Number) : [],
			nudge: phase === 'nudge' ? 10 ** nudgeExp : 0
		})
	);
	/** The exact reversal, for comparison in the nudge phase. */
	const exact = $derived(
		phase === 'nudge'
			? new GasRun({
					...baseConfig,
					reversals: reversalKey ? reversalKey.split(',').map(Number) : [],
					nudge: 0
				})
			: null
	);

	const fi = $derived(GasRun.index(elapsed));
	const frame = $derived(run.frame(fi));

	// ---- measured series (cached per run) ------------------------------------------
	interface Series {
		tl: number[];
		tr: number[];
		s: number[];
	}
	const cache = new WeakMap<GasRun, Series>();
	function series(r: GasRun, upto: number): Series {
		let c = cache.get(r);
		if (!c) {
			c = { tl: [], tr: [], s: [] };
			cache.set(r, c);
		}
		for (let i = c.tl.length; i <= upto; i++) {
			const st = r.statsAt(i);
			c.tl.push(temperature(st.eLeft, st.nLeft));
			c.tr.push(temperature(st.eRight, r.n - st.nLeft));
			c.s.push(r.lnWays(i));
		}
		return c;
	}
	/** Average of the last quarter second (temperatures of 40 particles jiggle a lot). */
	const SMOOTH = FPS / 4;
	function smoothed(arr: number[], i: number) {
		let sum = 0;
		let n = 0;
		for (let j = Math.max(0, i - (reduced ? 1 : SMOOTH) + 1); j <= i; j++)
			if (Number.isFinite(arr[j])) {
				sum += arr[j];
				n++;
			}
		return n ? sum / n : NaN;
	}

	const ser = $derived(series(run, fi));
	const serExact = $derived(exact ? series(exact, fi) : null);
	const tlNow = $derived(smoothed(ser.tl, fi));
	const trNow = $derived(smoothed(ser.tr, fi));
	const s0 = $derived(ser.s[0]);
	const sMax = $derived(lnWaysGasMax(run.n, run.energy) - s0);
	const sNow = $derived(ser.s[fi] - s0);

	// ---- geometry --------------------------------------------------------------------
	const BX = 40;
	const BY = 56;
	const SC = 280; // px per length unit
	const BW = W * SC;
	const BH = H * SC;
	const px = (x: number) => BX + x * SC;
	const py = (y: number) => BY + BH - y * SC;
	const rr = R * SC;

	/** Colour on the cold → hot scale for a temperature (or a particle's energy in temperature units). */
	function heat(T: number) {
		const f = clamp(Math.log(T / 0.5) / Math.log(16));
		const p = Math.round(f * 20) * 5;
		return `color-mix(in oklab, var(--ent-hot) ${p}%, var(--ent-cold))`;
	}

	const dots = $derived(
		Array.from({ length: run.n }, (_, i) => ({
			i,
			x: px(frame.x[i]),
			y: py(frame.y[i]),
			c: heat(frame.ke[i] / E0)
		}))
	);

	const wallLift = $derived(
		wallUntil === Infinity ? 0 : smoothstep(wallUntil - 0.45, wallUntil, elapsed)
	);

	// reversals so far and the direction of the film
	const passed = $derived(reversalList.filter((r) => r <= elapsed + 1e-9));
	const backward = $derived(passed.length % 2 === 1);
	const lastRev = $derived(passed.length ? passed[passed.length - 1] : -1);
	/** After a single reversal the film is back at the wall-lift moment at 2r − lift. */
	const returned = $derived(
		passed.length === 1 && lastRev > WALL_LIFT_REV && elapsed >= 2 * lastRev - WALL_LIFT_REV - 0.05
	);
	const status = $derived.by(() => {
		if (!passed.length) return '▶ forward in time';
		if (returned)
			return phase === 'nudge'
				? '◀ it never got back: the gas stayed mixed'
				: '◀ back at the start: hot left, cold right (and now it mixes again)';
		if (backward)
			return phase === 'nudge'
				? `◀ every velocity reversed, one particle ${nudgeLabel}`
				: '◀ every velocity reversed: the film runs backward';
		return '▶ reversed again: forward';
	});
	const flash = $derived(lastRev >= 0 ? 1 - smoothstep(0.2, 1.4, elapsed - lastRev) : 0);

	// ---- chart --------------------------------------------------------------------------
	const CX0 = 92;
	const CX1 = 596;
	const CY0 = 548;
	const CY1 = 402;
	const SPAN = 24;
	const tFrom = $derived(Math.max(0, elapsed - SPAN));
	const tTo = $derived(Math.max(SPAN, elapsed));
	const cx = (s: number) => CX0 + ((s - tFrom) / (tTo - tFrom)) * (CX1 - CX0);
	const tMaxAxis = $derived(Math.max(5, Math.ceil(Math.max(temps.l, temps.r) + 0.6)));
	const sMaxAxis = $derived(Math.max(5, Math.ceil((sMax * 1.15) / 5) * 5));
	const yMax = $derived(isEntropy ? sMaxAxis : tMaxAxis);
	const cy = (v: number) => CY0 - (clamp(v, 0, yMax) / yMax) * (CY0 - CY1);
	const yTicks = $derived(
		isEntropy
			? Array.from({ length: sMaxAxis / 5 + 1 }, (_, i) => i * 5)
			: Array.from({ length: tMaxAxis + 1 }, (_, i) => i).filter(
					(v) => tMaxAxis <= 6 || v % 2 === 0
				)
	);
	const xTicks = $derived.by(() => {
		const out: number[] = [];
		for (let s = Math.ceil(tFrom / 4) * 4; s <= tTo + 1e-9; s += 4) out.push(s);
		return out;
	});

	/** Polyline of a series from tFrom to now, every 3rd frame. */
	function line(arr: number[], f: (a: number[], i: number) => number) {
		const i0 = GasRun.index(tFrom);
		let d = '';
		for (let i = i0; i <= fi; i += 3) {
			const v = f(arr, i);
			if (!Number.isFinite(v)) continue;
			d += `${d ? 'L' : 'M'}${cx(i / FPS).toFixed(1)} ${cy(v).toFixed(1)}`;
		}
		const v = f(arr, fi);
		if (Number.isFinite(v)) d += `L${cx(fi / FPS).toFixed(1)} ${cy(v).toFixed(1)}`;
		return d;
	}
	const rel = (a: number[], i: number) => a[i] - s0;

	const pathL = $derived(isEntropy ? '' : line(ser.tl, smoothed));
	const pathR = $derived(isEntropy ? '' : line(ser.tr, smoothed));
	const pathS = $derived(isEntropy ? line(ser.s, rel) : '');
	const pathExact = $derived(serExact ? line(serExact.s, rel) : '');
	const tAvg = $derived((temps.l + temps.r) / 2);

	// ---- panel ----------------------------------------------------------------------------
	const PX = 648;
	const fmt1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '–');
	const thermo = $derived([
		{ id: 'l', x: 712, label: 'left half', T: tlNow },
		{ id: 'r', x: 842, label: 'right half', T: trNow }
	]);
	const TH_TOP = 92;
	const TH_BOT = 300;
	const thY = (T: number) => TH_BOT - (clamp(T, 0, 8) / 8) * (TH_BOT - TH_TOP);
	const flowing = $derived(
		phase !== 'wall' && wallLift > 0.5 && Math.abs(tlNow - trNow) > 0.35 && !isEntropy
	);
	const log10Now = $derived(toLog10(sNow));
	const ratioText = (l10: number) =>
		l10 < 1 ? `${(10 ** l10).toFixed(1)}` : formatCount({ log10: l10 });
	const nudgeLabel = $derived(`nudged by 10${sup(nudgeExp)}`);
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

<g>
	<!-- the box -->
	{@render txt(px(W / 4), BY - 12, 'left half', 12, { anchor: 'middle', muted: true })}
	{@render txt(px((3 * W) / 4), BY - 12, 'right half', 12, { anchor: 'middle', muted: true })}
	<rect
		x={BX - 3}
		y={BY - 3}
		width={BW + 6}
		height={BH + 6}
		rx="6"
		fill="var(--ent-box)"
		stroke="var(--stage-line)"
		stroke-width="1.5"
	/>
	<line
		x1={px(W / 2)}
		x2={px(W / 2)}
		y1={BY}
		y2={BY + BH}
		stroke="var(--stage-grid)"
		stroke-width="1"
		stroke-dasharray="4 5"
	/>
	{#if wallLift < 1}
		<rect
			x={px(W / 2 - WALL)}
			y={BY}
			width={2 * WALL * SC}
			height={BH * (1 - wallLift)}
			rx="2"
			fill="var(--ent-wall)"
			opacity={0.85 * (1 - wallLift * 0.5)}
		/>
	{/if}

	{#each dots as d (d.i)}
		<circle cx={d.x} cy={d.y} r={rr} style:fill={d.c} stroke="var(--stage-bg)" stroke-width="0.8" />
	{/each}

	{#if phase === 'nudge' && passed.length > 0}
		<circle
			cx={dots[0].x}
			cy={dots[0].y}
			r={rr + 5}
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			opacity={0.35 + 0.65 * flash}
		/>
	{/if}

	{#if canReverse}
		<g opacity={reduced ? 1 : 0.75 + 0.25 * flash}>
			{@render txt(px(W / 2), BY + BH + 24, status, 13, {
				anchor: 'middle',
				weight: 600,
				color: backward ? 'var(--ent-entropy)' : undefined
			})}
		</g>
	{:else if phase === 'wall'}
		{@render txt(px(W / 2), BY + BH + 24, 'the wall keeps the two halves apart', 12, {
			anchor: 'middle',
			muted: true
		})}
	{:else}
		{@render txt(
			px(W / 2),
			BY + BH + 24,
			wallLift >= 1 ? `wall lifted at ${WALL_LIFT_MIX} s` : 'the wall is about to lift',
			12,
			{ anchor: 'middle', muted: true }
		)}
	{/if}

	<!-- chart -->
	<line x1={CX0} x2={CX1} y1={CY0} y2={CY0} stroke="var(--stage-line)" stroke-width="1.2" />
	<line x1={CX0} x2={CX0} y1={CY1 - 6} y2={CY0} stroke="var(--stage-line)" stroke-width="1.2" />
	{#each yTicks as v (v)}
		<line
			x1={CX0}
			x2={CX1}
			y1={cy(v)}
			y2={cy(v)}
			stroke="var(--stage-grid)"
			stroke-width="1"
			opacity={v === 0 ? 0 : 0.8}
		/>
		{@render txt(CX0 - 8, cy(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
	{/each}
	{#each xTicks as s (s)}
		{@render txt(cx(s), CY0 + 16, `${s}`, 11, { anchor: 'middle', muted: true })}
	{/each}
	{@render txt(CX1, CY0 + 16, 's', 11, { anchor: 'start', muted: true })}
	<text x={CX0 - 34} y={CY1 - 14} class="halo muted" style:font-size="12px">
		{#if isEntropy}
			entropy above the start, ΔS ÷ k<tspan baseline-shift="sub" style:font-size="9px">B</tspan>
		{:else}
			temperature (¼-second average)
		{/if}
	</text>

	{#each passed as r (r)}
		{#if r >= tFrom}
			<line
				x1={cx(r)}
				x2={cx(r)}
				y1={CY1}
				y2={CY0}
				stroke="var(--ent-entropy)"
				stroke-width="1.2"
				stroke-dasharray="3 4"
				opacity="0.7"
			/>
		{/if}
	{/each}

	{#if isEntropy}
		<line
			x1={CX0}
			x2={CX1}
			y1={cy(sMax)}
			y2={cy(sMax)}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			stroke-dasharray="6 5"
			opacity="0.55"
		/>
		{@render txt(CX1, cy(sMax) - 6, 'highest possible', 11, { anchor: 'end', muted: true })}
		{#if pathExact}
			<path
				d={pathExact}
				fill="none"
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
		{/if}
		<path
			d={pathS}
			fill="none"
			stroke="var(--ent-entropy)"
			stroke-width="2.5"
			stroke-linejoin="round"
		/>
	{:else}
		{#if phase !== 'wall'}
			<line
				x1={CX0}
				x2={CX1}
				y1={cy(tAvg)}
				y2={cy(tAvg)}
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				stroke-dasharray="6 5"
				opacity="0.5"
			/>
			{@render txt(CX1, cy(tAvg) - 6, `average ${fmt1(tAvg)}`, 11, { anchor: 'end', muted: true })}
		{/if}
		<path d={pathL} fill="none" style:stroke={heat(temps.l)} stroke-width="2.5" />
		<path d={pathR} fill="none" style:stroke={heat(temps.r)} stroke-width="2.5" />
	{/if}

	<!-- panel: thermometers -->
	{@render txt(PX, 64, 'temperature of each half', 13, { muted: true })}
	{#each thermo as th (th.id)}
		<rect
			x={th.x - 9}
			y={TH_TOP - 6}
			width="18"
			height={TH_BOT - TH_TOP + 12}
			rx="9"
			fill="var(--surface)"
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
		<circle
			cx={th.x}
			cy={TH_BOT + 14}
			r="15"
			style:fill={heat(th.T)}
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
		<rect
			x={th.x - 5}
			y={thY(th.T)}
			width="10"
			height={TH_BOT + 6 - thY(th.T)}
			rx="4"
			style:fill={heat(th.T)}
		/>
		{@render txt(th.x, TH_BOT + 52, fmt1(th.T), 18, {
			anchor: 'middle',
			weight: 600,
			tabular: true
		})}
		{@render txt(th.x, TH_BOT + 70, th.label, 12, { anchor: 'middle', muted: true })}
	{/each}
	{#each [0, 2, 4, 6, 8] as v (v)}
		{@render txt(PX + 10, thY(v) + 4, String(v), 11, { anchor: 'end', muted: true })}
		<line
			x1={PX + 16}
			x2={PX + 24}
			y1={thY(v)}
			y2={thY(v)}
			stroke="var(--stage-line)"
			stroke-width="1"
		/>
	{/each}
	{#if flowing}
		<g opacity={smoothstep(0.35, 0.8, Math.abs(tlNow - trNow))}>
			{@render txt(777, 180, 'heat', 12, { anchor: 'middle', weight: 600 })}
			<path
				d={tlNow > trNow ? 'M752 192 L800 192' : 'M802 192 L754 192'}
				fill="none"
				stroke="var(--stage-ink)"
				stroke-width="2"
				marker-end="url(#arrowhead)"
			/>
		</g>
	{/if}

	<!-- panel: readout -->
	{#if isEntropy}
		{@render txt(PX, 424, 'microstates (arrangements) now,', 13, { muted: true })}
		{@render txt(PX, 442, 'in multiples of the start', 13, { muted: true })}
		{@render txt(PX, 480, `× ${ratioText(log10Now)}`, 28, {
			weight: 600,
			tabular: true,
			color: 'var(--ent-entropy)'
		})}
		{@render txt(PX, 504, `highest possible: × ${ratioText(toLog10(sMax))}`, 12, { muted: true })}
		{#if phase === 'nudge'}
			<line
				x1={PX}
				x2={PX + 26}
				y1={536}
				y2={536}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.5"
				stroke-dasharray="5 4"
			/>
			{@render txt(PX + 34, 540, 'exact reversal (no nudge)', 12, { muted: true })}
		{/if}
	{:else}
		{@render txt(PX, 430, 'particle colour = its kinetic energy', 12, { muted: true })}
		<defs>
			<linearGradient id="box-heat" x1="0" x2="1" y1="0" y2="0">
				<stop offset="0" style:stop-color="var(--ent-cold)" />
				<stop
					offset="0.5"
					style:stop-color="color-mix(in oklab, var(--ent-hot) 50%, var(--ent-cold))"
				/>
				<stop offset="1" style:stop-color="var(--ent-hot)" />
			</linearGradient>
		</defs>
		<rect x={PX} y={444} width="240" height="12" rx="6" fill="url(#box-heat)" />
		{@render txt(PX, 474, 'slow', 11, { muted: true })}
		{@render txt(PX + 240, 474, 'fast', 11, { anchor: 'end', muted: true })}
		{@render txt(PX, 510, 'temperature = average kinetic', 12)}
		{@render txt(PX, 527, 'energy of the particles', 12)}
	{/if}
</g>
