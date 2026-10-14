<script lang="ts">
	/**
	 * Crosses, in three modes (hint `mode`):
	 *  - punnett: a 2 × 2 Punnett square for the seed-colour gene, parents
	 *    chosen with params mom / dad, and the expected shares on the right;
	 *  - breed: hybrid × hybrid for one of Mendel's genes (param gene), with
	 *    params.count offspring bred by the model (a meiosis per parent per
	 *    seed); the first 100 are drawn, and the counts grow over the first
	 *    2.4 s next to the expected share and Mendel's own;
	 *  - dihybrid: RrYy × RrYy, the 4 × 4 square, and params.count2 bred seeds
	 *    against 9 : 3 : 3 : 1 and Mendel's 315 : 108 : 101 : 32.
	 * Reduced motion (t = 2.5 s) shows every box filled and every count final.
	 */
	import { Label, clamp, easeOut, smoothstep } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		COLOUR,
		FLOWER,
		MENDEL,
		PEA_CHROMOSOMES,
		SHAPE,
		breed,
		expected,
		genotype,
		tally,
		type Gene
	} from '../model';
	import Pea from './Pea.svelte';
	import Flower from './Flower.svelte';

	let { step, t, params }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'punnett'));
	const mom = $derived(String(params.mom ?? 'Yy'));
	const dad = $derived(String(params.dad ?? 'Yy'));
	const geneId = $derived(String(params.gene ?? 'Y'));
	const gene: Gene = $derived(geneId === 'R' ? SHAPE : geneId === 'A' ? FLOWER : COLOUR);
	const again = $derived(Number(params.again ?? 0));
	const n = $derived(
		mode === 'dihybrid' ? Number(params.count2 ?? 556) : Number(params.count ?? 400)
	);

	// ----------------------------------------------------------------- squares
	interface Box {
		key: string;
		x: number;
		y: number;
		size: number;
		name: string;
		mother: string;
		father: string;
		green: boolean;
		wrinkled: boolean;
		appear: number;
	}
	const square = $derived.by(() => {
		if (mode === 'dihybrid') {
			const g = ['RY', 'Ry', 'rY', 'ry'];
			const size = 78;
			return {
				rows: g,
				cols: g,
				x0: 118,
				y0: 132,
				size,
				boxes: g.flatMap((a, i) =>
					g.map((b, j): Box => ({
						key: `${i}${j}`,
						x: 118 + j * size,
						y: 132 + i * size,
						size,
						name: `${[a[0], b[0]].sort().join('')}${[a[1], b[1]].sort().join('')}`,
						mother: a,
						father: b,
						green: a[1] === 'y' && b[1] === 'y',
						wrinkled: a[0] === 'r' && b[0] === 'r',
						appear: 0.2 + (i * 4 + j) * 0.11
					}))
				)
			};
		}
		const rows = mode === 'breed' ? [gene.dominant, gene.recessive] : [mom[0], mom[1]];
		const cols = mode === 'breed' ? [gene.dominant, gene.recessive] : [dad[0], dad[1]];
		const size = 130;
		return {
			rows,
			cols,
			x0: 150,
			y0: 150,
			size,
			boxes: rows.flatMap((a, i) =>
				cols.map((b, j): Box => ({
					key: `${i}${j}`,
					x: 150 + j * size,
					y: 150 + i * size,
					size,
					name: [a, b].sort().join(''),
					mother: a,
					father: b,
					green: a === 'y' && b === 'y',
					wrinkled: a === 'r' && b === 'r',
					appear: 0.3 + (i * 2 + j) * 0.4
				}))
			)
		};
	});
	const shown = (b: Box) => smoothstep(b.appear, b.appear + 0.35, t);
	const breedMode = $derived(mode === 'breed');
	/** Once the square is full, one box after another lights up with the egg cell and pollen that make it. */
	const lit = $derived(t > 2.6 ? Math.floor((t - 2.6) / 1.3) % square.boxes.length : -1);

	// --------------------------------------------------------------- breeding
	const genes = $derived(mode === 'dihybrid' ? [SHAPE, COLOUR] : [gene]);
	const parent = $derived(
		mode === 'dihybrid'
			? genotype({ R: 'Rr', Y: 'Yy' })
			: mode === 'punnett'
				? null
				: genotype({ [gene.id]: gene.dominant + gene.recessive })
	);
	const punnettParents = $derived({ m: genotype({ Y: mom }), d: genotype({ Y: dad }) });
	const exp = $derived(
		parent
			? expected(genes, parent, parent)
			: expected([COLOUR], punnettParents.m, punnettParents.d)
	);
	const kids = $derived(
		parent ? breed(PEA_CHROMOSOMES, genes, parent, parent, n, 1000 + again * 7919 + n) : []
	);
	const grow = $derived(easeOut(clamp(t / 2.4)));
	const upTo = $derived(Math.round(kids.length * grow));
	const counts = $derived(tally(kids, upTo));

	const categories = $derived(
		mode === 'dihybrid'
			? ['round, yellow', 'round, green', 'wrinkled, yellow', 'wrinkled, green']
			: mode === 'punnett'
				? ['yellow', 'green']
				: [gene.dominantTrait, gene.recessiveTrait]
	);
	const mendel = $derived.by((): Record<string, number> | null => {
		if (mode === 'dihybrid') return MENDEL.dihybrid;
		if (mode === 'punnett') return null;
		return gene.id === 'R' ? MENDEL.shape : gene.id === 'A' ? MENDEL.flower : MENDEL.colour;
	});
	const mendelTotal = $derived(mendel ? Object.values(mendel).reduce((a, b) => a + b, 0) : 0);
	const BAR_X = 560;
	const BAR_W = 340;
	const rowY = (i: number) => (mode === 'dihybrid' ? 180 + i * 78 : 200 + i * 110);

	const icon = (cat: string) => ({
		green: cat.includes('green'),
		wrinkled: cat.includes('wrinkled'),
		flower: cat === 'purple' || cat === 'white',
		white: cat === 'white'
	});
	const fmt = (v: number) => v.toLocaleString('en-GB');
	const pct = (v: number) => (v === 0 ? '0%' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);
	const ratio = $derived.by(() => {
		if (mode === 'dihybrid') {
			const w = counts.get('wrinkled, green') ?? 0;
			if (!w) return '';
			return categories.map((c) => ((counts.get(c) ?? 0) / w).toFixed(1)).join(' : ');
		}
		const a = counts.get(categories[0]) ?? 0;
		const b = counts.get(categories[1]) ?? 0;
		return b ? `${(a / b).toFixed(2)} : 1` : a ? 'none recessive yet' : '';
	});
	const expRatio = $derived.by(() => {
		if (mode === 'dihybrid') return '9 : 3 : 3 : 1';
		const a = exp.get(categories[0]) ?? 0;
		const b = exp.get(categories[1]) ?? 0;
		if (!b) return `all ${categories[0]}`;
		if (!a) return `all ${categories[1]}`;
		return `${(a / b).toFixed(0)} : 1`;
	});
	const total = $derived([...counts.values()].reduce((a, b) => a + b, 0));

	// Grid of the first 100 offspring (breed mode).
	const grid = $derived(
		kids.slice(0, 100).map((k, i) => ({
			i,
			x: 82 + (i % 10) * 38,
			y: 130 + Math.floor(i / 10) * 38,
			cat: k.traits,
			show: smoothstep(i * 0.022, i * 0.022 + 0.15, t)
		}))
	);
	const parentLabel = $derived(mode === 'dihybrid' ? 'Rr Yy' : `${gene.dominant}${gene.recessive}`);
</script>

<g>
	{#if !breedMode}
		<!-- the Punnett square -->
		{@const sq = square}
		<Readout
			id="sq-title"
			order={1}
			label="Cross"
			value={mode === 'dihybrid' ? 'Rr Yy × Rr Yy' : `${mom} × ${dad}`}
		>
			<Label
				x={sq.x0 + (sq.cols.length * sq.size) / 2}
				y={sq.y0 - 62}
				text="pollen from the {mode === 'dihybrid' ? 'Rr Yy' : dad} plant"
				size={12}
				muted
			/>
			<Label
				x={sq.x0 - 62}
				y={sq.y0 + (sq.rows.length * sq.size) / 2}
				text="egg cells from the {mode === 'dihybrid' ? 'Rr Yy' : mom} plant"
				size={12}
				muted
				rotate={-90}
			/>
		</Readout>
		{#each sq.cols as c, j (j)}
			<text
				x={sq.x0 + (j + 0.5) * sq.size}
				y={sq.y0 - 22}
				text-anchor="middle"
				font-size={mode === 'dihybrid' ? 15 : 20}
				font-weight="700"
				font-style="italic"
				opacity={lit < 0 || sq.boxes[lit].key[1] === String(j) ? 1 : 0.4}
				style:fill="var(--mi-dad)">{c}</text
			>
		{/each}
		{#each sq.rows as r, i (i)}
			<text
				x={sq.x0 - 22}
				y={sq.y0 + (i + 0.5) * sq.size + 6}
				text-anchor="middle"
				font-size={mode === 'dihybrid' ? 15 : 20}
				font-weight="700"
				font-style="italic"
				opacity={lit < 0 || sq.boxes[lit].key[0] === String(i) ? 1 : 0.4}
				style:fill="var(--mi-mom)">{r}</text
			>
		{/each}
		{#each sq.boxes as b (b.key)}
			{@const o = shown(b)}
			<rect
				x={b.x + 2}
				y={b.y + 2}
				width={b.size - 4}
				height={b.size - 4}
				rx="8"
				fill="var(--mi-box)"
				stroke={sq.boxes[lit] === b ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
				stroke-width={sq.boxes[lit] === b ? 2.5 : 1}
			/>
			<g opacity={o}>
				<Pea
					x={b.x + b.size / 2}
					y={b.y + b.size * 0.42}
					r={mode === 'dihybrid' ? 14 : 26}
					green={b.green}
					wrinkled={b.wrinkled}
				/>
				<text
					x={b.x + b.size / 2}
					y={b.y + b.size * (mode === 'dihybrid' ? 0.86 : 0.84)}
					text-anchor="middle"
					font-size={mode === 'dihybrid' ? 11 : 15}
					font-weight="600"
					font-style="italic">{b.name}</text
				>
			</g>
		{/each}
	{:else}
		<!-- the first 100 offspring -->
		<Readout
			id="grid-title"
			order={1}
			label="Cross"
			value="{parentLabel} × {parentLabel}, {fmt(n)} offspring"
		>
			<Label
				x={253}
				y={84}
				text="{parentLabel} × {parentLabel}: the first {Math.min(100, n)} of {fmt(n)}"
				size={13}
				muted
			/>
		</Readout>
		{#each grid as k (k.i)}
			{@const ic = icon(k.cat)}
			{#if ic.flower}
				<Flower x={k.x} y={k.y} r={13} white={ic.white} opacity={k.show} />
			{:else}
				<Pea x={k.x} y={k.y} r={13} green={ic.green} wrinkled={ic.wrinkled} opacity={k.show} />
			{/if}
		{/each}
	{/if}

	<!-- shares: expected, bred, Mendel's -->
	<Readout id="head" order={2} label="Expected" value={expRatio}>
		<text x={BAR_X} y={mode === 'dihybrid' ? 96 : 110} font-size="15" font-weight="600">
			{mode === 'punnett' ? 'Expected seeds' : `Bred: ${fmt(total)} seeds`}
		</text>
		<text x={BAR_X} y={mode === 'dihybrid' ? 118 : 132} font-size="12" class="muted">
			expected {expRatio}{mode === 'punnett' ? '' : ` · bred ${ratio || '…'}`}
		</text>
	</Readout>
	{#each categories as cat, i (cat)}
		{@const y = rowY(i)}
		{@const e = exp.get(cat) ?? 0}
		{@const c = counts.get(cat) ?? 0}
		{@const obs = total ? c / total : 0}
		{@const ic = icon(cat)}
		{#if ic.flower}
			<Flower x={BAR_X + 12} y={y - 22} r={11} white={ic.white} />
		{:else}
			<Pea x={BAR_X + 12} y={y - 22} r={11} green={ic.green} wrinkled={ic.wrinkled} />
		{/if}
		<Readout
			id="row{i}"
			order={3 + i}
			label={cat}
			value={mode === 'punnett' ? pct(e) : `${fmt(c)} (${pct(obs)}), expected ${pct(e)}`}
		>
			<text x={BAR_X + 32} y={y - 17} font-size="13">{cat}</text>
			<text x={BAR_X + BAR_W} y={y - 17} font-size="13" text-anchor="end" font-weight="600">
				{mode === 'punnett' ? pct(e) : `${fmt(c)} · ${pct(obs)}`}
			</text>
		</Readout>
		<rect x={BAR_X} y={y - 4} width={BAR_W} height="16" rx="4" fill="var(--stage-grid)" />
		<rect
			x={BAR_X}
			y={y - 4}
			width={BAR_W * (mode === 'punnett' ? e * smoothstep(1.4, 2.2, t) : obs)}
			height="16"
			rx="4"
			fill={ic.flower
				? ic.white
					? 'var(--mi-flower-white)'
					: 'var(--mi-flower)'
				: ic.green
					? 'var(--mi-pea-green)'
					: 'var(--mi-pea-yellow)'}
			stroke="var(--stage-ink-muted)"
			stroke-width="0.6"
		/>
		{#if mode !== 'punnett'}
			<line
				x1={BAR_X + BAR_W * e}
				x2={BAR_X + BAR_W * e}
				y1={y - 9}
				y2={y + 17}
				stroke="var(--stage-ink)"
				stroke-width="2"
			/>
		{/if}
		{#if mendel}
			{@const m = (mendel[cat] ?? 0) / mendelTotal}
			<path
				d="M{BAR_X + BAR_W * m} {y + 14} l-5 9 h10 z"
				fill="var(--explainer-accent, var(--accent))"
			/>
			{#if i === categories.length - 1}
				<Readout
					id="mendel"
					order={8}
					label="Mendel"
					value={categories.map((k) => fmt(mendel[k] ?? 0)).join(' : ')}
				>
					<path
						d="M{BAR_X} {y + 46} l-5 9 h10 z"
						fill="var(--explainer-accent, var(--accent))"
						transform="translate(5 -9)"
					/>
					<text x={BAR_X + 16} y={y + 46} font-size="12" class="muted">
						Mendel: {categories.map((k) => fmt(mendel[k] ?? 0)).join(' : ')}
					</text>
					<line
						x1={BAR_X + 2}
						x2={BAR_X + 2}
						y1={y + 56}
						y2={y + 70}
						stroke="var(--stage-ink)"
						stroke-width="2"
					/>
					<text x={BAR_X + 16} y={y + 68} font-size="12" class="muted">expected share</text>
				</Readout>
			{/if}
		{/if}
	{/each}
	{#if mode === 'punnett'}
		<Readout id="each" order={8} label="Each box" value="equally likely: 1 in 4">
			<Label
				x={BAR_X + BAR_W / 2}
				y={470}
				text="each box is equally likely: 1 in 4"
				size={12}
				muted
			/>
		</Readout>
	{/if}
</g>
