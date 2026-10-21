<script lang="ts">
	/**
	 * How often the fire crosses, against how thickly the forest is planted: the share of forests of
	 * the chosen size whose tipping density (the model's `thresholds`, one forest at a time) lies
	 * below each density. The 50 × 50 line stays in grey for comparison, and a dashed line marks the
	 * tipping point of an endlessly big forest, 59.27 (Newman & Ziff 2000).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { atShare, CHART_FORESTS, chanceToCross, thresholds } from '../model';

	let { params }: StageProps = $props();

	const size = $derived(Number(params.size ?? 50));
	const sorted = $derived(thresholds(size, CHART_FORESTS[size] ?? 100));
	const base = thresholds(50, CHART_FORESTS[50]);

	const sx = scale([0.3, 0.8], [150, 880]);
	const sy = scale([0, 1], [500, 150]);
	const xs = Array.from({ length: 201 }, (_, k) => 0.3 + (k / 200) * 0.5);
	const line = (s: Float64Array) =>
		linePath(
			xs,
			(p) => p,
			(p) => chanceToCross(s, p),
			sx,
			sy
		);
	const pct = (v: number) => Math.round(v * 100);
	const lo = $derived(atShare(sorted, 0.1));
	const hi = $derived(atShare(sorted, 0.9));
	const sizeText = $derived(`${size} by ${size} forests`);
</script>

<g class="ff">
	<rect
		x={sx(lo)}
		y={sy(1)}
		width={Math.max(2, sx(hi) - sx(lo))}
		height={sy(0) - sy(1)}
		fill="var(--ff-fire)"
		opacity="0.12"
	/>
	<Axes
		{sx}
		{sy}
		xLabel="trees in every 100 squares"
		yLabel="forests crossed"
		xTicks={[0.3, 0.4, 0.5, 0.6, 0.7, 0.8]}
		yTicks={[0, 0.5, 1]}
		xFormat={(v: number) => String(pct(v))}
		yFormat={(v) => (v === 0 ? 'none' : v === 1 ? 'all' : 'half')}
	/>
	<line
		x1={sx(0.592746)}
		y1={sy(1) - 10}
		x2={sx(0.592746)}
		y2={sy(0)}
		stroke="var(--ff-ash)"
		stroke-width="2"
		stroke-dasharray="6 5"
	/>
	<Readout id="ff-huge">
		<Label
			x={sx(0.592746) + 8}
			y={sy(1) - 14}
			text="an endless forest tips here"
			anchor="start"
			size={14}
			muted
		/>
	</Readout>
	{#if size !== 50}
		<path d={line(base)} fill="none" stroke="var(--ff-ash)" stroke-width="3" opacity="0.6" />
	{/if}
	<path d={line(sorted)} fill="none" stroke="var(--ff-fire)" stroke-width="5" />

	<Readout id="ff-size" order={1} label="Forests" value={sizeText}>
		<Label x={480} y={60} text={sizeText} size={20} weight={700} />
	</Readout>
	<Readout
		id="ff-jump"
		order={2}
		label="The jump"
		value="1 in 10 crossed at {pct(lo)}, 9 in 10 at {pct(hi)}"
	>
		<Label
			x={480}
			y={90}
			text="1 in 10 crossed at {pct(lo)} trees, 9 in 10 at {pct(hi)}"
			size={16}
			tabular
		/>
	</Readout>
	{#if size !== 50}
		<Readout id="ff-grey">
			<Label x={sx(0.545)} y={sy(0.12)} text="grey: 50 by 50" anchor="end" size={14} muted />
		</Readout>
	{/if}
</g>
