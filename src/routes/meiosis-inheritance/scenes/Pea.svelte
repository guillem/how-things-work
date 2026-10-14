<script lang="ts">
	/** A pea seed: yellow or green, round or wrinkled. */
	interface Props {
		x: number;
		y: number;
		r?: number;
		green?: boolean;
		wrinkled?: boolean;
		opacity?: number;
	}
	let { x, y, r = 10, green = false, wrinkled = false, opacity = 1 }: Props = $props();

	const d = $derived.by(() => {
		if (!wrinkled) return '';
		const n = 28;
		let s = '';
		for (let i = 0; i <= n; i++) {
			const a = (i / n) * Math.PI * 2;
			const rr = r * (0.86 + 0.1 * Math.cos(a * 7 + 0.6) + 0.04 * Math.sin(a * 11));
			s += `${i ? 'L' : 'M'}${(x + rr * Math.cos(a)).toFixed(1)} ${(y + rr * Math.sin(a)).toFixed(1)}`;
		}
		return s + 'Z';
	});
	const fill = $derived(green ? 'var(--mi-pea-green)' : 'var(--mi-pea-yellow)');
</script>

<g {opacity}>
	{#if wrinkled}
		<path {d} {fill} stroke="var(--stage-ink)" stroke-opacity="0.45" stroke-width="1" />
		<path
			d="M{x - r * 0.45} {y - r * 0.15} q{r * 0.25} {r * 0.3} {r * 0.5} 0 M{x - r * 0.1} {y +
				r * 0.35} q{r * 0.25} {-r * 0.2} {r * 0.45} {r * 0.05}"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-opacity="0.35"
			stroke-width="1"
		/>
	{:else}
		<circle
			cx={x}
			cy={y}
			{r}
			{fill}
			stroke="var(--stage-ink)"
			stroke-opacity="0.45"
			stroke-width="1"
		/>
		<circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.25} fill="white" opacity="0.45" />
	{/if}
</g>
