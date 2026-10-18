<script lang="ts">
	/**
	 * The draggable marker of the air's CO₂ on a chart whose x axis is ppm: drag it sideways (or use
	 * the arrow keys) and the CO₂ slider follows. It sits on the chart's curve at height `y`.
	 */
	import { Handle, clamp, type Point, type Scale } from '#lib/draw/index.ts';
	import type { ParamValue } from '#lib/explainer/index.ts';
	import { PPM_MAX, PPM_MIN } from './shared';

	interface Props {
		sx: Scale;
		y: number;
		ppm: number;
		setParam: (id: string, value: ParamValue) => void;
		color?: string;
	}
	let { sx, y, ppm, setParam, color }: Props = $props();

	const set = (v: number) => setParam('co2', Math.round(clamp(v, PPM_MIN, PPM_MAX)));
</script>

<Handle
	x={sx(ppm)}
	{y}
	{color}
	label="CO₂ in the air"
	value={Math.round(ppm)}
	min={PPM_MIN}
	max={PPM_MAX}
	valuetext="{Math.round(ppm)} ppm"
	onmove={(p: Point) => set(sx.invert(p.x))}
	onkey={(k) => set(k === 'start' ? PPM_MIN : k === 'end' ? PPM_MAX : ppm + 5 * k)}
/>
