<script lang="ts">
	/**
	 * 1750–2024: the Global Carbon Budget's emissions (stacked, above) and
	 * sinks (below), with the model's ocean and land uptake as dark lines on
	 * top of the budget's estimates. A cursor sweeps the years in.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Axes, Label, areaPath, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import * as gcb from '../gcb2025';
	import { historyDefault, pHOf, ppmOf, ZERO } from '../carbon';

	let { t, reduced }: StageProps = $props();

	const hist = historyDefault();
	const N = gcb.fossil.length;
	const rows = Array.from({ length: N }, (_, i) => ({
		year: gcb.FIRST_YEAR + i,
		fossil: gcb.fossil[i],
		luc: gcb.luc[i],
		atm: gcb.atm[i] ?? 0,
		ocean: gcb.ocean[i] ?? 0,
		land: gcb.land[i] ?? 0,
		mOcean: hist[i].ocean,
		mLand: hist[i].land
	}));

	const L = 90;
	const R = 900;
	const sx = scale([1750, 2024], [L, R]);
	const top = scale([0, 12], [250, 70]);
	const bottom = scale([-1.5, 8], [540, 330]);

	// The cursor sweeps 1750 → 2024 in 9 s, then stays (reduced motion: the whole record).
	const year = $derived(reduced ? 2024 : 1750 + 274 * smoothstep(0.3, 9, t));
	const shown = $derived(rows.filter((r) => r.year <= year));
	const at = $derived(shown[shown.length - 1] ?? rows[0]);
	const state = $derived(hist[Math.max(0, Math.round(at.year) - gcb.FIRST_YEAR)]?.state ?? ZERO);

	const fossilArea = $derived(
		areaPath(
			shown,
			(r) => r.year,
			() => 0,
			(r) => r.fossil,
			sx,
			top
		)
	);
	const lucArea = $derived(
		areaPath(
			shown,
			(r) => r.year,
			(r) => r.fossil,
			(r) => r.fossil + r.luc,
			sx,
			top
		)
	);
	const gcbOcean = $derived(
		linePath(
			shown,
			(r) => r.year,
			(r) => r.ocean,
			sx,
			bottom
		)
	);
	const gcbLand = $derived(
		linePath(
			shown.filter((r) => r.year >= 1850),
			(r) => r.year,
			(r) => r.land,
			sx,
			bottom
		)
	);
	const modelOcean = $derived(
		linePath(
			shown,
			(r) => r.year,
			(r) => r.mOcean,
			sx,
			bottom
		)
	);
	const modelLand = $derived(
		linePath(
			shown,
			(r) => r.year,
			(r) => r.mLand,
			sx,
			bottom
		)
	);
	const airLine = $derived(
		linePath(
			shown.filter((r) => r.year >= 1959),
			(r) => r.year,
			(r) => r.atm,
			sx,
			bottom
		)
	);

	const decade = rows.filter((r) => r.year >= 2015);
	const mean = (k: 'ocean' | 'land' | 'mOcean' | 'mLand') =>
		(decade.reduce((a, r) => a + r[k], 0) / decade.length).toFixed(1);
	const done = $derived(year >= 2023.5 ? 1 : 0);
	const fmt = (v: number) => String(Math.round(v));
</script>

<g>
	<!-- emissions -->
	<Axes {sx} sy={top} yTicks={[0, 4, 8, 12]} xTicks={[]} yLabel="GtC a year" />
	<path d={fossilArea} fill="var(--cc-fossil-fill)" opacity="0.85" />
	<path d={lucArea} fill="var(--cc-clearing)" opacity="0.55" />
	<Readout
		id="emit"
		order={1}
		label="Released in {fmt(at.year)}"
		value="burning {at.fossil.toFixed(1)} + clearing {at.luc.toFixed(1)} GtC"
	>
		<Label
			x={L + 10}
			y={64}
			text="carbon released each year: burning fossil fuels (grey) and clearing land (orange)"
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>

	<!-- sinks -->
	<Axes
		{sx}
		sy={bottom}
		yTicks={[0, 2, 4, 6, 8]}
		xTicks={[1750, 1800, 1850, 1900, 1950, 2000]}
		xFormat={(v: number) => String(v)}
	/>
	<path d={airLine} fill="none" stroke="var(--cc-air)" stroke-width="1.2" opacity="0.6" />
	<path d={gcbLand} fill="none" stroke="var(--cc-plants)" stroke-width="1.1" opacity="0.55" />
	<path d={gcbOcean} fill="none" stroke="var(--cc-ocean)" stroke-width="1.1" opacity="0.6" />
	<path d={modelLand} fill="none" stroke="var(--cc-plants)" stroke-width="3" />
	<path d={modelOcean} fill="none" stroke="var(--cc-ocean)" stroke-width="3" />
	<Readout id="sinks-title">
		<Label
			x={L + 10}
			y={318}
			text="where it went: thin lines measured or estimated (GCB 2025), thick lines the model"
			anchor="start"
			size={13}
			weight={600}
		/>
	</Readout>
	<Readout id="legend">
		<Label
			x={L + 14}
			y={348}
			text="ocean"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-ocean)"
		/>
		<Label
			x={L + 66}
			y={348}
			text="plants"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-plants)"
		/>
		<Label
			x={L + 120}
			y={348}
			text="air (measured since 1959)"
			anchor="start"
			size={12}
			weight={700}
			color="var(--cc-air)"
		/>
	</Readout>

	<!-- cursor -->
	<line
		x1={sx(at.year)}
		x2={sx(at.year)}
		y1={70}
		y2={540}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
	/>
	<Readout
		id="year"
		order={0}
		label="Year"
		value="{fmt(at.year)}: {ppmOf(state).toFixed(0)} ppm CO₂ · ocean pH {pHOf(state).toFixed(2)}"
	>
		<Label
			x={Math.min(sx(at.year) + 8, R - 4)}
			y={96}
			text="{fmt(at.year)} · {ppmOf(state).toFixed(0)} ppm · ocean pH {pHOf(state).toFixed(2)}"
			anchor={sx(at.year) > R - 230 ? 'end' : 'start'}
			size={13}
			weight={700}
			pill
		/>
	</Readout>

	<g opacity={done}>
		<Readout
			id="ocean"
			order={2}
			label="Ocean uptake 2015–2024"
			value="model {mean('mOcean')}, budget {mean('ocean')} GtC a year"
			color="var(--cc-ocean)"
			opacity={done}
		>
			<Label
				x={R - 4}
				y={bottom(3.9)}
				text="ocean 2015–2024: model {mean('mOcean')}, GCB {mean('ocean')}"
				anchor="end"
				size={12}
				weight={700}
				color="var(--cc-ocean)"
				pill
			/>
		</Readout>
		<Readout
			id="land"
			order={3}
			label="Plants' uptake 2015–2024"
			value="model {mean('mLand')}, budget {mean('land')} GtC a year"
			color="var(--cc-plants)"
			opacity={done}
		>
			<Label
				x={R - 4}
				y={bottom(-0.6)}
				text="plants 2015–2024: model {mean('mLand')}, GCB {mean('land')}"
				anchor="end"
				size={12}
				weight={700}
				color="var(--cc-plants)"
				pill
			/>
		</Readout>
	</g>
</g>
