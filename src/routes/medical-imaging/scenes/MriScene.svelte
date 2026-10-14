<script lang="ts">
	/**
	 * MRI, three phases (step.hints.phase):
	 *   larmor   — protons precessing round the field B (params.field); the
	 *              Larmor frequency f = 42.58 MHz/T × B on a radio-frequency
	 *              scale with the FM band. The animation is slowed so that the
	 *              precession rate stays proportional to B (0.25 turns/s per T).
	 *   gradient — three tubes of water across the scanner and a gradient
	 *              (params.gradient, mT/m). Spins are shown relative to the
	 *              centre's precession, so they turn at a rate ∝ G·x. Right: the
	 *              coil's signal (real part of `gradientEcho`); below the tubes,
	 *              on the same position axis, its spectrum: the tubes' profile.
	 *   relax    — five tissues' brightness in a spin-echo image,
	 *              (1 − e^(−TR/T1))·e^(−TE/T2) with 1.5 T values from IT'IS,
	 *              and the recovery and decay curves with TR and TE marked.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		MRI_TISSUES,
		decay,
		gradientEcho,
		kHzPerCm,
		larmorMHz,
		recovery,
		spinEcho,
		type MriTissue
	} from '../imaging';
	import { TISSUE } from '../tissues';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'larmor'));
	const tt = $derived(reduced ? 2.5 : t);

	// ================= larmor =================
	const B = $derived(Number(params.field ?? 1.5));
	const f = $derived(larmorMHz(B));
	const spins = Array.from({ length: 12 }, (_, i) => ({
		i,
		x: 110 + (i % 4) * 92,
		y: 200 + Math.floor(i / 4) * 120,
		ph: (i * 2.39996) % (2 * Math.PI)
	}));
	const TILT = 0.45; // rad
	const L = 46;
	const precess = $derived((2 * Math.PI * 0.25 * B * tt) % (2 * Math.PI));
	const tip = (s: { x: number; y: number; ph: number }) => {
		const a = precess + s.ph;
		return {
			x: s.x + L * Math.sin(TILT) * Math.cos(a),
			y: s.y - L * Math.cos(TILT) + L * Math.sin(TILT) * Math.sin(a) * 0.35
		};
	};
	const FX = 560;
	const FW = 360;
	const fx = (mhz: number) => FX + (mhz / 320) * FW;
	const marks = [
		{ b: 1.5, name: '1.5 T' },
		{ b: 3, name: '3 T' },
		{ b: 7, name: '7 T' }
	];

	// ================= gradient =================
	const G = $derived(Number(params.gradient ?? 10));
	const TUBES = [
		{ id: 'a', x: -6, w: 2 },
		{ id: 'b', x: 0.5, w: 1 },
		{ id: 'c', x: 5.5, w: 3 }
	];
	const rho = (x: number) => (TUBES.some((tb) => Math.abs(x - tb.x) <= tb.w / 2) ? 1 : 0);
	const GX0 = 60;
	const GPX = 24; // px per cm
	const gx = (x: number) => GX0 + (x + 10) * GPX;
	const echo = $derived(G > 0 ? gradientEcho(rho, G) : null);
	const SIG_X = 620;
	const SIG_W = 310;
	const SIG_Y = 150;
	const SIG_H = 70;
	const sigPath = $derived.by(() => {
		const n = 128;
		const total = TUBES.reduce((a, tb) => a + tb.w, 0);
		const vals = echo ? Array.from(echo.re) : Array.from({ length: n }, () => total);
		return vals
			.map(
				(v, i) =>
					`${i ? 'L' : 'M'}${(SIG_X + (i / (n - 1)) * SIG_W).toFixed(1)} ${(SIG_Y - (v / total) * SIG_H).toFixed(1)}`
			)
			.join(' ');
	});
	const PROF_Y = 470;
	const PROF_H = 90;
	const profPath = $derived.by(() => {
		if (!echo) return '';
		return echo.profile
			.map(
				(v, i) =>
					`${i ? 'L' : 'M'}${gx(echo.x[i]).toFixed(1)} ${(PROF_Y - Math.min(1.2, v) * PROF_H).toFixed(1)}`
			)
			.join(' ');
	});
	const kcm = $derived(kHzPerCm(G));
	const windowMs = $derived(echo ? echo.dt * 128 : 0);
	const spinsG = TUBES.flatMap((tb) =>
		[-0.35, 0, 0.35].map((u, j) => ({ id: `${tb.id}${j}`, x: tb.x + u * tb.w, tube: tb.id }))
	);
	const spinAngle = (x: number) => 2 * Math.PI * 0.006 * G * x * tt;

	// ================= relax =================
	const TR = $derived(Number(params.tr ?? 500));
	const TE = $derived(Number(params.te ?? 15));
	const NAMES: Record<MriTissue, string> = {
		subcutaneousFat: 'fat',
		liver: 'liver',
		spleen: 'spleen',
		muscle: 'muscle',
		blood: 'blood'
	};
	const COLORS: Record<MriTissue, string> = {
		subcutaneousFat: '#e8a33d',
		liver: '#a0522d',
		spleen: '#9c36b5',
		muscle: '#e03131',
		blood: '#1c7ed6'
	};
	const signals = $derived(MRI_TISSUES.map((k) => ({ k, s: spinEcho(k, TR, TE) })));
	const sMax = $derived(Math.max(...signals.map((s) => s.s), 1e-9));
	const brightest = $derived(signals.reduce((a, b) => (b.s > a.s ? b : a)));
	const weighting = $derived(
		TR <= 800 && TE <= 30
			? 'T1-weighted'
			: TR >= 2000 && TE >= 70
				? 'T2-weighted'
				: TR >= 2000 && TE <= 30
					? 'proton-density weighted'
					: 'mixed weighting'
	);
	// curves
	const CX = 470;
	const CW = 440;
	const C1Y = 80;
	const C2Y = 330;
	const CH = 170;
	const T1MAX = 5000;
	const T2MAX = 300;
	const c1x = (ms: number) => CX + (ms / T1MAX) * CW;
	const c2x = (ms: number) => CX + (ms / T2MAX) * CW;
	const cy = (y0: number, v: number) => y0 + CH - v * CH;
	const curve1 = (k: MriTissue) =>
		Array.from({ length: 61 }, (_, i) => {
			const ms = (i / 60) * T1MAX;
			return `${i ? 'L' : 'M'}${c1x(ms).toFixed(1)} ${cy(C1Y, recovery(ms, TISSUE[k].t1 as number)).toFixed(1)}`;
		}).join(' ');
	const curve2 = (k: MriTissue) =>
		Array.from({ length: 61 }, (_, i) => {
			const ms = (i / 60) * T2MAX;
			const v = recovery(TR, TISSUE[k].t1 as number) * decay(ms, TISSUE[k].t2 as number);
			return `${i ? 'L' : 'M'}${c2x(ms).toFixed(1)} ${cy(C2Y, v).toFixed(1)}`;
		}).join(' ');
</script>

<g>
	{#if phase === 'larmor'}
		<!-- magnet and field -->
		<rect x={40} y={80} width={420} height={18} rx="6" fill="var(--mi-tube)" opacity="0.7" />
		<rect x={40} y={500} width={420} height={18} rx="6" fill="var(--mi-tube)" opacity="0.7" />
		<line
			x1={30}
			y1={480}
			x2={30}
			y2={120}
			stroke="var(--mi-field)"
			stroke-width="3"
			marker-end="url(#arrowhead)"
		/>
		<Readout id="field" order={1} label="Field" value="{B.toFixed(1)} T">
			<text x={44} y={60} font-weight="600" style:font-size="15px"
				>magnetic field B = {B.toFixed(1)} T</text
			>
		</Readout>
		{#each spins as s (s.i)}
			{@const p = tip(s)}
			<ellipse
				cx={s.x}
				cy={s.y - L * Math.cos(TILT)}
				rx={L * Math.sin(TILT)}
				ry={L * Math.sin(TILT) * 0.35}
				fill="none"
				stroke="var(--stage-line)"
				stroke-dasharray="2 3"
			/>
			<line
				x1={s.x}
				y1={s.y}
				x2={p.x}
				y2={p.y}
				stroke="var(--mi-spin)"
				stroke-width="2.5"
				stroke-linecap="round"
			/>
			<circle cx={s.x} cy={s.y} r="7" fill="var(--mi-spin)" opacity="0.85" />
			<circle cx={p.x} cy={p.y} r="3" fill="var(--mi-spin)" />
		{/each}
		<Readout id="slow">
			<Label
				x={250}
				y={548}
				muted
				text="protons precessing round the field (slowed over 100 million times)"
			/>
		</Readout>

		<!-- frequency -->
		<Readout
			id="f"
			order={2}
			label="Larmor frequency"
			value="{f.toFixed(1)} MHz"
			note="{(f * 1e6).toExponential(2).replace('e+', ' × 10^')} turns per second"
		>
			<text x={FX} y={140} font-weight="600" style:font-size="22px">f = {f.toFixed(1)} MHz</text>
			<Label
				x={FX}
				y={166}
				anchor="start"
				muted
				text="42.58 MHz per tesla × {B.toFixed(1)} T: {f.toFixed(1)} million turns a second"
			/>
		</Readout>
		<g>
			<line x1={FX} y1={260} x2={FX + FW} y2={260} stroke="var(--stage-line)" stroke-width="2" />
			<rect
				x={fx(88)}
				y={246}
				width={fx(108) - fx(88)}
				height={14}
				fill="var(--stage-line)"
				opacity="0.8"
			/>
			<Label x={(fx(88) + fx(108)) / 2} y={240} muted text="FM radio" />
			{#each [0, 100, 200, 300] as m (m)}
				<line x1={fx(m)} y1={260} x2={fx(m)} y2={266} stroke="var(--stage-ink-muted)" />
				<Label x={fx(m)} y={282} muted text="{m} MHz" />
			{/each}
			{#each marks as mk (mk.name)}
				<line
					x1={fx(larmorMHz(mk.b))}
					y1={300}
					x2={fx(larmorMHz(mk.b))}
					y2={312}
					stroke="var(--stage-ink-muted)"
				/>
				<Label x={fx(larmorMHz(mk.b))} y={328} muted text={mk.name} />
			{/each}
			<circle
				cx={fx(f)}
				cy={260}
				r="7"
				fill="var(--mi-spin)"
				stroke="var(--stage-bg)"
				stroke-width="1.5"
			/>
		</g>
		<Readout id="res">
			<Label
				x={FX}
				y={392}
				anchor="start"
				text="a radio pulse at exactly {f.toFixed(1)} MHz tips the protons over;"
			/>
			<Label
				x={FX}
				y={414}
				anchor="start"
				text="precessing, they broadcast back at the same frequency."
			/>
			<Label
				x={FX}
				y={446}
				anchor="start"
				muted
				text="any other frequency leaves them alone: resonance"
			/>
		</Readout>
	{:else if phase === 'gradient'}
		<!-- the gradient -->
		<polygon
			points="{gx(-10)},{110} {gx(10)},{110 - Math.min(40, G)} {gx(10)},{110} "
			fill="var(--mi-field)"
			opacity="0.25"
		/>
		<Readout
			id="g"
			order={1}
			label="Gradient"
			value="{G} mT/m"
			note={G > 0
				? `${(kcm * 1000).toFixed(0)} Hz per cm`
				: 'off: every proton at the same frequency'}
		>
			<text x={gx(-10)} y={50} font-weight="600" style:font-size="15px"
				>field grows to the right: {G} mT/m{G > 0
					? ` → ${(kcm * 1000).toFixed(0)} Hz more per cm`
					: ' (off)'}</text
			>
		</Readout>
		<!-- tubes -->
		{#each TUBES as tb (tb.id)}
			<rect
				x={gx(tb.x - tb.w / 2)}
				y={130}
				width={tb.w * GPX}
				height={150}
				rx="6"
				fill="var(--mi-water)"
				stroke="var(--stage-line)"
			/>
		{/each}
		{#each spinsG as s (s.id)}
			{@const a = spinAngle(s.x)}
			<line
				x1={gx(s.x)}
				y1={205}
				x2={gx(s.x) + 14 * Math.sin(a)}
				y2={205 - 14 * Math.cos(a)}
				stroke="var(--mi-spin)"
				stroke-width="2.2"
				stroke-linecap="round"
			/>
			<circle cx={gx(s.x)} cy={205} r="2.5" fill="var(--mi-spin)" />
		{/each}
		<Readout id="tubes">
			<Label
				x={gx(0)}
				y={304}
				muted
				text="three tubes of water; spins shown relative to the centre of the scanner"
			/>
		</Readout>
		<!-- position axis and profile -->
		<line x1={gx(-10)} y1={PROF_Y} x2={gx(10)} y2={PROF_Y} stroke="var(--stage-line)" />
		{#each [-10, -5, 0, 5, 10] as x (x)}
			<line x1={gx(x)} y1={PROF_Y} x2={gx(x)} y2={PROF_Y + 5} stroke="var(--stage-ink-muted)" />
			<Label
				x={gx(x)}
				y={PROF_Y + 20}
				muted
				text={G > 0 ? `${x > 0 ? '+' : ''}${(kcm * x).toFixed(1)} kHz` : `${x} cm`}
			/>
		{/each}
		{#if echo}
			<path
				d={profPath}
				fill="none"
				stroke="var(--mi-filtered)"
				stroke-width="2.2"
				stroke-linejoin="round"
			/>
		{:else}
			<line
				x1={gx(0)}
				y1={PROF_Y}
				x2={gx(0)}
				y2={PROF_Y - PROF_H}
				stroke="var(--mi-filtered)"
				stroke-width="3"
			/>
		{/if}
		<Readout
			id="profhead"
			order={3}
			label="Spectrum"
			value={G > 0 ? 'the profile of the tubes' : 'one spike: no position information'}
		>
			<Label
				x={gx(-10)}
				y={PROF_Y - PROF_H - 24}
				anchor="start"
				text={G > 0
					? 'Fourier transform of the signal: strength at each frequency = water at each position'
					: 'no gradient: all the water at one frequency, a single spike'}
				color="var(--mi-filtered)"
			/>
		</Readout>
		<!-- the signal -->
		<text x={SIG_X} y={SIG_Y - SIG_H - 20} font-weight="600" style:font-size="15px"
			>The coil's signal</text
		>
		<line x1={SIG_X} y1={SIG_Y} x2={SIG_X + SIG_W} y2={SIG_Y} stroke="var(--stage-line)" />
		<path d={sigPath} fill="none" stroke="var(--mi-spin)" stroke-width="1.6" />
		<Readout
			id="sig"
			order={2}
			label="Signal"
			value={G > 0 ? `${windowMs.toFixed(2)} ms sampled 128 times` : 'a steady tone'}
		>
			<Label
				x={SIG_X}
				y={SIG_Y + SIG_H + 26}
				anchor="start"
				muted
				text={G > 0
					? `${windowMs.toFixed(2)} ms, 128 samples: all the frequencies beating`
					: 'one frequency: a steady signal'}
			/>
		</Readout>
		<Readout id="proj">
			<Label
				x={SIG_X}
				y={SIG_Y + SIG_H + 70}
				anchor="start"
				text="the profile is a shadow of the water,"
			/>
			<Label
				x={SIG_X}
				y={SIG_Y + SIG_H + 92}
				anchor="start"
				text="like one CT shadow: turn the gradient"
			/>
			<Label
				x={SIG_X}
				y={SIG_Y + SIG_H + 114}
				anchor="start"
				text="round, and the slice can be computed"
			/>
		</Readout>
	{:else}
		<!-- tissue patches -->
		<text x={40} y={60} font-weight="600" style:font-size="15px">Brightness in the image</text>
		<rect x={39} y={79} width={362} height={242} fill="var(--mi-panel)" stroke="var(--border)" />
		{#each signals as s, i (s.k)}
			{@const x = 52 + (i % 3) * 116}
			{@const y = 92 + Math.floor(i / 3) * 114}
			{@const g = Math.round(255 * (s.s / sMax))}
			<rect {x} {y} width={104} height={80} rx="6" fill="rgb({g},{g},{g})" />
			<Label x={x + 52} y={y + 98} text={NAMES[s.k]} />
		{/each}
		<Readout
			id="w"
			order={1}
			label="Weighting"
			value={weighting}
			note="brightest: {NAMES[brightest.k]}"
		>
			<text x={40} y={358} font-weight="600" style:font-size="15px"
				>{weighting}: brightest is {NAMES[brightest.k]}</text
			>
		</Readout>
		<Readout id="trte" order={2} label="TR, TE" value="{TR} ms, {TE} ms">
			<Label
				x={40}
				y={384}
				anchor="start"
				muted
				text="TR = {TR} ms, TE = {TE} ms; equal proton density assumed"
			/>
		</Readout>
		<Readout id="tvals">
			{#each MRI_TISSUES as k, i (k)}
				<circle cx={48} cy={420 + i * 22} r="5" fill={COLORS[k]} />
				<Label
					x={60}
					y={424 + i * 22}
					anchor="start"
					text="{NAMES[k]}: T1 {Math.round(TISSUE[k].t1 as number)} ms, T2 {Math.round(
						TISSUE[k].t2 as number
					)} ms"
				/>
			{/each}
		</Readout>

		<!-- recovery -->
		<Label
			x={CX}
			y={C1Y - 12}
			anchor="start"
			text="realigning after a pulse (T1); the next pulse comes at TR"
		/>
		<line x1={CX} y1={C1Y + CH} x2={CX + CW} y2={C1Y + CH} stroke="var(--stage-line)" />
		<line x1={CX} y1={C1Y} x2={CX} y2={C1Y + CH} stroke="var(--stage-line)" />
		{#each MRI_TISSUES as k (k)}
			<path d={curve1(k)} fill="none" stroke={COLORS[k]} stroke-width="1.8" />
		{/each}
		<line
			x1={c1x(TR)}
			y1={C1Y}
			x2={c1x(TR)}
			y2={C1Y + CH}
			stroke="var(--stage-ink)"
			stroke-dasharray="4 3"
		/>
		<Label x={c1x(TR) + 4} y={C1Y + 14} anchor={TR > 4000 ? 'end' : 'start'} text="TR" />
		{#each [0, 1000, 2000, 3000, 4000, 5000] as ms (ms)}
			<Label x={c1x(ms)} y={C1Y + CH + 16} muted text={ms === 5000 ? '5000 ms' : String(ms)} />
		{/each}
		<!-- decay -->
		<Label
			x={CX}
			y={C2Y - 12}
			anchor="start"
			text="signal fading after the pulse (T2); the scanner listens at TE"
		/>
		<line x1={CX} y1={C2Y + CH} x2={CX + CW} y2={C2Y + CH} stroke="var(--stage-line)" />
		<line x1={CX} y1={C2Y} x2={CX} y2={C2Y + CH} stroke="var(--stage-line)" />
		{#each MRI_TISSUES as k (k)}
			<path d={curve2(k)} fill="none" stroke={COLORS[k]} stroke-width="1.8" />
		{/each}
		<line
			x1={c2x(TE)}
			y1={C2Y}
			x2={c2x(TE)}
			y2={C2Y + CH}
			stroke="var(--stage-ink)"
			stroke-dasharray="4 3"
		/>
		<Label x={c2x(TE) + 4} y={C2Y + 14} anchor={TE > 240 ? 'end' : 'start'} text="TE" />
		{#each [0, 100, 200, 300] as ms (ms)}
			<Label x={c2x(ms)} y={C2Y + CH + 16} muted text={ms === 300 ? '300 ms' : String(ms)} />
		{/each}
	{/if}
</g>
