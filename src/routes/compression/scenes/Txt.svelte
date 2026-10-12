<script lang="ts">
	/**
	 * SVG text for the compression scenes. Sizes and colours go through `style:` because
	 * the stage CSS overrides presentation attributes. A halo keeps it legible over drawings.
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
		mono?: boolean;
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
		mono = false,
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
	style:font-family={mono ? 'var(--font-mono)' : undefined}
	style:font-variant-numeric="tabular-nums">{text}</text
>
