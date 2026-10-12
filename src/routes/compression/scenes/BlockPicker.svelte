<script lang="ts">
	/**
	 * Picks one 8 × 8 block of a picture drawn at (x, y) with `px` stage units per pixel: click
	 * or drag over the picture, or focus it (Tab) and move with the arrow keys (Home / End for
	 * the first and last block). Draws the picked block's outline.
	 */
	import { BLOCKS } from './shared';

	interface Props {
		x: number;
		y: number;
		/** Stage units per pixel. */
		px: number;
		index: number;
		onpick: (index: number) => void;
	}
	let { x, y, px, index, onpick }: Props = $props();

	const size = $derived(BLOCKS * 8 * px);
	const bx = $derived(index % BLOCKS);
	const by = $derived(Math.floor(index / BLOCKS));
	const clampB = (v: number) => Math.min(BLOCKS - 1, Math.max(0, v));

	/**
	 * Picks the block under the pointer. Positions are converted with this element's own
	 * transform (not the root SVG's, as `startDrag` does), so the picker also works inside a
	 * translated group.
	 */
	function pickAt(event: PointerEvent, el: SVGGraphicsElement) {
		const ctm = el.getScreenCTM();
		if (!ctm) return;
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
		const c = clampB(Math.floor((p.x - x) / (8 * px)));
		const r = clampB(Math.floor((p.y - y) / (8 * px)));
		if (r * BLOCKS + c !== index) onpick(r * BLOCKS + c);
	}

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		const el = event.currentTarget as SVGGElement;
		event.preventDefault();
		el.focus();
		el.setPointerCapture?.(event.pointerId);
		pickAt(event, el);
	}

	function onpointermove(event: PointerEvent) {
		const el = event.currentTarget as SVGGElement;
		if (el.hasPointerCapture?.(event.pointerId)) pickAt(event, el);
	}

	function onkeydown(event: KeyboardEvent) {
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, -1],
			ArrowDown: [0, 1]
		};
		let next: number;
		if (event.key in moves) {
			const [dx, dy] = moves[event.key];
			next = clampB(by + dy) * BLOCKS + clampB(bx + dx);
		} else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = BLOCKS * BLOCKS - 1;
		else return;
		// Handled here, so the explainer does not also change step.
		event.preventDefault();
		if (next !== index) onpick(next);
	}
</script>

<g
	class="cmp-picker"
	role="slider"
	tabindex="0"
	aria-label="Block of the picture (arrow keys move it)"
	aria-valuenow={index}
	aria-valuemin={0}
	aria-valuemax={BLOCKS * BLOCKS - 1}
	aria-valuetext="column {bx + 1}, row {by + 1}"
	{onpointerdown}
	{onpointermove}
	{onkeydown}
>
	<rect {x} {y} width={size} height={size} fill="transparent" />
	<rect
		class="ring"
		x={x - 4}
		y={y - 4}
		width={size + 8}
		height={size + 8}
		rx="4"
		fill="none"
		stroke="var(--focus)"
		stroke-width="2"
	/>
	<rect
		x={x + bx * 8 * px - 1.5}
		y={y + by * 8 * px - 1.5}
		width={8 * px + 3}
		height={8 * px + 3}
		rx="2"
		fill="none"
		stroke="var(--cmp-pick)"
		stroke-width="3"
	/>
</g>

<style>
	.cmp-picker {
		cursor: crosshair;
		touch-action: none;
		outline: none;
	}
	.ring {
		opacity: 0;
	}
	.cmp-picker:focus-visible .ring {
		opacity: 1;
	}
</style>
