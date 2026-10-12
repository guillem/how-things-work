<script lang="ts">
	/** A small torch at (x, y) shining towards `deg` (0 = right, screen angles). */
	interface Props {
		x: number;
		y: number;
		deg: number;
		color: string;
	}
	let { x, y, deg, color }: Props = $props();
</script>

<g transform="translate({x} {y}) rotate({deg})" style:pointer-events="none">
	<rect x="-44" y="-11" width="34" height="22" rx="5" fill="var(--lo-lamp)" />
	<path d="M-12 -11 L0 -16 L0 16 L-12 11 Z" fill="var(--lo-lamp)" />
	<rect x="-1" y="-15" width="4" height="30" rx="2" fill={color} />
</g>
