<script lang="ts" module>
	/**
	 * The edge of a granum, in nanometres from the view's centre: stacked
	 * thylakoids (membrane 4.9 nm around a 9 nm lumen, 3.6 nm apart; BNID
	 * 111325–7) ending at x = 20, the middle one going on to the right as an
	 * unstacked lamella. Photosystem II with its antennae and cytochrome b₆f sit in
	 * the stacked membranes; photosystem I and ATP synthase in the lamella facing
	 * the stroma (lateral heterogeneity), all as OPM orients them; Rubisco in the
	 * stroma.
	 */
	import { GRANUM_EDGE, STROMA_RUBISCO, THYLAKOIDS, THYLAKOID_MACHINES } from '../molecular';
	import { THYLAKOID } from '../plant';

	const lum = THYLAKOID.lumen * 1000;
	const mem = THYLAKOID.membrane * 1000;
	const half = (lum + mem) / 2;
	const bar = (y: number, x1: number) =>
		`M-400 ${y - half}H${x1 - half}A${half} ${half} 0 0 1 ${x1 - half} ${y + half}H-400Z`;
	const stacks = THYLAKOIDS.map((y, k) => bar(y, k === 2 ? 400 : GRANUM_EDGE)).join('');
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
	<Part id="chloroplast" {sel} {pick} {interactive}>
		<rect x="-260" y="-200" width="520" height="400" fill="var(--tc-stroma)" />
	</Part>
	{#if wet > 0}
		<Water id="thylakoid" x0={-260} y0={-200} w={520} h={400} opacity={wet * 0.5} />
	{/if}
	<Part id="thylakoid" {sel} {pick} {interactive}>
		<path d={stacks} fill="var(--tc-lumen)" stroke="var(--tc-granum)" stroke-width={mem} />
	</Part>
	<Part id="rubisco" {sel} {pick} {interactive}>
		{#each STROMA_RUBISCO as [x, y], i (i)}
			<Machine id="rubisco" {x} {y} angle={i * 0.9} />
		{/each}
	</Part>
	{#each THYLAKOID_MACHINES as m, i (i)}
		<Part id={m.id === 'cfAtpSynthase' ? 'cfAtpSynthase' : m.id} {sel} {pick} {interactive}>
			<Machine id={m.id} x={m.x} y={m.y} angle={m.angle} flip={m.flip} />
		</Part>
	{/each}
</g>
