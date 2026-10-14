<script lang="ts" module>
	/**
	 * Just under the envelope of E. coli, in nanometres from the view's centre
	 * (molecular.ts): the outer membrane with OmpF porins, the periplasm with the
	 * peptidoglycan mesh, the inner membrane with LacY, then the crowded
	 * cytoplasm: ribosomes (PDB 7K00) where the cell view puts them, proteins at
	 * 3 million per µm³, DNA of the nucleoid's edge, and water at its spacing.
	 */
	import { crowd, ENVELOPE } from '../molecular';
	import { ATOM_SPOTS } from '../frames';

	const C = crowd();
	const E = ENVELOPE;
	const BOX = { x0: -170, x1: 170, y0: -130, y1: 130 };
	const dna = C.dna
		.map((pts) => 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L'))
		.join('');
	// the peptidoglycan wall: glycan strands across, short peptide links between them
	const pg = Array.from(
		{ length: Math.ceil((BOX.x1 - BOX.x0) / 2.2) },
		(_, k) => `M${BOX.x0 + k * 2.2} ${E.pg0 + 1}V${E.pg1 - 1}`
	).join('');
	const [gx, gy] = ATOM_SPOTS.glucose;
</script>

<script lang="ts">
	import Machine from './Machine.svelte';
	import Mol from './Mol.svelte';
	import Part from './Part.svelte';
	import Water from './Water.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, view, sel, pick, interactive }: FrameProps = $props();
	const wet = $derived(smoothstep(16, 32, ppu));
	const near = (x: number, y: number, r = 16) =>
		x > view.x0 - r && x < view.x1 + r && y > view.y0 - r && y < view.y1 + r;
</script>

<g>
	<rect
		x={BOX.x0 - 60}
		y={BOX.y0 - 60}
		width={BOX.x1 - BOX.x0 + 120}
		height={E.om0 - BOX.y0 + 60}
		fill="var(--tc-medium)"
	/>
	<Part id="envelope" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={E.om0}
			width={BOX.x1 - BOX.x0 + 120}
			height={E.im1 - E.om0}
			fill="var(--tc-periplasm)"
		/>
		<rect
			x={BOX.x0 - 60}
			y={E.om0}
			width={BOX.x1 - BOX.x0 + 120}
			height={E.om1 - E.om0}
			fill="var(--tc-lipid-head)"
		/>
		<rect
			x={BOX.x0 - 60}
			y={E.om0 + 1.4}
			width={BOX.x1 - BOX.x0 + 120}
			height={E.om1 - E.om0 - 2.8}
			fill="var(--tc-lipid)"
		/>
		<path d={pg} stroke="var(--tc-pg)" stroke-width="0.8" />
		<rect x={BOX.x0 - 60} y={E.pg0} width={BOX.x1 - BOX.x0 + 120} height="1" fill="var(--tc-pg)" />
		<rect
			x={BOX.x0 - 60}
			y={E.pg1 - 1}
			width={BOX.x1 - BOX.x0 + 120}
			height="1"
			fill="var(--tc-pg)"
		/>
		<rect
			x={BOX.x0 - 60}
			y={E.im0}
			width={BOX.x1 - BOX.x0 + 120}
			height={E.im1 - E.im0}
			fill="var(--tc-lipid-head)"
		/>
		<rect
			x={BOX.x0 - 60}
			y={E.im0 + 1.2}
			width={BOX.x1 - BOX.x0 + 120}
			height={E.im1 - E.im0 - 2.4}
			fill="var(--tc-lipid)"
		/>
	</Part>
	<Part id="cytosol" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={E.im1}
			width={BOX.x1 - BOX.x0 + 120}
			height={BOX.y1 - E.im1 + 60}
			fill="var(--tc-ecoli)"
		/>
	</Part>
	{#if wet > 0}
		<Water
			id="cytoplasm"
			x0={BOX.x0 - 60}
			y0={BOX.y0 - 60}
			w={BOX.x1 - BOX.x0 + 120}
			h={BOX.y1 - BOX.y0 + 120}
			opacity={wet * 0.5}
		/>
	{/if}
	<Part id="dna" {sel} {pick} {interactive}>
		<path
			d={dna}
			fill="none"
			stroke="var(--tc-dna)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</Part>
	<Part id="protein" {sel} {pick} {interactive}>
		{#each C.proteins as p, i (i)}
			{#if near(p.x, p.y)}
				<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} />
			{/if}
		{/each}
	</Part>
	<Part id="ribosome70S" {sel} {pick} {interactive}>
		{#each C.ribosomes as p, i (i)}
			{#if near(p.x, p.y, 20)}
				<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} />
			{/if}
		{/each}
	</Part>
	<Part id="envelope" {sel} {pick} {interactive}>
		{#each C.membrane as m, i (i)}
			{#if near(m.x, m.y)}
				<Machine id={m.id} x={m.x} y={m.y} flip={m.flip} />
			{/if}
		{/each}
	</Part>
	<Part id="glucose" {sel} {pick} {interactive}>
		<Mol id="glucose" x={gx} y={gy} angle={0.4} />
	</Part>
</g>
