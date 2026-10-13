<script lang="ts">
	/**
	 * "Load your own picture": a native file input (in a `foreignObject`, styled as a button).
	 * The picture is decoded in the browser by `loadPicture` and never uploaded anywhere; it is
	 * shown by setting `params.image = 'own'` and `params.own` to the load counter.
	 */
	import type { ParamValue } from '#lib/explainer/index.ts';
	import { loadPicture } from './shared';
	import { Readout } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';

	interface Props {
		x: number;
		y: number;
		w: number;
		missing: boolean;
		setParam: (id: string, value: ParamValue) => void;
	}
	let { x, y, w, missing, setParam }: Props = $props();

	let failed = $state(false);

	async function onchange(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			const n = await loadPicture(file);
			failed = false;
			setParam('own', n);
			setParam('image', 'own');
		} catch {
			failed = true;
		}
	}
</script>

<foreignObject {x} {y} width={w} height="40">
	<label class="cmp-load">
		<input type="file" accept="image/*" aria-label="Load your own picture" {onchange} />
		<span class="wide">Load your own picture…</span>
		<span class="narrow">Your picture…</span>
	</label>
</foreignObject>
<!-- hidden on phones, where it would be unreadable -->
<Readout id="picture-status">
	<Txt
		{x}
		y={y + 60}
		text={failed
			? 'That file could not be read as a picture.'
			: missing
				? 'No picture loaded: showing the hills.'
				: 'It stays in your browser.'}
		size={11}
		muted
	/>
</Readout>

<style>
	.cmp-load {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border: 1.5px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--stage-ink);
		font: 600 13px var(--font-sans, inherit);
		cursor: pointer;
		position: relative;
	}
	.cmp-load .narrow {
		display: none;
	}
	/* on phones the stage is drawn at ~0.4 scale: a shorter, larger label */
	@media (max-width: 640px) {
		.cmp-load {
			font-size: 26px;
		}
		.cmp-load .wide {
			display: none;
		}
		.cmp-load .narrow {
			display: inline;
		}
	}
	.cmp-load:hover {
		border-color: var(--explainer-accent, var(--accent));
	}
	/* Visually hidden but focusable, so the keyboard reaches it. */
	.cmp-load input {
		position: absolute;
		inset: 0;
		opacity: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	.cmp-load:focus-within {
		border-color: var(--explainer-accent, var(--accent));
		box-shadow: 0 0 0 3px
			color-mix(in oklab, var(--explainer-accent, var(--accent)) 30%, transparent);
	}
</style>
