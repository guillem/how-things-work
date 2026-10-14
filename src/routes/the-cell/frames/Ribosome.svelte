<script lang="ts" module>
	/**
	 * Ribosomes on the rough ER, in nanometres from the view's centre: the ER
	 * membrane (4 nm) at y = −12 with the lumen above and the cytosol below;
	 * mammalian ribosomes docked on the Sec61 channel (PDB 3J7R, placed in the
	 * membrane as OPM computes), 37 nm apart as the measured density of 1,000 per
	 * µm² gives in a thin slice; cytosolic proteins at the measured density.
	 */
	import { ER, ER_RIBOSOMES, scatter } from '../molecular';
	import { MACHINES } from '../shapes';

	const BOX = { x0: -140, x1: 140, y0: -100, y1: 100 };
	const rib = MACHINES.ribosome80S;
	const proteins = scatter(
		31,
		{ ...BOX, y0: ER.membrane + 3 },
		(x, y, r) =>
			ER_RIBOSOMES.some(
				(q) =>
					x > q.x - rib.width / 2 - r && x < q.x + rib.width / 2 + r && y < q.y + rib.bottom + r
			),
		[
			{ id: 'adk', share: 0.7, d: 5 },
			{ id: 'efTuTrna', share: 0.15, d: 8 }
		]
	);
</script>

<script lang="ts">
	import Machine from './Machine.svelte';
	import Part from './Part.svelte';
	import Water from './Water.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, sel, pick, interactive }: FrameProps = $props();
	const wet = $derived(smoothstep(16, 32, ppu));
</script>

<g>
	<Part id="cytosol" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={ER.membrane}
			width={BOX.x1 - BOX.x0 + 120}
			height={BOX.y1 - ER.membrane + 60}
			fill="var(--tc-cytosol)"
		/>
	</Part>
	<Part id="roughER" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={BOX.y0 - 60}
			width={BOX.x1 - BOX.x0 + 120}
			height={ER.membrane - BOX.y0 + 60}
			fill="var(--tc-er)"
		/>
		<line
			x1={BOX.x0 - 60}
			x2={BOX.x1 + 60}
			y1={ER.membrane}
			y2={ER.membrane}
			stroke="var(--tc-lipid-head)"
			stroke-width="4"
		/>
		<line
			x1={BOX.x0 - 60}
			x2={BOX.x1 + 60}
			y1={ER.membrane}
			y2={ER.membrane}
			stroke="var(--tc-lipid)"
			stroke-width="2.4"
		/>
	</Part>
	{#if wet > 0}
		<Water
			id="ribosome"
			x0={BOX.x0 - 60}
			y0={BOX.y0 - 60}
			w={BOX.x1 - BOX.x0 + 120}
			h={BOX.y1 - BOX.y0 + 120}
			opacity={wet * 0.5}
		/>
	{/if}
	<Part id="protein" {sel} {pick} {interactive}>
		{#each proteins as p, i (i)}
			<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} opacity={0.85} />
		{/each}
	</Part>
	<Part id="ribosome" {sel} {pick} {interactive}>
		{#each ER_RIBOSOMES as m, i (i)}
			<Machine id={m.id} x={m.x} y={m.y} />
		{/each}
	</Part>
	<!-- the channel under each ribosome, drawn again on top so that it can be picked -->
	<Part id="sec61" {sel} {pick} {interactive}>
		{#each ER_RIBOSOMES as m, i (i)}
			<Machine id={m.id} x={m.x} y={m.y} only={['sec61']} />
		{/each}
	</Part>
</g>
