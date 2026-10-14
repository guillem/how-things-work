<script lang="ts">
	/**
	 * Transits (steps transit, period, tilt). Top left: the star close up as
	 * seen from Earth, with the planet to scale crossing it. Top right: the whole
	 * orbit as seen from Earth (an ellipse that closes to a line edge-on). Below:
	 * the light curve from `flux()`, drawn as the planet moves, with the readouts.
	 *
	 * Time: on the transit and tilt steps the crossing is replayed in slow motion
	 * (one pass every LOOP s, the planet moving between ±XW star radii); on the
	 * period step one orbit takes ORBIT_S s and the curve covers three orbits.
	 * The planet's phase is a pure function of t.
	 */
	import { Axes, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		aOverR,
		flux,
		impactParameter,
		maxTiltDeg,
		periodDays,
		radiusRatio,
		skyPosition,
		transitChance,
		transitDepth,
		transitHours,
		transits
	} from '../exoplanets';
	import { fmtAU, readerSystem } from '../systems';
	import Card from './Card.svelte';
	import T from './T.svelte';
	import { dimming, duration, oneIn, sig, starColor, ticksWithDecimals } from './ui';

	let { step, t, params, reduced }: StageProps = $props();

	type Phase = 'transit' | 'period' | 'tilt';
	const phase = $derived(String(step.hints?.phase ?? 'transit') as Phase);

	const LOOP = 7; // s per slow-motion crossing
	const ORBIT_S = 8; // s per orbit on the period step
	const XW = 1.85; // half-width of the close-up, star radii

	// ---- layout ----------------------------------------------------------------
	const A = { x0: 16, y0: 16, x1: 466, y1: 340 }; // close-up
	const O = { x0: 482, y0: 16, x1: 944, y1: 340 }; // whole orbit
	const SCX = (A.x0 + A.x1) / 2;
	const SCY = 186;
	const RS = 112; // star radius in the close-up, px
	const OCX = (O.x0 + O.x1) / 2;
	const OCY = 190;
	const ORX = 196; // orbit radius in the whole-orbit view, px
	const PX0 = 92;
	const PX1 = 676;
	const PY0 = 392;
	const PY1 = 534;
	const CX = 700; // readout card
	const CW = 244;

	const sys = $derived(readerSystem(params));
	const st = $derived(sys.star);
	const pl = $derived(sys.planet);
	const k = $derived(radiusRatio(st, pl));
	const AR = $derived(aOverR(st, pl));
	const P = $derived(periodDays(st, pl));
	const depth = $derived(transitDepth(st, pl));
	const hours = $derived(transitHours(st, pl));
	const b = $derived(impactParameter(st, pl));
	const hits = $derived(transits(st, pl));
	const grazing = $derived(hits && b > 1 - k);
	const color = $derived(starColor(st.teff));

	const tt = $derived(reduced ? 2.5 : t);

	// Phase window (orbits) of the slow-motion crossing: the planet goes from -XW to +XW.
	const halfWin = $derived(Math.asin(Math.min(1, (XW + k) / AR)) / (2 * Math.PI));
	const slow = $derived(phase !== 'period');
	/** Current phase, orbits since mid-transit. */
	const ph = $derived.by(() => {
		if (slow) {
			const u = (tt % LOOP) / LOOP;
			return (u * 2 - 1) * halfWin;
		}
		return tt / ORBIT_S - 0.25;
	});
	const pos = $derived(skyPosition(st, pl, ph));

	// ---- light curve --------------------------------------------------------------
	// x: hours from mid-transit (slow) or days from the start (period).
	const xDomain = $derived<[number, number]>(
		slow ? [-halfWin * P * 24, halfWin * P * 24] : [0, 3 * P]
	);
	const sx = $derived(scale(xDomain, [PX0, PX1]));
	const xOf = (p: number) => (slow ? p * P * 24 : (p + 0.25) * P);
	// y: brightness in %, scaled to the depth of a full transit (also when it misses).
	const scaleDepth = $derived(Math.max(depth, 1e-7));
	const yLo = $derived(100 * (1 - 1.3 * scaleDepth));
	const yHi = $derived(100 * (1 + 0.25 * scaleDepth));
	const sy = $derived(scale([yLo, yHi], [PY1, PY0]));
	const yt = $derived(ticksWithDecimals(yLo, 100, 3));
	const xt = $derived(ticksWithDecimals(xDomain[0], xDomain[1], 6));

	/** Phases to sample: the window, or three orbits dense round each transit. */
	const samples = $derived.by(() => {
		const out: number[] = [];
		if (slow) {
			for (let i = 0; i <= 240; i++) out.push(-halfWin + (2 * halfWin * i) / 240);
			return out;
		}
		const half = hits ? (hours / 24 / P) * 0.62 : 0;
		const dipPhases = [0, 1, 2];
		let p = -0.25;
		for (const d of dipPhases) {
			out.push(p);
			if (half > 0) {
				for (let i = 0; i <= 60; i++) out.push(d - half + (2 * half * i) / 60);
			}
			p = d + half + 1e-9;
		}
		out.push(p, 2.75);
		return out.sort((x, y) => x - y);
	});
	const curve = $derived(samples.map((p) => ({ p, f: 100 * flux(st, pl, p) })));
	const pathOf = (pts: { p: number; f: number }[]) =>
		pts
			.map(
				(q, i) => `${i ? 'L' : 'M'}${sx(xOf(q.p)).toFixed(1)} ${sy(Math.max(yLo, q.f)).toFixed(1)}`
			)
			.join(' ');
	const full = $derived(pathOf(curve));
	const drawn = $derived.by(() => {
		if (reduced) return full;
		const pts = curve.filter((q) => q.p <= ph);
		pts.push({ p: ph, f: 100 * flux(st, pl, ph) });
		return pathOf(pts);
	});
	const now = $derived({ x: sx(xOf(ph)), y: sy(Math.max(yLo, 100 * flux(st, pl, ph))) });

	// ---- close-up -----------------------------------------------------------------
	const planetR = $derived(Math.max(1.2, k * RS));
	const pX = $derived(SCX + pos.x * RS);
	const pY = $derived(SCY + pos.y * RS);
	const trackY = $derived(SCY + pos.y * RS);
	const showPlanet = $derived(pos.front && Math.abs(pos.x) < XW + 2 * k);

	// ---- whole orbit ----------------------------------------------------------------
	const ci = $derived(Math.cos((pl.incl * Math.PI) / 180));
	const ry = $derived(ORX * ci);
	const starPx = $derived(ORX / AR);
	const starDraw = $derived(Math.max(3, starPx));
	const oPos = $derived({
		x: OCX + (pos.x / AR) * ORX,
		y: OCY + (pos.y / AR) * ORX
	});
	const ellipseHalf = (near: boolean) => {
		// near half: cos θ > 0 (θ from -90° to 90°), drawn below the star when tilted
		const pts: string[] = [];
		for (let i = 0; i <= 60; i++) {
			const th = (near ? -Math.PI / 2 : Math.PI / 2) + (Math.PI * i) / 60;
			pts.push(
				`${i ? 'L' : 'M'}${(OCX + ORX * Math.sin(th)).toFixed(1)} ${(OCY + ry * Math.cos(th)).toFixed(1)}`
			);
		}
		return pts.join(' ');
	};
	const nearPath = $derived(ellipseHalf(true));
	const farPath = $derived(ellipseHalf(false));

	const status = $derived(
		!hits ? 'no transit: it misses the star' : grazing ? 'a grazing transit' : 'a full transit'
	);
	const missBy = $derived(b - 1 - k);
</script>

<g>
	<defs>
		<clipPath id="transit-close">
			<rect x={A.x0} y={A.y0} width={A.x1 - A.x0} height={A.y1 - A.y0} rx="14" />
		</clipPath>
		<radialGradient id="transit-glow">
			<stop offset="0.6" style:stop-color={color} stop-opacity="0.35" />
			<stop offset="1" style:stop-color={color} stop-opacity="0" />
		</radialGradient>
	</defs>

	<!-- ---- close-up ---- -->
	<rect
		x={A.x0}
		y={A.y0}
		width={A.x1 - A.x0}
		height={A.y1 - A.y0}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#transit-close)">
		<circle cx={SCX} cy={SCY} r={RS * 1.25} fill="url(#transit-glow)" />
		<circle cx={SCX} cy={SCY} r={RS} fill={color} />
		<!-- the planet's track across the sky -->
		<line
			x1={A.x0}
			x2={A.x1}
			y1={trackY}
			y2={trackY}
			stroke="var(--ex-orbit)"
			stroke-dasharray="4 5"
			opacity="0.55"
		/>
		{#if showPlanet}
			<circle cx={pX} cy={pY} r={planetR} fill="var(--ex-planet)" />
		{/if}
	</g>
	<Readout id="close-title">
		<T
			x={A.x0 + 16}
			y={A.y0 + 26}
			text="The star seen from Earth, close up"
			size={14}
			weight={700}
		/>
		<T
			x={A.x0 + 16}
			y={A.y0 + 44}
			text={slow ? 'planet to scale · crossing slowed down' : 'planet to scale'}
			size={11.5}
			muted
		/>
	</Readout>

	<!-- ---- whole orbit ---- -->
	<rect
		x={O.x0}
		y={O.y0}
		width={O.x1 - O.x0}
		height={O.y1 - O.y0}
		rx="14"
		fill="var(--ex-space)"
		stroke="var(--border)"
	/>
	<Readout id="orbit-title">
		<T x={O.x0 + 16} y={O.y0 + 26} text="The whole orbit, seen from Earth" size={14} weight={700} />
		<T
			x={O.x0 + 16}
			y={O.y0 + 44}
			text={starPx < 3
				? 'star drawn bigger than to scale; planet not to scale'
				: 'planet not to scale'}
			size={11.5}
			muted
		/>
	</Readout>
	<path
		d={farPath}
		fill="none"
		stroke="var(--ex-orbit)"
		stroke-width="1.3"
		stroke-dasharray="3 5"
		opacity="0.7"
	/>
	{#if !pos.front}
		<circle cx={oPos.x} cy={oPos.y} r="5" fill="var(--ex-planet)" opacity="0.6" />
	{/if}
	<circle cx={OCX} cy={OCY} r={starDraw} fill={color} />
	<path d={nearPath} fill="none" stroke="var(--ex-orbit)" stroke-width="1.6" opacity="0.9" />
	{#if pos.front}
		<circle
			cx={oPos.x}
			cy={oPos.y}
			r="5"
			fill="var(--ex-planet)"
			stroke="var(--ex-space)"
			stroke-width="1.5"
		/>
	{/if}
	<Readout id="orbit-key">
		<T
			x={O.x0 + 16}
			y={O.y1 - 30}
			text="solid: the near side, in front of the star"
			size={11.5}
			muted
		/>
		<T x={O.x0 + 16} y={O.y1 - 14} text="dashed: the far side, behind it" size={11.5} muted />
	</Readout>

	<!-- ---- light curve ---- -->
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
		<T x={32} y={378} text="The star’s brightness (light curve)" size={14} weight={700} />
	</Readout>
	<Axes
		{sx}
		{sy}
		xTicks={xt.ticks}
		yTicks={yt.ticks}
		xFormat={(v) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(xt.decimals))}
		yFormat={(v) => `${v.toFixed(yt.decimals)}%`}
		xLabel={slow ? 'hours from mid-transit' : 'days'}
	/>
	<path d={full} fill="none" stroke="var(--ex-light)" stroke-width="1.5" opacity="0.25" />
	<path d={drawn} fill="none" stroke="var(--ex-light)" stroke-width="2.4" stroke-linejoin="round" />
	{#if !reduced}
		<circle
			cx={now.x}
			cy={now.y}
			r="4.5"
			fill="var(--ex-light)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	{/if}

	<!-- ---- readouts ---- -->
	<Card x={CX} y={368} w={CW} h={204} />
	{#if phase === 'transit'}
		<Readout id="depth" order={1} label="Dip" value={dimming(depth)}>
			<T x={CX + 16} y={396} text="Dip" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={396}
				text={dimming(depth)}
				size={14}
				weight={700}
				anchor="end"
				color="var(--ex-light)"
			/>
		</Readout>
		<Readout
			id="ratio"
			order={2}
			label="Planet ÷ star (radius)"
			value="{sig(k)} → ({sig(k)})² = {dimming(k * k)}"
		>
			<T x={CX + 16} y={424} text="Planet ÷ star (radius)" size={12.5} muted />
			<T x={CX + CW - 16} y={424} text={sig(k)} size={13.5} weight={650} anchor="end" />
			<T x={CX + 16} y={448} text="dip = ({sig(k)})² of the light" size={12.5} />
		</Readout>
		<Readout id="dur" order={3} label="The dip lasts" value={duration(hours / 24)}>
			<T x={CX + 16} y={480} text="The dip lasts" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={480}
				text={duration(hours / 24)}
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="m-ref"
			order={9}
			label="For scale"
			value="Earth across the Sun: 0.0084%; Jupiter: 1%"
		>
			<T x={CX + 16} y={512} text="Earth across the Sun: 0.0084%" size={11.5} muted />
			<T x={CX + 16} y={530} text="Jupiter across the Sun: 1%" size={11.5} muted />
		</Readout>
	{:else if phase === 'period'}
		<Readout id="period" order={1} label="Gap between dips (period)" value={duration(P)}>
			<T x={CX + 16} y={396} text="Gap between dips" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={396}
				text={duration(P)}
				size={14}
				weight={700}
				anchor="end"
				color="var(--ex-light)"
			/>
		</Readout>
		<Readout id="a" order={2} label="So the orbit is" value="{fmtAU(pl.a)} AU">
			<T x={CX + 16} y={424} text="So the orbit is (Kepler III)" size={12.5} muted />
			<T x={CX + CW - 16} y={424} text="{fmtAU(pl.a)} AU" size={13.5} weight={650} anchor="end" />
		</Readout>
		<Readout id="mstar" order={3} label="Star’s mass" value="{sig(st.mass)} Suns">
			<T x={CX + 16} y={452} text="Star’s mass" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={452}
				text="{sig(st.mass)} Suns"
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="dur"
			order={4}
			label="Each dip lasts"
			value={hits ? duration(hours / 24) : 'no dip'}
		>
			<T x={CX + 16} y={480} text="Each dip lasts" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={480}
				text={hits ? duration(hours / 24) : 'no dip'}
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout id="m-three">
			<T x={CX + 16} y={512} text="Three orbits shown, whatever" size={11.5} muted />
			<T x={CX + 16} y={530} text="the period: read the days below." size={11.5} muted />
		</Readout>
	{:else}
		<Readout id="tilt" order={1} label="Tilt from edge-on" value="{sig(90 - pl.incl, 2)}°">
			<T x={CX + 16} y={396} text="Tilt from edge-on" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={396}
				text="{sig(90 - pl.incl, 2)}°"
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout id="status" order={2} label="Result" value={status}>
			<T
				x={CX + 16}
				y={424}
				text={status}
				size={13.5}
				weight={700}
				color={hits ? 'var(--ex-light)' : 'var(--ex-red)'}
			/>
			<T
				x={CX + 16}
				y={446}
				text={hits
					? `its track is ${sig(b, 2)} star radii off centre`
					: `it passes ${sig(missBy, 2)} star radii clear`}
				size={12}
			/>
		</Readout>
		<Readout
			id="max"
			order={3}
			label="Transits only if the tilt is under"
			value="{sig(maxTiltDeg(st, pl), 2)}°"
		>
			<T x={CX + 16} y={476} text="Transits only below" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={476}
				text="{sig(maxTiltDeg(st, pl), 2)}°"
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout
			id="chance"
			order={4}
			label="Chance for a random tilt"
			value={oneIn(transitChance(st, pl))}
		>
			<T x={CX + 16} y={504} text="Chance for a random tilt" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={504}
				text={oneIn(transitChance(st, pl))}
				size={13.5}
				weight={650}
				anchor="end"
			/>
		</Readout>
		<Readout id="m-chance">
			<T x={CX + 16} y={534} text="(star’s radius ÷ orbit’s radius)" size={11.5} muted />
		</Readout>
	{/if}
</g>
