<script lang="ts">
	/**
	 * The knots of the editable curve: hollow round handles at fixed x that
	 * the reader drags up and down (or moves with the arrow keys: 0.25 a
	 * press, 2.5 with Shift). The first move turns the current curve into
	 * "your own": the knots are written to `params.knots`, seeded from where
	 * they sat on the preset, and `params.curve` becomes 'custom'.
	 */
	import { Handle, type Point, type Scale } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { KNOT_MAX, KNOT_MIN, KNOT_X, knotsOf, type Curve } from '../calculus';
	import { num, sx } from './plot';

	interface Props {
		curve: Curve;
		sy: Scale;
		opacity?: number;
		setParam: StageProps['setParam'];
	}
	let { curve, sy, opacity = 1, setParam }: Props = $props();

	const knots = $derived(knotsOf(curve));
	const clampY = (v: number) => Math.round(Math.min(KNOT_MAX, Math.max(KNOT_MIN, v)) * 100) / 100;

	function setKnot(i: number, y: number) {
		const next = [...knots];
		next[i] = clampY(y);
		setParam('knots', next.join(','));
		if (curve.id !== 'custom') setParam('curve', 'custom');
	}
	const onmove = (i: number) => (p: Point) => setKnot(i, sy.invert(p.y));
	const onkey = (i: number) => (k: number | 'start' | 'end') =>
		setKnot(i, k === 'start' ? KNOT_MIN : k === 'end' ? KNOT_MAX : knots[i] + k * 0.25);
</script>

<g {opacity}>
	{#each KNOT_X as kx, i (kx)}
		<Handle
			x={sx(kx)}
			y={sy(knots[i])}
			r={6}
			color="var(--calc-curve)"
			label="Knot {i + 1} of the curve, at x = {num(kx, 1)}"
			value={knots[i]}
			min={KNOT_MIN}
			max={KNOT_MAX}
			valuetext="height {num(knots[i])}"
			onmove={onmove(i)}
			onkey={onkey(i)}
		/>
		<circle cx={sx(kx)} cy={sy(knots[i])} r="3" fill="var(--stage-bg)" pointer-events="none" />
	{/each}
</g>
