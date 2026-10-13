<script lang="ts">
	/** A simple figure (head and shoulders) with a name under it. */
	import { Readout } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';

	interface Props {
		x: number;
		y: number;
		name: string;
		color: string;
		/** A second line under the name. */
		role?: string;
		opacity?: number;
	}
	let { x, y, name, color, role, opacity = 1 }: Props = $props();
</script>

<g {opacity}>
	<path
		d="M{x - 26} {y + 22} C{x - 26} {y - 4} {x + 26} {y - 4} {x + 26} {y + 22} Z"
		fill={color}
		fill-opacity="0.85"
	/>
	<circle cx={x} cy={y - 18} r="15" fill={color} />
	<!-- on phones the name is drawn larger and the role line is hidden -->
	<Readout id="person-{name}">
		<Txt {x} y={y + 42} text={name} size={15} weight={700} anchor="middle" {color} />
		{#snippet narrow()}
			<Txt {x} y={y + 49} text={name} size={28} weight={700} anchor="middle" {color} />
		{/snippet}
	</Readout>
	{#if role}
		<Readout id="person-role-{name}">
			<Txt {x} y={y + 59} text={role} size={11} anchor="middle" muted />
		</Readout>
	{/if}
</g>
