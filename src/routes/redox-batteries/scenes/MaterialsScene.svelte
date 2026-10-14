<script lang="ts">
	/**
	 * Choosing electrodes. Left: every material's potential against lithium metal (V vs
	 * Li/Li⁺) across a cell's state of charge, from the published fits in `electrodes.ts`;
	 * the chosen cathode (`params.cathode`) and anode (`params.anode`) are drawn bold and
	 * the gap between them, the cell voltage, is shaded.
	 * Right, by focus (`hints.focus`):
	 *   voltage  — the pair's voltage (empty, full, average) and the average voltage of all
	 *              nine pairings, the chosen one highlighted;
	 *   capacity — Faraday's law for each electrode (mAh/g), the grams of each needed per
	 *              amp-hour as a stacked bar, and the energy per kg of active material of
	 *              all nine pairings.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Axes, Label, areaPath, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ANODES, CATHODES, material, potentialAt, type Material } from '../electrodes';
	import { pairFigures, theoreticalCapacity, usableCapacity, voltageCurve } from '../model';
	import { fmtV } from '../look';

	let { step, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'voltage'));
	const cathode = $derived(material(String(params.cathode ?? 'nmc'), 'cathode'));
	const anode = $derived(material(String(params.anode ?? 'graphite'), 'anode'));
	const fig = $derived(pairFigures(cathode, anode));

	// ---- the potential plot -------------------------------------------------------------------
	const PX0 = 96;
	const PX1 = 540;
	const PY0 = 76;
	const PY1 = 520;
	const sx = scale([0, 100], [PX0, PX1]);
	const sy = scale([0, 4.6], [PY1, PY0]);
	const N = 80;
	const curveOf = (m: Material) =>
		Array.from({ length: N + 1 }, (_, i) => ({ s: (i / N) * 100, u: potentialAt(m, i / N) }));
	const curves = new Map([...CATHODES, ...ANODES].map((m) => [m.id, curveOf(m)]));
	const pair = $derived(voltageCurve(cathode, anode, N));
	const gapPath = $derived(
		areaPath(
			pair,
			(d) => d.soc * 100,
			(d) => d.anode,
			(d) => d.cathode,
			sx,
			sy
		)
	);
	const mid = $derived(pair[N / 2]);
	const colorOf = (m: Material) => (m.side === 'cathode' ? 'var(--rb-cathode)' : 'var(--rb-anode)');
	// Where each curve's name sits: at the right end (full), nudged apart.
	const endLabels = $derived.by(() => {
		const ms = [...CATHODES, ...ANODES];
		const ys = ms.map((m) => ({ m, y: sy(potentialAt(m, 1)) }));
		// From the bottom up, at least 15 apart, the lowest clear of the x axis.
		ys.sort((a, b) => b.y - a.y);
		ys[0].y = Math.min(ys[0].y, sy(0) - 8);
		for (let i = 1; i < ys.length; i++) ys[i].y = Math.min(ys[i].y, ys[i - 1].y - 15);
		return ys;
	});

	// ---- the panel ----------------------------------------------------------------------------------
	const QX = 610;
	const QX1 = 935;
	const pairs = CATHODES.flatMap((c) => ANODES.map((a) => ({ c, a, f: pairFigures(c, a) })));
	const shortName = (m: Material) =>
		({
			nmc: 'NMC',
			lco: 'LiCoO₂',
			lfp: 'LiFePO₄',
			graphite: 'graphite',
			silicon: 'silicon',
			limetal: 'Li metal'
		})[m.id] ?? m.name;
	const maxV = 4.2;
	const maxE = 700;
	const barX = QX + 150;
	const barW = QX1 - barX - 50;
	const opts = { duration: 700, easing: cubicInOut };
	const gc = Tween.of(() => fig.gCathode, opts);
	const ga = Tween.of(() => fig.gAnode, opts);
	const gC = $derived(reduced ? fig.gCathode : gc.current);
	const gA = $derived(reduced ? fig.gAnode : ga.current);
	const gScale = 320 / 12; // units per gram: 12 g fills the panel
	const fmtG = (g: number) => `${g < 1 ? g.toFixed(2) : g.toFixed(1)} g`;
	const faraday = (m: Material) =>
		`${Math.round(theoreticalCapacity(m))} mAh/g if full, a cell uses ${Math.round(usableCapacity(m))}`;
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- the plot of potentials -->
	<Axes
		{sx}
		{sy}
		xLabel="state of charge of the cell (%)"
		yLabel="potential vs lithium metal (V)"
		xTicks={[0, 25, 50, 75, 100]}
		yTicks={[0, 1, 2, 3, 4]}
	/>
	<path d={gapPath} fill="var(--rb-gap)" opacity="0.22" />
	{#each [...CATHODES, ...ANODES] as m (m.id)}
		{@const chosen = m.id === cathode.id || m.id === anode.id}
		<path
			d={linePath(
				curves.get(m.id) ?? [],
				(d) => d.s,
				(d) => d.u,
				sx,
				sy
			)}
			fill="none"
			stroke={colorOf(m)}
			stroke-width={chosen ? 3.5 : 1.5}
			opacity={chosen ? 1 : 0.4}
			stroke-dasharray={chosen ? undefined : '5 4'}
		/>
	{/each}
	{#each endLabels as l (l.m.id)}
		{@const chosen = l.m.id === cathode.id || l.m.id === anode.id}
		<text
			x={PX1 + 8}
			y={l.y + 4}
			style:font-size="12px"
			font-weight={chosen ? 700 : 400}
			style:fill={chosen ? colorOf(l.m) : undefined}
			class:muted={!chosen}>{shortName(l.m)}</text
		>
	{/each}
	<!-- the gap at half charge -->
	<line
		x1={sx(50)}
		x2={sx(50)}
		y1={sy(mid.anode) - 4}
		y2={sy(mid.cathode) + 4}
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-start="url(#arrowhead)"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="gap" order={1} label="Gap at half charge = cell voltage" value={fmtV(mid.v, 2)}>
		<Label
			x={sx(50) + 10}
			y={(sy(mid.anode) + sy(mid.cathode)) / 2}
			text="gap = cell voltage: {fmtV(mid.v, 2)}"
			size={13}
			weight={600}
			anchor="start"
		/>
	</Readout>
	<Readout id="scale">
		<Label
			x={PX0 + 8}
			y={sy(4.45)}
			text="0 V = lithium metal (≈ −3.04 V vs hydrogen)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	{#if focus === 'voltage'}
		<Readout
			id="v"
			order={2}
			label="Cell voltage, 10 % → 90 % charge"
			value="{fmtV(fig.v10, 2)} → {fmtV(fig.v90, 2)}"
		>
			<text x={QX} y={PY0} style:font-size="12px" class="muted">average cell voltage</text>
			<text x={QX} y={PY0 + 30} style:font-size="28px" font-weight="700">{fmtV(fig.meanV, 2)}</text>
			<text x={QX} y={PY0 + 54} style:font-size="12px" class="muted"
				>{fmtV(fig.v10, 2)} at 10 % → {fmtV(fig.v90, 2)} at 90 %</text
			>
		</Readout>
		<Readout id="list">
			<text x={QX} y={PY0 + 104} style:font-size="12px" font-weight="600"
				>all nine pairings: average voltage</text
			>
			{#each pairs as p, i (p.c.id + p.a.id)}
				{@const on = p.c.id === cathode.id && p.a.id === anode.id}
				{@const y = PY0 + 132 + i * 28}
				<text
					x={barX - 8}
					y={y + 4}
					text-anchor="end"
					style:font-size="11px"
					font-weight={on ? 700 : 400}
					class:muted={!on}>{shortName(p.c)} / {shortName(p.a)}</text
				>
				<rect
					x={barX}
					y={y - 8}
					width={(p.f.meanV / maxV) * barW}
					height="16"
					rx="3"
					fill="var(--rb-gap)"
					opacity={on ? 0.95 : 0.35}
				/>
				<text
					x={barX + (p.f.meanV / maxV) * barW + 6}
					y={y + 4}
					style:font-size="11px"
					font-weight={on ? 700 : 400}>{p.f.meanV.toFixed(2)}</text
				>
			{/each}
		</Readout>
	{:else}
		<Readout
			id="perah"
			order={2}
			label="To hold 1 Ah"
			value="{fmtG(gC)} of {shortName(cathode)} + {fmtG(gA)} of {shortName(anode)}"
		>
			<text x={QX} y={PY0} style:font-size="12px" font-weight="600">grams needed to hold 1 Ah</text>
			<rect x={QX} y={PY0 + 12} width={gC * gScale} height="22" rx="3" fill="var(--rb-cathode)" />
			<rect
				x={QX + gC * gScale}
				y={PY0 + 12}
				width={gA * gScale}
				height="22"
				rx="3"
				fill="var(--rb-anode)"
			/>
			<text
				x={QX}
				y={PY0 + 52}
				style:font-size="12px"
				style:fill="var(--rb-cathode)"
				font-weight="600">{shortName(cathode)}: {fmtG(gC)}</text
			>
			<text x={QX1} y={PY0 + 52} text-anchor="end" style:font-size="12px" font-weight="600"
				>{shortName(anode)}: {fmtG(gA)}</text
			>
		</Readout>
		<Readout
			id="far"
			order={3}
			label="Faraday: 96 485 C per mole of Li"
			value="{shortName(cathode)} {Math.round(fig.qCathode)} mAh/g · {shortName(anode)} {Math.round(
				fig.qAnode
			)} mAh/g"
		>
			<text x={QX} y={PY0 + 84} style:font-size="11px" class="muted"
				>Faraday: 96 485 C per mole of lithium</text
			>
			<text x={QX} y={PY0 + 104} style:font-size="11px"
				>{shortName(cathode)}: {faraday(cathode)}</text
			>
			<text x={QX} y={PY0 + 122} style:font-size="11px">{shortName(anode)}: {faraday(anode)}</text>
		</Readout>
		<Readout
			id="e"
			order={4}
			label="Energy per kg of the two materials"
			value="{Math.round(fig.specificEnergy)} Wh/kg"
		>
			<text x={QX} y={PY0 + 156} style:font-size="12px" class="muted"
				>energy per kg of the two materials</text
			>
			<text x={QX} y={PY0 + 184} style:font-size="24px" font-weight="700"
				>{Math.round(fig.specificEnergy)} Wh/kg</text
			>
		</Readout>
		<Readout id="elist">
			<text x={QX} y={PY0 + 222} style:font-size="12px" font-weight="600"
				>all nine pairings (Wh/kg)</text
			>
			{#each pairs as p, i (p.c.id + p.a.id)}
				{@const on = p.c.id === cathode.id && p.a.id === anode.id}
				{@const y = PY0 + 246 + i * 24}
				<text
					x={barX - 8}
					y={y + 4}
					text-anchor="end"
					style:font-size="11px"
					font-weight={on ? 700 : 400}
					class:muted={!on}>{shortName(p.c)} / {shortName(p.a)}</text
				>
				<rect
					x={barX}
					y={y - 7}
					width={(p.f.specificEnergy / maxE) * barW}
					height="14"
					rx="3"
					fill="var(--rb-gap)"
					opacity={on ? 0.95 : 0.35}
				/>
				<text
					x={barX + (p.f.specificEnergy / maxE) * barW + 6}
					y={y + 4}
					style:font-size="11px"
					font-weight={on ? 700 : 400}>{Math.round(p.f.specificEnergy)}</text
				>
			{/each}
		</Readout>
	{/if}
</g>
