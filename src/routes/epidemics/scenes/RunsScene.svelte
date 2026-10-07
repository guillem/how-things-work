<script lang="ts">
	/**
	 * Chance at the start: the same crowd run 40 times from a single case.
	 *
	 * Left: every run's number of infectious people, day by day, on one shared
	 * time axis ("spaghetti"), revealed as a cursor sweeps through time.
	 * Right: one marker per run, coloured once its outcome is decided; the share
	 * that died out early against the model's 1/R₀; and each run's final size on
	 * a 0–100% strip, so the outbreaks that took off can be seen to end up alike.
	 *
	 * "Died out early" uses the same definition as the model tests: fewer than
	 * 10% of the crowd ever infected. A run's outcome is decided on the day its
	 * cumulative count of infections reaches 10% (it took off) or, failing that,
	 * on the day its last case recovers (it died out). Lines and markers stay
	 * neutral until then, so the picture does not give the outcome away.
	 *
	 * Y axis: log1p ("log scale", ticks 0, 1, 3, 10, 30, 100, 300). On a linear
	 * axis the single first case and every chain that dies out would be squashed
	 * into the bottom pixel; on this axis one case sits clearly above zero, the
	 * early ups and downs between 1 and 5 cases are readable, and early
	 * exponential growth becomes a straight line (as on the previous steps).
	 *
	 * Time: the cursor moves slowly over the first 12 days (where all the
	 * dying-out happens at the default R₀) and then speeds up smoothly, so the
	 * whole batch plays out in ~15 s and then holds. Over those first days the
	 * time axis is zoomed in on days 0–16 (where the runs first diverge), then
	 * widens with the cursor to show the whole batch. A new batch ("Run again")
	 * replays the sweep from day 0 (the `startedAt` exception, as in
	 * CrowdScene); moving R₀ does not, so dragging the slider after the sweep
	 * shows each new complete picture at once.
	 *
	 * The 40 runs are recomputed only when R₀ or the rerun count changes (a few
	 * tens of milliseconds); each run keeps only its compressed infectious
	 * series, so the crowds themselves are not held on to.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Label,
		clamp,
		hash,
		linePath,
		scale,
		smoothstep,
		thin,
		type Scale
	} from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { finalSize, fizzleChance } from '../model';
	import { POPULATION, endDay, runCrowd, settings } from '../run';

	let { step, t, params, reduced }: StageProps = $props();

	const RUNS = 40;
	/** Ever infected at or above this many people ⇒ the run "took off" (10% of the crowd). */
	const TOOK_OFF = 0.1 * POPULATION;

	const opts = $derived(settings(step, params));
	// Primitives, so that the batch below is recomputed only when they change.
	const r0 = $derived(opts.r0);
	const rerun = $derived(opts.rerun);

	interface Point {
		day: number;
		i: number;
	}
	interface Run {
		k: number;
		/** Infectious count at the days where it changes (plus the sample before each change). */
		pts: readonly Point[];
		end: number;
		/** People ever infected. */
		total: number;
		tookOff: boolean;
		/** Day the outcome is settled (see the header comment). */
		decide: number;
	}

	const runs = $derived.by((): Run[] => {
		const out: Run[] = [];
		for (let k = 0; k < RUNS; k++) {
			const crowd = runCrowd({
				r0,
				days: 7,
				vaccinated: 0,
				initial: 1,
				seed: 101 + k + RUNS * rerun
			});
			const h = crowd.history;
			const pts: Point[] = [{ day: h[0].day, i: h[0].i }];
			let decide = NaN;
			for (let n = 1; n < h.length; n++) {
				if (h[n].i !== h[n - 1].i) {
					if (pts[pts.length - 1].day !== h[n - 1].day)
						pts.push({ day: h[n - 1].day, i: h[n - 1].i });
					pts.push({ day: h[n].day, i: h[n].i });
				}
				if (isNaN(decide) && POPULATION - h[n].s >= TOOK_OFF) decide = h[n].day;
			}
			const end = endDay(crowd);
			const total = crowd.counts.r;
			out.push({
				k,
				// Every change in the first 20 days (drawn zoomed in, and where
				// outcomes are decided); only the long tail of an outbreak is thinned.
				pts: [
					...pts.filter((p) => p.day <= 20),
					...thin(
						pts.filter((p) => p.day > 20),
						200
					)
				],
				end,
				total,
				tookOff: total >= TOOK_OFF,
				decide: isNaN(decide) ? end : decide
			});
		}
		return out;
	});

	const lastEnd = $derived(Math.max(...runs.map((r) => r.end)));

	// ---- time --------------------------------------------------------------------
	// `t` when the current batch started: "Run again" replays the sweep.
	let startedAt = 0;
	let startedFor = -1;
	let lastT = 0;
	const tRun = $derived.by(() => {
		if (rerun !== startedFor || t < lastT) {
			startedAt = startedFor === -1 || t < lastT ? 0 : t;
			startedFor = rerun;
		}
		lastT = t;
		return Math.max(0, t - startedAt);
	});

	const LEAD = 0.8; // seconds before day 0 starts moving, while the scene fades in
	const SLOW_DAYS = 12;
	const SLOW_FOR = 6; // seconds for the first SLOW_DAYS
	const FAST_FOR = 9; // seconds for the rest
	const day = $derived.by(() => {
		// The cursor stops 1.5 days after the last run ends, so the last outcome has faded in.
		const stop = lastEnd + 1.5;
		if (reduced) return stop;
		const s = Math.max(0, tRun - LEAD);
		const v = SLOW_DAYS / SLOW_FOR; // days per second at the end of the slow part
		if (s < SLOW_FOR) return Math.min(stop, s * v);
		// Then accelerate smoothly (constant acceleration from the same speed).
		const u = s - SLOW_FOR;
		const a = Math.max(0, (lastEnd - SLOW_DAYS - v * FAST_FOR) / (FAST_FOR * FAST_FOR));
		return Math.min(stop, SLOW_DAYS + v * u + a * u * u);
	});
	const done = $derived(day >= lastEnd);

	// ---- the spaghetti chart -----------------------------------------------------
	const PX0 = 72;
	const PX1 = 560;
	const TOP = 112;
	const BOTTOM = 470;
	const xMaxTarget = $derived(Math.max(40, Math.ceil((lastEnd * 1.02) / 20) * 20));
	const xMax = Tween.of(() => xMaxTarget, { duration: 700, easing: cubicInOut });
	// Initial zoom: the first 16 days fill the chart while the cursor crawls
	// through them; once it passes day 12 the axis widens with it (the cursor
	// stays at 3/4 of the width) until the whole batch fits.
	const ZOOM_DAYS = 16;
	const xView = $derived(
		Math.min(xMax.current, Math.max(ZOOM_DAYS, day / (SLOW_DAYS / ZOOM_DAYS)))
	);
	const sx = $derived(scale([0, xView], [PX0, PX1]));

	/** log(1 + v) scale from 0–POPULATION onto [BOTTOM, TOP]. */
	function logScale(max: number, range: [number, number]): Scale {
		const [b, top] = range;
		const L = Math.log1p(max);
		const f = ((v: number) => b + ((top - b) * Math.log1p(Math.max(0, v))) / L) as Scale;
		f.domain = [0, max];
		f.range = range;
		f.invert = (px: number) => Math.expm1(((px - b) / (top - b)) * L);
		return f;
	}
	const sy = logScale(POPULATION, [BOTTOM, TOP]);
	const Y_TICKS = [0, 1, 3, 10, 30, 100, 300];

	/** 0 → undecided, 1 → outcome shown (a short cross-fade after the decision). */
	const settle = (r: Run) => smoothstep(r.decide, r.decide + 1.5, day);

	const lines = $derived(
		runs.map((r) => {
			let n = 0;
			while (n < r.pts.length && r.pts[n].day <= day) n++;
			const shown = r.pts.slice(0, Math.max(1, n));
			const last = shown[shown.length - 1];
			const pts = day < r.end && day > last.day ? [...shown, { day, i: last.i }] : shown;
			const m = settle(r);
			const target = r.tookOff ? 'var(--sir-i)' : 'var(--stage-ink-muted)';
			return {
				k: r.k,
				d: linePath(
					pts,
					(p) => p.day,
					(p) => p.i,
					sx,
					sy
				),
				stroke: `color-mix(in srgb, ${target} ${Math.round(100 * m)}%, var(--stage-ink-muted))`,
				// Undecided lines are a stronger grey; those that die out fade back.
				opacity: r.tookOff ? 0.8 - 0.3 * m : 0.8 - 0.4 * m,
				width: r.tookOff ? 1.4 + 0.3 * m : 1.4
			};
		})
	);

	// ---- tally -------------------------------------------------------------------
	const RX0 = 616;
	const RX1 = 916;
	const GX = (k: number) => RX0 + 12 + (k % 8) * 36;
	const GY = (k: number) => 98 + Math.floor(k / 8) * 30;

	const decided = $derived(runs.filter((r) => day >= r.decide));
	const died = $derived(decided.filter((r) => !r.tookOff).length);
	const tookOff = $derived(decided.length - died);
	const pending = $derived(RUNS - decided.length);
	const diedShare = $derived(died / RUNS);
	const predicted = $derived(fizzleChance(r0));
	const fmtR0 = $derived(r0.toFixed(1).replace(/\.0$/, ''));

	const diedText = $derived(
		pending > 0
			? `${died} so far, ${pending} still undecided`
			: died === RUNS
				? `all ${RUNS} (100%)`
				: `${died} of ${RUNS} (${Math.round(100 * diedShare)}%)`
	);
	const modelText = $derived(
		r0 <= 1
			? 'Model (the tick): with R₀ ≤ 1, every run dies out'
			: `Model (the tick): about 1 in R₀ = 1 in ${fmtR0} = ${Math.round(100 * predicted)}%`
	);
	const upLabel = $derived(r0 <= 1 ? 'reached 10%' : 'took off');
	const legend2 = $derived(r0 <= 1 ? 140 : 113); // x offset of the second legend item
	const bar = $derived(scale([0, 1], [RX0, RX1]));

	// ---- final sizes -------------------------------------------------------------
	const SY0 = 452; // strip axis
	const ended = $derived(runs.filter((r) => day >= r.end));
	const grown = $derived(ended.filter((r) => r.tookOff).map((r) => r.total / POPULATION));
	const sir = $derived(finalSize(r0));
	const pct = (v: number) => `${Math.round(100 * v)}%`;
	const sizeText = $derived.by(() => {
		const all = runs.filter((r) => r.tookOff).length;
		if (all === 0) return done ? 'None took off' : '';
		// At R₀ ≤ 1 no chain can grow, but near 1 one can smoulder past 10% of a
		// crowd this small before it dies out: say so rather than "took off".
		if (r0 <= 1 && grown.length > 0) {
			const lo = Math.min(...grown);
			const hi = Math.max(...grown);
			return `Smouldered past 10%, then died out: ${pct(lo) === pct(hi) ? pct(lo) : `${pct(lo)}–${pct(hi)}`}`;
		}
		if (grown.length === 0) return '';
		const lo = Math.min(...grown);
		const hi = Math.max(...grown);
		if (all === 1 && grown.length === 1) return `The one that took off: ${pct(lo)} infected`;
		return `${done ? 'Runs that took off' : 'Took off, so far'}: ${pct(lo) === pct(hi) ? pct(lo) : `${pct(lo)}–${pct(hi)}`} infected`;
	});

	const fade = $derived(smoothstep(0, 0.6, Math.max(0, tRun - 0.1)));
	const cursorX = $derived(sx(Math.min(day, xView)));
</script>

<g opacity={reduced ? 1 : fade}>
	<!-- left: every run's infectious count -->
	<Label
		x={PX0 - 40}
		y={52}
		text="One crowd, 40 runs, one first case each"
		size={15}
		weight={600}
		anchor="start"
	/>
	<text x={PX0 - 40} y={72} font-size="11" class="muted"
		>Each line is one run: how many people are infectious, day by day (R₀ = {fmtR0})</text
	>

	<Axes {sx} {sy} xLabel="day" yLabel="infectious people (log scale)" yTicks={Y_TICKS} />

	<g fill="none" stroke-linejoin="round" stroke-linecap="round">
		{#each lines as l (l.k)}
			<path d={l.d} style:stroke={l.stroke} stroke-width={l.width} stroke-opacity={l.opacity} />
		{/each}
	</g>

	<line
		x1={cursorX}
		x2={cursorX}
		y1={TOP}
		y2={BOTTOM + 22}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
		opacity={done ? 0 : 0.7}
	/>
	{#if !done}
		<Label
			x={clamp(cursorX, PX0 + 24, PX1 - 56)}
			y={BOTTOM + 36}
			text="day {Math.floor(day)}"
			size={12}
		/>
	{/if}

	<!-- line legend -->
	<g font-size="11">
		{#each [{ id: 'up', label: upLabel, color: 'var(--sir-i)', o: 0.8 }, { id: 'down', label: 'died out early', color: 'var(--stage-ink-muted)', o: 0.4 }, { id: 'open', label: 'not yet decided', color: 'var(--stage-ink-muted)', o: 0.9 }] as item, i (item.id)}
			{@const lx = PX0 + i * 130}
			<line
				x1={lx}
				x2={lx + 18}
				y1={546}
				y2={546}
				stroke={item.color}
				stroke-opacity={item.id === 'open' && pending === 0 ? 0.3 : item.o}
				stroke-width={item.id === 'up' ? 2.2 : 1.6}
			/>
			<!-- once every run is decided, "not yet decided" describes nothing on the chart -->
			<text
				x={lx + 24}
				y={550}
				class="muted"
				opacity={item.id === 'open' && pending === 0 ? 0.4 : 1}>{item.label}</text
			>
		{/each}
	</g>
	<text x={PX0} y={572} font-size="11" class="muted"
		>Died out early: fewer than {TOOK_OFF} of the {POPULATION} people (10%) ever infected.</text
	>

	<!-- right: one marker per run -->
	<Label x={RX0} y={52} text="How each run turned out" size={15} weight={600} anchor="start" />
	{#each runs as r (r.k)}
		{@const m = settle(r)}
		{#if m <= 0}
			<circle
				cx={GX(r.k)}
				cy={GY(r.k)}
				r="8"
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
		{:else}
			<circle
				cx={GX(r.k)}
				cy={GY(r.k)}
				r={6 + 3 * m}
				fill={r.tookOff ? 'var(--sir-i)' : 'var(--stage-ink-muted)'}
				fill-opacity={r.tookOff ? 0.9 : 0.55}
			/>
		{/if}
	{/each}
	<g font-size="11">
		<circle cx={RX0 + 5} cy={234} r="5" fill="var(--sir-i)" fill-opacity="0.9" />
		<text x={RX0 + 15} y={238} class="muted" style:font-variant-numeric="tabular-nums"
			>{upLabel} ({tookOff})</text
		>
		<circle cx={RX0 + legend2} cy={234} r="5" fill="var(--stage-ink-muted)" fill-opacity="0.55" />
		<text x={RX0 + legend2 + 10} y={238} class="muted" style:font-variant-numeric="tabular-nums"
			>died out early ({died})</text
		>
	</g>

	<!-- died out early: measured vs 1/R0 -->
	<g style:font-variant-numeric="tabular-nums">
		<text x={RX0} y={292} font-size="13" font-weight="600">Died out early</text>
		<text x={RX1} y={292} font-size="13" font-weight="600" text-anchor="end">{diedText}</text>
		<rect x={RX0} y={304} width={RX1 - RX0} height="10" rx="5" fill="var(--stage-grid)" />
		<rect
			x={RX0}
			y={304}
			width={Math.max(0, bar(diedShare) - RX0)}
			height="10"
			rx="5"
			fill="var(--stage-ink-muted)"
			fill-opacity="0.7"
		/>
		<line
			x1={bar(predicted)}
			x2={bar(predicted)}
			y1={298}
			y2={320}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<text x={RX0} y={340} font-size="12">{modelText}</text>
	</g>

	<!-- final sizes -->
	<!-- y 390, not lower: the ▼ for the SIR value sits at y ≈ 410–419 and, at R₀ ≈ 1.1–1.3, under the title -->
	<text x={RX0} y={390} font-size="13" font-weight="600">How many each run infected</text>
	<g>
		<line x1={RX0} x2={RX1} y1={SY0} y2={SY0} stroke="var(--stage-line)" />
		{#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
			<line x1={bar(v)} x2={bar(v)} y1={SY0} y2={SY0 + 4} stroke="var(--stage-line)" />
		{/each}
		<text x={RX0} y={SY0 + 17} font-size="11" class="muted">0%</text>
		<text x={bar(0.5)} y={SY0 + 17} font-size="11" class="muted" text-anchor="middle">50%</text>
		<text x={RX1} y={SY0 + 17} font-size="11" class="muted" text-anchor="end"
			>100% of the crowd</text
		>
		{#if sir > 0}
			<path
				d="M{bar(sir)} {SY0 - 3} l-5 -9 h10 z"
				fill="var(--stage-ink)"
				transform="translate(0 -30)"
			/>
		{/if}
		{#each ended as r (r.k)}
			<circle
				cx={bar(r.total / POPULATION)}
				cy={SY0 - 9 - 14 * hash(r.k, 3)}
				r="3.5"
				fill={r.tookOff ? 'var(--sir-i)' : 'var(--stage-ink-muted)'}
				fill-opacity={r.tookOff ? 0.6 : 0.5}
			/>
		{/each}
	</g>
	<text x={RX0} y={502} font-size="12">{sizeText}</text>
	{#if sir > 0}
		<text x={RX0} y={520} font-size="11" class="muted"
			>▼ the SIR equations: {pct(sir)} for R₀ = {fmtR0}</text
		>
	{/if}
</g>
