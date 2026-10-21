<script lang="ts">
	/**
	 * A glass thermometer with a red column, marked every 5 °C from `min` to `max`, with a bold line
	 * at 0 °C. `x` is the tube's centre, `y` its top; the bulb hangs below `y + height`.
	 */
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		x: number;
		y: number;
		height: number;
		temp: number;
		min?: number;
		max?: number;
		/** Show the tick numbers (left of the tube). */
		numbers?: boolean;
		opacity?: number;
	}
	let { x, y, height, temp, min = -25, max = 10, numbers = true, opacity = 1 }: Props = $props();

	const yOf = (v: number) => y + height - ((v - min) / (max - min)) * height;
	const marks = $derived.by(() => {
		const out: number[] = [];
		for (let v = Math.ceil(min / 5) * 5; v <= max; v += 5) out.push(v);
		return out;
	});
	const top = $derived(yOf(Math.max(min, Math.min(max, temp))));
</script>

<g {opacity}>
	<rect
		x={x - 11}
		y={y - 14}
		width="22"
		height={height + 30}
		rx="11"
		fill="var(--sa-glass)"
		stroke="var(--sa-glass-edge)"
		stroke-width="2"
	/>
	<circle
		cx={x}
		cy={y + height + 26}
		r="20"
		fill="var(--sa-red)"
		stroke="var(--sa-glass-edge)"
		stroke-width="2"
	/>
	<rect x={x - 5} y={top} width="10" height={y + height + 14 - top} fill="var(--sa-red)" />
	{#each marks as v (v)}
		<line
			x1={x + 11}
			y1={yOf(v)}
			x2={x + (v === 0 ? 26 : 19)}
			y2={yOf(v)}
			stroke="var(--stage-ink)"
			stroke-width={v === 0 ? 3 : 1.5}
		/>
		{#if numbers}
			<Label
				x={x + 30}
				y={yOf(v) + 4}
				text={v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}
				anchor="start"
				size={14}
				weight={v === 0 ? 700 : 500}
				muted={v !== 0}
				tabular
			/>
		{/if}
	{/each}
</g>
