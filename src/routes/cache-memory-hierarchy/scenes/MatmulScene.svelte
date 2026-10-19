<script lang="ts">
	/**
	 * C = A × B for 120 × 120 matrices on a 4 KB L1 (../model.ts MATMUL, `matmulRun`), in the
	 * textbook order (top) and in b × b tiles of B (bottom, b from the `block` control). Each
	 * picture shows what the loops are working on, sweeping through the product over LOOP
	 * seconds: textbook, row i of A, column j of B and C[i][j]; tiled, the tile of B, the strip
	 * of A it meets, row i of that strip, and the strip of C it adds to. Right, the cycles spent
	 * waiting for memory per multiply-add for every tile size, the textbook order dashed.
	 * Reduced motion: a fixed moment of the sweep.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { MATMUL, matmulRun } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const n = MATMUL.n;
	const b = $derived(Number(params.block ?? 12));
	const naive = $derived(matmulRun(0));
	const tiled = $derived(matmulRun(b));
	const all = $derived(MATMUL.blocks.map((k) => ({ k, r: matmulRun(k) })));

	const LOOP = 14;
	const p = $derived(reduced ? 0.37 : (((Math.max(0, t - 0.5) / LOOP) % 1) + 1) % 1);

	// ---- the matrices ---------------------------------------------------------------------
	const SQ = 108;
	const U = SQ / n;
	const X = [40, 40 + SQ + 34, 40 + 2 * (SQ + 34)];
	const Y_TOP = 112;
	const Y_BOT = 344;

	// textbook: C[i][j] over i, j
	const ni = $derived(Math.floor(p * n));
	const nj = $derived(Math.floor((p * n - ni) * n));
	// tiled: tiles (kk, jj) in order, then i
	const per = $derived(Math.ceil(n / b));
	const tileIx = $derived(Math.floor(p * per * per));
	const kk = $derived(Math.floor(tileIx / per) * b);
	const jj = $derived((tileIx % per) * b);
	const ti = $derived(Math.floor((p * per * per - tileIx) * n));
	const bw = $derived(Math.min(b, n - jj));
	const bh = $derived(Math.min(b, n - kk));

	// ---- chart ----------------------------------------------------------------------------
	const GX0 = 540;
	const GX1 = 920;
	const GY0 = 130;
	const GY1 = 470;
	const sx = scale([-0.5, MATMUL.blocks.length - 0.5], [GX0, GX1]);
	const sy = scale([0, 300], [GY1, GY0]);
	const perOp = (r: { cycles: number; ops: number }) => r.cycles / r.ops;
	const slot = (GX1 - GX0) / MATMUL.blocks.length;
	const fmt = (v: number) => v.toFixed(v < 10 ? 1 : 0);
	const ratio = $derived(naive.tally.misses / tiled.tally.misses);
</script>

<g>
	<Readout id="title" order={1} label="Product" value="120 × 120, 1,728,000 multiply-adds">
		<Label
			x={24}
			y={34}
			text="C = A × B, 120 × 120 · 1,728,000 multiply-adds · 4 KB L1, 8 ways"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>

	{#each [{ y: Y_TOP, name: 'textbook order', tiles: false }, { y: Y_BOT, name: `in ${b} × ${b} tiles of B`, tiles: true }] as row (row.name)}
		<Label x={X[0]} y={row.y - 30} text={row.name} size={13} weight={600} anchor="start" />
		{#each ['C', 'A', 'B'] as m, i (m)}
			<rect
				x={X[i]}
				y={row.y}
				width={SQ}
				height={SQ}
				rx="3"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<Label x={X[i] + SQ / 2} y={row.y - 8} text={m} size={12} weight={600} muted />
		{/each}
		<Label x={X[1] - 17} y={row.y + SQ / 2 + 5} text="=" size={16} muted />
		<Label x={X[2] - 17} y={row.y + SQ / 2 + 5} text="×" size={16} muted />
		{#if !row.tiles}
			<rect x={X[1]} y={row.y + ni * U} width={SQ} height={Math.max(1.5, U)} fill="var(--cm-a)" />
			<rect x={X[2] + nj * U} y={row.y} width={Math.max(1.5, U)} height={SQ} fill="var(--cm-b)" />
			<rect x={X[0] + nj * U - 1} y={row.y + ni * U - 1} width={3} height={3} fill="var(--cm-c)" />
		{:else}
			<rect
				x={X[2] + jj * U}
				y={row.y + kk * U}
				width={bw * U}
				height={bh * U}
				fill="var(--cm-b)"
				opacity="0.85"
			/>
			<rect
				x={X[1] + kk * U}
				y={row.y}
				width={bh * U}
				height={SQ}
				fill="var(--cm-a)"
				opacity="0.25"
			/>
			<rect
				x={X[1] + kk * U}
				y={row.y + ti * U}
				width={bh * U}
				height={Math.max(1.5, U)}
				fill="var(--cm-a)"
			/>
			<rect
				x={X[0] + jj * U}
				y={row.y}
				width={bw * U}
				height={SQ}
				fill="var(--cm-c)"
				opacity="0.25"
			/>
			<rect
				x={X[0] + jj * U}
				y={row.y + ti * U}
				width={bw * U}
				height={Math.max(1.5, U)}
				fill="var(--cm-c)"
			/>
		{/if}
		<Readout
			id={row.tiles ? 'tiled' : 'naive'}
			order={row.tiles ? 3 : 2}
			label={row.tiles ? `Tiles of ${b}` : 'Textbook order'}
			value="{fmt(perOp(row.tiles ? tiled : naive))} cycles per multiply-add"
		>
			<Label
				x={X[0]}
				y={row.y + SQ + 26}
				text="{(
					(100 * (row.tiles ? tiled : naive).tally.misses) /
					(row.tiles ? tiled : naive).tally.accesses
				).toFixed(1)} % of accesses miss · {fmt(
					perOp(row.tiles ? tiled : naive)
				)} cycles waiting per multiply-add"
				size={12}
				weight={600}
				anchor="start"
				color={row.tiles ? 'var(--cm-hit-text)' : 'var(--cm-miss-text)'}
				tabular
			/>
		</Readout>
	{/each}
	<Label
		x={X[0]}
		y={Y_TOP + SQ + 44}
		text="each C[i][j] walks a row of A and a whole column of B"
		size={11}
		anchor="start"
		muted
	/>
	<Label
		x={X[0]}
		y={Y_BOT + SQ + 44}
		text="every row of A passes over one tile of B while it is in the cache"
		size={11}
		anchor="start"
		muted
	/>

	<!-- chart: cycles per multiply-add against tile size -->
	<Axes
		{sx}
		{sy}
		xTicks={MATMUL.blocks.map((_, i) => i)}
		xFormat={(i: number) => `${MATMUL.blocks[i]}`}
		xLabel="tile size b"
		yTicks={[0, 100, 200, 300]}
	/>
	<Label
		x={GX0}
		y={GY0 - 14}
		text="cycles waiting for memory per multiply-add"
		size={11}
		anchor="start"
		muted
	/>
	<line
		x1={GX0}
		x2={GX1}
		y1={sy(perOp(naive))}
		y2={sy(perOp(naive))}
		stroke="var(--cm-miss)"
		stroke-width="1.8"
		stroke-dasharray="6 4"
	/>
	<Label
		x={GX1}
		y={sy(perOp(naive)) - 8}
		text="textbook order: {fmt(perOp(naive))}"
		size={12}
		weight={600}
		anchor="end"
		color="var(--cm-miss-text)"
	/>
	{#each all as d, i (d.k)}
		<rect
			x={sx(i) - slot * 0.32}
			y={sy(perOp(d.r))}
			width={slot * 0.64}
			height={GY1 - sy(perOp(d.r))}
			rx="2"
			fill="var(--cm-hit)"
			opacity={d.k === b ? 1 : 0.4}
		/>
	{/each}
	<Readout id="ratio" order={4} label="Misses, textbook ÷ tiled" value="{ratio.toFixed(0)}×">
		<Label
			x={sx((MATMUL.blocks as readonly number[]).indexOf(b))}
			y={sy(perOp(tiled)) - 10}
			text={fmt(perOp(tiled))}
			size={12}
			weight={600}
			color="var(--cm-hit-text)"
			tabular
		/>
		<Label
			x={GX1}
			y={GY1 + 62}
			text="tiles of {b}: {ratio.toFixed(0)}× fewer misses, same arithmetic"
			size={13}
			weight={600}
			anchor="end"
			tabular
		/>
	</Readout>
</g>
