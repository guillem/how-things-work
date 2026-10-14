<script lang="ts">
	/**
	 * How fast a clock in a circular orbit runs compared with one on the ground, against the
	 * orbit's height (`model.microsPerDay`): the gain from weaker gravity, the loss from the
	 * speed, and their sum. `params.alt` (km) picks an orbit; the panel adds up the difference
	 * day by day (two days a second, a pure function of t; under reduced motion, one day).
	 */
	import { Axes, Label, cycle, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { C, MU, R_EARTH, crossoverRadius, microsPerDay } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const altKm = $derived(Number(params.alt ?? 20190));
	const a = $derived(R_EARTH + altKm * 1e3);
	const rate = $derived(microsPerDay(a));
	const speed = $derived(Math.sqrt(MU / a) / 1e3);

	// ---- chart ---------------------------------------------------------------------------
	const sx = scale([0, 40000], [84, 596]);
	const sy = scale([-35, 55], [520, 72]);
	const heights = Array.from({ length: 161 }, (_, i) => 300 + i * 248.125);
	const series = heights.map((h) => ({ h, ...microsPerDay(R_EARTH + h * 1e3) }));
	const gravityPath = linePath(
		series,
		(d) => d.h,
		(d) => d.gravity,
		sx,
		sy
	);
	const speedPath = linePath(
		series,
		(d) => d.h,
		(d) => d.speed,
		sx,
		sy
	);
	const netPath = linePath(
		series,
		(d) => d.h,
		(d) => d.net,
		sx,
		sy
	);
	const crossKm = (crossoverRadius - R_EARTH) / 1e3;
	const MARKS = [
		{ id: 'cross', km: crossKm, text: 'they cancel' },
		{ id: 'gps', km: 20190, text: 'GPS' },
		{ id: 'geo', km: 35786, text: 'geostationary' }
	];

	// ---- the running total ------------------------------------------------------------------
	const DAYS = 10;
	const day = $derived(reduced ? 1 : cycle(t, DAYS / 2) * DAYS);
	const gained = $derived(rate.net * day);
	const rangeKm = $derived((gained * 1e-6 * C) / 1e3);
	const sgn = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`;
	const PX = 640;
	const PW = 304;
	const barMax = 400; // µs for the full bar
	const BAR = 260;
</script>

<g>
	<Axes
		{sx}
		{sy}
		xLabel="height of the orbit (km)"
		yLabel="µs gained per day"
		xTicks={[0, 10000, 20000, 30000, 40000]}
		yTicks={[-30, -15, 0, 15, 30, 45]}
	/>
	<path d="M{sx(0)} {sy(0)}H{sx(40000)}" stroke="var(--stage-ink-muted)" stroke-width="1.2" />
	<path d={gravityPath} fill="none" stroke="var(--gps-gravity)" stroke-width="2.5" />
	<path d={speedPath} fill="none" stroke="var(--gps-speed)" stroke-width="2.5" />
	<path d={netPath} fill="none" stroke="var(--gps-net)" stroke-width="3" />
	<Readout id="curve-labels">
		<Label
			x={sx(38000)}
			y={sy(52.5) - 8}
			text="weaker gravity: faster"
			anchor="end"
			size={12}
			color="var(--gps-gravity)"
		/>
		<Label
			x={sx(38000)}
			y={sy(-4.2) + 22}
			text="speed: slower"
			anchor="end"
			size={12}
			color="var(--gps-speed)"
		/>
		<Label x={sx(38000)} y={sy(48) + 22} text="net" anchor="end" size={12} color="var(--gps-net)" />
	</Readout>
	{#each MARKS as m (m.id)}
		<path d="M{sx(m.km)} {sy(55)}V{sy(-35)}" stroke="var(--stage-line)" stroke-dasharray="3 4" />
		<Readout id="mark-{m.id}">
			<Label x={sx(m.km)} y={sy(-35) - 8} text={m.text} size={11} muted />
		</Readout>
	{/each}

	<!-- the chosen orbit -->
	<path d="M{sx(altKm)} {sy(55)}V{sy(-35)}" stroke="var(--stage-ink)" stroke-width="1.5" />
	<circle cx={sx(altKm)} cy={sy(rate.gravity)} r="5" fill="var(--gps-gravity)" />
	<circle cx={sx(altKm)} cy={sy(rate.speed)} r="5" fill="var(--gps-speed)" />
	<circle
		cx={sx(altKm)}
		cy={sy(rate.net)}
		r="6"
		fill="var(--gps-net)"
		stroke="var(--stage-bg)"
		stroke-width="1.5"
	/>

	<!-- panel -->
	<Readout id="panel">
		<rect
			x={PX}
			y={16}
			width={PW}
			height={568}
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="orbit"
		order={0}
		label="Orbit"
		value="{Math.round(altKm).toLocaleString('en-US')} km up, {speed.toFixed(1)} km/s"
	>
		<text x={PX + 18} y={50} class="muted" style:font-size="12px">Orbit</text>
		<text x={PX + 18} y={72} style:font-size="15px" font-weight="600"
			>{Math.round(altKm).toLocaleString('en-US')} km up · {speed.toFixed(1)} km/s</text
		>
	</Readout>
	<Readout
		id="gravity"
		order={1}
		label="Weaker gravity"
		value="{sgn(rate.gravity)} µs/day"
		color="var(--gps-gravity)"
	>
		<circle cx={PX + 24} cy={106} r="5" fill="var(--gps-gravity)" />
		<text x={PX + 38} y={110} style:font-size="13px">Weaker gravity</text>
		<text x={PX + PW - 18} y={110} text-anchor="end" style:font-size="13px"
			>{sgn(rate.gravity)} µs/day</text
		>
	</Readout>
	<Readout
		id="speed"
		order={2}
		label="Speed"
		value="{sgn(rate.speed)} µs/day"
		color="var(--gps-speed)"
	>
		<circle cx={PX + 24} cy={134} r="5" fill="var(--gps-speed)" />
		<text x={PX + 38} y={138} style:font-size="13px">Speed</text>
		<text x={PX + PW - 18} y={138} text-anchor="end" style:font-size="13px"
			>{sgn(rate.speed)} µs/day</text
		>
	</Readout>
	<Readout id="net" order={3} label="Net" value="{sgn(rate.net)} µs/day" color="var(--gps-net)">
		<path d="M{PX + 18} {150}h{PW - 36}" stroke="var(--border)" />
		<circle cx={PX + 24} cy={170} r="5" fill="var(--gps-net)" />
		<text x={PX + 38} y={174} style:font-size="14px" font-weight="600">Net</text>
		<text x={PX + PW - 18} y={174} text-anchor="end" style:font-size="14px" font-weight="600"
			>{sgn(rate.net)} µs/day</text
		>
	</Readout>

	<Readout id="tally">
		<text x={PX + 18} y={232} class="muted" style:font-size="12px"
			>Orbiting clock minus ground clock</text
		>
		<text x={PX + 18} y={258} style:font-size="15px" font-weight="600"
			>after {day.toFixed(1)} {day >= 0.95 && day < 1.05 ? 'day' : 'days'}: {sgn(gained)} µs</text
		>
		<rect x={PX + 22} y={276} width={BAR} height={14} rx="4" fill="var(--stage-grid)" />
		<rect
			x={gained >= 0
				? PX + 22 + BAR / 2
				: PX + 22 + BAR / 2 - (Math.min(barMax, -gained) / barMax) * (BAR / 2)}
			y={276}
			width={(Math.min(barMax, Math.abs(gained)) / barMax) * (BAR / 2)}
			height={14}
			rx="4"
			fill="var(--gps-net)"
		/>
		<path d="M{PX + 22 + BAR / 2} 270v26" stroke="var(--stage-ink)" />
		<text x={PX + 18} y={322} class="muted" style:font-size="12px"
			>As a range error, at the speed of light</text
		>
		<text x={PX + 18} y={346} style:font-size="15px" font-weight="600"
			>{Math.abs(rangeKm).toFixed(1)} km</text
		>
	</Readout>
	<Readout
		id="factory"
		order={4}
		label="Factory setting at GPS height"
		value="10.229 999 995 43 MHz"
	>
		<text x={PX + 18} y={520} class="muted" style:font-size="12px"
			>GPS clocks are set to tick at</text
		>
		<text x={PX + 18} y={544} style:font-size="14px" font-weight="600">10.229 999 995 43 MHz</text>
		<text x={PX + 18} y={564} class="muted" style:font-size="12px"
			>so they keep 10.23 MHz seen from the ground</text
		>
	</Readout>
</g>
