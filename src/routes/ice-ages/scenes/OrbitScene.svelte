<script lang="ts">
	/**
	 * The three orbital cycles and the summer sunshine at 65° N they set.
	 * Left: the orbit seen from above the North Pole, to scale, with the Sun at
	 * one focus. The solstices and equinoxes stay put (the axis points the same
	 * way in space all year); the stretch and the closest point (perihelion)
	 * follow the controls. The Earth goes round once every 12 s at Kepler's
	 * speed, faster near the Sun. Right: the Earth at the June solstice seen
	 * side-on, its axis tilted towards the Sun, with the 65° N circle. Bottom
	 * right: the June-solstice daily-mean sunshine at 65° N on a gauge that
	 * shows its range over the last 800,000 years.
	 *
	 * Focus (`hints.focus`): tilt → the globe; ecc and peri → the orbit; all.
	 * A control that is not on the step keeps today's value.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Handle, Label, clamp, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		TODAY,
		distance,
		globalMean,
		orbitSeries,
		periForDay,
		perihelionDay,
		summerSunshine,
		type Orbit
	} from '../milankovitch';
	import { dateText } from '../steps';

	let { step, t, params, setParam, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'all'));
	const has = (id: string) => (step.controls ?? []).some((c) => c.id === id);

	const tilt = $derived(has('tilt') ? Number(params.tilt) : TODAY.tilt);
	const e = $derived(has('ecc') ? Number(params.ecc) : TODAY.e);
	const day = $derived(has('closest') ? Number(params.closest) : perihelionDay(TODAY));
	const orbit: Orbit = $derived({ e, tilt, peri: periForDay(day, e) });
	const sunshine = $derived(summerSunshine(orbit));
	const today = summerSunshine(TODAY);
	const PAST = orbitSeries(800, 0).map((p) => p.summer);
	const LOW = Math.min(...PAST);
	const HIGH = Math.max(...PAST);

	const dim = (on: boolean) => (on ? 1 : 0.45);
	const oOrbit = new Tween(1, { duration: 700, easing: cubicInOut });
	const oGlobe = new Tween(1, { duration: 700, easing: cubicInOut });
	$effect(() => {
		const f = focus;
		untrack(() => {
			oOrbit.set(dim(f !== 'tilt'));
			oGlobe.set(dim(f === 'tilt' || f === 'all'));
		});
	});

	// ------------------------------------------------------------ orbit (top view)
	const SX = 262;
	const SY = 290;
	const A = 175; // semi-major axis, px
	/** Screen angle (radians, counter-clockwise from +x) of heliocentric longitude L (degrees): June solstice on the right. */
	const screenAngle = (L: number) => ((L - 270) * Math.PI) / 180;
	const at = (L: number, r: number) => ({
		x: SX + r * Math.cos(screenAngle(L)),
		y: SY - r * Math.sin(screenAngle(L))
	});
	/** Earth's position at heliocentric longitude L (the Sun is seen at L + 180). */
	const earthAt = (o: Orbit, L: number) => at(L, A * distance(o, L + 180));
	const orbitPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= 120; i++) {
			const p = earthAt(orbit, i * 3);
			d += `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}
		return d + 'Z';
	});
	const peri = $derived(earthAt(orbit, orbit.peri));
	const aph = $derived(earthAt(orbit, orbit.peri + 180));
	const seasons = [
		{ L: 270, name: 'June solstice', dx: 12, dy: 4, anchor: 'start' as const },
		{ L: 90, name: 'December solstice', dx: 0, dy: 24, anchor: 'middle' as const },
		{ L: 180, name: 'March equinox', dx: 0, dy: 28, anchor: 'middle' as const },
		{ L: 0, name: 'September equinox', dx: 0, dy: -18, anchor: 'middle' as const }
	];

	// Earth running round once every 12 s, at Kepler's pace (mean anomaly uniform in time)
	const YEAR_S = 12;
	const runner = $derived.by(() => {
		const tt = reduced ? 0 : t;
		const M = (2 * Math.PI * tt) / YEAR_S + 2.2;
		let E = M;
		for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		const v =
			2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
		return earthAt(orbit, orbit.peri + (v * 180) / Math.PI);
	});

	function dragPeri(p: { x: number; y: number }) {
		const ang = (Math.atan2(SY - p.y, p.x - SX) * 180) / Math.PI;
		const L = ang + 270;
		const d = perihelionDay({ e: Math.max(e, 1e-4), tilt, peri: ((L % 360) + 360) % 360 });
		setParam('closest', Math.round(d) % 365);
	}
	/** The December label goes above or below its point, away from a nearby closest/furthest label. */
	const decDy = $derived.by(() => {
		const dec = earthAt(orbit, 90);
		const near = [peri, aph].find((q) => Math.hypot(q.x - dec.x, q.y - dec.y) < 60);
		return near && near.y >= dec.y - 2 ? -14 : 24;
	});
	const sep = $derived(((1 + e) / (1 - e)) ** 2 - 1);

	// ------------------------------------------------------------ globe (side view, June solstice)
	const GX = 726;
	const GY = 250;
	const R = 112;
	// north pole leans towards the Sun (on the left) by the tilt
	const tiltShown = Tween.of(() => tilt, { duration: 300 });
	const lean = $derived((tiltShown.current * Math.PI) / 180);
	const pole = $derived({ x: GX - R * Math.sin(lean), y: GY - R * Math.cos(lean) });
	const axisTip = $derived({
		x: GX - (R + 46) * Math.sin(lean),
		y: GY - (R + 46) * Math.cos(lean)
	});
	/** The 65° N circle seen edge-on: a segment perpendicular to the axis. */
	const lat65 = $derived.by(() => {
		const phi = (65 * Math.PI) / 180;
		const cx = GX - R * Math.sin(phi) * Math.sin(lean);
		const cy = GY - R * Math.sin(phi) * Math.cos(lean);
		const half = R * Math.cos(phi);
		const ux = Math.cos(lean);
		const uy = -Math.sin(lean);
		return {
			x1: cx - half * ux,
			y1: cy - half * uy,
			x2: cx + half * ux,
			y2: cy + half * uy,
			cx,
			cy
		};
	});
	const equator = $derived({
		x1: GX - R * Math.cos(lean),
		y1: GY + R * Math.sin(lean),
		x2: GX + R * Math.cos(lean),
		y2: GY - R * Math.sin(lean)
	});
	function dragTilt(p: { x: number; y: number }) {
		const ang = (Math.atan2(GX - p.x, GY - p.y) * 180) / Math.PI;
		setParam('tilt', Math.round(clamp(ang, 21.5, 25) * 20) / 20);
	}

	// ------------------------------------------------------------ gauge
	const GL = 560;
	const GR = 920;
	const gx = scale([400, 580], [GL, GR]);
	const GYY = 490;
	const signed = (v: number, d = 0) =>
		(v >= 0.5 * 10 ** -d ? '+' : v <= -0.5 * 10 ** -d ? '−' : '±') + Math.abs(v).toFixed(d);
	const globalNow = $derived(globalMean(orbit));
	const globalToday = globalMean(TODAY);
</script>

<g>
	<!-- ===================== orbit ===================== -->
	<g opacity={oOrbit.current}>
		<Readout id="orbit-title">
			<Label
				x={32}
				y={40}
				text="Earth's orbit from above, to scale"
				anchor="start"
				size={15}
				weight={700}
			/>
		</Readout>
		<path d={orbitPath} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
		<!-- the line of the solstices and equinoxes, fixed in space -->
		<line
			x1={SX - A - 22}
			x2={SX + A + 22}
			y1={SY}
			y2={SY}
			stroke="var(--stage-grid)"
			stroke-dasharray="3 4"
		/>
		<line
			x1={SX}
			x2={SX}
			y1={SY - A - 22}
			y2={SY + A + 22}
			stroke="var(--stage-grid)"
			stroke-dasharray="3 4"
		/>
		<circle cx={SX} cy={SY} r="20" fill="#f59f00" />
		<circle cx={SX} cy={SY} r="28" fill="#f59f00" opacity="0.18" />
		<Readout id="sun"><Label x={SX} y={SY + 46} text="Sun" size={12} weight={600} /></Readout>
		{#each seasons as s (s.L)}
			{@const p = earthAt(orbit, s.L)}
			<circle cx={p.x} cy={p.y} r="5" fill="var(--ia-temp)" opacity="0.7" />
			<Readout id="season-{s.L}">
				<Label
					x={p.x + s.dx}
					y={p.y + (s.L === 90 ? decDy : s.dy)}
					text={s.name}
					anchor={s.anchor}
					size={11}
					muted
				/>
			</Readout>
		{/each}
		<!-- the Earth running round -->
		<circle
			cx={runner.x}
			cy={runner.y}
			r="8"
			fill="var(--ia-temp)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
		{#if e > 0.0005}
			<line
				x1={aph.x}
				y1={aph.y}
				x2={peri.x}
				y2={peri.y}
				stroke="var(--ia-prec)"
				stroke-width="1"
				opacity="0.5"
			/>
			<circle cx={aph.x} cy={aph.y} r="4" fill="none" stroke="var(--ia-prec)" stroke-width="1.5" />
			<Readout id="apsides">
				<Label
					x={peri.x + (SX - peri.x) * 0.2}
					y={peri.y + (SY - peri.y) * 0.2 - 8}
					text="closest"
					size={11}
					weight={600}
					color="var(--ia-prec)"
				/>
				<Label
					x={aph.x + (SX - aph.x) * 0.2}
					y={aph.y + (SY - aph.y) * 0.2 - 8}
					text="furthest"
					size={11}
					muted
				/>
			</Readout>
		{/if}
		{#if has('closest')}
			<Handle
				x={peri.x}
				y={peri.y}
				r={8}
				color="var(--ia-prec)"
				label="Closest point of the orbit"
				value={Math.round(day)}
				min={0}
				max={364}
				valuetext="closest to the Sun on {dateText(day)}"
				onmove={dragPeri}
				onkey={(k) =>
					setParam(
						'closest',
						k === 'start' ? 0 : k === 'end' ? 364 : (Math.round(day) + k + 365) % 365
					)}
			/>
		{:else}
			<circle cx={peri.x} cy={peri.y} r="6" fill="var(--ia-prec)" />
		{/if}
		<Readout
			id="closest"
			order={2}
			label="Closest to the Sun"
			value={e > 0.0005 ? dateText(day) : 'never: the orbit is a circle'}
			color="var(--ia-prec)"
		>
			<Label
				x={32}
				y={548}
				text={e > 0.0005
					? `closest to the Sun: ${dateText(day)}`
					: 'a circle: no closest point, so the wobble does nothing'}
				anchor="start"
				size={13}
				weight={700}
				color="var(--ia-prec)"
			/>
		</Readout>
		<Readout
			id="ecc"
			order={1}
			label="Eccentricity"
			value="{e.toFixed(3)}: {(sep * 100).toFixed(0)}% more sunlight at the closest point"
			color="var(--ia-ecc)"
		>
			<Label
				x={32}
				y={572}
				text={e > 0.0005
					? `e = ${e.toFixed(3)}: ${(sep * 100).toFixed(1)}% more sunlight at the closest point`
					: 'e = 0: the same distance, and sunlight, all year'}
				anchor="start"
				size={12}
				color="var(--ia-ecc)"
				weight={600}
			/>
		</Readout>
	</g>

	<!-- ===================== globe ===================== -->
	<g opacity={oGlobe.current}>
		<Readout id="globe-title">
			<Label x={GX} y={40} text="The Earth on the June solstice" size={15} weight={700} />
		</Readout>
		<!-- sunlight from the left -->
		{#each [-80, -40, 0, 40, 80] as dy (dy)}
			<line
				x1={560}
				x2={GX - R - 18}
				y1={GY + dy}
				y2={GY + dy}
				stroke="#f59f00"
				stroke-width="2"
				opacity="0.55"
				marker-end="url(#arrowhead)"
			/>
		{/each}
		<Readout id="sunlight"
			><Label x={572} y={GY - 96} text="sunlight" anchor="start" size={11} muted /></Readout
		>
		<clipPath id="orbitscene-globe"><circle cx={GX} cy={GY} r={R} /></clipPath>
		<circle cx={GX} cy={GY} r={R} fill="var(--ia-ocean)" />
		<g clip-path="url(#orbitscene-globe)">
			<!-- night side -->
			<rect x={GX} y={GY - R} width={R} height={2 * R} fill="var(--ia-night)" opacity="0.75" />
			<!-- northern ice: everything north of 70° N -->
			<circle
				cx={pole.x}
				cy={pole.y}
				r={R * 0.36}
				fill="var(--ia-ice)"
				stroke="var(--ia-ice-edge)"
			/>
		</g>
		<circle cx={GX} cy={GY} r={R} fill="none" stroke="var(--stage-line)" stroke-width="1.5" />
		<line {...equator} stroke="var(--stage-ink-muted)" stroke-width="1" stroke-dasharray="3 3" />
		<line
			x1={lat65.x1}
			y1={lat65.y1}
			x2={lat65.x2}
			y2={lat65.y2}
			stroke="var(--ia-sun)"
			stroke-width="3"
			stroke-linecap="round"
		/>
		<Readout id="lat65">
			<Label
				x={lat65.x2 + 10}
				y={lat65.y2 + 4}
				text="65° N"
				anchor="start"
				size={12}
				weight={700}
				color="var(--ia-sun)"
			/>
			<Label x={equator.x2 + 8} y={equator.y2 + 4} text="equator" anchor="start" size={11} muted />
		</Readout>
		<!-- the wobble: the axis tip circles round the upright once in about 26,000 years -->
		{#if focus === 'peri' || focus === 'all'}
			<ellipse
				cx={GX}
				cy={GY - (R + 46) * Math.cos(lean)}
				rx={(R + 46) * Math.sin(lean)}
				ry={(R + 46) * Math.sin(lean) * 0.22}
				fill="none"
				stroke="var(--ia-prec)"
				stroke-width="1.5"
				stroke-dasharray="4 3"
			/>
			<Readout id="wobble">
				<Label
					x={GX - (R + 46) * Math.sin(lean) - 10}
					y={GY - (R + 46) * Math.cos(lean) + 26}
					text="wobble: once in ~26,000 years"
					anchor="end"
					size={11}
					weight={600}
					color="var(--ia-prec)"
				/>
			</Readout>
		{/if}
		<!-- axis -->
		<line
			x1={GX + (R + 30) * Math.sin(lean)}
			y1={GY + (R + 30) * Math.cos(lean)}
			x2={axisTip.x}
			y2={axisTip.y}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<line
			x1={GX}
			y1={GY - R - 52}
			x2={GX}
			y2={GY}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="3 3"
		/>
		<path
			d="M{GX} {GY - R - 34} A{R + 34} {R + 34} 0 0 0 {GX - (R + 34) * Math.sin(lean)} {GY -
				(R + 34) * Math.cos(lean)}"
			fill="none"
			stroke="var(--ia-tilt)"
			stroke-width="2"
		/>
		<Readout id="tilt" order={4} label="Tilt" value="{tilt.toFixed(2)}°" color="var(--ia-tilt)">
			<Label
				x={GX + 10}
				y={GY - R - 66}
				text="tilt {tilt.toFixed(2)}°"
				anchor="start"
				size={13}
				weight={700}
				color="var(--ia-tilt)"
			/>
		</Readout>
		{#if has('tilt')}
			<Handle
				x={axisTip.x}
				y={axisTip.y}
				r={8}
				color="var(--ia-tilt)"
				label="Tilt of Earth's axis"
				value={tilt}
				min={21.5}
				max={25}
				valuetext="{tilt.toFixed(2)} degrees"
				onmove={dragTilt}
				onkey={(k) =>
					setParam(
						'tilt',
						k === 'start'
							? 21.5
							: k === 'end'
								? 25
								: clamp(Math.round((tilt + k * 0.05) * 20) / 20, 21.5, 25)
					)}
			/>
		{/if}
	</g>

	<!-- ===================== gauge ===================== -->
	<Readout
		id="sunshine"
		order={5}
		label="Summer sunshine at 65° N"
		value="{sunshine.toFixed(0)} W/m² ({signed(sunshine - today)} vs today)"
		color="var(--ia-sun)"
	>
		<Label
			x={GL}
			y={GYY - 62}
			text="summer sunshine at 65° N (June solstice, 24-hour mean)"
			anchor="start"
			size={12}
			weight={600}
		/>
		<Label
			x={GL}
			y={GYY - 30}
			text="{sunshine.toFixed(0)} W/m²"
			anchor="start"
			size={22}
			weight={700}
			color="var(--ia-sun)"
		/>
		<Label
			x={GR}
			y={GYY - 30}
			text="{signed(sunshine - today)} W/m² vs today"
			anchor="end"
			size={13}
			weight={600}
		/>
	</Readout>
	<rect x={GL} y={GYY - 8} width={GR - GL} height="16" rx="8" fill="var(--stage-grid)" />
	<rect
		x={gx(LOW)}
		y={GYY - 8}
		width={gx(HIGH) - gx(LOW)}
		height="16"
		rx="8"
		fill="var(--ia-sun)"
		opacity="0.25"
	/>
	<line
		x1={gx(today)}
		x2={gx(today)}
		y1={GYY - 13}
		y2={GYY + 13}
		stroke="var(--stage-ink)"
		stroke-width="2"
	/>
	<circle
		cx={gx(clamp(sunshine, 400, 580))}
		cy={GYY}
		r="9"
		fill="var(--ia-sun)"
		stroke="var(--stage-bg)"
		stroke-width="2"
	/>
	<Readout id="gauge-keys">
		<Label x={gx(today)} y={GYY + 28} text="today" size={11} weight={600} />
		<Label x={gx(LOW)} y={GYY + 28} text={LOW.toFixed(0)} size={11} muted />
		<Label x={gx(HIGH)} y={GYY + 28} text={HIGH.toFixed(0)} size={11} muted />
		<Label
			x={(gx(LOW) + gx(HIGH)) / 2 + 40}
			y={GYY + 46}
			text="range over the last 800,000 years"
			size={11}
			muted
		/>
	</Readout>
	{#if focus === 'ecc'}
		<Readout
			id="global"
			order={6}
			label="Whole Earth, whole year"
			value="{globalNow.toFixed(2)} W/m² ({signed(globalNow - globalToday, 2)} vs today)"
		>
			<Label
				x={GL}
				y={GYY + 76}
				text="whole Earth, whole year: {globalNow.toFixed(2)} W/m² ({signed(
					globalNow - globalToday,
					2
				)})"
				anchor="start"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
