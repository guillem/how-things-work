<script lang="ts">
	/**
	 * One layer of an image block, drawn as a slanted sheet: pixel (u, v) — column u, row v —
	 * lands at (x + a·u, y + b·u + c·v). The picture is a data URL, drawn with pixelated
	 * scaling; the outline follows the same slant.
	 */
	interface Props {
		href: string;
		/** Pixels across and down. */
		w: number;
		h: number;
		x: number;
		y: number;
		a: number;
		b: number;
		c: number;
		opacity?: number;
		stroke?: string;
		strokeWidth?: number;
	}
	let {
		href,
		w,
		h,
		x,
		y,
		a,
		b,
		c,
		opacity = 1,
		stroke = 'var(--stage-line)',
		strokeWidth = 1.2
	}: Props = $props();

	const outline = $derived(
		`M${x} ${y} L${x + a * w} ${y + b * w} L${x + a * w} ${y + b * w + c * h} L${x} ${y + c * h} Z`
	);
</script>

<g {opacity} style:pointer-events="none">
	<image
		{href}
		width={w}
		height={h}
		preserveAspectRatio="none"
		transform="matrix({a} {b} 0 {c} {x} {y})"
		style:image-rendering="pixelated"
	/>
	<path d={outline} fill="none" {stroke} stroke-width={strokeWidth} stroke-linejoin="round" />
</g>
