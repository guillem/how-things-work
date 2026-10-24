<script lang="ts">
	/**
	 * The drawing pad: a square of paper the reader draws on with a mouse, a pen or a finger
	 * (`startDrag` captures the pointer, and `touch-action: none` keeps a finger from scrolling
	 * the page). The line being drawn stays local until the pen lifts, then goes to `onstroke`.
	 * Optionally shows the machine's 10 × 10 grid over the drawing, with its inked squares.
	 */
	import { onDestroy } from 'svelte';
	import { startDrag } from '#lib/draw/index.ts';
	import { GRID, type Doodle, type Point } from '../model';
	import { doodlePath, gridPath } from './draw';

	interface Props {
		x: number;
		y: number;
		size: number;
		doodle: Doodle;
		interactive?: boolean;
		/** Opacity of the grid over the pad (0: none). */
		grid?: number;
		/** The inked squares to tint under the drawing, or null for none. */
		cells?: readonly boolean[] | null;
		hint?: string;
		onstroke?: (stroke: Point[]) => void;
	}
	let {
		x,
		y,
		size,
		doodle,
		interactive = false,
		grid = 0,
		cells = null,
		hint = 'Draw here',
		onstroke
	}: Props = $props();

	let live: Point[] = $state([]);
	let stop: (() => void) | null = null;
	const clamp = (v: number) => Math.min(100, Math.max(0, v));

	function down(event: PointerEvent) {
		if (!interactive) return;
		live = [];
		stop = startDrag(
			event,
			(p) => {
				const q: Point = [clamp(((p.x - x) / size) * 100), clamp(((p.y - y) / size) * 100)];
				const last = live.at(-1);
				// Keep a point only once the pen has moved a little: short strokes, small parameters.
				if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) >= 1.5) live.push(q);
			},
			() => {
				const stroke = live.map(([px, py]) => [Math.round(px), Math.round(py)] as const);
				live = [];
				stop = null;
				if (stroke.length) onstroke?.(stroke);
			}
		);
	}
	// A step change can remove the pad in the middle of a line: finish it as a release would.
	onDestroy(() => stop?.());

	const cell = $derived(size / GRID);
	const empty = $derived(doodle.length === 0 && live.length === 0);
</script>

<g>
	<rect
		{x}
		{y}
		width={size}
		height={size}
		rx="6"
		fill="var(--tam-pad)"
		stroke="var(--tam-pad-edge)"
		stroke-width="1.5"
	/>
	{#if cells && grid > 0}
		<g opacity={grid}>
			{#each cells as on, i (i)}
				{#if on}
					<rect
						x={x + (i % GRID) * cell}
						y={y + Math.floor(i / GRID) * cell}
						width={cell}
						height={cell}
						fill="var(--tam-square)"
						opacity="0.3"
					/>
				{/if}
			{/each}
		</g>
	{/if}
	{#if grid > 0}
		<path
			d={gridPath(x, y, size, GRID)}
			stroke="var(--tam-grid)"
			stroke-width="1"
			fill="none"
			opacity={grid}
		/>
	{/if}
	<path
		d={doodlePath(doodle, x, y, size)}
		fill="none"
		stroke="var(--tam-ink)"
		stroke-width="3.5"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	{#if live.length}
		<path
			d={doodlePath([live], x, y, size)}
			fill="none"
			stroke="var(--tam-ink)"
			stroke-width="3.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
	{#if empty && interactive}
		<text
			x={x + size / 2}
			y={y + size / 2 + 6}
			text-anchor="middle"
			font-size="18"
			fill="var(--stage-ink-muted)">{hint}</text
		>
	{/if}
	{#if interactive}
		<!-- The surface the pen draws on (keyboard readers pick a ready drawing instead). -->
		<rect
			{x}
			{y}
			width={size}
			height={size}
			fill="transparent"
			role="presentation"
			data-pad
			style:cursor="crosshair"
			style:touch-action="none"
			onpointerdown={down}
		/>
	{/if}
</g>
