<script lang="ts">
	/**
	 * A draggable point in a scene, for `manipulate` topics.
	 *
	 * Drag it with a mouse, pen or finger, or focus it (Tab) and use the arrow
	 * keys (Shift for bigger steps), Home and End. It reports positions in scene
	 * coordinates through `onmove` and key presses through `onkey`; the scene
	 * decides what they mean (an angle, a value on an axis…) and usually writes
	 * the result into `params`, so that a slider for the same value follows.
	 *
	 *   <Handle x={p.x} y={p.y} label="Angle" value={30} min={0} max={360} valuetext="30°"
	 *     onmove={(p) => (params.angle = angleOf(p))}
	 *     onkey={(step) => (params.angle = Number(params.angle) + step)} />
	 */
	import type { Point } from './math';
	import { startDrag } from './pointer';

	interface Props {
		x: number;
		y: number;
		/** Accessible name, e.g. "Point on the circle". */
		label: string;
		/** Current value and range for assistive technology (role="slider"). */
		value: number;
		min: number;
		max: number;
		/** Accessible value, e.g. "30 degrees". */
		valuetext: string;
		color?: string;
		/** Radius of the visible dot; the grab area is larger. */
		r?: number;
		/** Called with the pointer position (scene coordinates) while dragging. */
		onmove: (p: Point) => void;
		/**
		 * Called for arrow keys with ±1 (±10 with Shift or Page Up/Down), and with
		 * `'start'` / `'end'` for Home / End.
		 */
		onkey?: (step: number | 'start' | 'end') => void;
		ondragstart?: () => void;
		ondragend?: () => void;
	}
	let {
		x,
		y,
		label,
		value,
		min,
		max,
		valuetext,
		color = 'var(--explainer-accent, var(--accent))',
		r = 9,
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
		if (!onkey) return;
		const big = event.shiftKey ? 10 : 1;
		const keys: Record<string, number | 'start' | 'end'> = {
			ArrowRight: big,
			ArrowUp: big,
			ArrowLeft: -big,
			ArrowDown: -big,
			PageUp: 10,
			PageDown: -10,
			Home: 'start',
			End: 'end'
		};
		const step = keys[event.key];
		if (step === undefined) return;
		event.preventDefault();
		onkey(step);
	}
</script>

<g
	class="handle"
	class:dragging
	role="slider"
	tabindex="0"
	aria-label={label}
	aria-valuetext={valuetext}
	aria-valuenow={value}
	aria-valuemin={min}
	aria-valuemax={max}
	{onpointerdown}
	{onkeydown}
>
	<!-- generous, invisible grab area (fingers are larger than dots) -->
	<circle cx={x} cy={y} r={r + 14} fill="transparent" />
	<circle class="halo" cx={x} cy={y} r={r + 6} fill={color} />
	<circle class="ring" cx={x} cy={y} r={r + 5} fill="none" stroke="var(--focus)" stroke-width="2" />
	<circle cx={x} cy={y} {r} fill={color} stroke="var(--stage-bg)" stroke-width="2.5" />
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
	.halo {
		opacity: 0.18;
		transition: opacity 0.15s;
	}
	.handle:hover .halo,
	.handle.dragging .halo {
		opacity: 0.32;
	}
	.ring {
		opacity: 0;
	}
	.handle:focus-visible .ring {
		opacity: 1;
	}
</style>
