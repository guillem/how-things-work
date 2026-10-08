<script lang="ts">
	/**
	 * A draggable point on the complex plane, with a letter label.
	 *
	 * Like the shared `Handle`, but its arrow keys are two-dimensional: the
	 * scene gets (dx, dy) = (±1, 0) for ← →, (0, ±1) for ↑ ↓ (×5 with Shift),
	 * and decides what they mean (a step along an axis, a turn, a stretch).
	 * Every key it handles is default-prevented, so the explainer's own arrow
	 * key navigation leaves it alone.
	 */
	import { startDrag, type Point } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		label: string;
		/** For assistive technology: the point's angle in degrees (valuetext says the rest). */
		value: number;
		valuetext: string;
		color: string;
		/** A short name drawn beside the point ("z", "w"). */
		name?: string;
		/** Where the name goes, as an offset from the point. */
		nameDx?: number;
		nameDy?: number;
		r?: number;
		onmove: (p: Point) => void;
		onkey: (dx: number, dy: number) => void;
	}
	let {
		x,
		y,
		label,
		value,
		valuetext,
		color,
		name,
		nameDx = 14,
		nameDy = -12,
		r = 9,
		onmove,
		onkey
	}: Props = $props();

	let dragging = $state(false);

	function onpointerdown(event: PointerEvent) {
		dragging = true;
		startDrag(event, onmove, () => (dragging = false));
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
	aria-roledescription="draggable point"
	aria-label={label}
	aria-valuetext={valuetext}
	aria-valuenow={Math.round(value)}
	aria-valuemin={0}
	aria-valuemax={360}
	{onpointerdown}
	{onkeydown}
>
	<circle cx={x} cy={y} r={r + 14} fill="transparent" />
	<circle class="grab-halo" cx={x} cy={y} r={r + 6} fill={color} />
	<circle class="ring" cx={x} cy={y} r={r + 5} fill="none" stroke="var(--focus)" stroke-width="2" />
	<circle cx={x} cy={y} {r} fill={color} stroke="var(--stage-bg)" stroke-width="2.5" />
	{#if name}
		<text
			class="halo"
			x={x + nameDx}
			y={y + nameDy}
			text-anchor={nameDx < 0 ? 'end' : 'start'}
			font-weight="700"
			style:font-size="17px"
			style:fill={color}
			style:font-style="italic">{name}</text
		>
	{/if}
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
		opacity: 0.18;
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
