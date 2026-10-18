<script lang="ts">
	/**
	 * The Bjerrum plot of seawater at the chosen temperature: the shares of dissolved CO₂,
	 * bicarbonate and carbonate against pH, the crossings at pK₁ and pK₂, the band of surface-ocean
	 * pH over the slider's range of CO₂, and the water's own pH marked (with the pre-industrial pH as
	 * a ghost). Nothing moves but the marker's soft pulse.
	 */
	import { Axes, Label, linePath, scale, wave } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { fractions, fromAir, PPM_PREINDUSTRIAL } from '../model';
	import { C, PPM_MAX, PPM_MIN, fmtPpm, fmtT, pct, ppmOf, tempOf, waterAt } from './shared';

	let { t, params, reduced }: StageProps = $props();

	const ppm = $derived(ppmOf(params));
	const T = $derived(tempOf(params));
	const water = $derived(waterAt(T));
	const s = $derived(fromAir(ppm, water));
	const s0 = $derived(fromAir(PPM_PREINDUSTRIAL, water));
	const band = $derived([fromAir(PPM_MAX, water).pH, fromAir(PPM_MIN, water).pH]);
	const k = $derived(s.k);
	const pK1 = $derived(-Math.log10(k.K1));
	const pK2 = $derived(-Math.log10(k.K2));

	const X0 = 96;
	const X1 = 650;
	const Y0 = 70;
	const Y1 = 470;
	const CX = 670;
	const CY = 90;
	const sx = scale([4, 11], [X0, X1]);
	const sy = scale([0, 1], [Y1, Y0]);

	const curve = $derived.by(() => {
		const pts: { pH: number; co2: number; hco3: number; co3: number }[] = [];
		for (let pH = 4; pH <= 11.0001; pH += 0.05) pts.push({ pH, ...fractions(pH, k) });
		return pts;
	});
	const series = $derived([
		{
			id: 'co2',
			name: 'CO₂',
			color: C.co2,
			text: C.co2Text,
			d: linePath(
				curve,
				(p) => p.pH,
				(p) => p.co2,
				sx,
				sy
			),
			lx: 4.4,
			ly: 0.93
		},
		{
			id: 'hco3',
			name: 'HCO₃⁻',
			color: C.hco3,
			text: C.hco3Text,
			d: linePath(
				curve,
				(p) => p.pH,
				(p) => p.hco3,
				sx,
				sy
			),
			lx: 6.6,
			ly: 0.97
		},
		{
			id: 'co3',
			name: 'CO₃²⁻',
			color: C.co3,
			text: C.co3Text,
			d: linePath(
				curve,
				(p) => p.pH,
				(p) => p.co3,
				sx,
				sy
			),
			lx: 10.6,
			ly: 0.93
		}
	]);
	const f = $derived(fractions(s.pH, k));
	const f0 = $derived(fractions(s0.pH, k));
	const pulse = $derived(reduced ? 0.5 : wave(t, 2.4));
	const mx = $derived(sx(s.pH));

	// the inset: carbonate's share over the surface ocean's range of pH, magnified
	const zx = scale([7.5, 8.3], [CX + 44, CX + 252]);
	const zy = scale([0, 0.15], [500, 330]);
	const zoom = $derived(curve.filter((p) => p.pH >= 7.49 && p.pH <= 8.31));
</script>

<g>
	<!-- the band the surface ocean's pH spans over 280–1,200 ppm -->
	<rect
		x={sx(band[0])}
		y={Y0}
		width={sx(band[1]) - sx(band[0])}
		height={Y1 - Y0}
		fill={C.ph}
		opacity="0.12"
	/>
	<Readout id="band">
		<Label
			x={(sx(band[0]) + sx(band[1])) / 2}
			y={Y0 - 10}
			text="surface ocean, 280 to 1,200 ppm"
			size={11}
			muted
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xLabel="pH"
		yLabel="share of dissolved carbon"
		yFormat={(v) => `${Math.round(v * 100)}%`}
		xTicks={[4, 5, 6, 7, 8, 9, 10, 11]}
		yTicks={[0, 0.25, 0.5, 0.75, 1]}
	/>

	<!-- pK1 and pK2 -->
	{#each [{ id: 'pk1', v: pK1, name: 'pK₁' }, { id: 'pk2', v: pK2, name: 'pK₂' }] as p (p.id)}
		<line
			x1={sx(p.v)}
			x2={sx(p.v)}
			y1={sy(0.5)}
			y2={Y1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
		/>
		<Readout id={p.id} order={5} label={p.name} value={p.v.toFixed(2)}>
			<Label x={sx(p.v)} y={Y1 - 12} text="{p.name} = {p.v.toFixed(2)}" size={12} muted tabular />
		</Readout>
	{/each}

	{#each series as c (c.id)}
		<path d={c.d} fill="none" stroke={c.color} stroke-width="3" stroke-linejoin="round" />
		<Readout id="name-{c.id}">
			<Label x={sx(c.lx)} y={sy(c.ly)} text={c.name} size={15} weight={700} color={c.text} />
		</Readout>
	{/each}

	<!-- the pre-industrial pH (ghost) and today's -->
	<line
		x1={sx(s0.pH)}
		x2={sx(s0.pH)}
		y1={Y0 + 6}
		y2={Y1}
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
		stroke-dasharray="5 4"
	/>
	<line x1={mx} x2={mx} y1={Y0 + 6} y2={Y1} stroke={C.mark} stroke-width="2.5" />
	{#each [{ id: 'm-hco3', v: f.hco3, c: C.hco3 }, { id: 'm-co3', v: f.co3, c: C.co3 }, { id: 'm-co2', v: f.co2, c: C.co2 }] as m (m.id)}
		<circle
			cx={mx}
			cy={sy(m.v)}
			r={6 + 2 * pulse}
			fill={m.c}
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}

	<!-- the readout card -->
	<rect
		x={CX}
		y={CY}
		width="266"
		height="150"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout
		id="water"
		order={1}
		label="Water"
		value="{fmtPpm(ppm)} CO₂, {fmtT(T)}: pH {s.pH.toFixed(2)}"
		color={C.mark}
	>
		<Label
			x={CX + 16}
			y={CY + 28}
			anchor="start"
			text="{fmtPpm(ppm)} · {fmtT(T)}"
			size={13}
			muted
			tabular
		/>
		<Label
			x={CX + 16}
			y={CY + 58}
			anchor="start"
			text="pH {s.pH.toFixed(2)}"
			size={18}
			weight={700}
			color={C.markText}
			tabular
		/>
	</Readout>
	<Readout
		id="shares"
		order={2}
		label="Shares"
		value="HCO₃⁻ {pct(f.hco3)}, CO₃²⁻ {pct(f.co3)}, CO₂ {pct(f.co2)}"
	>
		<Label
			x={CX + 16}
			y={CY + 88}
			anchor="start"
			text="HCO₃⁻ {pct(f.hco3)} · CO₃²⁻ {pct(f.co3)} · CO₂ {pct(f.co2)}"
			size={12}
			tabular
		/>
	</Readout>
	<Readout
		id="then"
		order={3}
		label="At 280 ppm"
		value="pH {s0.pH.toFixed(2)}, CO₃²⁻ {pct(f0.co3)}"
	>
		<Label
			x={CX + 16}
			y={CY + 116}
			anchor="start"
			text="dashed: 280 ppm, pH {s0.pH.toFixed(2)}, CO₃²⁻ {pct(f0.co3)}"
			size={12}
			muted
			tabular
		/>
	</Readout>

	<!-- the inset -->
	<Readout id="zoom-title">
		<Label
			x={CX}
			y={306}
			anchor="start"
			text="carbonate's share, magnified"
			size={12}
			weight={600}
		/>
	</Readout>
	<Axes
		sx={zx}
		sy={zy}
		xTicks={[7.6, 7.8, 8, 8.2]}
		yTicks={[0, 0.05, 0.1, 0.15]}
		xFormat={(v: number) => v.toFixed(1)}
		yFormat={(v: number) => `${Math.round(v * 100)}%`}
		xLabel="pH"
	/>
	<path
		d={linePath(
			zoom,
			(p) => p.pH,
			(p) => p.co3,
			zx,
			zy
		)}
		fill="none"
		stroke={C.co3}
		stroke-width="2.5"
	/>
	{#if s0.pH <= 8.3}
		<circle
			cx={zx(s0.pH)}
			cy={zy(f0.co3)}
			r="4.5"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.5"
		/>
	{/if}
	{#if s.pH >= 7.5}
		<circle
			cx={zx(s.pH)}
			cy={zy(f.co3)}
			r="5.5"
			fill={C.co3}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}
</g>
