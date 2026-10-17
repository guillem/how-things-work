<script lang="ts">
	/**
	 * The loss after every step so far, one curve per run. The step axis grows
	 * with the run; a loss above the top of the plot (a diverging run) leaves
	 * through the top, with a note.
	 *
	 * On phones (≤ 640 px, the readouts' breakpoint) the stage is drawn at ~0.37 scale and the
	 * wide-screen labels would be ~4 px tall, so they are left out there (the `<Readout>`) and
	 * drawn instead at a real ~10 px, the way <Axes> draws its own: every k-th tick label is
	 * kept so that none collide, and "step →" takes the place of the last ones in the tick row.
	 */
	import { Readout } from '#lib/explainer/index.ts';
	import { useReadouts } from '#lib/explainer/readouts.svelte.ts';
	import { Label, niceMax, scale, spacedLabels, ticks } from '#lib/draw/index.ts';
	import { LOSS, fmt } from './shared';

	interface Series {
		key: string;
		color: string;
		losses: number[];
	}
	interface Props {
		series: Series[];
		/** The loss the plot's top is set from (the start). */
		top: number;
		/** The lowest possible loss, drawn as a dashed line when above 0. */
		floor: number;
		/** Steps taken so far (may be fractional): sets the length of the step axis. */
		shown: number;
	}
	let { series, top, floor, shown }: Props = $props();

	const yMax = $derived(niceMax(top * 1.08));
	const xMax = $derived(Math.max(20, shown * 1.12));
	const sx = $derived(scale([0, xMax], [LOSS.x, LOSS.x + LOSS.w]));
	const sy = $derived(scale([0, yMax], [LOSS.y + LOSS.h, LOSS.y]));
	const xTicks = $derived(ticks(0, xMax, 4).filter((v) => v <= xMax));
	const yTicks = $derived(ticks(0, yMax, 2));

	const curves = $derived(
		series.map((s) => {
			let d = '';
			let over = false;
			s.losses.forEach((l, i) => {
				const y = l > yMax * 1.5 ? yMax * 1.5 : l;
				if (l > yMax) over = true;
				d += `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(y).toFixed(1)}`;
			});
			return { key: s.key, color: s.color, d, over };
		})
	);
	const anyOver = $derived(curves.some((c) => c.over));

	// ---- phones ----------------------------------------------------------------------
	const readouts = useReadouts();
	const narrow = $derived(readouts?.out ?? false);
	let frame = $state<SVGGElement>();
	/** CSS px per drawing unit, measured on phones. */
	let unit = $state(0.37);
	$effect(() => {
		const g = frame;
		const svg = g?.ownerSVGElement;
		if (!narrow || !g || !svg) return;
		const measure = () => {
			const m = g.getScreenCTM();
			const k = m ? Math.hypot(m.a, m.b) : 0;
			if (k > 0) unit = k;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(svg);
		return () => ro.disconnect();
	});
	const fs = $derived(Math.max(11, 10 / unit));
	const fsTitle = $derived(Math.max(12, 9.5 / unit));
	const width = (s: string, size: number) => s.length * 0.58 * size;
	const bottom = LOSS.y + LOSS.h;
	const right = LOSS.x + LOSS.w;
	const rowY = $derived(bottom + 4 + 0.95 * fs);
	const STEP_TITLE = 'step →';
	/** x tick labels drawn on phones: spaced, and clear of the title at the end of the row. */
	const xPhone = $derived.by(() => {
		if (!narrow) return [];
		const keep = spacedLabels(
			xTicks.map((v) => sx(v)),
			xTicks.map((v) => width(String(v), fs)),
			0.8 * fs
		);
		const titleLeft = right - width(STEP_TITLE, fsTitle) - 0.8 * fs;
		return keep.map((i) => xTicks[i]).filter((v) => sx(v) + width(String(v), fs) / 2 < titleLeft);
	});
	/** y tick labels on phones; one at the foot stays above the x axis line. */
	const yPhone = $derived.by(() => {
		if (!narrow) return [];
		const base = yTicks.map((v) => Math.min(sy(v) + 0.35 * fs, bottom - 0.3 * fs));
		const keep = spacedLabels(
			base.map((b) => b - 0.35 * fs),
			yTicks.map(() => fs),
			0.35 * fs
		);
		return keep.map((i) => ({ v: yTicks[i], y: base[i] }));
	});
</script>

<g style:pointer-events="none" bind:this={frame}>
	<defs>
		<clipPath id="gd-loss-clip">
			<rect x={LOSS.x} y={LOSS.y} width={LOSS.w + 4} height={LOSS.h + 2} />
		</clipPath>
	</defs>
	<line
		x1={LOSS.x}
		x2={LOSS.x + LOSS.w}
		y1={LOSS.y + LOSS.h}
		y2={LOSS.y + LOSS.h}
		stroke="var(--stage-line)"
	/>
	<line x1={LOSS.x} x2={LOSS.x} y1={LOSS.y} y2={LOSS.y + LOSS.h} stroke="var(--stage-line)" />
	{#each yTicks as v (v)}
		<line x1={LOSS.x} x2={LOSS.x + LOSS.w} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
	{/each}
	{#if floor > 0}
		<line
			x1={LOSS.x}
			x2={LOSS.x + LOSS.w}
			y1={sy(floor)}
			y2={sy(floor)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
	{/if}
	<g clip-path="url(#gd-loss-clip)">
		{#each curves as c (c.key)}
			<path d={c.d} fill="none" stroke={c.color} stroke-width="2.2" stroke-linejoin="round" />
		{/each}
	</g>
	<Readout id="loss-axes">
		{#each yTicks as v (v)}
			<Label x={LOSS.x - 6} y={sy(v) + 4} text={fmt(v)} anchor="end" size={11} muted />
		{/each}
		{#each xTicks as v (v)}
			<Label x={sx(v)} y={LOSS.y + LOSS.h + 15} text={String(v)} anchor="middle" size={11} muted />
		{/each}
		<Label
			x={LOSS.x + LOSS.w}
			y={LOSS.y + LOSS.h + 30}
			text="step →"
			anchor="end"
			size={12}
			muted
		/>
		<Label
			anchor="start"
			x={LOSS.x - 52}
			y={LOSS.y - 10}
			text="loss after each step"
			size={12}
			muted
		/>
		{#if anyOver}
			<Label
				x={LOSS.x + LOSS.w - 4}
				y={LOSS.y + 12}
				text="↑ off the top"
				anchor="end"
				size={12}
				color="var(--gd-run3)"
			/>
		{/if}
	</Readout>
	{#if narrow}
		{#each yPhone as p (p.v)}
			<text x={LOSS.x - 0.45 * fs} y={p.y} text-anchor="end" font-size={fs} class="muted tick"
				>{fmt(p.v)}</text
			>
		{/each}
		{#each xPhone as v (v)}
			<text x={sx(v)} y={rowY} text-anchor="middle" font-size={fs} class="muted tick">{v}</text>
		{/each}
		<text x={right} y={rowY} text-anchor="end" font-size={fsTitle} class="muted axis-title"
			>{STEP_TITLE}</text
		>
		<text
			x={LOSS.x}
			y={LOSS.y - 0.35 * fsTitle}
			text-anchor="start"
			font-size={fsTitle}
			class="muted axis-title">loss after each step</text
		>
		{#if anyOver}
			<Label
				x={right - 4}
				y={LOSS.y + fsTitle}
				text="↑ off the top"
				anchor="end"
				size={fsTitle}
				color="var(--gd-run3)"
			/>
		{/if}
	{/if}
</g>
