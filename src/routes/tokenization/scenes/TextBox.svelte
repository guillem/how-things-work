<script lang="ts">
	/**
	 * A text box of the stage: an HTML textarea in a `foreignObject` (the explainer ignores its
	 * keyboard shortcuts while a field has focus) and example chips. The text is written back to
	 * `params[id]` with `setParam`.
	 */
	import { Readout, type ParamValue } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		id: string;
		x: number;
		y: number;
		w: number;
		h: number;
		value: string;
		max: number;
		name: string;
		presets: { label: string; value: string }[];
		setParam: (id: string, value: ParamValue) => void;
	}
	let { id, x, y, w, h, value, max, name, presets, setParam }: Props = $props();

	const chips = $derived.by(() => {
		let cx = x + 40;
		return presets.map((p) => {
			const cw = p.label.length * 7.2 + 22;
			const chip = { ...p, x: cx, w: cw };
			cx += cw + 8;
			return chip;
		});
	});

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		const box = event.currentTarget;
		const v = [...box.value].slice(0, max).join('');
		if (v !== box.value) box.value = v;
		setParam(id, v);
	}

	function onkeydown(event: KeyboardEvent, v: string) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		setParam(id, v);
	}
</script>

<foreignObject {x} {y} width={w} height={h}>
	<textarea
		class="tk-text"
		{value}
		spellcheck="false"
		autocomplete="off"
		aria-label={name}
		{oninput}></textarea>
</foreignObject>
<Readout id="{id}-length">
	<Label
		tabular
		x={x + w}
		y={y + h + 24}
		anchor="end"
		text="{[...value].length} of {max} characters"
		size={11}
		muted
	/>
</Readout>
<Readout id="{id}-try">
	<Label anchor="start" {x} y={y + h + 24} text="Try:" size={12} muted />
</Readout>
{#each chips as c (c.label)}
	{@const on = c.value === value}
	<g
		class="tk-chip"
		role="button"
		tabindex="0"
		aria-label="Use the example {c.label}"
		aria-pressed={on}
		onclick={() => setParam(id, c.value)}
		onkeydown={(e) => onkeydown(e, c.value)}
	>
		<rect
			x={c.x}
			y={y + h + 8}
			width={c.w}
			height="23"
			rx="11.5"
			fill={on ? 'var(--explainer-accent, var(--accent))' : 'var(--surface)'}
			fill-opacity={on ? 0.18 : 1}
			stroke={on ? 'var(--explainer-accent, var(--accent))' : 'var(--border)'}
		/>
		<text x={c.x + c.w / 2} y={y + h + 24} text-anchor="middle" font-size="12">{c.label}</text>
	</g>
{/each}

<style>
	.tk-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 5px 10px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 14px/1.35 var(--font-mono);
		resize: none;
		user-select: text;
		-webkit-user-select: text;
	}
	@media (max-width: 640px) {
		.tk-text {
			padding: 2px 8px;
			font-size: 28px;
		}
	}
	.tk-text:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
	.tk-chip {
		cursor: pointer;
		outline: none;
	}
	.tk-chip:focus-visible rect {
		stroke: var(--focus);
		stroke-width: 2;
	}
</style>
