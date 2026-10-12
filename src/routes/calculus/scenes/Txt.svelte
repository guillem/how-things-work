<script lang="ts">
	/**
	 * Text on the stage with a halo (or a pill card behind it). Sizes and
	 * colours are set with `style:` because the stage's CSS overrides SVG
	 * presentation attributes (see docs/BACKLOG.md).
	 */
	import { textWidth } from './plot';

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
		pill?: boolean;
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
		opacity = 1,
		pill = false
	}: Props = $props();

	const w = $derived(textWidth(text, size) + 16);
	const px = $derived(anchor === 'start' ? x - 8 : anchor === 'end' ? x - w + 8 : x - w / 2);
</script>

<g {opacity} style:pointer-events="none">
	{#if pill}
		<rect
			x={px}
			y={y - size * 0.75 - 5}
			width={w}
			height={size + 10}
			rx={(size + 10) / 2}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	{/if}
	<text
		{x}
		{y}
		class={pill ? undefined : 'halo'}
		class:muted
		text-anchor={anchor}
		font-weight={weight}
		style:font-size="{size}px"
		style:fill={color}>{text}</text
	>
</g>
