<script lang="ts">
	/**
	 * SVG text for the embeddings scenes. Sizes and colours go through `style:` because the stage
	 * CSS sets `font-size` and `fill` on every text. A halo keeps it legible over drawings.
	 */
	interface Props {
		x: number;
		y: number;
		text: string;
		size?: number;
		anchor?: 'start' | 'middle' | 'end';
		weight?: number;
		color?: string;
		muted?: boolean;
		halo?: boolean;
		italic?: boolean;
		opacity?: number;
	}
	let {
		x,
		y,
		text,
		size = 13,
		anchor = 'start',
		weight = 500,
		color,
		muted = false,
		halo = true,
		italic = false,
		opacity = 1
	}: Props = $props();
</script>

<text
	{x}
	{y}
	class:halo
	class:muted
	text-anchor={anchor}
	{opacity}
	style:font-size="{size}px"
	style:font-weight={weight}
	style:fill={color}
	style:font-style={italic ? 'italic' : undefined}
	style:font-variant-numeric="tabular-nums">{text}</text
>
