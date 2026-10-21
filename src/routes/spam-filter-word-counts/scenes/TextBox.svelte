<script lang="ts">
	/**
	 * The reader's own word or message: an HTML input in a `foreignObject` (the explainer ignores
	 * its keyboard shortcuts while a field has focus), written back to `params[id]`. A message is
	 * kept to `maxWords` different words so that every word's card fits on the stage.
	 */
	import type { ParamValue } from '#lib/explainer/index.ts';
	import { words } from '../model';

	interface Props {
		id: string;
		x: number;
		y: number;
		w: number;
		value: string;
		label: string;
		maxLength: number;
		maxWords?: number;
		big?: boolean;
		setParam: (id: string, value: ParamValue) => void;
	}
	let {
		id,
		x,
		y,
		w,
		value,
		label,
		maxLength,
		maxWords = 99,
		big = false,
		setParam
	}: Props = $props();

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const box = event.currentTarget;
		let v = box.value.slice(0, maxLength);
		// Too many different words: cut the text back to the first `maxWords` of them.
		while (words(v).length > maxWords) v = v.slice(0, -1);
		if (v !== box.value) box.value = v;
		setParam(id, v);
	}
</script>

<foreignObject {x} {y} width={w} height={big ? 74 : 52}>
	<input
		class="sp-text"
		class:big
		type="text"
		{value}
		maxlength={maxLength}
		spellcheck="false"
		autocomplete="off"
		aria-label={label}
		data-input={id}
		{oninput}
	/>
</foreignObject>

<style>
	.sp-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 4px 18px;
		border: 2px solid var(--sp-edge);
		border-radius: 16px;
		background: var(--sp-bubble);
		color: var(--stage-ink);
		font-family: inherit;
		font-size: 17px;
		font-weight: 500;
		line-height: 1.3;
		user-select: text;
		-webkit-user-select: text;
	}
	.sp-text.big {
		font-size: 30px;
		font-weight: 700;
		text-align: center;
	}
	@media (max-width: 640px) {
		.sp-text {
			padding: 2px 10px;
			font-size: 30px;
		}
	}
	.sp-text:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
