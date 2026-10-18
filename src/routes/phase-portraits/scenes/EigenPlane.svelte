<script lang="ts">
	/**
	 * The complex plane of the eigenvalues: the left half (Re λ < 0, decaying)
	 * tinted, the imaginary axis (Re λ = 0, the borderline) drawn bold, and the
	 * two eigenvalues as dots. The scene puts handles over the dots when they
	 * can be dragged (same scales: `eigenScales`).
	 */
	import { Axes, Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import type { Eigen } from '../phase';
	import { fixed, scales, type Rect } from './layout';

	interface Props {
		rect: Rect;
		re: [number, number];
		im: [number, number];
		eigen: Eigen;
		color: string;
		/** Draw the dots (off when the scene draws handles there). */
		dots?: boolean;
	}
	let { rect, re, im, eigen, color, dots = true }: Props = $props();

	const sc = $derived(scales(rect, { x: re, y: im }));
	/** The whole numbers in a range, for ticks. */
	const ints = ([a, b]: [number, number]) =>
		Array.from({ length: Math.floor(b) - Math.ceil(a) + 1 }, (_, i) => Math.ceil(a) + i);
	const pts = $derived(
		[0, 1].map((k) => ({
			k,
			x: sc.sx(Math.min(Math.max(eigen.re[k], re[0]), re[1])),
			y: sc.sy(Math.min(Math.max(eigen.im[k], im[0]), im[1]))
		}))
	);
</script>

<g>
	<rect
		x={rect.left}
		y={rect.top}
		width={sc.sx(0) - rect.left}
		height={rect.bottom - rect.top}
		fill="var(--pp-stable)"
		opacity="0.1"
	/>
	<Axes
		sx={sc.sx}
		sy={sc.sy}
		xLabel="Re λ"
		yLabel="Im λ"
		xTicks={ints(re)}
		yTicks={ints(im)}
		xFormat={(v: number) => fixed(v, 0)}
		yFormat={(v: number) => fixed(v, 0)}
		grid={false}
	/>
	<line
		x1={rect.left}
		x2={rect.right}
		y1={sc.sy(0)}
		y2={sc.sy(0)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1"
	/>
	<line
		x1={sc.sx(0)}
		x2={sc.sx(0)}
		y1={rect.top}
		y2={rect.bottom}
		stroke="var(--pp-centre)"
		stroke-width="2.2"
	/>
	<Readout id="eig-halves">
		<Label
			x={rect.left + 8}
			y={rect.top + 14}
			text="decay"
			size={11}
			anchor="start"
			color="var(--pp-stable)"
		/>
		<Label
			x={rect.right - 8}
			y={rect.top + 14}
			text="growth"
			size={11}
			anchor="end"
			color="var(--pp-unstable)"
		/>
	</Readout>
	{#if dots}
		{#each pts as p (p.k)}
			<circle cx={p.x} cy={p.y} r="6.5" fill={color} stroke="var(--stage-bg)" stroke-width="1.5" />
		{/each}
	{/if}
</g>
