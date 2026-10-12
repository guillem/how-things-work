<script lang="ts">
	/**
	 * A grab handle for an event on the spacetime diagram. Copied from
	 * linear-transformations' `VectorHandle`: like the shared `Handle`, but its
	 * arrow keys are two-dimensional. The scene gets (dx, dy) = (±1, 0) for ← →,
	 * (0, ±1) for ↑ ↓ (×5 with Shift) and decides the step size. Every key it
	 * handles is default-prevented, so the explainer's own arrow-key navigation
	 * leaves it alone.
	 */
	import { startDrag, type Point } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		label: string;
		/** For assistive technology: the event's time c·t in metres (valuetext says the rest). */
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
		startDrag(event, onmove, () => {
			dragging = false;
			ondragend?.();
		});
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
	aria-roledescription="draggable event"
	aria-label={label}
	aria-valuetext={valuetext}
	aria-valuenow={Math.round(value)}
	aria-valuemin={-250}
	aria-valuemax={250}
	{onpointerdown}
	{onkeydown}
>
	<circle cx={x} cy={y} r={r + 12} fill="transparent" />
	<circle class="grab-halo" cx={x} cy={y} {r} fill={color} />
	<circle cx={x} cy={y} {r} fill="none" stroke={color} stroke-width="1.5" opacity="0.7" />
	<circle class="ring" cx={x} cy={y} r={r + 4} fill="none" stroke="var(--focus)" stroke-width="2" />
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
