<script lang="ts">
	/**
	 * A text box on the stage (an HTML input in a `foreignObject`; the explainer ignores its
	 * keyboard shortcuts while an input has focus). Every edit is passed to `oninput`, which the
	 * scenes write back with `setParam`, so the text survives step changes.
	 */
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		value: string;
		label: string;
		placeholder?: string;
		/** Marks the text as not understood (a word that is not in the list). */
		invalid?: boolean;
		maxlength?: number;
		/** Font size in px on wide screens. */
		size?: number;
		oninput: (value: string) => void;
	}
	let {
		x,
		y,
		w,
		h = 40,
		value,
		label,
		placeholder = '',
		invalid = false,
		maxlength = 24,
		size = 18,
		oninput
	}: Props = $props();
</script>

<foreignObject {x} {y} width={w} height={h}>
	<input
		class="emb-input"
		class:invalid
		type="text"
		{value}
		{placeholder}
		{maxlength}
		spellcheck="false"
		autocomplete="off"
		autocapitalize="off"
		aria-label={label}
		aria-invalid={invalid}
		style:--emb-input-size="{size}px"
		oninput={(e) => oninput(e.currentTarget.value)}
	/>
</foreignObject>

<style>
	.emb-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 12px;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 var(--emb-input-size, 18px) var(--font-sans);
		user-select: text;
		-webkit-user-select: text;
	}
	.emb-input.invalid {
		border-color: var(--emb-warn);
	}
	/* on phones the stage is drawn at ~0.4 scale: larger type keeps the field legible */
	@media (max-width: 640px) {
		.emb-input {
			padding: 0 8px;
			font-size: 30px;
		}
	}
	.emb-input:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
