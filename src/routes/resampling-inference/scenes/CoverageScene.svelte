<script lang="ts">
	/**
	 * The coverage experiment: a simulated population of 5,000 values (top histogram) with its
	 * true mean or maximum marked, and below it one line per repeat: the 95% percentile interval
	 * from one sample of n, drawn in the hit colour if it contains the truth and the miss colour
	 * if not. The panel counts the hits over all the repeats so far, with the counter's own exact
	 * (Clopper–Pearson) 95% range, against the 95% the interval claims.
	 *
	 * Phases (`step.hints.phase`) only pick the controls: `coverage` reads n, skew and stat; the
	 * other steps read `n:<phase>`, `skew:<phase>` and `stat:<phase>`, which start elsewhere.
	 *
	 * The run: `coverageRun(population(skew).values, n, stat, REPEATS, RESAMPLES, seed)`, all
	 * computed at once (≤ ~40 million draws); repeat k shows once k / RATE seconds have passed,
	 * in row k mod ROWS (the newest marked). The run restarts when a control or the rerun count
	 * changes. Reduced motion: every repeat shown.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { POP_SIZE, coverageRun, population, proportionInterval, quantile } from '../resample';
	import { fmt } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const REPEATS = 300;
	const RESAMPLES = 500;
	const RATE = 20;
	const ROWS = 100;

	const phase = $derived(String(step.hints?.phase ?? 'coverage'));
	const key = (base: string) => (phase === 'coverage' ? base : `${base}:${phase}`);
	const n = $derived(clamp(Math.round(Number(params[key('n')] ?? 50)), 5, 200));
	const skew = $derived(clamp(Number(params[key('skew')] ?? 0), 0, 1));
	const stat = $derived(params[key('stat')] === 'max' ? 'max' : 'mean');
	const seed = $derived(1 + Number(params.rerun ?? 0));

	const pop = $derived(population(skew));
	const run = $derived(coverageRun(pop.values, n, stat, REPEATS, RESAMPLES, seed));
	const runKey = $derived(`${n}|${skew}|${stat}|${seed}`);

	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (runKey !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = runKey;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});
	const taken = $derived(Math.min(REPEATS, Math.max(1, Math.floor(elapsed * RATE) + 1)));
	const tally = $derived.by(() => {
		let hit = 0;
		let low = 0;
		let high = 0;
		for (let k = 0; k < taken; k++) {
			if (run.caught[k]) hit++;
			else if (run.hi[k] < run.truth) low++;
			else high++;
		}
		const c = hit / taken;
		const [cLo, cHi] = proportionInterval(hit, taken);
		return { hit, low, high, c, cLo, cHi };
	});
	/** Even the top of the counter's own 95% range is below the claimed 95%. */
	const short = $derived(tally.cHi < 0.95);

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 72;
	const X1 = 600;
	const P_TOP = 44;
	const P_BOT = 124;
	const I_TOP = 196;
	const GAP = 3.3;
	const lo = Tween.of(() => Math.floor((pop.min - 2) / 10) * 10, {
		duration: 600,
		easing: cubicInOut
	});
	const hi = Tween.of(() => Math.ceil((pop.max + 2) / 10) * 10, {
		duration: 600,
		easing: cubicInOut
	});
	const sx = $derived(scale([lo.current, hi.current], [X0, X1]));

	const PBINS = 64;
	const popBins = $derived.by(() => {
		const a = Math.floor((pop.min - 2) / 10) * 10;
		const b = Math.ceil((pop.max + 2) / 10) * 10;
		const w = (b - a) / PBINS;
		const c = new Int32Array(PBINS);
		for (const v of pop.values) c[clamp(Math.floor((v - a) / w), 0, PBINS - 1)]++;
		const m = Math.max(...c);
		return Array.from(c, (k, i) => ({ i, x0: a + i * w, x1: a + (i + 1) * w, h: k / m }));
	});

	// The intervals get a magnified axis of their own (a zoom on the population's axis, drawn as
	// a funnel): from the 1st percentile of the lower ends to the 99th of the upper ends, truth
	// included, padded by 10%.
	const zoom = $derived.by(() => {
		const l = Float64Array.from(run.lo).sort();
		const h = Float64Array.from(run.hi).sort();
		const a = Math.min(run.truth, quantile(l, 0.01));
		const b = Math.max(run.truth, quantile(h, 0.99));
		const pad = 0.1 * Math.max(b - a, 0.5);
		return [a - pad, b + pad] as const;
	});
	const zlo = Tween.of(() => zoom[0], { duration: 600, easing: cubicInOut });
	const zhi = Tween.of(() => zoom[1], { duration: 600, easing: cubicInOut });
	const zx = $derived(scale([zlo.current, zhi.current], [X0, X1]));
	const FUNNEL = I_TOP - 10;
	const I_BOT = I_TOP + ROWS * GAP;

	const rows = $derived.by(() => {
		const out: { k: number; y: number; lo: number; hi: number; hit: boolean }[] = [];
		for (let k = Math.max(0, taken - ROWS); k < taken; k++)
			out.push({
				k,
				y: I_TOP + (k % ROWS) * GAP,
				lo: run.lo[k],
				hi: run.hi[k],
				hit: run.caught[k] === 1
			});
		return out;
	});
	const newest = $derived(rows[rows.length - 1]);

	const PL = 636;
	const PW = 296;
	const meter = scale([0.5, 1], [PL, PL + PW]);
	const pct = (v: number) => `${(100 * v).toFixed(1)}%`;
	/** The counter's own exact 95% range, in percent. */
	const range = $derived(`${(100 * tally.cLo).toFixed(1)}–${(100 * tally.cHi).toFixed(1)}%`);
	const truthName = $derived(stat === 'mean' ? 'true mean' : 'true maximum');
</script>

<g>
	<!-- the population -->
	<Axes {sx} sy={scale([0, 1], [P_BOT, P_TOP])} yTicks={[]} xLabel="value" grid={false} />
	{#each popBins as b (b.i)}
		{#if b.h > 0}
			<rect
				x={sx(b.x0) + 0.4}
				y={P_BOT - b.h * (P_BOT - P_TOP)}
				width={Math.max(0.8, sx(b.x1) - sx(b.x0) - 0.8)}
				height={b.h * (P_BOT - P_TOP)}
				fill="var(--ri-pop)"
				opacity="0.8"
			/>
		{/if}
	{/each}
	<Readout id="pop-label">
		<Label
			x={X0}
			y={P_TOP - 18}
			anchor="start"
			size={12}
			muted
			text="the population: {fmt(POP_SIZE)} simulated values{skew === 0
				? ', normal'
				: `, skewness ${pop.skewness.toFixed(1)}`}"
		/>
	</Readout>

	<!-- the zoom from the population's axis to the intervals' -->
	<path
		d="M{sx(zlo.current)} {P_BOT} L{sx(zhi.current)} {P_BOT} L{X1} {FUNNEL} L{X0} {FUNNEL} Z"
		fill="var(--stage-grid)"
		opacity="0.45"
	/>
	<rect
		x={X0}
		y={FUNNEL}
		width={X1 - X0}
		height={I_BOT - FUNNEL + 6}
		fill="var(--stage-grid)"
		opacity="0.2"
	/>
	<Readout id="zoom-ends">
		<Label
			x={X0 + 4}
			y={FUNNEL + 14}
			anchor="start"
			size={11}
			muted
			text={zlo.current.toFixed(1)}
		/>
		<Label x={X1 - 4} y={FUNNEL + 14} anchor="end" size={11} muted text={zhi.current.toFixed(1)} />
	</Readout>

	<!-- the intervals -->
	<defs>
		<clipPath id="coverage-clip">
			<rect x={X0} y={FUNNEL} width={X1 - X0} height={I_BOT - FUNNEL + 6} />
		</clipPath>
	</defs>
	<g clip-path="url(#coverage-clip)">
		{#each rows as r (r.k)}
			<line
				x1={zx(r.lo)}
				x2={Math.max(zx(r.hi), zx(r.lo) + 1.5)}
				y1={r.y}
				y2={r.y}
				stroke={r.hit ? 'var(--ri-hit)' : 'var(--ri-miss)'}
				stroke-width={r.k === newest?.k ? 3 : 2}
				opacity={r.hit ? 0.75 : 1}
			/>
		{/each}
	</g>
	{#if newest && !reduced}
		<path
			d="M{X0 - 14} {newest.y - 4} L{X0 - 6} {newest.y} L{X0 - 14} {newest.y + 4} Z"
			fill="var(--stage-ink)"
		/>
	{/if}

	<!-- the truth, on both axes -->
	<line
		x1={sx(run.truth)}
		x2={sx(run.truth)}
		y1={P_TOP - 6}
		y2={P_BOT}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<line
		x1={sx(run.truth)}
		x2={zx(run.truth)}
		y1={P_BOT}
		y2={FUNNEL}
		stroke="var(--stage-ink)"
		stroke-width="1.2"
		stroke-dasharray="3 3"
	/>
	<line
		x1={zx(run.truth)}
		x2={zx(run.truth)}
		y1={FUNNEL}
		y2={I_BOT + 4}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<Label
		x={zx(run.truth)}
		y={I_BOT + 22}
		size={13}
		weight={700}
		anchor={zx(run.truth) > X1 - 70 ? 'end' : zx(run.truth) < X0 + 70 ? 'start' : 'middle'}
		text="{truthName} {run.truth.toFixed(1)}"
	/>

	<!-- panel -->
	<Readout id="setup" order={1} label="Each repeat" value="n = {n}, {RESAMPLES} resamples">
		<Label x={PL} y={52} anchor="start" muted text="each repeat: a sample of n = {n}," />
		<Label x={PL} y={70} anchor="start" muted text="{RESAMPLES} resamples, percentile interval" />
		<Label
			x={PL}
			y={88}
			anchor="start"
			muted
			text="for the population’s {stat === 'mean' ? 'mean' : 'maximum'}"
		/>
	</Readout>
	<Readout id="caught" order={2} label="Caught the truth" value="{fmt(tally.hit)} of {fmt(taken)}">
		<Label x={PL} y={140} anchor="start" muted text="caught the truth" />
		<Label
			x={PL}
			y={168}
			anchor="start"
			size={22}
			weight={600}
			tabular
			text="{fmt(tally.hit)} of {fmt(taken)}"
		/>
	</Readout>
	<Readout
		id="coverage"
		order={3}
		label="Real coverage"
		value={pct(tally.c)}
		note="claimed 95% · likely range {range}"
		color={short ? 'var(--ri-miss)' : 'var(--ri-hit)'}
	>
		<Label x={PL} y={222} anchor="start" muted text="real coverage" />
		<Label
			x={PL}
			y={258}
			anchor="start"
			size={34}
			weight={700}
			tabular
			color={short ? 'var(--ri-miss)' : 'var(--ri-hit)'}
			text={pct(tally.c)}
		/>
		<Label x={PL + 150} y={256} anchor="start" size={13} muted tabular text="likely {range}" />
	</Readout>

	<!-- the meter: 50% to 100%, the claimed 95% and the measured coverage with its margin -->
	<g>
		<rect x={PL} y={282} width={PW} height={14} rx="7" fill="var(--stage-grid)" />
		<rect
			x={PL}
			y={282}
			width={Math.max(0, meter(Math.max(0.5, tally.c)) - PL)}
			height={14}
			rx="7"
			fill={short ? 'var(--ri-miss)' : 'var(--ri-hit)'}
			opacity="0.85"
		/>
		<line
			x1={meter(clamp(tally.cLo, 0.5, 1))}
			x2={meter(clamp(tally.cHi, 0.5, 1))}
			y1={304}
			y2={304}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<line
			x1={meter(0.95)}
			x2={meter(0.95)}
			y1={274}
			y2={312}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Readout id="meter-ticks">
			<Label x={meter(0.95)} y={328} size={11} weight={600} text="claimed 95%" />
			{#if tally.c >= 0.5}
				<Label x={PL} y={328} anchor="start" size={11} muted text="50%" />
			{/if}
		</Readout>
		{#if tally.c < 0.5}
			<Readout id="off-scale">
				<Label
					x={PL + 4}
					y={318}
					anchor="start"
					size={11}
					color="var(--ri-miss)"
					text="◀ off the scale"
				/>
			</Readout>
		{/if}
	</g>

	<Readout
		id="verdict"
		order={4}
		label="Verdict"
		value={short ? 'short of 95%' : 'within chance of 95%'}
		note="misses: {tally.low} too low, {tally.high} too high"
	>
		<Label
			x={PL}
			y={372}
			anchor="start"
			size={13}
			weight={600}
			color={short ? 'var(--ri-miss)' : undefined}
			text={short ? 'short of 95% by more than chance' : 'within chance of 95%'}
		/>
		<Label
			x={PL}
			y={396}
			anchor="start"
			size={12}
			muted
			tabular
			text="misses: {tally.low} too low, {tally.high} too high"
		/>
	</Readout>
	{#if stat === 'max'}
		<Readout id="why-max">
			<Label x={PL} y={440} anchor="start" size={12} text="no resample holds a value above" />
			<Label x={PL} y={458} anchor="start" size={12} text="its sample’s largest, so the interval" />
			<Label x={PL} y={476} anchor="start" size={12} text="stops at or below it" />
		</Readout>
	{/if}

	<Readout id="rows-label">
		<Label
			x={PL}
			y={504}
			anchor="start"
			size={12}
			muted
			text="each line: one sample’s 95% interval"
		/>
		<Label
			x={PL}
			y={521}
			anchor="start"
			size={12}
			muted
			text="(newest {Math.min(ROWS, taken)} of {REPEATS}), on a magnified axis"
		/>
	</Readout>
	<Readout id="key">
		<line x1={PL} x2={PL + 24} y1={548} y2={548} stroke="var(--ri-hit)" stroke-width="3" />
		<Label x={PL + 32} y={552} anchor="start" size={12} text="caught" />
		<line x1={PL + 100} x2={PL + 124} y1={548} y2={548} stroke="var(--ri-miss)" stroke-width="3" />
		<Label x={PL + 132} y={552} anchor="start" size={12} text="missed" />
	</Readout>
</g>
