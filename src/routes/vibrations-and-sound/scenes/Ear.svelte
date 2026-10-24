<script lang="ts">
	/** The outer ear seen from the side, its top-left at (x, y), with its name underneath. */
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		text: string;
	}
	let { x, y, text }: Props = $props();
</script>

<g transform={`translate(${x},${y})`}>
	<path
		d="M0 72 C-35 60 -25 0 8 0 C52 0 57 51 25 76 C15 83 23 111 1 111 C-13 111 -21 95 -16 85 M-2 73 C20 58 26 32 6 29 C-8 26 -12 42 -10 49"
		fill="var(--surface)"
		stroke="var(--stage-ink)"
		stroke-width="4"
		stroke-linecap="round"
	/>
	<Label x={10} y={146} anchor="middle" {text} size={18} />
</g>
