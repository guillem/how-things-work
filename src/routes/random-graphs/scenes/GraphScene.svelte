<script lang="ts">
	/**
	 * A drawn G(n, p) (../model.ts `randomGraph`, links up to c = 4) at the average degree `c`,
	 * coloured by piece: the largest, the second largest, other pieces of three or more, pairs and
	 * single nodes. Nodes sit where a spring layout of the graph at c = 3 puts them, so that a
	 * piece's nodes sit together; the slider only adds or removes links.
	 *
	 * Focus (`step.hints.focus`), for the panel on the right: 'pieces' (the ten largest pieces),
	 * 'degree' (the degree histogram against Poisson) or 'merge' (the largest share against c,
	 * traced up to the slider).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		componentsAt,
		degreeHistogram,
		giantShare,
		largestSweep,
		linksAt,
		poisson,
		randomGraph
	} from '../model';
	import { PIECE, circles, fmt, pct, springLayout } from './shared';

	let { step, params }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'pieces'));
	const c = $derived(Math.max(0, Math.min(4, Number(params.c ?? 0.5))));
	const n = $derived(Number(params.nodes ?? 200) || 200);
	const seed = $derived(1 + Number(params.reroll ?? 0));
	const g = $derived(randomGraph(n, 4, seed));
	const pos = $derived(springLayout(g, 3, seed));

	// ---- the drawing ------------------------------------------------------------------------------
	const BX = 28;
	const BY = 78;
	const BW = 540;
	const BH = 500;
	const px = (i: number) => BX + 10 + pos[2 * i] * (BW - 20);
	const py = (i: number) => BY + 10 + pos[2 * i + 1] * (BH - 20);
	const r = $derived(n <= 50 ? 7 : n <= 200 ? 4.6 : 3.2);

	const uf = $derived(componentsAt(g, c));
	const m = $derived(linksAt(g, c));
	/** Roots of the pieces, largest first. */
	const ranked = $derived.by(() => {
		const roots: number[] = [];
		for (let i = 0; i < n; i++) if (uf.find(i) === i) roots.push(i);
		return roots.sort((x, y) => uf.size[y] - uf.size[x] || x - y);
	});
	const bucketOf = (root: number) =>
		root === ranked[0] && uf.size[root] > 2
			? 0
			: root === ranked[1] && uf.size[root] > 2
				? 1
				: uf.size[root] >= 3
					? 2
					: uf.size[root] === 2
						? 3
						: 4;
	const drawn = $derived.by(() => {
		const xs: number[][] = [[], [], [], [], []];
		const ys: number[][] = [[], [], [], [], []];
		const edges = ['', '', '', '', ''];
		for (let i = 0; i < n; i++) {
			const k = bucketOf(uf.find(i));
			xs[k].push(px(i));
			ys[k].push(py(i));
		}
		for (let e = 0; e < m; e++) {
			const k = bucketOf(uf.find(g.a[e]));
			edges[k] +=
				`M${px(g.a[e]).toFixed(1)} ${py(g.a[e]).toFixed(1)}L${px(g.b[e]).toFixed(1)} ${py(g.b[e]).toFixed(1)}`;
		}
		return { nodes: xs.map((x, k) => circles(x, ys[k], r)), edges };
	});
	const largest = $derived(uf.size[ranked[0]]);
	const second = $derived(ranked.length > 1 ? uf.size[ranked[1]] : 0);
	const p = $derived(c / (n - 1));

	// ---- panel: the ten largest pieces ------------------------------------------------------------
	const top = $derived(ranked.slice(0, 10).map((root) => ({ root, size: uf.size[root] })));
	const barX = $derived(scale([0, n], [690, 930]));

	// ---- panel: degrees ----------------------------------------------------------------------------
	const KMAX = 9;
	const hist = $derived(degreeHistogram(g, c));
	const dx = scale([-0.5, KMAX + 0.5], [650, 930]);
	/** The share axis: up to 60 %, or 100 % when few links leave most nodes without one. */
	const yTop = $derived(c < 0.45 ? 1 : 0.6);
	const dy = $derived(scale([0, yTop], [470, 150]));
	const degreeBars = $derived(
		Array.from({ length: KMAX + 1 }, (_, k) => ({ k, share: (hist[k] ?? 0) / n }))
	);
	const isolated = $derived((hist[0] ?? 0) / n);

	// ---- panel: the largest share against c -------------------------------------------------------
	const CS = Array.from({ length: 161 }, (_, i) => i * 0.025);
	const sweep = $derived(largestSweep(g, CS).map((s, i) => ({ c: CS[i], s: s / n })));
	const sx = scale([0, 4], [660, 930]);
	const sy = scale([0, 1], [440, 150]);
	const trace = $derived(
		linePath(
			sweep.filter((d) => d.c <= c + 1e-9),
			(d) => d.c,
			(d) => d.s,
			sx,
			sy
		)
	);
	const theory = linePath(
		CS.map((x) => ({ x, y: giantShare(x) })),
		(d) => d.x,
		(d) => d.y,
		sx,
		sy
	);
	const legendY = $derived(focus === 'merge' ? 530 : 504);
	const legend = [
		{ k: 0, t: 'largest piece' },
		{ k: 1, t: 'second largest' },
		{ k: 2, t: 'other pieces of 3+' },
		{ k: 3, t: 'pairs' },
		{ k: 4, t: 'single nodes' }
	];
</script>

<g>
	<Readout id="title" order={1} label="Graph" value="{fmt(n)} nodes, c = {c.toFixed(2)}">
		<Label
			x={24}
			y={34}
			text="G(n, p): {fmt(n)} nodes · c = {c.toFixed(2)} · p = {p.toPrecision(2)}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="links"
		order={2}
		label="Links"
		value="{fmt(m)} (about cn/2 = {fmt(Math.round((c * n) / 2))})"
	>
		<Label
			x={24}
			y={56}
			text="{fmt(m)} links (about cn/2 = {fmt(Math.round((c * n) / 2))}) · {fmt(uf.count)} pieces"
			size={12}
			anchor="start"
			muted
			tabular
		/>
	</Readout>

	<!-- the graph -->
	<path d={drawn.edges[4]} stroke={PIECE[4]} stroke-width="1" fill="none" opacity="0.5" />
	<path d={drawn.edges[3]} stroke={PIECE[3]} stroke-width="1.2" fill="none" opacity="0.8" />
	<path d={drawn.edges[2]} stroke={PIECE[2]} stroke-width="1.2" fill="none" opacity="0.8" />
	<path d={drawn.edges[1]} stroke={PIECE[1]} stroke-width="1.4" fill="none" opacity="0.85" />
	<path d={drawn.edges[0]} stroke={PIECE[0]} stroke-width="1.6" fill="none" opacity="0.9" />
	<path d={drawn.nodes[4]} fill={PIECE[4]} opacity="0.55" />
	<path d={drawn.nodes[3]} fill={PIECE[3]} />
	<path d={drawn.nodes[2]} fill={PIECE[2]} />
	<path d={drawn.nodes[1]} fill={PIECE[1]} />
	<path d={drawn.nodes[0]} fill={PIECE[0]} />

	{#if focus === 'pieces'}
		<Label x={650} y={112} text="largest pieces, in nodes" size={12} anchor="start" muted />
		{#each top as d, i (d.root)}
			{@const y = 136 + i * 30}
			<Label x={680} y={y + 5} text={String(i + 1)} size={11} anchor="end" muted tabular />
			<rect
				x={barX(0)}
				y={y - 9}
				width={Math.max(1.5, barX(d.size) - barX(0))}
				height="16"
				rx="3"
				fill={PIECE[bucketOf(d.root)]}
				opacity={bucketOf(d.root) === 4 ? 0.55 : 1}
			/>
			{@const inside = barX(d.size) > 880}
			<Label
				x={inside ? barX(d.size) - 6 : barX(d.size) + 6}
				y={y + 4}
				text={fmt(d.size)}
				size={12}
				anchor={inside ? 'end' : 'start'}
				color={inside ? 'var(--stage-bg)' : undefined}
				weight={inside ? 600 : 400}
				halo={!inside}
				tabular
			/>
		{/each}
		<Readout
			id="largest"
			order={3}
			label="Largest piece"
			value="{fmt(largest)} nodes, {pct(largest / n)}"
		>
			<Label
				x={650}
				y={440}
				text="largest: {fmt(largest)} of {fmt(n)} nodes ({pct(largest / n)})"
				size={14}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
		<Readout id="second" order={4} label="Second largest" value="{fmt(second)} nodes">
			<Label
				x={650}
				y={462}
				text="second largest: {fmt(second)} nodes"
				size={12}
				anchor="start"
				muted
				tabular
			/>
		</Readout>
	{:else if focus === 'degree'}
		<Axes
			sx={dx}
			sy={dy}
			xLabel="links per node"
			xTicks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]}
			yTicks={yTop === 1 ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.2, 0.4, 0.6]}
			yFormat={(v) => `${Math.round(v * 100)} %`}
		/>
		<Label x={650} y={136} text="share of the nodes" size={11} anchor="start" muted />
		{#each degreeBars as d (d.k)}
			<rect
				x={dx(d.k) - 11}
				y={dy(d.share)}
				width="22"
				height={Math.max(0, dy(0) - dy(d.share))}
				rx="2"
				fill="var(--rg-second)"
				opacity="0.8"
			/>
			<circle cx={dx(d.k)} cy={dy(poisson(d.k, c))} r="4.5" fill="var(--stage-ink)" />
		{/each}
		<rect x={650} y={516} width="14" height="12" rx="2" fill="var(--rg-second)" opacity="0.8" />
		<Label x={670} y={526} text="this graph" size={11} anchor="start" />
		<circle cx={767} cy={522} r="4.5" fill="var(--stage-ink)" />
		<Label x={777} y={526} text="Poisson, mean c" size={11} anchor="start" />
		<Readout
			id="isolated"
			order={3}
			label="No link at all"
			value="{pct(isolated)} (Poisson: {pct(Math.exp(-c))})"
		>
			<Label
				x={650}
				y={112}
				text="no link: {pct(isolated)} of nodes · Poisson e⁻ᶜ = {pct(Math.exp(-c))}"
				size={13}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
	{:else}
		<Axes
			{sx}
			{sy}
			xLabel="average degree c"
			xTicks={[0, 1, 2, 3, 4]}
			yTicks={[0, 0.25, 0.5, 0.75, 1]}
			yFormat={(v) => `${v * 100} %`}
		/>
		<Label x={660} y={136} text="largest piece’s share" size={11} anchor="start" muted />
		<path
			d={theory}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.2"
			stroke-dasharray="5 4"
		/>
		<path
			d={trace}
			fill="none"
			stroke="var(--rg-giant)"
			stroke-width="2.6"
			stroke-linejoin="round"
		/>
		<circle
			cx={sx(c)}
			cy={sy(largest / n)}
			r="5.5"
			fill="var(--rg-giant)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<line
			x1={660}
			x2={690}
			y1={500}
			y2={500}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="5 4"
		/>
		<Label x={696} y={504} text="an infinitely large graph" size={11} anchor="start" muted />
		<Readout id="share" order={3} label="Largest piece" value="{pct(largest / n)} of the nodes">
			<Label
				x={660}
				y={112}
				text="largest piece: {pct(largest / n)} of the nodes"
				size={14}
				weight={600}
				anchor="start"
				tabular
			/>
		</Readout>
	{/if}

	{#if focus !== 'degree'}
		{#each legend as l, i (l.k)}
			<Readout id="key{l.k}" label={l.t} color={PIECE[l.k]} opacity={focus === 'pieces' ? 1 : 0}>
				<circle
					cx={656 + (i % 2) * 140}
					cy={legendY + Math.floor(i / 2) * 22 - 4}
					r="5"
					fill={PIECE[l.k]}
					opacity={l.k === 4 ? 0.6 : 1}
				/>
				<Label
					x={666 + (i % 2) * 140}
					y={legendY + Math.floor(i / 2) * 22}
					text={l.t}
					size={11}
					anchor="start"
				/>
			</Readout>
		{/each}
	{/if}
</g>
