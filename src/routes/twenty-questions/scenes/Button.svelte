<script lang="ts">
	/**
	 * A button drawn on the stage (an answer, a question, an animal): a rounded card with its text,
	 * clickable and keyboard accessible (Enter or Space).
	 */
	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		text: string;
		/** The accessible name, when it differs from the text. */
		label?: string;
		size?: number;
		weight?: number;
		/** Text at the start (default) or the middle. */
		anchor?: 'start' | 'middle';
		fill?: string;
		stroke?: string;
		ink?: string;
		/** A short note at the right end (an answer already given). */
		tag?: string;
		tagColor?: string;
		disabled?: boolean;
		opacity?: number;
		onpress: () => void;
	}
	let {
		x,
		y,
		w,
		h,
		text,
		label,
		size = 14,
		weight = 600,
		anchor = 'start',
		fill = 'var(--surface)',
		stroke = 'var(--border)',
		ink = 'var(--stage-ink)',
		tag,
		tagColor,
		disabled = false,
		opacity = 1,
		onpress
	}: Props = $props();

	function key(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!disabled) onpress();
		}
	}
</script>

<g {opacity}>
	<rect
		{x}
		{y}
		width={w}
		height={h}
		rx={Math.min(10, h / 2)}
		{fill}
		{stroke}
		stroke-width="1.5"
		role="button"
		tabindex={disabled ? -1 : 0}
		aria-label={label ?? text}
		aria-disabled={disabled}
		style:cursor={disabled ? 'default' : 'pointer'}
		onclick={() => {
			if (!disabled) onpress();
		}}
		onkeydown={key}
	/>
	<text
		x={anchor === 'middle' ? x + w / 2 : x + 10}
		y={y + h / 2 + size * 0.36}
		text-anchor={anchor}
		font-size={size}
		font-weight={weight}
		fill={ink}
		style:pointer-events="none">{text}</text
	>
	{#if tag}
		<text
			x={x + w - 10}
			y={y + h / 2 + size * 0.36}
			text-anchor="end"
			font-size={size}
			font-weight="800"
			fill={tagColor ?? ink}
			style:pointer-events="none">{tag}</text
		>
	{/if}
</g>
