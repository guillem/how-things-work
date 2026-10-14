<script lang="ts">
	import { wingColour } from './colours';
	/**
	 * A resting moth seen from above: two forewings spread in a triangle, a body
	 * and two antennae (three SVG nodes, so a hundred of them stay cheap).
	 * `shade` 0 is the palest wing, 1 the darkest. Wing colours are the moth's
	 * own (fixed), not theme colours.
	 */
	interface Props {
		x: number;
		y: number;
		shade: number;
		size?: number;
		opacity?: number;
		rotate?: number;
	}
	let { x, y, shade, size = 1, opacity = 1, rotate = 0 }: Props = $props();

	const fill = $derived(wingColour(shade));
</script>

<g transform="translate({x} {y}) rotate({rotate}) scale({size})" {opacity}>
	<path
		d="M0 -4 C -6 -6, -15 -2, -17 6 C -12 9, -5 8, 0 4 C 5 8, 12 9, 17 6 C 15 -2, 6 -6, 0 -4 Z"
		{fill}
		stroke="rgba(0,0,0,0.4)"
		stroke-width="0.7"
	/>
	<path
		d="M0 -6 V6 M-0.5 -6 L-4 -11 M0.5 -6 L4 -11"
		stroke="rgb(60,55,50)"
		stroke-width="1.6"
		stroke-linecap="round"
		fill="none"
	/>
</g>
