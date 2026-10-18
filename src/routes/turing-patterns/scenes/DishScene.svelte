<script lang="ts">
	/**
	 * The dish: a 128 × 128 grid of activator (left, brown where high) from seeded noise, and a
	 * side panel chosen by `step.hints.focus`:
	 *   - `loop`: the activator–inhibitor loop, with equal diffusion; the ripple's size fading;
	 *   - `onset`: the growth rate of each wavelength (linear stability) at the chosen ratio, the
	 *     critical ratio, and the ripple's size over time (log scale);
	 *   - `spacing`: the same chart, the predicted fastest wavelength against the spacing measured
	 *     from the pattern;
	 *   - `shapes`: the activator's self-making with and without saturation κ, the critical ratio
	 *     at this κ and the count of spots and stripes (the ratio is fixed at 120).
	 *
	 * The run is a `Field` advanced to ⌊(t − t₀)·RATE⌋ steps. It carries on from its current state
	 * when the ratio or Dₐ changes (the reader watches it respond) and starts again on a new step,
	 * the restart button, a new κ, or when t goes back. The run, its start time and the last t are
	 * plain variables inside a `$derived` (as in the Ising lattice scene). Reduced motion: a fresh
	 * run per setting, shown settled after REDUCED_TIME lifetimes.
	 */
	import { untrack } from 'svelte';
	import { Axes, Label, linePath, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		DEFAULTS,
		DISH,
		DT,
		RATES,
		SHAPE_RATIO,
		criticalRatio,
		dish,
		dominantWavelength,
		fastestMode,
		growthRate,
		patches,
		uniformState,
		type Field,
		type Params
	} from '../model';
	import { coatRamp, paintField, type RGB } from './paint';

	let { step, t, params, reduced, dark }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'onset'));
	const ratio = $derived(
		focus === 'loop'
			? Number(step.hints?.ratio ?? 1)
			: focus === 'shapes'
				? SHAPE_RATIO
				: Number(params.ratio ?? DEFAULTS.d)
	);
	const Da = $derived(focus === 'spacing' ? Number(params.Da ?? 1) : 1);
	const kappa = $derived(focus === 'shapes' ? Number(params.kappa ?? RATES.kappa) : RATES.kappa);
	const restarts = $derived(Number(params.restart ?? 0));
	const p = $derived<Params>({ ...DEFAULTS, d: ratio, Da, kappa });

	// ---- the run -----------------------------------------------------------------------------
	/** Lifetimes of simulated time per second of the clock. */
	const RATE = 6;
	/** On the first step the noise fades within a few lifetimes: a slower clock shows it. */
	const LOOP_RATE = 0.4;
	/** Strong saturation forms its pattern slowly: a faster clock on that step. */
	const SHAPES_RATE = 15;
	const REDUCED_TIME = 150;
	/** The ripple's size is recorded every few steps for the trace. */
	const EVERY = 2;
	interface Run {
		f: Field;
		trace: [number, number][];
	}
	let run: Run | null = null;
	let runKey = '';
	let t0 = 0;
	let lastT = 0;
	// a plain cache of settled runs, not reactive state
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const reducedRuns = new Map<string, Run>();

	function advance(r: Run, steps: number, cap = 300) {
		let n = 0;
		while (r.f.steps < steps && n < cap) {
			const k = Math.min(EVERY - (r.f.steps % EVERY), steps - r.f.steps);
			r.f.step(k);
			n += k;
			if (r.f.steps % EVERY === 0) r.trace.push([r.f.time, r.f.contrast()]);
		}
	}
	function fresh(pp: Params, seed: number): Run {
		const f = dish(pp, seed);
		return { f, trace: [[0, f.contrast()]] };
	}

	const current = $derived.by((): { run: Run; k: number } => {
		const time = t;
		const pp = p;
		const seed = 1 + restarts;
		const key = `${step.id}|${restarts}|${focus === 'shapes' ? kappa : ''}`;
		if (reduced) {
			const rk = `${key}|${pp.d}|${pp.Da}`;
			let r = reducedRuns.get(rk);
			if (!r) {
				r = fresh(pp, seed);
				advance(r, Math.round(REDUCED_TIME / DT), Infinity);
				if (reducedRuns.size > 12) reducedRuns.clear();
				reducedRuns.set(rk, r);
			}
			return { run: r, k: r.f.steps };
		}
		if (!run || key !== runKey || time < lastT - 1e-6) {
			run = fresh(pp, seed);
			runKey = key;
			t0 = time;
		}
		// a dish that has gone flat (its last variations lost to rounding) cannot grow a pattern
		// when the ratio is raised: it starts again from the seeded noise
		if (pp.d !== run.f.p.d && run.f.contrast() < 1e-4) {
			run = fresh(pp, seed);
			t0 = time;
		}
		run.f.p = pp;
		lastT = time;
		advance(
			run,
			Math.floor(
				((time - t0) * (focus === 'loop' ? LOOP_RATE : focus === 'shapes' ? SHAPES_RATE : RATE)) /
					DT
			)
		);
		return { run, k: run.f.steps };
	});

	// ---- painting ------------------------------------------------------------------------------
	let ramp = $state.raw<RGB[] | null>(null);
	$effect(() => {
		void dark;
		untrack(() => {
			ramp = coatRamp();
		});
	});
	const level = $derived(uniformState(p).a);
	const image = $derived.by(() => {
		void current.k;
		if (!ramp) return '';
		return paintField(current.run.f.a, DISH, DISH, ramp, level);
	});

	const GX = 32;
	const GY = 92;
	const GS = 448;
	const cell = GS / DISH;

	// ---- linear theory -------------------------------------------------------------------------
	const dc = $derived(criticalRatio(p));
	const fastest = $derived(fastestMode(p));
	const grows = $derived(fastest.rate > 0);
	const now = $derived(current.run.trace[current.run.trace.length - 1][1]);
	const timeNow = $derived(current.run.f.time);
	const measured = $derived.by(() => {
		void current.k;
		return now > 0.3 ? dominantWavelength(current.run.f.a, DISH) : null;
	});
	const shapes = $derived.by(() => {
		void current.k;
		if (focus !== 'shapes' || now < 0.3) return null;
		return patches(current.run.f, 1.2 * fastest.wavelength);
	});

	// the dispersion chart: growth rate against wavelength
	const PX0 = 600;
	const PX1 = 916;
	const LAM: [number, number] = [4, 40];
	const sxL = scale(LAM, [PX0, PX1]);
	const syR = scale([-0.4, 0.4], [272, 104]);
	const curve = $derived.by(() => {
		const pts: [number, number][] = [];
		for (let i = 0; i <= 160; i++) {
			const lam = LAM[0] + ((LAM[1] - LAM[0]) * i) / 160;
			pts.push([lam, Math.max(-0.4, Math.min(0.4, growthRate(p, (2 * Math.PI) / lam)))]);
		}
		return pts;
	});
	const curvePath = $derived(
		linePath(
			curve,
			(q) => q[0],
			(q) => q[1],
			sxL,
			syR
		)
	);
	/** The shaded area under the curve where ripples grow. */
	const bandPath = $derived.by(() => {
		const zero = syR(0).toFixed(1);
		let d = '';
		let lastX = '';
		for (const [lam, r] of curve) {
			const x = sxL(lam).toFixed(1);
			if (r > 0) {
				d += lastX ? `L${x} ${syR(r).toFixed(1)}` : `M${x} ${zero}L${x} ${syR(r).toFixed(1)}`;
				lastX = x;
			} else if (lastX) {
				d += `L${lastX} ${zero}Z`;
				lastX = '';
			}
		}
		if (lastX) d += `L${lastX} ${zero}Z`;
		return d;
	});
	const fastX = $derived(sxL(Math.min(LAM[1], Math.max(LAM[0], fastest.wavelength))));

	// the ripple's size against time (log scale)
	const WINDOW = $derived(focus === 'loop' ? 10 : reduced ? REDUCED_TIME : 60);
	const LOG: [number, number] = [-3, 0.5];
	const tStart = $derived(Math.max(0, timeNow - WINDOW));
	const sxT = $derived(scale([tStart, tStart + WINDOW], [PX0, PX1]));
	const syC = scale(LOG, [530, 372]);
	const tracePath = $derived.by(() => {
		void current.k;
		const pts = current.run.trace.filter((q) => q[0] >= tStart);
		return linePath(
			pts,
			(q) => q[0],
			(q) => Math.max(LOG[0], Math.min(LOG[1], Math.log10(Math.max(q[1], 1e-6)))),
			sxT,
			syC
		);
	});
	const pct = (v: number) =>
		v >= 1
			? `${Math.round(v * 100)} %`
			: v >= 0.1
				? `${(v * 100).toFixed(0)} %`
				: `${(v * 100).toFixed(1)} %`;
	const verdict = $derived(
		focus === 'loop'
			? 'every ripple fades'
			: !grows
				? now > 0.3
					? 'below the threshold: a pattern can persist'
					: 'below the threshold: small ripples fade'
				: now > 0.3
					? 'a pattern has formed'
					: 'ripples are growing'
	);

	// the saturation panel: production ρa²/(1 + κa²) against a
	const sxA = scale([0, 10], [PX0, PX1]);
	const syP = scale([0, 30], [500, 300]);
	const prodPath = (k: number) => {
		const pts: [number, number][] = [];
		for (let i = 0; i <= 100; i++) {
			const a = (10 * i) / 100;
			const v = (a * a) / (1 + k * a * a);
			if (v <= 30) pts.push([a, v]);
		}
		return linePath(
			pts,
			(q) => q[0],
			(q) => q[1],
			sxA,
			syP
		);
	};
	const satPath = $derived(prodPath(kappa));
	const plainPath = prodPath(0);
	const shapeName = $derived(
		!shapes
			? 'forming…'
			: shapes.stripeShare > 0.75
				? 'stripes (a labyrinth)'
				: shapes.stripeShare > 0.15
					? 'spots joining into stripes'
					: 'spots'
	);
</script>

<g>
	<!-- ---------------------------------------------------------------- the dish -->
	<Readout
		id="dish"
		order={1}
		label="128 × 128 cells"
		value="t = {Math.round(timeNow)} lifetimes · Dₕ/Dₐ = {ratio}"
	>
		<Label
			anchor="start"
			x={GX}
			y={GY - 32}
			text="activator in a dish of 128 × 128 cells"
			size={15}
			weight={600}
		/>
		<Label
			anchor="start"
			x={GX}
			y={GY - 12}
			text="t = {Math.round(timeNow)} activator lifetimes · Dₕ/Dₐ = {ratio}"
			size={12}
			muted
			tabular
		/>
	</Readout>
	<rect
		x={GX - 1}
		y={GY - 1}
		width={GS + 2}
		height={GS + 2}
		rx="3"
		fill="var(--tp-mid)"
		stroke="var(--stage-line)"
	/>
	{#if image}
		<image href={image} x={GX} y={GY} width={GS} height={GS} preserveAspectRatio="none" />
	{/if}
	<Readout id="key" label="Brown: activator high · pale: low">
		<rect
			x={GX}
			y={GY + GS + 14}
			width="14"
			height="14"
			rx="3"
			fill="var(--tp-high)"
			stroke="var(--border)"
		/>
		<Label
			anchor="start"
			x={GX + 20}
			y={GY + GS + 25}
			text="activator high"
			size={12}
			halo={false}
		/>
		<rect
			x={GX + 130}
			y={GY + GS + 14}
			width="14"
			height="14"
			rx="3"
			fill="var(--tp-low)"
			stroke="var(--border)"
		/>
		<Label anchor="start" x={GX + 150} y={GY + GS + 25} text="low" size={12} halo={false} />
		<line
			x1={GX + GS - 10 * cell * 1}
			x2={GX + GS}
			y1={GY + GS + 21}
			y2={GY + GS + 21}
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Label x={GX + GS - 5 * cell} y={GY + GS + 38} text="10 cells" size={11} muted halo={false} />
	</Readout>

	<!-- ---------------------------------------------------------------- panel: the loop -->
	{#if focus === 'loop'}
		<g transform="translate(600 96)">
			<Label anchor="start" x={0} y={0} text="the two chemicals" size={13} weight={600} />
			<circle cx="70" cy="110" r="38" fill="var(--tp-high)" stroke="var(--border)" />
			<text x="70" y="115" text-anchor="middle" fill="var(--tp-on-high)" font-weight="600">
				activator
			</text>
			<circle cx="250" cy="110" r="38" fill="var(--tp-inh)" />
			<text x="250" y="115" text-anchor="middle" fill="var(--tp-on-high)" font-weight="600">
				inhibitor
			</text>
			<!-- self-activation -->
			<path
				d="M48 80 C30 30 110 30 92 80"
				fill="none"
				stroke="var(--tp-high-line)"
				stroke-width="2.4"
				marker-end="url(#arrowhead)"
			/>
			<Label x={70} y={34} text="makes more of itself" size={12} />
			<!-- activation of the inhibitor -->
			<path
				d="M110 96 Q160 76 206 96"
				fill="none"
				stroke="var(--tp-high-line)"
				stroke-width="2.4"
				marker-end="url(#arrowhead)"
			/>
			<Label x={160} y={74} text="makes" size={12} />
			<!-- inhibition -->
			<path d="M206 128 Q160 148 114 128" fill="none" stroke="var(--tp-inh)" stroke-width="2.4" />
			<line
				x1="112"
				y1="118"
				x2="116"
				y2="138"
				stroke="var(--tp-inh)"
				stroke-width="3"
				stroke-linecap="round"
			/>
			<Label x={160} y={164} text="holds back" size={12} />
			<Label x={70} y={176} text="spreads at Dₐ" size={12} muted />
			<Label x={250} y={176} text="spreads at Dₕ" size={12} muted />
			<Label
				anchor="start"
				x={0}
				y={218}
				text="Here Dₕ = Dₐ: both spread equally fast."
				size={12}
			/>
		</g>
	{/if}

	<!-- ---------------------------------------------------------------- panel: growth rates -->
	{#if focus === 'onset' || focus === 'spacing'}
		<Readout
			id="rate-title"
			label="Chart: how fast a ripple of each wavelength grows (above 0) or fades"
		>
			<Label
				anchor="start"
				x={PX0}
				y={78}
				text="growth rate of a ripple of each wavelength"
				size={13}
				weight={600}
			/>
		</Readout>
		<Axes
			sx={sxL}
			sy={syR}
			xLabel="ripple wavelength (cells)"
			xTicks={[4, 10, 20, 30, 40]}
			yTicks={[-0.4, -0.2, 0, 0.2, 0.4]}
			yFormat={(v: number) => (v === 0 ? '0' : v.toFixed(1))}
		/>
		<line
			x1={PX0}
			x2={PX1}
			y1={syR(0)}
			y2={syR(0)}
			stroke="var(--stage-ink-muted)"
			stroke-width="1"
		/>
		{#if bandPath}
			<path d={bandPath} fill="var(--tp-band)" />
		{/if}
		<path d={curvePath} fill="none" stroke="var(--tp-curve)" stroke-width="2.4" />
		<Readout id="grows-fades">
			<Label anchor="start" x={PX0 + 8} y={syR(0) + 16} text="fades" size={11} muted />
			<Label anchor="start" x={PX0 + 8} y={syR(0) - 8} text="grows" size={11} muted />
		</Readout>
		{#if grows}
			<line
				x1={fastX}
				x2={fastX}
				y1={syR(fastest.rate)}
				y2={syR(-0.4)}
				stroke="var(--tp-curve)"
				stroke-width="1.2"
				stroke-dasharray="4 3"
			/>
			<circle cx={fastX} cy={syR(Math.min(0.4, fastest.rate))} r="4.5" fill="var(--tp-curve)" />
		{/if}
		{#if focus === 'spacing' && measured}
			<line
				x1={sxL(Math.min(LAM[1], measured))}
				x2={sxL(Math.min(LAM[1], measured))}
				y1={104}
				y2={272}
				stroke="var(--tp-high-line)"
				stroke-width="2"
			/>
		{/if}
	{/if}
	{#if focus === 'onset'}
		<Readout
			id="dc"
			order={2}
			label="Critical ratio"
			value="{dc.toFixed(0)}× (now {ratio}×)"
			note={verdict}
		>
			<Label
				x={PX1}
				y={98}
				text="critical Dₕ/Dₐ ≈ {dc.toFixed(0)}"
				size={13}
				anchor="end"
				tabular
				color="var(--tp-curve-text)"
				weight={600}
			/>
		</Readout>
	{/if}
	{#if focus === 'spacing'}
		<Readout
			id="predicted"
			order={2}
			label="Fastest-growing wavelength"
			value={grows ? `${fastest.wavelength.toFixed(1)} cells` : 'none grows'}
			color="var(--tp-curve-text)"
		>
			<Label
				anchor="start"
				x={PX0}
				y={340}
				text={grows
					? `fastest-growing wavelength: ${fastest.wavelength.toFixed(1)} cells`
					: 'no ripple grows at this ratio'}
				size={14}
				weight={600}
				color="var(--tp-curve-text)"
				tabular
			/>
		</Readout>
		<Readout
			id="measured"
			order={3}
			label="Measured spacing"
			value={measured ? `${measured.toFixed(1)} cells` : '—'}
			color="var(--tp-high-text)"
		>
			<Label
				anchor="start"
				x={PX0}
				y={368}
				text={measured
					? `spacing measured in the dish: ${measured.toFixed(1)} cells`
					: 'spacing measured in the dish: —'}
				size={14}
				weight={600}
				color="var(--tp-high-text)"
				tabular
			/>
		</Readout>
		<Readout id="spacing-notes">
			<Label
				anchor="start"
				x={PX0}
				y={404}
				text="Dₐ = {Da.toFixed(2)} and Dₕ = {(Da * ratio).toFixed(1)} cells² per lifetime"
				size={12}
				muted
				tabular
			/>
			<Label
				anchor="start"
				x={PX0}
				y={424}
				text="critical ratio {dc.toFixed(0)}× · dashed: predicted · solid: measured"
				size={12}
				muted
			/>
		</Readout>
	{/if}

	<!-- ---------------------------------------------------------------- ripple-size trace -->
	{#if focus === 'loop' || focus === 'onset'}
		<Readout
			id="ripple"
			order={3}
			label="Variation across the dish, σ/a₀"
			value={pct(now)}
			note={verdict}
		>
			<Label
				anchor="start"
				x={PX0}
				y={350}
				text="variation across the dish, σ/a₀ (log scale)"
				size={13}
				weight={600}
			/>
			<Label x={PX1} y={350} text={pct(now)} size={14} anchor="end" tabular weight={600} />
		</Readout>
		<Axes
			sx={sxT}
			sy={syC}
			xLabel="lifetimes"
			yTicks={[-3, -2, -1, 0]}
			yFormat={(v: number) => (v === 0 ? '100 %' : v === -1 ? '10 %' : v === -2 ? '1 %' : '0.1 %')}
		/>
		<path d={tracePath} fill="none" stroke="var(--tp-high-line)" stroke-width="2" />
		<Label anchor="start" x={PX0} y={574} text={verdict} size={12} muted />
	{/if}

	<!-- ---------------------------------------------------------------- panel: saturation -->
	{#if focus === 'shapes'}
		<Readout id="kappa" order={2} label="Saturation κ" value={kappa.toFixed(2)} note={shapeName}>
			<Label anchor="start" x={PX0} y={92} text="κ = {kappa.toFixed(2)}" size={15} weight={600} />
			<Label
				anchor="start"
				x={PX0}
				y={118}
				text="pattern: {shapeName}"
				size={14}
				weight={600}
				color="var(--tp-high-text)"
			/>
		</Readout>
		<Readout
			id="counts"
			order={3}
			label="Patches"
			value={shapes ? `${shapes.spots} spots · ${shapes.stripes} stripes` : '—'}
		>
			<Label
				anchor="start"
				x={PX0}
				y={142}
				text={shapes ? `${shapes.spots} spots · ${shapes.stripes} stripes` : ' '}
				size={12}
				muted
				tabular
			/>
		</Readout>
		<Readout id="dc-shape" order={4} label="Critical ratio" value="{dc.toFixed(0)}× (here 120×)">
			<Label
				anchor="start"
				x={PX0}
				y={164}
				text="critical Dₕ/Dₐ ≈ {dc.toFixed(0)} · here {SHAPE_RATIO}"
				size={12}
				muted
				tabular
			/>
		</Readout>
		<Readout id="sat-title">
			<Label
				anchor="start"
				x={PX0}
				y={270}
				text="activator’s self-making, ρa² / (1 + κa²)"
				size={13}
				weight={600}
			/>
		</Readout>
		<Axes sx={sxA} sy={syP} xLabel="activator a" yTicks={[0, 10, 20, 30]} />
		<path
			d={plainPath}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="1.6"
			stroke-dasharray="6 4"
		/>
		<path d={satPath} fill="none" stroke="var(--tp-high-line)" stroke-width="2.6" />
		{#if kappa > 0}
			<line
				x1={PX0}
				x2={PX1}
				y1={syP(1 / kappa)}
				y2={syP(1 / kappa)}
				stroke="var(--tp-high-line)"
				stroke-width="1"
				stroke-dasharray="2 3"
				opacity={1 / kappa <= 30 ? 1 : 0}
			/>
		{/if}
		<Readout id="sat-legend" label="Dashed: no saturation · solid: with κ">
			<Label anchor="start" x={PX0 + 8} y={316} text="κ = 0" size={11} muted />
			<Label
				anchor="end"
				x={PX1 - 6}
				y={kappa > 0 && 1 / kappa <= 30 ? syP(1 / kappa) - 6 : 486}
				text={kappa > 0 && 1 / kappa <= 30 ? 'ceiling 1/κ' : 'no ceiling in view'}
				size={11}
				color="var(--tp-high-text)"
			/>
		</Readout>
	{/if}
</g>
