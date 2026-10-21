<script lang="ts">
	/** A name on the drawing ("nest", "long bridge"), drawn much bigger on phones. */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';

	interface Props {
		id: string;
		x: number;
		y: number;
		text: string;
		anchor?: 'start' | 'middle' | 'end';
		/** Where the bigger phone label sits, if not at (x, y). */
		phone?: { x: number; y: number };
	}
	let { id, x, y, text, anchor = 'middle', phone }: Props = $props();
</script>

<Readout {id}>
	{#snippet narrow()}
		<Label x={phone?.x ?? x} y={phone?.y ?? y} {text} {anchor} size={36} weight={700} />
	{/snippet}
	<Label {x} {y} {text} {anchor} size={20} weight={600} />
</Readout>
