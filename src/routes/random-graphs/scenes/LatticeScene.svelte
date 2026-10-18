<script lang="ts">
	/**
	 * Bond percolation on an L × L grid (../model.ts `lattice`, `clustersAt`) at the bond
	 * probability `p`: open bonds coloured by cluster (the cluster joining top to bottom, else the
	 * largest; then the rest). Right: the chance that a grid spans, against p, for four sizes
	 * (`spanningProbability`, 300 grids each), with the current p marked.
	 *
	 * Focus (`step.hints.focus`): 'grid', or 'dual' (adds the dual grid's open bonds, one across
	 * each closed bond, and highlights the dual cluster joining left to right when there is one).
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { clustersAt, dualAt, lattice, spanningProbability } from '../model';
	import { pct, sizeColor } from './shared';

	let { step, params }: StageProps = $props();

	const dual = $derived(step.hints?.focus === 'dual');
	const p = $derived(Math.max(0, Math.min(1, Number(params.p ?? 0.45))));
	const L = $derived([10, 20, 40].includes(Number(params.L)) ? Number(params.L) : 20);
	const seed = $derived(1 + Number(params.regrid ?? 0));
	const lat = $derived(lattice(L, seed));
	const cl = $derived(clustersAt(lat, p));
	const du = $derived(dual ? dualAt(lat, p) : null);

	// ---- the grid ---------------------------------------------------------------------------------
	const GX = 50;
	const GY = 100;
	const GW = 420;
	const cell = $derived(GW / (L - 1));
	const X = (x: number) => GX + x * cell;
	const Y = (y: number) => GY + y * cell;
	const focusRoot = $derived(cl.spanning >= 0 ? cl.spanning : cl.largestRoot);
	const drawn = $derived.by(() => {
		let hi = '';
		let rest = '';
		let closed = '';
		let dualOn = '';
		let dualCross = '';
		const crossRoot = du && du.crosses ? du.uf.find(du.LEFT) : -1;
		for (let e = 0; e < lat.at.length; e++) {
			const s = lat.a[e];
			const t = lat.b[e];
			const x = s % L;
			const y = Math.floor(s / L);
			const x2 = t % L;
			const y2 = Math.floor(t / L);
			const seg = `M${X(x).toFixed(1)} ${Y(y).toFixed(1)}L${X(x2).toFixed(1)} ${Y(y2).toFixed(1)}`;
			if (lat.at[e] < p) {
				if (cl.uf.find(s) === focusRoot && cl.largestSize > 1) hi += seg;
				else rest += seg;
			} else {
				closed += seg;
				if (du) {
					// the dual bond crosses this one at its middle, at right angles
					const mx = (X(x) + X(x2)) / 2;
					const my = (Y(y) + Y(y2)) / 2;
					const h = cell / 2;
					let dseg: string;
					let root = -1;
					if (t === s + 1) {
						// a horizontal bond: the dual bond is vertical, between the faces above and below
						const y0 = y > 0 ? my - h : my - h * 0.6;
						const y1 = y < L - 1 ? my + h : my + h * 0.6;
						dseg = `M${mx.toFixed(1)} ${y0.toFixed(1)}L${mx.toFixed(1)} ${y1.toFixed(1)}`;
						if (y > 0 && y < L - 1) root = du.uf.find(du.face(x, y - 1));
					} else {
						const x0 = mx - h;
						const x1 = mx + h;
						dseg = `M${x0.toFixed(1)} ${my.toFixed(1)}L${x1.toFixed(1)} ${my.toFixed(1)}`;
						root = du.uf.find(du.face(x, y));
					}
					if (root >= 0 && root === crossRoot) dualCross += dseg;
					else dualOn += dseg;
				}
			}
		}
		return { hi, rest, closed, dualOn, dualCross };
	});
	const spans = $derived(cl.spanning >= 0);

	// ---- the chance of spanning --------------------------------------------------------------------
	const SIDES = [8, 16, 32, 64];
	const PS = Array.from({ length: 101 }, (_, i) => i / 100);
	const curves = SIDES.map((side, k) => spanningProbability(side, PS, 300, 31 + k));
	const sx = scale([0, 1], [630, 930]);
	const sy = scale([0, 1], [440, 140]);
	const paths = curves.map((cv) =>
		linePath(
			cv.map((v, i) => ({ p: PS[i], v })),
			(d) => d.p,
			(d) => d.v,
			sx,
			sy
		)
	);
	const openShare = $derived(cl.open / lat.at.length);
</script>

<g>
	<Readout id="title" order={1} label="Grid" value="{L} × {L}, p = {pct(p)}">
		<Label
			x={24}
			y={34}
			text="Bond percolation on a {L} × {L} grid · p = {pct(p)} · {pct(openShare)} of bonds open"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>
	<Readout
		id="spans"
		order={2}
		label="Top to bottom"
		value={spans ? 'an open path spans' : 'no open path spans'}
		color={spans ? 'var(--rg-giant)' : undefined}
	>
		<Label
			x={24}
			y={58}
			text={spans
				? 'an open path joins the top row to the bottom row: a spanning cluster'
				: `no spanning cluster · largest cluster: ${cl.largestSize} of ${L * L} sites`}
			size={12}
			anchor="start"
			color={spans ? 'var(--rg-giant)' : undefined}
			weight={spans ? 600 : 400}
			tabular
		/>
	</Readout>

	<!-- top and bottom rows (and, for the dual, the left and right outsides) -->
	<rect
		x={GX - 8}
		y={GY - 22}
		width={GW + 16}
		height="8"
		rx="3"
		fill="var(--rg-giant)"
		opacity="0.35"
	/>
	<rect
		x={GX - 8}
		y={GY + GW + 14}
		width={GW + 16}
		height="8"
		rx="3"
		fill="var(--rg-giant)"
		opacity="0.35"
	/>
	<Label x={GX + GW + 22} y={GY - 14} text="top" size={11} anchor="start" muted />
	<Label x={GX + GW + 22} y={GY + GW + 22} text="bottom" size={11} anchor="start" muted />
	{#if dual}
		<rect
			x={GX - 30}
			y={GY - 4}
			width="8"
			height={GW + 8}
			rx="3"
			fill="var(--rg-dual)"
			opacity="0.4"
		/>
		<rect
			x={GX + GW + 22}
			y={GY + 8}
			width="8"
			height={GW - 16}
			rx="3"
			fill="var(--rg-dual)"
			opacity="0.4"
		/>
		<path d={drawn.dualOn} stroke="var(--rg-dual)" stroke-width="1.2" opacity="0.55" fill="none" />
		<path
			d={drawn.dualCross}
			stroke="var(--rg-dual)"
			stroke-width="3"
			fill="none"
			stroke-linecap="round"
		/>
	{:else}
		<path d={drawn.closed} stroke="var(--stage-grid)" stroke-width="1" fill="none" />
	{/if}
	<path
		d={drawn.rest}
		stroke="var(--stage-ink-muted)"
		stroke-width={L > 20 ? 1.6 : 2.2}
		fill="none"
		stroke-linecap="round"
	/>
	<path
		d={drawn.hi}
		stroke={spans ? 'var(--rg-giant)' : 'var(--rg-second)'}
		stroke-width={L > 20 ? 2.4 : 3.2}
		fill="none"
		stroke-linecap="round"
	/>

	<!-- the chance of spanning -->
	<Axes
		{sx}
		{sy}
		xLabel="bonds open, p"
		xTicks={[0, 0.25, 0.5, 0.75, 1]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
		xFormat={(v) => `${v * 100} %`}
		yFormat={(v) => `${v * 100} %`}
	/>
	<Label
		x={630}
		y={104}
		text="share of grids that span (300 each)"
		size={11}
		anchor="start"
		muted
	/>
	<line
		x1={sx(0.5)}
		x2={sx(0.5)}
		y1={sy(0)}
		y2={sy(1)}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 4"
	/>
	{#each paths as d, k (SIDES[k])}
		<path {d} fill="none" stroke={sizeColor(k + 1)} stroke-width="2.2" />
	{/each}
	<line x1={sx(p)} x2={sx(p)} y1={sy(0)} y2={sy(1)} stroke="var(--stage-ink)" stroke-width="1.4" />
	<Label x={sx(p)} y={sy(1) - 8} text="p" size={12} weight={600} anchor="middle" italic />
	{#each SIDES as side, k (side)}
		<line
			x1={630 + k * 76}
			x2={654 + k * 76}
			y1={516}
			y2={516}
			stroke={sizeColor(k + 1)}
			stroke-width="2.2"
		/>
		<Label x={660 + k * 76} y={520} text="{side}×{side}" size={11} anchor="start" />
	{/each}
	{#if dual}
		<Readout
			id="dualcross"
			order={3}
			label="Left to right (dual)"
			value={du?.crosses ? 'a dual path spans' : 'no dual path spans'}
			color="var(--rg-dual)"
		>
			<Label
				x={630}
				y={556}
				text={du?.crosses
					? 'the dual crosses left to right: the grid cannot'
					: 'the dual is blocked: the grid crosses top to bottom'}
				size={12}
				anchor="start"
				color="var(--rg-dual)"
				weight={600}
			/>
		</Readout>
	{:else}
		<Label
			x={630}
			y={556}
			text="dashed: p = 1/2, the exact threshold"
			size={11}
			anchor="start"
			muted
		/>
	{/if}
</g>
