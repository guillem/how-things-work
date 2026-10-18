<script lang="ts">
	/**
	 * Aragonite saturation against the air's CO₂: one faint curve per temperature from polar to
	 * tropical water, the chosen temperature in bold (calcite dashed), the line Ω = 1 with the
	 * undersaturated zone below it, and where the bold curve crosses it. A handle on the curve sets
	 * the CO₂. On the right, `focus` 'omega' works out Ω for this water; 'cold' plots the CO₂ at
	 * which aragonite reaches Ω = 1 against temperature.
	 */
	import { Axes, Label, linePath, scale, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fromAir, ppmAtOmega } from '../model';
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

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'omega'));
	const ppm = $derived(ppmOf(params));
	const T = $derived(tempOf(params));
	const water = $derived(waterAt(T));
	const s = $derived(fromAir(ppm, water));

	const X0 = 84;
	const X1 = 610;
	const Y0 = 64;
	const Y1 = 470;
	const sx = scale([PPM_MIN, PPM_MAX], [X0, X1]);
	const sy = scale([0, 5.5], [Y1, Y0]);

	const sweep = (T: number) => {
		const w = waterAt(T);
		const out: { ppm: number; ar: number; ca: number }[] = [];
		for (let p = PPM_MIN; p <= PPM_MAX + 0.1; p += 20) {
			const x = fromAir(p, w);
			out.push({ ppm: p, ar: x.omegaAr, ca: x.omegaCa });
		}
		return out;
	};
	const GHOST_T = [-1.8, 10, 20, 30];
	const ghosts = GHOST_T.map((T) => ({ T, pts: sweep(T) }));
	const pts = $derived(sweep(T));
	const color = $derived(tempColor(T));
	const cross = $derived(ppmAtOmega(1, water));
	const crossCa = $derived(ppmAtOmega(1, water, 'calcite'));
	const under = $derived(s.omegaAr < 1);
	const pulse = $derived(reduced ? 0.5 : wave(t, 2.4));

	// the right-hand panel
	const PX = 682;
	const PW = 254;
	// 'cold': the CO₂ at which aragonite reaches Ω = 1, against temperature
	const csx = scale([T_MIN, T_MAX], [PX + 56, PX + PW - 14]);
	const csy = scale([0, 3000], [500, 250]);
	const crossCurve: { T: number; ppm: number }[] = [];
	for (let x = T_MIN; x <= T_MAX + 0.01; x += 1.6)
		crossCurve.push({ T: x, ppm: ppmAtOmega(1, waterAt(x)) });
	const ppmText = (v: number) => (Number.isFinite(v) ? fmtPpm(v) : 'never');
</script>

<g>
	<!-- undersaturated zone -->
	<rect x={X0} y={sy(1)} width={X1 - X0} height={Y1 - sy(1)} fill={C.under} opacity="0.16" />
	<Axes
		{sx}
		{sy}
		xTicks={[280, 400, 600, 800, 1000, 1200]}
		yTicks={[0, 1, 2, 3, 4, 5]}
		xLabel="CO₂ in the air (ppm)"
		yLabel="aragonite saturation Ω"
	/>
	<line x1={X0} x2={X1} y1={sy(1)} y2={sy(1)} stroke={C.acidText} stroke-width="1.5" />
	<Readout id="omega1" order={9} label="Red zone" value="Ω below 1: bare aragonite dissolves">
		<Label
			x={X0 + 10}
			y={sy(1) - 8}
			anchor="start"
			text="Ω = 1"
			size={12}
			weight={700}
			color={C.acidText}
		/>
		<Label
			x={X0 + 10}
			y={sy(0.45)}
			anchor="start"
			text="undersaturated: bare aragonite dissolves"
			size={12}
			color={C.acidText}
		/>
	</Readout>

	{#each ghosts as g (g.T)}
		<path
			d={linePath(
				g.pts,
				(p) => p.ppm,
				(p) => p.ar,
				sx,
				sy
			)}
			fill="none"
			stroke={tempColor(g.T)}
			stroke-width="1.5"
			opacity={focus === 'cold' ? 0.75 : 0.4}
		/>
		<Readout id="ghost-{g.T}">
			<Label
				x={X1 + 6}
				y={sy(g.pts[g.pts.length - 1].ar) + 4}
				anchor="start"
				text={fmtT(g.T).replace('.0', '')}
				size={11}
				muted
			/>
		</Readout>
	{/each}
	<path
		d={linePath(
			pts,
			(p) => p.ppm,
			(p) => p.ca,
			sx,
			sy
		)}
		fill="none"
		stroke={C.calcite}
		stroke-width="2"
		stroke-dasharray="7 5"
	/>
	<path
		d={linePath(
			pts,
			(p) => p.ppm,
			(p) => p.ar,
			sx,
			sy
		)}
		fill="none"
		stroke={color}
		stroke-width="3.5"
	/>
	<Readout id="key" order={8} label="Bold / dashed" value="aragonite / calcite at {fmtT(T)}">
		<line x1={X0 + 300} x2={X0 + 326} y1={Y0 + 10} y2={Y0 + 10} stroke={color} stroke-width="3.5" />
		<Label x={X0 + 332} y={Y0 + 14} anchor="start" text="aragonite, {fmtT(T)}" size={12} />
		<line
			x1={X0 + 300}
			x2={X0 + 326}
			y1={Y0 + 32}
			y2={Y0 + 32}
			stroke={C.calcite}
			stroke-width="2"
			stroke-dasharray="7 5"
		/>
		<Label
			x={X0 + 332}
			y={Y0 + 36}
			anchor="start"
			text="calcite, {fmtT(T)}"
			size={12}
			color={C.calciteText}
		/>
	</Readout>

	{#if cross <= PPM_MAX}
		<line
			x1={sx(cross)}
			x2={sx(cross)}
			y1={sy(1)}
			y2={Y1}
			stroke={C.acidText}
			stroke-dasharray="4 4"
		/>
		<circle cx={sx(cross)} cy={sy(1)} r="5" fill={C.acidText} />
	{/if}

	<circle
		cx={sx(ppm)}
		cy={sy(s.omegaAr)}
		r={14 + 4 * pulse}
		fill={under ? C.under : color}
		opacity="0.18"
	/>
	<PpmHandle {sx} y={sy(s.omegaAr)} {ppm} {setParam} color={under ? C.acidText : undefined} />

	<!-- the panel -->
	<rect
		x={PX}
		y={Y0 - 4}
		width={PW}
		height={Y1 - Y0 + 108}
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="water"
		order={1}
		label="This water"
		value="{fmtPpm(ppm)}, {fmtT(T)}: Ω aragonite {s.omegaAr.toFixed(2)}, calcite {s.omegaCa.toFixed(
			2
		)}"
		{color}
	>
		<Label
			x={PX + 18}
			y={Y0 + 22}
			anchor="start"
			text="{fmtPpm(ppm)} · {fmtT(T)}"
			size={13}
			muted
			tabular
		/>
		<Label
			x={PX + 18}
			y={Y0 + 54}
			anchor="start"
			text="Ω aragonite {s.omegaAr.toFixed(2)}"
			size={18}
			weight={700}
			tabular
			color={under ? C.acidText : undefined}
		/>
		<Label
			x={PX + 18}
			y={Y0 + 80}
			anchor="start"
			text="Ω calcite {s.omegaCa.toFixed(2)}"
			size={13}
			tabular
			color={C.calciteText}
		/>
	</Readout>
	<Readout id="cross" order={2} label="Ω aragonite = 1 at" value={ppmText(cross)}>
		<Label
			x={PX + 18}
			y={Y0 + 110}
			anchor="start"
			text="aragonite Ω = 1 at {ppmText(cross)}"
			size={13}
			weight={600}
			tabular
			color={C.acidText}
		/>
		<Label
			x={PX + 18}
			y={Y0 + 132}
			anchor="start"
			text="calcite Ω = 1 at {ppmText(crossCa)}"
			size={12}
			tabular
			muted
		/>
	</Readout>
	{#if focus === 'omega'}
		<Label
			x={PX + 18}
			y={Y0 + 184}
			anchor="start"
			text="Ω = [Ca²⁺] × [CO₃²⁻] ÷ Ksp"
			size={14}
			weight={700}
		/>
		<Readout
			id="omega"
			order={3}
			label="Ω aragonite"
			value="{(s.k.Ca * 1000).toFixed(1)} mmol/kg × {Math.round(s.co3)} µmol/kg ÷ {(
				s.k.Kar * 1e7
			).toFixed(2)} × 10⁻⁷"
		>
			<Label
				x={PX + 18}
				y={Y0 + 216}
				anchor="start"
				text="[Ca²⁺] = {(s.k.Ca * 1000).toFixed(1)} mmol/kg (steady)"
				size={12}
				tabular
			/>
			<Label
				x={PX + 18}
				y={Y0 + 240}
				anchor="start"
				text="[CO₃²⁻] = {Math.round(s.co3)} µmol/kg (falls)"
				size={12}
				tabular
				color={C.co3Text}
			/>
			<Label
				x={PX + 18}
				y={Y0 + 264}
				anchor="start"
				text="Ksp aragonite = {(s.k.Kar * 1e7).toFixed(2)} × 10⁻⁷"
				size={12}
				tabular
			/>
			<Label
				x={PX + 18}
				y={Y0 + 288}
				anchor="start"
				text="Ksp calcite = {(s.k.Kcal * 1e7).toFixed(2)} × 10⁻⁷"
				size={12}
				tabular
				muted
			/>
		</Readout>
		<Readout id="omega-note">
			<Label
				x={PX + 18}
				y={Y0 + 330}
				anchor="start"
				text="Only carbonate ion changes much:"
				size={12}
				muted
			/>
			<Label
				x={PX + 18}
				y={Y0 + 348}
				anchor="start"
				text="Ω follows it, down with the CO₂."
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Readout id="cold-title">
			<Label
				x={PX + 18}
				y={Y0 + 172}
				anchor="start"
				text="CO₂ at which aragonite Ω = 1"
				size={13}
				weight={700}
			/>
		</Readout>
		<Axes
			sx={csx}
			sy={csy}
			xTicks={[0, 10, 20, 30]}
			yTicks={[0, 1000, 2000, 3000]}
			yFormat={(v) => (v === 0 ? '0' : `${v / 1000}k`)}
			xLabel="°C"
		/>
		<path
			d={linePath(
				crossCurve,
				(p) => p.T,
				(p) => p.ppm,
				csx,
				csy
			)}
			fill="none"
			stroke={C.acidText}
			stroke-width="2.5"
		/>
		<line
			x1={csx(T_MIN)}
			x2={csx(T_MAX)}
			y1={csy(1200)}
			y2={csy(1200)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
		/>
		<Readout id="cold-1200">
			<Label
				x={csx(T_MAX)}
				y={csy(1200) - 6}
				anchor="end"
				text="slider's top, 1,200"
				size={11}
				muted
			/>
		</Readout>
		{#if Number.isFinite(cross)}
			<circle
				cx={csx(T)}
				cy={csy(Math.min(3000, cross))}
				r="6"
				fill={color}
				stroke="var(--surface)"
				stroke-width="2"
			/>
		{/if}
	{/if}
</g>
