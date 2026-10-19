<script lang="ts">
	/**
	 * Hops per lookup against network size (../model.ts `hopStats`, SIZES): 2,000 lookups on
	 * Chord rings of 8 to 16,384 nodes; the mean with the band from the 1st to the 99th
	 * percentile, the ½ log₂ N reference (dashed) and the walk along successors (measured, N/2,
	 * off the top of the chart after 32 nodes). The `size` control picks a network, whose
	 * histogram of hop counts is drawn on the right. The points appear one size at a time over
	 * the first seconds (reduced motion: all).
	 */
	import { Axes, Label, areaPath, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { SIZES, hopStats } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const STATS = SIZES.map((n) => hopStats(n, 2000));
	const WALK = SIZES.map((n) => hopStats(n, 300, false).mean);

	const X0 = 96;
	const X1 = 560;
	const Y0 = 100;
	const Y1 = 500;
	const YMAX = 14;
	const sx = scale([3, 14], [X0, X1]);
	const sy = scale([0, YMAX], [Y1, Y0]);
	const lg = (n: number) => Math.log2(n);

	const k = $derived(
		reduced ? SIZES.length : clamp(Math.floor((t - 0.3) * 3) + 1, 0, SIZES.length)
	);
	const shown = $derived(STATS.slice(0, k));
	const meanPath = $derived(
		linePath(
			shown,
			(d) => lg(d.n),
			(d) => d.mean,
			sx,
			sy
		)
	);
	const band = $derived(
		areaPath(
			shown,
			(d) => lg(d.n),
			(d) => d.p1,
			(d) => d.p99,
			sx,
			sy
		)
	);
	const ref = linePath(
		[3, 14],
		(x) => x,
		(x) => x / 2,
		sx,
		sy
	);
	/** The successor walk, up to where it leaves the top of the chart. */
	const walkPath = $derived.by(() => {
		const pts: { x: number; y: number }[] = [];
		for (let i = 0; i < k; i++) {
			const p = { x: lg(SIZES[i]), y: WALK[i] };
			if (p.y <= YMAX) {
				pts.push(p);
				continue;
			}
			const q = pts[pts.length - 1];
			if (q) pts.push({ x: q.x + ((YMAX - q.y) / (p.y - q.y)) * (p.x - q.x), y: YMAX });
			break;
		}
		return linePath(
			pts,
			(p) => p.x,
			(p) => p.y,
			sx,
			sy
		);
	});

	const sel = $derived(Math.max(0, SIZES.indexOf(Math.round(Number(params.size ?? 4096)))));
	const S = $derived(STATS[sel]);
	const visible = $derived(sel < k);

	const HX = 640;
	const HW = 290;
	const HY = 470;
	const HH = 260;
	const HMAX = 13;
	const bw = HW / HMAX;
	const hmax = $derived(Math.max(...S.hist));
	const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<g>
	<Readout id="title" order={1} label="Chord" value="hops per lookup against network size">
		<Label
			x={24}
			y={34}
			text="hops per lookup on Chord rings of 8 to 16,384 nodes · 2,000 lookups each"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="key">
		<line x1={24} x2={52} y1={60} y2={60} stroke="var(--dht-query)" stroke-width="2.6" />
		<Label x={58} y={64} text="mean, with fingers" size={11} anchor="start" muted />
		<rect x={190} y={54} width="28" height="12" fill="var(--dht-query)" opacity="0.2" />
		<Label x={224} y={64} text="98 % of lookups" size={11} anchor="start" muted />
		<line
			x1={340}
			x2={368}
			y1={60}
			y2={60}
			stroke="var(--stage-ink)"
			stroke-dasharray="5 4"
			opacity="0.7"
		/>
		<Label x={374} y={64} text="½ log₂ N" size={11} anchor="start" muted />
		<line x1={452} x2={480} y1={60} y2={60} stroke="var(--dht-node)" stroke-width="2" />
		<Label x={486} y={64} text="successors only" size={11} anchor="start" muted />
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]}
		xFormat={(v: number) => fmt(2 ** v)}
		xLabel="nodes"
		yTicks={[0, 2, 4, 6, 8, 10, 12, 14]}
		yLabel="hops"
	/>
	<path d={band} fill="var(--dht-query)" opacity="0.18" />
	<path d={ref} fill="none" stroke="var(--stage-ink)" stroke-dasharray="5 4" opacity="0.6" />
	<path d={walkPath} fill="none" stroke="var(--dht-node)" stroke-width="2" />
	{#if k > 4}
		<Label
			x={sx(5) + 10}
			y={Y0 + 16}
			text="successors only: N/2 hops, {fmt(Math.round(WALK[WALK.length - 1]))} at 16,384 nodes"
			size={11}
			anchor="start"
			muted
		/>
	{/if}
	<path d={meanPath} fill="none" stroke="var(--dht-query)" stroke-width="2.6" />
	{#each shown as d, i (d.n)}
		<circle
			cx={sx(lg(d.n))}
			cy={sy(d.mean)}
			r={i === sel ? 6 : 3.5}
			fill="var(--dht-query)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}
	{#if visible}
		<line
			x1={sx(lg(S.n))}
			x2={sx(lg(S.n))}
			y1={Y0}
			y2={Y1}
			stroke="var(--dht-query)"
			stroke-dasharray="3 4"
			opacity="0.6"
		/>
	{/if}

	<!-- histogram of the chosen size -->
	<Readout
		id="sel"
		order={2}
		label="{fmt(S.n)} nodes"
		value="mean {S.mean.toFixed(1)} hops, 99 % within {S.p99}"
		color="var(--dht-query)"
	>
		<Label
			x={HX}
			y={120}
			text="{fmt(S.n)} nodes: mean {S.mean.toFixed(1)} hops"
			size={15}
			weight={700}
			anchor="start"
			tabular
		/>
		<Label
			x={HX}
			y={142}
			text="99 % within {S.p99} hops · ½ log₂ N = {(lg(S.n) / 2).toFixed(1)}"
			size={12}
			anchor="start"
			muted
			tabular
		/>
	</Readout>
	<g opacity={visible ? 1 : 0.25}>
		<line x1={HX} x2={HX + HW} y1={HY} y2={HY} stroke="var(--stage-line)" />
		{#each S.hist.slice(0, HMAX) as f, h (h)}
			{@const hgt = (f / hmax) * HH}
			<rect
				x={HX + h * bw + 2}
				y={HY - hgt}
				width={bw - 4}
				height={hgt}
				rx="2"
				fill="var(--dht-query)"
				opacity="0.8"
			/>
			{#if h % 2 === 0}
				<Label x={HX + h * bw + bw / 2} y={HY + 16} text={String(h)} size={11} muted />
			{/if}
		{/each}
		<Label x={HX + HW} y={HY + 34} text="hops" size={11} anchor="end" muted />
		<Readout id="histlabel">
			<Label
				x={HX}
				y={HY - HH - 22}
				text="share of lookups by hop count"
				size={11}
				anchor="start"
				muted
			/>
		</Readout>
	</g>
</g>
