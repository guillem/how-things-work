<script lang="ts">
	/** A small satellite: a body with two solar panels, in the satellite's colour. */
	interface Props {
		x: number;
		y: number;
		color: string;
		/** 1 = about 34 units wide. */
		k?: number;
		opacity?: number;
	}
	let { x, y, color, k = 1, opacity = 1 }: Props = $props();
</script>

<g transform="translate({x} {y}) scale({k})" {opacity} style:pointer-events="none">
	<path d="M-6 0H-9M6 0H9" stroke="var(--stage-ink-muted)" stroke-width="1.5" />
	<rect x="-17" y="-4.5" width="8" height="9" rx="1" fill={color} opacity="0.55" />
	<rect x="9" y="-4.5" width="8" height="9" rx="1" fill={color} opacity="0.55" />
	<rect x="-6" y="-6" width="12" height="12" rx="2.5" fill={color} stroke="var(--stage-bg)" />
</g>
