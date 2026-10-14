<script lang="ts">
	/**
	 * Reading a planet back from its star's two curves (steps both, mystery).
	 * Left: the light curve of one transit (slow motion, one pass every LOOP s)
	 * and the velocity curve over two orbits (ORBIT_S s per orbit). Right: what
	 * the curves say, worked out by the inverse formulas (`radiusFromDepth`,
	 * `massFromWobble`, `density`). On the mystery step the system is a real
	 * planet from the archive, and the reader measures the curves by dragging
	 * two handles (`measDepth`, `measK`); "Reveal" shows the published values.
	 */
	import { Axes, Handle, scale, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		density,
		flux,
		impactParameter,
		massFromWobble,
		orbitAU,
		periodDays,
		radialVelocity,
		radiusFromDepth,
		radiusRatio,
		rvAmplitude,
		skyPosition,
		transitDepth,
		transitHours,
		transits
	} from '../exoplanets';
	import { fmtAU, measureBounds, mysteryPlanet, mysterySystem, readerSystem } from '../systems';
	import Card from './Card.svelte';
	import T from './T.svelte';
	import { dimming, duration, sig, speed, ticksWithDecimals } from './ui';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mysteryStep = $derived(step.hints?.phase === 'mystery');
	const LOOP = 7;
	const ORBIT_S = 8;

	// ---- layout --------------------------------------------------------------------
	const LX0 = 84;
	const LX1 = 620;
	const LY0 = 66;
	const LY1 = 236;
	const VY0 = 346;
	const VY1 = 516;
	const CX = 656;
	const CW = 288;

	const mysteryId = $derived(String(params.mystery ?? 'hd209458'));
	const sys = $derived(mysteryStep ? mysterySystem(mysteryId) : readerSystem(params));
	const archive = $derived(mysteryStep ? mysteryPlanet(mysteryId) : null);
	const st = $derived(sys.star);
	const pl = $derived(sys.planet);
	const k = $derived(radiusRatio(st, pl));
	const P = $derived(periodDays(st, pl));
	const K = $derived(rvAmplitude(st, pl));
	const hits = $derived(transits(st, pl));
	const depthTrue = $derived(hits ? 1 - flux(st, pl, 0) : 0);
	const grazing = $derived(hits && impactParameter(st, pl) > 1 - k);
	const hours = $derived(transitHours(st, pl));
	const revealed = $derived(Boolean(params.reveal));

	const tt = $derived(reduced ? 2.5 : t);

	// ---- light curve: one transit window ------------------------------------------
	// The window spans 1.6 transit durations (or, with no transit, what a central
	// transit would last), centred on mid-transit.
	const halfWinH = $derived(Math.max(0.8 * (hours || transitHours(st, { ...pl, incl: 90 })), 0.5));
	const halfWin = $derived(halfWinH / 24 / P);
	const lph = $derived((((tt % LOOP) / LOOP) * 2 - 1) * halfWin);
	const scaleDepth = $derived(Math.max(transitDepth(st, pl), 1e-6));
	const yLo = $derived(100 * (1 - 1.5 * scaleDepth));
	const yHi = $derived(100 * (1 + 0.2 * scaleDepth));
	const lsx = $derived(scale([-halfWinH, halfWinH], [LX0, LX1]));
	const lsy = $derived(scale([yLo, yHi], [LY1, LY0]));
	const lyt = $derived(ticksWithDecimals(yLo, 100, 3));
	const lxt = $derived(ticksWithDecimals(-halfWinH, halfWinH, 6));
	const lpts = $derived(
		Array.from({ length: 201 }, (_, i) => {
			const p = -halfWin + (2 * halfWin * i) / 200;
			return { p, f: 100 * flux(st, pl, p) };
		})
	);
	const lpath = (pts: { p: number; f: number }[]) =>
		pts
			.map((q, i) => `${i ? 'L' : 'M'}${lsx(q.p * P * 24).toFixed(1)} ${lsy(q.f).toFixed(1)}`)
			.join(' ');
	const lfull = $derived(lpath(lpts));
	const ldrawn = $derived(
		reduced
			? lfull
			: lpath([...lpts.filter((q) => q.p <= lph), { p: lph, f: 100 * flux(st, pl, lph) }])
	);
	const lnow = $derived({ x: lsx(lph * P * 24), y: lsy(100 * flux(st, pl, lph)) });
	const front = $derived(skyPosition(st, pl, lph).front);

	// ---- velocity curve: two orbits -----------------------------------------------
	const vph = $derived((tt % (2 * ORBIT_S)) / ORBIT_S);
	const vMax = $derived(Math.max(K, 1e-9) * 1.4);
	const vsx = $derived(scale([0, 2 * P], [LX0, LX1]));
	const vsy = $derived(scale([-vMax, vMax], [VY1, VY0]));
	const vyt = $derived(ticksWithDecimals(-K, K, 4));
	const vxt = $derived(ticksWithDecimals(0, 2 * P, 6));
	const vpts = $derived(
		Array.from({ length: 161 }, (_, i) => {
			const p = (2 * i) / 160;
			return { p, v: radialVelocity(st, pl, p) };
		})
	);
	const vpath = (pts: { p: number; v: number }[]) =>
		pts
			.map((q, i) => `${i ? 'L' : 'M'}${vsx(q.p * P).toFixed(1)} ${vsy(q.v).toFixed(1)}`)
			.join(' ');
	const vfull = $derived(vpath(vpts));
	const vdrawn = $derived(
		reduced
			? vfull
			: vpath([...vpts.filter((q) => q.p <= vph), { p: vph, v: radialVelocity(st, pl, vph) }])
	);
	const vnow = $derived({ x: vsx(vph * P), y: vsy(radialVelocity(st, pl, vph)) });

	// ---- the readings: the true curves, or the reader's handles ---------------------
	const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
	const bounds = $derived(measureBounds(mysteryId));
	const depthMax = $derived(bounds[0]);
	const kMax = $derived(bounds[1]);
	const measDepth = $derived(Math.min(depthMax, num(params.measDepth))); // %
	const measK = $derived(Math.min(kMax, num(params.measK))); // m/s
	const readDepth = $derived(mysteryStep ? measDepth / 100 : depthTrue);
	const readK = $derived(mysteryStep ? measK : K);
	const sinI = $derived(Math.sin((pl.incl * Math.PI) / 180));
	// With a transit the orbit is edge-on to within a few degrees: use its sin i
	// (≈ 1). Without one, only the minimum mass is known.
	const sizeRead = $derived(readDepth > 0 ? radiusFromDepth(readDepth, st.radius) : NaN);
	const massRead = $derived(readK > 0 ? massFromWobble(readK, P, st.mass, hits ? sinI : 1) : NaN);
	const dens = $derived(hits && sizeRead > 0 && massRead > 0 ? density(sizeRead, massRead) : NaN);
	const aRead = $derived(orbitAU(P, st.mass));

	function setDepthFrom(p: Point) {
		const v = 100 - lsy.invert(p.y);
		setParam('measDepth', Math.round(Math.min(depthMax, Math.max(0, v)) * 1000) / 1000);
	}
	function setKFrom(p: Point) {
		const v = vsy.invert(p.y);
		setParam('measK', Math.round(Math.min(kMax, Math.max(0, v)) * 10) / 10);
	}
	function keyDepth(s: number | 'start' | 'end') {
		const stepV = depthMax / 100;
		const v = s === 'start' ? 0 : s === 'end' ? depthMax : measDepth + s * stepV;
		setParam('measDepth', Math.round(Math.min(depthMax, Math.max(0, v)) * 1000) / 1000);
	}
	function keyK(s: number | 'start' | 'end') {
		const v = s === 'start' ? 0 : s === 'end' ? kMax : measK + s;
		setParam('measK', Math.min(kMax, Math.max(0, v)));
	}

	// Density references (NASA planetary fact sheets, mean density, g/cm³).
	const REFS = [
		{ id: 'saturn', label: 'Saturn', d: 0.687, above: true, anchor: 'end', dx: 2 },
		{ id: 'jupiter', label: 'Jupiter', d: 1.326, above: false, anchor: 'middle', dx: 0 },
		{ id: 'neptune', label: 'Neptune', d: 1.638, above: true, anchor: 'start', dx: -2 },
		{ id: 'earth', label: 'Earth', d: 5.514, above: true, anchor: 'middle', dx: 0 }
	] as const;
	const DX0 = CX + 20;
	const DX1 = CX + CW - 20;
	const dsx = scale([0, 7], [DX0, DX1]);
	const fmtMass = (m: number) => (isFinite(m) ? `${sig(m)} Earths` : '–');
</script>

<g>
	<!-- ---- light curve ---- -->
	<rect
		x={16}
		y={16}
		width={620}
		height={274}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="l-title">
		<T x={32} y={40} text="Brightness during a transit" size={14} weight={700} />
		<T
			x={620}
			y={40}
			text={hits ? `dips every ${duration(P)}` : 'never dips'}
			size={12}
			anchor="end"
			muted
		/>
	</Readout>
	<Axes
		sx={lsx}
		sy={lsy}
		xTicks={lxt.ticks}
		yTicks={lyt.ticks}
		xFormat={(v) => (Math.abs(v) < 1e-9 ? '0' : v.toFixed(lxt.decimals))}
		yFormat={(v) => `${v.toFixed(lyt.decimals)}%`}
		xLabel="hours from mid-transit"
	/>
	<path d={lfull} fill="none" stroke="var(--ex-light)" stroke-width="1.5" opacity="0.25" />
	<path d={ldrawn} fill="none" stroke="var(--ex-light)" stroke-width="2.4" />
	{#if !reduced && front}
		<circle
			cx={lnow.x}
			cy={lnow.y}
			r="4.5"
			fill="var(--ex-light)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	{/if}
	{#if mysteryStep}
		{@const y = lsy(100 - measDepth)}
		<line
			x1={LX0}
			x2={LX1}
			y1={y}
			y2={y}
			stroke="var(--ex-measure)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<T
			x={LX0 + 8}
			y={y - 7}
			text="your reading: {measDepth.toFixed(2)}% dimmer"
			size={12}
			weight={650}
			color="var(--ex-measure)"
		/>
		<Handle
			x={LX1 - 30}
			{y}
			label="Depth of the dip"
			value={measDepth}
			min={0}
			max={depthMax}
			valuetext="{measDepth.toFixed(2)} percent"
			color="var(--ex-measure)"
			onmove={setDepthFrom}
			onkey={keyDepth}
		/>
	{/if}

	<!-- ---- velocity curve ---- -->
	<rect
		x={16}
		y={300}
		width={620}
		height={284}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Readout id="v-title">
		<T x={32} y={324} text="The star’s speed towards and away from us" size={14} weight={700} />
	</Readout>
	<Axes
		sx={vsx}
		sy={vsy}
		xTicks={vxt.ticks}
		yTicks={vyt.ticks}
		xFormat={(v) => v.toFixed(vxt.decimals)}
		yFormat={(v) => v.toFixed(vyt.decimals)}
		xLabel="days"
	/>
	<line x1={LX0} x2={LX1} y1={vsy(0)} y2={vsy(0)} stroke="var(--stage-line)" />
	<Readout id="m-axes">
		<T x={LX0 + 8} y={VY0 + 4} text="↑ away (m/s)" size={11} muted />
		<T x={LX0 + 8} y={VY1 - 6} text="↓ towards" size={11} muted />
	</Readout>
	<path d={vfull} fill="none" stroke="var(--ex-rv)" stroke-width="1.5" opacity="0.25" />
	<path d={vdrawn} fill="none" stroke="var(--ex-rv)" stroke-width="2.4" />
	{#if !reduced}
		<circle
			cx={vnow.x}
			cy={vnow.y}
			r="4.5"
			fill="var(--ex-rv)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	{/if}
	{#if mysteryStep}
		{@const y = vsy(measK)}
		<line
			x1={LX0}
			x2={LX1}
			y1={y}
			y2={y}
			stroke="var(--ex-measure)"
			stroke-width="1.5"
			stroke-dasharray="6 4"
		/>
		<line
			x1={LX0}
			x2={LX1}
			y1={vsy(-measK)}
			y2={vsy(-measK)}
			stroke="var(--ex-measure)"
			stroke-width="1"
			stroke-dasharray="2 4"
			opacity="0.7"
		/>
		<T
			x={LX1 - 8}
			y={y - 7}
			text="your reading: ±{measK.toFixed(0)} m/s"
			size={12}
			weight={650}
			color="var(--ex-measure)"
			anchor="end"
		/>
		<Handle
			x={vsx(0.75 * P)}
			{y}
			label="Height of the velocity wave"
			value={measK}
			min={0}
			max={kMax}
			valuetext="{measK.toFixed(0)} metres per second"
			color="var(--ex-measure)"
			onmove={setKFrom}
			onkey={keyK}
		/>
	{/if}

	<!-- ---- what the curves say ---- -->
	<Card x={CX} y={16} w={CW} h={mysteryStep ? 300 : 404} />
	<T
		x={CX + 16}
		y={42}
		text={mysteryStep ? 'From your readings' : 'From the curves alone'}
		size={14}
		weight={700}
	/>
	<T
		x={CX + 16}
		y={62}
		text="star: {sig(st.radius, 2)} Suns across, {sig(st.mass, 2)} Suns’ mass"
		size={11.5}
		muted
	/>
	<Readout id="r-period" order={1} label="Period → orbit" value="{duration(P)} → {fmtAU(aRead)} AU">
		<T x={CX + 16} y={90} text="Period → orbit" size={12.5} muted />
		<T
			x={CX + CW - 16}
			y={90}
			text="{duration(P)} → {fmtAU(aRead)} AU"
			size={13}
			weight={650}
			anchor="end"
		/>
	</Readout>
	<Readout
		id="r-size"
		order={2}
		label="Dip → size"
		value={sizeRead > 0
			? `${dimming(readDepth)} → ${sig(sizeRead)} × Earth`
			: 'no dip: size unknown'}
		color="var(--ex-light)"
	>
		<T x={CX + 16} y={118} text="Dip → size" size={12.5} muted />
		<T
			x={CX + CW - 16}
			y={118}
			text={sizeRead > 0
				? `${sig(sizeRead)} × Earth`
				: hits
					? 'drag to read it'
					: 'no dip: unknown'}
			size={13.5}
			weight={700}
			anchor="end"
			color="var(--ex-light)"
		/>
		<T
			x={CX + CW - 16}
			y={136}
			text={sizeRead > 0
				? `${dimming(readDepth)} of the light${grazing && !mysteryStep ? ' (grazing: too small)' : ''}`
				: ''}
			size={11.5}
			anchor="end"
			muted
		/>
	</Readout>
	<Readout
		id="r-mass"
		order={3}
		label={hits ? 'Wobble → mass' : 'Wobble → minimum mass'}
		value={massRead > 0 ? `${speed(readK)} → ${hits ? '' : 'at least '}${fmtMass(massRead)}` : '–'}
		color="var(--ex-rv)"
	>
		<T x={CX + 16} y={164} text={hits ? 'Wobble → mass' : 'Wobble → at least'} size={12.5} muted />
		<T
			x={CX + CW - 16}
			y={164}
			text={massRead > 0 ? fmtMass(massRead) : 'drag to read it'}
			size={13.5}
			weight={700}
			anchor="end"
			color="var(--ex-rv)"
		/>
		<T
			x={CX + CW - 16}
			y={182}
			text={massRead > 0 ? `star moves ±${speed(readK)}${hits ? '' : '; tilt unknown'}` : ''}
			size={11.5}
			anchor="end"
			muted
		/>
	</Readout>
	<Readout
		id="r-density"
		order={4}
		label="Density"
		value={isFinite(dens) ? `${sig(dens, 2)} g/cm³` : 'needs both curves'}
	>
		<T x={CX + 16} y={210} text="Density" size={12.5} muted />
		<T
			x={CX + CW - 16}
			y={210}
			text={isFinite(dens) ? `${sig(dens, 2)} g/cm³` : 'needs both curves'}
			size={13.5}
			weight={700}
			anchor="end"
		/>
	</Readout>
	<!-- density scale with the Solar System's planets -->
	<line x1={DX0} x2={DX1} y1={252} y2={252} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each REFS as r (r.id)}
		<line x1={dsx(r.d)} x2={dsx(r.d)} y1={247} y2={257} stroke="var(--stage-ink-muted)" />
		<T
			x={dsx(r.d) + r.dx}
			y={r.above ? 240 : 272}
			text={r.label}
			size={10.5}
			anchor={r.anchor}
			muted
		/>
	{/each}
	{#if isFinite(dens)}
		<circle
			cx={dsx(Math.min(7, dens))}
			cy={252}
			r="6"
			fill="var(--ex-measure)"
			stroke="var(--surface)"
			stroke-width="1.5"
		/>
	{/if}
	<T x={DX1} y={294} text="g/cm³ (water = 1)" size={10.5} anchor="end" muted />

	{#if !mysteryStep}
		<Readout id="m-note">
			<T x={CX + 16} y={330} text="Gas giants are light for their size;" size={12} />
			<T x={CX + 16} y={348} text="rock and iron planets are dense." size={12} />
			<T x={CX + 16} y={376} text="Tilt the orbit past a few degrees and" size={12} muted />
			<T x={CX + 16} y={394} text="the dip, the size and the density go." size={12} muted />
		</Readout>
	{:else if archive}
		<Card x={CX} y={328} w={CW} h={256} opacity={revealed ? 1 : 0.6} />
		{#if revealed}
			<Readout id="name" order={5} label="It is" value="{archive.name} ({archive.year})">
				<T x={CX + 16} y={354} text={archive.name} size={15} weight={700} />
				<T x={CX + CW - 16} y={354} text="found {archive.year}" size={12} anchor="end" muted />
			</Readout>
			<T x={CX + 16} y={378} text="Published values (NASA Exoplanet Archive):" size={11.5} muted />
			<Readout
				id="pub-size"
				order={6}
				label="Published size"
				value={archive.depthPercent ? `${sig(archive.radius)} × Earth` : 'unknown: no transit'}
			>
				<T x={CX + 16} y={402} text="Size" size={12.5} muted />
				<T
					x={CX + CW - 16}
					y={402}
					text={archive.depthPercent
						? `${sig(archive.radius)} × Earth`
						: 'unknown: it never transits'}
					size={13}
					weight={650}
					anchor="end"
				/>
			</Readout>
			<Readout id="pub-mass" order={7} label="Published mass" value="{sig(archive.mass)} × Earth">
				<T x={CX + 16} y={426} text="Mass" size={12.5} muted />
				<T
					x={CX + CW - 16}
					y={426}
					text="{sig(archive.mass)} × Earth"
					size={13}
					weight={650}
					anchor="end"
				/>
			</Readout>
			<T x={CX + 16} y={450} text="Dip" size={12.5} muted />
			<T
				x={CX + CW - 16}
				y={450}
				text={archive.depthPercent ? `${archive.depthPercent}%` : 'none'}
				size={13}
				weight={650}
				anchor="end"
			/>
			<T x={CX + 16} y={474} text="Wobble" size={12.5} muted />
			<T x={CX + CW - 16} y={474} text="±{archive.rvAmp} m/s" size={13} weight={650} anchor="end" />
			<T x={CX + 16} y={500} text="Sources: {archive.refs.mass}" size={11} muted />
			<T
				x={CX + 16}
				y={516}
				text={archive.depthPercent ? '' : 'Its tilt was found later, from its own'}
				size={11}
				muted
			/>
			<T
				x={CX + 16}
				y={532}
				text={archive.depthPercent ? '' : 'light: the mass above is the true one.'}
				size={11}
				muted
			/>
		{:else}
			<T x={CX + 16} y={360} text="Which planet is it?" size={14} weight={700} />
			<T x={CX + 16} y={386} text="Drag the two pink handles onto" size={12} />
			<T x={CX + 16} y={404} text="the curves, then reveal the planet" size={12} />
			<T x={CX + 16} y={422} text="to compare with the published values." size={12} />
		{/if}
	{/if}
</g>
