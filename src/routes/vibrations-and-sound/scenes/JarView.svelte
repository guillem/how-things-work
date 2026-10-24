<script lang="ts">
	/** The bell ringing inside a glass jar, the pump that empties it, and an ear outside. */
	import { Label } from '#lib/draw/index.ts';
	import Ear from './Ear.svelte';

	interface Props {
		/** Fraction of the air left inside, 0–1. */
		air: number;
		/** The bell's swing, degrees. */
		angle: number;
		/** Seconds on the scene clock, for the air's own restless jiggle. */
		time: number;
	}
	let { air, angle, time }: Props = $props();

	const bits = Array.from({ length: 35 }, (_, k) => k);
	let left = $derived(Math.round(air * 35));
</script>

<g>
	<path
		d="M140 295 V165 a110 110 0 0 1 220 0 V295 Z"
		fill="var(--sky)"
		fill-opacity="0.35"
		stroke="var(--stage-line)"
		stroke-width="3"
	/>
	<rect
		x="125"
		y="295"
		width="250"
		height="17"
		rx="5"
		fill="var(--membrane)"
		stroke="var(--stage-line)"
	/>
	{#each bits as k (k)}
		{#if k < left}<circle
				cx={165 + (k % 7) * 27 + 3 * Math.sin(time * 6.25 + k)}
				cy={140 + Math.floor(k / 7) * 30}
				r="3"
				fill="var(--vs-wave)"
				opacity="0.45"
			/>{/if}
	{/each}
	<path d="M245 120 V155" stroke="var(--stage-ink)" stroke-width="4" />
	<g transform={`rotate(${angle},245,158)`}>
		<path
			d="M208 230 Q218 220 218 193 a27 27 0 0 1 54 0 Q272 220 282 230 Z"
			fill="var(--vs-bell)"
			fill-opacity="0.75"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<circle cx="245" cy="240" r="7" fill="var(--stage-ink)" />
	</g>
	<path d="M350 300 H405 V267" fill="none" stroke="var(--stage-line)" stroke-width="6" />
	<rect
		x="385"
		y="235"
		width="75"
		height="36"
		rx="6"
		fill="var(--surface)"
		stroke="var(--stage-line)"
		stroke-width="2"
	/>
	<Label x={423} y={258} anchor="middle" text="pump" size={17} />
	<Label
		x={650}
		y={180}
		anchor="middle"
		text={air === 0
			? 'The bell still vibrates'
			: air === 1
				? 'The jar is full of air'
				: 'Less air, a fainter sound'}
		size={23}
	/>
	<Label
		x={650}
		y={216}
		anchor="middle"
		text={air === 0 ? 'No sound crosses the empty space' : 'The bell’s motion stays the same'}
		size={18}
		muted
	/>
	<path
		d="M480 245 H815"
		stroke="var(--vs-wave)"
		stroke-width="2"
		opacity={Math.sqrt(air)}
		marker-end="url(#arrowhead)"
	/>
	<Ear x={850} y={160} text="ear outside" />
</g>
