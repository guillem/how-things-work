<script lang="ts">
	/**
	 * Haloed SVG text with its size set by style (the stage CSS overrides font-size
	 * attributes). Shared by the feedback-control scenes.
	 */
	interface Props {
		x: number;
		y: number;
		text: string;
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		color?: string;
		weight?: number;
		muted?: boolean;
		opacity?: number;
	}
	let {
		x,
		y,
		text,
		size = 12,
		anchor = 'start',
		color,
		weight = 500,
		muted = false,
		opacity = 1
	}: Props = $props();
</script>

<text
	{x}
	{y}
	class="halo"
	class:muted
	text-anchor={anchor}
	font-weight={weight}
	{opacity}
	style:font-size="{size}px"
	style:fill={color}
	style:pointer-events="none">{text}</text
>
