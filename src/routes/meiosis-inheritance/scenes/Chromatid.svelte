<script lang="ts">
	/**
	 * One chromatid drawn as a vertical rod from (x, y) downwards, coloured
	 * stretch by stretch by which homologue it was copied from (the model's
	 * segments), with a white band and the allele letter at each gene.
	 */
	import type { Chromatid } from '../model';

	interface Props {
		x: number;
		y: number;
		/** Genetic length of the chromosome, Morgans, and pixels per Morgan. */
		length: number;
		scale: number;
		segments: Chromatid;
		width?: number;
		/** Genes on this chromosome: position (Morgans) and the letter this chromatid carries. */
		genes?: { at: number; letter: string }[];
		opacity?: number;
		/** Colours of origin 0 and 1. */
		colors?: [string, string];
	}
	let {
		x,
		y,
		length,
		scale,
		segments,
		width = 12,
		genes = [],
		opacity = 1,
		colors = ['var(--mi-mom)', 'var(--mi-dad)']
	}: Props = $props();

	const parts = $derived.by(() => {
		let from = 0;
		return segments.map((s) => {
			const p = {
				y0: y + from * scale,
				y1: y + Math.min(s.to, length) * scale,
				c: colors[s.origin]
			};
			from = s.to;
			return p;
		});
	});
	const bandH = $derived(Math.max(8, width + 1));
	const font = $derived(Math.max(7, width - 2));
</script>

<g {opacity}>
	{#each parts as p, i (i)}
		<line x1={x} x2={x} y1={p.y0} y2={p.y1} stroke={p.c} stroke-width={width} />
	{/each}
	<circle cx={x} cy={y} r={width / 2} fill={parts[0].c} />
	<circle cx={x} cy={y + length * scale} r={width / 2} fill={parts[parts.length - 1].c} />
	{#each genes as g (g.at)}
		{@const gy = y + g.at * scale}
		<rect x={x - width / 2} y={gy - bandH / 2} {width} height={bandH} fill="var(--mi-band)" />
		<text
			{x}
			y={gy + font * 0.36}
			font-size={font}
			font-weight="700"
			text-anchor="middle"
			style:fill={parts.find((p) => gy < p.y1)?.c ?? parts[parts.length - 1].c}
			style:font-style="italic">{g.letter}</text
		>
	{/each}
</g>
