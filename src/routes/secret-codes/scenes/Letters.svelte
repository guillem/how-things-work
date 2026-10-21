<script lang="ts">
	/**
	 * A message drawn letter by letter in capitals, each character in its own column, wrapped at
	 * spaces into lines of at most `width` characters. One character can be marked (a soft
	 * highlight behind it) and each can have its own colour, so a scene can follow the coding
	 * letter by letter.
	 */
	import { wrap } from '../state';

	interface Props {
		x: number;
		/** Baseline of the first line. */
		y: number;
		text: string;
		/** Characters per line at most. */
		width: number;
		size?: number;
		lineHeight?: number;
		color?: string;
		weight?: number;
		/** Index in `text` of the character to mark, or −1. */
		mark?: number;
		markColor?: string;
		/** Colour of the character at index `i` (falls back to `color`). */
		colorAt?: (i: number) => string | undefined;
		/** Width of one character column (by default from `size`). */
		pitch?: number;
		/** Draws '_' gaps as short lines rather than underscores. */
		gaps?: boolean;
	}
	let {
		x,
		y,
		text,
		width,
		size = 28,
		lineHeight = size * 1.3,
		color = 'var(--stage-ink)',
		weight = 700,
		mark = -1,
		markColor = 'var(--sc-hi)',
		colorAt,
		gaps = false,
		pitch
	}: Props = $props();

	const cw = $derived(pitch ?? size * 0.62);
	const lines = $derived(wrap(text, width));
</script>

{#each lines as line, li (li)}
	{#each [...line.text] as ch, ci (ci)}
		{@const i = line.start + ci}
		{@const cx = x + ci * cw + cw / 2}
		{@const by = y + li * lineHeight}
		{#if i === mark}
			<rect
				x={cx - cw / 2 - 2}
				y={by - size * 0.86}
				width={cw + 4}
				height={size * 1.12}
				rx="5"
				fill={markColor}
				opacity="0.55"
			/>
		{/if}
		{#if gaps && ch === '_'}
			<line
				x1={cx - cw * 0.38}
				x2={cx + cw * 0.38}
				y1={by + 2}
				y2={by + 2}
				stroke={colorAt?.(i) ?? color}
				stroke-width="2"
				stroke-linecap="round"
			/>
		{:else if ch !== ' '}
			<text
				x={cx}
				y={by}
				text-anchor="middle"
				font-size={size}
				font-weight={weight}
				fill={colorAt?.(i) ?? color}
				style:font-family="var(--font-mono)">{ch}</text
			>
		{/if}
	{/each}
{/each}
