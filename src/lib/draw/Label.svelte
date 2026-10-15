<script lang="ts">
	/** A text label with a halo so it stays legible over any drawing. */
	interface Props {
		x: number;
		y: number;
		text: string;
		size?: number;
		weight?: number;
		anchor?: 'start' | 'middle' | 'end';
		muted?: boolean;
		color?: string;
		opacity?: number;
		rotate?: number;
		italic?: boolean;
		/** Monospace, for code, tokens and hashes. */
		mono?: boolean;
		/** Digits of equal width, so a changing readout does not jitter. */
		tabular?: boolean;
		/** Without the halo the text sits flat on whatever is behind it. */
		halo?: boolean;
		/** Draws a rounded pill behind the text instead of a halo. */
		pill?: boolean;
	}
	let {
		x,
		y,
		text,
		size = 13,
		weight = 500,
		anchor = 'middle',
		muted = false,
		color,
		opacity = 1,
		rotate = 0,
		italic = false,
		mono = false,
		tabular = false,
		halo = true,
		pill = false
	}: Props = $props();

	const width = $derived(text.length * size * 0.58 + 14);
	const px = $derived(
		anchor === 'start' ? x - 7 : anchor === 'end' ? x - width + 7 : x - width / 2
	);
</script>

<g transform="rotate({rotate} {x} {y})" {opacity} style:pointer-events="none">
	{#if pill}
		<rect
			x={px}
			y={y - size * 0.75 - 4}
			{width}
			height={size + 10}
			rx={(size + 10) / 2}
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	{/if}
	<text
		{x}
		{y}
		class:halo={halo && !pill}
		class:muted
		text-anchor={anchor}
		font-size={size}
		font-weight={weight}
		font-style={italic ? 'italic' : undefined}
		style:font-family={mono ? 'var(--font-mono)' : undefined}
		style:font-variant-numeric={tabular ? 'tabular-nums' : undefined}
		style:fill={color}
	>
		{text}
	</text>
</g>
