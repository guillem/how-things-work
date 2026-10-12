<script lang="ts">
	/**
	 * A train of one or more carriages, drawn shortened along the track by the
	 * factor `k` (1/γ): bodies, windows and wheels all contract, heights do not.
	 * `x` is the centre, `y` the rail (bottom of the wheels).
	 */
	interface Props {
		x: number;
		y: number;
		/** Length at rest, in stage units. */
		length: number;
		/** Body height. */
		height: number;
		/** Contraction factor along the track (1 = at rest). */
		k?: number;
		cars?: number;
		/** Windows per carriage; a carriage with a clock leaves its middle free. */
		windows?: number;
		clockGap?: boolean;
		opacity?: number;
	}
	let {
		x,
		y,
		length,
		height,
		k = 1,
		cars = 1,
		windows = 4,
		clockGap = false,
		opacity = 1
	}: Props = $props();

	const gap = 6;
	const carLen = $derived((length - gap * (cars - 1)) / cars);
	const carList = $derived(
		Array.from({ length: cars }, (_, i) => ({ i, x0: -length / 2 + i * (carLen + gap) }))
	);
	const wins = $derived.by(() => {
		const out: number[] = [];
		const n = windows;
		for (let j = 0; j < n; j++) {
			const u = (j + 0.5) / n;
			if (clockGap && Math.abs(u - 0.5) < 0.2) continue;
			out.push(u);
		}
		return out;
	});
</script>

<g transform="translate({x} {y}) scale({k} 1)" {opacity}>
	{#each carList as c (c.i)}
		{#if c.i > 0}
			<line
				x1={c.x0 - gap}
				x2={c.x0}
				y1={-24}
				y2={-24}
				stroke="var(--rel-train)"
				stroke-width="2"
				vector-effect="non-scaling-stroke"
			/>
		{/if}
		<rect
			x={c.x0}
			y={-height - 10}
			width={carLen}
			{height}
			rx="8"
			fill="var(--rel-car)"
			stroke="var(--rel-train)"
			stroke-width="1.5"
			vector-effect="non-scaling-stroke"
		/>
		{#each wins as u (u)}
			<rect
				x={c.x0 + u * carLen - Math.min(14, carLen / windows / 3)}
				y={-height + 4}
				width={Math.min(28, (2 * carLen) / windows / 3)}
				height={Math.min(22, height * 0.3)}
				rx="3"
				fill="var(--stage-bg)"
				stroke="var(--rel-train)"
				stroke-width="1"
				opacity="0.9"
				vector-effect="non-scaling-stroke"
			/>
		{/each}
		{#each [0.15, 0.85] as u (u)}
			<ellipse cx={c.x0 + u * carLen} cy={-5} rx="5" ry="5" fill="var(--stage-ink-muted)" />
		{/each}
	{/each}
</g>
