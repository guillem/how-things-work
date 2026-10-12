<script lang="ts">
	/**
	 * Traced rays: each leg a line (its opacity follows the share of light it
	 * carries) with pulses of light running along it. Pulses sit where the
	 * optical path length n × distance is a whole number of `spacing`s past
	 * `speed × t`, so inside a material of index n they move n times slower and
	 * bunch up n times closer: the slowing-down that bends light, made visible.
	 */
	import { pulsesOn, rayOpacity, type DrawnPath } from './ui';

	interface Props {
		paths: DrawnPath[];
		t: number;
		/** Pulse speed in air, stage units per second. */
		speed?: number;
		spacing?: number;
		pulses?: boolean;
		r?: number;
	}
	let { paths, t, speed = 120, spacing = 46, pulses = true, r = 3.2 }: Props = $props();

	const phase = $derived((((t * speed) % spacing) + spacing) % spacing);
</script>

<g style:pointer-events="none">
	{#each paths as p (p.key)}
		{#each p.legs as l, i (i)}
			{#if i >= (p.skip ?? 0)}
				<line
					x1={l.a.x}
					y1={l.a.y}
					x2={l.b.x}
					y2={l.b.y}
					stroke={p.color}
					stroke-width={p.width ?? 2.2}
					stroke-linecap="round"
					opacity={rayOpacity(l.power) * (p.fade ?? 1)}
				/>
			{/if}
		{/each}
	{/each}
	{#if pulses}
		{#each paths as p (p.key)}
			{#each pulsesOn(p.legs, phase, spacing, p.skip ?? 0) as d, i (i)}
				<circle cx={d.x} cy={d.y} {r} fill={p.color} opacity={d.o * (p.fade ?? 1)} />
			{/each}
		{/each}
	{/if}
</g>
