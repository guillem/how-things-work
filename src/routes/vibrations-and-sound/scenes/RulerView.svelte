<script lang="ts">
	/** The ruler held over the table's edge, the sound spreading from it, and the ear. */
	import { Label, Handle } from '#lib/draw/index.ts';
	import { rulerPath } from '../model';
	import Ear from './Ear.svelte';

	interface Props {
		/** Centimetres of ruler sticking out. */
		length: number;
		/** Sideways swing of the free tip, scene units. */
		deflection: number;
		earX: number;
		/** The length handle is offered (the pitch step). */
		adjustable: boolean;
		onlength: (cm: number) => void;
	}
	let { length, deflection, earX, adjustable, onlength }: Props = $props();

	const clampLength = (v: number) => Math.round(Math.max(5, Math.min(15, v)));
</script>

<g>
	<rect
		x="65"
		y="280"
		width="165"
		height="28"
		rx="4"
		fill="var(--membrane)"
		stroke="var(--stage-line)"
		stroke-width="2"
	/>
	<path d="M90 308 V345 M210 308 V345" stroke="var(--stage-line)" stroke-width="12" />
	<path d="M95 270 H230" stroke="var(--stage-ink-muted)" stroke-width="10" />
	<path
		d={rulerPath(length, 0)}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="2"
		stroke-dasharray="5 6"
	/>
	<path
		d={rulerPath(length, deflection)}
		fill="none"
		stroke="var(--vs-wave)"
		stroke-width="9"
		stroke-linecap="round"
	/>
	<rect
		x="186"
		y="241"
		width="48"
		height="40"
		rx="5"
		fill="var(--protein)"
		stroke="var(--stage-line)"
		stroke-width="2"
	/>
	<Label x={145} y={220} anchor="middle" text="held still" size={18} />
	<Label
		x={345}
		y={170}
		anchor="middle"
		text="free to wobble"
		size={19}
		color="var(--vs-wave-text)"
	/>
	{#if adjustable}
		<Handle
			x={230 + length * 12}
			y={270 + deflection}
			label="Length of free ruler"
			value={length}
			min={5}
			max={15}
			valuetext={`${length} centimetres`}
			onmove={(p: { x: number; y: number }) => onlength(clampLength((p.x - 230) / 12))}
			onkey={(k: number | 'start' | 'end') =>
				onlength(k === 'start' ? 5 : k === 'end' ? 15 : clampLength(length + k))}
		/>
	{/if}
	<path
		d={`M480 230 C${(480 + earX) / 2} 170 ${earX - 50} 170 ${earX - 30} 230 M480 250 C${(480 + earX) / 2} 310 ${earX - 50} 310 ${earX - 30} 250`}
		fill="none"
		stroke="var(--vs-wave)"
		stroke-width="2"
		stroke-dasharray="8 8"
		opacity="0.4"
	/>
	<path
		d={`M480 240 H${earX - 50}`}
		stroke="var(--vs-wave)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>
	<Label x={650} y={156} anchor="middle" text="the sound spreads out" size={20} />
	<Ear x={earX} y={190} text="ear" />
</g>
