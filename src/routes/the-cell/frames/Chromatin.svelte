<script lang="ts" module>
	/**
	 * Chromatin in the nucleus, in nanometres from the view's centre: nucleosomes
	 * (PDB 1KX5) on linker DNA (a 2 nm band), cut by a thin slice into short runs,
	 * at the density of a human nucleus (see `chromatin()` in molecular.ts), with
	 * nuclear proteins at the measured protein density and water at its spacing.
	 */
	import { chromatin, scatter } from '../molecular';
	import { rng } from '../random';

	const runs = chromatin();
	const r = rng(8);
	const beads = runs.flatMap((run) =>
		run.beads.map(([x, y]) => ({ x, y, angle: r.range(0, Math.PI * 2) }))
	);
	const linkers = runs
		.filter((run) => run.beads.length > 1)
		.map((run) => 'M' + run.beads.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L'))
		.join('');
	const BOX = { x0: -160, x1: 160, y0: -110, y1: 110 };
	const proteins = scatter(
		12,
		BOX,
		(x, y, rad) =>
			beads.some((b) => Math.hypot(b.x - x, b.y - y) < 7 + rad) ||
			runs.some((run) =>
				run.beads.some((b, i) => {
					const c = run.beads[i + 1];
					if (!c) return false;
					const dx = c[0] - b[0];
					const dy = c[1] - b[1];
					const u = Math.max(
						0,
						Math.min(1, ((x - b[0]) * dx + (y - b[1]) * dy) / (dx * dx + dy * dy))
					);
					return Math.hypot(b[0] + u * dx - x, b[1] + u * dy - y) < 1.5 + rad;
				})
			),
		[{ id: 'adk', share: 0.6, d: 5 }]
	);
</script>

<script lang="ts">
	import Machine from './Machine.svelte';
	import Part from './Part.svelte';
	import Water from './Water.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, view, sel, pick, interactive }: FrameProps = $props();
	const wet = $derived(smoothstep(16, 32, ppu));
	const near = (x: number, y: number) =>
		x > view.x0 - 12 && x < view.x1 + 12 && y > view.y0 - 12 && y < view.y1 + 12;
</script>

<g>
	<Part id="nucleus" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={BOX.y0 - 60}
			width={BOX.x1 - BOX.x0 + 120}
			height={BOX.y1 - BOX.y0 + 120}
			fill="var(--tc-nucleus)"
		/>
	</Part>
	{#if wet > 0}
		<Water
			id="chromatin"
			x0={BOX.x0 - 60}
			y0={BOX.y0 - 60}
			w={BOX.x1 - BOX.x0 + 120}
			h={BOX.y1 - BOX.y0 + 120}
			opacity={wet * 0.6}
		/>
	{/if}
	<Part id="protein" {sel} {pick} {interactive}>
		{#each proteins as p, i (i)}
			{#if near(p.x, p.y)}
				<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} opacity={0.8} />
			{/if}
		{/each}
	</Part>
	<Part id="dna" {sel} {pick} {interactive}>
		<path
			d={linkers}
			fill="none"
			stroke="var(--tc-dna)"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</Part>
	<Part id="nucleosome" {sel} {pick} {interactive}>
		{#each beads as b, i (i)}
			{#if near(b.x, b.y)}
				<Machine id="nucleosome" x={b.x} y={b.y} angle={b.angle} />
			{/if}
		{/each}
	</Part>
</g>
