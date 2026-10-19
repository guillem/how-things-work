<script lang="ts">
	/**
	 * A hash table of 64 slots holding the first n words (the slider), with chaining (each slot's
	 * chain stacked under it) or linear probing (a word moved from its home slot drawn in orange).
	 * Every 2.4 s a word is looked up and its probes are drawn one by one: arcs from slot to slot
	 * for linear probing, a ring moving down the chain for chaining; every third lookup is a word
	 * that was never inserted. Below, the mean probes of this table as it filled (thick lines),
	 * found and not found, against the expected values for 64 slots (thin) and, for linear
	 * probing, the large-table formulas (dashed). Reduced motion shows one finished lookup.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		INSERTABLE,
		QUERIES,
		buildTable,
		expectedProbes,
		fillCurve,
		longest,
		search,
		type Scheme
	} from '../model';
	import { C, int, memo, probes } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const M = 64;
	const scheme: Scheme = $derived(step.hints?.scheme === 'chaining' ? 'chaining' : 'linear');
	const nMax = $derived(scheme === 'chaining' ? 128 : 63);
	const n = $derived(
		scheme === 'chaining'
			? int(params, 'chainKeys', 48, 0, 128)
			: int(params, 'probeKeys', 40, 0, 63)
	);
	/** The hash seed: 0 at first, then the number of presses of "Another hash seed". */
	const salt = $derived(Math.max(0, Math.round(Number(params.reseed) || 0)));
	const curveOf = memo((key: string) => {
		const [s, sl] = key.split('|');
		return fillCurve(s as Scheme, INSERTABLE.slice(0, 128), M, { salt: Number(sl) });
	}, 8);
	const curve = $derived(curveOf(`${scheme}|${salt}`));
	const table = $derived(buildTable(scheme, INSERTABLE.slice(0, n), M, { salt }));
	const exp = $derived(expectedProbes(scheme, M, n));
	const measuredHit = $derived(n ? curve.hit[n - 1] : 0);
	const measuredMiss = $derived(n ? curve.miss[n - 1] : scheme === 'linear' ? 1 : 0);

	// ---- the lookup being shown ----------------------------------------------------------
	const LOOK = 2.4;
	const time = $derived(reduced ? LOOK + LOOK * 0.97 : t);
	const j = $derived(Math.floor(time / LOOK));
	const u = $derived(time - j * LOOK);
	const missing = $derived(n === 0 || j % 3 === 2);
	const word = $derived(missing ? QUERIES[(j * 53) % QUERIES.length] : table.keys[(j * 37) % n]);
	const found = $derived(search(table, word, { salt }));
	const PROBE_DT = 0.2;
	const shown = $derived(
		reduced ? found.path.length : clamp(Math.floor((u - 0.3) / PROBE_DT) + 1, 0, found.path.length)
	);
	const done = $derived(shown >= found.path.length);

	// ---- the strip of slots --------------------------------------------------------------
	const X0 = 40;
	const PITCH = 880 / M;
	const SW = PITCH - 2.2;
	const SY = 150;
	const SH = 24;
	const sx = (s: number) => X0 + s * PITCH;
	const cx = (s: number) => sx(s) + SW / 2;
	const CH = 10;
	const CHAIN_MAX = 9;
	const home = $derived(found.path[0]);
	const labelX = $derived(clamp(cx(home), 150, 810));

	/** Arcs of the linear probes shown so far. */
	const arcs = $derived.by(() => {
		if (scheme !== 'linear') return [];
		const out: { d: string; k: number }[] = [];
		for (let k = 1; k < shown; k++) {
			const a = cx(found.path[k - 1]);
			const b = cx(found.path[k]);
			const lift = Math.min(40, 10 + Math.abs(b - a) * 0.15);
			out.push({ d: `M${a} ${SY - 2} Q${(a + b) / 2} ${SY - 2 - lift} ${b} ${SY - 2}`, k });
		}
		return out;
	});
	const ringSlot = $derived(found.path[Math.max(0, shown - 1)]);
	/** Chaining: the chain position being compared (0-based). */
	const ringDepth = $derived(Math.max(0, shown - 1));

	const verdict = $derived(
		!done
			? `‘${word}’ → slot ${home}`
			: found.found
				? `‘${word}’ → slot ${home}: found, ${probes(found.probes)}`
				: scheme === 'linear'
					? `‘${word}’ → slot ${home}: not there, ${probes(found.probes)} (an empty slot)`
					: found.probes === 0
						? `‘${word}’ → slot ${home}: empty, so not there, 0 probes`
						: `‘${word}’ → slot ${home}: not there, ${probes(found.probes)} (the whole chain)`
	);

	// ---- the chart -----------------------------------------------------------------------
	const R = { x0: 96, x1: 520, y0: 330, y1: 556 };
	const yMax = $derived(scheme === 'chaining' ? 3 : 10);
	const sxA = $derived(scale([0, scheme === 'chaining' ? 2 : 1], [R.x0, R.x1]));
	const syP = $derived(scale([0, yMax], [R.y1, R.y0]));
	const cy = (v: number) => syP(Math.min(yMax, v));
	const expected = $derived(
		Array.from({ length: nMax + 1 }, (_, k) => ({ a: k / M, ...expectedProbes(scheme, M, k) }))
	);
	const limit = $derived(
		scheme === 'linear'
			? Array.from({ length: 96 }, (_, k) => {
					const a = (k / 100) * 0.99;
					return { a, hit: 0.5 * (1 + 1 / (1 - a)), miss: 0.5 * (1 + 1 / (1 - a) ** 2) };
				})
			: []
	);
	const measured = $derived(
		Array.from({ length: n }, (_, k) => ({
			a: curve.alpha[k],
			hit: curve.hit[k],
			miss: curve.miss[k]
		}))
	);
	const line = (data: { a: number; hit: number; miss: number }[], key: 'hit' | 'miss') =>
		linePath(
			data,
			(d) => d.a,
			(d) => Math.min(yMax * 1.5, d[key]),
			sxA,
			syP
		);
	const longestNow = $derived(longest(table));
	const f2 = (x: number) => x.toFixed(2);
</script>

<g>
	<Readout id="tb-title" order={1} label="Table" value="64 slots, {n} words, α = {f2(n / M)}">
		<Label
			x={40}
			y={44}
			anchor="start"
			text="{scheme === 'chaining'
				? 'chaining'
				: 'linear probing'}: 64 slots, {n} words, load factor α = {f2(n / M)}"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- the lookup -->
	<Readout
		id="tb-look"
		order={2}
		label="Lookup"
		value={verdict.replace(/^‘[^’]*’ → /, `‘${word}’ → `)}
	>
		<Label
			x={labelX}
			y={92}
			text={verdict}
			size={13}
			weight={600}
			color={done ? (found.found ? C.hitText : C.missText) : C.probeText}
		/>
	</Readout>
	<path
		d="M{labelX} 100 L{cx(home)} {SY - 6}"
		stroke={C.probe}
		stroke-width="1.2"
		stroke-dasharray="3 3"
		fill="none"
		opacity={shown > 0 ? 0.8 : 0.3}
	/>

	<!-- slots -->
	{#each { length: M }, s (s)}
		{@const ki = table.slots[s]}
		<rect
			x={sx(s)}
			y={SY}
			width={SW}
			height={SH}
			rx="2.5"
			fill={scheme === 'linear' && ki >= 0 ? (table.home[ki] === s ? C.key : C.moved) : C.slot}
			stroke={C.slotEdge}
			stroke-width="0.7"
		/>
	{/each}
	{#if scheme === 'chaining'}
		{#each table.chains as chain, s (s)}
			{#each { length: Math.min(CHAIN_MAX, chain.length) }, d (d)}
				<rect
					x={sx(s) + 1}
					y={SY + SH + 4 + d * (CH + 2)}
					width={SW - 2}
					height={CH}
					rx="2"
					fill={C.key}
				/>
			{/each}
			{#if chain.length > CHAIN_MAX}
				<text
					x={cx(s)}
					y={SY + SH + 4 + CHAIN_MAX * (CH + 2) + 10}
					text-anchor="middle"
					font-size="10"
					fill="var(--stage-ink-muted)">+{chain.length - CHAIN_MAX}</text
				>
			{/if}
		{/each}
	{/if}
	<Readout id="tb-ticks">
		{#each [0, 16, 32, 48, 63] as s (s)}
			<text x={cx(s)} y={SY - 8} text-anchor="middle" font-size="10" fill="var(--stage-ink-muted)"
				>{s}</text
			>
		{/each}
	</Readout>

	<!-- probes -->
	{#each arcs as a (a.k)}
		<path d={a.d} fill="none" stroke={C.probe} stroke-width="2" opacity="0.9" />
	{/each}
	{#if shown > 0}
		{#if scheme === 'linear'}
			<rect
				x={sx(ringSlot) - 2}
				y={SY - 2}
				width={SW + 4}
				height={SH + 4}
				rx="4"
				fill="none"
				stroke={done ? (found.found ? C.hit : C.miss) : C.probe}
				stroke-width="2.5"
			/>
		{:else if found.found || table.chains[home].length > 0}
			<rect
				x={sx(home) - 2}
				y={SY + SH + 2 + Math.min(ringDepth, CHAIN_MAX - 1) * (CH + 2)}
				width={SW + 4}
				height={CH + 4}
				rx="3"
				fill="none"
				stroke={done ? (found.found ? C.hit : C.miss) : C.probe}
				stroke-width="2.5"
			/>
		{:else}
			<rect
				x={sx(home) - 2}
				y={SY - 2}
				width={SW + 4}
				height={SH + 4}
				rx="4"
				fill="none"
				stroke={C.miss}
				stroke-width="2.5"
			/>
		{/if}
	{/if}
	{#if scheme === 'linear'}
		<Readout id="tb-key-home" order={20} label="At its own slot" color={C.key}>
			<rect x={40} y={SY + 40} width="11" height="11" rx="2" fill={C.key} />
			<Label x={58} y={SY + 50} anchor="start" text="at its own slot" size={11} muted />
		</Readout>
		<Readout id="tb-key-moved" order={21} label="Moved along" color={C.moved}>
			<rect x={160} y={SY + 40} width="11" height="11" rx="2" fill={C.moved} />
			<Label
				x={178}
				y={SY + 50}
				anchor="start"
				text="moved along: its slot was taken"
				size={11}
				muted
			/>
		</Readout>
	{/if}

	<!-- chart -->
	<Label
		x={R.x0 - 56}
		y={R.y0 - 22}
		anchor="start"
		text="mean probes per lookup"
		size={13}
		weight={700}
	/>
	<Axes sx={sxA} sy={syP} xLabel="load factor α" />
	<defs>
		<clipPath id="hb-table-clip">
			<rect x={R.x0} y={R.y0 - 2} width={R.x1 - R.x0 + 2} height={R.y1 - R.y0 + 4} />
		</clipPath>
	</defs>
	<g clip-path="url(#hb-table-clip)">
		{#if scheme === 'linear'}
			<path
				d={line(limit, 'hit')}
				fill="none"
				stroke={C.hit}
				stroke-width="1.2"
				stroke-dasharray="5 4"
				opacity="0.6"
			/>
			<path
				d={line(limit, 'miss')}
				fill="none"
				stroke={C.miss}
				stroke-width="1.2"
				stroke-dasharray="5 4"
				opacity="0.6"
			/>
		{/if}
		<path d={line(expected, 'hit')} fill="none" stroke={C.hit} stroke-width="1.3" opacity="0.75" />
		<path
			d={line(expected, 'miss')}
			fill="none"
			stroke={C.miss}
			stroke-width="1.3"
			opacity="0.75"
		/>
		{#if n > 1}
			<path
				d={line(measured, 'hit')}
				fill="none"
				stroke={C.hit}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d={line(measured, 'miss')}
				fill="none"
				stroke={C.miss}
				stroke-width="3"
				stroke-linejoin="round"
			/>
		{/if}
	</g>
	{#if n > 0}
		<circle
			cx={sxA(n / M)}
			cy={cy(measuredHit)}
			r="5"
			fill={C.hit}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={sxA(n / M)}
			cy={cy(measuredMiss)}
			r="5"
			fill={C.miss}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- readouts -->
	<Readout
		id="tb-hit"
		order={3}
		label="Found: mean probes"
		value="{f2(measuredHit)} (expected {f2(exp.hit)})"
		color={C.hit}
	>
		<Label
			x={580}
			y={356}
			anchor="start"
			text="found: {f2(measuredHit)} probes"
			size={15}
			weight={700}
			color={C.hitText}
			tabular
		/>
		<Label
			x={580}
			y={376}
			anchor="start"
			text="expected {f2(exp.hit)}{scheme === 'chaining'
				? ` (1 + α/2 ≈ ${f2(1 + n / M / 2)})`
				: ''}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout
		id="tb-miss"
		order={4}
		label="Not found: mean probes"
		value="{f2(measuredMiss)} (expected {f2(exp.miss)})"
		color={C.miss}
	>
		<Label
			x={580}
			y={410}
			anchor="start"
			text="not found: {f2(measuredMiss)} probes{measuredMiss > yMax ? ' (off the chart)' : ''}"
			size={15}
			weight={700}
			color={C.missText}
			tabular
		/>
		<Label x={580} y={430} anchor="start" text="expected {f2(exp.miss)}" size={12} muted tabular />
	</Readout>
	<Readout
		id="tb-longest"
		order={5}
		label={scheme === 'chaining' ? 'Longest chain' : 'Longest run'}
		value={scheme === 'chaining' ? `${longestNow} words` : `${longestNow} slots`}
	>
		<Label
			x={580}
			y={464}
			anchor="start"
			text={scheme === 'chaining'
				? `longest chain: ${longestNow} words`
				: `longest run of taken slots: ${longestNow}`}
			size={13}
			weight={600}
			tabular
		/>
	</Readout>
	<Readout id="tb-legend">
		<line x1="580" x2="606" y1="500" y2="500" stroke="var(--stage-ink)" stroke-width="3" />
		<Label x={614} y={504} anchor="start" text="this table, as it filled" size={11} muted />
		<line
			x1="580"
			x2="606"
			y1="520"
			y2="520"
			stroke="var(--stage-ink)"
			stroke-width="1.3"
			opacity="0.7"
		/>
		<Label x={614} y={524} anchor="start" text="expected for 64 slots (Knuth)" size={11} muted />
		{#if scheme === 'linear'}
			<line
				x1="580"
				x2="606"
				y1="540"
				y2="540"
				stroke="var(--stage-ink)"
				stroke-width="1.2"
				stroke-dasharray="5 4"
				opacity="0.6"
			/>
			<Label
				x={614}
				y={544}
				anchor="start"
				text="large table: ½(1 + 1/(1 − α)), ½(1 + 1/(1 − α)²)"
				size={11}
				muted
			/>
		{/if}
	</Readout>
</g>
