<script lang="ts">
	/**
	 * Four programs at full size on the measured chip's 32 KB L1 and (with the `withL2` toggle)
	 * 256 KB L2 (../model.ts PROGRAMS, `program`): one bar each, as long as the average memory
	 * access time, split into the cycles spent on loads answered by L1, by L2 and by DRAM. The
	 * bars grow in over the first seconds (reduced motion: drawn in full).
	 */
	import { Axes, Label, clamp, easeInOut, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LATENCY, PROGRAMS, program } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const withL2 = $derived(params.withL2 !== false);
	const grow = $derived(reduced ? 1 : easeInOut(clamp((t - 0.4) / 1.6)));
	const rows = $derived(
		PROGRAMS.map((p, i) => {
			const r = program(p.id, withL2);
			const n = r.tally.accesses;
			return {
				...p,
				i,
				amat: r.amat,
				ops: r.ops,
				parts: [
					{
						k: 'L1',
						c: 'var(--cm-l1)',
						v: (r.tally.hits * LATENCY.l1) / n,
						share: r.tally.hits / n
					},
					{
						k: 'L2',
						c: 'var(--cm-l2)',
						v: (r.tally.l2Hits * LATENCY.l2) / n,
						share: r.tally.l2Hits / n
					},
					{
						k: 'DRAM',
						c: 'var(--cm-mem)',
						v: (r.tally.memory * LATENCY.mem) / n,
						share: r.tally.memory / n
					}
				]
			};
		})
	);

	const X0 = 260;
	const X1 = 860;
	const sx = scale([0, 260], [X0, X1]);
	const rowY = (i: number) => 120 + i * 104;
	const H = 40;
	const pct = (v: number) => (v > 0 && v < 0.001 ? '<0.1' : (100 * v).toFixed(1));
	const desc = (id: string) =>
		id === 'row' || id === 'col' ? '1,048,576 additions, 8 MB' : '262,144 nodes, 4 MB';
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Caches"
		value={withL2 ? '32 KB L1, 256 KB L2, then DRAM' : '32 KB L1, then DRAM'}
	>
		<Label
			x={24}
			y={34}
			text="average memory access time · {withL2
				? '32 KB L1 + 256 KB L2'
				: '32 KB L1 only'}, then DRAM"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		{#each ['L1 · 4 cycles', withL2 ? 'L2 · 12 cycles' : '', 'DRAM · 250 cycles'] as k, i (i)}
			{#if k}
				<rect
					x={24 + i * 200}
					y={52}
					width="12"
					height="12"
					rx="2"
					fill={['var(--cm-l1)', 'var(--cm-l2)', 'var(--cm-mem)'][i]}
				/>
				<Label x={42 + i * 200} y={62} text="answered by {k}" size={11} anchor="start" muted />
			{/if}
		{/each}
	</Readout>

	<Axes
		{sx}
		sy={scale([0, 1], [rowY(3) + H + 24, rowY(0) - 24])}
		xTicks={[0, 50, 100, 150, 200, 250]}
		yTicks={[]}
		xLabel="cycles per load"
	/>

	{#each rows as r (r.id)}
		<Label x={X0 - 14} y={rowY(r.i) + 16} text={r.label} size={13} weight={600} anchor="end" />
		<Label x={X0 - 14} y={rowY(r.i) + 33} text={desc(r.id)} size={11} anchor="end" muted />
		{#each r.parts as part, j (part.k)}
			{#if part.v > 0}
				<rect
					x={sx(r.parts.slice(0, j).reduce((s, q) => s + q.v, 0) * grow)}
					y={rowY(r.i)}
					width={Math.max(0, sx(part.v * grow) - X0)}
					height={H}
					fill={part.c}
					opacity="0.85"
				/>
			{/if}
		{/each}
		<Readout id={r.id} order={2 + r.i} label={r.label} value="{r.amat.toFixed(0)} cycles per load">
			<Label
				x={Math.min(sx(r.amat * grow) + 8, 936 - 4)}
				y={rowY(r.i) + 26}
				text="{r.amat.toFixed(0)} cycles"
				size={14}
				weight={700}
				anchor={sx(r.amat) + 90 > 936 ? 'end' : 'start'}
				halo
				tabular
			/>
			<Label
				x={X0 + 6}
				y={rowY(r.i) + H + 16}
				text="loads answered: L1 {pct(r.parts[0].share)} %{withL2
					? ` · L2 ${pct(r.parts[1].share)} %`
					: ''} · DRAM {pct(r.parts[2].share)} %"
				size={11}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{/each}
</g>
