<script lang="ts" module>
	/**
	 * A palisade cell of the leaf, in leaf micrometres (plant.ts, plant-paths.ts):
	 * its wall (0.1 µm), membrane, a thin layer of cytoplasm, the central vacuole,
	 * the nucleus, mitochondria and chloroplasts, with the neighbouring cells
	 * around it. Zoomed in, the chloroplasts show their double envelope, their
	 * grana (stacks of thylakoids, drawn one by one below ~3 µm) joined by stroma
	 * lamellae, a starch grain and oil droplets (plastoglobuli).
	 */
	import {
		C0 as C,
		chl,
		epidermis,
		lens,
		palisadePath,
		rect,
		spongy,
		chloroplastPaths,
		nuclei
	} from '../plant-paths';
	import { LEAF, THYLAKOID } from '../plant';
	import { capsulePath } from './types';

	const box = C.box;
	const wallOuter = rect(box);
	const inner = rect({
		...box,
		w: box.w - 2 * LEAF.wall,
		h: box.h - 2 * LEAF.wall,
		r: box.r - LEAF.wall
	});
	const vac = rect({
		...box,
		w: box.w - 2 * (LEAF.wall + C.band),
		h: box.h - 2 * (LEAF.wall + C.band),
		r: box.r - LEAF.wall - C.band
	});
	const halos =
		C.chloroplasts.map((c) => lens(c.x, c.y, c.a + C.halo, c.b + C.halo, c.angle)).join('') +
		`M${C.nucleus.x - C.nucleus.r - C.halo} ${C.nucleus.y}a${C.nucleus.r + C.halo} ${C.nucleus.r + C.halo} 0 1 0 ${2 * (C.nucleus.r + C.halo)} 0a${C.nucleus.r + C.halo} ${C.nucleus.r + C.halo} 0 1 0 ${-2 * (C.nucleus.r + C.halo)} 0Z`;
	const chlOuter = C.chloroplasts.map((c) => lens(c.x, c.y, c.a, c.b, c.angle)).join('');
	const ENV = 0.015;
	const chlInner = C.chloroplasts
		.map((c) => lens(c.x, c.y, c.a - ENV, c.b - ENV, c.angle))
		.join('');
	const mitos = C.mitochondria.map((m) => capsulePath(m.x, m.y, m.a, m.b, m.angle)).join('');
	const N = C.nucleus;
</script>

<script lang="ts">
	import Part from './Part.svelte';
	import { smoothstep } from '#lib/draw/index.ts';
	import type { FrameProps } from './types';

	let { ppu, view, sel, pick, interactive }: FrameProps = $props();
	const hair = (px: number, trueUm = 0) => Math.max(trueUm, px / ppu);
	const detail = $derived(smoothstep(25, 60, ppu));
	const fine = $derived(smoothstep(220, 420, ppu));
	const visible = $derived(
		C.chloroplasts
			.map((c, i) => ({ c, i }))
			.filter(
				({ c }) =>
					c.x + c.a > view.x0 && c.x - c.a < view.x1 && c.y + c.a > view.y0 && c.y - c.a < view.y1
			)
	);
</script>

<g>
	<rect x="-160" y="-220" width="320" height="300" fill="var(--tc-air)" />
	<!-- the neighbours, as in the leaf view -->
	<Part id="leaf" {sel} {pick} {interactive}>
		<path
			d={epidermis}
			fill="var(--tc-epidermis)"
			stroke="var(--tc-wall-edge)"
			stroke-width={hair(1)}
		/>
		<path d={spongy} fill="var(--tc-vacuole)" stroke="var(--tc-wall-edge)" stroke-width={hair(1)} />
		<path
			d={palisadePath}
			fill="var(--tc-vacuole)"
			stroke="var(--tc-wall-edge)"
			stroke-width={hair(1)}
		/>
		<path
			d={nuclei}
			fill="var(--tc-nucleus)"
			stroke="var(--tc-envelope)"
			stroke-width={hair(0.8)}
		/>
		<path
			d={chl}
			fill="var(--tc-chloroplast)"
			stroke="var(--tc-chloroplast-edge)"
			stroke-width={hair(0.6)}
		/>
	</Part>

	<!-- the cell -->
	<Part id="cellWall" {sel} {pick} {interactive}>
		<path d={wallOuter} fill="var(--tc-wall)" />
	</Part>
	<Part id="cytosol" {sel} {pick} {interactive}>
		<path
			d={inner}
			fill="var(--tc-cytosol)"
			stroke="var(--tc-cytosol-edge)"
			stroke-width={hair(0.6, 0.004)}
		/>
	</Part>
	<Part id="vacuole" {sel} {pick} {interactive}>
		<path d={vac} fill="var(--tc-vacuole)" />
	</Part>
	<path d={halos} fill="var(--tc-cytosol)" />
	<Part id="nucleus" {sel} {pick} {interactive}>
		<circle
			cx={N.x}
			cy={N.y}
			r={N.r}
			fill="var(--tc-nucleus)"
			stroke="var(--tc-envelope)"
			stroke-width={hair(1, 0.004)}
		/>
		<circle cx={N.x - 0.8} cy={N.y - 0.6} r="0.9" fill="var(--tc-nucleolus)" opacity="0.85" />
	</Part>
	<Part id="mitochondrion" {sel} {pick} {interactive}>
		<path
			d={mitos}
			fill="var(--tc-matrix)"
			stroke="var(--tc-mito-edge)"
			stroke-width={hair(0.6, 0.004)}
		/>
	</Part>
	<Part id="chloroplast" {sel} {pick} {interactive}>
		<path
			d={chlOuter}
			fill="var(--tc-chloroplast)"
			stroke="var(--tc-chloroplast-edge)"
			stroke-width={hair(0.7, 0.005)}
		/>
		{#if detail > 0}
			<path
				d={chlInner}
				fill="var(--tc-stroma)"
				stroke="var(--tc-chloroplast-edge)"
				stroke-width={hair(0.5, 0.005)}
				opacity={detail}
			/>
		{/if}
	</Part>
	{#if detail > 0}
		<g opacity={detail}>
			{#each visible as { i } (i)}
				{@const p = chloroplastPaths(i)}
				<path
					d={p.starch}
					fill="var(--tc-starch)"
					stroke="var(--tc-chloroplast-edge)"
					stroke-width={hair(0.4)}
				/>
				<path d={p.globules} fill="var(--tc-chloroplast-edge)" opacity="0.7" />
				<Part id="thylakoid" {sel} {pick} {interactive}>
					<path
						d={p.lamellae}
						fill="none"
						stroke="var(--tc-granum)"
						stroke-width={hair(0.8, THYLAKOID.lumen + 2 * THYLAKOID.membrane)}
						stroke-linecap="round"
					/>
					{#if fine > 0}
						<path
							d={p.lamellae}
							fill="none"
							stroke="var(--tc-lumen)"
							stroke-width={THYLAKOID.lumen}
							stroke-linecap="round"
							opacity={fine}
						/>
					{/if}
				</Part>
				<Part id="granum" {sel} {pick} {interactive}>
					<path d={p.blocks} fill="var(--tc-granum)" opacity={1 - fine} />
					{#if fine > 0}
						<path
							d={p.thylakoids}
							fill="var(--tc-lumen)"
							stroke="var(--tc-granum)"
							stroke-width={THYLAKOID.membrane}
							opacity={fine}
						/>
					{/if}
				</Part>
			{/each}
		</g>
	{/if}
</g>
