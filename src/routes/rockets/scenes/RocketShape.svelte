<script lang="ts">
	/**
	 * A rocket drawn pointing up from (x, y), the middle of its nozzle exit, then turned by
	 * `angle` degrees (clockwise). `segments` are its stages from the bottom up, each with a
	 * height (px) and the share of its tank still full of propellant; the payload sits on top
	 * under the nose cone. `flame` (0–1) sets the exhaust plume.
	 */
	interface Segment {
		h: number;
		full: number;
	}
	interface Props {
		x: number;
		y: number;
		angle?: number;
		width?: number;
		segments: Segment[];
		payload?: number;
		flame?: number;
		/** Flicker phase, 0–1, for the plume. */
		flicker?: number;
		opacity?: number;
	}
	let {
		x,
		y,
		angle = 0,
		width = 24,
		segments,
		payload = 14,
		flame = 0,
		flicker = 0,
		opacity = 1
	}: Props = $props();

	const tops = $derived.by(() => {
		const out: number[] = [];
		let y0 = -6; // engine bell height
		for (const s of segments) {
			out.push(y0);
			y0 -= s.h;
		}
		out.push(y0);
		return out;
	});
	const top = $derived(tops[tops.length - 1]);
	const w = $derived(width / 2);
	const plume = $derived(flame * (26 + 6 * Math.sin(flicker * Math.PI * 2)) * (width / 24));
</script>

<g transform="translate({x} {y}) rotate({angle})" {opacity}>
	{#if flame > 0.02}
		<path
			d="M{-w * 0.55} 0 Q0 {plume * 1.4} {w * 0.55} 0 Z"
			fill="var(--rk-flame)"
			opacity={0.55 + 0.35 * flame}
		/>
		<path d="M{-w * 0.3} 0 Q0 {plume * 0.8} {w * 0.3} 0 Z" fill="var(--rk-steer)" opacity="0.8" />
	{/if}
	<!-- engine bell -->
	<path
		d="M{-w * 0.6} 0 L{-w * 0.3} -6 L{w * 0.3} -6 L{w * 0.6} 0 Z"
		fill="var(--rk-body-edge)"
		opacity="0.9"
	/>
	{#each segments as s, i (i)}
		{@const y1 = tops[i]}
		{@const y0 = tops[i + 1]}
		<rect
			x={-w}
			y={y0}
			width={w * 2}
			height={y1 - y0}
			fill="var(--rk-body)"
			stroke="var(--rk-body-edge)"
			stroke-width="1"
		/>
		<!-- propellant, draining from the top of the tank -->
		{#if s.full > 0.001}
			<rect
				x={-w + 2.5}
				y={y1 - 2.5 - (y1 - y0 - 5) * s.full}
				width={w * 2 - 5}
				height={(y1 - y0 - 5) * s.full}
				fill="var(--rk-fuel)"
				opacity="0.85"
			/>
		{/if}
	{/each}
	<!-- payload and nose -->
	<rect
		x={-w}
		y={top - payload}
		width={w * 2}
		height={payload}
		fill="var(--rk-payload)"
		stroke="var(--rk-body-edge)"
		stroke-width="1"
	/>
	<path
		d="M{-w} {top - payload} Q{-w * 0.7} {top - payload - w * 1.6} 0 {top - payload - w * 2.4} Q{w *
			0.7} {top - payload - w * 1.6} {w} {top - payload} Z"
		fill="var(--rk-body)"
		stroke="var(--rk-body-edge)"
		stroke-width="1"
	/>
	<!-- fins on the bottom segment -->
	{#if segments.length}
		<path
			d="M{-w} {tops[0] - 2} L{-w - width * 0.35} {tops[0] + 4} L{-w} {tops[0] -
				segments[0].h * 0.3} Z M{w} {tops[0] - 2} L{w + width * 0.35} {tops[0] + 4} L{w} {tops[0] -
				segments[0].h * 0.3} Z"
			fill="var(--rk-body-edge)"
			opacity="0.8"
		/>
	{/if}
</g>
