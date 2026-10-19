<script lang="ts">
	/**
	 * Latency against working-set size (../model.ts WORKING_SETS, `workingSet`): pointer chasing
	 * in a random cycle (solid) and summing in order (dashed), each the mean cycles per load of a
	 * second lap, on the 32 KB L1 alone or with an L2 (`l2` toggle, `l2size`). Log scales on
	 * both axes; dashed verticals mark the cache sizes. The measurement sweeps from small sets
	 * to large ones over the first seconds (reduced motion: the whole curve).
	 */
	import { Axes, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { L1, LATENCY, WORKING_SETS, bytes, l2Config, workingSet } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const hasL2 = $derived(params.l2 === true);
	const l2size = $derived(Number(params.l2size ?? 256 * 1024));
	const l2 = $derived(hasL2 ? l2Config(l2size) : null);
	const chase = $derived(WORKING_SETS.map((w) => ({ w, a: workingSet(w, 'chase', l2) })));
	const sum = $derived(WORKING_SETS.map((w) => ({ w, a: workingSet(w, 'sum', l2) })));
	const k = $derived(
		reduced ? WORKING_SETS.length : clamp(Math.floor((t - 0.4) * 3) + 1, 0, WORKING_SETS.length)
	);

	const X0 = 110;
	const X1 = 900;
	const Y0 = 110;
	const Y1 = 500;
	const sx = scale([10, 23], [X0, X1]);
	const sy = scale([Math.log10(2), Math.log10(400)], [Y1, Y0]);
	const lx = (w: number) => sx(Math.log2(w));
	const ly = (a: number) => sy(Math.log10(a));
	const chasePath = $derived(
		linePath(
			chase.slice(0, k),
			(d) => Math.log2(d.w),
			(d) => Math.log10(d.a),
			sx,
			sy
		)
	);
	const sumPath = $derived(
		linePath(
			sum.slice(0, k),
			(d) => Math.log2(d.w),
			(d) => Math.log10(d.a),
			sx,
			sy
		)
	);
	const last = $derived(k > 0 ? chase[k - 1] : null);
	const sizeLabel = (e: number) => bytes(Math.pow(2, e));
	/** The biggest working set that stays off DRAM, once the sweep has passed the step. */
	const firstSlow = $derived(chase.findIndex((d) => d.a >= LATENCY.mem));
	const knee = $derived(firstSlow > 0 && k > firstSlow ? chase[firstSlow - 1].w : 0);
	const marks = $derived([
		{ id: 'l1', w: L1.size, name: 'L1 32 KB', c: 'var(--cm-l1)' },
		...(hasL2 ? [{ id: 'l2', w: l2size, name: `L2 ${bytes(l2size)}`, c: 'var(--cm-l2)' }] : [])
	]);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Caches"
		value={hasL2 ? `32 KB L1 + ${bytes(l2size)} L2` : '32 KB L1 only'}
	>
		<Label
			x={24}
			y={34}
			text="cycles per load against the size of the data · {hasL2
				? `32 KB L1 + ${bytes(l2size)} L2`
				: '32 KB L1 only'}, then DRAM"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={52} y1={58} y2={58} stroke="var(--cm-a)" stroke-width="2.4" />
		<Label x={58} y={62} text="chasing pointers in random order" size={11} anchor="start" muted />
		<line
			x1={300}
			x2={328}
			y1={58}
			y2={58}
			stroke="var(--cm-b)"
			stroke-width="2.4"
			stroke-dasharray="6 4"
		/>
		<Label x={334} y={62} text="summing in order" size={11} anchor="start" muted />
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]}
		xFormat={sizeLabel}
		xLabel="data size"
		yTicks={[LATENCY.l1, LATENCY.l2, 35, 100, LATENCY.mem].map(Math.log10)}
		yFormat={(v: number) => `${Math.round(Math.pow(10, v))}`}
	/>
	{#each marks as m (m.id)}
		<line
			x1={lx(m.w)}
			x2={lx(m.w)}
			y1={Y0}
			y2={Y1}
			stroke={m.c}
			stroke-dasharray="4 4"
			stroke-width="1.5"
		/>
		<Label
			x={lx(m.w) + 6}
			y={Y0 + 12}
			text={m.name}
			size={12}
			weight={600}
			anchor="start"
			color={m.c}
		/>
	{/each}
	<path d={sumPath} fill="none" stroke="var(--cm-b)" stroke-width="2.4" stroke-dasharray="6 4" />
	<path d={chasePath} fill="none" stroke="var(--cm-a)" stroke-width="2.6" />
	{#each chase.slice(0, k) as d (d.w)}
		<circle cx={lx(d.w)} cy={ly(d.a)} r="3" fill="var(--cm-a)" />
	{/each}
	{#if knee}
		<Readout id="knee" order={3} label="Every load from DRAM" value="past {bytes(knee)}">
			<Label
				x={lx(knee) - 10}
				y={ly(LATENCY.mem) + 4}
				text="every load from DRAM past {bytes(knee)}"
				size={12}
				weight={600}
				anchor="end"
				color="var(--cm-mem)"
			/>
		</Readout>
	{/if}
	{#if last}
		<Readout
			id="now"
			order={2}
			label="Measured"
			value="{bytes(last.w)}: {last.a.toFixed(0)} cycles a load"
		>
			<Label
				x={Math.min(lx(last.w), X1 - 4)}
				y={ly(last.a) + (last.a > 100 ? 26 : -14)}
				text="{bytes(last.w)}: {last.a.toFixed(0)} cycles"
				size={13}
				weight={600}
				anchor={lx(last.w) > X1 - 120 ? 'end' : 'middle'}
				tabular
			/>
		</Readout>
	{/if}
</g>
