<script lang="ts">
	/**
	 * The largest piece against the number of nodes n, both on log scales, at c = 0.5, 1 and 2
	 * (../model.ts `largestComponent`, mean over 12 graphs, 4 at c = 2), with the laws it should
	 * follow: (ln n − 2.5 ln ln n)/α below the threshold, n^(2/3) at it (scaled through the
	 * simulated points) and S(2)·n above it. The sizes appear one every 0.8 s (reduced motion: all),
	 * and each series' fitted slope is listed on the right.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { giantShare, largestComponent } from '../model';
	import { fmt } from './shared';

	let { t, reduced }: StageProps = $props();

	const NS = [250, 1000, 4000, 16000, 64000];
	const SERIES = [
		{ c: 2, seeds: 4, color: 'var(--rg-giant)', name: 'c = 2' },
		{ c: 1, seeds: 12, color: 'var(--rg-second)', name: 'c = 1' },
		{ c: 0.5, seeds: 12, color: 'var(--rg-mid)', name: 'c = 0.5' }
	];
	const data = SERIES.map((s) =>
		NS.map((n) => {
			let sum = 0;
			for (let k = 0; k < s.seeds; k++) sum += largestComponent(n, s.c, 1 + k);
			return { n, size: sum / s.seeds };
		})
	);
	const slope = (pts: { n: number; size: number }[]) => {
		const xs = pts.map((p) => Math.log(p.n));
		const ys = pts.map((p) => Math.log(p.size));
		const mx = xs.reduce((a, x) => a + x, 0) / xs.length;
		const my = ys.reduce((a, x) => a + x, 0) / ys.length;
		let sxy = 0;
		let sxx = 0;
		xs.forEach((x, i) => {
			sxy += (x - mx) * (ys[i] - my);
			sxx += (x - mx) ** 2;
		});
		return sxy / sxx;
	};
	const slopes = data.map(slope);

	const lx = (n: number) => Math.log10(n);
	const sx = scale([2, 5], [110, 650]);
	const sy = scale([0, 5], [520, 100]);
	const NN = Array.from({ length: 61 }, (_, i) => Math.pow(10, 2 + i * 0.05));
	const alpha = 0.5 - 1 - Math.log(0.5);
	const k23 = data[1].reduce((a, p) => a + p.size / Math.pow(p.n, 2 / 3), 0) / NS.length;
	const laws = [
		NN.map((n) => ({ n, v: giantShare(2) * n })),
		NN.map((n) => ({ n, v: k23 * Math.pow(n, 2 / 3) })),
		NN.filter((n) => n >= 150).map((n) => ({
			n,
			v: (Math.log(n) - 2.5 * Math.log(Math.log(n))) / alpha
		}))
	].map((pts) =>
		linePath(
			pts,
			(d) => lx(d.n),
			(d) => Math.log10(d.v),
			sx,
			sy
		)
	);
	const shown = $derived(reduced ? NS.length : Math.min(NS.length, 1 + Math.floor(t / 0.8)));
	const lines = $derived(
		data.map((pts) =>
			linePath(
				pts.slice(0, shown),
				(d) => lx(d.n),
				(d) => Math.log10(d.size),
				sx,
				sy
			)
		)
	);
	const LAW_TEXT = ['0.80 n (slope 1)', 'a constant × n^(2/3)', '(ln n − 2.5 ln ln n)/α'];
	const last = $derived(NS[shown - 1]);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Largest piece"
		value="against n, log–log, up to {fmt(last)} nodes"
	>
		<Label
			x={24}
			y={34}
			text="The largest piece as the graph grows · up to {fmt(last)} nodes"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Label
		x={24}
		y={56}
		text="both axes logarithmic: a power law nᵃ is a straight line of slope a"
		size={12}
		anchor="start"
		muted
	/>

	<Axes
		{sx}
		{sy}
		xLabel="nodes n"
		xTicks={[2, 3, 4, 5]}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xFormat={(v: number) => fmt(Math.pow(10, v))}
		yFormat={(v: number) => fmt(Math.pow(10, v))}
	/>
	<Label x={110} y={86} text="nodes in the largest piece" size={11} anchor="start" muted />
	{#each laws as d, i (i)}
		<path
			{d}
			fill="none"
			stroke={SERIES[i].color}
			stroke-width="1.3"
			stroke-dasharray="5 4"
			opacity="0.7"
		/>
	{/each}
	{#each data as pts, i (SERIES[i].c)}
		<path d={lines[i]} fill="none" stroke={SERIES[i].color} stroke-width="2.4" />
		{#each pts.slice(0, shown) as p (p.n)}
			<circle
				cx={sx(lx(p.n))}
				cy={sy(Math.log10(p.size))}
				r="5"
				fill={SERIES[i].color}
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		{/each}
	{/each}

	{#each SERIES as s, i (s.c)}
		{@const y = 150 + i * 92}
		<Readout
			id="s{i}"
			order={2 + i}
			label={s.name}
			value="slope {slopes[i].toFixed(2)}, {LAW_TEXT[i]}"
			color={s.color}
		>
			<circle cx={700} cy={y - 5} r="6" fill={s.color} />
			<Label x={714} {y} text={s.name} size={14} weight={600} anchor="start" />
			<Label
				x={714}
				y={y + 22}
				text="fitted slope {slopes[i].toFixed(2)}"
				size={12}
				anchor="start"
				tabular
			/>
			<Label x={714} y={y + 42} text="dashed: {LAW_TEXT[i]}" size={11} anchor="start" muted />
		</Readout>
	{/each}
	<Label x={700} y={448} text="at {fmt(last)} nodes:" size={11} anchor="start" muted />
	{#each SERIES as s, i (s.c)}
		<Label
			x={700}
			y={470 + i * 20}
			text="{s.name}: {fmt(Math.round(data[i][shown - 1].size))}"
			size={12}
			anchor="start"
			color={s.color}
			tabular
		/>
	{/each}
</g>
