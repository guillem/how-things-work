<script lang="ts">
	/**
	 * Frame of a plot inside a scene: a light grid, an x axis along the bottom
	 * and a y axis on the left (or right), with tick labels and axis titles.
	 * Map data into the same box with the scales from `chart.ts`:
	 *
	 *   const sx = scale([0, 100], [x, x + width]);
	 *   const sy = scale([0, 1], [y + height, y]);
	 *   <Axes {sx} {sy} xLabel="days" yLabel="people" />
	 *   <path d={linePath(data, (d) => d.day, (d) => d.i, sx, sy)} … />
	 *
	 * On phones (viewport ≤ 640 px, the breakpoint of the phone readouts) the
	 * 960-unit stage is drawn at ~0.37 scale, where 11-unit text is ~4 px tall.
	 * There the labels are drawn at a real ~10 px whatever the scale, every
	 * k-th tick label is kept so that none collide (tick marks and grid lines
	 * all stay), and the x title moves into the tick row at its right end, so
	 * the chart takes no more room below its axis than on a wide screen (or a
	 * row lower, when it would hide more than one tick label and fits on the
	 * stage). Wide screens draw exactly what they always did.
	 */
	import type { Scale } from './chart';
	import { spacedLabels, ticks as niceTicks } from './chart';
	import { useReadouts } from '../explainer/readouts.svelte';

	interface Props {
		sx: Scale;
		sy: Scale;
		xLabel?: string;
		yLabel?: string;
		/** Tick values; by default about 5 round values over each domain. */
		xTicks?: number[];
		yTicks?: number[];
		xFormat?: (v: number) => string;
		yFormat?: (v: number) => string;
		/** Draw the y axis on the right-hand side. */
		yRight?: boolean;
		grid?: boolean;
		opacity?: number;
	}
	let {
		sx,
		sy,
		xLabel,
		yLabel,
		xTicks,
		yTicks,
		xFormat = (v) => v.toLocaleString('en-US'),
		yFormat = (v) => v.toLocaleString('en-US'),
		yRight = false,
		grid = true,
		opacity = 1
	}: Props = $props();

	const left = $derived(Math.min(...sx.range));
	const right = $derived(Math.max(...sx.range));
	const top = $derived(Math.min(...sy.range));
	const bottom = $derived(Math.max(...sy.range));
	const xs = $derived(xTicks ?? niceTicks(sx.domain[0], sx.domain[1], 5));
	const ys = $derived(yTicks ?? niceTicks(sy.domain[0], sy.domain[1], 4));
	const axisX = $derived(yRight ? right : left);

	// ---- Phones -------------------------------------------------------------
	const readouts = useReadouts();
	const narrow = $derived(readouts?.out ?? false);

	/** Real size of the labels on phones, in CSS px. */
	const TICK_PX = 10;
	const TITLE_PX = 9.5;
	/** Rough advance of a character of the stage font, in em (digits ~0.55). */
	const EM = 0.58;

	let frame = $state<SVGGElement>();
	/** CSS px per drawing unit, measured on phones; ~0.37 on a 390 px screen. */
	let unit = $state(0.37);
	/** The stage's edges in this chart's drawing units (left, right, bottom). */
	let edge = $state({ x0: -Infinity, x1: Infinity, y1: Infinity });
	$effect(() => {
		const g = frame;
		const svg = g?.ownerSVGElement;
		if (!narrow || !g || !svg) return;
		const measure = () => {
			const m = g.getScreenCTM();
			const k = m ? Math.hypot(m.a, m.b) : 0;
			if (!m || !(k > 0)) return;
			unit = k;
			const r = svg.getBoundingClientRect();
			const inv = m.inverse();
			const a = new DOMPoint(r.left, r.top).matrixTransform(inv);
			const b = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
			edge = { x0: a.x, x1: b.x, y1: b.y };
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(svg);
		return () => ro.disconnect();
	});

	/** Font sizes in drawing units: a fixed real size, never below the wide-screen 11. */
	const fs = $derived(Math.max(11, TICK_PX / unit));
	const fsTitle = $derived(Math.max(11, TITLE_PX / unit));
	const width = (s: string, size: number) => s.length * EM * size;

	const xText = $derived(xs.map((v) => xFormat(v)));
	const yText = $derived(ys.map((v) => yFormat(v)));
	/** Baseline of the tick row on phones. */
	const rowY = $derived(bottom + 4 + 0.95 * fs);
	/** Indices of the x tick labels drawn on phones, before the title takes its place. */
	const xKeep = $derived.by(() => {
		if (!narrow) return [...xs.keys()];
		return spacedLabels(
			xs.map((v) => sx(v)),
			xText.map((s) => width(s, fs)),
			0.8 * fs,
			Math.max(0, xs.indexOf(0))
		);
	});
	/** x of each tick label on phones: an end label is kept inside the stage. */
	const xAt = $derived(
		xs.map((v, i) => {
			const half = width(xText[i], fs) / 2;
			return Math.max(edge.x0 + half, Math.min(edge.x1 - half, sx(v)));
		})
	);
	/** Labels the x title would cover if it sat at the right end of the tick row. */
	const xCovered = $derived.by(() => {
		if (!narrow || !xLabel) return [];
		const titleLeft = right - width(xLabel, fsTitle) - 0.8 * fs;
		return xKeep.filter((i) => sx(xs[i]) + width(xText[i], fs) / 2 >= titleLeft);
	});
	/**
	 * Where the x title goes on phones: in the tick row, in place of the labels
	 * it covers, so the chart takes no more room below its axis than on a wide
	 * screen; a row lower when that would hide more than one label and the
	 * stage has room for it.
	 */
	const xTitleBelow = $derived(
		xCovered.length > 1 && edge.y1 - bottom >= 4 + 0.95 * fs + 1.65 * fsTitle
	);
	const xShown = $derived(
		new Set(xTitleBelow ? xKeep : xKeep.filter((i) => !xCovered.includes(i)))
	);
	/**
	 * Baselines of the y tick labels on phones. A label at the foot of the axis
	 * stays above the x axis line, so that it doesn't run into the first x label
	 * beside it (a "−80" next to a "0" would read as "−800").
	 */
	const yBase = $derived(ys.map((v) => Math.min(sy(v) + 0.35 * fs, bottom - 0.3 * fs)));
	const yShown = $derived.by(() => {
		if (!narrow) return new Set(ys.keys());
		return new Set(
			spacedLabels(
				yBase.map((b) => b - 0.35 * fs),
				ys.map(() => fs),
				0.35 * fs,
				Math.max(0, ys.indexOf(0))
			)
		);
	});
</script>

<g {opacity} style:pointer-events="none" bind:this={frame}>
	{#if grid}
		{#each ys as v (v)}
			<line x1={left} x2={right} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
		{/each}
	{/if}
	<line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--stage-line)" />
	<line x1={axisX} x2={axisX} y1={top} y2={bottom} stroke="var(--stage-line)" />
	{#each xs as v, i (v)}
		<line x1={sx(v)} x2={sx(v)} y1={bottom} y2={bottom + 4} stroke="var(--stage-line)" />
		{#if !narrow}
			<text x={sx(v)} y={bottom + 17} text-anchor="middle" font-size="11" class="muted tick">
				{xText[i]}
			</text>
		{:else if xShown.has(i)}
			<text x={xAt[i]} y={rowY} text-anchor="middle" font-size={fs} class="muted tick"
				>{xText[i]}</text
			>
		{/if}
	{/each}
	{#each ys as v, i (v)}
		{#if !narrow}
			<text
				x={yRight ? axisX + 7 : axisX - 7}
				y={sy(v) + 4}
				text-anchor={yRight ? 'start' : 'end'}
				font-size="11"
				class="muted tick"
			>
				{yText[i]}
			</text>
		{:else if yShown.has(i)}
			<text
				x={yRight ? axisX + 0.45 * fs : axisX - 0.45 * fs}
				y={yBase[i]}
				text-anchor={yRight ? 'start' : 'end'}
				font-size={fs}
				class="muted tick">{yText[i]}</text
			>
		{/if}
	{/each}
	{#if xLabel}
		<text
			x={right}
			y={narrow ? rowY + (xTitleBelow ? 1.4 * fsTitle : 0) : bottom + 34}
			text-anchor="end"
			font-size={narrow ? fsTitle : 11}
			class="muted axis-title">{xLabel}</text
		>
	{/if}
	{#if yLabel}
		<text
			x={yRight ? right : left}
			y={narrow ? top - 0.35 * fsTitle : top - 10}
			text-anchor={yRight ? 'end' : 'start'}
			font-size={narrow ? fsTitle : 11}
			class="muted axis-title">{yLabel}</text
		>
	{/if}
</g>
