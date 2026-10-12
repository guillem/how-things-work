<script lang="ts">
	/**
	 * Makes a part of a scene movable in two dimensions: drag it with a
	 * pointer, or Tab to it and use the arrow keys (Shift for bigger steps).
	 * The grab offset is kept, so the part doesn't jump to the pointer.
	 * (The shared `<Handle>` is one-dimensional for the keyboard.)
	 */
	import { startDrag, toSvg } from '#lib/draw/index.ts';
	import type { Snippet } from 'svelte';
	import type { Vec } from '../optics';

	interface Props {
		/** The part's reference point. */
		x: number;
		y: number;
		/** Accessible name, e.g. "Lens". */
		label: string;
		onmove: (p: Vec) => void;
		children: Snippet;
	}
	let { x, y, label, onmove, children }: Props = $props();

	let dragging = $state(false);

	function onpointerdown(event: PointerEvent) {
		const start = toSvg(event, event.currentTarget as Element);
		const off = { x: x - start.x, y: y - start.y };
		dragging = true;
		startDrag(
			event,
			(p) => onmove({ x: p.x + off.x, y: p.y + off.y }),
			() => (dragging = false)
		);
	}

	function onkeydown(event: KeyboardEvent) {
		const k = event.shiftKey ? 25 : 5;
		const d: Record<string, [number, number]> = {
			ArrowLeft: [-k, 0],
			ArrowRight: [k, 0],
			ArrowUp: [0, -k],
			ArrowDown: [0, k]
		};
		const m = d[event.key];
		if (!m) return;
		event.preventDefault();
		onmove({ x: x + m[0], y: y + m[1] });
	}
</script>

<g
	class="grip"
	class:dragging
	role="button"
	tabindex="0"
	aria-roledescription="movable part"
	aria-label="{label}: drag, or use the arrow keys to move it"
	{onpointerdown}
	{onkeydown}
>
	{@render children()}
</g>

<style>
	.grip {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.grip.dragging {
		cursor: grabbing;
	}
	.grip:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 2px;
	}
</style>
