<script lang="ts">
	/**
	 * Filters of 8 bits per word, from 16 bits (two words) to 4,096 (512 words), with k hash
	 * functions (the slider). Top: one 16-bit filter with two words, a new seed every 1.6 s: the
	 * bits each word sets, and the chance (j/16)^k that a missing word finds all its bits set.
	 * Chart: the false-positive rate against the filter's size (log scale): the formula
	 * (1 − e^(−kn/m))^k, flat; the exact value from the distribution of bits set; and the rate
	 * measured over 300 filters of each size with different seeds (dots). Reduced motion shows
	 * the first filter.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { INSERTABLE, QUERIES, bitsOf, fpApprox, fpExact, measuredFPAverage } from '../model';
	import { C, group, int, memo, pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const k = $derived(int(params, 'tinyK', 6, 1, 10));
	const SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
	const TRIALS = 300;
	const seriesOf = memo((key: string) => {
		const kk = Number(key);
		return SIZES.map((m) => ({
			m,
			approx: fpApprox(m / 8, m, kk),
			exact: fpExact(m / 8, m, kk),
			measured: measuredFPAverage(m / 8, m, kk, TRIALS, QUERIES.slice(0, 150))
		}));
	}, 12);
	const series = $derived(seriesOf(String(k)));
	const first = $derived(series[0]);

	// ---- one tiny filter -----------------------------------------------------------------
	const TM = 16;
	const PERIOD = 1.6;
	const trial = $derived(reduced ? 0 : Math.floor(t / PERIOD));
	const pair = $derived([INSERTABLE[(trial * 2) % 400], INSERTABLE[(trial * 2 + 1) % 400]]);
	const pairBits = $derived(pair.map((w) => bitsOf(w, TM, k, 7000 + trial)));
	const setA = $derived(new Set(pairBits[0]));
	const setB = $derived(new Set(pairBits[1]));
	const ones = $derived(new Set([...pairBits[0], ...pairBits[1]]).size);
	const chance = $derived((ones / TM) ** k);
	const TX0 = 40;
	const TP = 34;
	const TY = 104;

	// ---- chart ---------------------------------------------------------------------------
	const R = { x0: 100, x1: 900, y0: 266, y1: 520 };
	const sxM = scale([Math.log2(16), Math.log2(4096)], [R.x0, R.x1]);
	const yTop = $derived(
		Math.max(...series.map((s) => Math.max(s.exact, s.measured, s.approx))) * 1.12
	);
	const syF = $derived(scale([0, yTop], [R.y1, R.y0]));
	const yTicks = $derived.by(() => {
		const raw = yTop / 4;
		const mag = 10 ** Math.floor(Math.log10(raw));
		const st = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= raw) ?? raw;
		return Array.from({ length: Math.floor(yTop / st) + 1 }, (_, i) => i * st);
	});
	const line = (key: 'approx' | 'exact') =>
		linePath(
			series,
			(s) => Math.log2(s.m),
			(s) => s[key],
			sxM,
			syF
		);
</script>

<g>
	<Readout id="ti-title" order={1} label="Filters" value="8 bits per word, k = {k}">
		<Label
			x={40}
			y={44}
			anchor="start"
			text="8 bits per word, k = {k}: small filters against large"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- one tiny filter -->
	<Readout
		id="ti-one"
		order={2}
		label="One 16-bit filter"
		value="{ones} of 16 bits set: a missing word passes {pct(chance)}"
	>
		<Label
			x={40}
			y={80}
			anchor="start"
			text="one 16-bit filter, two words, seed {trial + 1}: ‘{pair[0]}’ and ‘{pair[1]}’"
			size={12}
			muted
		/>
	</Readout>
	{#each { length: TM }, b (b)}
		{@const a = setA.has(b)}
		{@const bb = setB.has(b)}
		<rect
			x={TX0 + b * TP}
			y={TY}
			width={TP - 4}
			height={30}
			rx="4"
			fill={a || bb ? C.bit : C.slot}
			stroke={C.slotEdge}
			stroke-width="0.8"
		/>
		{#if a && bb}
			<text
				x={TX0 + b * TP + (TP - 4) / 2}
				y={TY + 20}
				text-anchor="middle"
				font-size="12"
				font-weight="700"
				fill="white">2</text
			>
		{/if}
	{/each}
	<Readout id="ti-chance">
		<Label
			x={TX0 + TM * TP + 16}
			y={TY + 12}
			anchor="start"
			text="{ones} of 16 bits set"
			size={13}
			weight={700}
			tabular
		/>
		<Label
			x={TX0 + TM * TP + 16}
			y={TY + 30}
			anchor="start"
			text="a missing word passes: ({ones}/16)^{k} = {pct(chance)}"
			size={12}
			color={C.fpText}
			tabular
		/>
	</Readout>
	<Readout id="ti-note">
		<Label
			x={40}
			y={TY + 56}
			anchor="start"
			text="2: both words set that bit. The bits set vary from seed to seed, and the rate grows as their share to the power k."
			size={11}
			muted
		/>
	</Readout>

	<!-- chart -->
	<Label
		x={R.x0 - 60}
		y={R.y0 - 34}
		anchor="start"
		text="false-positive rate against the filter’s size"
		size={13}
		weight={700}
	/>
	<Axes
		sx={sxM}
		sy={syF}
		xTicks={SIZES.map((m) => Math.log2(m))}
		xFormat={(v: number) => group(2 ** v)}
		{yTicks}
		yFormat={(v: number) => `${Number((v * 100).toPrecision(3))}%`}
		xLabel="bits m"
	/>
	<path d={line('approx')} fill="none" stroke={C.miss} stroke-width="2" stroke-dasharray="6 4" />
	<path d={line('exact')} fill="none" stroke={C.probe} stroke-width="2" />
	{#each series as s (s.m)}
		<circle
			cx={sxM(Math.log2(s.m))}
			cy={syF(s.measured)}
			r="5"
			fill={C.fp}
			stroke="var(--stage-bg)"
			stroke-width="1.2"
		/>
	{/each}

	<!-- readouts -->
	<Readout
		id="ti-small"
		order={3}
		label="16 bits"
		value="measured {pct(first.measured)}, exact {pct(first.exact)}, formula {pct(first.approx)}"
	>
		<Label
			x={sxM(4) + 14}
			y={syF(first.measured) - 10}
			anchor="start"
			text="16 bits: measured {pct(first.measured)}, formula {pct(first.approx)}"
			size={12}
			weight={600}
			color={C.fpText}
			tabular
		/>
	</Readout>
	<Readout id="ti-legend">
		<line
			x1="100"
			x2="126"
			y1="566"
			y2="566"
			stroke={C.miss}
			stroke-width="2"
			stroke-dasharray="6 4"
		/>
		<Label x={134} y={570} anchor="start" text="formula (1 − e^(−kn/m))^k" size={11} muted />
		<line x1="330" x2="356" y1="566" y2="566" stroke={C.probe} stroke-width="2" />
		<Label
			x={364}
			y={570}
			anchor="start"
			text="exact, from the spread of bits set"
			size={11}
			muted
		/>
		<circle cx="600" cy="566" r="5" fill={C.fp} />
		<Label
			x={612}
			y={570}
			anchor="start"
			text="measured, {TRIALS} filters of each size"
			size={11}
			muted
		/>
	</Readout>
</g>
