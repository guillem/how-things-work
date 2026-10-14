<script lang="ts">
	/**
	 * The wind tunnel: a wing section (Joukowski, exact ideal flow) with the air arriving
	 * from the left. Streamlines and parcels throughout; per phase: lift arrow (wing),
	 * upwash and downwash (turning), pressure map and surface arrows (pressure), timelines
	 * of parcels released together (transit), the shape's numbers (shape), all together
	 * (summary). Past the stall angle the wake is drawn schematically. Parcels move at
	 * 0.9 model units (a quarter chord) per second at 100 kt; reduced motion: t = 2.5 s.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import { Readout } from '#lib/explainer/index.ts';
	import { DEG, timeToReach, toWind, trailingFlowAngle, velocity, zeroLiftAngle } from '../aero.ts';
	import { CHORD, KT, RHO0, dynamicPressure } from '../plane.ts';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';
	import Title from './Title.svelte';
	import Wing from './Wing.svelte';
	import { BANDS, field } from './field.ts';
	import { deg, fmtForce, fmtPa, signed } from './fmt.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'wing'));
	const time = $derived(reduced ? 2.5 : t);
	const alpha = $derived(Number(params.angle ?? 5) * DEG);
	const camber = $derived(Number(params.camber ?? 2) / 100);
	const thick = $derived(Number(params.thickness ?? 12) / 100);
	const speedKt = $derived(Number(params.speed ?? 100));
	const v = $derived(speedKt * KT);

	const fld = $derived(field(thick, camber, alpha));
	const f = $derived(fld.f);

	const CX = 500;
	const CY = 318;
	const S = 96;
	const clip = { x: 16, y: 16, w: 928, h: 568 };
	const X = (x: number) => CX + S * x;
	const Y = (y: number) => CY - S * y;

	const showPressure = $derived(['pressure', 'shape', 'summary'].includes(phase));
	const pressureStrength = $derived(phase === 'pressure' ? 1 : 0.7);

	// lift, drawn from the quarter-chord point, across the stream
	const le = $derived(toWind(f, fld.sec.le));
	const te = $derived(toWind(f, fld.sec.te));
	const quarter = $derived([le[0] + 0.25 * (te[0] - le[0]), le[1] + 0.25 * (te[1] - le[1])]);
	const liftLen = $derived(Math.max(-120, Math.min(170, 78 * f.cl * (1 - 0.45 * fld.stall))));
	const liftPerMetre = $derived(dynamicPressure(RHO0, v) * CHORD * f.cl);

	// upwash ahead of the nose, downwash behind the tail: the local direction of the air
	const probe = (x: number, y: number) => {
		const u = velocity(f, [x, y]);
		const a = Math.atan2(u[1], u[0]);
		return { x: X(x), y: Y(y), a };
	};
	const upwash = $derived(probe(le[0] - 0.75, le[1] + 0.55));
	const downwash = $derived(probe(te[0] + 0.55, te[1] - 0.05));
	const leaveAngle = $derived(trailingFlowAngle(f) / DEG);

	// transit: the close pair (ψ offsets ±0.12) from leading-edge x to trailing-edge x
	const unit = $derived(CHORD / fld.sec.chord / v); // seconds per model time unit
	const transitTimes = $derived.by(() => {
		const [top, bottom] = fld.streams;
		const tt = (st: typeof top) => timeToReach(st, te[0]) - timeToReach(st, le[0]);
		return { top: tt(top) * unit * 1000, bottom: tt(bottom) * unit * 1000 };
	});

	const lowest = $derived(Math.min(...fld.surface.map((p) => p.cp)));
	const highest = $derived(Math.max(...fld.surface.map((p) => p.cp)));
	const q = $derived(dynamicPressure(RHO0, v));

	const stalled = $derived(fld.stall > 0.5);
	// how much slower than life the parcels move: model units of 1/4 chord ≈ 0.37 m
	const slowdown = $derived(
		Math.round(v / (0.9 * (speedKt / 100) * (CHORD / fld.sec.chord)) / 10) * 10
	);

	const legendX = 650;
	const legendY = 530;
</script>

<g>
	<rect
		x="16"
		y="16"
		width="928"
		height="568"
		rx="14"
		fill="var(--fl-tunnel)"
		stroke="var(--border)"
	/>

	<Wing
		{fld}
		id="flow"
		cx={CX}
		cy={CY}
		s={S}
		{clip}
		t={time}
		rate={0.9 * (speedKt / 100)}
		period={phase === 'transit' ? 1.6 : 1}
		pressure={showPressure}
		arrows={phase === 'pressure'}
		timelines={phase === 'transit'}
		streamOpacity={phase === 'transit' ? 0.45 : showPressure ? 0.55 * pressureStrength + 0.2 : 0.75}
		parcelR={phase === 'transit' ? 3.2 : 2.6}
	/>

	<Readout id="air-in">
		<Card x={28} y={274} w={86} h={36} />
		<T x={40} y={290} text="air, {speedKt} kt" size={12} muted />
	</Readout>
	<!-- incoming air -->
	<line
		x1="40"
		y1="300"
		x2="96"
		y2="300"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
		marker-end="url(#arrowhead)"
	/>

	<!-- lift -->
	{#if phase !== 'transit'}
		<line
			x1={X(quarter[0])}
			y1={Y(quarter[1])}
			x2={X(quarter[0])}
			y2={Y(quarter[1]) - liftLen}
			stroke="var(--fl-lift)"
			stroke-width="4"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="lift-label">
			<T
				x={X(quarter[0]) + 10}
				y={Y(quarter[1]) - liftLen + (liftLen >= 0 ? 12 : -4)}
				text={stalled ? 'lift (stalled)' : 'lift'}
				size={13}
				weight={700}
				color="var(--fl-lift)"
			/>
		</Readout>
	{/if}

	{#if phase === 'turning' || phase === 'summary'}
		{#each [{ k: 'up', p: upwash, text: 'upwash', dy: -12 }, { k: 'down', p: downwash, text: phase === 'summary' ? 'downwash' : `downwash: leaves ${deg(-leaveAngle, 0)} down`, dy: 26 }] as w (w.k)}
			<line
				x1={w.p.x - 34 * Math.cos(w.p.a)}
				y1={w.p.y + 34 * Math.sin(w.p.a)}
				x2={w.p.x + 34 * Math.cos(w.p.a)}
				y2={w.p.y - 34 * Math.sin(w.p.a)}
				stroke="var(--stage-ink)"
				stroke-width="2.5"
				marker-end="url(#arrowhead)"
			/>
			<Readout id="wash-{w.k}">
				<T x={w.p.x - 30} y={w.p.y + w.dy} text={w.text} size={12.5} weight={650} />
			</Readout>
		{/each}
	{/if}

	{#if showPressure}
		<g opacity={pressureStrength}>
			<Readout id="legend" label="Colours" value="blue: lower pressure · red: higher">
				<Card x={legendX - 14} y={legendY - 30} w={292} h={70} />
				<T
					x={legendX}
					y={legendY - 10}
					text="pressure, compared with the air far away"
					size={12}
					muted
				/>
				{#each BANDS as b, i (i)}
					<rect
						x={legendX + i * 24}
						y={legendY}
						width="24"
						height="12"
						fill={b[3] ? 'var(--fl-low)' : 'var(--fl-high)'}
						fill-opacity={b[2]}
					/>
					{#if i === 6}
						<rect
							x={legendX + 7 * 24 - 0.5}
							y={legendY}
							width="1"
							height="12"
							fill="var(--stage-ink-muted)"
						/>
					{/if}
				{/each}
				<T x={legendX} y={legendY + 28} text="lower" size={12} muted />
				<T x={legendX + 7 * 24} y={legendY + 28} text="same" size={12} anchor="middle" muted />
				<T x={legendX + 11 * 24} y={legendY + 28} text="higher" size={12} anchor="end" muted />
			</Readout>
		</g>
	{/if}

	<!-- readouts -->
	<Card x={28} y={28} w={300} h={phase === 'wing' || phase === 'summary' ? 112 : 136} />
	<Title x={44} y={54} text="Ideal flow round the wing" size={14} />
	<Row
		id="angle"
		order={1}
		x={44}
		y={80}
		w={268}
		label="Angle of attack"
		value={deg(alpha / DEG)}
	/>
	{#if stalled}
		<Row
			id="cl"
			order={2}
			x={44}
			y={104}
			w={268}
			label="Lift"
			value="stalled: see the stall step"
			color="var(--fl-stall)"
		/>
	{:else}
		<Row
			id="cl"
			order={2}
			x={44}
			y={104}
			w={268}
			label="Lift coefficient (ideal)"
			value={signed(f.cl)}
			color="var(--fl-lift)"
		/>
	{/if}
	{#if phase === 'wing' || phase === 'summary'}
		<Row
			id="lift"
			order={3}
			x={44}
			y={128}
			w={268}
			label="Lift per metre of a 172’s wing"
			value={stalled ? '—' : fmtForce(liftPerMetre)}
			opacity={1}
		/>
	{:else if phase === 'turning'}
		<Row
			id="leave"
			order={3}
			x={44}
			y={128}
			w={268}
			label="Air leaves the trailing edge"
			value="{deg(Math.abs(leaveAngle))} {leaveAngle <= 0 ? 'down' : 'up'}"
		/>
	{:else if phase === 'pressure'}
		<Row
			id="low"
			order={3}
			x={44}
			y={128}
			w={268}
			label="Lowest pressure, top"
			value={fmtPa(lowest * q)}
			color="var(--fl-low)"
		/>
		<Readout id="cap-p">
			<T
				x={44}
				y={160}
				text="(below the air far away, at {speedKt} kt; ½ρV² = {fmtPa(q)})"
				size={11.5}
				muted
			/>
		</Readout>
	{:else if phase === 'transit'}
		<Row
			id="top"
			order={3}
			x={44}
			y={128}
			w={268}
			label="Leading to trailing edge, top"
			value="{transitTimes.top.toFixed(1)} ms"
			color="var(--fl-top)"
		/>
		<Row
			id="bottom"
			order={4}
			x={44}
			y={152}
			w={268}
			label="Underneath"
			value="{transitTimes.bottom.toFixed(1)} ms"
			color="var(--fl-bottom)"
		/>
	{:else if phase === 'shape'}
		<Row
			id="zero"
			order={3}
			x={44}
			y={128}
			w={268}
			label="Zero-lift angle"
			value={deg(zeroLiftAngle(fld.sec) / DEG)}
		/>
	{/if}

	{#if phase === 'transit'}
		<Readout id="cap-t">
			<T x={44} y={190} text="lines: parcels released at the same instant" size={12} muted />
			<T x={44} y={208} text="the top ones never meet their partners again" size={12} muted />
		</Readout>
	{/if}

	{#if phase === 'shape'}
		<Readout id="cap-s">
			<T
				x={44}
				y={164}
				text="{(fld.sec.camber * 100).toFixed(1)}% camber · {(fld.sec.thickness * 100).toFixed(
					0
				)}% thick (Joukowski section)"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<Readout id="cap-model">
		<Card x={28} y={552} w={470} h={24} />
		<T
			x={40}
			y={570}
			text="ideal (inviscid) flow, exact for this shape · air drawn {slowdown} times slower than life"
			size={11.5}
			muted
		/>
	</Readout>
	{#if phase === 'pressure' && !stalled}
		<Readout id="cap-high">
			<T
				x={X(le[0]) - 12}
				y={Y(le[1]) + 34}
				text="highest: Cₚ = {signed(highest)}"
				size={11.5}
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
</g>
