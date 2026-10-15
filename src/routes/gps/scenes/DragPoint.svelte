<script lang="ts">
	/**
	 * A draggable point (a satellite or the receiver) with two-dimensional arrow keys:
	 * the scene gets (dx, dy) = (±1, 0) for ← →, (0, ∓1) for ↑ ↓ in SVG directions (×5 with
	 * Shift). Like `VectorHandle`, but announced as a point. The scene draws the object itself;
	 * this adds the grab area, the hover halo and the focus ring. Every key it handles is
	 * default-prevented, so the explainer's arrow-key navigation leaves it alone.
	 */
	import { startDrag, type Point } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		label: string;
		valuetext: string;
		color: string;
		r?: number;
		onmove: (p: Point) => void;
		onkey: (dx: number, dy: number) => void;
	}
	let { x, y, label, valuetext, color, r = 14, onmove, onkey }: Props = $props();

	let dragging = $state(false);

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0) return;
		dragging = true;
		// Keep the pointer's offset from the point, so grabbing it off-centre moves nothing.
		let off: Point | null = null;
		startDrag(
			event,
			(p) => {
				off ??= { x: p.x - x, y: p.y - y };
				onmove({ x: p.x - off.x, y: p.y - off.y });
			},
			() => (dragging = false)
		);
	}

	function onkeydown(event: KeyboardEvent) {
		const k = event.shiftKey ? 5 : 1;
		const keys: Record<string, [number, number]> = {
			ArrowRight: [k, 0],
			ArrowLeft: [-k, 0],
			ArrowUp: [0, -k],
			ArrowDown: [0, k]
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
	aria-roledescription="draggable point"
	aria-label={label}
	aria-valuetext={valuetext}
	aria-valuenow={Math.round(x)}
	aria-valuemin={0}
	aria-valuemax={960}
	{onpointerdown}
	{onkeydown}
>
	<circle cx={x} cy={y} r={r + 10} fill="transparent" />
	<circle class="grab-halo" cx={x} cy={y} {r} fill={color} />
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
		opacity: 0;
		transition: opacity 0.15s;
	}
	.handle:hover .grab-halo,
	.handle.dragging .grab-halo {
		opacity: 0.22;
	}
	.ring {
		opacity: 0;
	}
	.handle:focus-visible .ring {
		opacity: 1;
	}
</style>
