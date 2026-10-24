<script lang="ts">
	/** A button drawn on the stage: clickable, tappable, and reachable with Tab, Enter and Space. */
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		label: string;
		color?: string;
		disabled?: boolean;
		id: string;
		onpress: () => void;
	}
	let {
		x,
		y,
		w,
		h = 38,
		label,
		color = 'var(--stage-ink-muted)',
		disabled = false,
		id,
		onpress
	}: Props = $props();

	function press() {
		if (!disabled) onpress();
	}
	function key(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			e.stopPropagation();
			press();
		}
	}
</script>

<g
	class="tam-button"
	role="button"
	tabindex={disabled ? -1 : 0}
	aria-label={label}
	aria-disabled={disabled}
	data-button={id}
	opacity={disabled ? 0.4 : 1}
	style:cursor={disabled ? 'default' : 'pointer'}
	onclick={press}
	onkeydown={key}
>
	<rect
		{x}
		{y}
		width={w}
		height={h}
		rx={h / 2}
		fill="var(--surface)"
		stroke={color}
		stroke-width="2"
	/>
	<text
		x={x + w / 2}
		y={y + h / 2 + 5}
		text-anchor="middle"
		font-size="15"
		font-weight="700"
		fill={color}>{label}</text
	>
</g>

<style>
	.tam-button:focus {
		outline: none;
	}
	.tam-button:focus-visible rect {
		stroke-width: 4;
	}
</style>
