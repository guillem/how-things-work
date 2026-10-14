<script lang="ts">
	/**
	 * A part of a drawing the reader can pick: clicking it (or Enter / Space when
	 * focused) shows its info card. Only the front drawing's parts take clicks.
	 */
	import type { Snippet } from 'svelte';
	import { STRUCTURES } from '../structures';

	interface Props {
		id: string;
		pick: (id: string) => void;
		interactive: boolean;
		sel: string | null;
		children: Snippet;
	}
	let { id, pick, interactive, sel, children }: Props = $props();

	function key(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		e.stopPropagation();
		pick(id);
	}
</script>

{#if interactive}
	<g
		class="part"
		class:selected={sel === id}
		role="button"
		tabindex="0"
		aria-label={STRUCTURES[id]?.name ?? id}
		data-part={id}
		onclick={(e) => {
			e.stopPropagation();
			pick(id);
		}}
		onkeydown={key}
	>
		{@render children()}
	</g>
{:else}
	<g class:selected={sel === id} data-part={id}>{@render children()}</g>
{/if}

<style>
	.part {
		cursor: pointer;
	}
	.part:focus {
		outline: none;
	}
	.part:focus-visible,
	.selected {
		filter: drop-shadow(0 0 2.5px var(--accent));
	}
</style>
