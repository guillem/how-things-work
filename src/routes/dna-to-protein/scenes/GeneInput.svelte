<script lang="ts">
	/**
	 * The box for the reader's own sequence: an HTML text input in a `foreignObject` (the
	 * explainer ignores its keyboard shortcuts while an input has focus). Letters other than
	 * A, C, G, T (U counts as T) are dropped as they are typed; the result goes to `params.own`.
	 */
	import { Readout, type ParamValue } from '#lib/explainer/index.ts';
	import { cleanDna } from '../genetics';
	import { MAX_OWN } from '../genes';
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		w: number;
		value: string;
		setParam: (id: string, value: ParamValue) => void;
	}
	let { x, y, w, value, setParam }: Props = $props();

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const box = event.currentTarget;
		const v = cleanDna(box.value, MAX_OWN);
		if (v !== box.value) box.value = v;
		setParam('own', v);
	}
</script>

<foreignObject {x} {y} width={w} height="36">
	<input
		class="dp-seq"
		type="text"
		{value}
		spellcheck="false"
		autocomplete="off"
		aria-label="Your DNA sequence"
		{oninput}
	/>
</foreignObject>
<Readout id="own-length">
	<Label
		anchor="start"
		tabular
		x={x + w + 10}
		y={y + 23}
		text="{value.length} of {MAX_OWN} letters (A C G T)"
		size={11}
		muted
	/>
</Readout>

<style>
	.dp-seq {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 0 10px;
		border: 1.5px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 500 15px var(--font-mono);
		letter-spacing: 0.04em;
		user-select: text;
		-webkit-user-select: text;
	}
	@media (max-width: 640px) {
		.dp-seq {
			font-size: 30px;
		}
	}
	.dp-seq:focus {
		outline: none;
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
