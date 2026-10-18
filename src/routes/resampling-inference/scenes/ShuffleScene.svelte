<script lang="ts">
	/**
	 * The permutation test on real penguins: two rows of dots (flipper lengths of group a and
	 * group b, each with its average), and below them the histogram of the differences of
	 * averages that 9,999 random relabellings produce.
	 *
	 * Phases (`step.hints.phase`):
	 *   data    — the two groups, their averages and the observed difference; no shuffling
	 *   shuffle — every PERIOD seconds the dots are dealt into the rows at random (keeping the
	 *             group sizes; each dot keeps its true colour), the shuffled averages and their
	 *             difference are drawn, and the difference drops into the histogram; meanwhile
	 *             the histogram fills at RATE shuffles a second
	 *   p       — the same, plus the tails beyond ±observed in the tail colour and the p-value
	 *             (count + 1) / (shuffles + 1) as it stands
	 *
	 * The run: `permutationTest(a, b, SHUFFLES, seed)`; shuffle k is `shuffleLabels(…, k)`, so the
	 * showcased shuffle is the one counted. Shuffle k counts once k / RATE seconds of the run have
	 * passed; the run restarts when the comparison, the group size or the redraw count change.
	 * Reduced motion: every shuffle counted; shuffle 0 shown in its rows (shuffle and p phases).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, clamp, hash, lerp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { meanOf, permutationTest, quantile, shuffleLabels } from '../resample';
	import { chosenGroups, fmt, pText, signed } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const SHUFFLES = 9999;
	const RATE = 600;
	const PERIOD = 2.8;
	const BINS = 48;

	const phase = $derived(String(step.hints?.phase ?? 'data'));
	const shuffling = $derived(phase !== 'data');
	const shuffleAmt = new Tween(0, { duration: 700, easing: cubicInOut });
	const pAmt = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const s = shuffling ? 1 : 0;
		const p = phase === 'p' ? 1 : 0;
		untrack(() => {
			shuffleAmt.set(s);
			pAmt.set(p);
		});
	});

	// ---- data and the test -------------------------------------------------------------------
	const g = $derived(chosenGroups(params));
	const nA = $derived(g.a.length);
	const nB = $derived(g.b.length);
	const pooled = $derived([...g.a, ...g.b]);
	const test = $derived(permutationTest(g.a, g.b, SHUFFLES, g.seed));
	const obs = $derived(test.observed);
	/** extremeBy[k]: shuffles among the first k at least as far from 0 as the observed gap. */
	const extremeBy = $derived.by(() => {
		const c = new Int32Array(SHUFFLES + 1);
		for (let k = 0; k < SHUFFLES; k++)
			c[k + 1] = c[k] + (Math.abs(test.diffs[k]) >= Math.abs(obs) - 1e-9 ? 1 : 0);
		return c;
	});
	const nullSd = $derived(Math.sqrt(meanOf(test.diffs.map((d) => d * d))));
	/** Half-width that holds 95% of all the shuffled differences (the 95th percentile of |d|). */
	const within95 = $derived(quantile(test.diffs.map(Math.abs).sort(), 0.95));

	// ---- the run --------------------------------------------------------------------------------
	let lastKey = '';
	let t0 = 0;
	const elapsed = $derived.by(() => {
		if (reduced) return 1e6;
		if (g.key !== lastKey) {
			if (lastKey !== '') t0 = t;
			lastKey = g.key;
		}
		if (t < t0) t0 = 0; // a new step started
		return Math.max(0, t - t0);
	});
	const taken = $derived(shuffling ? Math.min(SHUFFLES, Math.floor(elapsed * RATE)) : 0);

	// ---- geometry ---------------------------------------------------------------------------------
	const X0 = 72;
	const X1 = 600;
	const ROW_A = 92;
	const ROW_B = 196;
	const JIT = 24;
	const sx = $derived(scale(g.range, [X0, X1]));
	const r = $derived(nA + nB > 60 ? 3.2 : 5);
	const flipperTicks = $derived(
		Array.from({ length: (g.range[1] - g.range[0]) / 5 + 1 }, (_, i) => g.range[0] + 5 * i)
	);

	// histogram of shuffled differences
	const H_TOP = 318;
	const H_BOT = 520;
	const D = $derived.by(() => {
		const need = Math.max(Math.abs(obs) * 1.25, 4.2 * nullSd, 1);
		const stepD = need > 12 ? 5 : need > 4 ? 2 : 1;
		return Math.ceil(need / stepD) * stepD;
	});
	const hx = $derived(scale([-D, D], [X0, X1]));
	const binW = $derived((2 * D) / BINS);
	const binOf = (d: number) => clamp(Math.floor((d + D) / binW), 0, BINS - 1);
	const bins = $derived.by(() => {
		const all = new Int32Array(BINS);
		const tail = new Int32Array(BINS);
		for (let k = 0; k < SHUFFLES; k++) all[binOf(test.diffs[k])]++;
		const now = new Int32Array(BINS);
		for (let k = 0; k < taken; k++) {
			const b = binOf(test.diffs[k]);
			now[b]++;
			if (Math.abs(test.diffs[k]) >= Math.abs(obs) - 1e-9) tail[b]++;
		}
		return { all, now, tail };
	});
	const unit = $derived(((H_BOT - H_TOP) * 0.92) / Math.max(1, ...bins.all));
	const BIN_IDS = Array.from({ length: BINS }, (_, i) => i);

	// ---- the showcased shuffle ---------------------------------------------------------------------
	const show = $derived.by(() => {
		const cyc = reduced ? 0 : Math.floor(elapsed / PERIOD);
		const u = reduced ? 1.5 : elapsed - cyc * PERIOD;
		const k = reduced ? 0 : Math.min(SHUFFLES - 1, Math.floor(cyc * PERIOD * RATE));
		const go = shuffling
			? reduced
				? 1
				: smoothstep(0.4, 1.0, u) * (1 - smoothstep(2.3, 2.8, u))
			: 0;
		const inB = shuffleLabels(nA, nB, g.seed, k);
		const d = test.diffs[k];
		// the shuffled difference drops from the strip into the histogram
		const drop = reduced ? 0 : clamp((u - 1.6) / 0.5);
		return { k, u, go, inB, d, drop };
	});
	const dots = $derived(
		pooled.map((v, i) => {
			const trueB = i >= nA;
			const toB = show.inB[i] === 1;
			const jy = (hash(i, 3.7) - 0.5) * 2 * JIT;
			const y0 = (trueB ? ROW_B : ROW_A) + jy;
			const y1 = (toB ? ROW_B : ROW_A) + jy;
			const a = show.go * shuffleAmt.current;
			return { i, x: sx(v), y: lerp(y0, y1, a), b: trueB };
		})
	);
	const shuffledMeans = $derived.by(() => {
		let sA = 0;
		let sB = 0;
		pooled.forEach((v, i) => (show.inB[i] ? (sB += v) : (sA += v)));
		return { a: sA / nA, b: sB / nB };
	});
	const meanA = $derived(meanOf(g.a));
	const meanB = $derived(meanOf(g.b));
	/** How much of the shuffled state shows (dots in shuffled rows). */
	const shown = $derived(show.go * shuffleAmt.current);
	const showMeanA = $derived(lerp(meanA, shuffledMeans.a, shown));
	const showMeanB = $derived(lerp(meanB, shuffledMeans.b, shown));

	const p = $derived((extremeBy[taken] + 1) / (taken + 1));
	const ARROW_Y = (ROW_A + ROW_B) / 2;
	const dropY = $derived(
		lerp(ARROW_Y, H_BOT - bins.now[binOf(show.d)] * unit - 6, show.drop * show.drop)
	);
	const dropOpacity = $derived(shown > 0.5 && show.drop > 0 && show.drop < 1 ? 1 : 0);

	const ax = $derived(sx(showMeanA));
	const bx = $derived(sx(showMeanB));
	const dirn = $derived(bx >= ax ? 1 : -1);

	const PL = 636;
</script>

<g>
	<!-- ===================== the two groups ===================== -->
	{#each [ROW_A, ROW_B] as y (y)}
		<rect
			x={X0 - 8}
			y={y - JIT - 8}
			width={X1 - X0 + 16}
			height={2 * JIT + 16}
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
			y1={ROW_A - JIT - 8}
			y2={ROW_B + JIT + 12}
			stroke="var(--stage-grid)"
			stroke-width="1"
		/>
		<Readout id="tick-{v}">
			<Label x={sx(v)} y={ROW_B + JIT + 24} size={11} muted halo={false} text={String(v)} />
		</Readout>
	{/each}
	{#each dots as d (d.i)}
		<circle cx={d.x} cy={d.y} {r} fill={d.b ? 'var(--ri-b)' : 'var(--ri-a)'} opacity="0.78" />
	{/each}

	<!-- the rows' averages -->
	{#each [{ id: 'a', y: ROW_A, m: showMeanA }, { id: 'b', y: ROW_B, m: showMeanB }] as row (row.id)}
		<line
			x1={sx(row.m)}
			x2={sx(row.m)}
			y1={row.y - JIT - 6}
			y2={row.y + JIT + 6}
			stroke={shown > 0.5 ? 'var(--stage-ink)' : row.id === 'a' ? 'var(--ri-a)' : 'var(--ri-b)'}
			stroke-width="3"
			stroke-dasharray={shown > 0.5 ? '5 3' : undefined}
		/>
	{/each}
	<Readout id="row-a">
		<Label
			x={X0 - 8}
			y={ROW_A - JIT - 16}
			anchor="start"
			size={13}
			weight={600}
			color={shown > 0.5 ? undefined : 'var(--ri-a)'}
			text={shown > 0.5
				? `shuffled label “${g.cmp.a.name}” · ${nA} · average ${showMeanA.toFixed(1)} mm`
				: `${g.cmp.a.name} · ${nA} penguins · average ${meanA.toFixed(1)} mm`}
		/>
	</Readout>
	<Readout id="row-b">
		<Label
			x={X0 - 8}
			y={ROW_B + JIT + 46}
			anchor="start"
			size={13}
			weight={600}
			color={shown > 0.5 ? undefined : 'var(--ri-b)'}
			text={shown > 0.5
				? `shuffled label “${g.cmp.b.name}” · ${nB} · average ${showMeanB.toFixed(1)} mm`
				: `${g.cmp.b.name} · ${nB} penguins · average ${meanB.toFixed(1)} mm`}
		/>
	</Readout>
	<Readout id="flipper-axis">
		<Label
			x={X1 + 8}
			y={ROW_B + JIT + 46}
			anchor="end"
			size={11}
			muted
			text="flipper length (mm)"
		/>
	</Readout>

	<!-- the difference between the averages -->
	<line
		x1={ax}
		x2={bx - dirn * 4}
		y1={ARROW_Y}
		y2={ARROW_Y}
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-end={Math.abs(bx - ax) > 10 ? 'url(#arrowhead)' : undefined}
	/>
	<Label
		x={(ax + bx) / 2}
		y={ARROW_Y - 8}
		size={13}
		weight={700}
		tabular
		text="{signed(lerp(obs, show.d, shown))} mm"
	/>

	<!-- the shuffled difference dropping into the histogram -->
	{#if dropOpacity > 0}
		<circle
			cx={hx(show.d)}
			cy={dropY}
			r="5"
			fill="var(--stage-ink)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- ===================== the permutation distribution ===================== -->
	<g opacity={0.25 + 0.75 * shuffleAmt.current}>
		<Axes
			sx={hx}
			sy={scale([0, 1], [H_BOT, H_TOP])}
			yTicks={[]}
			xFormat={(v: number) => signed(v, Number.isInteger(v) ? 0 : 1)}
			xLabel="difference of averages, {g.cmp.b.name} − {g.cmp.a.name} (mm)"
			grid={false}
		/>
		{#each BIN_IDS as b (b)}
			{#if bins.now[b] > 0}
				{@const x = hx(-D + b * binW)}
				{@const w = hx(-D + (b + 1) * binW) - x}
				{@const h = bins.now[b] * unit}
				{@const th = bins.tail[b] * unit * pAmt.current}
				<rect
					x={x + 0.5}
					y={H_BOT - h}
					width={Math.max(1, w - 1)}
					height={h}
					rx="1.5"
					fill="var(--ri-null)"
					opacity="0.85"
				/>
				{#if th > 0.2}
					<rect
						x={x + 0.5}
						y={H_BOT - th}
						width={Math.max(1, w - 1)}
						height={th}
						rx="1.5"
						fill="var(--ri-tail)"
					/>
				{/if}
			{/if}
		{/each}
		{#if !shuffling || taken === 0}
			<Label
				x={(X0 + X1) / 2}
				y={(H_TOP + H_BOT) / 2}
				size={13}
				muted
				text="shuffled differences will pile up here"
			/>
		{/if}
	</g>

	<!-- the observed difference on the histogram (and its mirror, for the two-sided count) -->
	<line
		x1={hx(obs)}
		x2={hx(obs)}
		y1={H_TOP - 10}
		y2={H_BOT}
		stroke="var(--stage-ink)"
		stroke-width="2.5"
	/>
	<Label
		x={hx(obs)}
		y={H_TOP - 16}
		size={13}
		weight={700}
		anchor={hx(obs) > X1 - 70 ? 'end' : hx(obs) < X0 + 70 ? 'start' : 'middle'}
		text="observed {signed(obs)} mm"
	/>
	{#if pAmt.current > 0.01}
		<line
			x1={hx(-obs)}
			x2={hx(-obs)}
			y1={H_TOP + 4}
			y2={H_BOT}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
			stroke-dasharray="5 4"
			opacity={pAmt.current * 0.8}
		/>
		<Readout id="mirror">
			<Label
				x={hx(-obs)}
				y={H_TOP - 2}
				size={11}
				muted
				opacity={pAmt.current}
				text="mirror {signed(-obs)}"
			/>
		</Readout>
	{/if}

	<!-- ===================== panel ===================== -->
	<Readout
		id="observed"
		order={1}
		label="Observed difference"
		value="{signed(obs, 2)} mm"
		note="{g.cmp.b.name} − {g.cmp.a.name}"
	>
		<Label x={PL} y={60} anchor="start" size={13} muted text="observed difference" />
		<Label x={PL} y={90} anchor="start" size={26} weight={700} tabular text="{signed(obs, 2)} mm" />
		<Label
			x={PL}
			y={112}
			anchor="start"
			size={12}
			muted
			text="{g.cmp.b.name} − {g.cmp.a.name} averages"
		/>
	</Readout>

	<g opacity={0.3 + 0.7 * shuffleAmt.current}>
		<Readout
			id="shuffles"
			order={2}
			label="Shuffles"
			value="{fmt(taken)} of {fmt(SHUFFLES)}"
			opacity={shuffleAmt.current}
		>
			<Label x={PL} y={190} anchor="start" size={13} muted text="shuffles of the labels" />
			<Label
				x={PL}
				y={218}
				anchor="start"
				size={22}
				weight={600}
				tabular
				text="{fmt(taken)} of {fmt(SHUFFLES)}"
			/>
			<Label
				x={PL}
				y={240}
				anchor="start"
				size={12}
				muted
				text="95% of them within ±{within95.toFixed(1)} mm"
			/>
		</Readout>
	</g>

	{#if pAmt.current > 0.01}
		<g opacity={pAmt.current}>
			<Readout
				id="extreme"
				order={3}
				label="As far from 0 as observed"
				value={fmt(extremeBy[taken])}
				color="var(--ri-tail)"
				opacity={pAmt.current}
			>
				<Label
					x={PL}
					y={300}
					anchor="start"
					size={13}
					muted
					text="shuffles at least as far from 0"
				/>
				<Label
					x={PL}
					y={326}
					anchor="start"
					size={22}
					weight={600}
					tabular
					color="var(--ri-tail)"
					text={fmt(extremeBy[taken])}
				/>
			</Readout>
			<Readout
				id="p"
				order={4}
				label="p-value"
				value={pText(p)}
				note="({fmt(extremeBy[taken])} + 1) / ({fmt(taken)} + 1)"
				opacity={pAmt.current}
			>
				<Label
					x={PL}
					y={384}
					anchor="start"
					size={13}
					tabular
					text="p = ({fmt(extremeBy[taken])} + 1) / ({fmt(taken)} + 1)"
				/>
				<Label x={PL} y={418} anchor="start" size={28} weight={700} tabular text="p = {pText(p)}" />
				<Label
					x={PL}
					y={444}
					anchor="start"
					size={12}
					muted
					text={extremeBy[taken] === 0
						? taken === SHUFFLES
							? 'none got there: the smallest p 9,999 shuffles can give'
							: 'no shuffle has got there yet'
						: extremeBy[taken] > taken / 2
							? 'most shuffles get this far'
							: `about 1 shuffle in ${fmt(Math.round(taken / extremeBy[taken]))} gets this far`}
				/>
			</Readout>
			<Readout id="not-null">
				<Label
					x={PL}
					y={490}
					anchor="start"
					size={12}
					muted
					text="the chance of a gap this big if labels"
				/>
				<Label
					x={PL}
					y={508}
					anchor="start"
					size={12}
					muted
					text="meant nothing — not the chance that they do"
				/>
			</Readout>
		</g>
	{/if}
</g>
