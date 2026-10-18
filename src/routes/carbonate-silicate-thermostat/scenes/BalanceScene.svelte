<script lang="ts">
	/**
	 * In against out: the volcanoes' steady CO₂ release (a flat line) and the weathering of an
	 * open planet whose temperature follows its CO₂ (a rising curve), both relative to today's,
	 * against the CO₂ on a doubling scale. They cross at 280 ppm. The `co2` control (doublings
	 * of 280 ppm) moves a cursor; the gap between the two is the net change, and an arrow along
	 * the axis, with dots marching at a speed that follows the gap, shows where the CO₂ goes.
	 * Top right: the feedback loop.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, cycle, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { P0, celsiusText, co2Text, openRate, openTemperature, weathering } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const tt = $derived(reduced ? 2.5 : t);
	const target = $derived(Number(params.co2 ?? 1));
	const lx = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const v = target;
		untrack(() => lx.set(v, { duration: reduced ? 0 : 700 }));
	});

	const X0 = 96;
	const X1 = 640;
	const Y0 = 110;
	const Y1 = 500;
	const sx = scale([-2, 3], [X0, X1]);
	const sy = scale([0, 4], [Y1, Y0]);
	const wOf = (d: number) => {
		const ppm = P0 * 2 ** d;
		return weathering(openTemperature(ppm), ppm);
	};
	const xs = Array.from({ length: 101 }, (_, i) => -2 + i * 0.05);
	const wPath = linePath(xs, (d) => d, wOf, sx, sy);

	const ppm = $derived(P0 * 2 ** lx.current);
	const k = $derived(openTemperature(ppm));
	const w = $derived(weathering(k, ppm));
	/** Net change, ppm per million years. */
	const net = $derived(openRate(ppm) * 1e6 * (1 - w));
	const dir = $derived(Math.abs(net) < 3 ? 0 : Math.sign(net));
	const netText = $derived(
		dir === 0
			? 'in balance'
			: `${dir > 0 ? 'rises' : 'falls'} ${(Math.round(Math.abs(net) / 10) * 10).toLocaleString('en-US')} ppm per million years`
	);

	// dots marching along the axis toward the balance, faster for a bigger gap
	const AY = 548;
	const ax0 = $derived(sx(lx.current));
	const ax1 = $derived(sx(0) + (dir > 0 ? -10 : 10));
	const speed = $derived(Math.min(1, Math.abs(net) / 600));
	const dots = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const u = cycle(tt * (0.3 + speed), 1, i / 4);
			return { x: ax0 + (ax1 - ax0) * u, o: dir === 0 ? 0 : Math.sin(Math.PI * u) };
		})
	);

	const xTicks = [-2, -1, 0, 1, 2];

	// ---- the loop
	const LX = 800;
	const LY = 250;
	const R = 92;
	const nodes = [
		{ a: -90, text: 'CO₂ in the air' },
		{ a: 30, text: 'warmth and rain' },
		{ a: 150, text: 'weathering' }
	].map((n) => ({
		...n,
		x: LX + R * Math.cos((n.a * Math.PI) / 180),
		y: LY + R * Math.sin((n.a * Math.PI) / 180)
	}));
	const at = (a: number, r: number) => ({
		x: LX + r * Math.cos((a * Math.PI) / 180),
		y: LY + r * Math.sin((a * Math.PI) / 180)
	});
	const LOOP = [
		{ a0: -90, a1: 30, minus: false },
		{ a0: 30, a1: 150, minus: false },
		{ a0: 150, a1: 270, minus: true }
	].map((l) => {
		const p0 = at(l.a0 + 30, R);
		const p1 = at(l.a1 - 30, R);
		return {
			...l,
			d: `M${p0.x} ${p0.y} A${R} ${R} 0 0 1 ${p1.x} ${p1.y}`,
			sign: at((l.a0 + l.a1) / 2, R + 22)
		};
	});
</script>

<g>
	<Readout id="title">
		<Label
			x={X0}
			y={44}
			text="CO₂ in from volcanoes, out by weathering (× today’s rate)"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xLabel="CO₂ in the air"
		yLabel="× today’s flow"
		{xTicks}
		yTicks={[0, 1, 2, 3, 4]}
		xFormat={(d: number) => `${Math.round(P0 * 2 ** d)}`}
	/>
	<line x1={X0} x2={X1} y1={sy(1)} y2={sy(1)} stroke="var(--cst-volc)" stroke-width="3" />
	<path d={wPath} fill="none" stroke="var(--cst-weather)" stroke-width="3" />
	<Readout
		id="key-v"
		order={5}
		label="Volcanoes"
		value="the same at any CO₂"
		color="var(--cst-volc)"
	>
		<Label
			x={X0 + 10}
			y={sy(1) - 12}
			text="volcanoes put in"
			anchor="start"
			weight={700}
			color="var(--cst-volc)"
		/>
	</Readout>
	<Readout
		id="key-w"
		order={6}
		label="Weathering"
		value="rises with the CO₂ and the warmth"
		color="var(--cst-weather)"
	>
		<Label
			x={sx(2.85)}
			y={sy(wOf(2.85)) - 14}
			text="weathering takes out"
			anchor="end"
			weight={700}
			color="var(--cst-weather)"
		/>
	</Readout>
	<circle
		cx={sx(0)}
		cy={sy(1)}
		r="6"
		fill="var(--stage-bg)"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<Readout id="eq">
		<Label
			x={sx(0) + 10}
			y={sy(1) + 22}
			text="balance: 280 ppm, 15 °C"
			anchor="start"
			size={12}
			weight={600}
		/>
	</Readout>

	<!-- the gap at the cursor -->
	<line
		x1={sx(lx.current)}
		x2={sx(lx.current)}
		y1={sy(1)}
		y2={sy(w)}
		stroke={dir > 0 ? 'var(--cst-volc)' : 'var(--cst-weather)'}
		stroke-width="7"
		opacity="0.35"
	/>
	<line
		x1={sx(lx.current)}
		x2={sx(lx.current)}
		y1={Y1}
		y2={Math.min(sy(1), sy(w))}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="3 3"
	/>
	<circle
		cx={sx(lx.current)}
		cy={sy(w)}
		r="6"
		fill="var(--cst-weather)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<circle cx={sx(lx.current)} cy={sy(1)} r="5" fill="var(--cst-volc)" />

	<!-- where the CO₂ goes -->
	{#if dir !== 0}
		<line
			x1={ax0}
			x2={ax1}
			y1={AY}
			y2={AY}
			stroke="var(--cst-co2)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		{#each dots as d, i (i)}
			<circle cx={d.x} cy={AY} r="4" fill="var(--cst-co2)" opacity={d.o} />
		{/each}
	{/if}
	<Readout id="state" order={1} label="CO₂" value="{co2Text(ppm)}, {celsiusText(k)}">
		<Label
			x={X1 + 12}
			y={Y1 - 50}
			text="{co2Text(ppm)} · {celsiusText(k)}"
			anchor="start"
			size={14}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout
		id="w"
		order={2}
		label="Weathering"
		value="× {w.toFixed(2)} of today’s"
		color="var(--cst-weather)"
	>
		<Label
			x={X1 + 12}
			y={Y1 - 28}
			text="weathering ×{w.toFixed(2)}"
			anchor="start"
			weight={600}
			color="var(--cst-weather)"
			tabular
		/>
	</Readout>
	<Readout id="net" order={3} label="So the CO₂" value={netText} color="var(--cst-co2)">
		<Label
			x={X1 + 12}
			y={Y1 - 6}
			text="CO₂ {netText}"
			anchor="start"
			weight={600}
			color="var(--cst-co2)"
		/>
	</Readout>

	<!-- the loop -->
	<g>
		{#each LOOP as l (l.a0)}
			{@const color = l.minus ? 'var(--cst-co2)' : 'var(--stage-ink-muted)'}
			<path d={l.d} fill="none" stroke={color} stroke-width="1.8" marker-end="url(#arrowhead)" />
			<text
				x={l.sign.x}
				y={l.sign.y + 7}
				text-anchor="middle"
				font-size="20"
				font-weight="700"
				fill={color}>{l.minus ? '−' : '+'}</text
			>
		{/each}
		{#each nodes as n (n.a)}
			<Label x={n.x} y={n.y + 4} text={n.text} size={12} weight={600} pill />
		{/each}
		<Readout id="loop">
			<Label x={LX} y={LY + 5} text="a negative feedback" size={12} muted />
		</Readout>
	</g>
</g>
