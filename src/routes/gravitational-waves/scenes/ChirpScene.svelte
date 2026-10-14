<script lang="ts">
	/**
	 * The inspiral of two black holes of `params.m1`, `params.m2` suns (gw.ts,
	 * leading order), up to the innermost stable circular orbit (ISCO, t = 0).
	 *
	 * Top left: the orbit seen from above, to scale with the horizons, at the
	 * moment of the playhead. Top right: readouts. Bottom: a plot over the last
	 * 0.3 s before the ISCO and 40 ms after, revealed by the playhead, which runs
	 * 30 times slower than real time (9 s), then holds 2 s and starts again.
	 *
	 * Phases (`step.hints.phase`):
	 *   inspiral — the strain at 410 Mpc against time
	 *   track    — the frequency against time (log scale); `params.sameMc` adds an
	 *              equal-mass pair of the same chirp mass (dashed)
	 *   merger   — the strain, the blank merger, and the remnant from fits to
	 *              numerical relativity (mass, spin, ringing); after the ISCO the
	 *              orbit is replaced by the remnant's horizon
	 *   arrival  — the strain at `params.dist` Mpc
	 * `params.hear` plays the last ≤ 4 s before the ISCO (from 20 Hz) as sound,
	 * `params.pitch` two octaves higher. Reduced motion: the whole trace, the
	 * playhead at the ISCO.
	 */
	import { untrack } from 'svelte';
	import { linePath, scale, niceMax } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		C,
		L_SUN,
		M_SUN,
		MPC,
		chirpMass,
		chirpSamples,
		cycles,
		finalMass,
		finalSpin,
		horizonRadius,
		inspiral,
		iscoFrequency,
		minTotalMass,
		radiatedMass,
		ringdown,
		strain
	} from '../gw';
	import Card from './Card.svelte';
	import Row from './Row.svelte';
	import T from './T.svelte';
	import Title from './Title.svelte';
	import { sci, sup, whole } from './fmt';
	import { playSamples, stopAll } from './sound';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'inspiral'));
	const m1 = $derived(Number(params.m1 ?? 36));
	const m2 = $derived(Number(params.m2 ?? 29));
	const dMpc = $derived(phase === 'arrival' ? Number(params.dist ?? 410) : 410);

	const sameMc = $derived(Boolean(params.sameMc) && phase === 'track');

	// ---- the model ----------------------------------------------------------------------
	const ins = $derived(inspiral(m1, m2));
	const mc = $derived(chirpMass(m1, m2));
	const hAt = (f: number) => strain(f, mc, dMpc * MPC);
	const Mf = $derived(finalMass(m1, m2));
	const spin = $derived(finalSpin(m1, m2));
	const ring = $derived(ringdown(Mf, spin));
	const BAND = 30; // Hz: below this, ground noise swamps the detectors
	const tBand = $derived(-ins.timeOf(BAND));
	const nBand = $derived(cycles(BAND, ins.fIsco, mc));

	// ---- time -----------------------------------------------------------------------------
	const zoomed = $derived(phase === 'merger');
	const T0 = $derived(zoomed ? -0.06 : -0.3); // s before the ISCO
	const T1 = $derived(zoomed ? 0.03 : 0.05);
	const SLOW = $derived(zoomed ? 80 : 30);
	const LOOP = $derived((T1 - T0) * SLOW + 2);
	const TICKS = $derived(zoomed ? [-0.06, -0.04, -0.02, 0, 0.02] : [-0.3, -0.2, -0.1, 0]);
	/** Time of the playhead, s relative to the ISCO. */
	const ts = $derived(reduced ? 0 : Math.min(T1, T0 + (t % LOOP) / SLOW));

	// ---- layout ---------------------------------------------------------------------------
	const OX = 16;
	const OY = 16;
	const OW = 452;
	const OH = 314;
	const OCX = OX + OW / 2;
	const OCY = OY + OH / 2 + 6;
	const KX = 484;
	const KW = 460;
	const PX0 = 86;
	const PX1 = 920;
	const PY0 = 378;
	const PY1 = 540;

	const sx = $derived(scale([T0, T1], [PX0, PX1]));

	// strain trace, sampled once per setting
	const N = 1600;
	const trace = $derived.by(() => {
		const pts: { t: number; h: number; f: number }[] = [];
		for (let i = 0; i <= N; i++) {
			const tt = T0 + (-T0 * i) / N;
			const f = ins.frequency(tt);
			pts.push({ t: tt, f, h: hAt(f) * Math.cos(ins.phase(tt)) });
		}
		return pts;
	});
	// niceMax works on ordinary numbers: scale to a power of ten first
	const hUnit = $derived(10 ** Math.floor(Math.log10(hAt(ins.fIsco) * 1.05)));
	const hMax = $derived(niceMax((hAt(ins.fIsco) * 1.05) / hUnit) * hUnit);
	const sy = $derived(scale([-hMax, hMax], [PY1, PY0]));
	const strainPath = $derived(
		linePath(
			trace,
			(d) => d.t,
			(d) => d.h,
			sx,
			sy
		)
	);
	const envPath = $derived(
		linePath(
			trace,
			(d) => d.t,
			(d) => hAt(d.f),
			sx,
			sy
		) +
			linePath(
				trace,
				(d) => d.t,
				(d) => -hAt(d.f),
				sx,
				sy
			).replace('M', 'M')
	);

	// frequency track (log scale)
	/** Top of the frequency axis: a round value above the highest ISCO shown. */
	const F1 = $derived(
		[50, 100, 150, 250].find(
			(v) => v >= 1.1 * Math.max(ins.fIsco, sameMc ? iscoFrequency(minTotalMass(mc)) : 0)
		) ?? 250
	);
	const fTicks = $derived(Array.from({ length: 6 }, (_, i) => (F1 * i) / 5));
	const lf = (f: number) => PY1 - ((PY1 - PY0) * Math.min(f, F1)) / F1;
	const trackOf = (i: ReturnType<typeof inspiral>) => {
		let d = '';
		for (let k = 0; k <= 200; k++) {
			const tt = T0 + (-T0 * k) / 200;
			const f = i.frequency(tt);
			d += `${d ? 'L' : 'M'}${sx(tt).toFixed(1)} ${lf(f).toFixed(1)}`;
		}
		return d;
	};
	const track = $derived(trackOf(ins));
	/** Equal-mass pair with the same chirp mass (or a 1:4 pair if this one is equal). */
	const twin = $derived.by(() => {
		const q = Math.abs(m1 - m2) < 0.5 ? 0.25 : 1;
		const a = (mc * (1 + q) ** 0.2) / q ** 0.6;
		const b = q * a;
		const i = inspiral(a, b);
		// same chirp mass, so same frequency at the same time before coalescence: shift
		// its time axis so the two coalesce together
		const shift = i.tauIsco - ins.tauIsco;
		let d = '';
		for (let k = 0; k <= 200; k++) {
			const tt = T0 + ((T1 + shift - T0) * k) / 200;
			const tau = ins.tauIsco - tt; // time to coalescence on this plot's clock
			const ti = i.tauIsco - tau;
			if (ti > 0) break;
			const f = i.frequency(ti);
			d += `${d ? 'L' : 'M'}${sx(Math.min(T1, tt)).toFixed(1)} ${lf(f).toFixed(1)}`;
		}
		return { a, b, d, fIsco: i.fIsco, tIsco: Math.min(T1, shift) };
	});

	// ---- the orbit at the playhead ----------------------------------------------------------
	const merged = $derived(ts > 0);
	const orbit = $derived.by(() => {
		const tt = Math.min(0, ts);
		const a = ins.separation(tt);
		const ang = ins.phase(tt) / 2;
		return { a, ang, f: ins.frequency(tt) };
	});
	/** px per metre, so that the widest orbit of the plot fills the panel. */
	const k = $derived(128 / ins.separation(T0));
	const body = $derived.by(() => {
		const { a, ang } = orbit;
		const M = m1 + m2;
		const c = Math.cos(ang);
		const s = Math.sin(ang);
		const r1 = (a * m2) / M;
		const r2 = (a * m1) / M;
		return [
			{ id: 1, x: OCX + k * r1 * c, y: OCY - k * r1 * s, r: k * horizonRadius(m1) },
			{ id: 2, x: OCX - k * r2 * c, y: OCY + k * r2 * s, r: k * horizonRadius(m2) }
		];
	});
	const vOverC = $derived(Math.sqrt(((m1 + m2) * L_SUN) / orbit.a));
	/**
	 * Crests of the waves in the orbital plane, at their true scale: a crest at
	 * distance r left the pair r/c earlier, so it points along half the wave phase
	 * then (two arms). Waves emitted after the ISCO are not modelled: none drawn.
	 */
	const crests = $derived.by(() => {
		const arms: { key: number; d: string }[] = [];
		const r0 = Math.max(12, k * orbit.a * 0.6);
		for (const n of [0, 1]) {
			let d = '';
			for (let r = r0; r <= 330; r += 6) {
				const tr = ts - r / (k * C);
				if (tr > 0 || tr < T0 - 0.2) continue;
				const ph = (ins.phase(tr) + 2 * Math.PI * n) / 2;
				d += `${d ? 'L' : 'M'}${(OCX + r * Math.cos(ph)).toFixed(1)} ${(OCY - r * Math.sin(ph)).toFixed(1)}`;
			}
			arms.push({ key: n, d });
		}
		return arms;
	});
	/** A scale bar: a round number of km near a fifth of the panel. */
	const bar = $derived.by(() => {
		const km = 90 / k / 1000;
		const nice = [10, 20, 50, 100, 200, 500, 1000, 2000].find((v) => v >= km * 0.6) ?? 1000;
		return { km: nice, px: nice * 1000 * k };
	});

	// ---- sound -----------------------------------------------------------------------------
	let lastHear: number | undefined;
	$effect(() => {
		const c = Number(params.hear ?? 0);
		untrack(() => {
			if (lastHear !== undefined && c !== lastHear) {
				const rate = 22050;
				const start = Math.max(-4, ins.timeOf(20));
				playSamples(chirpSamples(m1, m2, start, rate, params.pitch ? 4 : 1), rate);
			}
			lastHear = c;
		});
	});
	$effect(() => {
		void step.id;
		return () => stopAll();
	});

	const ms = (s: number) => (s < 1 ? `${(s * 1000).toFixed(0)} ms` : `${s.toFixed(1)} s`);
	const fmtHz = (f: number) => `${f < 100 ? f.toFixed(1) : f.toFixed(0)} Hz`;
	const yTicks = $derived([-hMax, -hMax / 2, 0, hMax / 2, hMax]);
</script>

<g>
	<defs>
		<clipPath id="chirp-orbit">
			<rect x={OX} y={OY} width={OW} height={OH} rx="14" />
		</clipPath>
		<clipPath id="chirp-reveal">
			<rect
				x={PX0 - 2}
				y={PY0 - 10}
				width={Math.max(0, sx(Math.min(0, ts)) - PX0 + 2)}
				height={PY1 - PY0 + 20}
			/>
		</clipPath>
	</defs>

	<!-- the orbit -->
	<rect
		x={OX}
		y={OY}
		width={OW}
		height={OH}
		rx="14"
		fill="var(--gw-space)"
		stroke="var(--border)"
	/>
	<g clip-path="url(#chirp-orbit)">
		{#each crests as cr (cr.key)}
			<path
				d={cr.d}
				fill="none"
				stroke="var(--gw-crest)"
				stroke-width="2"
				stroke-linecap="round"
				opacity="0.45"
			/>
		{/each}
	</g>
	{#if !merged}
		<circle
			cx={OCX}
			cy={OCY}
			r={(k * orbit.a * m2) / (m1 + m2)}
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="3 5"
		/>
		<circle
			cx={OCX}
			cy={OCY}
			r={(k * orbit.a * m1) / (m1 + m2)}
			fill="none"
			stroke="var(--stage-line)"
			stroke-dasharray="3 5"
		/>
		{#each body as b (b.id)}
			<circle
				cx={b.x}
				cy={b.y}
				r={Math.max(2.5, b.r)}
				fill="var(--gw-hole)"
				stroke="var(--gw-horizon)"
				stroke-width="1.5"
			/>
		{/each}
	{:else}
		<circle
			cx={OCX}
			cy={OCY}
			r={Math.max(2.5, k * horizonRadius(Mf))}
			fill="var(--gw-hole)"
			stroke="var(--gw-horizon)"
			stroke-width="1.5"
		/>
		<Readout id="merged">
			<T
				x={OCX}
				y={OCY + k * horizonRadius(Mf) + 24}
				text="merged: one black hole"
				anchor="middle"
				size={12.5}
				weight={600}
			/>
		</Readout>
	{/if}
	<Readout id="orbit-cap">
		<T
			x={OX + 16}
			y={OY + 26}
			text="From above, to scale: horizons and wave crests"
			size={12.5}
			weight={650}
		/>
		<T x={OX + 16} y={OY + OH - 14} text="slowed down {SLOW}×" size={12} muted />
		<line
			x1={OX + OW - 16 - bar.px}
			x2={OX + OW - 16}
			y1={OY + OH - 26}
			y2={OY + OH - 26}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<T x={OX + OW - 16} y={OY + OH - 10} text="{bar.km} km" anchor="end" size={12} muted />
	</Readout>

	<!-- readouts -->
	<Card x={KX} y={OY} w={KW} h={OH} />
	<Title x={KX + 18} y={OY + 30} text="{m1} + {m2} suns" size={16} weight={700} />
	{#if phase === 'inspiral' || phase === 'arrival'}
		<Row
			id="mc"
			order={1}
			x={KX + 18}
			y={OY + 64}
			w={KW - 36}
			label="Chirp mass"
			value="{mc.toFixed(1)} suns"
		/>
		<Row
			id="fnow"
			order={2}
			x={KX + 18}
			y={OY + 94}
			w={KW - 36}
			label={merged ? 'Wave frequency at the ISCO' : 'Wave frequency now'}
			value={fmtHz(orbit.f)}
			color="var(--gw-crest)"
		/>
		<Row
			id="sep"
			order={3}
			x={KX + 18}
			y={OY + 124}
			w={KW - 36}
			label="Separation"
			value="{whole(orbit.a / 1000)} km"
		/>
		<Row
			id="v"
			order={4}
			x={KX + 18}
			y={OY + 154}
			w={KW - 36}
			label="Orbital speed"
			value="{vOverC.toFixed(2)} c"
		/>
		{#if phase === 'inspiral'}
			<Row
				id="left"
				order={5}
				x={KX + 18}
				y={OY + 184}
				w={KW - 36}
				label="Time left to the ISCO"
				value={merged ? 'reached' : ms(-Math.min(0, ts))}
			/>
			<Row
				id="hnow"
				order={6}
				x={KX + 18}
				y={OY + 214}
				w={KW - 36}
				label="Strain at 410 Mpc (face-on)"
				value={sci(hAt(orbit.f), 2)}
			/>
		{:else}
			<Row
				id="dist"
				order={5}
				x={KX + 18}
				y={OY + 184}
				w={KW - 36}
				label="Distance"
				value="{whole(dMpc)} Mpc"
			/>
			<Row
				id="hisco"
				order={6}
				x={KX + 18}
				y={OY + 214}
				w={KW - 36}
				label="Strain at the ISCO (face-on, overhead)"
				value={sci(hAt(ins.fIsco), 2)}
				color="var(--gw-crest)"
			/>
			<Row
				id="dl"
				order={7}
				x={KX + 18}
				y={OY + 244}
				w={KW - 36}
				label="Change of a 4 km arm"
				value="{sci(hAt(ins.fIsco) * 4000, 2)} m"
				color="var(--gw-dl)"
			/>
		{/if}
		<Readout id="hint">
			<T
				x={KX + 18}
				y={OY + OH - 18}
				text="Press ▶ Hear the chirp: it ends at the ISCO."
				size={12}
				muted
			/>
		</Readout>
	{:else if phase === 'track'}
		<Row
			id="mc"
			order={1}
			x={KX + 18}
			y={OY + 64}
			w={KW - 36}
			label="Chirp mass"
			value="{mc.toFixed(1)} suns"
			color="var(--gw-crest)"
		/>
		<Row
			id="band"
			order={2}
			x={KX + 18}
			y={OY + 94}
			w={KW - 36}
			label="From 30 Hz to the ISCO"
			value={ms(tBand)}
		/>
		<Row
			id="cyc"
			order={3}
			x={KX + 18}
			y={OY + 124}
			w={KW - 36}
			label="Cycles in that time"
			value={whole(nBand)}
		/>
		<Row
			id="isco"
			order={4}
			x={KX + 18}
			y={OY + 154}
			w={KW - 36}
			label="Ends at the ISCO"
			value={fmtHz(ins.fIsco)}
		/>
		{#if sameMc}
			<Row
				id="twin"
				order={5}
				x={KX + 18}
				y={OY + 194}
				w={KW - 36}
				label="Same chirp mass"
				value="{twin.a.toFixed(1)} + {twin.b.toFixed(1)} suns"
				color="var(--gw-compare)"
			/>
			<Row
				id="twin-isco"
				order={6}
				x={KX + 18}
				y={OY + 224}
				w={KW - 36}
				label="Its ISCO"
				value={fmtHz(twin.fIsco)}
				color="var(--gw-compare)"
			/>
		{/if}
		<Readout id="formula">
			<T
				x={KX + 18}
				y={OY + OH - 18}
				text="df/dt = (96/5) π^(8/3) (G𝓜/c³)^(5/3) f^(11/3)"
				size={12.5}
				muted
			/>
		</Readout>
	{:else}
		<Row
			id="isco"
			order={1}
			x={KX + 18}
			y={OY + 64}
			w={KW - 36}
			label="Inspiral ends (ISCO)"
			value={fmtHz(ins.fIsco)}
		/>
		<Row
			id="final"
			order={2}
			x={KX + 18}
			y={OY + 94}
			w={KW - 36}
			label="Final black hole"
			value="{Mf.toFixed(1)} suns"
		/>
		<Row
			id="rad"
			order={3}
			x={KX + 18}
			y={OY + 124}
			w={KW - 36}
			label="Radiated as waves"
			value="{radiatedMass(m1, m2).toFixed(2)} suns · {sci(
				radiatedMass(m1, m2) * M_SUN * C * C,
				2
			)} J"
			color="var(--gw-crest)"
		/>
		<Row
			id="spin"
			order={4}
			x={KX + 18}
			y={OY + 154}
			w={KW - 36}
			label="Final spin"
			value="{spin.toFixed(2)} of the maximum"
		/>
		<Row
			id="ring"
			order={5}
			x={KX + 18}
			y={OY + 184}
			w={KW - 36}
			label="Rings at"
			value="{fmtHz(ring.f)}, dying away in {(ring.tau * 1000).toFixed(1)} ms"
		/>
		<Readout id="fits">
			<T
				x={KX + 18}
				y={OY + OH - 36}
				text="Remnant: fits to numerical-relativity simulations"
				size={12}
				muted
			/>
			<T
				x={KX + 18}
				y={OY + OH - 18}
				text="(black holes not spinning before they merge)"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- the plot -->
	<rect
		x={OX}
		y={346}
		width={928}
		height={238}
		rx="14"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<!-- after the ISCO: not modelled -->
	<rect x={sx(0)} y={PY0} width={PX1 - sx(0)} height={PY1 - PY0} fill="var(--gw-blank)" />
	<Readout id="blank">
		<T
			x={(sx(0) + PX1) / 2}
			y={(PY0 + PY1) / 2 - 8}
			text="merger"
			anchor="middle"
			size={12}
			weight={600}
			muted
		/>
		<T
			x={(sx(0) + PX1) / 2}
			y={(PY0 + PY1) / 2 + 8}
			text="(supercomputers)"
			anchor="middle"
			size={11}
			muted
		/>
		{#if zoomed}
			<T
				x={(sx(0) + PX1) / 2}
				y={(PY0 + PY1) / 2 + 40}
				text="then rings at {fmtHz(ring.f)} for a few ms"
				anchor="middle"
				size={11.5}
				muted
			/>
		{/if}
	</Readout>
	<line
		x1={sx(0)}
		x2={sx(0)}
		y1={PY0 - 6}
		y2={PY1}
		stroke="var(--gw-trough)"
		stroke-dasharray="4 4"
	/>
	<Readout id="isco-mark">
		<T
			x={sx(0) - 4}
			y={PY0 - 10}
			text="ISCO"
			anchor="end"
			size={12}
			weight={650}
			color="var(--gw-trough)"
		/>
	</Readout>

	{#if phase === 'track'}
		<!-- frequency, linear scale -->
		{#each fTicks as f (f)}
			<line x1={PX0} x2={sx(0)} y1={lf(f)} y2={lf(f)} stroke="var(--stage-grid)" />
			<T x={PX0 - 8} y={lf(f) + 4} text={String(f)} anchor="end" size={11.5} muted />
		{/each}
		<rect
			x={PX0}
			y={lf(BAND)}
			width={sx(0) - PX0}
			height={PY1 - lf(BAND)}
			fill="var(--gw-trough)"
			opacity="0.07"
		/>
		<Readout id="band-cap">
			<T x={PX0 + 8} y={PY1 - 6} text="below 30 Hz: hidden by ground noise" size={11} muted />
		</Readout>
		<T x={PX0 - 50} y={PY0 - 12} text="frequency, Hz" size={12} muted />
		{#if sameMc}
			<path
				d={twin.d}
				fill="none"
				stroke="var(--gw-compare)"
				stroke-width="2.2"
				stroke-dasharray="6 5"
			/>
			<circle cx={sx(twin.tIsco)} cy={lf(twin.fIsco)} r="4" fill="var(--gw-compare)" />
		{/if}
		<g clip-path="url(#chirp-reveal)">
			<path d={track} fill="none" stroke="var(--gw-crest)" stroke-width="2.4" />
		</g>
		<circle
			cx={sx(Math.min(0, ts))}
			cy={lf(ins.frequency(Math.min(0, ts)))}
			r="5"
			fill="var(--gw-crest)"
		/>
	{:else}
		{#each yTicks as v (v)}
			<line x1={PX0} x2={sx(0)} y1={sy(v)} y2={sy(v)} stroke="var(--stage-grid)" />
			<T
				x={PX0 - 8}
				y={sy(v) + 4}
				text={String(Number((v / hUnit).toFixed(2)))}
				anchor="end"
				size={11.5}
				muted
			/>
		{/each}
		<T
			x={PX0 - 50}
			y={PY0 - 12}
			text="strain h, × 10{sup(-Math.round(Math.log10(1 / hUnit)))}"
			size={12}
			muted
		/>
		<path
			d={envPath}
			fill="none"
			stroke="var(--gw-crest)"
			stroke-width="1"
			stroke-dasharray="2 4"
			opacity="0.5"
		/>
		<g clip-path="url(#chirp-reveal)">
			<path d={strainPath} fill="none" stroke="var(--gw-crest)" stroke-width="1.6" />
		</g>
	{/if}
	<!-- time axis -->
	<line x1={PX0} x2={PX1} y1={PY1} y2={PY1} stroke="var(--stage-line)" />
	{#each TICKS as v (v)}
		<line x1={sx(v)} x2={sx(v)} y1={PY1} y2={PY1 + 5} stroke="var(--stage-line)" />
		<T
			x={sx(v)}
			y={PY1 + 19}
			text={v === 0 ? '0' : zoomed ? `${(v * 1000).toFixed(0)} ms` : `${v.toFixed(1)} s`}
			anchor="middle"
			size={11.5}
			muted
		/>
	{/each}
	<T x={PX1} y={PY1 + 34} text="time, relative to the ISCO" anchor="end" size={12} muted />
	{#if !reduced}
		<line
			x1={sx(ts)}
			x2={sx(ts)}
			y1={PY0 - 4}
			y2={PY1}
			stroke="var(--stage-ink)"
			stroke-width="1"
			opacity="0.4"
		/>
	{/if}
</g>
