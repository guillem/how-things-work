<script lang="ts">
	/**
	 * Fusion reactivity ⟨σv⟩ against temperature for D–T, D–D (both branches) and D–³He, both
	 * axes logarithmic (Bosch–Hale 1992). A cursor follows the temperature control and reads
	 * off each fuel; the chosen fuel is drawn on top. A band marks the D–T sweet spot and a
	 * dashed line the Sun's core.
	 */
	import { Axes, Label, clamp, cycle, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { KELVIN_PER_KEV, reactivity, reactivityDD } from '../model';
	import { kelvinText, plasmaOf, pow10, sci } from './settings';

	let { t, params, reduced }: StageProps = $props();

	const X0 = 120;
	const X1 = 880;
	const Y0 = 100;
	const Y1 = 480;
	const lx = scale([0, 2], [X0, X1]);
	const ly = scale([-28, -21], [Y1, Y0]);
	const sx = (tk: number) => lx(Math.log10(tk));
	const sy = (v: number) => ly(Math.log10(v));

	const fuels = [
		{ id: 'DT', name: 'D–T', f: (tk: number) => reactivity(tk), color: 'var(--nf-dt)', lx: 2.2 },
		{ id: 'DD', name: 'D–D', f: reactivityDD, color: 'var(--nf-dd)', lx: 30 },
		{
			id: 'DHe3',
			name: 'D–³He',
			f: (tk: number) => reactivity(tk, 'DHe3'),
			color: 'var(--nf-dhe3)',
			lx: 3.3
		}
	];
	const temps = Array.from({ length: 161 }, (_, i) => 10 ** (i / 80));

	const draw = $derived(reduced ? 1 : smoothstep(0.2, 1.8, t));
	const paths = fuels.map((fu) => {
		let d = '';
		for (const tk of temps) {
			const v = fu.f(tk);
			if (v < 1e-28) continue;
			d += `${d ? 'L' : 'M'}${sx(tk).toFixed(1)} ${sy(v).toFixed(1)}`;
		}
		return { ...fu, d };
	});

	const temp = $derived(plasmaOf(params).t);
	const chosen = $derived(String(params.fuel ?? 'DT'));
	const ordered = $derived(
		[...paths].sort((a, b) => Number(a.id === chosen) - Number(b.id === chosen))
	);
	const values = $derived(fuels.map((fu) => ({ ...fu, v: fu.f(temp) })));
	const ratio = $derived(reactivity(temp) / reactivityDD(temp));
	const pulse = $derived(reduced ? 0.5 : cycle(t, 1.6));
	const sun = 1.57e7 / KELVIN_PER_KEV;
	const yTicks = [-28, -27, -26, -25, -24, -23, -22, -21];
	const labelAt = (fu: (typeof paths)[number]) => {
		const v = fu.f(fu.lx);
		return { x: sx(fu.lx), y: sy(v) };
	};
</script>

<g>
	<defs>
		<clipPath id="reactivity-reveal">
			<rect x={X0 - 10} y={Y0 - 20} width={(X1 - X0 + 20) * draw} height={Y1 - Y0 + 30} />
		</clipPath>
	</defs>
	<rect
		x={sx(10)}
		y={Y0}
		width={sx(20) - sx(10)}
		height={Y1 - Y0}
		fill="var(--nf-dt)"
		opacity="0.1"
	/>
	<Readout id="sweet">
		<Label x={(sx(10) + sx(20)) / 2} y={Y0 + 16} text="D–T sweet spot" size={11} muted />
	</Readout>
	<Axes
		sx={lx}
		sy={ly}
		xTicks={[0, Math.log10(2), Math.log10(5), 1, Math.log10(20), Math.log10(50), 2]}
		xFormat={(v: number) => String(Math.round(10 ** v))}
		{yTicks}
		yFormat={(v: number) => pow10(v)}
		xLabel="temperature (keV)"
		yLabel="reactivity ⟨σv⟩ (m³/s)"
	/>
	<line
		x1={sx(sun)}
		x2={sx(sun)}
		y1={Y1}
		y2={Y0 + 30}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="4 4"
	/>
	<Readout id="sun" order={9} label="Centre of the Sun" value="{sun.toFixed(1)} keV">
		<Label x={sx(sun) + 6} y={Y0 + 40} text="centre of the Sun" anchor="start" size={11} muted />
	</Readout>

	<g clip-path="url(#reactivity-reveal)">
		{#each ordered as fu (fu.id)}
			{@const at = labelAt(fu)}
			<path
				d={fu.d}
				fill="none"
				stroke={fu.color}
				stroke-width={fu.id === chosen ? 3.5 : 2}
				opacity={fu.id === chosen ? 1 : 0.5}
				stroke-linejoin="round"
			/>
			<Readout id="name-{fu.id}">
				<Label
					x={at.x}
					y={at.y - 14}
					text={fu.name}
					color={fu.color}
					weight={700}
					size={14}
					opacity={fu.id === chosen ? 1 : 0.7}
				/>
			</Readout>
		{/each}
	</g>

	<!-- cursor -->
	<g opacity={smoothstep(0.6, 1, draw)}>
		<line
			x1={sx(temp)}
			x2={sx(temp)}
			y1={Y1}
			y2={Y0}
			stroke="var(--stage-ink)"
			stroke-width="1.2"
			opacity="0.5"
		/>
		{#each values as fu (fu.id)}
			{#if fu.v > 1e-28}
				<circle
					cx={sx(temp)}
					cy={sy(fu.v)}
					r={fu.id === chosen ? 6 + 2 * Math.sin(pulse * 2 * Math.PI) : 4.5}
					fill={fu.color}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		{/each}
	</g>

	<!-- readout card, top right -->
	<Readout id="temp" order={0} label="Temperature" value="{temp} keV · {kelvinText(temp)}">
		<Label
			x={X1}
			y={44}
			text="plasma at {temp} keV · {kelvinText(temp)}"
			anchor="end"
			size={14}
			weight={600}
		/>
	</Readout>
	{#each values as fu, i (fu.id)}
		<Readout id="v-{fu.id}" order={1 + i} label={fu.name} value="{sci(fu.v)} m³/s" color={fu.color}>
			<text x={X1} y={Y1 - 86 + 20 * i} text-anchor="end" font-size="12">
				<tspan fill={fu.color} font-weight={fu.id === chosen ? 700 : 500}>{fu.name}</tspan>
				<tspan dx="6">{fu.v > 1e-30 ? `${sci(fu.v)} m³/s` : '—'}</tspan>
			</text>
		</Readout>
	{/each}
	<Readout
		id="ratio"
		order={4}
		label="D–T against D–D"
		value="{Math.round(clamp(ratio, 0, 1e9))} times as reactive"
	>
		<text x={X1} y={Y1 - 22} text-anchor="end" font-size="12" class="muted"
			>D–T is {Math.round(ratio)} times as reactive as D–D</text
		>
	</Readout>
</g>
