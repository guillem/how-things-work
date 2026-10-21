<script lang="ts">
	/**
	 * The text box for the reader's message: an HTML input in a `foreignObject` (the explainer
	 * ignores its keyboard shortcuts while an input has focus). Every edit goes to `oninput`,
	 * which the scene writes back with `setParam`, so the message survives step changes.
	 */
	interface Props {
		x: number;
		y: number;
		w: number;
		h?: number;
		value: string;
		label: string;
		placeholder?: string;
		maxlength?: number;
		oninput: (value: string) => void;
	}
	let {
		x,
		y,
		w,
		h = 52,
		value,
		label,
		placeholder = '',
		maxlength = 36,
		oninput
	}: Props = $props();
</script>

<foreignObject {x} {y} width={w} height={h}>
	<input
		class="sc-input"
		type="text"
		{value}
		{placeholder}
		{maxlength}
		spellcheck="false"
		autocomplete="off"
		aria-label={label}
		data-field="msg"
		oninput={(e) => oninput(e.currentTarget.value)}
	/>
</foreignObject>

<style>
	.sc-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 14px;
		border: 2px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 700 24px var(--font-mono);
		text-transform: uppercase;
		user-select: text;
		-webkit-user-select: text;
	}
	/* on phones the stage is drawn at ~0.4 scale: larger type keeps the field legible */
	@media (max-width: 640px) {
		.sc-input {
			padding: 0 6px;
			font-size: 40px;
		}
	}
	.sc-input:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
