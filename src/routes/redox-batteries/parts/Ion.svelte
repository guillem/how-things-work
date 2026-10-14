<script lang="ts">
	/**
	 * A particle of the redox scenes: a disc in a fixed colour with its symbol, e.g. "Zn²⁺",
	 * The text size is set as a style: the stage's own \`text\` rule (13 px) overrides
	 * presentation attributes.
	 */
	interface Props {
		x: number;
		y: number;
		r?: number;
		fill: string;
		edge?: string;
		text?: string;
		/** Text colour: the stage background, which contrasts with the ion colours in both themes. */
		ink?: string;
		size?: number;
		opacity?: number;
	}
	let {
		x,
		y,
		r = 14,
		fill,
		edge = 'var(--stage-bg)',
		text = '',
		ink = 'var(--stage-bg)',
		size,
		opacity = 1
	}: Props = $props();
	const fs = $derived(size ?? Math.max(8, Math.min(13, r * 0.78)));
</script>

<g transform="translate({x} {y})" {opacity} style:pointer-events="none">
	<circle {r} {fill} stroke={edge} stroke-width="1.2" />
	{#if text}
		<text
			y={fs * 0.36}
			text-anchor="middle"
			style:font-size="{fs}px"
			font-weight="600"
			style:fill={ink}>{text}</text
		>
	{/if}
</g>
