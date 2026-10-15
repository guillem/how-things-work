<script lang="ts">
	/**
	 * The census (step census): every planet in the NASA Exoplanet Archive by
	 * discovery year, stacked by method, with the totals. The bars grow in year
	 * by year over SWEEP s (pure function of t), then stay; reduced motion shows
	 * the finished chart.
	 */
	import { Axes, Label, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BY_YEAR, FETCHED, TOTAL } from '../archive';
	import Card from './Card.svelte';

	let { t, reduced }: StageProps = $props();

	const SWEEP = 7;
	const X0 = 84;
	const X1 = 640;
	const Y0 = 70;
	const Y1 = 520;
	const CX = 662;
	const CW = 282;

	const METHODS = [
		{ id: 'transit', label: 'Transit (a dip)', color: 'var(--ex-transit)', col: 1 },
		{ id: 'rv', label: 'Wobble (radial velocity)', color: 'var(--ex-rv-method)', col: 2 },
		{ id: 'lens', label: 'Microlensing', color: 'var(--ex-lens)', col: 3 },
		{ id: 'imaging', label: 'Photographed (imaging)', color: 'var(--ex-imaging)', col: 4 },
		{ id: 'other', label: 'Other (timing, astrometry…)', color: 'var(--ex-other)', col: 5 }
	] as const;
	const totals = METHODS.map((m) => BY_YEAR.reduce((s, r) => s + r[m.col], 0));
	const first = BY_YEAR[0][0];
	const last = BY_YEAR[BY_YEAR.length - 1][0];
	const yearTotal = (year: number) => {
		const r = BY_YEAR.find((q) => q[0] === year);
		return r ? r[1] + r[2] + r[3] + r[4] + r[5] : 0;
	};
	const sx = scale([first - 0.5, last + 0.5], [X0, X1]);
	const sy = scale([0, 1600], [Y1, Y0]);
	const bw = ((X1 - X0) / (last - first + 1)) * 0.78;

	const tt = $derived(reduced ? SWEEP + 1 : t);
	/** How far the sweep has got, in years (fractional). */
	const upTo = $derived(first - 1 + smoothstep(0, SWEEP, tt) * (last - first + 1.5));
	const grow = (year: number) => Math.min(1, Math.max(0, (upTo - year + 1) * 1.5));
	const bars = $derived(
		BY_YEAR.map((r) => {
			const g = grow(r[0]);
			let y = Y1;
			const segs = METHODS.map((m) => {
				const h = (Y1 - sy(r[m.col])) * g;
				y -= h;
				return { id: m.id, y, h, color: m.color };
			});
			return { year: r[0], x: sx(r[0]) - bw / 2, segs };
		})
	);
	const shown = $derived(
		Math.round(BY_YEAR.reduce((s, r) => s + grow(r[0]) * (r[1] + r[2] + r[3] + r[4] + r[5]), 0))
	);
	const pct = (n: number) => `${((100 * n) / TOTAL).toFixed(n / TOTAL < 0.1 ? 1 : 0)}%`;
	const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<g>
	<rect
		x={16}
		y={16}
		width={632}
		height={568}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="title">
		<Label
			anchor="start"
			x={32}
			y={42}
			text="Planets found each year, and how"
			size={14}
			weight={700}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={[1995, 2000, 2005, 2010, 2015, 2020, 2025]}
		yTicks={[0, 400, 800, 1200, 1600]}
		xFormat={(v: number) => String(v)}
	/>
	{#each bars as b (b.year)}
		{#each b.segs as s (s.id)}
			{#if s.h > 0.2}
				<rect x={b.x} y={s.y} width={bw} height={s.h} fill={s.color} />
			{/if}
		{/each}
	{/each}
	<Label
		x={sx(2014)}
		y={sy(yearTotal(2014)) - 8}
		text="Kepler"
		size={11.5}
		anchor="middle"
		weight={600}
		opacity={grow(2014)}
	/>
	<Label
		x={sx(2016)}
		y={sy(yearTotal(2016)) - 8}
		text="Kepler"
		size={11.5}
		anchor="middle"
		weight={600}
		opacity={grow(2016)}
	/>
	<Label
		x={sx(1995)}
		y={sy(120)}
		text="51 Peg b"
		size={11}
		anchor="start"
		muted
		opacity={grow(1995)}
	/>
	<line
		x1={sx(1995)}
		x2={sx(1995)}
		y1={sy(110)}
		y2={sy(8)}
		stroke="var(--stage-ink-muted)"
		opacity={grow(1995)}
	/>
	<Label
		x={X1}
		y={Y1 + 36}
		text="{last}: so far (fetched {FETCHED})"
		size={10.5}
		anchor="end"
		muted
	/>

	<!-- ---- totals ---- -->
	<Card x={CX} y={16} w={CW} h={568} />
	<Readout id="total" order={0} label="Known exoplanets" value={fmt(shown)}>
		<Label anchor="start" x={CX + 16} y={46} text="Known exoplanets" size={13} muted />
		<Label x={CX + CW - 16} y={46} text={fmt(shown)} size={18} weight={750} anchor="end" />
	</Readout>
	{#each METHODS as m, i (m.id)}
		<Readout
			id="m-{m.id}"
			order={i + 1}
			label={m.label}
			value="{fmt(totals[i])} ({pct(totals[i])})"
			color={m.color}
		>
			<rect x={CX + 16} y={78 + i * 50} width="14" height="14" rx="3" fill={m.color} />
			<Label anchor="start" x={CX + 38} y={90 + i * 50} text={m.label} size={12.5} />
			<Label
				anchor="start"
				x={CX + 38}
				y={108 + i * 50}
				text="{fmt(totals[i])} planets · {pct(totals[i])}"
				size={12}
				weight={650}
				muted
			/>
		</Readout>
	{/each}
	<line x1={CX + 16} x2={CX + CW - 16} y1={336} y2={336} stroke="var(--border)" />
	<Readout
		id="m-seen"
		order={9}
		label="Photographed"
		value="fewer than 2 in 100: the rest were found from their star’s light"
	>
		<Label
			anchor="start"
			x={CX + 16}
			y={364}
			text="Seen: fewer than 2 in 100."
			size={14}
			weight={700}
			color="var(--ex-imaging)"
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={392}
			text="Almost all the others were found from"
			size={12.5}
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={412}
			text="what they do to their star’s light:"
			size={12.5}
		/>
		<Label anchor="start" x={CX + 16} y={432} text="a dip in its brightness, or a" size={12.5} />
		<Label anchor="start" x={CX + 16} y={452} text="wobble in its spectral lines" size={12.5} />
		<Label
			anchor="start"
			x={CX + 16}
			y={472}
			text="(or a brief brightening of a star"
			size={12.5}
			muted
		/>
		<Label
			anchor="start"
			x={CX + 16}
			y={492}
			text="behind them, for microlensing)."
			size={12.5}
			muted
		/>
	</Readout>
	<Readout id="m-src">
		<Label
			anchor="start"
			x={CX + 16}
			y={556}
			text="Source: NASA Exoplanet Archive"
			size={11}
			muted
		/>
	</Readout>
</g>
