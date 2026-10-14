<script lang="ts">
	/**
	 * A line of stage text with a halo, like `<Label>` but with its size, colour and style set
	 * through `style:` (the stage's CSS overrides SVG presentation attributes such as font-size).
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
		rotate?: number;
	}
	let {
		x,
		y,
		text,
		size = 13,
		anchor = 'middle',
		color,
		weight = 500,
		muted = false,
		opacity = 1,
		rotate = 0
	}: Props = $props();
</script>

<text
	{x}
	{y}
	class="halo"
	class:muted
	text-anchor={anchor}
	transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
	{opacity}
	style:font-size="{size}px"
	style:font-weight={weight}
	style:fill={color}
	style:pointer-events="none">{text}</text
>
