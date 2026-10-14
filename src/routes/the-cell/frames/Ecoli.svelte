<script lang="ts" module>
	/**
	 * One E. coli cell in section, in micrometres (bacterium.ts): the envelope
	 * (outer membrane, periplasm with the peptidoglycan wall, inner membrane;
	 * ≈ 34 nm), the nucleoid where the chromosome lies, and the ≈ 300 ribosomes
	 * a thin slice cuts (25 nm each), with the neighbouring cells and flagella.
	 */
	import { colony, ecoliSection, envelopeThickness, ECOLI, flagellumPath } from '../bacterium';
	import { capsulePath, circlePath, polyline } from './types';

	const S = ecoliSection();
	const c = S.cell;
	const others = colony().slice(1);
	const otherBodies = others.map((o) => capsulePath(o.x, o.y, o.a, o.b, o.angle)).join('');
	const outer = capsulePath(c.x, c.y, c.a, c.b, c.angle);
	const om = ECOLI.outerMembrane;
	const pgMid = om + ECOLI.periplasm / 2;
	const imMid = om + ECOLI.periplasm + ECOLI.innerMembrane / 2;
	const ring = (d: number) => capsulePath(c.x, c.y, c.a - d, c.b - d, c.angle);
	const nucleoid = polyline(S.nucleoid, true);
	const ribosomes = S.ribosomes.map(([x, y]) => circlePath(x, y, ECOLI.ribosome / 2)).join('');
	const inside = ring(envelopeThickness);
</script>

<script lang="ts">
	import Part from './Part.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, t, reduced, sel, pick, interactive }: FrameProps = $props();
	const hair = (px: number, trueUm = 0) => Math.max(trueUm, px / ppu);
	const detail = $derived(smoothstep(500, 1200, ppu));
	const shift = $derived(reduced ? 0 : t * 0.6);
	const flagella = $derived(
		colony()
			.flatMap((b) => b.flagella.map((f) => polyline(flagellumPath(b, f, shift, 0.04))))
			.join('')
	);
</script>

<g>
	<rect x="-8" y="-6" width="16" height="12" fill="var(--tc-medium)" />
	<Part id="flagellum" {sel} {pick} {interactive}>
		<path
			d={flagella}
			fill="none"
			stroke="var(--tc-flagellum)"
			stroke-width={hair(0.9, ECOLI.flagellum.width)}
			stroke-linecap="round"
		/>
	</Part>
	<Part id="colony" {sel} {pick} {interactive}>
		<path
			d={otherBodies}
			fill="var(--tc-ecoli)"
			stroke="var(--tc-envelope-b)"
			stroke-width={hair(1.2, envelopeThickness)}
		/>
	</Part>
	<Part id="envelope" {sel} {pick} {interactive}>
		<path d={outer} fill="var(--tc-periplasm)" />
		<path d={ring(om / 2)} fill="none" stroke="var(--tc-envelope-b)" stroke-width={hair(1, om)} />
		<path
			d={ring(pgMid)}
			fill="none"
			stroke="var(--tc-pg)"
			stroke-width={ECOLI.peptidoglycan}
			opacity={detail}
		/>
		<path
			d={ring(imMid)}
			fill="none"
			stroke="var(--tc-envelope-b)"
			stroke-width={hair(0.8, ECOLI.innerMembrane)}
		/>
	</Part>
	<Part id="cytosol" {sel} {pick} {interactive}>
		<path d={inside} fill="var(--tc-ecoli)" />
	</Part>
	<Part id="nucleoid" {sel} {pick} {interactive}>
		<path d={nucleoid} fill="var(--tc-nucleoid)" />
	</Part>
	<Part id="ribosome70S" {sel} {pick} {interactive}>
		<path d={ribosomes} fill="var(--tc-ribosome)" opacity="0.8" />
	</Part>
</g>
