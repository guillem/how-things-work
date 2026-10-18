<script lang="ts">
	/**
	 * Moving the planet outward: for each distance from today's Sun, the open balance the
	 * thermostat finds (CO₂ on a log scale above, temperature below) with volcanoes `zoneVolc` ×
	 * today's, and where none exists. Along the top, the Sun and the planet, which the reader can
	 * drag (the `au` control); the edge where the balance gives out is marked. With volcanoes
	 * other than today's, today's curves stay as faint references.
	 */
	import { Axes, Handle, Label, clamp, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { celsiusText, co2Text, openEquilibrium, outerEdge, sunlightAt, toC } from '../model';

	let { params, setParam }: StageProps = $props();

	const AU0 = 0.95;
	const AU1 = 1.3;
	const au = $derived(Number(params.au ?? 1.1));
	const volc = $derived(Number(params.zoneVolc ?? 1));

	const X0 = 110;
	const X1 = 720;
	const sx = scale([AU0, AU1], [X0, X1]);
	const sc = scale([1, 6], [330, 170]);
	const st = scale([-5, 35], [530, 390]);
	const lg = Math.log10;

	type Pt = { au: number; ppm: number; k: number };
	/** The balance along the distance axis, in pieces split wherever none exists. */
	const curveFor = (v: number) => {
		const pieces: Pt[][] = [];
		let cur: Pt[] = [];
		for (let i = 0; i <= 70; i++) {
			const d = AU0 + ((AU1 - AU0) * i) / 70;
			const eq = openEquilibrium(sunlightAt(d), v);
			if (eq) cur.push({ au: d, ...eq });
			else if (cur.length) {
				pieces.push(cur);
				cur = [];
			}
		}
		if (cur.length) pieces.push(cur);
		return pieces;
	};
	const edgeFor = (v: number) => outerEdge(v, AU0, AU1);
	const today = curveFor(1);
	const todayEdge = edgeFor(1);
	const pts = $derived(volc === 1 ? today : curveFor(volc));
	const edge = $derived(volc === 1 ? todayEdge : edgeFor(volc));
	const co2Path = (pieces: Pt[][]) =>
		pieces
			.map((p) =>
				linePath(
					p,
					(q) => q.au,
					(q) => clamp(lg(q.ppm), 1, 6),
					sx,
					sc
				)
			)
			.join(' ');
	const tPath = (pieces: Pt[][]) =>
		pieces
			.map((p) =>
				linePath(
					p,
					(q) => q.au,
					(q) => toC(q.k),
					sx,
					st
				)
			)
			.join(' ');
	const here = $derived(openEquilibrium(sunlightAt(au), volc));

	// ---- the strip with the Sun and the planet
	const SY = 92;
	function move(p: { x: number; y: number }) {
		const v = clamp(sx.invert(p.x), AU0, AU1);
		setParam('au', Math.round(v * 100) / 100);
	}
	function key(step: number | 'start' | 'end') {
		const v = step === 'start' ? AU0 : step === 'end' ? AU1 : clamp(au + step * 0.01, AU0, AU1);
		setParam('au', Math.round(v * 100) / 100);
	}
	const fmtPpm = (v: number) =>
		v >= 1e6 ? '1 bar' : v >= 1e4 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`;
	const edgeText = $derived(
		edge === null
			? 'none anywhere'
			: edge >= AU1
				? `beyond ${AU1}`
				: `${edge.toFixed(2)} × Earth’s distance`
	);
</script>

<g>
	<Readout id="title">
		<Label
			x={X0}
			y={40}
			text="The thermostat’s balance as the planet moves away from the Sun"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- the Sun and the orbit strip -->
	<circle cx={52} cy={SY} r={26} fill="var(--cst-sun)" />
	<line x1={X0} x2={X1} y1={SY} y2={SY} stroke="var(--stage-line)" stroke-dasharray="3 4" />
	{#if edge !== null && edge < AU1}
		<rect x={sx(edge)} y={150} width={X1 - sx(edge)} height={380} fill="var(--cst-frozen)" />
		<line
			x1={sx(edge)}
			x2={sx(edge)}
			y1={SY + 14}
			y2={530}
			stroke="var(--cst-ice-edge)"
			stroke-width="2"
		/>
		<Readout
			id="edge"
			order={4}
			label="Outer edge (this box)"
			value={edgeText}
			color="var(--cst-ice-edge)"
		>
			<Label
				x={sx(edge) + 8}
				y={164}
				text="no balance: the ice wins"
				anchor="start"
				size={12}
				weight={600}
				color="var(--cst-ice-edge)"
			/>
		</Readout>
	{:else if edge === null}
		<rect x={X0} y={150} width={X1 - X0} height={380} fill="var(--cst-frozen)" />
		<Readout
			id="edge"
			order={4}
			label="Outer edge"
			value={volc === 0 ? 'none: without volcanoes there is no balance' : 'none in this range'}
		>
			<Label
				x={(X0 + X1) / 2}
				y={250}
				text={volc === 0 ? 'no volcanoes: no balance anywhere' : 'no balance in this range'}
				size={14}
				weight={700}
				color="var(--cst-ice-edge)"
			/>
		</Readout>
	{/if}
	<Label x={sx(1)} y={SY - 22} text="Earth" size={11} muted />
	<line x1={sx(1)} x2={sx(1)} y1={SY - 14} y2={SY - 6} stroke="var(--stage-ink-muted)" />
	<Handle
		x={sx(au)}
		y={SY}
		label="Distance from the Sun"
		value={au}
		min={AU0}
		max={AU1}
		valuetext="{au.toFixed(2)} times Earth's distance"
		color={here ? 'var(--cst-ocean)' : 'var(--cst-ice)'}
		r={13}
		onmove={move}
		onkey={key}
	/>

	<!-- CO₂ -->
	<Axes
		{sx}
		sy={sc}
		xTicks={[]}
		yTicks={[1, 2, 3, 4, 5, 6]}
		yFormat={(v: number) => fmtPpm(10 ** v)}
		yLabel="CO₂, µbar (ppm)"
	/>
	{#if volc !== 1}
		<path
			d={co2Path(today)}
			fill="none"
			stroke="var(--cst-co2)"
			stroke-width="1.5"
			opacity="0.35"
		/>
	{/if}
	<path d={co2Path(pts)} fill="none" stroke="var(--cst-co2)" stroke-width="2.5" />

	<!-- temperature -->
	<Axes
		{sx}
		sy={st}
		xLabel="distance, × Earth’s"
		xTicks={[1, 1.1, 1.2, 1.3]}
		xFormat={(v: number) => v.toFixed(1)}
		yLabel="°C"
		yTicks={[0, 10, 20, 30]}
	/>
	<line x1={X0} x2={X1} y1={st(0)} y2={st(0)} stroke="var(--cst-ice-edge)" stroke-dasharray="2 3" />
	{#if volc !== 1}
		<path d={tPath(today)} fill="none" stroke="var(--cst-temp)" stroke-width="1.5" opacity="0.35" />
	{/if}
	<path d={tPath(pts)} fill="none" stroke="var(--cst-temp)" stroke-width="2.5" />

	<line
		x1={sx(au)}
		x2={sx(au)}
		y1={SY + 16}
		y2={530}
		stroke="var(--stage-ink-muted)"
		opacity="0.5"
	/>
	{#if here}
		<circle
			cx={sx(au)}
			cy={sc(clamp(lg(here.ppm), 1, 6))}
			r="5.5"
			fill="var(--cst-co2)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
		<circle
			cx={sx(au)}
			cy={st(toC(here.k))}
			r="5.5"
			fill="var(--cst-temp)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/if}

	<g>
		<Readout
			id="where"
			order={1}
			label="Distance"
			value="{au.toFixed(2)} × Earth’s, sunlight {Math.round(sunlightAt(au) * 100)} %"
		>
			<Label
				x={748}
				y={186}
				text="{au.toFixed(2)} × Earth’s distance"
				anchor="start"
				size={14}
				weight={700}
				tabular
			/>
			<Label
				x={748}
				y={208}
				text="sunlight {Math.round(sunlightAt(au) * 100)} % of Earth’s"
				anchor="start"
				size={12}
				muted
				tabular
			/>
		</Readout>
		<Readout
			id="bal"
			order={2}
			label="Balance"
			value={here ? `${co2Text(here.ppm)}, ${celsiusText(here.k)}` : 'none: the planet freezes'}
		>
			<Label x={748} y={250} text="balance:" anchor="start" size={12} muted />
			<Label
				x={748}
				y={272}
				text={here ? co2Text(here.ppm) : 'none'}
				anchor="start"
				weight={700}
				color="var(--cst-co2)"
				tabular
			/>
			<Label
				x={748}
				y={294}
				text={here ? celsiusText(here.k) : 'the planet freezes'}
				anchor="start"
				weight={700}
				color={here ? 'var(--cst-temp)' : 'var(--cst-ice-edge)'}
				tabular
			/>
		</Readout>
		<Readout
			id="volc"
			order={3}
			label="Volcanoes"
			value={volc === 0 ? 'off' : `${volc.toFixed(1)} × today’s`}
		>
			<Label
				x={748}
				y={336}
				text="volcanoes {volc === 0 ? 'off' : `${volc.toFixed(1)} × today’s`}"
				anchor="start"
				size={12}
				weight={600}
				color="var(--cst-volc)"
			/>
			{#if edge !== null}
				<Label x={748} y={356} text="edge: {edgeText}" anchor="start" size={12} muted />
			{/if}
		</Readout>
		{#if todayEdge !== null && volc !== 1}
			<Readout id="ref">
				<Label
					x={748}
					y={380}
					text="faint lines: today’s volcanoes"
					anchor="start"
					size={11}
					muted
				/>
			</Readout>
		{/if}
	</g>
</g>
