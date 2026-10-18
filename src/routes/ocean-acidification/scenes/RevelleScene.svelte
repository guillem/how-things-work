<script lang="ts">
	/**
	 * Left: the Revelle factor against the air's CO₂ at the chosen temperature (polar and tropical
	 * water faint), with a handle that sets the CO₂. Right: the dissolved carbon each kilogram of
	 * surface water gains for each further 100 ppm, the step holding the reader's CO₂ highlighted.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fromAir, revelle } from '../model';
	import PpmHandle from './PpmHandle.svelte';
	import {
		C,
		PPM_MAX,
		PPM_MIN,
		T_MAX,
		T_MIN,
		fmtPpm,
		fmtT,
		ppmOf,
		tempColor,
		tempOf,
		waterAt
	} from './shared';

	let { params, setParam }: StageProps = $props();

	const ppm = $derived(ppmOf(params));
	const T = $derived(tempOf(params));
	const water = $derived(waterAt(T));
	const s = $derived(fromAir(ppm, water));
	const R = $derived(revelle(s.pCO2, water));
	const R0 = $derived(revelle(fromAir(PPM_MIN, water).pCO2, water));

	const Y0 = 70;
	const Y1 = 430;
	const L = { x0: 84, x1: 440 };
	const B = { x0: 560, x1: 916 };
	const sx = scale([PPM_MIN, PPM_MAX], [L.x0, L.x1]);
	const sy = scale([6, 22], [Y1, Y0]);

	const sweep = (T: number) => {
		const w = waterAt(T);
		const out: { ppm: number; r: number }[] = [];
		for (let p = PPM_MIN; p <= PPM_MAX + 0.1; p += 20)
			out.push({ ppm: p, r: revelle(fromAir(p, w).pCO2, w) });
		return out;
	};
	const ghosts = [
		{ id: 'cold', T: T_MIN, pts: sweep(T_MIN) },
		{ id: 'warm', T: T_MAX, pts: sweep(T_MAX) }
	];
	const pts = $derived(sweep(T));
	const color = $derived(tempColor(T));

	// carbon gained per 100 ppm
	const STEPS = Array.from({ length: 10 }, (_, i) => PPM_MIN + 100 * i);
	const gains = $derived(
		STEPS.map((a) => ({ a, g: fromAir(a + 100, water).dic - fromAir(a, water).dic }))
	);
	const bx = scale([0, 10], [B.x0, B.x1]);
	const by = scale([0, 100], [Y1, Y0]);
	/** What the next 100 ppm from the reader's own CO₂ adds. */
	const nextGain = $derived(fromAir(ppm + 100, water).dic - s.dic);
	const active = $derived(Math.min(9, Math.floor((ppm - PPM_MIN) / 100)));
	const bw = (bx(1) - bx(0)) * 0.72;
</script>

<g>
	<!-- left: the Revelle factor -->
	<Axes
		{sx}
		{sy}
		xTicks={[280, 400, 600, 800, 1000, 1200]}
		yTicks={[6, 10, 14, 18, 22]}
		xLabel="CO₂ in the air (ppm)"
		yLabel="Revelle factor"
	/>
	{#each ghosts as g (g.id)}
		<path
			d={linePath(
				g.pts,
				(p) => p.ppm,
				(p) => p.r,
				sx,
				sy
			)}
			fill="none"
			stroke={tempColor(g.T)}
			stroke-width="1.5"
			opacity="0.45"
		/>
		<Readout id="ghost-{g.id}">
			<Label
				x={L.x1 - 4}
				y={sy(g.pts[g.pts.length - 1].r) + (g.id === 'cold' ? -10 : 18)}
				anchor="end"
				text={fmtT(g.T)}
				size={11}
				muted
			/>
		</Readout>
	{/each}
	<path
		d={linePath(
			pts,
			(p) => p.ppm,
			(p) => p.r,
			sx,
			sy
		)}
		fill="none"
		stroke={color}
		stroke-width="3"
	/>
	<line
		x1={sx(ppm)}
		x2={sx(ppm)}
		y1={Y0}
		y2={Y1}
		stroke={C.mark}
		stroke-width="1.5"
		opacity="0.6"
	/>
	<PpmHandle {sx} y={sy(R)} {ppm} {setParam} />
	<Readout
		id="revelle"
		order={1}
		label="Revelle factor"
		value="{R.toFixed(1)} at {fmtPpm(ppm)}, {fmtT(T)} (at 280 ppm: {R0.toFixed(1)})"
		{color}
	>
		<Label
			x={L.x0}
			y={Y0 - 26}
			anchor="start"
			text="Revelle factor {R.toFixed(1)}"
			size={16}
			weight={700}
			tabular
		/>
		<Label
			x={L.x0 + 176}
			y={Y0 - 26}
			anchor="start"
			text="{fmtPpm(ppm)}, {fmtT(T)} · at 280 ppm: {R0.toFixed(1)}"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- right: carbon per 100 ppm -->
	<Axes
		sx={bx}
		sy={by}
		xTicks={[]}
		yTicks={[0, 25, 50, 75, 100]}
		yLabel="carbon gained per kg (µmol)"
	/>
	{#each gains as b, i (b.a)}
		<rect
			x={bx(i + 0.14)}
			y={by(b.g)}
			width={bw}
			height={Y1 - by(b.g)}
			rx="3"
			fill={C.hco3}
			opacity={i === active ? 1 : 0.4}
		/>
		<Readout id="bar-{b.a}">
			<Label x={bx(i + 0.5)} y={Y1 + 18} text={String(b.a)} size={11} muted />
		</Readout>
	{/each}
	<Readout id="bars-x">
		<Label
			x={B.x1}
			y={Y1 + 38}
			anchor="end"
			text="each bar: 100 ppm more than its label"
			size={11}
			muted
		/>
	</Readout>
	<Readout
		id="gain"
		order={2}
		label="Next 100 ppm"
		value="+{Math.round(nextGain)} µmol/kg from {fmtPpm(ppm)} (from 280 ppm: +{Math.round(
			gains[0].g
		)})"
		color={C.hco3}
	>
		<Label
			x={B.x0}
			y={Y0 - 26}
			anchor="start"
			text="next 100 ppm: +{Math.round(nextGain)} µmol/kg"
			size={16}
			weight={700}
			tabular
			color={C.hco3Text}
		/>
	</Readout>

	<rect
		x="84"
		y="494"
		width="832"
		height="84"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="rule"
		order={3}
		label="Rule of thumb"
		value="10% more CO₂ in the air → {(10 / R).toFixed(1)}% more carbon in the water"
	>
		<Label
			x={104}
			y={526}
			anchor="start"
			text="A 10% rise of the air's CO₂ raises the water's dissolved carbon by only about {(
				10 / R
			).toFixed(1)}%."
			size={14}
			weight={600}
			tabular
		/>
		<Label
			x={104}
			y={552}
			anchor="start"
			text="The carbonate ion that took up the CO₂ is being used up, so each step adds less than the one before."
			size={13}
			muted
		/>
	</Readout>
</g>
