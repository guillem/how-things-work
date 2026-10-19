<script lang="ts">
	/**
	 * 1,000 words in a Bloom filter of m = (bits per word) × 1,000 bits with k hash functions (the
	 * sliders). Left: the bit array, set bits filled; every 1.2 s one of the 2,000 never-added words
	 * is asked about, its k bits ringed, with the verdict. Right: the false-positive rate against
	 * k on a log scale: the formula (1 − e^(−kn/m))^k as a curve, the rate measured over the 2,000
	 * words for each k as dots, the slider's k enlarged, and the optimum (m/n) ln 2 marked.
	 * Reduced motion shows the first query.
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		INSERTABLE,
		MEAN_WORD_LENGTH,
		QUERIES,
		bitsOf,
		buildBloom,
		fpApprox,
		kOptimal,
		measuredFP
	} from '../model';
	import { C, group, int, memo, pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const N = 1000;
	const K_MAX = 12;
	const bpk = $derived(int(params, 'bitsPerKey', 8, 1, 20));
	const k = $derived(int(params, 'fpK', 3, 1, K_MAX));
	const m = $derived(bpk * N);
	const WORDS = INSERTABLE.slice(0, N);
	const filterOf = memo((key: string) => {
		const [mm, kk] = key.split('|').map(Number);
		return buildBloom(WORDS, mm, kk);
	}, 30);
	const filter = $derived(filterOf(`${m}|${k}`));
	const measuredOf = memo((key: string) => {
		const mm = Number(key);
		return Array.from({ length: K_MAX }, (_, i) => measuredFP(filterOf(`${mm}|${i + 1}`), QUERIES));
	}, 24);
	const measured = $derived(measuredOf(String(m)));
	const fpNow = $derived(measured[k - 1]);
	const approxNow = $derived(fpApprox(N, m, k));
	const kOpt = $derived(kOptimal(N, m));

	// ---- the bit grid --------------------------------------------------------------------
	const G = { x0: 40, y0: 96, w: 400, h: 250 };
	const grid = $derived.by(() => {
		const cell = Math.sqrt((G.w * G.h) / m);
		const cols = Math.max(1, Math.floor(G.w / cell));
		const rows = Math.ceil(m / cols);
		const cw = G.w / cols;
		const ch = Math.min(cw, G.h / rows);
		return { cols, rows, cw, ch };
	});
	const cellXY = (b: number) => ({
		x: G.x0 + (b % grid.cols) * grid.cw,
		y: G.y0 + Math.floor(b / grid.cols) * grid.ch
	});
	const setPath = $derived.by(() => {
		let d = '';
		const w = Math.max(0.5, grid.cw - (grid.cw > 4 ? 0.8 : 0)).toFixed(2);
		const h = Math.max(0.5, grid.ch - (grid.ch > 4 ? 0.8 : 0)).toFixed(2);
		for (let b = 0; b < m; b++) {
			if (!filter.bits[b]) continue;
			const { x, y } = cellXY(b);
			d += `M${x.toFixed(1)} ${y.toFixed(1)}h${w}v${h}h-${w}Z`;
		}
		return d;
	});

	// ---- a query being asked -------------------------------------------------------------
	const ASK = 1.2;
	const q = $derived(reduced ? 0 : Math.floor(t / ASK));
	const qWord = $derived(QUERIES[(q * 7) % QUERIES.length]);
	const qBits = $derived(bitsOf(qWord, m, k));
	const qMaybe = $derived(qBits.every((b) => filter.bits[b] === 1));

	// ---- the chart -----------------------------------------------------------------------
	const R = { x0: 560, x1: 920, y0: 96, y1: 346 };
	const sxK = scale([1, K_MAX], [R.x0, R.x1]);
	const LOG_MIN = -4;
	const syF = scale([LOG_MIN, 0], [R.y1, R.y0]);
	const lg = (p: number) => Math.max(LOG_MIN, Math.log10(Math.max(1e-12, p)));
	const curve = $derived(
		Array.from({ length: 111 }, (_, i) => {
			const kk = 1 + (i / 110) * (K_MAX - 1);
			return { k: kk, f: lg(fpApprox(N, m, kk)) };
		})
	);
	const yFmt = (v: number) => ['0.01%', '0.1%', '1%', '10%', '100%'][v - LOG_MIN] ?? '';
	const wordBits = Math.round((MEAN_WORD_LENGTH + 1) * 8);
	const fpCount = $derived(Math.round(fpNow * QUERIES.length));
</script>

<g>
	<Readout
		id="fp-title"
		order={1}
		label="Filter"
		value="{group(N)} words in {group(m)} bits, k = {k}"
	>
		<Label
			x={40}
			y={44}
			anchor="start"
			text="{group(N)} words in {group(m)} bits ({bpk} per word), k = {k}"
			size={15}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="fp-ones" order={5} label="Bits set" value={pct(filter.ones / m)}>
		<Label
			x={40}
			y={76}
			anchor="start"
			text="{pct(filter.ones / m)} of the bits are 1"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- bits -->
	<rect
		x={G.x0}
		y={G.y0}
		width={G.w}
		height={grid.rows * grid.ch}
		fill={C.slot}
		stroke={C.slotEdge}
		stroke-width="0.6"
	/>
	<path d={setPath} fill={C.bit} opacity="0.85" />
	{#each qBits as b, i (i)}
		{@const p = cellXY(b)}
		<circle
			cx={p.x + grid.cw / 2}
			cy={p.y + grid.ch / 2}
			r={Math.max(5, grid.cw)}
			fill="none"
			stroke={filter.bits[b] ? C.fp : C.absent}
			stroke-width="2.2"
		/>
	{/each}
	<Readout
		id="fp-query"
		order={4}
		label="Asked ‘{qWord}’"
		value={qMaybe ? 'all bits 1: a false positive' : 'a 0 bit: definitely absent'}
		color={qMaybe ? C.fp : C.absent}
	>
		<Label
			x={G.x0}
			y={G.y0 + grid.rows * grid.ch + 26}
			anchor="start"
			text="asked ‘{qWord}’ (never added): {qMaybe
				? `all ${k} bits are 1, a false positive`
				: 'a 0 among its bits, definitely absent'}"
			size={12}
			weight={600}
			color={qMaybe ? C.fpText : C.absentText}
		/>
	</Readout>

	<!-- chart -->
	<Label
		x={R.x0 - 50}
		y={R.y0 - 22}
		anchor="start"
		text="false positives against k"
		size={13}
		weight={700}
	/>
	<Axes
		sx={sxK}
		sy={syF}
		xTicks={[1, 2, 4, 6, 8, 10, 12]}
		yTicks={[-4, -3, -2, -1, 0]}
		yFormat={yFmt}
		xLabel="hash functions k"
	/>
	{#if kOpt >= 1 && kOpt <= K_MAX}
		<line
			x1={sxK(kOpt)}
			x2={sxK(kOpt)}
			y1={R.y0}
			y2={R.y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
			stroke-width="1"
		/>
		<Label
			x={clamp(sxK(kOpt), R.x0 + 70, R.x1 - 70)}
			y={R.y0 - 4}
			text="best k = (m/n) ln 2 = {kOpt.toFixed(1)}"
			size={11}
			muted
		/>
	{:else}
		<Label
			x={R.x1}
			y={R.y0 - 4}
			anchor="end"
			text="best k = (m/n) ln 2 = {kOpt.toFixed(1)}, off the chart"
			size={11}
			muted
		/>
	{/if}
	<path
		d={linePath(
			curve,
			(d) => d.k,
			(d) => d.f,
			sxK,
			syF
		)}
		fill="none"
		stroke={C.miss}
		stroke-width="2"
	/>
	{#each measured as f, i (i)}
		{@const zero = f === 0}
		<circle
			cx={sxK(i + 1)}
			cy={syF(lg(f))}
			r={i + 1 === k ? 7 : 4}
			fill={zero ? 'var(--stage-bg)' : C.fp}
			stroke={C.fp}
			stroke-width="1.5"
		/>
	{/each}

	<!-- readouts -->
	<Readout
		id="fp-measured"
		order={2}
		label="Measured"
		value="{fpCount} of {group(QUERIES.length)}: {pct(fpNow)}"
		color={C.fp}
	>
		<Label
			x={R.x0 - 50}
			y={410}
			anchor="start"
			text="measured: {fpCount} of {group(QUERIES.length)} never-added words said “maybe”, {pct(
				fpNow
			)}"
			size={13}
			weight={700}
			color={C.fpText}
			tabular
		/>
	</Readout>
	<Readout id="fp-formula" order={3} label="Formula" value={pct(approxNow)} color={C.miss}>
		<Label
			x={R.x0 - 50}
			y={432}
			anchor="start"
			text="formula (1 − e^(−kn/m))^k: {pct(approxNow)}"
			size={13}
			weight={600}
			color={C.missText}
			tabular
		/>
	</Readout>
	<Readout
		id="fp-memory"
		order={6}
		label="Memory"
		value="{bpk} bits a word; the words: about {wordBits} bits each"
	>
		<Label
			x={R.x0 - 50}
			y={474}
			anchor="start"
			text="memory: {bpk} bit{bpk === 1 ? '' : 's'} a word, {group(m / 8)} bytes in all"
			size={12}
			tabular
		/>
		<Label
			x={R.x0 - 50}
			y={494}
			anchor="start"
			text="the words themselves: about {wordBits} bits each, {group((N * wordBits) / 8)} bytes"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout id="fp-legend">
		<line x1={R.x0 - 50} x2={R.x0 - 24} y1="530" y2="530" stroke={C.miss} stroke-width="2" />
		<Label x={R.x0 - 16} y={534} anchor="start" text="formula" size={11} muted />
		<circle cx={R.x0 + 70} cy="530" r="4" fill={C.fp} />
		<Label
			x={R.x0 + 80}
			y={534}
			anchor="start"
			text="measured on 2,000 words (hollow: none)"
			size={11}
			muted
		/>
	</Readout>
</g>
