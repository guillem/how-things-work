<script lang="ts">
	/**
	 * A token on the stage: a rounded chip with its text. When `onselect` is given it is a button
	 * (click, tap, Enter or Space), and `onhover` fires when the pointer comes over it.
	 */
	import { onkey } from './shared';

	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		text: string;
		/** Name read out by screen readers. */
		name?: string;
		selected?: boolean;
		/** A token the current step does not use (later than the query, or the start token). */
		muted?: boolean;
		opacity?: number;
		size?: number;
		onselect?: () => void;
		onhover?: () => void;
	}
	let {
		x,
		y,
		w,
		h = 26,
		text,
		name,
		selected = false,
		muted = false,
		opacity = 1,
		size = 13,
		onselect,
		onhover
	}: Props = $props();
</script>

{#if onselect}
	<g
		class="chip"
		role="button"
		tabindex="0"
		aria-label="Token {name ?? text}"
		aria-pressed={selected}
		{opacity}
		onclick={onselect}
		onkeydown={(e) => onkey(e, onselect)}
		onpointerenter={(e) => {
			if (e.pointerType === 'mouse') onhover?.();
		}}
	>
		<rect class="ring" x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx="9" />
		{@render body()}
	</g>
{:else}
	<g {opacity}>{@render body()}</g>
{/if}

{#snippet body()}
	<rect
		{x}
		{y}
		width={w}
		height={h}
		rx="6"
		fill={selected ? 'color-mix(in oklab, var(--tf-sel) 28%, var(--surface))' : 'var(--surface)'}
		stroke={selected ? 'var(--tf-sel)' : 'var(--border)'}
		stroke-width={selected ? 2 : 1.2}
		stroke-dasharray={muted ? '3 3' : undefined}
	/>
	<text
		x={x + w / 2}
		y={y + h / 2 + size * 0.36}
		text-anchor="middle"
		style:font-size="{size}px"
		style:font-weight={selected ? 650 : 500}
		style:fill={muted ? 'var(--stage-ink-muted)' : 'var(--stage-ink)'}>{text}</text
	>
{/snippet}

<style>
	.chip {
		cursor: pointer;
		outline: none;
	}
	.ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 2.5;
		opacity: 0;
	}
	.chip:focus-visible .ring {
		opacity: 1;
	}
</style>
