<script lang="ts">
	/**
	 * A straight arrow from `from` to `to` (stage units) with a filled head, in
	 * one colour. The head keeps its size whatever the line width; arrows too
	 * short for a head are drawn as a line only.
	 */
	import type { Point } from '#lib/draw/index.ts';

	interface Props {
		from: Point;
		to: Point;
		color: string;
		width?: number;
		opacity?: number;
		dashed?: boolean;
		/** Length of the head, in stage units. */
		head?: number;
	}
	let { from, to, color, width = 3, opacity = 1, dashed = false, head = 14 }: Props = $props();

	const geo = $derived.by(() => {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const len = Math.hypot(dx, dy);
		if (len < 1e-6) return null;
		const ux = dx / len;
		const uy = dy / len;
		const h = Math.min(head, len * 0.6);
		const w = h * 0.45;
		const bx = to.x - ux * h;
		const by = to.y - uy * h;
		return {
			end: { x: to.x - ux * h * 0.8, y: to.y - uy * h * 0.8 },
			headPath: `M${to.x} ${to.y} L${bx - uy * w} ${by + ux * w} L${bx + uy * w} ${by - ux * w} Z`
		};
	});
</script>

{#if geo}
	<g {opacity} style:pointer-events="none">
		<line
			x1={from.x}
			y1={from.y}
			x2={geo.end.x}
			y2={geo.end.y}
			stroke={color}
			stroke-width={width}
			stroke-linecap="round"
			stroke-dasharray={dashed ? '6 5' : undefined}
		/>
		<path d={geo.headPath} fill={color} />
	</g>
{/if}
