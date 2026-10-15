<script lang="ts">
	/**
	 * Lift against angle of attack. Left: a 12% symmetric Joukowski section at the chosen
	 * angle in ideal flow (schematic separated wake past the stall), its lift arrow and its
	 * measured drag along the stream (drawn ten times the lift scale), with a card that
	 * depends on the phase: the three slopes (slope), the lift equation for a Cessna 172's
	 * 16.2 m² wing at the chosen speed and altitude (equation), the measured lift and drag
	 * (stall). Right: C_L against α for thin-airfoil theory (2πα), the exact ideal flow
	 * round the section, and Ladson's NACA 0012 measurements (three runs; the 80-grit run
	 * joined by a line), with a marker at the chosen angle. Reduced motion: t = 2.5 s.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import {
		DEG,
		THIN_SLOPE,
		liftCoefficient,
		measuredDrag,
		measuredLift,
		measuredSlope,
		section,
		toWind
	} from '../aero.ts';
	import { LADSON } from '../naca0012.ts';
	import { C172, FT, KT, WEIGHT, density, dynamicPressure, lift } from '../plane.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import Title from './Title.svelte';
	import Wing from './Wing.svelte';
	import { STALL_ANGLE, field } from './field.ts';
	import { deg, fmtForce, fmtPa, signed } from './fmt.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'slope'));
	const time = $derived(reduced ? 2.5 : t);
	const aDeg = $derived(Number(params.angle ?? 5));
	const speedKt = $derived(Number(params.speed ?? 100));
	const altFt = $derived(Number(params.altitude ?? 0));

	const OFFS = [0.12, 0.5, 0.95, 1.4, 1.85, 2.3].flatMap((d) => [d, -d]);
	const fld = $derived(field(0.12, 0, aDeg * DEG, OFFS));
	const sym = section(0.12, 0);
	const idealSlope = (liftCoefficient(sym, 1 * DEG) - liftCoefficient(sym, -1 * DEG)) / 2;
	const dataSlope = measuredSlope();

	const clMeasured = $derived(measuredLift(aDeg));
	const cdMeasured = $derived(measuredDrag(aDeg));
	const clIdeal = $derived(liftCoefficient(sym, aDeg * DEG));
	const clThin = $derived(THIN_SLOPE * aDeg * DEG);
	const stalled = $derived(fld.stall > 0.5);

	// lift equation
	const rho = $derived(density(altFt * FT));
	const q = $derived(dynamicPressure(rho, speedKt * KT));
	const L = $derived(lift(rho, speedKt * KT, C172.area, clMeasured));

	// ---- plot ---------------------------------------------------------------------------
	const PX0 = 470;
	const PX1 = 920;
	const PY0 = 70;
	const PY1 = 520;
	const sx = scale([-6, 20], [PX0, PX1]);
	const sy = scale([-0.8, 2.4], [PY1, PY0]);
	const angles = Array.from({ length: 53 }, (_, i) => -6 + i * 0.5);
	const thinPath = linePath(
		angles,
		(a) => a,
		(a) => THIN_SLOPE * a * DEG,
		sx,
		sy
	);
	const idealPath = linePath(
		angles,
		(a) => a,
		(a) => liftCoefficient(sym, a * DEG),
		sx,
		sy
	);
	const runPath = linePath(
		LADSON[0].rows,
		(r) => r[0],
		(r) => r[1],
		sx,
		sy
	);
	const points = LADSON.flatMap((run, k) =>
		run.rows.map((r, i) => ({ key: `${k}:${i}`, x: sx(r[0]), y: sy(r[1]), k }))
	);
	const stallX = sx(STALL_ANGLE / DEG);

	// the quarter-chord point, where the lift acts, on screen
	const qc = $derived.by(() => {
		const le = toWind(fld.f, fld.sec.le);
		const te = toWind(fld.f, fld.sec.te);
		return [236 + 44 * (0.75 * le[0] + 0.25 * te[0]), 186 - 44 * (0.75 * le[1] + 0.25 * te[1])];
	});

	const clipLeft = { x: 16, y: 16, w: 424, h: 330 };
</script>

<g>
	<rect
		x="16"
		y="16"
		width="424"
		height="330"
		rx="14"
		fill="var(--fl-tunnel)"
		stroke="var(--border)"
	/>
	<Wing
		{fld}
		id="lift"
		cx={236}
		cy={186}
		s={44}
		clip={clipLeft}
		t={time}
		rate={0.9 * (speedKt / 100)}
		parcelR={2.2}
		streamOpacity={0.7}
	/>
	<line
		x1={qc[0]}
		y1={qc[1]}
		x2={qc[0]}
		y2={qc[1] - 70 * clMeasured}
		stroke="var(--fl-lift)"
		stroke-width="3.5"
		marker-end="url(#arrowhead)"
		opacity={Math.abs(clMeasured) > 0.05 ? 1 : 0}
	/>
	<!-- measured drag, along the stream, ten times the scale of the lift arrow -->
	<line
		x1={qc[0]}
		y1={qc[1]}
		x2={qc[0] + 10 * 70 * cdMeasured}
		y2={qc[1]}
		stroke="var(--fl-drag)"
		stroke-width="3.5"
		marker-end="url(#arrowhead)"
	/>
	<Readout id="wing-cap">
		<Label
			anchor="start"
			x={32}
			y={40}
			text="NACA 0012-like section, {deg(aDeg)} · drag (orange) drawn 10× longer"
			size={12.5}
			weight={650}
		/>
		<Label
			anchor="start"
			x={32}
			y={334}
			text={stalled ? 'separated flow: drawn schematically' : 'ideal flow, attached'}
			size={11.5}
			muted
		/>
	</Readout>

	<!-- the card under the wing -->
	<Card x={16} y={360} w={424} h={224} />
	{#if phase === 'slope'}
		<Title x={32} y={388} text="Lift coefficient at {deg(aDeg)}" size={14} />
		<Row
			id="thin"
			order={1}
			x={32}
			y={416}
			w={392}
			label="Thin-airfoil theory, 2πα"
			value={signed(clThin)}
			color="var(--fl-theory)"
		/>
		<Row
			id="ideal"
			order={2}
			x={32}
			y={442}
			w={392}
			label="Ideal flow, 12% thick"
			value={signed(clIdeal)}
			color="var(--fl-ideal)"
		/>
		<Row
			id="meas"
			order={3}
			x={32}
			y={468}
			w={392}
			label="Measured, NACA 0012"
			value={signed(clMeasured)}
			color="var(--fl-data)"
		/>
		<Row
			id="meas-cd"
			order={4}
			x={32}
			y={494}
			w={392}
			label="Measured drag coefficient"
			value={cdMeasured.toFixed(4)}
			color="var(--fl-drag)"
		/>
		<Readout id="slopes">
			<Label
				anchor="start"
				x={32}
				y={530}
				text="slopes per degree: theory {(THIN_SLOPE * DEG).toFixed(3)} · ideal {idealSlope.toFixed(
					3
				)} · measured {dataSlope.toFixed(3)}"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={32}
				y={550}
				text="2π per radian = 0.110 per degree"
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'equation'}
		<Title x={32} y={388} text="Lift = ½ρV² × S × C for a 172’s wing" size={14} />
		<Row
			id="q"
			order={1}
			x={32}
			y={416}
			w={392}
			label="½ρV² at {altFt.toLocaleString('en-GB')} ft, {speedKt} kt"
			value={fmtPa(q)}
		/>
		<Row
			id="cl"
			order={2}
			x={32}
			y={442}
			w={392}
			label="C, lift coefficient (measured, {deg(aDeg)})"
			value={signed(clMeasured)}
			color="var(--fl-data)"
		/>
		<Row
			id="L"
			order={3}
			x={32}
			y={468}
			w={392}
			label="Lift on S = 16.2 m²"
			value={fmtForce(L)}
			color="var(--fl-lift)"
		/>
		<Row
			id="W"
			order={4}
			x={32}
			y={494}
			w={392}
			label="Weight of a 172 at full load"
			value={fmtForce(WEIGHT)}
			color="var(--fl-weight)"
		/>
		<Readout id="eq-cap">
			<Label
				anchor="start"
				x={32}
				y={530}
				text="air density {rho.toFixed(3)} kg/m³ ({((rho / 1.225) * 100).toFixed(0)}% of sea level)"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={32}
				y={550}
				text={L >= WEIGHT
					? 'enough to carry the plane (if the whole wing lifted like this section)'
					: `${((L / WEIGHT) * 100).toFixed(0)}% of the weight (if the whole wing lifted like this section)`}
				size={12}
				muted
			/>
		</Readout>
	{:else}
		<Title x={32} y={388} text="Measured, NACA 0012 at {deg(aDeg)}" size={14} />
		<Row
			id="cls"
			order={1}
			x={32}
			y={416}
			w={392}
			label="Lift coefficient"
			value={signed(clMeasured)}
			color="var(--fl-data)"
		/>
		<Row
			id="cds"
			order={2}
			x={32}
			y={442}
			w={392}
			label="Drag coefficient"
			value={cdMeasured.toFixed(4)}
			color="var(--fl-drag)"
		/>
		<Row
			id="state"
			order={3}
			x={32}
			y={468}
			w={392}
			label="Flow over the top"
			value={stalled ? 'separated: stalled' : 'attached'}
			color={stalled ? 'var(--fl-stall)' : undefined}
		/>
		<Readout id="stall-cap">
			<Label
				anchor="start"
				x={32}
				y={506}
				text="most lift: C = 1.61 at 17.1° (80-grit run)"
				size={12}
				muted
			/>
			<Label
				anchor="start"
				x={32}
				y={526}
				text="Reynolds number 6 million, NASA Langley, 1988"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- the plot -->
	<rect
		x="456"
		y="16"
		width="488"
		height="568"
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Title x={472} y={44} text="Lift coefficient against angle of attack" size={14} />
	<Axes
		{sx}
		{sy}
		xLabel="angle of attack, degrees"
		yLabel="lift coefficient C"
		xTicks={[-5, 0, 5, 10, 15, 20]}
		yTicks={[-0.5, 0, 0.5, 1, 1.5, 2]}
		xFormat={(v: number) => `${v < 0 ? '−' : ''}${Math.abs(v)}`}
		yFormat={(v: number) => `${v < 0 ? '−' : ''}${Math.abs(v)}`}
	/>
	<line x1={sx(0)} y1={PY0} x2={sx(0)} y2={PY1} stroke="var(--stage-line)" stroke-dasharray="2 4" />
	<line x1={PX0} y1={sy(0)} x2={PX1} y2={sy(0)} stroke="var(--stage-line)" stroke-dasharray="2 4" />

	{#if phase === 'stall'}
		<rect
			x={stallX}
			y={PY0}
			width={PX1 - stallX}
			height={PY1 - PY0}
			fill="var(--fl-stall)"
			fill-opacity="0.07"
		/>
		<Readout id="stall-zone">
			<Label
				anchor="start"
				x={stallX + 6}
				y={PY1 - 10}
				text="stalled"
				size={12}
				weight={650}
				color="var(--fl-stall)"
			/>
		</Readout>
	{/if}

	<path
		d={thinPath}
		fill="none"
		stroke="var(--fl-theory)"
		stroke-width="1.6"
		stroke-dasharray="6 5"
	/>
	<path d={idealPath} fill="none" stroke="var(--fl-ideal)" stroke-width="2" />
	<path d={runPath} fill="none" stroke="var(--fl-data)" stroke-width="1.6" opacity="0.8" />
	{#each points as p (p.key)}
		<circle
			cx={p.x}
			cy={p.y}
			r={p.k === 0 ? 3.6 : 2.6}
			fill="var(--fl-data)"
			opacity={p.k === 0 ? 1 : 0.55}
		/>
	{/each}

	<!-- the chosen angle -->
	<line
		x1={sx(aDeg)}
		y1={PY0}
		x2={sx(aDeg)}
		y2={PY1}
		stroke="var(--stage-ink)"
		stroke-width="1"
		opacity="0.5"
	/>
	<circle
		cx={sx(aDeg)}
		cy={sy(clMeasured)}
		r="6"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>

	<!-- key -->
	<Readout id="key-thin">
		<line
			x1={480}
			y1={78}
			x2={504}
			y2={78}
			stroke="var(--fl-theory)"
			stroke-width="1.6"
			stroke-dasharray="6 5"
		/>
		<Label anchor="start" x={512} y={82} text="2πα, thin-airfoil theory" size={12} />
	</Readout>
	<Readout id="key-ideal">
		<line x1={480} y1={98} x2={504} y2={98} stroke="var(--fl-ideal)" stroke-width="2" />
		<Label anchor="start" x={512} y={102} text="ideal flow, 12% symmetric section" size={12} />
	</Readout>
	<Readout id="key-data">
		<circle cx={492} cy={118} r="3.6" fill="var(--fl-data)" />
		<Label anchor="start" x={512} y={122} text="measured, NACA 0012 (Ladson, NASA)" size={12} />
	</Readout>
</g>
