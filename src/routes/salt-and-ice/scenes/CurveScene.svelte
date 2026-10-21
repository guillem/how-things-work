<script lang="ts">
	/**
	 * The measured freezing line of salty water: grams of salt in 100 g of salty water across,
	 * the temperature at which ice starts to form down. A dot follows the slider; a glass beside
	 * it shows the salt in the water, and the grains that come back out beyond the lowest point.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, hash, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { BRINE, EUTECTIC, freezingPoint } from '../model';
	import { degrees } from '../format';

	let { params, reduced }: StageProps = $props();

	const target = $derived(Number(params.saltiness ?? 0));
	const tween = Tween.of(() => target, { duration: 700, easing: cubicInOut });
	const salt = $derived(reduced ? target : tween.current);
	const freezes = $derived(freezingPoint(salt));

	const sx = scale([0, 26], [110, 600]);
	const sy = scale([-25, 0], [520, 120]);
	const line = $derived(
		linePath(
			BRINE,
			(d) => d.salt,
			(d) => d.freezes,
			sx,
			sy
		)
	);
	const beyond = $derived(
		`M${sx(EUTECTIC.salt)},${sy(EUTECTIC.freezes)} L${sx(26)},${sy(EUTECTIC.freezes)}`
	);
	const past = $derived(salt > EUTECTIC.salt + 0.01);
	const shown = (s: number) =>
		s >= 10 || Math.abs(s - Math.round(s)) < 0.05 ? Math.round(s) : s.toFixed(1);

	// The glass: dissolved salt as dots in the water, grains on the bottom past the lowest point.
	const GX = 700;
	const GY = 150;
	const GW = 200;
	const GH = 330;
	const dots = $derived(
		Array.from({ length: Math.round(Math.min(salt, EUTECTIC.salt) * 2.4) }, (_, i) => ({
			i,
			x: GX + 16 + hash(i, 1) * (GW - 32),
			y: GY + 40 + hash(i, 2) * (GH - 70)
		}))
	);
	const grains = $derived(Math.round(Math.max(0, salt - EUTECTIC.salt) * 6));
</script>

<g class="sa-curve">
	<Axes
		{sx}
		{sy}
		xLabel="g of salt in 100 g of salty water"
		yLabel="freezes at (°C)"
		xTicks={[0, 5, 10, 15, 20, 25]}
		yTicks={[-25, -20, -15, -10, -5, 0]}
		yFormat={(v) => (v < 0 ? `−${-v}` : `${v}`)}
	/>
	<path d={line} fill="none" stroke="var(--sa-line)" stroke-width="3.5" stroke-linejoin="round" />
	<path d={beyond} fill="none" stroke="var(--sa-line)" stroke-width="3" stroke-dasharray="8 6" />

	<!-- landmarks -->
	<circle cx={sx(3.5)} cy={sy(freezingPoint(3.5))} r="5" fill="var(--sa-water)" />
	<Label
		x={sx(3.5) + 12}
		y={sy(freezingPoint(3.5)) - 10}
		text="sea water"
		anchor="start"
		size={14}
		muted
	/>
	<Label
		x={sx(EUTECTIC.salt) - 12}
		y={sy(EUTECTIC.freezes) + 30}
		text="the lowest point: −21 °C"
		anchor="end"
		size={15}
		weight={600}
		muted
	/>

	<!-- the dot -->
	<line
		x1={sx(salt)}
		y1={sy(0)}
		x2={sx(salt)}
		y2={sy(freezes)}
		stroke="var(--sa-red)"
		stroke-width="1.5"
		stroke-dasharray="4 4"
	/>
	<circle
		cx={sx(salt)}
		cy={sy(freezes)}
		r="10"
		fill="var(--sa-red)"
		stroke="var(--stage-bg)"
		stroke-width="2.5"
	/>

	<!-- the glass -->
	<rect
		x={GX}
		y={GY + 20}
		width={GW}
		height={GH - 20}
		rx="6"
		fill="var(--sa-water)"
		opacity="0.3"
	/>
	{#each dots as d (d.i)}
		<circle cx={d.x} cy={d.y} r="4" fill="var(--sa-salt-particle)" />
	{/each}
	{#each { length: grains }, i (i)}
		<rect
			x={GX + 20 + (i % 9) * 18 + hash(i, 4) * 4}
			y={GY + GH - 14 - Math.floor(i / 9) * 10}
			width="10"
			height="8"
			rx="1.5"
			fill="var(--sa-salt)"
			stroke="var(--sa-salt-edge)"
		/>
	{/each}
	<path
		d="M{GX - 4},{GY} L{GX - 4},{GY + GH + 4} L{GX + GW + 4},{GY + GH + 4} L{GX + GW + 4},{GY}"
		fill="none"
		stroke="var(--sa-glass-edge)"
		stroke-width="5"
		stroke-linejoin="round"
	/>

	<Readout id="sa-csalt" order={1} label="Salt in 100 g of salty water" value="{shown(salt)} g">
		<Label
			x={GX + GW / 2}
			y={60}
			text="{shown(salt)} g of salt in 100 g"
			size={19}
			weight={700}
			tabular
		/>
	</Readout>
	<Readout id="sa-cfreeze" order={2} label="It freezes at" value={degrees(freezes)}>
		<Label
			x={GX + GW / 2}
			y={92}
			text="freezes at {degrees(freezes)}"
			size={19}
			weight={700}
			color="var(--sa-red)"
			tabular
		/>
	</Readout>
	{#if past}
		<Readout
			id="sa-cpast"
			order={3}
			label="Extra salt"
			value="in that cold, it comes back out as grains"
		>
			<Label
				x={GX + GW / 2}
				y={GY + GH + 40}
				text="in that cold, extra salt comes out"
				size={15}
				muted
			/>
		</Readout>
	{/if}
</g>
