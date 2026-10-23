<script lang="ts">
	/**
	 * The whole day at once, from the model: above, the air over the land and over the sea through
	 * 24 hours (shaded red where the land is warmer, blue where it is cooler); below, the breeze as
	 * bars, up for a sea breeze and down for a land breeze. A marker at the chosen time, dragged
	 * along the day, reads out both temperatures and the breeze.
	 */
	import {
		Axes,
		Handle,
		Label,
		areaPath,
		clamp,
		linePath,
		scale,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { at, day, kmh } from '../model';
	import { clock } from '../steps';

	let { params, setParam }: StageProps = $props();

	const hour = $derived(Number(params.hour ?? 15));
	const m = $derived(at(hour));

	const sx = scale([0, 24], [110, 900]);
	const sy = scale([16, 32], [300, 80]);
	const sw = scale([-15, 25], [548, 372]);
	const hours = [0, 3, 6, 9, 12, 15, 18, 21, 24];

	const landLine = linePath(
		day,
		(d) => d.hour,
		(d) => d.land,
		sx,
		sy
	);
	const seaLine = linePath(
		day,
		(d) => d.hour,
		(d) => d.sea,
		sx,
		sy
	);
	const warmBand = areaPath(
		day,
		(d) => d.hour,
		(d) => d.sea,
		(d) => Math.max(d.land, d.sea),
		sx,
		sy
	);
	const coolBand = areaPath(
		day,
		(d) => d.hour,
		(d) => Math.min(d.land, d.sea),
		(d) => d.sea,
		sx,
		sy
	);
	const bars = Array.from({ length: 48 }, (_, i) => {
		const h = (i + 0.5) / 2;
		const v = at(h).breeze * 3.6;
		return { i, x: sx(h), y: Math.min(sw(v), sw(0)), hgt: Math.abs(sw(v) - sw(0)), on: v > 0 };
	});

	const x = $derived(sx(hour));
	const speed = $derived(kmh(m.breeze));
	const wind = $derived(
		m.breeze > 0.3
			? `sea breeze, ${speed} km/h`
			: m.breeze < -0.3
				? `land breeze, ${speed} km/h`
				: 'no breeze'
	);
	const setHour = (h: number) => setParam('hour', clamp(Math.round(h * 4) / 4, 0, 24));
</script>

<g class="sbz-chart">
	<Axes {sx} {sy} yLabel="°C" xTicks={hours} xFormat={() => ''} yTicks={[16, 20, 24, 28, 32]} />
	<Axes
		{sx}
		sy={sw}
		xLabel="time of day"
		yLabel="breeze, km/h"
		xTicks={hours}
		xFormat={(h: number) => (h === 24 ? '' : clock(h))}
		yTicks={[-10, 0, 10, 20]}
	/>

	<!-- the two temperatures, and the gap between them -->
	<path d={warmBand} fill="var(--sbz-hot)" opacity="0.18" />
	<path d={coolBand} fill="var(--sbz-cool)" opacity="0.2" />
	<path d={seaLine} fill="none" stroke="var(--sbz-cool)" stroke-width="3.5" />
	<path d={landLine} fill="none" stroke="var(--sbz-hot)" stroke-width="3.5" />
	<Readout id="sbz-key-land" label="Red line: the air over the land" color="var(--sbz-hot)">
		<Label
			x={sx(9.6)}
			y={sy(29)}
			text="air over the land"
			anchor="end"
			size={16}
			weight={700}
			color="var(--sbz-hot)"
		/>
	</Readout>
	<Readout id="sbz-key-sea" label="Blue line: the air over the sea" color="var(--sbz-cool)">
		<Label
			x={sx(0.4)}
			y={sy(22) - 12}
			text="air over the sea"
			anchor="start"
			size={16}
			weight={700}
			color="var(--sbz-cool)"
		/>
	</Readout>

	<!-- the breeze -->
	<line x1={sx(0)} y1={sw(0)} x2={sx(24)} y2={sw(0)} stroke="var(--stage-ink)" stroke-width="1.5" />
	{#each bars as b (b.i)}
		<rect
			x={b.x - 6}
			y={b.y}
			width="12"
			height={b.hgt}
			rx="2"
			fill={b.on ? 'var(--sbz-onshore)' : 'var(--sbz-offshore)'}
		/>
	{/each}
	<Readout
		id="sbz-key-in"
		label="Bars up: a sea breeze, in from the sea"
		color="var(--sbz-onshore)"
	>
		<Label
			x={sx(0.3)}
			y={sw(20)}
			text="up: in from the sea"
			anchor="start"
			size={15}
			weight={600}
			color="var(--sbz-onshore)"
		/>
	</Readout>
	<Readout
		id="sbz-key-out"
		label="Bars down: a land breeze, out to sea"
		color="var(--sbz-offshore)"
	>
		<Label
			x={sx(11)}
			y={sw(-11)}
			text="down: out to sea"
			anchor="start"
			size={15}
			weight={600}
			color="var(--sbz-offshore)"
		/>
	</Readout>

	<!-- the marker -->
	<line
		x1={x}
		y1={sy(32) - 6}
		x2={x}
		y2={sw(-15)}
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		stroke-dasharray="5 5"
	/>
	<circle
		cx={x}
		cy={sy(m.sea)}
		r="6"
		fill="var(--sbz-cool)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<circle
		cx={x}
		cy={sw(m.breeze * 3.6)}
		r="6"
		fill="var(--stage-ink)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Handle
		{x}
		y={sy(m.land)}
		r={9}
		color="var(--sbz-hot)"
		label="Time of day"
		value={hour}
		min={0}
		max={24}
		valuetext={clock(hour)}
		onmove={(p: Point) => setHour(sx.invert(p.x))}
		onkey={(k) => setHour(k === 'start' ? 0 : k === 'end' ? 24 : hour + k * 0.25)}
	/>

	<!-- readouts -->
	<Readout
		id="sbz-head"
		order={1}
		label="Time"
		value="{clock(hour)}: land {Math.round(m.land)} °C, sea {Math.round(m.sea)} °C"
	>
		<Label
			x={944}
			y={34}
			text="{clock(hour)}: land {Math.round(m.land)} °C, sea {Math.round(m.sea)} °C"
			anchor="end"
			size={19}
			weight={700}
		/>
	</Readout>
	<Readout id="sbz-wind" order={2} label="Breeze" value={wind}>
		<Label
			x={944}
			y={58}
			text={wind}
			anchor="end"
			size={16}
			weight={600}
			color={m.breeze > 0.3
				? 'var(--sbz-onshore)'
				: m.breeze < -0.3
					? 'var(--sbz-offshore)'
					: undefined}
		/>
	</Readout>
</g>
