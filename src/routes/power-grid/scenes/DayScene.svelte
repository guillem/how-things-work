<script lang="ts">
	/**
	 * One real day on the Spanish mainland grid (9 April 2025, REE): hourly mean demand, and
	 * in `mix` mode the generation stacked by source, with pumping and exports below zero.
	 * The day is drawn in over the first seconds of the step (left to right); a cursor at the
	 * reader's time of day reads the values off, in the legend.
	 */
	import { Axes, Label, areaPath, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DAY, type Hour } from '../day';
	import { at, dailyEnergy, demandAt, demandExtremes, type Source } from '../grid';

	let { step, t, params, reduced }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'demand') as 'demand' | 'mix');
	const hour = $derived(Number(params.hour ?? 21));

	// ---- geometry: 0–24 h across, MW up
	const X0 = 92;
	const X1 = 930;
	const Y0 = 64;
	const Y1 = $derived(mode === 'mix' ? 420 : 490);
	const sx = scale([0, 24], [X0, X1]);
	const sy = $derived(scale(mode === 'mix' ? [-10000, 35000] : [0, 35000], [Y1, Y0]));

	// the hourly means sit at the middle of each hour; the ends are held flat
	const xs = [0, ...DAY.map((h) => h.hour + 0.5), 24];
	const val = (key: Source) => (x: number) => at(x, key);

	interface Layer {
		key: string;
		name: string;
		color: string;
		value: (x: number) => number;
	}
	const pos = (f: (x: number) => number) => (x: number) => Math.max(0, f(x));
	const neg = (f: (x: number) => number) => (x: number) => Math.min(0, f(x));
	const UP: Layer[] = [
		{ key: 'nuclear', name: 'Nuclear', color: 'var(--pg-nuclear)', value: val('nuclear') },
		{ key: 'coal', name: 'Coal', color: 'var(--pg-coal)', value: val('coal') },
		{ key: 'gas', name: 'Gas', color: 'var(--pg-gas)', value: val('gas') },
		{ key: 'other', name: 'Other', color: 'var(--pg-other)', value: val('other') },
		{ key: 'hydro', name: 'Hydro', color: 'var(--pg-hydro)', value: val('hydro') },
		{ key: 'wind', name: 'Wind', color: 'var(--pg-wind)', value: val('wind') },
		{
			key: 'solarThermal',
			name: 'Solar thermal',
			color: 'var(--pg-solar-thermal)',
			value: val('solarThermal')
		},
		{ key: 'solarPV', name: 'Solar PV', color: 'var(--pg-solar)', value: val('solarPV') },
		{ key: 'imports', name: 'Imports', color: 'var(--pg-exchange)', value: pos(val('exchange')) }
	];
	const DOWN: Layer[] = [
		{ key: 'pumping', name: 'Pumping', color: 'var(--pg-pumping)', value: val('pumping') },
		{ key: 'exports', name: 'Exports', color: 'var(--pg-exchange)', value: neg(val('exchange')) }
	];

	function stack(layers: Layer[]) {
		const base = xs.map(() => 0);
		return layers.map((l) => {
			const pts = xs.map((x, i) => {
				const lo = base[i];
				base[i] += l.value(x);
				return { x, lo, hi: base[i] };
			});
			return { ...l, pts };
		});
	}
	const up = stack(UP);
	const down = stack(DOWN);
	const demandPts = xs.map((x) => ({ x, v: demandAt(x) }));

	// ---- reveal: the day is drawn in over 3 s, then stays
	const REVEAL = 3;
	const u = $derived(reduced ? 1 : Math.min(1, Math.max(0, (t - 0.3) / REVEAL)));
	const clipW = $derived((X1 - X0) * u + 2);

	// ---- the cursor
	const cx = $derived(sx(hour + 0.5));
	const hourRow: Hour = $derived(DAY[Math.max(0, Math.min(23, Math.floor(hour)))]);
	const hh = (h: number) => String(h).padStart(2, '0');
	const span = $derived(`${hh(hourRow.hour)}:00–${hh((hourRow.hour + 1) % 24)}:00`);
	const gw = (mw: number) => `${(mw / 1000).toFixed(1).replace('-', '−')} GW`;
	const { max, min } = demandExtremes();
	const gwh = Math.round(dailyEnergy('demand') / 1000);

	const legend = $derived(
		[...UP, ...DOWN]
			.filter((l) => l.key !== 'imports' || hourRow.exchange > 0)
			.filter((l) => l.key !== 'exports' || hourRow.exchange < 0)
			.map((l) => {
				const v =
					l.key === 'imports' || l.key === 'exports' ? hourRow.exchange : hourRow[l.key as Source];
				return { ...l, v };
			})
	);
</script>

<g>
	<defs>
		<clipPath id="day-reveal">
			<rect x={X0 - 1} y={Y0 - 30} width={clipW} height={Y1 - Y0 + 60} />
		</clipPath>
	</defs>

	<Axes
		{sx}
		{sy}
		xTicks={[0, 3, 6, 9, 12, 15, 18, 21, 24]}
		xFormat={(v) => `${hh(v % 24)}:00`}
		yTicks={mode === 'mix' ? [-10000, 0, 10000, 20000, 30000] : [0, 10000, 20000, 30000]}
		yFormat={(v) => `${v / 1000}`}
	/>
	<Label x={X0 - 10} y={Y0 - 18} text="GW (thousands of MW)" anchor="start" muted size={12} />
	<Label
		x={X1}
		y={Y0 - 18}
		text="Spanish mainland, Wednesday 9 April 2025"
		anchor="end"
		size={14}
		weight={600}
	/>
	{#if mode === 'mix'}
		<line x1={X0} x2={X1} y1={sy(0)} y2={sy(0)} stroke="var(--stage-ink-muted)" />
	{/if}

	<g clip-path="url(#day-reveal)">
		{#if mode === 'mix'}
			{#each [...up, ...down] as l (l.key)}
				<path
					d={areaPath(
						l.pts,
						(p) => p.x,
						(p) => p.lo,
						(p) => p.hi,
						sx,
						sy
					)}
					fill={l.color}
					opacity={0.9}
				/>
			{/each}
		{:else}
			<path
				d={areaPath(
					demandPts,
					(p) => p.x,
					() => 0,
					(p) => p.v,
					sx,
					sy
				)}
				fill="var(--pg-demand)"
				opacity="0.08"
			/>
		{/if}
		<path
			d={linePath(
				demandPts,
				(p) => p.x,
				(p) => p.v,
				sx,
				sy
			)}
			fill="none"
			stroke="var(--pg-demand)"
			stroke-width={mode === 'mix' ? 2.5 : 3}
			stroke-dasharray={mode === 'mix' ? '7 4' : undefined}
		/>
	</g>

	{#if mode === 'demand'}
		<Readout
			id="peak"
			order={3}
			label="Peak"
			value="{max.demand.toLocaleString('en-GB')} MW at 21:00"
		>
			<circle
				cx={sx(max.hour + 0.5)}
				cy={sy(max.demand)}
				r="5"
				fill="var(--pg-demand)"
				opacity={u}
			/>
			<Label
				x={sx(max.hour + 0.5)}
				y={sy(max.demand) - 14}
				text="peak {max.demand.toLocaleString('en-GB')} MW"
				opacity={u}
			/>
		</Readout>
		<Readout
			id="low"
			order={4}
			label="Lowest"
			value="{min.demand.toLocaleString('en-GB')} MW at 04:00"
		>
			<circle
				cx={sx(min.hour + 0.5)}
				cy={sy(min.demand)}
				r="5"
				fill="var(--pg-demand)"
				opacity={u}
			/>
			<Label
				x={sx(min.hour + 0.5)}
				y={sy(min.demand) + 24}
				text="lowest {min.demand.toLocaleString('en-GB')} MW"
				opacity={u}
			/>
		</Readout>
	{:else}
		<Readout id="demand-key">
			<Label x={sx(2)} y={sy(demandAt(2)) - 12} text="demand" opacity={u} />
		</Readout>
	{/if}

	<!-- the cursor -->
	<line
		x1={cx}
		x2={cx}
		y1={Y0 - 6}
		y2={Y1}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		opacity="0.7"
	/>
	<Readout
		id="cursor"
		order={1}
		label="Demand, {span}"
		value="{hourRow.demand.toLocaleString('en-GB')} MW"
	>
		<Label
			x={Math.min(X1 - 90, Math.max(X0 + 90, cx))}
			y={mode === 'mix' ? Y0 + 6 : Y1 - 18}
			text="{span}: demand {hourRow.demand.toLocaleString('en-GB')} MW"
			pill
		/>
	</Readout>

	{#if mode === 'mix'}
		<!-- the legend: each source's mean power in the cursor's hour -->
		<Label x={X0} y={470} text="In the hour {span}:" anchor="start" size={13} weight={600} />
		{#each legend as l, i (l.key)}
			{@const col = i % 4}
			{@const row = Math.floor(i / 4)}
			<g transform="translate({X0 + col * 212} {494 + row * 26})">
				<rect x="0" y="-11" width="14" height="14" rx="3" fill={l.color} />
				<Readout id="leg-{l.key}">
					<Label x={22} y={1} text="{l.name} {gw(l.v)}" anchor="start" />
				</Readout>
			</g>
		{/each}
	{:else}
		<Readout id="energy" order={2} label="The whole day" value="{gwh} GWh">
			<Label
				x={X0}
				y={540}
				text="Each point: the mean power over one hour. The whole day: {gwh} GWh."
				anchor="start"
				muted
			/>
		</Readout>
	{/if}
	<Readout id="source">
		<Label
			x={X1}
			y={580}
			text="Data: Red Eléctrica (REE), real-time demand and generation"
			anchor="end"
			muted
		/>
	</Readout>
</g>
