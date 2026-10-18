<script lang="ts">
	/**
	 * A probe dropped at rest in the turning frame on the small body's orbit, near L4, over the
	 * whole system. `mode` 'tadpole': the pair from the `system` select, the drop point dragged
	 * along the orbit (the `lead` slider, degrees ahead of the small body); the run lasts about four
	 * libration periods (2π/√(27μ/4) to first order), revealed over 40 s. 'routh': a pair with the
	 * `routhMu` slider's mass ratio, the probe 1° ahead of L4, 120 turns revealed over 24 s; the
	 * panel compares 27μ(1 − μ) with 1 and says whether the probe stayed.
	 */
	import { untrack } from 'svelte';
	import { Handle, Label, clamp } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { ROUTH, angleFromBig, lagrangePoints, onOrbit } from '../model';
	import Pair from './Pair.svelte';
	import {
		C,
		MAIN,
		fmtMu,
		fmtTime,
		oneIn,
		pathD,
		pick,
		presetLogMu,
		radii,
		runCached,
		sx,
		sy,
		type Picked,
		type View
	} from './shared';

	let { step, t, params, reduced, setParam }: StageProps = $props();

	const mode = $derived(step.hints?.mode === 'routh' ? 'routh' : 'tadpole');
	const routhMu = $derived(clamp(Number(params.routhMu ?? 0.03), 0.005, 0.06));
	const P: Picked = $derived(
		mode === 'routh'
			? { sys: null, mu: routhMu, name: 'your pair', big: 'large body', small: 'small body' }
			: pick(params)
	);
	const mu = $derived(P.mu);
	const presetLm = $derived(mode === 'tadpole' && P.sys ? presetLogMu(P.sys.mu) : null);
	$effect(() => {
		const lm = presetLm;
		if (lm !== null) untrack(() => setParam('logmu', lm));
	});

	const L = $derived(lagrangePoints(mu));
	const lead = $derived(
		mode === 'routh' ? 61 : clamp(Math.round(Number(params.lead ?? 66)), 61, 175)
	);
	const stable = $derived(mu < ROUTH);

	/** Libration period to first order, frame units. */
	const tLib = $derived((2 * Math.PI) / Math.sqrt((27 * mu) / 4));
	const tEnd = $derived(
		mode === 'routh' ? 2 * Math.PI * 120 : Math.min(6000, 4 * tLib * (1 + (lead - 60) / 120))
	);
	const N = 2401;
	const path = $derived(
		runCached(mu, onOrbit(mu, lead), tEnd, N, { ...radii(P), far: 3, k: 0.02 })
	);

	const RUN_SECONDS = $derived(mode === 'routh' ? 24 : 40);
	const shown = $derived(
		reduced ? path.n : Math.max(2, Math.ceil(clamp((t - 0.5) / RUN_SECONDS) * path.n))
	);
	const iNow = $derived(Math.max(0, shown - 1));
	const head = $derived({ X: sx(MAIN, path.xy[2 * iNow]), Y: sy(MAIN, path.xy[2 * iNow + 1]) });

	// how far it has strayed: the angles it swept, and its distance from L4
	const sweep = $derived.by(() => {
		let lo = 360;
		let hi = -360;
		let far = 0;
		let leftAt = -1;
		for (let i = 0; i < shown; i++) {
			const x = path.xy[2 * i];
			const y = path.xy[2 * i + 1];
			let a = angleFromBig(mu, x, y);
			if (a < -90) a += 360;
			lo = Math.min(lo, a);
			hi = Math.max(hi, a);
			const d = Math.hypot(x - L.L4.x, y - L.L4.y);
			far = Math.max(far, d);
			if (leftAt < 0 && d > 0.5) leftAt = i;
		}
		return { lo, hi, far, leftAt };
	});
	const escaped = $derived(sweep.leftAt >= 0 || path.end !== null);
	const turnsAt = (i: number) => path.t[i] / (2 * Math.PI);

	// ---- the drop handle on the orbit -------------------------------------------
	const dropP = $derived(onOrbit(mu, lead));
	const dropX = $derived(sx(MAIN, dropP[0]));
	const dropY = $derived(sy(MAIN, dropP[1]));
	function angleOfPointer(p: { x: number; y: number }) {
		const x = (p.x - MAIN.cx) / MAIN.k + mu;
		const y = -(p.y - MAIN.cy) / MAIN.k;
		return clamp(Math.round((Math.atan2(y, x) * 180) / Math.PI), 61, 175);
	}

	// ---- a zoom round L4 (routh) --------------------------------------------------
	const ZBOX = { x0: 652, y0: 398, x1: 940, y1: 576 };
	const zoom: View = $derived({
		cx: (ZBOX.x0 + ZBOX.x1) / 2,
		cy: (ZBOX.y0 + ZBOX.y1) / 2,
		ox: L.L4.x,
		oy: L.L4.y,
		k: (ZBOX.x1 - ZBOX.x0) / 0.36,
		...ZBOX
	});
	const zHead = $derived({ X: sx(zoom, path.xy[2 * iNow]), Y: sy(zoom, path.xy[2 * iNow + 1]) });
	const zIn = $derived(
		zHead.X > ZBOX.x0 && zHead.X < ZBOX.x1 && zHead.Y > ZBOX.y0 && zHead.Y < ZBOX.y1
	);

	const bigR = $derived(clamp(9 + 8 * (1 - mu), 9, 16));
	const smallR = $derived(clamp(4 + 14 * Math.cbrt(mu), 4, 14));
	const product = $derived(27 * mu * (1 - mu));
	const elapsed = $derived(fmtTime(P, path.t[iNow]));
</script>

<g>
	<defs>
		<clipPath id="lg-trojan-clip">
			<rect x={MAIN.x0} y={MAIN.y0} width={MAIN.x1 - MAIN.x0} height={MAIN.y1 - MAIN.y0} rx="12" />
		</clipPath>
	</defs>
	<g clip-path="url(#lg-trojan-clip)">
		<circle
			cx={sx(MAIN, 0)}
			cy={sy(MAIN, 0)}
			r={(1 - mu) * MAIN.k}
			fill="none"
			stroke={C.orbit}
			stroke-width="1"
			stroke-dasharray="4 5"
		/>
		<path
			d={pathD(MAIN, path, 0, shown)}
			fill="none"
			stroke={C.probe}
			stroke-width="1.3"
			opacity="0.8"
			stroke-linejoin="round"
		/>
		<Pair v={MAIN} {mu} big={P.big} small={P.small} rBig={bigR} rSmall={smallR} focus={['L4']} />
		<circle
			cx={head.X}
			cy={head.Y}
			r="6"
			fill={C.probe}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	</g>
	<rect
		x={MAIN.x0}
		y={MAIN.y0}
		width={MAIN.x1 - MAIN.x0}
		height={MAIN.y1 - MAIN.y0}
		rx="12"
		fill="none"
		stroke="var(--stage-line)"
	/>
	{#if mode === 'tadpole'}
		<!-- where the probe was dropped -->
		<circle cx={dropX} cy={dropY} r="4" fill="none" stroke={C.probe} stroke-width="1.5" />
		<Handle
			x={dropX}
			y={dropY}
			label="Drop point along the orbit"
			value={lead}
			min={61}
			max={175}
			valuetext="{lead} degrees ahead of the {P.small}"
			color={C.probe}
			r={8}
			onmove={(p: { x: number; y: number }) => setParam('lead', angleOfPointer(p))}
			onkey={(s: number | 'start' | 'end') =>
				setParam('lead', s === 'start' ? 61 : s === 'end' ? 175 : clamp(lead + s, 61, 175))}
		/>
	{/if}
	<Readout id="trojan-title">
		<Label
			x={MAIN.x0 + 14}
			y={MAIN.y0 + 24}
			anchor="start"
			text="{mode === 'routh' ? `μ = ${fmtMu(mu)}` : P.name} · turning frame"
			size={13}
			weight={600}
		/>
	</Readout>

	<!-- panel -->
	<rect
		x="652"
		y="70"
		width="288"
		height="292"
		rx="10"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if mode === 'routh'}
		<Readout id="routh-mu" order={1} label="Mass ratio" value="μ = {fmtMu(mu)}, {oneIn(mu)}">
			<Label
				x={668}
				y={100}
				anchor="start"
				text="μ = {fmtMu(mu)} · {oneIn(mu)}"
				size={15}
				weight={700}
				halo={false}
				tabular
			/>
		</Readout>
		<Readout
			id="routh-test"
			order={2}
			label="27μ(1 − μ)"
			value="{product.toFixed(3)} {product < 1 ? '< 1: stable' : '> 1: unstable'}"
			color={stable ? C.stable : C.point}
		>
			<Label
				x={668}
				y={128}
				anchor="start"
				text="27μ(1 − μ) = {product.toFixed(3)} {product < 1 ? '< 1' : '> 1'}"
				size={13}
				halo={false}
				tabular
			/>
			<Label
				x={668}
				y={150}
				anchor="start"
				text={stable ? 'L4 is stable (linear theory)' : 'L4 is unstable (linear theory)'}
				size={13}
				weight={600}
				color={stable ? C.stableText : C.pointText}
				halo={false}
			/>
		</Readout>
		<Label
			x={668}
			y={184}
			anchor="start"
			text="the probe, dropped 1° ahead of L4:"
			size={12}
			muted
			halo={false}
		/>
	{:else}
		<Readout id="tad-pair" order={1} label="Pair" value="{P.name}, μ = {fmtMu(mu)}">
			<Label x={668} y={100} anchor="start" text={P.name} size={15} weight={700} halo={false} />
			<Label
				x={668}
				y={122}
				anchor="start"
				text="μ = {fmtMu(mu)} · {oneIn(mu)} · {stable ? 'below' : 'above'} Routh’s limit"
				size={12}
				muted
				halo={false}
				tabular
			/>
		</Readout>
		<Readout id="tad-drop" order={2} label="Dropped" value="{lead}° ahead of the {P.small}">
			<Label
				x={668}
				y={150}
				anchor="start"
				text="dropped {lead}° ahead of the {P.small}"
				size={13}
				halo={false}
				tabular
			/>
		</Readout>
		<Readout id="tad-lib">
			<Label
				x={668}
				y={184}
				anchor="start"
				text="one small swing ≈ {fmtTime(P, tLib)}"
				size={12}
				muted
				halo={false}
				tabular
			/>
		</Readout>
	{/if}
	<Readout id="tro-time" order={3} label="Time" value={elapsed}>
		<Label
			x={668}
			y={216}
			anchor="start"
			text="after {elapsed}"
			size={14}
			weight={700}
			halo={false}
			tabular
		/>
	</Readout>
	{#if escaped}
		<Readout
			id="tro-fate"
			order={4}
			label="Probe"
			value="left L4 after {fmtTime(P, path.t[Math.max(0, sweep.leftAt)])}"
			color={C.point}
		>
			<Label
				x={668}
				y={242}
				anchor="start"
				text={path.end === 'hit-big' || path.end === 'hit-small'
					? `it hit the ${path.end === 'hit-big' ? P.big : P.small}`
					: `it left L4 after ${fmtTime(P, path.t[Math.max(0, sweep.leftAt)])}`}
				size={13}
				weight={600}
				color={C.pointText}
				halo={false}
				tabular
			/>
			<Label
				x={668}
				y={262}
				anchor="start"
				text="({turnsAt(Math.max(0, sweep.leftAt)).toFixed(0)} orbits of the {P.small})"
				size={12}
				muted
				halo={false}
				tabular
			/>
		</Readout>
	{:else}
		<Readout
			id="tro-fate"
			order={4}
			label="Probe"
			value="still round L4, between {sweep.lo.toFixed(0)}° and {sweep.hi.toFixed(0)}°"
			color={C.stable}
		>
			<Label
				x={668}
				y={242}
				anchor="start"
				text="still circling L4"
				size={13}
				weight={600}
				color={C.stableText}
				halo={false}
			/>
			<Label
				x={668}
				y={262}
				anchor="start"
				text="between {sweep.lo.toFixed(0)}° and {sweep.hi.toFixed(0)}° ahead of the {P.small}"
				size={12}
				muted
				halo={false}
				tabular
			/>
		</Readout>
	{/if}
	<Readout id="tro-key">
		<Label
			x={668}
			y={296}
			anchor="start"
			text="filled: a stable point; open: unstable"
			size={11}
			muted
			halo={false}
		/>
		<Label x={668} y={314} anchor="start" text="bodies not to scale" size={11} muted halo={false} />
		{#if mode === 'tadpole'}
			<Label
				x={668}
				y={340}
				anchor="start"
				text="drag the ring to drop the probe elsewhere"
				size={11}
				muted
				halo={false}
			/>
		{/if}
	</Readout>
	{#if mode === 'routh'}
		<defs>
			<clipPath id="lg-zoom-clip">
				<rect
					x={ZBOX.x0}
					y={ZBOX.y0}
					width={ZBOX.x1 - ZBOX.x0}
					height={ZBOX.y1 - ZBOX.y0}
					rx="10"
				/>
			</clipPath>
		</defs>
		<g clip-path="url(#lg-zoom-clip)">
			<rect
				x={ZBOX.x0}
				y={ZBOX.y0}
				width={ZBOX.x1 - ZBOX.x0}
				height={ZBOX.y1 - ZBOX.y0}
				fill="var(--stage-bg)"
			/>
			<circle
				cx={sx(zoom, 0)}
				cy={sy(zoom, 0)}
				r={(1 - mu) * zoom.k}
				fill="none"
				stroke={C.orbit}
				stroke-width="1"
				stroke-dasharray="4 5"
			/>
			<path
				d={pathD(zoom, path, 0, shown)}
				fill="none"
				stroke={C.probe}
				stroke-width="1.2"
				opacity="0.8"
			/>
			<circle
				cx={zoom.cx}
				cy={zoom.cy}
				r="5.5"
				fill={stable ? C.stable : 'var(--stage-bg)'}
				stroke={stable ? C.stable : C.point}
				stroke-width="2"
			/>
			{#if zIn}
				<circle
					cx={zHead.X}
					cy={zHead.Y}
					r="5"
					fill={C.probe}
					stroke="var(--stage-bg)"
					stroke-width="1.5"
				/>
			{/if}
		</g>
		<rect
			x={ZBOX.x0}
			y={ZBOX.y0}
			width={ZBOX.x1 - ZBOX.x0}
			height={ZBOX.y1 - ZBOX.y0}
			rx="10"
			fill="none"
			stroke="var(--stage-line)"
		/>
		<Readout id="zoom-title">
			<Label
				x={ZBOX.x0 + 4}
				y={ZBOX.y0 - 10}
				anchor="start"
				text="round L4, zoomed in"
				size={12}
				weight={600}
			/>
		</Readout>
	{/if}
</g>
