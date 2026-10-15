<script lang="ts">
	/** A label and a value on one line of a readout card, listed under the stage on phones. */
	import { Readout } from '#lib/explainer/index.ts';
	import T from './T.svelte';

	interface Props {
		id: string;
		order?: number;
		x: number;
		y: number;
		/** Width of the line: the value is right-aligned at x + w. */
		w: number;
		label: string;
		value: string;
		note?: string;
		color?: string;
		opacity?: number;
		/** Left out of the phone panel (a secondary row), drawn as usual on wide screens. */
		minor?: boolean;
	}
	let {
		id,
		order = 0,
		x,
		y,
		w,
		label,
		value,
		note,
		color,
		opacity = 1,
		minor = false
	}: Props = $props();
</script>

<Readout {id} {order} label={minor ? undefined : label} {value} {note} {color} {opacity}>
	<g {opacity}>
		<T {x} {y} text={label} size={12.5} muted />
		<T x={x + w} {y} text={value} size={13.5} anchor="end" weight={650} {color} />
	</g>
</Readout>
