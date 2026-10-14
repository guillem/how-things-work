<script lang="ts" module>
	/**
	 * A patch of the cell membrane, in nanometres from the view's centre: the lipid
	 * bilayer (4 nm) at y = 0, the outside above and the cytoplasm below, with a
	 * sodium–potassium pump (PDB 3WGU), a potassium channel (PDB 2R9R) and a glucose
	 * transporter (PDB 4PYP) set in it as OPM orients them. Ions are drawn at their
	 * measured concentrations (mammalian cell: K⁺ 100 mM, Na⁺ 10 mM; blood plasma:
	 * K⁺ 4 mM, Na⁺ 145 mM; BNID 104049, 104050), as hydrated ions ≈ 0.7 nm across.
	 */
	import { CORTEX_ACTIN, MEMBRANE_PROTEINS, scatterSmall, scatter } from '../molecular';
	import { MACHINES } from '../shapes';

	const BOX = { x0: -110, x1: 110, y0: -80, y1: 80 };
	const NA = 6.022e23 * 1e-24; // per nm³ per mol/L
	const inProtein = (x: number, y: number, pad = 0.6) =>
		MEMBRANE_PROTEINS.some((m) => {
			const s = MACHINES[m.id];
			return (
				x > m.x - s.width / 2 - pad &&
				x < m.x + s.width / 2 + pad &&
				y > s.top - pad &&
				y < s.bottom + pad
			);
		});
	const outside = { ...BOX, y1: -2.5 };
	const inside = { ...BOX, y0: 2.5 };
	const ions = {
		naOut: scatterSmall(1, outside, (x, y) => inProtein(x, y), 0.145 * NA, 0.7),
		kOut: scatterSmall(2, outside, (x, y) => inProtein(x, y), 0.004 * NA, 0.7),
		naIn: scatterSmall(3, inside, (x, y) => inProtein(x, y), 0.01 * NA, 0.7),
		kIn: scatterSmall(4, inside, (x, y) => inProtein(x, y), 0.1 * NA, 0.7)
	};
	const proteins = scatter(5, { ...BOX, y0: 3 }, (x, y, r) => inProtein(x, y, r + 1), [
		{ id: 'adk', share: 0.6, d: 5 }
	]);
	const dots = (list: { x: number; y: number }[]) =>
		list
			.map(
				(p) =>
					`M${(p.x - 0.35).toFixed(2)} ${p.y.toFixed(2)}a0.35 0.35 0 1 0 0.7 0a0.35 0.35 0 1 0 -0.7 0Z`
			)
			.join('');
	const actin = CORTEX_ACTIN.map(
		(seg) => `M${seg[0][0]} ${seg[0][1]}L${seg[1][0]} ${seg[1][1]}`
	).join('');
	const NA_FILL = '#9c36b5';
	const K_FILL = '#2f9e44';
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
	<Part id="sinusoid" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y={BOX.y0 - 60}
			width={BOX.x1 - BOX.x0 + 120}
			height={60 - BOX.y0}
			fill="var(--tc-plasma)"
		/>
	</Part>
	<Part id="cytosol" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y="0"
			width={BOX.x1 - BOX.x0 + 120}
			height={BOX.y1 + 60}
			fill="var(--tc-cytosol)"
		/>
	</Part>
	{#if wet > 0}
		<Water
			id="membrane"
			x0={BOX.x0 - 60}
			y0={BOX.y0 - 60}
			w={BOX.x1 - BOX.x0 + 120}
			h={BOX.y1 - BOX.y0 + 120}
			opacity={wet * 0.5}
		/>
	{/if}
	<Part id="plasmaMembrane" {sel} {pick} {interactive}>
		<rect
			x={BOX.x0 - 60}
			y="-2"
			width={BOX.x1 - BOX.x0 + 120}
			height="4"
			fill="var(--tc-lipid-head)"
		/>
		<rect
			x={BOX.x0 - 60}
			y="-1.2"
			width={BOX.x1 - BOX.x0 + 120}
			height="2.4"
			fill="var(--tc-lipid)"
		/>
	</Part>
	<Part id="actin" {sel} {pick} {interactive}>
		<path
			d={actin}
			fill="none"
			stroke="var(--tc-actin)"
			stroke-width="6.5"
			stroke-linecap="round"
		/>
		<path
			d={actin}
			fill="none"
			stroke="var(--tc-cytosol)"
			stroke-width="1"
			stroke-dasharray="2.7 2.7"
			opacity="0.5"
		/>
	</Part>
	<Part id="protein" {sel} {pick} {interactive}>
		{#each proteins as p, i (i)}
			<Machine id={p.id} x={p.x} y={p.y} angle={p.angle} opacity={0.8} />
		{/each}
	</Part>
	<path d={dots([...ions.naOut, ...ions.naIn])} fill={NA_FILL} />
	<path d={dots([...ions.kOut, ...ions.kIn])} fill={K_FILL} />
	{#each MEMBRANE_PROTEINS as m (m.id)}
		<Part id={m.id === 'glut1' ? 'glut' : m.id} {sel} {pick} {interactive}>
			<Machine id={m.id} x={m.x} y={m.y} />
		</Part>
	{/each}
</g>
