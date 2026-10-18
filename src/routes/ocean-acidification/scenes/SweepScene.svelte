<script lang="ts">
	/**
	 * pH (left) and carbonate ion (right) against the air's CO₂, solved at every ppm for the chosen
	 * temperature, with the coldest and warmest water as faint curves. The pH axis reaches down to
	 * 6.6 so that neutral (7) and the acid side are on the chart. A handle on the pH curve sets the
	 * CO₂. `mode` 'acid' frames the pitfall (pH stays above 7, carbonate falls far faster);
	 * 'today' marks 280 and 423 ppm and the change between them.
	 */
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fromAir, PPM_2024, PPM_PREINDUSTRIAL } from '../model';
	import PpmHandle from './PpmHandle.svelte';
	import {
		C,
		PPM_MAX,
		PPM_MIN,
		T_MAX,
		T_MIN,
		change,
		fmtPpm,
		fmtT,
		ppmOf,
		tempColor,
		tempOf,
		waterAt
	} from './shared';

	let { step, params, setParam }: StageProps = $props();

	const mode = $derived(String(step.hints?.mode ?? 'acid'));
	const ppm = $derived(ppmOf(params));
	const T = $derived(tempOf(params));
	const water = $derived(waterAt(T));
	const s = $derived(fromAir(ppm, water));
	const s0 = $derived(fromAir(PPM_PREINDUSTRIAL, water));
	const sNow = $derived(fromAir(PPM_2024, water));

	const Y0 = 70;
	const Y1 = 430;
	const L = { x0: 92, x1: 432 };
	const R = { x0: 574, x1: 914 };
	const sxL = scale([PPM_MIN, PPM_MAX], [L.x0, L.x1]);
	const sxR = scale([PPM_MIN, PPM_MAX], [R.x0, R.x1]);
	const syPH = scale([6.6, 8.4], [Y1, Y0]);
	const syC = scale([0, 320], [Y1, Y0]);
	const xTicks = [280, 400, 600, 800, 1000, 1200];

	const sweep = (T: number) => {
		const w = waterAt(T);
		const out: { ppm: number; pH: number; co3: number }[] = [];
		for (let p = PPM_MIN; p <= PPM_MAX + 0.1; p += 20) {
			const x = fromAir(p, w);
			out.push({ ppm: p, pH: x.pH, co3: x.co3 });
		}
		return out;
	};
	const ghosts = [
		{ id: 'cold', T: T_MIN, pts: sweep(T_MIN) },
		{ id: 'warm', T: T_MAX, pts: sweep(T_MAX) }
	];
	const pts = $derived(sweep(T));

	const marks = $derived(
		mode === 'today'
			? [
					{ id: 'pre', ppm: PPM_PREINDUSTRIAL, name: '280: before industry' },
					{ id: 'now', ppm: PPM_2024, name: '423: 2024' }
				]
			: []
	);
	const signedPH = (d: number) => (d >= 0 ? `+${d.toFixed(2)}` : `−${(-d).toFixed(2)}`);
</script>

<g>
	<!-- left: pH -->
	<rect
		x={L.x0}
		y={syPH(7)}
		width={L.x1 - L.x0}
		height={Y1 - syPH(7)}
		fill={C.acid}
		opacity="0.07"
	/>
	<Axes
		sx={sxL}
		sy={syPH}
		{xTicks}
		xLabel="CO₂ in the air (ppm)"
		yLabel="pH"
		yTicks={[6.6, 7, 7.4, 7.8, 8.2]}
		yFormat={(v: number) => v.toFixed(1)}
	/>
	<line
		x1={L.x0}
		x2={L.x1}
		y1={syPH(7)}
		y2={syPH(7)}
		stroke={C.acidText}
		stroke-width="1.5"
		stroke-dasharray="6 4"
	/>
	<Readout id="neutral" order={9} label="Dashed line" value="pH 7; the water stays above it">
		<Label
			x={L.x1 - 8}
			y={syPH(7) - 8}
			anchor="end"
			text="pH 7"
			size={12}
			weight={600}
			color={C.acidText}
		/>
		<Label
			x={L.x1 - 8}
			y={syPH(6.8) + 4}
			anchor="end"
			text="pH stays above 7 throughout"
			size={12}
			color={C.acidText}
		/>
	</Readout>

	<!-- right: carbonate ion -->
	<Axes
		sx={sxR}
		sy={syC}
		{xTicks}
		xLabel="CO₂ in the air (ppm)"
		yLabel="carbonate ion (µmol/kg)"
		yTicks={[0, 80, 160, 240, 320]}
	/>

	{#each ghosts as g (g.id)}
		<path
			d={linePath(
				g.pts,
				(p) => p.ppm,
				(p) => p.pH,
				sxL,
				syPH
			)}
			fill="none"
			stroke={tempColor(g.T)}
			stroke-width="1.5"
			opacity="0.4"
		/>
		<path
			d={linePath(
				g.pts,
				(p) => p.ppm,
				(p) => p.co3,
				sxR,
				syC
			)}
			fill="none"
			stroke={tempColor(g.T)}
			stroke-width="1.5"
			opacity="0.4"
		/>
	{/each}
	<Readout id="ghost-names">
		<Label
			x={R.x1 - 4}
			y={syC(ghosts[1].pts[ghosts[1].pts.length - 1].co3) - 10}
			anchor="end"
			text="30 °C"
			size={11}
			muted
		/>
		<Label
			x={R.x1 - 4}
			y={syC(ghosts[0].pts[ghosts[0].pts.length - 1].co3) + 18}
			anchor="end"
			text="−1.8 °C"
			size={11}
			muted
		/>
	</Readout>
	<path
		d={linePath(
			pts,
			(p) => p.ppm,
			(p) => p.pH,
			sxL,
			syPH
		)}
		fill="none"
		stroke={C.ph}
		stroke-width="3"
	/>
	<path
		d={linePath(
			pts,
			(p) => p.ppm,
			(p) => p.co3,
			sxR,
			syC
		)}
		fill="none"
		stroke={C.co3}
		stroke-width="3"
	/>

	{#each marks as m (m.id)}
		{#each [sxL, sxR] as sx, i (i)}
			<line
				x1={sx(m.ppm)}
				x2={sx(m.ppm)}
				y1={Y0}
				y2={Y1}
				stroke="var(--stage-ink-muted)"
				stroke-dasharray="4 4"
			/>
		{/each}
		<Readout id="mark-{m.id}">
			<Label
				x={sxR(m.ppm) + 4}
				y={m.id === 'pre' ? Y0 + 14 : Y0 + 34}
				anchor="start"
				text={m.name}
				size={11}
				muted
			/>
		</Readout>
	{/each}

	<!-- the reader's CO₂ -->
	<line
		x1={sxL(ppm)}
		x2={sxL(ppm)}
		y1={Y0}
		y2={Y1}
		stroke={C.mark}
		stroke-width="1.5"
		opacity="0.6"
	/>
	<line
		x1={sxR(ppm)}
		x2={sxR(ppm)}
		y1={Y0}
		y2={Y1}
		stroke={C.mark}
		stroke-width="1.5"
		opacity="0.6"
	/>
	<circle
		cx={sxR(ppm)}
		cy={syC(s.co3)}
		r="7"
		fill={C.co3}
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<PpmHandle sx={sxL} y={syPH(s.pH)} {ppm} {setParam} />

	<!-- read-outs -->
	<Readout
		id="ph"
		order={1}
		label="pH"
		value="{s.pH.toFixed(2)} ({signedPH(s.pH - s0.pH)} since 280 ppm)"
		color={C.ph}
	>
		<Label
			x={L.x0}
			y={Y0 - 26}
			anchor="start"
			text="pH {s.pH.toFixed(2)}"
			size={16}
			weight={700}
			tabular
		/>
		<Label
			x={L.x0 + 92}
			y={Y0 - 26}
			anchor="start"
			text="{signedPH(s.pH - s0.pH)} since 280 ppm · {fmtPpm(ppm)}, {fmtT(T)}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<Readout
		id="co3"
		order={2}
		label="Carbonate ion"
		value="{Math.round(s.co3)} µmol/kg ({change(s.co3, s0.co3)})"
		color={C.co3}
	>
		<Label
			x={R.x0}
			y={Y0 - 26}
			anchor="start"
			text="CO₃²⁻ {Math.round(s.co3)} µmol/kg"
			size={16}
			weight={700}
			color={C.co3Text}
			tabular
		/>
		<Label
			x={R.x0 + 186}
			y={Y0 - 26}
			anchor="start"
			text="{change(s.co3, s0.co3)} since 280 ppm"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<rect
		x="92"
		y="494"
		width="822"
		height="84"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if mode === 'today'}
		<Readout
			id="today"
			order={3}
			label="2024 vs 280 ppm"
			value="pH {signedPH(sNow.pH - s0.pH)}, H⁺ {change(sNow.h, s0.h)}, CO₃²⁻ {change(
				sNow.co3,
				s0.co3
			)}"
		>
			<Label
				x={112}
				y={526}
				anchor="start"
				text="From 280 to 423 ppm at {fmtT(T)}: pH {s0.pH.toFixed(2)} → {sNow.pH.toFixed(
					2
				)}, hydrogen ions {change(sNow.h, s0.h)},"
				size={13}
				tabular
			/>
			<Label
				x={112}
				y={552}
				anchor="start"
				text="carbonate ion {Math.round(s0.co3)} → {Math.round(sNow.co3)} µmol/kg ({change(
					sNow.co3,
					s0.co3
				)}), aragonite saturation {s0.omegaAr.toFixed(1)} → {sNow.omegaAr.toFixed(1)}."
				size={13}
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="compare"
			order={3}
			label="Since 280 ppm"
			value="pH {signedPH(s.pH - s0.pH)} (H⁺ {change(s.h, s0.h)}), carbonate ion {change(
				s.co3,
				s0.co3
			)}"
		>
			<Label
				x={112}
				y={526}
				anchor="start"
				text="Since 280 ppm: pH {signedPH(s.pH - s0.pH)} units (hydrogen ions {change(
					s.h,
					s0.h
				)}); carbonate ion {change(s.co3, s0.co3)}."
				size={13}
				tabular
			/>
			<Label
				x={112}
				y={552}
				anchor="start"
				text="Still basic: the carbonate ion lost is what threatens shell building."
				size={13}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
