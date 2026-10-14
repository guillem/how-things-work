<script lang="ts">
	/** A card or panel title: drawn on wide screens, left out on phones (the panel under the stage has the rows). */
	import { Readout } from '#lib/explainer/index.ts';
	import T from './T.svelte';

	interface Props {
		x: number;
		y: number;
		text: string;
		size?: number;
		weight?: number;
	}
	let { x, y, text, size = 15, weight = 700 }: Props = $props();
</script>

<Readout id="title-{x}-{y}">
	<T {x} {y} {text} {size} {weight} />
</Readout>
