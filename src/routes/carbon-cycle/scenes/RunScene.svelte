<script lang="ts">
	/**
	 * Run the clock: from the end of 2024, the chosen emissions for the chosen
	 * number of years, then none, followed for 1,000 years. Above, bars of the
	 * extra carbon in each store compared with 1750 at the cursor's year; below,
	 * the same through time on a split axis (the first 200 years wider).
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Axes,
		Label,
		linePath,
		niceMax,
		scale,
		smoothstep,
		ticks,
		type Scale
	} from '#lib/draw/index.ts';
	import { GTC_PER_PPM, PPM0, pHOf, ppmOf, totals } from '../carbon';
	import { FOSSIL_RESERVES } from '../data';
	import { HORIZON, defaultRun, runOf, setup } from '../scenario';
	import { gtc } from './geometry';

	let { step, t, params, reduced }: StageProps = $props();

	const s = $derived(setup(step, params));
	const run = $derived(runOf(s));
	const ghost = $derived(s.changedSinks ? defaultRun() : null);
	const start = $derived(totals(run[0]));

	// ---- split time axis: 2024–2224 over 60% of the width, 2224–3024 over the rest
	const L = 96;
	const CHART_TOP = 236;
	const SPLIT = 560;
	const R = 880;
	const left = scale([0, 200], [L, SPLIT]);
	const right = scale([200, HORIZON], [SPLIT, R]);
	const xOf = (y: number) => (y <= 200 ? left(y) : right(y));
	const sxAll: Scale = (() => {
		const f = ((y: number) => xOf(y)) as Scale;
		f.domain = [0, HORIZON];
		f.range = [L, R];
		f.invert = (px: number) => (px <= SPLIT ? left.invert(px) : right.invert(px));
		return f;
	})();

	// ---- clock: the cursor moves at a steady pace across the drawing (20 s), then stays
	const u = $derived(reduced ? 1 : smoothstep(0.4, 20, t));
	const cursorYear = $derived(Math.round(sxAll.invert(L + (R - L) * u)));
	const now = $derived(run[cursorYear]);
	const tot = $derived(totals(now));

	// ---- chart of extra carbon since 1750
	const series = $derived(
		run.map((st, y) => {
			const v = totals(st);
			return { y, air: v.air, ocean: v.ocean, land: v.land };
		})
	);
	const yMax = $derived(niceMax(Math.max(...series.map((d) => Math.max(d.air, d.ocean)), 600)));
	const yMin = $derived(Math.min(-200, -niceMax(-Math.min(...series.map((d) => d.land)))));
	const sy = $derived(scale([yMin, yMax], [560, CHART_TOP]));
	const visible = $derived(series.slice(0, cursorYear + 1));
	const air = $derived(
		linePath(
			visible,
			(d) => d.y,
			(d) => d.air,
			sxAll,
			sy
		)
	);
	const ocean = $derived(
		linePath(
			visible,
			(d) => d.y,
			(d) => d.ocean,
			sxAll,
			sy
		)
	);
	const land = $derived(
		linePath(
			visible,
			(d) => d.y,
			(d) => d.land,
			sxAll,
			sy
		)
	);
	const ghostAir = $derived(
		ghost
			? linePath(
					ghost.map((st, y) => ({ y, v: totals(st).air })),
					(d) => d.y,
					(d) => d.v,
					sxAll,
					sy
				)
			: ''
	);
	// ppm on the right-hand axis: the air's extra carbon converted (1 ppm = 2.124 GtC).
	/** Keeps only values at least `gap` scene units apart on the y axis. */
	const spaced = (values: number[], toY: (v: number) => number, gap: number) => {
		const out: number[] = [];
		for (const v of values) {
			const y = toY(v);
			if (y < CHART_TOP || y > 560) continue;
			if (out.every((w) => Math.abs(toY(w) - y) >= gap)) out.push(v);
		}
		return out;
	};
	const ppmTicks = $derived(
		spaced([300, 400, 500, 600, 800, 1000, 1200, 1500], (p) => sy((p - PPM0) * GTC_PER_PPM), 26)
	);
	const yTicks = $derived(spaced(ticks(yMin, yMax, 5), sy, 1));
	// Round years: 2050, 2100, … (offsets from the end of 2024).
	const xTicks = [26, 76, 126, 176, 476, 976];

	// ---- bars of the stores at the cursor
	const BAR_X0 = 360;
	const BAR_W = 420;
	const barMax = $derived(
		niceMax(Math.max(run[run.length - 1] ? totals(run[run.length - 1]).burnt : 1, 800))
	);
	const bx = $derived(scale([0, barMax], [BAR_X0, BAR_X0 + BAR_W]));
	const bars = $derived([
		{
			id: 'air',
			name: 'air',
			v: tot.air,
			color: 'var(--cc-air)',
			fill: 'var(--cc-air-fill)',
			note: `${ppmOf(now).toFixed(0)} ppm`
		},
		{
			id: 'ocean',
			name: 'ocean',
			v: tot.ocean,
			color: 'var(--cc-ocean)',
			fill: 'var(--cc-surface-fill)',
			note: `surface pH ${pHOf(now).toFixed(2)}`
		},
		{
			id: 'land',
			name: 'plants & soils',
			v: tot.land,
			color: 'var(--cc-plants)',
			fill: 'var(--cc-plants-fill)',
			note: tot.land < 0 ? 'net loss: clearing beats extra growth' : 'net gain'
		}
	]);
	const burntLeft = $derived(FOSSIL_RESERVES - (tot.burnt - start.burnt));
	const BURN_Y = 70 + 3 * 36;
	const emitting = $derived(cursorYear <= s.years && s.years > 0 ? 1 : 0);
	const yearText = $derived(String(2024 + cursorYear));
</script>

<g>
	<!-- stores at the cursor -->
	<Label
		x={24}
		y={40}
		text="Extra carbon since 1750, in {yearText}"
		anchor="start"
		size={15}
		weight={700}
	/>
	<Readout
		id="year"
		order={0}
		label="Year"
		value="{yearText}: {ppmOf(now).toFixed(0)} ppm CO₂{emitting ? ' (still emitting)' : ''}"
	>
		<Label
			x={936}
			y={40}
			text={emitting
				? `emitting: ${s.fossil.toFixed(1)} + ${s.luc.toFixed(1)} GtC a year`
				: s.years > 0
					? `emissions stopped in ${2024 + s.years}`
					: 'no emissions after 2024'}
			anchor="end"
			size={12}
			weight={600}
			color={emitting ? 'var(--cc-human)' : 'var(--stage-ink-muted)'}
		/>
	</Readout>
	<line x1={bx(0)} x2={bx(0)} y1={56} y2={196} stroke="var(--stage-line)" />
	{#each bars as b, i (b.id)}
		{@const y = 70 + i * 36}
		{@const x0 = Math.min(bx(0), bx(b.v))}
		<Label x={24} y={y + 15} text={b.name} anchor="start" size={13} weight={600} />
		<rect
			x={x0}
			{y}
			width={Math.abs(bx(b.v) - bx(0))}
			height="22"
			rx="3"
			fill={b.fill}
			stroke={b.color}
		/>
		<Readout
			id={b.id}
			order={i + 1}
			label={b.name[0].toUpperCase() + b.name.slice(1)}
			value="{b.v >= 0 ? '+' : '−'}{gtc(Math.abs(b.v))} GtC · {b.note}"
			color={b.color}
		>
			<Label
				x={Math.max(bx(0), bx(b.v)) + 8}
				y={y + 15}
				text="{b.v >= 0 ? '+' : '−'}{gtc(Math.abs(b.v))} GtC · {b.note}"
				anchor="start"
				size={12}
			/>
		</Readout>
	{/each}
	<rect
		x={bx(0)}
		y={BURN_Y}
		width={bx(tot.burnt) - bx(0)}
		height="10"
		rx="2"
		fill="var(--cc-human)"
		opacity="0.75"
	/>
	<Readout id="burnt">
		<Label x={24} y={BURN_Y + 10} text="fossil carbon burnt" anchor="start" size={12} muted />
		<Label
			x={bx(tot.burnt) + 8}
			y={BURN_Y + 10}
			text="{gtc(tot.burnt)} GtC{burntLeft < 0 ? ' (more than the proven reserves)' : ''}"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<!-- chart -->
	<Axes
		sx={sxAll}
		{sy}
		{xTicks}
		{yTicks}
		xFormat={(v: number) => String(2024 + v)}
		yLabel="GtC since 1750"
	/>
	<line
		x1={SPLIT}
		x2={SPLIT}
		y1={CHART_TOP}
		y2={560}
		stroke="var(--stage-line)"
		stroke-dasharray="2 3"
	/>
	<Readout id="split">
		<Label
			x={SPLIT + 6}
			y={CHART_TOP + 14}
			text="axis squeezed ×4 from here"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>
	{#each ppmTicks as p (p)}
		<Readout id="ppm-{p}">
			<Label
				x={R + 8}
				y={sy((p - PPM0) * GTC_PER_PPM) + 4}
				text="{p} ppm"
				anchor="start"
				size={11}
				color="var(--cc-air)"
			/>
		</Readout>
	{/each}
	{#if s.years > 0}
		<rect
			x={xOf(0)}
			y={CHART_TOP}
			width={xOf(s.years) - xOf(0)}
			height={560 - CHART_TOP}
			fill="var(--cc-human)"
			opacity="0.06"
		/>
	{/if}
	{#if ghostAir}
		<path
			d={ghostAir}
			fill="none"
			stroke="var(--cc-air)"
			stroke-width="1.5"
			stroke-dasharray="4 3"
			opacity="0.55"
		/>
	{/if}
	<path d={land} fill="none" stroke="var(--cc-plants)" stroke-width="2.5" />
	<path d={ocean} fill="none" stroke="var(--cc-ocean)" stroke-width="2.5" />
	<path d={air} fill="none" stroke="var(--cc-air)" stroke-width="3" />
	<line
		x1={xOf(cursorYear)}
		x2={xOf(cursorYear)}
		y1={CHART_TOP}
		y2={560}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
	/>
	<Readout id="legend">
		<Label
			x={L + 8}
			y={sy(yMax) + 14}
			text="air"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-air)"
		/>
		<Label
			x={L + 36}
			y={sy(yMax) + 14}
			text="ocean"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-ocean)"
		/>
		<Label
			x={L + 84}
			y={sy(yMax) + 14}
			text="plants & soils (net)"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-plants)"
		/>
		{#if ghost}
			<Label
				x={L + 228}
				y={sy(yMax) + 14}
				text="dashed: default sinks"
				anchor="start"
				size={11}
				muted
			/>
		{/if}
	</Readout>
</g>
