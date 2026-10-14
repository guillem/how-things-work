<script lang="ts">
	/**
	 * Three generations of peas: a yellow (YY) and a green (yy) line; their
	 * four children, all yellow and all Yy; and eight children of two of them,
	 * bred by the model (params.again: a new family), where green comes back.
	 * params.genes shows each plant's alleles, the one from the egg cell red and
	 * the one from the pollen blue. Generations appear one after the other in
	 * the first ~2 s; the reduced-motion frame shows all three.
	 */
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { COLOUR, PEA_CHROMOSOMES, breed, genotype } from '../model';
	import Pea from './Pea.svelte';

	let { t, params }: StageProps = $props();

	const showGenes = $derived(Boolean(params.genes ?? false));
	const again = $derived(Number(params.again ?? 0));
	const kids = $derived(
		breed(
			PEA_CHROMOSOMES,
			[COLOUR],
			genotype({ Y: 'Yy' }),
			genotype({ Y: 'Yy' }),
			8,
			1 + again * 7919
		)
	);
	const greens = $derived(kids.filter((k) => k.traits === 'green').length);

	const Y1 = 120;
	const Y2 = 290;
	const Y3 = 462;
	const parents = [
		{ x: 340, g: ['Y', 'Y'], text: 'yellow line' },
		{ x: 620, g: ['y', 'y'], text: 'green line' }
	];
	const f1 = [220, 400, 560, 740];
	const f2x = (i: number) => 165 + i * 90;

	const o1 = $derived(smoothstep(0, 0.4, t));
	const o2 = $derived(smoothstep(0.5, 1.0, t));
	const o3 = (i: number) => smoothstep(1.1 + i * 0.1, 1.5 + i * 0.1, t);
	/** A gentle bob, so the picture is alive but calm. */
	const bob = (i: number) => 2 * Math.sin(t * 1.3 + i * 0.9);
</script>

{#snippet alleles(x: number, y: number, a: string, b: string, o: number)}
	<g opacity={o * (showGenes ? 1 : 0)}>
		<text {x} {y} text-anchor="middle" font-size="15" font-weight="700" font-style="italic">
			<tspan style:fill="var(--mi-mom)">{a}</tspan><tspan style:fill="var(--mi-dad)">{b}</tspan>
		</text>
	</g>
{/snippet}

<g>
	<!-- generation labels -->
	<Readout id="gen1" order={1} label="Parents" value="YY yellow × yy green">
		<Label x={24} y={Y1 + 5} text="parents" size={12} muted anchor="start" opacity={o1} />
	</Readout>
	<Readout id="gen2" order={2} label="Their children" value="all yellow (all Yy)">
		<Label x={24} y={Y2 + 5} text="children" size={12} muted anchor="start" opacity={o2} />
		<Label x={24} y={Y2 + 22} text="all yellow" size={11} muted anchor="start" opacity={o2} />
	</Readout>
	<Readout id="gen3" order={3} label="Grandchildren" value="green: {greens} of 8 (expected 1 in 4)">
		<Label x={24} y={Y3 + 5} text="grandchildren" size={12} muted anchor="start" opacity={o3(0)} />
		<Label
			x={480}
			y={Y3 + 92}
			text="green comes back: {greens} of these 8 (on average 1 in 4)"
			size={13}
			weight={600}
			opacity={o3(7)}
		/>
	</Readout>

	<!-- family lines -->
	<g stroke="var(--stage-line)" stroke-width="1.5" fill="none">
		<path d="M{parents[0].x + 34} {Y1} H{parents[1].x - 34}" opacity={o1} />
		<path
			d="M480 {Y1} V{Y2 - 62} M{f1[0]} {Y2 - 62} H{f1[3]} {f1
				.map((x) => `M${x} ${Y2 - 62} V${Y2 - 32}`)
				.join(' ')}"
			opacity={o2}
		/>
		<path
			d="M{f1[1] + 32} {Y2} H{f1[2] - 32} M480 {Y2} V{Y3 - 62} M{f2x(0)} {Y3 - 62} H{f2x(7)} {[
				0, 1, 2, 3, 4, 5, 6, 7
			]
				.map((i) => `M${f2x(i)} ${Y3 - 62} V${Y3 - 30}`)
				.join(' ')}"
			opacity={o3(0)}
		/>
	</g>
	<text x="480" y={Y1 - 8} text-anchor="middle" font-size="16" class="muted" opacity={o1}>×</text>
	<text x="480" y={Y2 - 8} text-anchor="middle" font-size="16" class="muted" opacity={o2}>×</text>

	{#each parents as p, i (p.x)}
		<Pea x={p.x} y={Y1 + bob(i)} r={26} green={p.g[0] === 'y'} opacity={o1} />
		<Label x={p.x} y={Y1 - 40} text={p.text} size={12} muted opacity={o1} />
		{@render alleles(p.x, Y1 + 50, p.g[0], p.g[1], o1)}
	{/each}
	{#each f1 as x, i (x)}
		<Pea {x} y={Y2 + bob(i + 2)} r={24} opacity={o2} />
		{@render alleles(x, Y2 + 46, 'Y', 'y', o2)}
	{/each}
	{#each kids as k, i (i)}
		<Pea x={f2x(i)} y={Y3 + bob(i + 6)} r={22} green={k.traits === 'green'} opacity={o3(i)} />
		{@render alleles(f2x(i), Y3 + 44, k.fromMother.Y, k.fromFather.Y, o3(i))}
	{/each}
	{#if showGenes}
		<Readout id="carriers" order={4} label="Hidden" value="every child is Yy: a carrier of green">
			<Label x={936} y={Y2 + 5} text="carriers of y" size={12} muted anchor="end" opacity={o2} />
		</Readout>
	{/if}
</g>
