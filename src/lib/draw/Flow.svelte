<script lang="ts">
	/**
	 * A path with an optional arrowhead and an optional "marching" dash pattern
	 * that advances with `t`, to suggest flow along the path.
	 */
	interface Props {
		d: string;
		color?: string;
		width?: number;
		opacity?: number;
		arrow?: boolean;
		/** Dash pattern length; 0 disables dashes. */
		dash?: number;
		/** Current time; the dashes advance at `speed` px/s. */
		t?: number;
		speed?: number;
	}
	let {
		d,
		color = 'var(--stage-ink-muted)',
		width = 2,
		opacity = 1,
		arrow = false,
		dash = 0,
		t = 0,
		speed = 40
	}: Props = $props();
</script>

<path
	{d}
	fill="none"
	stroke={color}
	stroke-width={width}
	stroke-linecap="round"
	stroke-linejoin="round"
	{opacity}
	stroke-dasharray={dash ? `${dash} ${dash}` : undefined}
	stroke-dashoffset={dash ? -((t * speed) % (dash * 2)) : undefined}
	marker-end={arrow ? 'url(#arrowhead)' : undefined}
	style:pointer-events="none"
/>
