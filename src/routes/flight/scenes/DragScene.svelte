<script lang="ts">
	/**
	 * The Cessna 172S's drag in level flight at sea level and full weight, from the polar
	 * fitted to its handbook glide (plane.ts). View "speed": parasite, induced and total
	 * drag against true airspeed, with the stall and the least-drag speed marked and a
	 * marker at the chosen speed. View "polar": C_L against C_D for the aircraft, the
	 * tangent from the origin (best glide), and Ladson's NACA 0012 section drag for scale.
	 * A second card draws the best glide to scale, a dot gliding down it every 8 s;
	 * everything else is static. Reduced motion: t = 2.5 s.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { Axes, linePath, scale } from '#lib/draw/index.ts';
	import { LADSON } from '../naca0012.ts';
	import {
		CD0,
		CL_GLIDE,
		CL_MAX,
		C172,
		GLIDE_RATIO,
		KT,
		K_INDUCED,
		MIN_DRAG_SPEED,
		RHO0,
		WEIGHT,
		drag,
		dragCoefficient
	} from '../plane.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';
	import Title from './Title.svelte';
	import { fmtForce } from './fmt.ts';

	let { params, t, reduced }: StageProps = $props();

	const speedKt = $derived(Number(params.speed ?? 100));
	const polar = $derived(params.view === 'polar');
	const d = $derived(drag(RHO0, speedKt * KT));
	const stalled = $derived(speedKt < C172.stallKcas);

	const PX0 = 80;
	const PX1 = 600;
	const PY0 = 80;
	const PY1 = 510;

	// drag against speed
	const sx = scale([45, 125], [PX0, PX1]);
	const sy = scale([0, 3000], [PY1, PY0]);
	const speeds = Array.from({ length: 81 }, (_, i) => 45 + i);
	const ok = speeds.filter((v) => v >= C172.stallKcas);
	const at = (v: number) => drag(RHO0, v * KT);
	const parasitePath = linePath(
		ok,
		(v) => v,
		(v) => at(v).parasite,
		sx,
		sy
	);
	const inducedPath = linePath(
		ok,
		(v) => v,
		(v) => at(v).induced,
		sx,
		sy
	);
	const totalPath = linePath(
		ok,
		(v) => v,
		(v) => at(v).total,
		sx,
		sy
	);
	const vmd = MIN_DRAG_SPEED / KT;
	const dmin = at(vmd).total;

	// the polar
	const px = scale([0, 0.2], [PX0, PX1]);
	const py = scale([0, 1.8], [PY1, PY0]);
	const cls = Array.from({ length: 41 }, (_, i) => (CL_MAX * i) / 40);
	const polarPath = linePath(
		cls,
		(c) => dragCoefficient(c),
		(c) => c,
		px,
		py
	);
	const tangentEnd = 1.75;
	const section = LADSON[0].rows.filter((r) => r[1] >= 0 && r[0] < 17.5);
	const clNow = $derived(Math.min(d.cl, CL_MAX));

	// the glide card: 1000 ft of height against the distance flown, to scale
	const GX0 = 672;
	const GX1 = 924;
	const GY1 = 430;
	const GY0 = GY1 - (GX1 - GX0) / GLIDE_RATIO;
	const u = $derived(((reduced ? 2.5 : t) % 8) / 8);
	const glider = $derived([GX0 + (GX1 - GX0) * u, GY0 + (GY1 - GY0) * u]);
	const gliderFade = $derived(Math.min(1, u / 0.06, (1 - u) / 0.06));
</script>

<g>
	<rect
		x="16"
		y="16"
		width="616"
		height="568"
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if !polar}
		<Title x={32} y={44} text="Cessna 172S in level flight: drag against speed" size={14} />
		<Axes
			{sx}
			{sy}
			xLabel="true airspeed at sea level, knots"
			yLabel="drag, newtons"
			xTicks={[50, 60, 70, 80, 90, 100, 110, 120]}
			yTicks={[0, 500, 1000, 1500, 2000, 2500, 3000]}
		/>
		<rect
			x={PX0}
			y={PY0}
			width={sx(C172.stallKcas) - PX0}
			height={PY1 - PY0}
			fill="var(--fl-stall)"
			fill-opacity="0.08"
		/>
		<Readout id="stall-z">
			<T
				x={sx(C172.stallKcas) - 4}
				y={PY0 + 16}
				text="stall"
				size={12}
				anchor="end"
				weight={650}
				color="var(--fl-stall)"
			/>
		</Readout>
		<path
			d={parasitePath}
			fill="none"
			stroke="var(--fl-drag)"
			stroke-width="2"
			stroke-dasharray="7 5"
		/>
		<path
			d={inducedPath}
			fill="none"
			stroke="var(--fl-weight)"
			stroke-width="2"
			stroke-dasharray="2 4"
		/>
		<path d={totalPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.6" />
		<Readout id="k-par">
			<T
				x={sx(118)}
				y={sy(at(118).parasite) - 10}
				text="parasite"
				size={12.5}
				weight={650}
				anchor="end"
				color="var(--fl-drag)"
			/>
		</Readout>
		<Readout id="k-ind">
			<T
				x={sx(66)}
				y={sy(at(66).induced) + 22}
				text="induced"
				size={12.5}
				weight={650}
				color="var(--fl-weight)"
			/>
		</Readout>
		<Readout id="k-tot">
			<T
				x={sx(118) + 4}
				y={sy(at(118).total) - 10}
				text="total"
				size={12.5}
				weight={700}
				anchor="end"
			/>
		</Readout>
		<!-- least drag -->
		<line
			x1={sx(vmd)}
			y1={sy(dmin)}
			x2={sx(vmd)}
			y2={PY1}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 4"
		/>
		<circle cx={sx(vmd)} cy={sy(dmin)} r="5" fill="var(--stage-ink)" />
		<Readout id="least" label="Least drag" value="{vmd.toFixed(0)} kt, {fmtForce(dmin)}">
			<T
				x={sx(vmd) + 8}
				y={sy(dmin) + 26}
				text="least drag: {vmd.toFixed(0)} kt"
				size={12.5}
				weight={650}
			/>
			<T x={sx(vmd) + 8} y={sy(dmin) + 42} text="best glide in the handbook" size={11.5} muted />
		</Readout>
		<!-- the chosen speed -->
		{#if !stalled}
			<line
				x1={sx(speedKt)}
				y1={PY0}
				x2={sx(speedKt)}
				y2={PY1}
				stroke="var(--fl-thrust)"
				stroke-width="1.2"
			/>
			<circle
				cx={sx(speedKt)}
				cy={sy(d.total)}
				r="6"
				fill="none"
				stroke="var(--fl-thrust)"
				stroke-width="2.2"
			/>
		{/if}
	{:else}
		<Title x={32} y={44} text="Drag polar: lift coefficient against drag coefficient" size={14} />
		<Axes
			sx={px}
			sy={py}
			xLabel="drag coefficient"
			yLabel="lift coefficient"
			xTicks={[0, 0.05, 0.1, 0.15, 0.2]}
			yTicks={[0, 0.5, 1, 1.5]}
			xFormat={(v) => v.toFixed(2)}
		/>
		<line
			x1={px(0)}
			y1={py(0)}
			x2={px(tangentEnd / GLIDE_RATIO)}
			y2={py(tangentEnd)}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="4 4"
		/>
		<path d={polarPath} fill="none" stroke="var(--stage-ink)" stroke-width="2.6" />
		<circle cx={px(dragCoefficient(CL_GLIDE))} cy={py(CL_GLIDE)} r="5" fill="var(--stage-ink)" />
		<Readout id="tangent" label="Best glide" value="L/D = {GLIDE_RATIO.toFixed(1)}">
			<T
				x={px(dragCoefficient(CL_GLIDE)) + 10}
				y={py(CL_GLIDE) + 18}
				text="best glide: lift/drag = {GLIDE_RATIO.toFixed(1)}"
				size={12.5}
				weight={650}
			/>
		</Readout>
		{#each section as r, i (i)}
			<circle cx={px(r[2])} cy={py(r[1])} r="3" fill="var(--fl-data)" />
		{/each}
		<Readout id="k-sec">
			<T
				x={px(0.03)}
				y={py(1.62) + 4}
				text="the wing section alone (NACA 0012, measured)"
				size={12}
				color="var(--fl-data)"
			/>
		</Readout>
		<Readout id="k-plane">
			<T
				x={px(dragCoefficient(1.3)) + 10}
				y={py(1.3) + 4}
				text="the whole aeroplane"
				size={12.5}
				weight={650}
			/>
		</Readout>
		<Readout id="k-cd0">
			<T x={px(CD0) + 6} y={py(0.06)} text="zero-lift drag {CD0.toFixed(3)}" size={11.5} muted />
		</Readout>
		{#if !stalled}
			<circle
				cx={px(dragCoefficient(clNow))}
				cy={py(clNow)}
				r="6"
				fill="none"
				stroke="var(--fl-thrust)"
				stroke-width="2.2"
			/>
		{/if}
	{/if}

	<!-- card -->
	<Card x={648} y={16} w={296} h={250} />
	<Title x={664} y={44} text="At {speedKt} kt, sea level" size={14} />
	{#if stalled}
		<Row
			id="st"
			order={1}
			x={664}
			y={74}
			w={264}
			label="Too slow"
			value="below the 53 kt stall"
			color="var(--fl-stall)"
		/>
	{:else}
		<Row
			id="par"
			order={1}
			x={664}
			y={74}
			w={264}
			label="Parasite drag"
			value={fmtForce(d.parasite)}
			color="var(--fl-drag)"
		/>
		<Row
			id="ind"
			order={2}
			x={664}
			y={100}
			w={264}
			label="Induced drag"
			value={fmtForce(d.induced)}
			color="var(--fl-weight)"
		/>
		<Row id="tot" order={3} x={664} y={126} w={264} label="Total drag" value={fmtForce(d.total)} />
		<Row
			id="ld"
			order={4}
			x={664}
			y={152}
			w={264}
			label="Lift ÷ drag"
			value={(WEIGHT / d.total).toFixed(1)}
		/>
	{/if}
	<Readout id="card-cap">
		<T
			x={664}
			y={190}
			text="full weight 1157 kg: lift = weight = {fmtForce(WEIGHT)}"
			size={11.5}
			muted
		/>
		<T x={664} y={208} text="polar fitted to the handbook’s glide:" size={11.5} muted />
		<T
			x={664}
			y={226}
			text="C(drag) = {CD0.toFixed(3)} + {K_INDUCED.toFixed(3)} × C(lift)²"
			size={11.5}
			muted
		/>
		<T x={664} y={244} text="(propeller windmilling, flaps up)" size={11.5} muted />
	</Readout>

	<!-- the glide, to scale -->
	<Card x={648} y={282} w={296} h={302} />
	<Title x={664} y={310} text="The best glide, to scale" size={14} />
	<line x1={GX0} y1={GY0} x2={GX1} y2={GY1} stroke="var(--stage-ink)" stroke-width="1.6" />
	<line x1={GX0} y1={GY1} x2={GX1} y2={GY1} stroke="var(--fl-ground)" stroke-width="4" />
	<line
		x1={GX0}
		y1={GY0}
		x2={GX0}
		y2={GY1}
		stroke="var(--stage-ink-muted)"
		stroke-dasharray="2 3"
	/>
	<circle cx={glider[0]} cy={glider[1]} r="4" fill="var(--fl-thrust)" opacity={gliderFade} />
	<Readout id="glide">
		<T x={GX0 + 6} y={GY0 - 8} text="1000 ft" size={12} />
		<T
			x={GX1}
			y={GY1 + 22}
			text="{C172.glideNmPer1000ft} nautical miles ({(
				(C172.glideNmPer1000ft * 1852) /
				1000
			).toFixed(2)} km)"
			size={12}
			anchor="end"
		/>
		<T
			x={664}
			y={486}
			text="every 1000 ft of height: {C172.glideNmPer1000ft} nm forward,"
			size={12}
			muted
		/>
		<T
			x={664}
			y={504}
			text="a glide ratio of {GLIDE_RATIO.toFixed(1)} = lift ÷ drag"
			size={12}
			muted
		/>
		<T
			x={664}
			y={530}
			text="at {C172.glideKias} knots indicated, propeller windmilling"
			size={12}
			muted
		/>
		<T x={664} y={548} text="(Cessna 172S handbook, Fig. 3-1)" size={12} muted />
	</Readout>
</g>
