<script lang="ts">
	/**
	 * Breadth-first search from one node of a G(5000, p) at average degree `c` (../model.ts
	 * `bfsLevels`), one level a second (reduced motion: all of them). Left: the search tree, level
	 * by level, at most 44 nodes drawn per level. Right: the size of each level (log scale) against
	 * c^k, the branching-process average. The `start` action picks another start node.
	 */
	import { Axes, Label, hash, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { bfsLevels, componentsAt, giantShare, randomGraph } from '../model';
	import { circles, fmt, pct } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const N = 5000;
	const g = randomGraph(N, 4, 11);
	const c = $derived(Math.max(0, Math.min(4, Number(params.cb ?? 1.5))));
	const startNode = $derived(Math.floor(hash(Number(params.start ?? 0) + 1, 7) * N));
	const levels = $derived(bfsLevels(g, c, startNode));
	const uf = $derived(componentsAt(g, c));
	const giant = $derived(uf.largest / N);
	const inLargest = $derived(uf.size[uf.find(startNode)] === uf.largest);
	const reachedAll = $derived(levels.reduce((a, l) => a + l.length, 0));
	const shown = $derived(reduced ? levels.length : Math.min(levels.length, 1 + Math.floor(t)));
	const reached = $derived(levels.slice(0, shown).reduce((a, l) => a + l.length, 0));
	const done = $derived(shown >= levels.length);

	// ---- the tree -----------------------------------------------------------------------------------
	const ROWS = 10;
	const MAXDOT = 44;
	const TX0 = 40;
	const TX1 = 560;
	const rowY = (k: number) => 96 + k * 50;
	const dotX = (i: number, count: number) => {
		const w = TX1 - TX0;
		const cnt = Math.min(count, MAXDOT);
		return TX0 + ((Math.min(i, cnt - 1) + 0.5) / cnt) * w;
	};
	const tree = $derived.by(() => {
		const rows = [];
		for (let k = 0; k < Math.min(shown, ROWS); k++) {
			const lvl = levels[k];
			const cnt = Math.min(lvl.length, MAXDOT);
			const prev = k > 0 ? levels[k - 1] : [];
			const xs: number[] = [];
			const ys: number[] = [];
			let edges = '';
			for (let i = 0; i < cnt; i++) {
				const x = dotX(i, lvl.length);
				xs.push(x);
				ys.push(rowY(k));
				// a link to a parent beyond the drawn ones is left out
				if (k > 0 && lvl[i].parent < MAXDOT) {
					const pxp = dotX(lvl[i].parent, prev.length);
					edges += `M${x.toFixed(1)} ${rowY(k)}L${pxp.toFixed(1)} ${rowY(k - 1)}`;
				}
			}
			rows.push({ k, size: lvl.length, dots: circles(xs, ys, 4.5), edges });
		}
		return rows;
	});

	// ---- level sizes against c^k ----------------------------------------------------------------------
	const LMAX = 12;
	const bx = scale([-0.5, LMAX + 0.5], [650, 930]);
	const by = scale([0, 4], [470, 150]);
	const logv = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.log10(v)));
	const expected = $derived(
		linePath(
			Array.from({ length: LMAX + 1 }, (_, k) => ({ k, v: Math.pow(c, k) })).filter(
				(d) => d.v >= 1 && d.v <= 1e4
			),
			(d) => d.k,
			(d) => logv(d.v),
			bx,
			by
		)
	);
	const giantText = $derived(
		c > 1
			? `largest component: ${pct(giant)} of the nodes · S(c) = ${pct(giantShare(c))}`
			: `largest piece: ${fmt(uf.largest)} nodes · no giant below c = 1`
	);
	const giantNote = $derived(
		c > 1 ? `so ${pct(giant)} of start nodes run into it` : 'no search reaches a share of the graph'
	);
	const verdict = $derived(
		!done
			? `level ${shown - 1} · ${fmt(reached)} nodes reached so far`
			: inLargest
				? `reached ${fmt(reachedAll)} nodes: the largest component`
				: `stopped after ${levels.length - 1} level${levels.length === 2 ? '' : 's'}: a piece of ${fmt(reachedAll)}`
	);
</script>

<g>
	<Readout
		id="title"
		order={1}
		label="Search"
		value="from one node of {fmt(N)}, c = {c.toFixed(2)}"
	>
		<Label
			x={24}
			y={34}
			text="Breadth-first search from one node of {fmt(N)} · c = {c.toFixed(2)}"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout id="verdict" order={2} label="This start" value={verdict}>
		<Label x={24} y={58} text={verdict} size={12} anchor="start" muted tabular />
	</Readout>

	{#each tree as row (row.k)}
		<path
			d={row.edges}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
			fill="none"
			opacity="0.55"
		/>
		<path d={row.dots} fill={row.k === 0 ? 'var(--rg-giant)' : 'var(--rg-second)'} />
		<Label x={24} y={rowY(row.k) + 4} text={String(row.k)} size={11} anchor="end" muted />
		{#if row.size > MAXDOT}
			<Label
				x={TX1 + 8}
				y={rowY(row.k) + 4}
				text={fmt(row.size)}
				size={11}
				anchor="start"
				tabular
			/>
		{/if}
	{/each}
	{#if levels.length > ROWS && shown > ROWS}
		<Label
			x={TX0}
			y={rowY(ROWS) - 6}
			text="… {levels.length - ROWS} more levels"
			size={11}
			anchor="start"
			muted
		/>
	{/if}
	<Label
		x={TX0}
		y={80}
		text="level 0: the start · each row: nodes one link further (at most 44 drawn)"
		size={11}
		anchor="start"
		muted
	/>

	<Axes
		sx={bx}
		sy={by}
		xLabel="level k"
		xTicks={[0, 2, 4, 6, 8, 10, 12]}
		yTicks={[0, 1, 2, 3, 4]}
		yFormat={(v: number) => fmt(Math.pow(10, v))}
	/>
	<Label x={650} y={136} text="nodes in the level (log scale)" size={11} anchor="start" muted />
	<path
		d={expected}
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.4"
		stroke-dasharray="5 4"
	/>
	{#each levels.slice(0, Math.min(shown, LMAX + 1)) as lvl, k (k)}
		<rect
			x={bx(k) - 8}
			y={by(logv(lvl.length))}
			width="16"
			height={Math.max(2, by(0) - by(logv(lvl.length)))}
			rx="2"
			fill={k === 0 ? 'var(--rg-giant)' : 'var(--rg-second)'}
		/>
	{/each}
	<line
		x1={650}
		x2={680}
		y1={508}
		y2={508}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="5 4"
	/>
	<Label x={686} y={512} text="cᵏ: c new nodes per node" size={11} anchor="start" muted />
	<Readout id="giant" order={3} label="Largest piece" value={giantText}>
		<Label x={650} y={540} text={giantText} size={12} anchor="start" tabular />
	</Readout>
	<Label x={650} y={562} text={giantNote} size={11} anchor="start" muted tabular />
</g>
