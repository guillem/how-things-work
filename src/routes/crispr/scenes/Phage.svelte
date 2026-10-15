<script lang="ts">
	/**
	 * A tailed phage: a hexagonal head (holding its DNA), a tail and three
	 * pairs of tail fibres. Drawn pointing down (tail at +y) at scale 1: head
	 * 30 units across, total height about 62. `(x, y)` is the tip of the tail.
	 */
	interface Props {
		x: number;
		y: number;
		scale?: number;
		/** Rotation in degrees (0 = tail down). */
		angle?: number;
		opacity?: number;
		/** Show the DNA coiled in the head (false once it has been injected). */
		full?: boolean;
		/** Colour of the head's edge (defaults to the phage colour). */
		color?: string;
	}
	let { x, y, scale = 1, angle = 0, opacity = 1, full = true, color }: Props = $props();
	const hex = Array.from({ length: 6 }, (_, i) => {
		const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
		return `${(Math.cos(a) * 15).toFixed(1)},${(-46 + Math.sin(a) * 15).toFixed(1)}`;
	}).join(' ');
</script>

<g
	transform="translate({x} {y}) rotate({angle}) scale({scale})"
	{opacity}
	style:pointer-events="none"
>
	<!-- tail fibres -->
	<path
		d="M-3 -6 L-14 2 L-18 -2 M3 -6 L14 2 L18 -2 M0 -4 L-6 4 M0 -4 L6 4"
		fill="none"
		stroke={color ?? 'var(--cr-phage)'}
		stroke-width="1.4"
		stroke-linecap="round"
		vector-effect="non-scaling-stroke"
	/>
	<!-- tail -->
	<rect
		x="-3.5"
		y="-32"
		width="7"
		height="27"
		rx="2"
		fill="var(--cr-phage-head)"
		stroke={color ?? 'var(--cr-phage)'}
		stroke-width="1.3"
		vector-effect="non-scaling-stroke"
	/>
	<!-- head -->
	<polygon
		points={hex}
		fill="var(--cr-phage-head)"
		stroke={color ?? 'var(--cr-phage)'}
		stroke-width="1.6"
		vector-effect="non-scaling-stroke"
	/>
	{#if full}
		<path
			d="M-7 -50 C -2 -58, 6 -54, 5 -48 S -6 -40, -6 -46 S 4 -38, 7 -42"
			fill="none"
			stroke="var(--cr-phage-dna)"
			stroke-width="1.6"
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
		/>
	{/if}
</g>
