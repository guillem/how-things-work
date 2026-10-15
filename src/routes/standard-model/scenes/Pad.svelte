<script lang="ts">
	/**
	 * A button drawn on the stage (a palette key, a quark in the bag): a rounded tile with a
	 * label, keyboard accessible (Tab, Enter or Space).
	 */
	interface Props {
		x: number;
		y: number;
		w: number;
		h: number;
		label: string;
		/** A smaller second line. */
		sub?: string;
		/** Tile colour; the label is drawn in `ink`. */
		fill?: string;
		ink?: string;
		/** Outline colour (default: the theme border). */
		edge?: string;
		size?: number;
		disabled?: boolean;
		ariaLabel: string;
		onpress: () => void;
	}
	let {
		x,
		y,
		w,
		h,
		label,
		sub,
		fill = 'var(--surface)',
		ink = 'var(--stage-ink)',
		edge = 'var(--border)',
		size = 20,
		disabled = false,
		ariaLabel,
		onpress
	}: Props = $props();

	function key(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		// Space and Enter on a focused pad must not reach the explainer (play/pause).
		e.preventDefault();
		e.stopPropagation();
		if (!disabled) onpress();
	}
</script>

<g
	class="pad"
	class:disabled
	role="button"
	tabindex="0"
	aria-label={ariaLabel}
	aria-disabled={disabled}
	onclick={() => !disabled && onpress()}
	onkeydown={key}
>
	<rect class="ring" x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx="14" />
	<rect {x} {y} width={w} height={h} rx="11" {fill} stroke={edge} stroke-width="1.5" />
	<text
		x={x + w / 2}
		y={y + h / 2 + (sub ? size * 0.12 : size * 0.36)}
		text-anchor="middle"
		font-weight="700"
		font-size={size}
		style:fill={ink}>{label}</text
	>
	{#if sub}
		<text
			x={x + w / 2}
			y={y + h - 9}
			text-anchor="middle"
			font-size="11"
			style:fill={ink}
			opacity="0.85">{sub}</text
		>
	{/if}
</g>

<style>
	.pad {
		cursor: pointer;
		outline: none;
	}
	.pad.disabled {
		cursor: default;
		opacity: 0.4;
	}
	.ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 2.5;
		opacity: 0;
	}
	.pad:focus-visible .ring {
		opacity: 1;
	}
	.pad:not(.disabled):hover rect:not(.ring) {
		filter: brightness(1.06);
	}
</style>
