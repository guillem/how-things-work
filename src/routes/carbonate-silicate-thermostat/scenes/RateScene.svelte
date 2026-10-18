<script lang="ts">
	/**
	 * Walker, Hays & Kasting's weathering law against temperature, at today's CO₂: the
	 * dissolution of the rock (e-folding 17.7 K), the runoff (60 K) and their product (13.7 K),
	 * relative to today. The `temp` control (change from today, °C) moves a cursor; beside the
	 * chart a rock under rain shows the two parts: the rain's density follows the runoff and
	 * the ions leaving the rock follow the whole rate.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, cycle, linePath, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { P0, T0, kineticFactor, runoffFactor, weathering } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const tt = $derived(reduced ? 2.5 : t);
	const target = $derived(Number(params.temp ?? 10));
	const dT = new Tween(10, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = target;
		untrack(() => dT.set(v, { duration: reduced ? 0 : 700 }));
	});

	const X0 = 96;
	const X1 = 600;
	const Y0 = 96;
	const Y1 = 500;
	const sx = scale([-20, 20], [X0, X1]);
	const sy = scale([0, 5], [Y1, Y0]);
	const xs = Array.from({ length: 81 }, (_, i) => -20 + i * 0.5);
	const curve = (f: (k: number) => number) =>
		linePath(
			xs,
			(d) => d,
			(d) => f(T0 + d),
			sx,
			sy
		);
	const total = curve((k) => weathering(k, P0));
	const kinetic = curve(kineticFactor);
	const runoff = curve(runoffFactor);

	const kin = $derived(kineticFactor(T0 + dT.current));
	const run = $derived(runoffFactor(T0 + dT.current));
	const all = $derived(weathering(T0 + dT.current, P0));
	const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}`;

	// ---- the rock under rain
	const RX = 790;
	const rainCount = $derived(Math.round(6 + 10 * run));
	const drops = $derived(
		Array.from({ length: 22 }, (_, i) => {
			const u = cycle(tt, 0.9, (i * 0.618) % 1);
			const x = 680 + ((i * 47) % 220);
			return {
				x: x - u * 10,
				y: 150 + u * 150,
				o: i < rainCount ? smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u)) : 0
			};
		})
	);
	const ionCount = $derived(Math.min(18, Math.round(4 * all)));
	const ions = $derived(
		Array.from({ length: 18 }, (_, i) => {
			const u = cycle(tt, 3.2, (i * 0.381) % 1);
			const x = 700 + ((i * 37) % 180);
			return {
				x: x + u * 60,
				y: 372 + u * 90 + ((i * 13) % 20),
				o: i < ionCount ? smoothstep(0, 0.15, u) * (1 - smoothstep(0.8, 1, u)) : 0,
				ca: i % 3 === 0
			};
		})
	);
</script>

<g>
	<Readout id="title">
		<Label
			x={X0}
			y={44}
			text="Silicate weathering, relative to today (CO₂ held at 280 ppm)"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xLabel="change of temperature, °C"
		yLabel="× today’s rate"
		xTicks={[-20, -10, 0, 10, 20]}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xFormat={(v: number) => sign(v)}
	/>
	<line x1={sx(0)} x2={sx(0)} y1={Y0} y2={Y1} stroke="var(--stage-line)" stroke-dasharray="3 3" />
	<path
		d={runoff}
		fill="none"
		stroke="var(--cst-weather)"
		stroke-width="2"
		stroke-dasharray="7 4"
	/>
	<path d={kinetic} fill="none" stroke="var(--cst-rock)" stroke-width="2" stroke-dasharray="2 4" />
	<path d={total} fill="none" stroke="var(--cst-co2)" stroke-width="3" />
	<Readout
		id="k-total"
		order={4}
		label="Weathering"
		value="× {all.toFixed(2)}"
		color="var(--cst-co2)"
	>
		<Label
			x={sx(17)}
			y={sy(weathering(T0 + 17, P0)) - 14}
			text="weathering ×{all.toFixed(2)}"
			anchor="end"
			weight={700}
			color="var(--cst-co2)"
		/>
	</Readout>
	<Readout
		id="k-kin"
		order={2}
		label="Rock dissolves faster"
		value="× {kin.toFixed(2)}"
		color="var(--cst-rock)"
	>
		<Label
			x={sx(19)}
			y={sy(kineticFactor(T0 + 19)) + 22}
			text="rock dissolves ×{kin.toFixed(2)}"
			anchor="end"
			weight={600}
		/>
	</Readout>
	<Readout
		id="k-run"
		order={3}
		label="More rain runs off"
		value="× {run.toFixed(2)}"
		color="var(--cst-weather)"
	>
		<Label
			x={sx(19)}
			y={sy(runoffFactor(T0 + 19)) + 20}
			text="more runoff ×{run.toFixed(2)}"
			anchor="end"
			weight={600}
			color="var(--cst-weather)"
		/>
	</Readout>

	<!-- cursor -->
	<line
		x1={sx(dT.current)}
		x2={sx(dT.current)}
		y1={Y1}
		y2={sy(all)}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.2"
	/>
	<circle
		cx={sx(dT.current)}
		cy={sy(all)}
		r="7"
		fill="var(--cst-co2)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<circle cx={sx(dT.current)} cy={sy(kin)} r="4.5" fill="var(--cst-rock)" />
	<circle cx={sx(dT.current)} cy={sy(run)} r="4.5" fill="var(--cst-weather)" />
	<Readout
		id="temp"
		order={1}
		label="Temperature"
		value="{sign(dT.current)} °C, about {Math.round(15 + dT.current)} °C on average"
	>
		<Label
			x={sx(dT.current)}
			y={Y1 - 10}
			text="{sign(dT.current)} °C"
			anchor={dT.current > 14 ? 'end' : 'start'}
			weight={700}
			tabular
			pill
		/>
	</Readout>

	<!-- the rock under rain -->
	<g>
		<ellipse cx={RX} cy={128} rx={96} ry={22} fill="var(--surface)" stroke="var(--border)" />
		{#each drops as d, i (i)}
			<line
				x1={d.x}
				y1={d.y}
				x2={d.x - 2.5}
				y2={d.y + 10}
				stroke="var(--cst-weather)"
				stroke-width="1.8"
				stroke-linecap="round"
				opacity={d.o * 0.85}
			/>
		{/each}
		<path
			d="M676 370 L700 326 L744 312 L800 318 L846 304 L890 332 L904 370 Z"
			fill="var(--cst-rock)"
			opacity="0.85"
		/>
		<path d="M660 372 L930 372 L944 500 L650 500 Z" fill="var(--cst-ocean)" opacity="0.45" />
		{#each ions as m, i (i)}
			<circle
				cx={m.x}
				cy={m.y}
				r="3.6"
				fill={m.ca ? 'var(--stage-bg)' : 'var(--cst-co2)'}
				stroke={m.ca ? 'var(--stage-ink)' : 'none'}
				stroke-width="1"
				opacity={m.o}
			/>
		{/each}
		<Readout id="rock">
			<Label
				x={RX}
				y={548}
				text="rain on silicate rock, and what it carries away"
				size={12}
				muted
			/>
		</Readout>
		<Readout
			id="ions"
			order={5}
			label="Carried away"
			value="calcium (Ca²⁺) and bicarbonate (HCO₃⁻)"
		>
			<circle cx={RX - 110} cy={522} r="4" fill="var(--stage-bg)" stroke="var(--stage-ink)" />
			<Label x={RX - 100} y={526} text="Ca²⁺" anchor="start" size={12} halo={false} />
			<circle cx={RX - 30} cy={522} r="4" fill="var(--cst-co2)" />
			<Label x={RX - 20} y={526} text="HCO₃⁻ (bicarbonate)" anchor="start" size={12} halo={false} />
		</Readout>
	</g>
</g>
