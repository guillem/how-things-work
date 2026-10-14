<script lang="ts">
	/**
	 * A pea cell with three of its seven chromosome pairs in the nucleus (not
	 * yet copied: one rod per chromosome), the mother's copy red and the
	 * father's blue, with Mendel's three genes as bands. On the right, the
	 * plant those alleles make (pairs step) or what each genotype looks like
	 * (alleles step, which brings the seed-colour pair into focus).
	 *
	 * The chromosomes drift gently with t; reduced motion freezes them.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Tween } from 'svelte/motion';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { untrack } from 'svelte';
	import { cubicInOut } from 'svelte/easing';
	import { PEA_CHROMOSOMES, PEA_GENES, genotype } from '../model';
	import Chromatid from './Chromatid.svelte';
	import Pea from './Pea.svelte';
	import Flower from './Flower.svelte';

	let { step, t }: StageProps = $props();

	const alleles = $derived(step.hints?.focus === 'alleles');
	const focus = new Tween(0, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = alleles ? 1 : 0;
		untrack(() => focus.set(v));
	});

	const plant = genotype({ R: 'Rr', Y: 'Yy', A: 'Aa' });
	const SCALE = 150;
	const CX = [200, 300, 400];
	const pairName = ['long pair', 'middle pair', 'short pair'];

	const rods = $derived(
		PEA_CHROMOSOMES.map((k, p) => {
			const len = k.length * SCALE;
			const genes = PEA_GENES.filter((g) => g.chromosome === p);
			return [0, 1].map((h) => ({
				key: `${p}-${h}`,
				p,
				x: CX[p] + (h ? 17 : -17) + 3 * Math.sin(t * 0.7 + p * 2 + h),
				y: 318 - len / 2 + 4 * Math.sin(t * 0.5 + p + h * 1.7),
				len: k.length,
				segments: [{ to: k.length, origin: h as 0 | 1 }],
				genes: genes.map((g) => ({ at: g.at, letter: plant[g.id][h] }))
			}));
		}).flat()
	);
	const dim = (p: number) => 1 - focus.current * (p === 1 ? 0 : 0.55);
	const panelA = $derived(1 - smoothstep(0.2, 0.8, focus.current));
	const panelB = $derived(smoothstep(0.2, 0.8, focus.current));

	const traits = [
		{ id: 'R', text: 'seed shape', a: 'R round', b: 'r wrinkled' },
		{ id: 'Y', text: 'seed colour', a: 'Y yellow', b: 'y green' },
		{ id: 'A', text: 'flower colour', a: 'A purple', b: 'a white' }
	];
	const rows = [
		{ g: 'YY', green: false, text: 'yellow' },
		{ g: 'Yy', green: false, text: 'yellow' },
		{ g: 'yy', green: true, text: 'green' }
	];
	const shapes = [
		{ g: 'RR', w: false, text: 'round' },
		{ g: 'Rr', w: false, text: 'round' },
		{ g: 'rr', w: true, text: 'wrinkled' }
	];
</script>

<g>
	<!-- cell and nucleus -->
	<ellipse
		cx="300"
		cy="318"
		rx="272"
		ry="262"
		fill="var(--mi-cell)"
		stroke="var(--mi-cell-edge)"
		stroke-width="1.5"
	/>
	<circle
		cx="300"
		cy="318"
		r="188"
		fill="var(--mi-nucleus)"
		stroke="var(--mi-cell-edge)"
		stroke-width="1.2"
	/>
	<Readout id="cellname">
		<Label x={300} y={46} text="a pea cell (3 of its 7 chromosome pairs drawn)" size={13} muted />
		<Label x={300} y={120} text="nucleus" size={11} muted />
	</Readout>

	{#each rods as r (r.key)}
		<Chromatid
			x={r.x}
			y={r.y}
			length={r.len}
			scale={SCALE}
			segments={r.segments}
			genes={r.genes}
			width={14}
			opacity={dim(r.p)}
		/>
	{/each}
	{#each PEA_CHROMOSOMES as k, p (k.id)}
		<Readout id="pair{p}">
			<Label
				x={CX[p]}
				y={318 + (k.length * SCALE) / 2 + 30}
				text={pairName[p]}
				size={12}
				muted
				opacity={dim(p)}
			/>
		</Readout>
	{/each}

	<!-- right: the plant (pairs) -->
	{#if panelA > 0.02}<g opacity={panelA}>
			<Readout
				id="legend-mom"
				order={1}
				label="Red: copy from the plant’s mother"
				color="var(--mi-mom)"
				opacity={panelA}
			>
				<rect x="610" y="78" width="26" height="12" rx="6" fill="var(--mi-mom)" />
				<Label x={646} y={89} text="copy from the plant’s mother" anchor="start" />
			</Readout>
			<Readout
				id="legend-dad"
				order={2}
				label="Blue: copy from its father"
				color="var(--mi-dad)"
				opacity={panelA}
			>
				<rect x="610" y="106" width="26" height="12" rx="6" fill="var(--mi-dad)" />
				<Label x={646} y={117} text="copy from its father" anchor="start" />
			</Readout>
			<Readout
				id="genes"
				order={3}
				label="Genes"
				value="R seed shape · Y seed colour · A flower colour"
				opacity={panelA}
			>
				{#each traits as tr, i (tr.id)}
					<text x="612" y={176 + i * 44} font-size="14" font-weight="700" font-style="italic"
						>{tr.id}</text
					>
					<text x="636" y={176 + i * 44} font-size="13">{tr.text}</text>
					<text x="636" y={194 + i * 44} font-size="11" class="muted">{tr.a} · {tr.b}</text>
				{/each}
			</Readout>
			<line x1="610" x2="930" y1="320" y2="320" stroke="var(--stage-line)" />
			<Readout
				id="plant"
				order={4}
				label="This plant"
				value="Rr Yy Aa: round yellow seeds, purple flowers"
				opacity={panelA}
			>
				<text x="612" y="350" font-size="13" font-weight="600">This plant: Rr Yy Aa</text>
				<text x="612" y="370" font-size="11" class="muted"
					>one allele of each gene from each parent</text
				>
			</Readout>
			<Pea x={650} y={420} r={16} />
			<Pea x={690} y={426} r={16} />
			<Label x={670} y={460} text="seeds: round, yellow" size={11} muted />
			<Flower x={830} y={420} r={20} />
			<Label x={830} y={456} text="purple flowers" size={11} muted />
			<Readout id="hint">
				<Label x={770} y={510} text="it shows the dominant trait of each pair" size={11} muted />
			</Readout>
		</g>{/if}

	<!-- right: genotypes and traits (alleles) -->
	{#if panelB > 0.02}<g opacity={panelB}>
			<Readout
				id="col-title"
				order={1}
				label="Seed colour"
				value="YY, Yy: yellow · yy: green"
				opacity={panelB}
			>
				<text x="612" y="72" font-size="14" font-weight="600">Seed colour</text>
				{#each rows as row, i (row.g)}
					{@const y = 112 + i * 52}
					<rect
						x="606"
						y={y - 22}
						width="320"
						height="44"
						rx="8"
						fill="var(--mi-box)"
						stroke="var(--border)"
					/>
					<text x="624" y={y + 6} font-size="17" font-weight="700" font-style="italic">
						<tspan style:fill="var(--mi-mom)">{row.g[0]}</tspan><tspan style:fill="var(--mi-dad)"
							>{row.g[1]}</tspan
						>
					</text>
					<Pea x={712} {y} r={13} green={row.green} />
					<text x="738" y={y + 5} font-size="13">{row.text}</text>
				{/each}
			</Readout>
			<Readout
				id="shape-title"
				order={2}
				label="Seed shape"
				value="RR, Rr: round · rr: wrinkled"
				opacity={panelB}
			>
				<text x="612" y="300" font-size="14" font-weight="600">Seed shape</text>
				{#each shapes as row, i (row.g)}
					{@const y = 340 + i * 52}
					<rect
						x="606"
						y={y - 22}
						width="320"
						height="44"
						rx="8"
						fill="var(--mi-box)"
						stroke="var(--border)"
					/>
					<text x="624" y={y + 6} font-size="17" font-weight="700" font-style="italic">
						<tspan style:fill="var(--mi-mom)">{row.g[0]}</tspan><tspan style:fill="var(--mi-dad)"
							>{row.g[1]}</tspan
						>
					</text>
					<Pea x={712} {y} r={13} wrinkled={row.w} />
					<text x="738" y={y + 5} font-size="13">{row.text}</text>
				{/each}
			</Readout>
			<Readout
				id="dominant"
				order={3}
				label="Dominant"
				value="one copy is enough to show"
				opacity={panelB}
			>
				<Label x={766} y={530} text="one dominant allele is enough to show" size={12} muted />
			</Readout>
		</g>{/if}
</g>
