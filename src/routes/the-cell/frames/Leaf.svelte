<script lang="ts" module>
	/**
	 * A leaf in cross-section, ≈ 0.24 mm thick, in micrometres (paths in
	 * plant-paths.ts, sizes in plant.ts): the upper and lower skin (epidermis,
	 * with a waxy cuticle and pores, the stomata), the palisade layer of tall
	 * cells and the spongy layer with air spaces. Each cell shows its wall, its
	 * vacuole and chloroplasts ≈ 5 µm long lining the walls.
	 */
	import {
		chl,
		epidermis,
		guard,
		nuclei,
		palisadePath,
		spongy,
		target,
		targetChl,
		top
	} from '../plant-paths';
</script>

<script lang="ts">
	import Part from './Part.svelte';
	import type { FrameProps } from './types';

	let { ppu, sel, pick, interactive }: FrameProps = $props();
	const hair = (px: number) => px / ppu;
</script>

<g>
	<rect x="-500" y="-320" width="1000" height="640" fill="var(--tc-air)" />
	<Part id="leaf" {sel} {pick} {interactive}>
		<path
			d={epidermis}
			fill="var(--tc-epidermis)"
			stroke="var(--tc-wall-edge)"
			stroke-width={hair(1)}
		/>
		<rect
			x="-500"
			y={top - 1.5}
			width="1000"
			height="1.5"
			fill="var(--tc-wall-edge)"
			opacity="0.6"
		/>
		<path
			d={guard}
			fill="var(--tc-chloroplast)"
			stroke="var(--tc-wall-edge)"
			stroke-width={hair(1)}
		/>
		<path d={spongy} fill="var(--tc-vacuole)" stroke="var(--tc-wall-edge)" stroke-width={hair(1)} />
	</Part>
	<Part id="mesophyllCell" {sel} {pick} {interactive}>
		<path
			d={palisadePath}
			fill="var(--tc-vacuole)"
			stroke="var(--tc-wall-edge)"
			stroke-width={hair(1)}
		/>
		<path d={target} fill="var(--tc-vacuole)" stroke="var(--tc-wall-edge)" stroke-width={hair(1)} />
		<path
			d={nuclei}
			fill="var(--tc-nucleus)"
			stroke="var(--tc-envelope)"
			stroke-width={hair(0.8)}
		/>
	</Part>
	<Part id="chloroplast" {sel} {pick} {interactive}>
		<path
			d={chl + targetChl}
			fill="var(--tc-chloroplast)"
			stroke="var(--tc-chloroplast-edge)"
			stroke-width={hair(0.6)}
		/>
	</Part>
</g>
