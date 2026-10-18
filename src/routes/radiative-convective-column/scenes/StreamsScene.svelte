<script lang="ts">
	/**
	 * The two streams of the band against altitude (left: U up, D down, in W/m², solved for the
	 * reader's column) and a sketch of the column (right): sunlight through to the ground, the
	 * window straight from the ground to space, and the two streams at four heights, each arrow as
	 * wide as its flux, dashes marching in its direction.
	 */
	import { Axes, Flow, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { absorbedSolar } from '../model';
	import { C, fmtW, settingsOf, solve } from './shared';

	let { step, t, params, reduced }: StageProps = $props();

	const s = $derived(settingsOf(params, step));
	const now = $derived(solve(s));
	const tt = $derived(reduced ? 0 : t);

	const Z_MAX = 40;
	const Y0 = 494;
	const Y1 = 100;
	const sy = scale([0, Z_MAX], [Y0, Y1]);
	const sx = scale([0, 500], [96, 520]);

	/** Interface altitudes (the top one is at infinity: put it at the chart top). */
	const zh = $derived(now.d.zh.map((z) => Math.min(z, 60)));
	const series = $derived(
		now.d.up.map((u, k) => ({ z: zh[k], u, d: now.d.down[k] })).filter((p) => p.z <= Z_MAX + 1)
	);
	const at = (zKm: number) => {
		// interpolate the interface fluxes at altitude z
		const k = zh.findIndex((z) => z >= zKm);
		if (k <= 0) return { u: now.d.up[0], d: now.d.down[0] };
		const w = (zKm - zh[k - 1]) / (zh[k] - zh[k - 1]);
		return {
			u: now.d.up[k - 1] + w * (now.d.up[k] - now.d.up[k - 1]),
			d: now.d.down[k - 1] + w * (now.d.down[k] - now.d.down[k - 1])
		};
	};
	const top = $derived(at(Z_MAX));
	const levels = $derived([1, 8, 18, 32].map((z) => ({ z, ...at(z) })));
	const solar = absorbedSolar();
	const width = (f: number) => 1 + (f / 500) * 14;
</script>

<g>
	<Axes
		{sx}
		{sy}
		xTicks={[0, 100, 200, 300, 400, 500]}
		yTicks={[0, 10, 20, 30, 40]}
		xLabel="infrared flux in the band (W/m²)"
		yLabel="altitude (km)"
	/>
	<path
		d={linePath(
			series,
			(p) => Math.min(500, p.u),
			(p) => p.z,
			sx,
			sy
		)}
		fill="none"
		stroke={C.ir}
		stroke-width="3"
	/>
	<path
		d={linePath(
			series,
			(p) => Math.min(500, p.d),
			(p) => p.z,
			sx,
			sy
		)}
		fill="none"
		stroke={C.down}
		stroke-width="3"
	/>
	<Readout id="u" order={1} label="U at the top" value={fmtW(top.u)} color={C.ir}>
		<Label
			x={sx(Math.min(480, top.u)) + 8}
			y={sy(Z_MAX - 3)}
			anchor="start"
			text="U, up · {fmtW(top.u)} at the top"
			size={12}
			weight={600}
			color={C.irText}
			tabular
		/>
	</Readout>
	<Readout id="d" order={2} label="D at the ground" value={fmtW(now.d.down[0])} color={C.down}>
		<Label
			x={sx(Math.min(460, now.d.down[0])) + 10}
			y={sy(1.2)}
			anchor="start"
			text="D, down · {fmtW(now.d.down[0])}"
			size={12}
			weight={600}
			color={C.downText}
			tabular
		/>
	</Readout>
	<Readout id="d0">
		<Label
			x={sx(6)}
			y={sy(Z_MAX - 3)}
			anchor="start"
			text="D = 0 at the top"
			size={11}
			color={C.downText}
		/>
	</Readout>

	<!-- ---------------------------------------------------------------- sketch -->
	<rect
		x="620"
		y={Y1 - 4}
		width="300"
		height={Y0 - Y1 + 4}
		rx="10"
		fill={C.sky}
		stroke="var(--border)"
	/>
	<rect x="620" y={Y0} width="300" height="18" rx="4" fill={C.ground} />
	<Readout id="space"><Label x={770} y={Y1 - 14} text="to space" size={12} muted /></Readout>
	<Readout id="groundname"><Label x={770} y={Y0 + 34} text="ground" size={12} muted /></Readout>

	<!-- sunlight, straight through -->
	<Flow
		d="M650 {Y1 + 4} L650 {Y0 - 4}"
		color={C.sun}
		width={width(solar)}
		dash={10}
		t={tt}
		speed={40}
	/>
	<Readout id="sun" order={3} label="Sunlight absorbed" value={fmtW(solar)} color={C.sun}>
		<Label
			x={666}
			y={Y1 + 24}
			anchor="start"
			text="sunlight {fmtW(solar)}"
			size={12}
			weight={600}
			color={C.sunText}
			tabular
		/>
	</Readout>

	<!-- window, straight out -->
	{#if s.window > 0}
		<Flow
			d="M890 {Y0 - 4} L890 {Y1 + 4}"
			color={C.window}
			width={width(now.d.olrWindow)}
			dash={8}
			t={tt}
			speed={40}
		/>
		<Readout id="win" order={4} label="Window" value={fmtW(now.d.olrWindow)} color={C.window}>
			<Label
				x={876}
				y={Y0 - 30}
				anchor="end"
				text="window {fmtW(now.d.olrWindow)}"
				size={12}
				weight={600}
				color={C.windowText}
				tabular
			/>
		</Readout>
	{/if}

	{#each levels as l (l.z)}
		<Flow
			d="M736 {sy(l.z) + 16} L736 {sy(l.z) - 16}"
			color={C.ir}
			width={width(l.u)}
			dash={6}
			t={tt}
			speed={24}
		/>
		<Flow
			d="M800 {sy(l.z) - 16} L800 {sy(l.z) + 16}"
			color={C.down}
			width={width(l.d)}
			dash={6}
			t={tt}
			speed={24}
		/>
		<Readout id="lvl-{l.z}">
			<Label
				x={724}
				y={sy(l.z) + 4}
				anchor="end"
				text="↑{Math.round(l.u)}"
				size={11}
				color={C.irText}
				tabular
			/>
			<Label
				x={812}
				y={sy(l.z) + 4}
				anchor="start"
				text="↓{Math.round(l.d)}"
				size={11}
				color={C.downText}
				tabular
			/>
		</Readout>
	{/each}

	<Readout id="balance" order={5} label="Out at the top" value="{fmtW(now.d.olr)} = sunlight in">
		<Label
			x={96}
			y={36}
			anchor="start"
			text="out at the top: band {fmtW(now.d.olrBand)} + window {fmtW(now.d.olrWindow)} = {fmtW(
				now.d.olr
			)}"
			size={15}
			weight={700}
			tabular
		/>
		<Label
			x={96}
			y={56}
			anchor="start"
			text="τ∞ = {s.tau.toFixed(1)} · the same as the {fmtW(solar)} of sunlight absorbed"
			size={12}
			muted
			tabular
		/>
	</Readout>
</g>
