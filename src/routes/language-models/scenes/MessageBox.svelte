<script lang="ts">
	/**
	 * The text box of the tokenizer steps: an HTML textarea in a `foreignObject` (the explainer
	 * ignores its keyboard shortcuts while a field has focus) and preset chips. Everything is
	 * written back to `params.msg` with `setParam`.
	 */
	import { Readout, type ParamValue } from '#lib/explainer/index.ts';
	import { MAX_LENGTH } from './shared';
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		w: number;
		value: string;
		setParam: (id: string, value: ParamValue) => void;
	}
	let { x, y, w, value, setParam }: Props = $props();

	const PRESETS = [
		{ label: 'Paris paris', value: 'Paris, in Paris, paris and PARIS' },
		{ label: 'long words', value: 'Tokenization of antidisestablishmentarianism' },
		{ label: 'numbers', value: 'In 2026, π ≈ 3.14159 and 1,000,000 ÷ 7' },
		{ label: 'accents', value: 'Café crème, naïve résumé' },
		{ label: 'emoji', value: 'I love it 🙂👍🏽' },
		{ label: 'code', value: 'def add(a, b):\n    return a + b' }
	];

	const chips = $derived.by(() => {
		let cx = x + 44;
		return PRESETS.map((p) => {
			const cw = p.label.length * 7.4 + 22;
			const chip = { ...p, x: cx, w: cw };
			cx += cw + 8;
			return chip;
		});
	});

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		const box = event.currentTarget;
		const v = [...box.value].slice(0, MAX_LENGTH).join('');
		if (v !== box.value) box.value = v;
		setParam('msg', v);
	}

	function onkeydown(event: KeyboardEvent, v: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		setParam('msg', v);
	}
</script>

<foreignObject {x} {y} width={w} height="58">
	<textarea
		class="lm-text"
		{value}
		rows="2"
		spellcheck="false"
		autocomplete="off"
		aria-label="Text to tokenize"
		{oninput}></textarea>
</foreignObject>
<Readout id="msg-length">
	<Label
		tabular
		x={x + w}
		y={y + 76}
		anchor="end"
		text="{[...value].length} of {MAX_LENGTH} characters"
		size={11}
		muted
	/>
</Readout>
<Readout id="msg-try">
	<Label anchor="start" {x} y={y + 85} text="Try:" size={12} muted />
</Readout>
{#each chips as c (c.label)}
	{@const on = c.value === value}
	<g
		class="lm-chip"
		role="button"
		tabindex="0"
		aria-label="Use the text {c.value}"
		aria-pressed={on}
		onclick={() => setParam('msg', c.value)}
		onkeydown={(e) => onkeydown(e, c.value)}
	>
		<rect
			x={c.x}
			y={y + 68}
			width={c.w}
			height="24"
			rx="12"
			fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
			fill-opacity={on ? 0.18 : 1}
			stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
		/>
		<text x={c.x + c.w / 2} y={y + 84.5} text-anchor="middle" font-size="12">{c.label}</text>
	</g>
{/each}

<style>
	.lm-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 6px 12px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 17px/1.3 var(--font-mono);
		resize: none;
		user-select: text;
		-webkit-user-select: text;
	}
	@media (max-width: 640px) {
		.lm-text {
			padding: 2px 8px;
			font-size: 30px;
		}
	}
	.lm-text:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
	.lm-chip {
		cursor: pointer;
		outline: none;
	}
	.lm-chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
