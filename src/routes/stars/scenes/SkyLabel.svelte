<script lang="ts">
	/** Text drawn on the night-sky panel of the HR diagram, with a halo of the sky's colour. */
	interface Props {
		x: number;
		y: number;
		text: string;
		size?: number;
		weight?: number;
		anchor?: 'start' | 'middle' | 'end';
		color?: string;
		opacity?: number;
		rotate?: number;
	}
	let {
		x,
		y,
		text,
		size = 12,
		weight = 500,
		anchor = 'middle',
		color = 'var(--st-sky-ink)',
		opacity = 1,
		rotate = 0
	}: Props = $props();
</script>

<text
	{x}
	{y}
	text-anchor={anchor}
	transform="rotate({rotate} {x} {y})"
	{opacity}
	font-size={size}
	style:font-weight={weight}
	style:fill={color}
	style:stroke="var(--st-sky)"
	style:stroke-width="3px"
	style:paint-order="stroke"
	style:stroke-linejoin="round"
	style:pointer-events="none">{text}</text
>
