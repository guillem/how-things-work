<script lang="ts">
	/** A pea flower, seen from the front: purple or white. */
	interface Props {
		x: number;
		y: number;
		r?: number;
		white?: boolean;
		opacity?: number;
	}
	let { x, y, r = 12, white = false, opacity = 1 }: Props = $props();
	const fill = $derived(white ? 'var(--mi-flower-white)' : 'var(--mi-flower)');
</script>

<g {opacity}>
	{#each [0, 1, 2, 3, 4] as k (k)}
		{@const a = (k / 5) * Math.PI * 2 - Math.PI / 2}
		<circle
			cx={x + r * 0.55 * Math.cos(a)}
			cy={y + r * 0.55 * Math.sin(a)}
			r={r * 0.5}
			{fill}
			stroke="var(--stage-ink)"
			stroke-opacity="0.4"
			stroke-width="0.8"
		/>
	{/each}
	<circle cx={x} cy={y} r={r * 0.22} fill="var(--mi-pea-yellow)" />
</g>
