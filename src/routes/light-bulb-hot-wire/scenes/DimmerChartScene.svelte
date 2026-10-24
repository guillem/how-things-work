<script lang="ts">
	/**
	 * The dimmer from off to full, from the model: the electricity the bulb takes and the light it
	 * gives, each as a share of what it does at full. A marker at the dimmer's setting, dragged
	 * along the dimmer, reads both; a swatch shows the wire's glow there.
	 */
	import { Axes, Handle, Label, clamp, linePath, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { FULL, bulb, celsius, glow, glowColour, glowName, DRAPER } from '../model';
	import { percent } from '../steps';

	let { params, setParam }: StageProps = $props();

	const dimmer = $derived(clamp(Number(params.half ?? 0.5)));
	const m = $derived(bulb(dimmer));

	const sx = scale([0, 1], [120, 860]);
	const sy = scale([0, 100], [500, 110]);
	const data = Array.from({ length: 101 }, (_, i) => {
		const b = bulb(i / 100);
		return {
			d: i / 100,
			power: (100 * b.watts) / FULL.watts,
			light: (100 * b.lumens) / FULL.lumens
		};
	});
	const powerLine = linePath(
		data,
		(r) => r.d,
		(r) => r.power,
		sx,
		sy
	);
	const lightLine = linePath(
		data,
		(r) => r.d,
		(r) => r.light,
		sx,
		sy
	);

	const x = $derived(sx(dimmer));
	const power = $derived((100 * m.watts) / FULL.watts);
	const light = $derived((100 * m.lumens) / FULL.lumens);
	/** A share for the reader: whole per cent, or "under 1%". */
	const pc = (v: number) => (v <= 0 ? '0%' : v < 1 ? 'under 1%' : `${Math.round(v)}%`);
	const setDimmer = (v: number) => setParam('half', Math.round(clamp(v) * 100) / 100);
	const headline = $derived(
		dimmer <= 0
			? 'Dimmer: off'
			: `Dimmer ${percent(dimmer)}: electricity ${pc(power)}, light ${pc(light)}`
	);
	const name = $derived(glowName(m.kelvin));
	const swatch = $derived(glowColour(Math.max(m.kelvin, DRAPER + 1)));
	const cardW = $derived(headline.length * 9.6);
	/** Keep the two readouts apart where the lines are close. */
	const yPower = $derived(sy(power));
	const yLight = $derived(Math.max(sy(light), yPower + 30));
	const labelLeft = $derived(dimmer > 0.72);
</script>

<g class="lbh-chart">
	<Axes
		{sx}
		{sy}
		xLabel="dimmer"
		yLabel="share of full"
		xTicks={[0, 0.25, 0.5, 0.75, 1]}
		xFormat={(v: number) => percent(v)}
		yTicks={[0, 25, 50, 75, 100]}
		yFormat={(v: number) => `${v}%`}
	/>
	<path d={powerLine} fill="none" stroke="var(--lbh-heat)" stroke-width="4" />
	<path d={lightLine} fill="none" stroke="var(--lbh-light)" stroke-width="4" />
	<Readout id="lbh-key-power" label="Orange line: the electricity it takes" color="var(--lbh-heat)">
		<Label
			x={sx(0.36)}
			y={sy(30)}
			text="electricity"
			anchor="end"
			size={16}
			weight={700}
			color="var(--lbh-heat-ink)"
		/>
	</Readout>
	<Readout id="lbh-key-light" label="Yellow line: the light it gives" color="var(--lbh-light)">
		<Label
			x={sx(0.86)}
			y={sy(28)}
			text="light"
			anchor="start"
			size={16}
			weight={700}
			color="var(--lbh-light-ink)"
		/>
	</Readout>

	<!-- the marker -->
	<line
		x1={x}
		y1={sy(0)}
		x2={x}
		y2={yPower - 34}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="4 5"
	/>
	<circle cx={x} cy={sy(power)} r="7" fill="var(--lbh-heat)" />
	<circle
		cx={x}
		cy={sy(light)}
		r="7"
		fill="var(--lbh-light)"
		stroke="var(--stage-ink)"
		stroke-width="1"
	/>
	<Readout id="lbh-mark">
		<Label
			x={x + (labelLeft ? -14 : 14)}
			y={yPower - 10}
			text="electricity {pc(power)}"
			anchor={labelLeft ? 'end' : 'start'}
			size={15}
			weight={700}
			color="var(--lbh-heat-ink)"
		/>
		<Label
			x={x + (labelLeft ? -14 : 14)}
			y={yLight + 22}
			text="light {pc(light)}"
			anchor={labelLeft ? 'end' : 'start'}
			size={15}
			weight={700}
			color="var(--lbh-light-ink)"
		/>
	</Readout>
	<Handle
		{x}
		y={sy(0)}
		r={11}
		label="Dimmer"
		value={dimmer}
		min={0}
		max={1}
		valuetext={percent(dimmer)}
		color="var(--lbh-knob)"
		onmove={(q: Point) => setDimmer(sx.invert(q.x))}
		onkey={(s) => setDimmer(s === 'start' ? 0 : s === 'end' ? 1 : dimmer + s / 100)}
	/>

	<!-- the wire's glow there -->
	<rect x="150" y="120" width="64" height="64" rx="10" fill="var(--lbh-room)" />
	<circle cx="182" cy="152" r="24" fill={swatch} opacity={glow(m.kelvin)} />
	<Readout
		id="lbh-glow"
		order={2}
		label="The wire"
		value="{celsius(m.kelvin).toLocaleString('en-US')} °C, {dimmer <= 0 ? 'cold' : name}"
	>
		<Label
			x={228}
			y={148}
			text="{celsius(m.kelvin).toLocaleString('en-US')} °C"
			anchor="start"
			size={18}
			weight={700}
			tabular
		/>
		<Label x={228} y={172} text={dimmer <= 0 ? 'cold' : name} anchor="start" size={14} muted />
	</Readout>

	<Readout id="lbh-chart-card">
		<rect
			x={944 - cardW - 14}
			y="14"
			width={cardW + 28}
			height="44"
			rx="10"
			fill="var(--surface)"
			opacity="0.9"
		/>
	</Readout>
	<Readout id="lbh-chart-head" order={1} label="Now" value={headline}>
		<Label x={944} y={42} text={headline} anchor="end" size={18} weight={700} />
	</Readout>
</g>
