<script lang="ts">
	/**
	 * One meter of the Shakespeare steps: a title, the value for the current window as a number
	 * and a bar, and a small line of the same measure for every window from 1 to 10 with the
	 * current one marked.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import { Label } from '#lib/draw/index.ts';

	interface Props {
		id: string;
		x: number;
		y: number;
		w: number;
		title: string;
		note: string;
		value: string;
		/** Bar fill, 0–1. */
		fill: number;
		/** The measure for n = 1 … 10, already scaled to 0–1. */
		series: readonly number[];
		n: number;
		color: string;
	}
	let { id, x, y, w, title, note, value, fill, series, n, color }: Props = $props();

	const H = 172;
	const SP = $derived({ x: x + 16, y: y + 108, w: w - 32, h: 40 });
	const px = (i: number) => SP.x + (i / 9) * SP.w;
	const py = (v: number) => SP.y + SP.h - Math.max(0, Math.min(1, v)) * SP.h;
	const line = $derived(series.map((v, i) => `${i ? 'L' : 'M'}${px(i)} ${py(v)}`).join(' '));
</script>

<g>
	<rect {x} {y} width={w} height={H} rx="12" fill="var(--surface)" stroke="var(--border)" />
	<Readout id="{id}-text">
		<Label anchor="start" x={x + 16} y={y + 24} size={13} weight={650} text={title} halo={false} />
		<Label
			anchor="end"
			tabular
			x={x + w - 16}
			y={y + 26}
			size={18}
			weight={700}
			{color}
			text={value}
			halo={false}
		/>
		<Label anchor="start" x={x + 16} y={y + 44} size={11} muted text={note} halo={false} />
	</Readout>
	<rect x={x + 16} y={y + 56} width={w - 32} height="10" rx="5" fill="var(--stage-grid)" />
	<rect
		x={x + 16}
		y={y + 56}
		width={Math.max(0, Math.min(1, fill)) * (w - 32)}
		height="10"
		rx="5"
		fill={color}
	/>
	<Readout id="{id}-caption">
		<Label
			anchor="start"
			x={x + 16}
			y={y + 92}
			size={11}
			muted
			text="for windows of 1 to 10 letters:"
			halo={false}
		/>
	</Readout>
	<line
		x1={SP.x}
		y1={SP.y + SP.h}
		x2={SP.x + SP.w}
		y2={SP.y + SP.h}
		stroke="var(--stage-line)"
		stroke-width="1"
	/>
	<path d={line} fill="none" stroke={color} stroke-width="2" stroke-linejoin="round" />
	{#each series as v, i (i)}
		<circle
			cx={px(i)}
			cy={py(v)}
			r={i + 1 === n ? 5 : 2.2}
			fill={i + 1 === n ? color : 'var(--surface)'}
			stroke={color}
			stroke-width="1.5"
		/>
	{/each}
	<Readout id="{id}-ticks">
		<text
			x={SP.x}
			y={SP.y + SP.h + 14}
			font-size="10"
			text-anchor="middle"
			style:fill="var(--stage-ink-muted)">1</text
		>
		<text
			x={SP.x + SP.w}
			y={SP.y + SP.h + 14}
			font-size="10"
			text-anchor="middle"
			style:fill="var(--stage-ink-muted)">10</text
		>
	</Readout>
</g>
