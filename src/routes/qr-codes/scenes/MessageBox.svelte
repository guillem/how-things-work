<script lang="ts">
	/**
	 * The reader's message: an HTML input in a `foreignObject` (the explainer ignores its keyboard
	 * shortcuts while a field has focus), written back to `params.msg`. Kept to MAX_BYTES bytes of
	 * UTF-8, so that the code stays one of the four smallest sizes.
	 */
	import type { ParamValue } from '#lib/explainer/index.ts';
	import { MAX_BYTES } from '../model';

	interface Props {
		x: number;
		y: number;
		w: number;
		value: string;
		setParam: (id: string, value: ParamValue) => void;
	}
	let { x, y, w, value, setParam }: Props = $props();

	const bytes = (s: string) => new TextEncoder().encode(s).length;

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const box = event.currentTarget;
		let v = box.value;
		while (bytes(v) > MAX_BYTES) v = [...v].slice(0, -1).join('');
		if (v !== box.value) box.value = v;
		setParam('msg', v);
	}
</script>

<foreignObject {x} {y} width={w} height="50">
	<input
		class="qr-text"
		type="text"
		{value}
		spellcheck="false"
		autocomplete="off"
		aria-label="Your message"
		data-input="msg"
		{oninput}
	/>
</foreignObject>

<style>
	.qr-text {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 4px 16px;
		border: 2px solid var(--border);
		border-radius: 14px;
		background: var(--surface);
		color: var(--stage-ink);
		font-family: inherit;
		font-size: 19px;
		font-weight: 600;
		user-select: text;
		-webkit-user-select: text;
	}
	@media (max-width: 640px) {
		.qr-text {
			padding: 2px 10px;
			font-size: 32px;
		}
	}
	.qr-text:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
