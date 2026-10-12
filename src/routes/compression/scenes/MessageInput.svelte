<script lang="ts">
	/**
	 * The message box shared by the message and Huffman scenes: an HTML text input in a
	 * `foreignObject` (the explainer ignores its keyboard shortcuts while an input has focus),
	 * and optional preset buttons. Everything is written back to `params.msg` with `setParam`.
	 */
	import type { ParamValue } from '#lib/explainer/index.ts';
	import { MAX_LENGTH, PRESETS } from './shared';
	import Txt from './Txt.svelte';

	interface Props {
		x: number;
		y: number;
		w: number;
		value: string;
		setParam: (id: string, value: ParamValue) => void;
		presets?: boolean;
	}
	let { x, y, w, value, setParam, presets = false }: Props = $props();

	const chips = $derived.by(() => {
		let cx = x + 64;
		return PRESETS.map((p) => {
			const cw = p.label.length * 8.2 + 22;
			const chip = { ...p, x: cx, w: cw };
			cx += cw + 8;
			return chip;
		});
	});

	function onkeydown(event: KeyboardEvent, v: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		// Handled here, so the explainer does not also take Space as play/pause.
		event.preventDefault();
		setParam('msg', v);
	}
</script>

<foreignObject {x} {y} width={w} height="44">
	<input
		class="cmp-text"
		type="text"
		{value}
		maxlength={MAX_LENGTH}
		spellcheck="false"
		autocomplete="off"
		aria-label="Message"
		oninput={(e) => setParam('msg', e.currentTarget.value)}
	/>
</foreignObject>
<Txt
	x={x + w + 12}
	y={y + 27}
	text="{[...value].length} of {MAX_LENGTH} characters"
	size={11}
	muted
/>
{#if presets}
	<Txt {x} y={y + 76} text="Try:" size={12} muted />
	{#each chips as c (c.label)}
		{@const on = c.value === value}
		<g
			class="cmp-chip"
			role="button"
			tabindex="0"
			aria-label="Use the message {c.value}"
			aria-pressed={on}
			onclick={() => setParam('msg', c.value)}
			onkeydown={(e) => onkeydown(e, c.value)}
		>
			<rect
				x={c.x}
				y={y + 58}
				width={c.w}
				height="26"
				rx="13"
				fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
				fill-opacity={on ? 0.18 : 1}
				stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
			/>
			<text
				x={c.x + c.w / 2}
				y={y + 75.5}
				text-anchor="middle"
				style:font-size="12.5px"
				style:font-family="var(--font-mono)">{c.label}</text
			>
		</g>
	{/each}
{/if}

<style>
	.cmp-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 14px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 20px var(--font-mono);
		user-select: text;
		-webkit-user-select: text;
	}
	.cmp-text:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
	.cmp-chip {
		cursor: pointer;
		outline: none;
	}
	.cmp-chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
