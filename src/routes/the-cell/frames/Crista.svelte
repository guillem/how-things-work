<script lang="ts" module>
	/**
	 * The tip of a crista, in nanometres from the view's centre: a fold of the inner
	 * mitochondrial membrane (lipid bilayer 4 nm) about 34 nm thick, with ATP
	 * synthases (PDB 6ZPO) as a dimer on the ridge and along the faces, matrix
	 * enzymes around them at the measured protein density, ATP at the measured
	 * 3.4 mM, and water as a texture at its real spacing.
	 */
	import { ATOM_SPOTS } from '../frames';
	import {
		CRISTA,
		CRISTA_MACHINES,
		ATP_PER_NM3,
		scatter,
		scatterSmall,
		headCentre
	} from '../molecular';
	import { SMALL_MOLECULES } from '../shapes';
	import { colors } from '#lib/draw/index.ts';

	const BOX = { x0: -160, x1: 160, y0: -110, y1: 110 };
	const tipX = CRISTA.tip - CRISTA.half;
	const H = CRISTA.half;
	const outline = `M-400 ${-H}H${tipX}A${H} ${H} 0 0 1 ${tipX} ${H}H-400Z`;
	const heads = CRISTA_MACHINES.map(headCentre);
	const inFold = (x: number, y: number, r: number) =>
		x < CRISTA.tip + r + 2 && Math.abs(y) < H + 2 + r;
	const nearHead = (x: number, y: number, r: number) =>
		heads.some(([hx, hy]) => Math.hypot(hx - x, hy - y) < 9 + r);
	const nearStalk = (x: number, y: number, r: number) =>
		CRISTA_MACHINES.some((m) => Math.hypot(m.x - x, m.y - y) < 12 + r);
	const [ax, ay] = ATOM_SPOTS.atp;
	const proteins = scatter(
		61,
		BOX,
		(x, y, r) =>
			inFold(x, y, r) ||
			nearHead(x, y, r) ||
			nearStalk(x, y, r) ||
			Math.hypot(x - ax, y - ay) < r + 2,
		[
			{ id: 'citrateSynthase', share: 0.3, d: 8 },
			{ id: 'adk', share: 0.7, d: 5 }
		]
	);
	// ATP everywhere in the matrix at 3.4 mM, as atom discs merged by element
	const atps = scatterSmall(
		62,
		BOX,
		(x, y) =>
			inFold(x, y, 1) ||
			nearHead(x, y, 1) ||
			Math.hypot(x - ax, y - ay) < 3 ||
			proteins.some((p) => Math.hypot(p.x - x, p.y - y) < 4),
		ATP_PER_NM3,
		1.4
	);
	const R: Record<string, number> = { H: 0.12, C: 0.17, N: 0.155, O: 0.152, P: 0.18 };
	const byEl: Record<string, string> = { H: '', C: '', N: '', O: '', P: '' };
	for (const a of atps) {
		const c = Math.cos(a.angle);
		const s = Math.sin(a.angle);
		for (const [el, x, y] of SMALL_MOLECULES.atp.atoms) {
			const px = a.x + x * c - y * s;
			const py = a.y + x * s + y * c;
			const r = R[el] ?? 0.17;
			byEl[el] +=
				`M${(px - r).toFixed(3)} ${py.toFixed(3)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
		}
	}
	const EL_FILL: Record<string, string> = {
		H: colors.hydrogen,
		C: 'var(--carbon)',
		N: colors.nitrogen,
		O: colors.oxygen,
		P: colors.phosphate
	};
</script>

<script lang="ts">
	import Machine from './Machine.svelte';
	import Mol from './Mol.svelte';
	import Part from './Part.svelte';
	import Water from './Water.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, sel, pick, interactive }: FrameProps = $props();
	const wet = $derived(smoothstep(16, 32, ppu));
</script>

<g>
	<Part id="mitochondrion" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={BOX.y0 - 60}
			width={BOX.x1 - BOX.x0 + 120}
			height={BOX.y1 - BOX.y0 + 120}
			fill="var(--tc-matrix)"
		/>
	</Part>
	{#if wet > 0}
		<Water
			id="crista"
			x0={BOX.x0 - 60}
			y0={BOX.y0 - 60}
			w={BOX.x1 - BOX.x0 + 120}
			h={BOX.y1 - BOX.y0 + 120}
			opacity={wet * 0.6}
		/>
	{/if}
	<Part id="crista" {sel} {pick} {interactive}>
		<path d={outline} fill="var(--tc-mito)" />
		<path d={outline} fill="none" stroke="var(--tc-lipid-head)" stroke-width={CRISTA.membrane} />
		<path d={outline} fill="none" stroke="var(--tc-lipid)" stroke-width={CRISTA.membrane - 1.6} />
	</Part>
	<Part id="protein" {sel} {pick} {interactive}>
		{#each proteins as p, i (i)}
			<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} />
		{/each}
	</Part>
	<Part id="atp" {sel} {pick} {interactive}>
		{#each Object.entries(byEl) as [el, d] (el)}
			<path {d} fill={EL_FILL[el]} />
		{/each}
		<Mol id="atp" x={ax} y={ay} angle={0.3} />
	</Part>
	<Part id="atpSynthase" {sel} {pick} {interactive}>
		{#each CRISTA_MACHINES as m, i (i)}
			<Machine id={m.id} x={m.x} y={m.y} angle={m.angle} flip={m.flip} />
		{/each}
	</Part>
</g>
