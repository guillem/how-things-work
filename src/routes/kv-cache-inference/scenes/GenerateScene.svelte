<script lang="ts">
	/**
	 * The tiny GPT writing after "ROMEO:", one character at a time.
	 *
	 * Modes (`step.hints.mode`):
	 *   recompute — every step runs the whole window again: the grid of keys and values (one row
	 *               per layer, one column per position) is all computed anew, and the bars of
	 *               counted FLOPs per character grow with the position.
	 *   cache     — the earlier keys and values are read from the cache (orange); only the newest
	 *               column is computed and stored. The cached bars stay low beside the faint
	 *               recomputation bars.
	 *   compare   — the generation run twice in the page, recomputing (the training page's model)
	 *               and with the cache: the same characters, the largest difference of their
	 *               probabilities, and the totals of arithmetic and of bytes read.
	 *
	 * Motion: the characters appear at 6 a second (a pure function of t), the whole text holds for
	 * 3 s, then it is written again. Reduced motion shows the finished text.
	 */
	import { Axes, clamp, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		bytesMoved,
		compare,
		flops,
		generation,
		PROMPT,
		SEEDS,
		totals as totalsOf
	} from '../tiny';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(
		String(step.hints?.mode ?? 'recompute') as 'recompute' | 'cache' | 'compare'
	);
	const seed = $derived(SEEDS[Math.abs(Math.round(Number(params.seed ?? 0))) % SEEDS.length]);
	const rows = $derived(generation(seed));
	const comparison = $derived(mode === 'compare' ? compare(seed) : null);
	const N = $derived(rows.length);

	const RATE = 6;
	const HOLD = 3;
	const period = $derived(N / RATE + HOLD);
	/** Index of the character being written (into `rows`). */
	const k = $derived.by(() => {
		if (reduced) return N - 1;
		const u = t % period;
		return clamp(Math.floor(u * RATE), 0, N - 1);
	});
	/** Brightness of this step's fresh work: a flash when a character starts. */
	const flash = $derived(reduced ? 1 : 1 - 0.45 * smoothstep(0, 1, ((t % period) * RATE) % 1));
	const fadeIn = $derived(reduced ? 1 : smoothstep(0, 0.4, t));

	const show = (c: string) => (c === '\n' ? '↵' : c === ' ' ? '·' : c);
	const fmt = (v: number, d = 0) =>
		v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
	const big = (v: number) =>
		v >= 1e6 ? `${fmt(v / 1e6, 2)} M` : v >= 1e3 ? `${fmt(v / 1e3, 1)} k` : fmt(v);
	const kb = (v: number) => `${fmt(v / 1000, 1)} kB`;

	// ---- layout -------------------------------------------------------------------------
	const X0 = 104;
	const CW = 12.6;
	const COLS = 65;
	const cx = (i: number) => X0 + i * CW + CW / 2;
	const prompt = Array.from(PROMPT);
	const text = $derived([...prompt, ...rows.map((r) => r.char)]);
	const row = $derived(rows[k]);
	/** Position of the character being written; positions 0 … p − 1 are run this step. */
	const p = $derived(row.position);

	const CHIP_Y = 56;
	const GRID_Y = [128, 164];
	const CELL_H = 28;
	const sx = scale([-0.5, COLS - 0.5], [X0, X0 + COLS * CW]);
	const Y_MAX = 4.2e6;
	const sy = scale([0, Y_MAX], [512, 262]);
	const yTicks = [0, 1e6, 2e6, 3e6, 4e6];
	const yFmt = (v: number) => (v === 0 ? '0' : `${fmt(v / 1e6)} M`);
	const xTicks = [0, 16, 32, 48, 64];

	function bars(get: (i: number) => number, upto: number, w: number, dx: number) {
		let d = '';
		for (let j = 0; j <= upto; j++) {
			const r = rows[j];
			const y = sy(get(j));
			d += `M${cx(r.position) - w / 2 + dx} ${sy(0)} V${y} h${w} V${sy(0)} Z`;
		}
		return d;
	}
	const recomputeBars = $derived(bars((j) => flops(rows[j].recompute), k, CW * 0.7, 0));
	const cachedBars = $derived(bars((j) => flops(rows[j].cached), k, CW * 0.7, 0));

	// ---- compare --------------------------------------------------------------------------
	const totals = $derived(totalsOf(rows));
	const BAR_X = 330;
	const BAR_W = 440;
</script>

<g opacity={fadeIn}>
	<defs>
		<pattern id="gen-cells" x={X0} y="0" width={CW} height="600" patternUnits="userSpaceOnUse">
			<line x1="0" x2="0" y1="0" y2="600" stroke="var(--stage-bg)" stroke-width="1.6" />
		</pattern>
	</defs>

	{#if mode !== 'compare'}
		<!-- the text so far -->
		<Readout id="title" order={0} label="Writing" value="character {k + 1} of {N}">
			<Label
				x={X0 - 6}
				y={34}
				anchor="start"
				size={14}
				weight={700}
				text="The tiny GPT writing after “ROMEO:”"
			/>
			<Label
				x={X0 + COLS * CW}
				y={34}
				anchor="end"
				size={13}
				tabular
				text="character {k + 1} of {N}, at position {p}"
			/>
		</Readout>
		<rect
			x={X0}
			y={CHIP_Y}
			width={COLS * CW}
			height="26"
			rx="4"
			fill="var(--kv-chip)"
			stroke="var(--border)"
		/>
		<rect
			x={X0 + p * CW}
			y={CHIP_Y}
			width={CW}
			height="26"
			rx="3"
			fill="var(--kv-compute)"
			opacity={0.35 + 0.4 * flash}
		/>
		{#each text as c, i (i)}
			{#if i <= p}
				<text
					x={cx(i)}
					y={CHIP_Y + 18}
					text-anchor="middle"
					font-family="ui-monospace, monospace"
					font-size="13"
					fill={i < prompt.length ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}
					font-weight={i === p ? 700 : 400}>{show(c)}</text
				>
			{/if}
		{/each}
		<Readout id="ticks">
			{#each xTicks as i (i)}
				<Label x={cx(i)} y={102} size={11} muted halo={false} text={String(i)} />
			{/each}
		</Readout>

		<!-- keys and values: one row per layer, one column per position -->
		{#each GRID_Y as gy, l (l)}
			<Readout id="layer-{l}">
				<Label x={X0 - 8} y={gy + 18} anchor="end" size={12} text="layer {l + 1}" />
			</Readout>
			<rect
				x={X0}
				y={gy}
				width={COLS * CW}
				height={CELL_H}
				rx="3"
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="2 3"
			/>
			{#if mode === 'recompute'}
				<rect
					x={X0}
					y={gy}
					width={p * CW}
					height={CELL_H}
					fill="var(--kv-compute)"
					opacity={0.3 + 0.5 * flash}
				/>
			{:else}
				<rect
					x={X0}
					y={gy}
					width={(p - 1) * CW}
					height={CELL_H}
					fill="var(--kv-cache)"
					opacity="0.45"
				/>
				<rect
					x={X0 + (p - 1) * CW}
					y={gy}
					width={CW}
					height={CELL_H}
					fill="var(--kv-compute)"
					opacity={0.4 + 0.6 * flash}
				/>
			{/if}
			<rect x={X0} y={gy} width={p * CW} height={CELL_H} fill="url(#gen-cells)" />
		{/each}
		<Readout
			id="grid-key"
			order={1}
			label="Keys and values"
			value={mode === 'recompute'
				? `all ${p} positions computed again, in both layers`
				: `1 position computed, ${p - 1} read from the cache`}
		>
			<rect x={X0} y={204} width="12" height="12" rx="2" fill="var(--kv-compute)" />
			<Label
				x={X0 + 18}
				y={214}
				anchor="start"
				size={12}
				halo={false}
				text={mode === 'recompute'
					? `keys and values computed this step: all ${p} positions, again`
					: 'computed this step and added to the cache'}
			/>
			{#if mode === 'cache'}
				<rect x={X0 + 330} y={204} width="12" height="12" rx="2" fill="var(--kv-cache)" />
				<Label
					x={X0 + 348}
					y={214}
					anchor="start"
					size={12}
					halo={false}
					text="kept from earlier steps, read from the cache ({p - 1})"
				/>
			{/if}
		</Readout>

		<!-- FLOPs per character -->
		<Axes
			{sx}
			{sy}
			{xTicks}
			{yTicks}
			yFormat={yFmt}
			xLabel="position"
			yLabel="FLOPs per character"
		/>
		<path
			d={recomputeBars}
			fill="var(--kv-recompute)"
			opacity={mode === 'recompute' ? 0.85 : 0.25}
		/>
		{#if mode === 'cache'}
			<path d={cachedBars} fill="var(--kv-compute)" />
			<Label
				x={cx(40)}
				y={sy(flops(row.cached)) - 22}
				size={12}
				weight={600}
				color="var(--kv-compute)"
				pill
				text="with the cache: {big(flops(rows[0].cached))} → {big(flops(rows[N - 1].cached))}"
			/>
			<Label
				x={cx(10)}
				y={sy(3.4e6)}
				anchor="start"
				size={12}
				muted
				text="recomputing (faint): up to {big(flops(rows[N - 1].recompute))}"
			/>
		{/if}

		{#if mode === 'recompute'}
			<Readout
				id="now"
				order={2}
				label="This character"
				value="{big(flops(row.recompute))} FLOPs, {kb(bytesMoved(row.recompute))} of weights read"
			>
				<Label
					x={X0}
					y={580}
					anchor="start"
					size={13}
					tabular
					text="this character: {big(flops(row.recompute))} FLOPs (all {p} positions), {kb(
						bytesMoved(row.recompute)
					)} of weights read"
				/>
			</Readout>
		{:else}
			<Readout
				id="now"
				order={2}
				label="With the cache"
				value="{big(flops(row.cached))} FLOPs (recomputing: {big(flops(row.recompute))})"
				color="var(--kv-compute)"
			>
				<Label
					x={X0}
					y={572}
					anchor="start"
					size={13}
					tabular
					text="this character with the cache: {big(flops(row.cached))} FLOPs, recomputing: {big(
						flops(row.recompute)
					)}"
				/>
			</Readout>
			<Readout
				id="bytes"
				order={3}
				label="Bytes read"
				value="{kb(row.cached.weightBytes)} of weights + {kb(row.cached.cacheBytes)} of cache"
			>
				<Label
					x={X0}
					y={592}
					anchor="start"
					size={12}
					muted
					tabular
					text="bytes read: {kb(row.cached.weightBytes)} of weights + {kb(
						row.cached.cacheBytes
					)} of cache (recomputing: {kb(row.recompute.weightBytes)} of weights)"
				/>
			</Readout>
		{/if}
	{:else if comparison}
		{@const c = comparison}
		{@const lines = [
			{
				id: 'rec',
				y: 74,
				title: 'recomputing the whole window (the training page’s model)',
				s: c.recomputed
			},
			{ id: 'kv', y: 154, title: 'with the KV cache', s: c.cached }
		]}
		{#each lines as ln (ln.id)}
			<Readout id="title-{ln.id}">
				<Label
					x={X0 - 6}
					y={ln.y - 14}
					anchor="start"
					size={13}
					weight={600}
					color={ln.id === 'rec' ? 'var(--kv-recompute)' : 'var(--kv-compute)'}
					text={ln.title}
				/>
			</Readout>
			<rect
				x={X0}
				y={ln.y}
				width={COLS * CW}
				height="26"
				rx="4"
				fill="var(--kv-chip)"
				stroke="var(--border)"
			/>
			{#each [...prompt, ...Array.from(ln.s)] as ch, i (i)}
				{#if i <= p}
					<text
						x={cx(i)}
						y={ln.y + 18}
						text-anchor="middle"
						font-family="ui-monospace, monospace"
						font-size="13"
						fill={i < prompt.length ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}
						>{show(ch)}</text
					>
				{/if}
			{/each}
		{/each}
		<Readout
			id="same"
			order={1}
			label="Characters that agree"
			value="{c.cached === c.recomputed ? N : 0} of {N}"
		>
			<Label
				x={480}
				y={216}
				size={15}
				weight={700}
				text={c.cached === c.recomputed ? `the same ${N} characters` : 'the two texts differ'}
			/>
		</Readout>
		<Readout
			id="diff"
			order={2}
			label="Largest difference in probability"
			value={c.maxDiff === 0 ? '0 (the same to the last bit)' : c.maxDiff.toExponential(1)}
		>
			<Label
				x={480}
				y={240}
				size={13}
				tabular
				text="largest difference between their probabilities, over every position and character: {c.maxDiff ===
				0
					? '0, to the last bit'
					: c.maxDiff.toExponential(1)}"
			/>
		</Readout>

		<!-- totals over the whole generation -->
		{@const groups = [
			{
				id: 'flops',
				y: 300,
				title: `arithmetic, all ${N} characters, prompt included`,
				r: totals.fr,
				k: totals.fc,
				f: big,
				unit: 'FLOPs'
			},
			{
				id: 'bytes',
				y: 430,
				title: 'bytes moved to and from memory, all characters',
				r: totals.br,
				k: totals.bc,
				f: (v: number) => `${fmt(v / 1e6, 1)} MB`,
				unit: ''
			}
		]}
		{#each groups as g (g.id)}
			{@const m = Math.max(g.r, g.k)}
			<Readout
				id="total-{g.id}"
				order={3}
				label={g.id === 'flops' ? 'Arithmetic in total' : 'Bytes moved in total'}
				value="{g.f(g.r)} recomputing, {g.f(g.k)} cached"
			>
				<Label x={X0 - 6} y={g.y} anchor="start" size={14} weight={700} text={g.title} />
				{#each [{ id: 'r', v: g.r, label: 'recomputing', color: 'var(--kv-recompute)' }, { id: 'k', v: g.k, label: 'with the cache', color: 'var(--kv-compute)' }] as b, j (b.id)}
					{@const y = g.y + 18 + j * 40}
					<Label x={BAR_X - 12} y={y + 18} anchor="end" size={13} text={b.label} />
					<rect
						x={BAR_X}
						{y}
						width={Math.max(2, (BAR_W * b.v) / m) * smoothstep(0.3, 1.2, reduced ? 2 : t)}
						height="26"
						rx="3"
						fill={b.color}
						opacity="0.85"
					/>
					<Label
						x={BAR_X + Math.max(2, (BAR_W * b.v) / m) + 8}
						y={y + 18}
						anchor="start"
						size={13}
						weight={600}
						tabular
						text="{g.f(b.v)}{g.unit ? ' ' + g.unit : ''}"
					/>
				{/each}
			</Readout>
		{/each}
		<Readout
			id="ratio"
			order={4}
			label="The cache"
			value="{fmt(totals.fr / totals.fc, 0)} times less arithmetic, {fmt(
				(100 * (totals.bc - totals.br)) / totals.br,
				0
			)}% more bytes moved"
		>
			<Label
				x={480}
				y={572}
				size={13}
				muted
				text="with the cache: {fmt(totals.fr / totals.fc, 0)} times less arithmetic, and {fmt(
					(100 * (totals.bc - totals.br)) / totals.br,
					0
				)}% more bytes moved (weights and cache read every step, new keys and values written)"
			/>
		</Readout>
	{/if}
</g>
