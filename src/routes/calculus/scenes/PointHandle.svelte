<script lang="ts">
	/**
	 * The point the reader slides along the curve: a `<Handle>` that only moves
	 * sideways and writes its x into `params.x`. Arrow keys move it by 0.05
	 * (Shift: 0.5); Home and End go to the ends. A ring pulses round it for the
	 * first seconds of a step, inviting a drag.
	 */
	import { Handle, smoothstep, type Point } from '#lib/draw/index.ts';
	import type { StageProps } from '#lib/explainer/index.ts';
	import { X0, X1 } from '../calculus';
	import { num, sx, toX } from './plot';

	interface Props {
		/** The point's x (data units) and its height on screen. */
		x: number;
		y: number;
		label: string;
		/** Unit of x in the accessible value ("" or "seconds"). */
		unit?: string;
		t: number;
		reduced: boolean;
		setParam: StageProps['setParam'];
	}
	let { x, y, label, unit = '', t, reduced, setParam }: Props = $props();

	const pulse = $derived(reduced ? 0 : (1 - smoothstep(2.5, 4, t)) * (0.5 + 0.5 * Math.sin(t * 5)));
	const onmove = (p: Point) => setParam('x', toX(sx.invert(p.x)));
	function onkey(k: number | 'start' | 'end') {
		if (k === 'start') return setParam('x', X0);
		if (k === 'end') return setParam('x', X1);
		setParam('x', toX(x + k * 0.05));
	}
</script>

{#if pulse > 0.01}
	<circle
		cx={sx(x)}
		cy={y}
		r={16 + 10 * pulse}
		fill="none"
		stroke="var(--explainer-accent)"
		stroke-width="2"
		opacity={0.5 * pulse}
	/>
{/if}
<Handle
	x={sx(x)}
	{y}
	{label}
	value={x}
	min={X0}
	max={X1}
	valuetext="{unit === '' ? 'x' : 't'} = {num(x)}{unit === '' ? '' : ` ${unit}`}"
	{onmove}
	{onkey}
/>
