<script lang="ts">
	/**
	 * A line of stage text with a halo. Size, colour and style go through
	 * `style:` because the stage's CSS overrides SVG presentation attributes.
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
		italic?: boolean;
		opacity?: number;
	}
	let {
		x,
		y,
		text,
		size = 13,
		anchor = 'start',
		color,
		weight = 500,
		muted = false,
		italic = false,
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
	style:font-style={italic ? 'italic' : undefined}
	style:fill={color}
	style:pointer-events="none">{text}</text
>
