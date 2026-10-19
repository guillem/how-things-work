<script lang="ts">
	/**
	 * The same MurmurHash3 fed only the first L letters of each word (the slider; 6 is the whole
	 * word). Left: 1,024 words chained into 1,024 slots, drawn as a 32 × 32 grid shaded by chain
	 * length, and the share of slots holding 0, 1, 2, … words against the Poisson shares a good
	 * hash gives. Right: 1,000 words in a Bloom filter of 8,000 bits with 6 hashes, its bits, and
	 * the false-positive rate on 2,000 never-added words against the formula. A pulse runs along
	 * the longest chain's cell. Static apart from the pulse; reduced motion holds it still.
	 */
	import { Axes, Label, scale, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		ALL,
		INSERTABLE,
		QUERIES,
		buildBloom,
		buildTable,
		chainHistogram,
		fpApprox,
		hashReading,
		longest,
		meanHit,
		measuredFP,
		poisson
	} from '../model';
	import { C, group, int, memo, pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const L = $derived(int(params, 'letters', 6, 1, 6));
	const reads = $derived(L >= 6 ? ALL : L);
	const M = 1024;
	const BN = 1000;
	const BM = 8000;
	const BK = 6;
	const stateOf = memo((key: string) => {
		const hash = hashReading(Number(key));
		const table = buildTable('chaining', INSERTABLE.slice(0, M), M, { hash });
		const filter = buildBloom(INSERTABLE.slice(0, BN), BM, BK, 0, hash);
		const fp = measuredFP(filter, QUERIES, 0, hash);
		return { table, filter, fp };
	}, 8);
	const st = $derived(stateOf(String(reads)));
	const hist = $derived(chainHistogram(st.table, 8));
	const longestChain = $derived(longest(st.table));
	const longSlot = $derived(st.table.chains.findIndex((c) => c.length === longestChain));
	/** What the longest chain's words share at the start, when the hash reads only a few letters. */
	const shared = $derived.by(() => {
		if (reads >= ALL || longSlot < 0) return '';
		const ws = st.table.chains[longSlot].map((i) => st.table.keys[i]);
		const p = ws[0].slice(0, L);
		return ws.every((w) => w.startsWith(p)) ? p : '';
	});

	// ---- the table grid ------------------------------------------------------------------
	const GX = 40;
	const GY = 96;
	const CELL = 7;
	const LEVELS = [1, 2, 3, 5, 9];
	const SHADES = [0.3, 0.5, 0.7, 0.85, 1];
	/** One path per shade: chains of 1, 2, 3–4, 5–8, 9 or more. */
	const cells = $derived.by(() => {
		const paths = LEVELS.map(() => '');
		st.table.chains.forEach((c, s) => {
			if (!c.length) return;
			let lv = 0;
			while (lv + 1 < LEVELS.length && c.length >= LEVELS[lv + 1]) lv++;
			const x = GX + (s % 32) * CELL;
			const y = GY + Math.floor(s / 32) * CELL;
			paths[lv] += `M${x} ${y}h${CELL - 1}v${CELL - 1}h-${CELL - 1}Z`;
		});
		return paths;
	});
	const pulse = $derived(reduced ? 1 : 0.4 + 0.6 * wave(t, 1.6));

	// ---- histogram -----------------------------------------------------------------------
	const H = { x0: 340, x1: 490, y0: 100, y1: 300 };
	const sxH = scale([-0.5, 8.5], [H.x0, H.x1]);
	const syH = scale([0, 1], [H.y1, H.y0]);
	const expected = Array.from({ length: 9 }, (_, j) =>
		j < 8
			? poisson(1, j)
			: 1 - Array.from({ length: 8 }, (_, i) => poisson(1, i)).reduce((a, b) => a + b, 0)
	);

	// ---- the filter's bits ---------------------------------------------------------------
	const FX = 540;
	const FY = 96;
	const FCOLS = 100;
	const FC = 3.8;
	const bitPath = $derived.by(() => {
		let d = '';
		for (let b = 0; b < BM; b++) {
			if (!st.filter.bits[b]) continue;
			const x = FX + (b % FCOLS) * FC;
			const y = FY + Math.floor(b / FCOLS) * FC;
			d += `M${x.toFixed(1)} ${y.toFixed(1)}h3v3h-3Z`;
		}
		return d;
	});
	const formula = fpApprox(BN, BM, BK);
	const f2 = (x: number) => x.toFixed(2);
</script>

<g>
	<Readout
		id="cl-title"
		order={1}
		label="The hash reads"
		value={L >= 6 ? 'the whole word' : `the first ${L} letter${L > 1 ? 's' : ''}`}
	>
		<Label
			x={40}
			y={44}
			anchor="start"
			text="the hash reads {L >= 6
				? 'the whole word'
				: L === 1
					? 'only the first letter'
					: `only the first ${L} letters`}"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- table -->
	<Label x={GX} y={80} anchor="start" text="1,024 words chained in 1,024 slots" size={12} muted />
	<rect
		x={GX - 2}
		y={GY - 2}
		width={32 * CELL + 3}
		height={32 * CELL + 3}
		fill={C.slot}
		stroke={C.slotEdge}
		stroke-width="0.6"
	/>
	{#each cells as d, i (i)}
		<path {d} fill={C.key} opacity={SHADES[i]} />
	{/each}
	{#if longSlot >= 0}
		<rect
			x={GX + (longSlot % 32) * CELL - 3}
			y={GY + Math.floor(longSlot / 32) * CELL - 3}
			width={CELL + 5}
			height={CELL + 5}
			rx="2"
			fill="none"
			stroke={C.miss}
			stroke-width="2"
			opacity={pulse}
		/>
	{/if}
	<Readout id="cl-shade">
		<Label
			x={GX}
			y={GY + 32 * CELL + 18}
			anchor="start"
			text="stronger green: a longer chain; empty: no word"
			size={11}
			muted
		/>
	</Readout>

	<!-- histogram of chain lengths -->
	<Label x={H.x0 - 20} y={80} anchor="start" text="slots holding j words" size={12} muted />
	<Axes
		sx={sxH}
		sy={syH}
		xTicks={[0, 2, 4, 6, 8]}
		xFormat={(v) => (v === 8 ? '8+' : String(v))}
		yTicks={[0, 0.5, 1]}
		yFormat={(v) => `${Math.round(v * 100)}%`}
	/>
	{#each hist as c, j (j)}
		<rect
			x={sxH(j) - 6}
			y={syH(c / M)}
			width="12"
			height={H.y1 - syH(c / M)}
			fill={C.key}
			opacity="0.8"
		/>
		<circle
			cx={sxH(j)}
			cy={syH(expected[j])}
			r="3.5"
			fill="var(--stage-bg)"
			stroke={C.probe}
			stroke-width="1.8"
		/>
	{/each}
	<Readout id="cl-hist-legend">
		<circle
			cx={H.x0 + 4}
			cy={H.y1 + 40}
			r="3.5"
			fill="var(--stage-bg)"
			stroke={C.probe}
			stroke-width="1.8"
		/>
		<Label
			x={H.x0 + 14}
			y={H.y1 + 44}
			anchor="start"
			text="a good hash (Poisson)"
			size={11}
			muted
		/>
	</Readout>

	<Readout
		id="cl-probes"
		order={2}
		label="Table: mean probes to find a word"
		value="{f2(meanHit(st.table))} (good hash: 1.5)"
		color={C.hit}
	>
		<Label
			x={GX}
			y={400}
			anchor="start"
			text="mean probes to find a word: {f2(meanHit(st.table))}"
			size={14}
			weight={700}
			color={C.hitText}
			tabular
		/>
		<Label x={GX} y={420} anchor="start" text="a good hash: 1 + α/2 = 1.5" size={12} muted />
	</Readout>
	<Readout
		id="cl-longest"
		order={3}
		label="Longest chain"
		value="{longestChain} words{shared ? `, all starting ‘${shared}’` : ''}"
		color={C.miss}
	>
		<Label
			x={GX}
			y={448}
			anchor="start"
			text="longest chain: {longestChain} words{shared ? `, all starting ‘${shared}’` : ''}"
			size={13}
			weight={600}
			color={C.missText}
			tabular
		/>
	</Readout>

	<!-- filter -->
	<Label
		x={FX}
		y={80}
		anchor="start"
		text="1,000 words in a Bloom filter of 8,000 bits, k = 6"
		size={12}
		muted
	/>
	<rect
		x={FX - 2}
		y={FY - 2}
		width={FCOLS * FC + 3}
		height={80 * FC + 3}
		fill={C.slot}
		stroke={C.slotEdge}
		stroke-width="0.6"
	/>
	<path d={bitPath} fill={C.bit} opacity="0.85" />
	<Readout id="cl-bits" order={4} label="Filter: bits set" value="{group(st.filter.ones)} of 8,000">
		<Label
			x={FX}
			y={FY + 80 * FC + 20}
			anchor="start"
			text="bits set: {group(st.filter.ones)} of 8,000 ({pct(st.filter.ones / BM)})"
			size={12}
			tabular
		/>
	</Readout>
	<Readout
		id="cl-fp"
		order={5}
		label="False positives"
		value="{pct(st.fp)} (formula {pct(formula)})"
		color={C.fp}
	>
		<Label
			x={FX}
			y={448}
			anchor="start"
			text="false positives: {pct(st.fp)} of 2,000 never-added words"
			size={14}
			weight={700}
			color={C.fpText}
			tabular
		/>
		<Label
			x={FX}
			y={468}
			anchor="start"
			text="a good hash: (1 − e^(−kn/m))^k = {pct(formula)}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout id="cl-moral">
		<Label
			x={480}
			y={540}
			text="constant time is an average under a good hash, not a guarantee"
			size={13}
			weight={600}
		/>
	</Readout>
</g>
