<script lang="ts">
	/**
	 * Six runs of k-means on the penguins with the same k, each from different random starting
	 * centres (seeds 1 to 6), as small multiples. Each panel gives the total squared distance where
	 * its run stopped; the smallest is marked "best".
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { penguins, run, spread, startCentres } from '../model';

	let { params }: StageProps = $props();

	const k = $derived(Number(params.kstarts ?? 4));
	const runs = $derived(
		Array.from({ length: 6 }, (_, i) => {
			const states = run(penguins, startCentres(penguins, k, i + 1));
			const end = states[states.length - 1];
			return { end, total: spread(penguins, end), rounds: states.length - 1 };
		})
	);
	const best = $derived(Math.min(...runs.map((r) => r.total)));
	const distinct = $derived(new Set(runs.map((r) => r.total.toFixed(1))).size);

	// Panels: 3 × 2, each a square-scaled copy of the main plot's frame.
	const XMIN = -2.4;
	const XMAX = 3.0;
	const YMIN = -2.2;
	const YMAX = 2.3;
	const W = 280;
	const U = W / (XMAX - XMIN);
	const H = (YMAX - YMIN) * U;
	const GX = 30;
	const GY = 46;
	const left = (i: number) => 24 + (i % 3) * (W + GX);
	const top = (i: number) => 42 + Math.floor(i / 3) * (H + GY);
	const colour = (j: number) => `var(--km-${(j % 6) + 1})`;
	const cross = (x: number, y: number, r: number) =>
		`M${x - r} ${y - r}L${x + r} ${y + r}M${x - r} ${y + r}L${x + r} ${y - r}`;
</script>

<g class="km-starts">
	{#each runs as r, i (i)}
		{@const x0 = left(i)}
		{@const y0 = top(i)}
		{@const isBest = r.total - best < 0.05}
		<rect
			x={x0}
			y={y0}
			width={W}
			height={H}
			rx="6"
			fill="none"
			stroke={isBest ? 'var(--text)' : 'var(--border-strong)'}
			stroke-width={isBest ? 2 : 1}
		/>
		{#each penguins as p, n (n)}
			<circle
				cx={x0 + (p.x - XMIN) * U}
				cy={y0 + (YMAX - p.y) * U}
				r="2.4"
				fill={colour(r.end.labels[n])}
				fill-opacity="0.75"
			/>
		{/each}
		{#each r.end.centres as c, j (j)}
			{@const cx = x0 + (c.x - XMIN) * U}
			{@const cy = y0 + (YMAX - c.y) * U}
			<path d={cross(cx, cy, 6)} stroke="var(--stage-bg)" stroke-width="6" stroke-linecap="round" />
			<path d={cross(cx, cy, 6)} stroke={colour(j)} stroke-width="3" stroke-linecap="round" />
		{/each}
		<Readout
			id="km-run-{i}"
			order={i + 1}
			label="Start {i + 1}"
			value="total {r.total.toFixed(0)}{isBest ? ' (best)' : ''}"
		>
			<Label
				x={x0 + 4}
				y={y0 + H + 20}
				text="start {i + 1} · total {r.total.toFixed(0)}"
				anchor="start"
				tabular
				weight={isBest ? 600 : 400}
			/>
			{#if isBest}
				<Label x={x0 + W - 4} y={y0 + H + 20} text="best" anchor="end" weight={600} />
			{/if}
		</Readout>
	{/each}
	<Readout
		id="km-distinct"
		order={10}
		label="Endings"
		value="{distinct} different groupings from 6 starts, k = {k}"
	>
		<Label
			x={480}
			y={22}
			text="k = {k} · {distinct === 1
				? 'all 6 starts end the same'
				: `${distinct} different endings from 6 starts`}"
			anchor="middle"
			weight={600}
		/>
	</Readout>
</g>
