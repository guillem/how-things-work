<script lang="ts">
	/**
	 * The giant's share in 300 graphs at c = 2 (../model.ts `largestComponent`) for each of three
	 * sizes, as histograms on one axis, with the normal curve of mean S and standard deviation
	 * σ/√n (Pittel 1990, `giantSigma`). The chosen size `spreadN` is drawn in full colour and fills
	 * up at 40 graphs a second (reduced motion: all 300).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { giantShare, giantSigma, largestComponent } from '../model';
	import { fmt, pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const C = 2;
	const GRAPHS = 300;
	const NS = [200, 1000, 5000];
	const S = giantShare(C);
	const SIG = giantSigma(C);
	const n = $derived(NS.includes(Number(params.spreadN)) ? Number(params.spreadN) : 200);
	const chosen = $derived(NS.indexOf(n));
	const samples = NS.map((size) =>
		Array.from({ length: GRAPHS }, (_, k) => largestComponent(size, C, 1000 + k) / size)
	);
	const count = $derived(reduced ? GRAPHS : Math.min(GRAPHS, Math.max(1, Math.floor(t * 40))));

	const LO = 0.6;
	const HI = 1;
	const BIN = 0.005;
	const BINS = Math.round((HI - LO) / BIN);
	const hist = (xs: readonly number[]) => {
		const h = new Array<number>(BINS).fill(0);
		for (const x of xs) {
			const b = Math.floor((x - LO) / BIN + 1e-9);
			if (b >= 0 && b < BINS) h[b]++;
		}
		return h;
	};
	const sx = scale([LO, HI], [90, 690]);
	/** Each row's height in graphs per bin: the tallest bell, 5000 nodes, peaks near 62. */
	const ROW = [
		{ top: 96, bottom: 230 },
		{ top: 262, bottom: 396 },
		{ top: 428, bottom: 562 }
	];
	const YMAX = 70;
	const rows = $derived(
		NS.map((size, k) => {
			const xs = k === chosen ? samples[k].slice(0, count) : samples[k];
			const h = hist(xs);
			const sy = scale([0, YMAX], [ROW[k].bottom, ROW[k].top]);
			const sd = SIG / Math.sqrt(size);
			const bell = linePath(
				Array.from({ length: 161 }, (_, i) => LO + (i / 160) * (HI - LO)).map((x) => ({
					x,
					y: Math.min(
						YMAX,
						((xs.length * BIN) / (sd * Math.sqrt(2 * Math.PI))) *
							Math.exp(-0.5 * ((x - S) / sd) ** 2)
					)
				})),
				(d) => d.x,
				(d) => d.y,
				sx,
				sy
			);
			const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
			const sdObs = Math.sqrt(
				xs.reduce((a, x) => a + (x - mean) ** 2, 0) / Math.max(1, xs.length - 1)
			);
			return { size, h, sy, bell, mean, sdObs, sd, graphs: xs.length };
		})
	);
	const now = $derived(rows[chosen]);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Giant's share"
		value="{now.graphs} graphs of {fmt(n)} nodes at c = 2"
	>
		<Label
			x={24}
			y={34}
			text="The giant’s share in {GRAPHS} graphs at c = 2, for three sizes"
			size={15}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Label
		x={24}
		y={58}
		text="bars: how many graphs had each share · line: bell curve, mean S = {S.toFixed(
			3
		)}, width 0.68/√n"
		size={12}
		anchor="start"
		muted
	/>

	{#each rows as row, k (row.size)}
		{@const on = k === chosen}
		<g opacity={on ? 1 : 0.42}>
			<Axes
				{sx}
				sy={row.sy}
				xLabel={k === 2 ? 'share of the nodes in the largest piece' : undefined}
				xTicks={k === 2 ? [0.6, 0.7, 0.8, 0.9, 1] : []}
				yTicks={[0, 30, 60]}
				xFormat={(v) => `${Math.round(v * 100)} %`}
			/>
			{#each row.h as v, b (b)}
				{#if v > 0}
					<rect
						x={sx(LO + b * BIN) + 0.5}
						y={row.sy(Math.min(YMAX, v))}
						width={sx(LO + BIN) - sx(LO) - 1}
						height={row.sy(0) - row.sy(Math.min(YMAX, v))}
						fill="var(--rg-second)"
						opacity="0.85"
					/>
				{/if}
			{/each}
			<path d={row.bell} fill="none" stroke="var(--rg-giant)" stroke-width="2" />
			<line
				x1={sx(S)}
				x2={sx(S)}
				y1={row.sy(0)}
				y2={row.sy(YMAX)}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="3 4"
			/>
		</g>
		<Label
			x={716}
			y={ROW[k].top + 30}
			text="{fmt(row.size)} nodes"
			size={14}
			weight={on ? 600 : 400}
			anchor="start"
			muted={!on}
		/>
		<Label
			x={716}
			y={ROW[k].top + 52}
			text="spread {pct(row.sdObs, 1)} (0.68/√n: {pct(row.sd, 1)})"
			size={12}
			anchor="start"
			tabular
			muted={!on}
		/>
		<Label
			x={716}
			y={ROW[k].top + 72}
			text="mean {pct(row.mean, 1)}"
			size={12}
			anchor="start"
			tabular
			muted={!on}
		/>
	{/each}
	<Readout
		id="spread"
		order={2}
		label="Spread"
		value="{pct(now.sdObs, 1)} (predicted {pct(now.sd, 1)})"
	/>
	<Readout id="mean" order={3} label="Mean share" value="{pct(now.mean, 1)} (S = {pct(S, 1)})" />
</g>
