<script lang="ts">
	/**
	 * A grab handle on the tip of a vector arrow (the arrow itself is drawn by
	 * the scene).
	 *
	 * Based on complex-numbers' `PointHandle`: like the shared `Handle`, but its
	 * arrow keys are two-dimensional, which a vector needs. The scene gets
	 * (dx, dy) = (±1, 0) for ← →, (0, ±1) for ↑ ↓ (×5 with Shift) and decides
	 * the step size. Every key it handles is default-prevented, so the
	 * explainer's own arrow-key navigation leaves it alone.
	 */
	import { startDrag, type Point } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		/**
		 * Drawn offset from (x, y), for when two handles would sit on the same
		 * spot: the handle floats a little off the tip so both stay grabbable.
		 * A drag moves the tip by the distance dragged, so a click moves nothing.
		 */
		dx?: number;
		dy?: number;
		label: string;
		/** For assistive technology: the vector's angle in degrees (valuetext says the rest). */
		value: number;
		valuetext: string;
		color: string;
		r?: number;
		onmove: (p: Point) => void;
		onkey: (dx: number, dy: number) => void;
		ondragstart?: () => void;
		ondragend?: () => void;
	}
	let {
		x,
		y,
		dx = 0,
		dy = 0,
		label,
		value,
		valuetext,
		color,
		r = 11,
		onmove,
		onkey,
		ondragstart,
		ondragend
	}: Props = $props();

	let dragging = $state(false);

	function onpointerdown(event: PointerEvent) {
		dragging = true;
		ondragstart?.();
		// Keep the pointer's offset from the true tip for the whole drag: grabbing
		// the handle anywhere (or a floated handle) moves nothing, and the tip then
		// follows the pointer by exactly the distance dragged.
		let off: Point | null = null;
		startDrag(
			event,
			(p) => {
				off ??= { x: p.x - x, y: p.y - y };
				onmove({ x: p.x - off.x, y: p.y - off.y });
			},
			() => {
				dragging = false;
				ondragend?.();
			}
		);
	}

	function onkeydown(event: KeyboardEvent) {
		const k = event.shiftKey ? 5 : 1;
		const keys: Record<string, [number, number]> = {
			ArrowRight: [k, 0],
			ArrowLeft: [-k, 0],
			ArrowUp: [0, k],
			ArrowDown: [0, -k]
		};
		const d = keys[event.key];
		if (!d) return;
		event.preventDefault();
		onkey(d[0], d[1]);
	}
</script>

<g
	class="handle"
	class:dragging
	role="slider"
	tabindex="0"
	aria-roledescription="draggable arrow tip"
	aria-label={label}
	aria-valuetext={valuetext}
	aria-valuenow={Math.round(value)}
	aria-valuemin={-180}
	aria-valuemax={180}
	{onpointerdown}
	{onkeydown}
>
	<circle cx={x + dx} cy={y + dy} r={r + 12} fill="transparent" />
	<circle class="grab-halo" cx={x + dx} cy={y + dy} {r} fill={color} />
	<circle cx={x + dx} cy={y + dy} {r} fill="none" stroke={color} stroke-width="1.5" opacity="0.7" />
	<circle
		class="ring"
		cx={x + dx}
		cy={y + dy}
		r={r + 4}
		fill="none"
		stroke="var(--focus)"
		stroke-width="2"
	/>
</g>

<style>
	.handle {
		cursor: grab;
		touch-action: none;
		outline: none;
	}
	.handle.dragging {
		cursor: grabbing;
	}
	.grab-halo {
		opacity: 0.16;
		transition: opacity 0.15s;
	}
	.handle:hover .grab-halo,
	.handle.dragging .grab-halo {
		opacity: 0.32;
	}
	.ring {
		opacity: 0;
	}
	.handle:focus-visible .ring {
		opacity: 1;
	}
</style>
