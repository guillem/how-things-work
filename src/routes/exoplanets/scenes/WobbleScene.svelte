<script lang="ts">
	/**
	 * The wobble (steps wobble, doppler, tilt-wobble). Top left: star and planet
	 * circling their centre of mass, seen from above, with the Earth below; the
	 * star's velocity and the part of it along our line of sight. Top right: the
	 * star's spectrum with real absorption lines, shifted by v/c (magnified by a
	 * stated factor), and a close-up of Hα. Below: the velocity curve over two
	 * orbits. One orbit takes ORBIT_S s; everything is a pure function of t.
	 */
	import { Axes, scale, wavelengthToColor } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		C,
		SPECTRAL_LINES,
		dopplerShift,
		massFromWobble,
		periodDays,
		radialVelocity,
		rvAmplitude,
		starOrbitAU,
		starSpeed,
		AU,
		R_SUN
	} from '../exoplanets';
	import { fmtTilt, readerSystem } from '../systems';
	import Card from './Card.svelte';
	import T from './T.svelte';
	import { duration, sci, sig, speed, starColor, ticksWithDecimals } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	type Phase = 'wobble' | 'doppler' | 'tilt';
	const phase = $derived(String(step.hints?.phase ?? 'wobble') as Phase);

	const ORBIT_S = 8;

	// ---- layout ------------------------------------------------------------------
	const L = { x0: 16, y0: 16, x1: 466, y1: 340 };
	const R = { x0: 482, y0: 16, x1: 944, y1: 340 };
	const BX = 241; // centre of mass, top view
	const BY = 172;
	const RP = 112; // planet's orbit, px (not to scale)
	const RSTAR = 26; // star's circle, px (enlarged)
	const SX0 = 506; // spectrum strip
	const SX1 = 920;
	const SY0 = 92;
	const SH = 46;
	const ZX0 = 506; // Hα close-up
	const ZX1 = 920;
	const ZY0 = 214;
	const ZH = 46;
	const L0 = 385;
	const L1 = 700;
	const HA = 656.281;
	const ZW = 1.2; // close-up half-width, nm
	const PX0 = 92;
	const PX1 = 676;
	const PY0 = 392;
	const PY1 = 540;
	const CX = 700;
	const CW = 244;

	const sys = $derived(readerSystem(params));
	const st = $derived(sys.star);
	const pl = $derived(sys.planet);
	const P = $derived(periodDays(st, pl));
	const K = $derived(rvAmplitude(st, pl));
	const vTrue = $derived(starSpeed(st, pl));
	const tiltDeg = $derived(90 - pl.incl);
	const sinI = $derived(Math.sin((pl.incl * Math.PI) / 180));
	const color = $derived(starColor(st.teff));

	const tt = $derived(reduced ? 2.5 : t);
	const ph = $derived((tt % (2 * ORBIT_S)) / ORBIT_S);
	const th = $derived(2 * Math.PI * ph);
	const v = $derived(radialVelocity(st, pl, ph)); // m/s, + = away

	// ---- top view -----------------------------------------------------------------
	const planetXY = $derived({ x: BX + RP * Math.sin(th), y: BY + RP * Math.cos(th) });
	const starXY = $derived({ x: BX - RSTAR * Math.sin(th), y: BY - RSTAR * Math.cos(th) });
	/** Star's velocity direction (unit) in the top view, and its towards-Earth part (+ = down). */
	const vel = $derived({ x: -Math.cos(th), y: Math.sin(th) });
	const enlarge = $derived(RSTAR / ((RP * starOrbitAU(st, pl)) / pl.a));
	const ARROW = 46;
	const losLen = $derived(ARROW * vel.y * sinI);
	const losColor = $derived(v < 0 ? 'var(--ex-blue)' : 'var(--ex-red)');

	// ---- spectrum ------------------------------------------------------------------
	// Magnification: a 1-2-5 step so that the full swing in the close-up is 25–60 px.
	const pxPerNmZ = (ZX1 - ZX0) / (2 * ZW);
	const mag = $derived.by(() => {
		const real = dopplerShift(HA, Math.max(K, 1e-6)) * pxPerNmZ; // px at ×1
		const want = 45 / real;
		const e = Math.floor(Math.log10(want));
		const m = [1, 2, 5, 10].findLast((q) => q * 10 ** e <= want) ?? 1;
		return Math.max(1, m * 10 ** e);
	});
	const shiftNm = (nm: number) => dopplerShift(nm, v) * mag;
	const sxL = (nm: number) => SX0 + ((nm - L0) / (L1 - L0)) * (SX1 - SX0);
	const sxZ = (nm: number) => (ZX0 + ZX1) / 2 + (nm - HA) * pxPerNmZ;
	const bands = Array.from({ length: 64 }, (_, i) => {
		const nm = L0 + ((i + 0.5) * (L1 - L0)) / 64;
		return {
			i,
			x: SX0 + (i * (SX1 - SX0)) / 64,
			w: (SX1 - SX0) / 64 + 0.6,
			c: wavelengthToColor(nm)
		};
	});

	const fmtMag = (m: number) => Math.round(m).toLocaleString('en-US').replace(/,/g, ' ');

	// ---- velocity curve -------------------------------------------------------------
	const vMax = $derived(Math.max(K, vTrue * 0.02, 1e-9) * 1.35);
	const sx = $derived(scale([0, 2 * P], [PX0, PX1]));
	const sy = $derived(scale([-vMax, vMax], [PY1, PY0]));
	const xt = $derived(ticksWithDecimals(0, 2 * P, 6));
	const yt = $derived(ticksWithDecimals(-vMax / 1.35, vMax / 1.35, 4));
	const curvePts = $derived(
		Array.from({ length: 161 }, (_, i) => {
			const p = (2 * i) / 160;
			return { p, v: radialVelocity(st, pl, p) };
		})
	);
	const path = (pts: { p: number; v: number }[]) =>
		pts.map((q, i) => `${i ? 'L' : 'M'}${sx(q.p * P).toFixed(1)} ${sy(q.v).toFixed(1)}`).join(' ');
	const full = $derived(path(curvePts));
	const drawn = $derived(
		reduced ? full : path([...curvePts.filter((q) => q.p <= ph), { p: ph, v }])
	);
	const yUnit = $derived(vMax < 1.35 ? 'cm/s' : 'm/s');
	const yFmt = (val: number) =>
		yUnit === 'cm/s' ? (val * 100).toFixed(Math.max(0, yt.decimals - 2)) : val.toFixed(yt.decimals);

	const minMass = $derived(massFromWobble(K, P, st.mass));
	const starOrbitKm = $derived((starOrbitAU(st, pl) * AU) / 1000);
	const starOrbitR = $derived((starOrbitAU(st, pl) * AU) / (st.radius * R_SUN));
	const fmtKm = (km: number) =>
		km >= 1e6 ? `${sig(km / 1e6, 2)} million km` : `${Math.round(km).toLocaleString('en-US')} km`;
</script>

<g>
	<!-- ---- top view ---- -->
	<rect
		x={L.x0}
		y={L.y0}
		width={L.x1 - L.x0}
		height={L.y1 - L.y0}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<Readout id="top-title">
		<T x={L.x0 + 16} y={L.y0 + 26} text="Seen from above the orbit" size={14} weight={700} />
		<T
			x={L.x0 + 16}
			y={L.y0 + 44}
			text="not to scale · star’s circle enlarged ×{sig(enlarge, 2)}"
			size={11.5}
			muted
		/>
	</Readout>
	<circle
		cx={BX}
		cy={BY}
		r={RP}
		fill="none"
		stroke="var(--ex-orbit)"
		stroke-dasharray="3 5"
		opacity="0.6"
	/>
	<circle
		cx={BX}
		cy={BY}
		r={RSTAR}
		fill="none"
		stroke={color}
		stroke-width="1.3"
		stroke-dasharray="2 3"
		opacity="0.9"
	/>
	<line x1={BX - 6} x2={BX + 6} y1={BY} y2={BY} stroke="var(--stage-ink)" stroke-width="1.5" />
	<line x1={BX} x2={BX} y1={BY - 6} y2={BY + 6} stroke="var(--stage-ink)" stroke-width="1.5" />
	<line
		x1={starXY.x}
		y1={starXY.y}
		x2={planetXY.x}
		y2={planetXY.y}
		stroke="var(--ex-orbit)"
		opacity="0.25"
	/>
	<circle cx={starXY.x} cy={starXY.y} r="17" fill={color} />
	<circle cx={planetXY.x} cy={planetXY.y} r="6.5" fill="var(--ex-planet)" />
	<!-- star's velocity, and the part along our line of sight -->
	<line
		x1={starXY.x}
		y1={starXY.y}
		x2={starXY.x + ARROW * vel.x}
		y2={starXY.y + ARROW * vel.y}
		stroke="var(--stage-ink)"
		stroke-width="1.6"
		opacity="0.6"
		marker-end="url(#arrowhead)"
	/>
	{#if Math.abs(losLen) > 3}
		<line
			x1={starXY.x}
			y1={starXY.y}
			x2={starXY.x}
			y2={starXY.y + losLen}
			stroke={losColor}
			stroke-width="3"
			marker-end="url(#arrowhead)"
			style:color={losColor}
		/>
	{/if}
	<Readout id="com-label">
		<T x={BX + RSTAR + 8} y={BY + 4} text="centre of mass" size={11} muted />
	</Readout>
	<!-- the Earth, far below -->
	<line
		x1={BX}
		x2={BX}
		y1={BY + RP + 14}
		y2={L.y1 - 30}
		stroke="var(--ex-orbit)"
		stroke-dasharray="2 4"
		opacity="0.6"
	/>
	<Readout id="to-earth">
		<T
			x={BX}
			y={L.y1 - 14}
			text="to Earth (light-years away)"
			size={12}
			anchor="middle"
			weight={600}
		/>
	</Readout>
	{#if phase === 'tilt'}
		<!-- side view: the orbit's plane edge-on to the page, the Earth off to the right -->
		<g transform="translate(412 118)">
			<rect
				x="-48"
				y="-50"
				width="96"
				height="104"
				rx="10"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
			<line
				x1={-30 * Math.cos((tiltDeg * Math.PI) / 180)}
				y1={30 * Math.sin((tiltDeg * Math.PI) / 180)}
				x2={30 * Math.cos((tiltDeg * Math.PI) / 180)}
				y2={-30 * Math.sin((tiltDeg * Math.PI) / 180)}
				stroke="var(--ex-orbit)"
				stroke-width="2"
			/>
			<circle r="6" fill={color} />
			<line
				x1="10"
				y1="0"
				x2="40"
				y2="0"
				stroke="var(--ex-blue)"
				stroke-width="1.6"
				marker-end="url(#arrowhead)"
				style:color="var(--ex-blue)"
			/>
			<T x={0} y={-34} text="side view" size={10.5} anchor="middle" muted />
			<T x={0} y={44} text="orbit · Earth →" size={10.5} anchor="middle" muted />
		</g>
	{/if}

	<!-- ---- spectrum ---- -->
	<rect
		x={R.x0}
		y={R.y0}
		width={R.x1 - R.x0}
		height={R.y1 - R.y0}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<Readout id="spec-title">
		<T x={R.x0 + 16} y={R.y0 + 26} text="The star’s spectrum" size={14} weight={700} />
		<T
			x={R.x0 + 16}
			y={R.y0 + 44}
			text="line shifts drawn {fmtMag(mag)}× larger than they are"
			size={11.5}
			muted
		/>
	</Readout>
	{#each bands as bnd (bnd.i)}
		<rect x={bnd.x} y={SY0} width={bnd.w} height={SH} fill={bnd.c} />
	{/each}
	{#each SPECTRAL_LINES as line (line.id)}
		<line
			x1={sxL(line.nm)}
			x2={sxL(line.nm)}
			y1={SY0 - 6}
			y2={SY0}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		<rect
			x={sxL(line.nm + shiftNm(line.nm)) - 1.5}
			y={SY0}
			width="3"
			height={SH}
			fill="#111"
			opacity="0.85"
		/>
	{/each}
	<Readout id="spec-axis">
		<T x={SX0} y={SY0 + SH + 16} text="400 nm" size={11} muted />
		<T x={SX1} y={SY0 + SH + 16} text="700 nm" size={11} anchor="end" muted />
		<T
			x={(SX0 + SX1) / 2}
			y={SY0 + SH + 16}
			text="ticks: where the lines are at rest"
			size={11}
			anchor="middle"
			muted
		/>
	</Readout>
	<!-- Hα close-up -->
	<rect x={ZX0} y={ZY0} width={ZX1 - ZX0} height={ZH} fill={wavelengthToColor(HA)} />
	<line
		x1={sxZ(HA)}
		x2={sxZ(HA)}
		y1={ZY0 - 8}
		y2={ZY0 + ZH + 8}
		stroke="var(--stage-ink)"
		stroke-dasharray="3 3"
		stroke-width="1.2"
	/>
	<rect x={sxZ(HA + shiftNm(HA)) - 3} y={ZY0} width="6" height={ZH} fill="#111" opacity="0.9" />
	<Readout id="zoom-title">
		<T
			x={ZX0}
			y={ZY0 - 14}
			text="Close-up: the hydrogen-alpha line, 656.28 nm"
			size={12}
			weight={600}
		/>
	</Readout>
	<Readout
		id="shift"
		order={3}
		label="Hα shift (real)"
		value="{v < 0 ? '−' : '+'}{sig(Math.abs(dopplerShift(HA, v)) * 1e6, 2)} millionths of a nm"
	>
		<T
			x={(ZX0 + ZX1) / 2}
			y={ZY0 + ZH + 24}
			text={Math.abs(v) < K * 0.05
				? 'no shift: the star moves across our line of sight'
				: v < 0
					? `towards us: bluer by ${sig(Math.abs(dopplerShift(HA, v)) * 1e6, 2)} millionths of a nm`
					: `away from us: redder by ${sig(Math.abs(dopplerShift(HA, v)) * 1e6, 2)} millionths of a nm`}
			size={12}
			anchor="middle"
			weight={600}
			color={Math.abs(v) < K * 0.05 ? undefined : losColor}
		/>
	</Readout>

	<!-- ---- velocity curve ---- -->
	<rect
		x={16}
		y={356}
		width={928}
		height={228}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="curve-title">
		<T
			x={32}
			y={378}
			text="The star’s speed along our line of sight (velocity curve)"
			size={14}
			weight={700}
		/>
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={xt.ticks}
		yTicks={yt.ticks}
		xFormat={(x) => x.toFixed(xt.decimals)}
		yFormat={yFmt}
		xLabel="days"
		yLabel=""
	/>
	<line x1={PX0} x2={PX1} y1={sy(0)} y2={sy(0)} stroke="var(--stage-line)" />
	<T x={PX0 + 8} y={PY0 + 4} text="↑ away from us ({yUnit})" size={11} muted />
	<T x={PX0 + 8} y={PY1 - 6} text="↓ towards us" size={11} muted />
	{#if phase === 'doppler'}
		{#each [0, 1, 2] as n (n)}
			<line
				x1={sx(n * P)}
				x2={sx(n * P)}
				y1={PY0}
				y2={PY1}
				stroke="var(--ex-light)"
				stroke-dasharray="3 4"
				opacity="0.8"
			/>
		{/each}
		<T
			x={sx(P) + 6}
			y={PY0 + 12}
			text="planet in front of the star"
			size={11}
			color="var(--ex-light)"
		/>
	{/if}
	<path d={full} fill="none" stroke="var(--ex-rv)" stroke-width="1.5" opacity="0.25" />
	<path d={drawn} fill="none" stroke="var(--ex-rv)" stroke-width="2.4" />
	{#if !reduced}
		<circle
			cx={sx(ph * P)}
			cy={sy(v)}
			r="4.5"
			fill="var(--ex-rv)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- ---- readouts ---- -->
	<Card x={CX} y={368} w={CW} h={204} />
	<Readout
		id="K"
		order={1}
		label="Star’s speed, towards and away"
		value="± {speed(K)}"
		color="var(--ex-rv)"
	>
		<T x={CX + 16} y={396} text="Speed towards / away" size={12.5} muted />
		<T
			x={CX + CW - 16}
			y={396}
			text="± {speed(K)}"
			size={14}
			weight={700}
			anchor="end"
			color="var(--ex-rv)"
		/>
	</Readout>
	<Readout id="period" order={2} label="One cycle (period)" value={duration(P)}>
		<T x={CX + 16} y={424} text="One cycle (period)" size={12.5} muted />
		<T x={CX + CW - 16} y={424} text={duration(P)} size={13.5} weight={650} anchor="end" />
	</Readout>
	{#if phase === 'wobble'}
		<Readout
			id="circle"
			order={4}
			label="The star’s circle"
			value="{fmtKm(starOrbitKm)} ({sig(starOrbitR, 2)} star radii)"
		>
			<T x={CX + 16} y={452} text="Star’s circle (radius)" size={12.5} muted />
			<T x={CX + CW - 16} y={452} text={fmtKm(starOrbitKm)} size={13.5} weight={650} anchor="end" />
			<T
				x={CX + CW - 16}
				y={472}
				text="{sig(starOrbitR, 2)} × the star’s radius"
				size={12}
				anchor="end"
				muted
			/>
		</Readout>
		<T x={CX + 16} y={508} text="Sun, from Jupiter: 12.5 m/s" size={11.5} muted />
		<T x={CX + 16} y={526} text="Sun, from the Earth: 9 cm/s" size={11.5} muted />
	{:else if phase === 'doppler'}
		<Readout
			id="frac"
			order={4}
			label="Shift ÷ wavelength"
			value="{sci(K / C)} (speed ÷ speed of light)"
		>
			<T x={CX + 16} y={452} text="Shift ÷ wavelength" size={12.5} muted />
			<T x={CX + CW - 16} y={452} text={sci(K / C)} size={13.5} weight={650} anchor="end" />
			<T x={CX + CW - 16} y={472} text="= speed ÷ speed of light" size={12} anchor="end" muted />
		</Readout>
		<T x={CX + 16} y={508} text="Blue: coming towards us." size={11.5} color="var(--ex-blue)" />
		<T x={CX + 16} y={526} text="Red: moving away." size={11.5} color="var(--ex-red)" />
	{:else}
		<Readout id="tilt" order={4} label="Tilt from edge-on" value="{fmtTilt(tiltDeg)}°">
			<T x={CX + 16} y={452} text="Tilt from edge-on" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={452}
				text="{fmtTilt(tiltDeg)}°"
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout id="true" order={5} label="Star’s real speed" value={speed(vTrue)}>
			<T x={CX + 16} y={478} text="Star’s real speed" size={12.5} muted />
			<T x={CX + CW - 16} y={478} text={speed(vTrue)} size={13.5} weight={650} anchor="end" />
		</Readout>
		<Readout
			id="minmass"
			order={6}
			label="Minimum mass from the curve"
			value="{sig(minMass)} Earths (true: {sig(pl.mass)})"
		>
			<T x={CX + 16} y={504} text="Minimum mass from it" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={504}
				text="{sig(minMass)} Earths"
				size={13.5}
				weight={650}
				anchor="end"
			/>
			<T
				x={CX + CW - 16}
				y={524}
				text="true mass: {sig(pl.mass)} Earths"
				size={12}
				anchor="end"
				muted
			/>
		</Readout>
	{/if}
</g>
