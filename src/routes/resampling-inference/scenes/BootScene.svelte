<script lang="ts">
	/**
	 * The bootstrap of a difference of averages: the two groups of penguins as hollow dots, one
	 * resample of each drawn over them (a dot drawn c times is filled and stacked c deep; a dot
	 * left out stays hollow), the resample's averages and their difference, and below the
	 * histogram of RESAMPLES bootstrap differences with its 95% percentile interval.
	 *
	 * The run: `bootstrapDiffs(a, b, RESAMPLES, seed)`; resample k of the groups is
	 * `resampleCounts(nA, seed, 2k)` and `resampleCounts(nB, seed, 2k + 1)`, the very draws
	 * counted. Resample k counts once k / RATE seconds have passed; every PERIOD seconds the
	 * newest one is drawn over the dots and its difference drops into the histogram. The run
	 * restarts when the comparison, the group size or the redraw count change.
	 * Reduced motion: every resample counted; resample 0 drawn.
	 */
	import { Axes, Label, clamp, hash, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bootstrapDiffs, meanOf, percentileInterval, resampleCounts, sdOf } from '../resample';
	import { chosenGroups, fmt, signed } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const RESAMPLES = 2000;
	const RATE = 160;
	const PERIOD = 2.6;
	const BINS = 44;

	const g = $derived(chosenGroups(params));
	const nA = $derived(g.a.length);
	const nB = $derived(g.b.length);
	const meanA = $derived(meanOf(g.a));
	const meanB = $derived(meanOf(g.b));
	const obs = $derived(meanB - meanA);
	const diffs = $derived(bootstrapDiffs(g.a, g.b, RESAMPLES, g.seed));
	const formulaSe = $derived(Math.sqrt(sdOf(g.a) ** 2 / nA + sdOf(g.b) ** 2 / nB));

	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (g.key !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = g.key;
		}
		if (t < t0) t0 = 0;
		return Math.max(0, t - t0);
	});
	const taken = $derived(Math.min(RESAMPLES, Math.max(1, Math.floor(elapsed * RATE))));
	const sofar = $derived(diffs.subarray(0, taken));
	const bootSe = $derived(taken > 2 ? sdOf(sofar) : NaN);
	const ci = $derived(taken >= 40 ? percentileInterval(sofar) : null);

	// ---- geometry ---------------------------------------------------------------------------------
	const X0 = 72;
	const X1 = 600;
	const ROW_A = 92;
	const ROW_B = 196;
	const JIT = 22;
	const sx = $derived(scale(g.range, [X0, X1]));
	const r = $derived(nA + nB > 60 ? 3 : 5);
	const flipperTicks = $derived(
		Array.from({ length: (g.range[1] - g.range[0]) / 5 + 1 }, (_, i) => g.range[0] + 5 * i)
	);
	const ARROW_Y = (ROW_A + ROW_B) / 2;

	const H_TOP = 330;
	const H_BOT = 520;
	const D = $derived.by(() => {
		// wide enough for 99% of all the resamples (the rare ones beyond are left out)
		const [q0, q1] = percentileInterval(diffs, 0.99);
		const need = Math.max(4.4 * formulaSe, 1.05 * (obs - q0), 1.05 * (q1 - obs), 1);
		const s = need > 12 ? 5 : need > 4 ? 2 : 1;
		return Math.ceil(need / s) * s;
	});
	const hx = $derived(scale([obs - D, obs + D], [X0, X1]));
	const binW = $derived((2 * D) / BINS);
	/** The bin of a difference, or −1 beyond the histogram. */
	const binOf = (d: number) => {
		const b = Math.floor((d - obs + D) / binW);
		return b >= 0 && b < BINS ? b : -1;
	};
	const bins = $derived.by(() => {
		const all = new Int32Array(BINS);
		for (const d of diffs) if (binOf(d) >= 0) all[binOf(d)]++;
		const now = new Int32Array(BINS);
		for (let k = 0; k < taken; k++) if (binOf(diffs[k]) >= 0) now[binOf(diffs[k])]++;
		return { all, now };
	});
	const unit = $derived(((H_BOT - H_TOP) * 0.85) / Math.max(1, ...bins.all));
	const BIN_IDS = Array.from({ length: BINS }, (_, i) => i);

	// ---- the showcased resample ---------------------------------------------------------------------
	const show = $derived.by(() => {
		const cyc = reduced ? 0 : Math.floor(elapsed / PERIOD);
		const u = reduced ? 1.3 : elapsed - cyc * PERIOD;
		const k = reduced ? 0 : Math.min(taken - 1, Math.floor(cyc * PERIOD * RATE));
		const ca = resampleCounts(nA, g.seed, 2 * k);
		const cb = resampleCounts(nB, g.seed, 2 * k + 1);
		const fill = reduced ? 1 : smoothstep(0.15, 0.7, u) * (1 - smoothstep(2.25, 2.6, u));
		const drop = reduced ? 0 : clamp((u - 1.3) / 0.5);
		return { k, ca, cb, fill, drop, d: diffs[k] };
	});
	const resampleMeans = $derived({
		a: g.a.reduce((s, v, i) => s + v * show.ca[i], 0) / nA,
		b: g.b.reduce((s, v, i) => s + v * show.cb[i], 0) / nB
	});
	const leftOut = $derived(
		show.ca.reduce((s, c) => s + (c === 0 ? 1 : 0), 0) +
			show.cb.reduce((s, c) => s + (c === 0 ? 1 : 0), 0)
	);
	const base = $derived(
		[...g.a.map((v, i) => ({ v, i, b: false })), ...g.b.map((v, i) => ({ v, i, b: true }))].map(
			(d, j) => ({
				j,
				x: sx(d.v),
				y: (d.b ? ROW_B : ROW_A) + (hash(j, 5.3) - 0.5) * 2 * JIT,
				b: d.b,
				c: d.b ? show.cb[d.i] : show.ca[d.i]
			})
		)
	);
	/** Extra copies of dots drawn more than once, stacked upwards. */
	const extra = $derived(
		base.flatMap((d) =>
			Array.from({ length: Math.max(0, d.c - 1) }, (_, m) => ({
				id: `${d.j}-${m}`,
				x: d.x,
				y: d.y - (m + 1) * r * 1.3,
				b: d.b
			}))
		)
	);
	const ax = $derived(sx(lerp(meanA, resampleMeans.a, show.fill)));
	const bx = $derived(sx(lerp(meanB, resampleMeans.b, show.fill)));
	const dropY = $derived(
		lerp(ARROW_Y, H_BOT - (bins.now[binOf(show.d)] ?? 0) * unit - 6, show.drop * show.drop)
	);

	const PL = 636;
	const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '…');
	const f2 = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '…');
</script>

<g>
	{#each [ROW_A, ROW_B] as y (y)}
		<rect
			x={X0 - 8}
			y={y - JIT - 12}
			width={X1 - X0 + 16}
			height={2 * JIT + 20}
			rx="8"
			fill="var(--surface)"
			stroke="var(--border)"
			opacity="0.7"
		/>
	{/each}

	{#each flipperTicks as v (v)}
		<line
			x1={sx(v)}
			x2={sx(v)}
			y1={ROW_A - JIT - 12}
			y2={ROW_B + JIT + 12}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="tick-{v}">
			<Label x={sx(v)} y={ROW_B + JIT + 24} size={11} muted halo={false} text={String(v)} />
		</Readout>
	{/each}

	<!-- the sample: hollow; the resample: filled, stacked by how often each was drawn -->
	{#each base as d (d.j)}
		<circle
			cx={d.x}
			cy={d.y}
			{r}
			fill={d.b ? 'var(--ri-b)' : 'var(--ri-a)'}
			fill-opacity={d.c > 0 ? 0.85 * show.fill : 0}
			stroke={d.b ? 'var(--ri-b)' : 'var(--ri-a)'}
			stroke-width="1.2"
			stroke-opacity={d.c > 0 ? 0.8 : 0.8 - 0.45 * show.fill}
		/>
	{/each}
	{#each extra as e (e.id)}
		<circle
			cx={e.x}
			cy={e.y}
			{r}
			fill={e.b ? 'var(--ri-b)' : 'var(--ri-a)'}
			stroke="var(--stage-bg)"
			stroke-width="0.8"
			opacity={show.fill}
		/>
	{/each}

	<!-- averages: the sample's (thin) and the resample's (thick) -->
	{#each [{ id: 'a', y: ROW_A, m: meanA, x: ax }, { id: 'b', y: ROW_B, m: meanB, x: bx }] as row (row.id)}
		<line
			x1={sx(row.m)}
			x2={sx(row.m)}
			y1={row.y - JIT - 8}
			y2={row.y + JIT + 4}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			stroke-dasharray="4 3"
			opacity="0.6"
		/>
		<line
			x1={row.x}
			x2={row.x}
			y1={row.y - JIT - 8}
			y2={row.y + JIT + 4}
			stroke={row.id === 'a' ? 'var(--ri-a)' : 'var(--ri-b)'}
			stroke-width="3"
			opacity={0.3 + 0.7 * show.fill}
		/>
	{/each}
	<Readout id="row-a">
		<Label
			x={X0 - 8}
			y={ROW_A - JIT - 20}
			anchor="start"
			weight={600}
			color="var(--ri-a)"
			text="{g.cmp.a.name}: {nA} drawn from {nA}, with replacement"
		/>
	</Readout>
	<Readout id="row-b">
		<Label
			x={X0 - 8}
			y={ROW_B + JIT + 46}
			anchor="start"
			weight={600}
			color="var(--ri-b)"
			text="{g.cmp.b.name}: {nB} drawn from {nB}, with replacement"
		/>
	</Readout>
	<Readout id="left-out">
		<Label
			x={X1 + 8}
			y={ROW_B + JIT + 46}
			anchor="end"
			size={11}
			muted
			text="hollow: left out ({leftOut} of {nA + nB})"
		/>
	</Readout>

	<line
		x1={ax}
		x2={bx - (bx >= ax ? 4 : -4)}
		y1={ARROW_Y}
		y2={ARROW_Y}
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-end={Math.abs(bx - ax) > 10 ? 'url(#arrowhead)' : undefined}
	/>
	<Label
		x={(ax + bx) / 2}
		y={ARROW_Y - 8}
		weight={700}
		tabular
		text="{signed(lerp(obs, show.d, show.fill))} mm"
	/>
	{#if show.drop > 0 && show.drop < 1 && show.fill > 0.5}
		<circle
			cx={hx(show.d)}
			cy={dropY}
			r="5"
			fill="var(--ri-boot)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- the bootstrap distribution -->
	<Axes
		sx={hx}
		sy={scale([0, 1], [H_BOT, H_TOP])}
		yTicks={[]}
		xFormat={(v: number) => signed(v, Number.isInteger(v) ? 0 : 1)}
		xLabel="bootstrap difference of averages (mm)"
		grid={false}
	/>
	{#if ci}
		<rect
			x={hx(ci[0])}
			y={H_TOP - 6}
			width={hx(ci[1]) - hx(ci[0])}
			height={H_BOT - H_TOP + 6}
			fill="var(--ri-boot)"
			opacity="0.1"
		/>
	{/if}
	{#each BIN_IDS as b (b)}
		{#if bins.now[b] > 0}
			{@const x = hx(obs - D + b * binW)}
			{@const w = hx(obs - D + (b + 1) * binW) - x}
			{@const inside = ci
				? obs - D + (b + 0.5) * binW >= ci[0] && obs - D + (b + 0.5) * binW <= ci[1]
				: true}
			<rect
				x={x + 0.5}
				y={H_BOT - bins.now[b] * unit}
				width={Math.max(1, w - 1)}
				height={bins.now[b] * unit}
				rx="1.5"
				fill="var(--ri-boot)"
				opacity={inside ? 0.85 : 0.4}
			/>
		{/if}
	{/each}
	<line
		x1={hx(obs)}
		x2={hx(obs)}
		y1={H_TOP - 6}
		y2={H_BOT}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-dasharray="4 3"
	/>
	{#if ci}
		{#each [{ id: 'lo', v: ci[0], q: '2.5%' }, { id: 'hi', v: ci[1], q: '97.5%' }] as e (e.id)}
			<line
				x1={hx(e.v)}
				x2={hx(e.v)}
				y1={H_TOP - 14}
				y2={H_BOT}
				stroke="var(--ri-boot)"
				stroke-width="2.5"
			/>
			<Readout id="ci-{e.id}">
				<Label
					x={hx(e.v)}
					y={H_TOP - 20}
					anchor={e.id === 'lo' ? 'end' : 'start'}
					size={12}
					weight={600}
					color="var(--ri-boot)"
					text="{e.q}: {signed(e.v)}"
				/>
			</Readout>
		{/each}
	{/if}

	<!-- panel -->
	<Readout
		id="observed"
		order={1}
		label="Observed difference"
		value="{signed(obs, 2)} mm"
		note="{g.cmp.b.name} − {g.cmp.a.name}"
	>
		<Label x={PL} y={60} anchor="start" muted text="observed difference" />
		<Label x={PL} y={88} anchor="start" size={24} weight={700} tabular text="{signed(obs, 2)} mm" />
		<Label
			x={PL}
			y={110}
			anchor="start"
			size={12}
			muted
			text="this resample: {signed(show.d, 2)} mm"
		/>
	</Readout>
	<Readout id="resamples" order={2} label="Resamples" value="{fmt(taken)} of {fmt(RESAMPLES)}">
		<Label x={PL} y={170} anchor="start" muted text="resamples" />
		<Label
			x={PL}
			y={196}
			anchor="start"
			size={22}
			weight={600}
			tabular
			text="{fmt(taken)} of {fmt(RESAMPLES)}"
		/>
	</Readout>
	<Readout
		id="se"
		order={3}
		label="Standard error"
		value="{f2(bootSe)} mm"
		note="formula √(s₁²/n₁ + s₂²/n₂) = {f2(formulaSe)}"
	>
		<Label x={PL} y={256} anchor="start" muted text="standard error" />
		<Label
			x={PL}
			y={280}
			anchor="start"
			size={14}
			weight={600}
			tabular
			text="bootstrap spread  {f2(bootSe)} mm"
		/>
		<Label
			x={PL}
			y={302}
			anchor="start"
			size={12}
			muted
			tabular
			text="formula √(s₁²/n₁ + s₂²/n₂)  {f2(formulaSe)} mm"
		/>
	</Readout>
	<Readout
		id="ci"
		order={4}
		label="95% percentile interval"
		value={ci ? `${f1(ci[0])} to ${f1(ci[1])} mm` : '…'}
		color="var(--ri-boot)"
	>
		<Label x={PL} y={366} anchor="start" muted text="95% percentile interval" />
		<Label
			x={PL}
			y={394}
			anchor="start"
			size={22}
			weight={700}
			tabular
			color="var(--ri-boot)"
			text={ci ? `${f1(ci[0])} to ${f1(ci[1])} mm` : '…'}
		/>
		<Label
			x={PL}
			y={416}
			anchor="start"
			size={12}
			muted
			text="the middle 95% of the resampled gaps"
		/>
	</Readout>
</g>
