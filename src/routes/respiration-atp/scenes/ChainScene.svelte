<script lang="ts">
	/**
	 * Steps "complex1", "complex3", "oxygen", "gradient": the inner
	 * mitochondrial membrane edge-on, the matrix above (as the stroma in
	 * photosynthesis) and the intermembrane space below. Complexes I–IV,
	 * ubiquinone, cytochrome c and ATP synthase, left to right.
	 *
	 * Everything that moves is driven by the kinetic chain model in
	 * `model.ts`: its state (how reduced each carrier pool is, and Δp) is
	 * advanced frame by frame from the change in `t` (the sanctioned
	 * accumulator exception of the scene guide), so taking the oxygen away
	 * makes the carriers fill up one after another, and particles of a process
	 * that has stopped fade out. Each particle stream runs on a clock that is
	 * the integral of its own flux relative to the working chain. Under
	 * reduced motion the steady state of the current settings is drawn.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Label,
		Flow,
		colors,
		cycle,
		along,
		smooth,
		smoothstep,
		lerp,
		norm,
		hash,
		pingpong,
		pathFrom,
		TAU,
		type Point
	} from '#lib/draw/index.ts';
	import Carrier from '../Carrier.svelte';
	import { CHAIN } from '../colors';
	import {
		NORMAL,
		chainFluxes,
		steadyChain,
		stepChain,
		type ChainConditions,
		type ChainState
	} from '../model';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'I'));
	const offers = (id: string) => (step.controls ?? []).some((c) => c.id === id);
	const cond = $derived<ChainConditions>({
		oxygen: offers('oxygen') ? params.oxygen !== false : true,
		synthase: offers('synthase') ? params.synthase !== false : true,
		uncoupler: offers('uncoupler') ? params.uncoupler === true : false
	});

	// ---- the model --------------------------------------------------------------
	const WORKING = steadyChain(NORMAL);
	const REF = WORKING.fluxes;
	/** Model time per second of animation: the chain backs up over a few seconds. */
	const SIM_SPEED = 0.3;

	let sim: ChainState = { ...WORKING.state };
	const clocks = { e: 0, n: 0, ii: 0, q: 0, p: 0, s: 0, a: 0, l: 0 };
	let lastT = -1;
	const live = $derived.by(() => {
		const dt = t - lastT;
		if (lastT >= 0 && dt > 0 && dt < 0.5) {
			const f0 = chainFluxes(sim, cond);
			sim = stepChain(sim, dt * SIM_SPEED, cond);
			clocks.e += dt * chainRate(f0);
			clocks.n += dt * rel(f0.I, REF.I);
			clocks.ii += dt * rel(f0.II, REF.II);
			clocks.q += dt * rel(f0.III, REF.III);
			clocks.p += dt * rel(f0.pumped, REF.pumped);
			clocks.s += dt * rel(f0.throughSynthase, REF.throughSynthase);
			clocks.a += dt * rel(f0.atp, REF.atp);
			clocks.l += dt * rel(f0.leak, REF.pumped);
		}
		lastT = t;
		return { state: sim, fluxes: chainFluxes(sim, cond), clocks: { ...clocks } };
	});
	/** Electrons along the whole chain: the mean pace of complexes I, III and IV. */
	function chainRate(f: ReturnType<typeof chainFluxes>) {
		return (rel(f.I, REF.I) + rel(f.III, REF.III) + rel(f.IV, REF.IV)) / 3;
	}
	function rel(v: number, ref: number) {
		return Math.max(0, v / ref);
	}
	const view = $derived.by(() => {
		if (!reduced) return live;
		const s = steadyChain(cond, WORKING.state);
		const f = s.fluxes;
		return {
			state: s.state,
			fluxes: f,
			clocks: {
				e: t * chainRate(f),
				n: t * rel(f.I, REF.I),
				ii: t * rel(f.II, REF.II),
				q: t * rel(f.III, REF.III),
				p: t * rel(f.pumped, REF.pumped),
				s: t * rel(f.throughSynthase, REF.throughSynthase),
				a: t * rel(f.atp, REF.atp),
				l: t * rel(f.leak, REF.pumped)
			}
		};
	});
	const st = $derived(view.state);
	const fx = $derived(view.fluxes);
	const ck = $derived(view.clocks);
	/** 0 → 1 as a stream starts: a stopped process fades out instead of freezing. */
	const on = (v: number, ref: number) => smoothstep(0.03, 0.2, v / ref);
	const flowE = $derived(on(fx.IV, REF.IV));
	/** The electron stream as a whole fades as the last complexes upstream stop. */
	const flowChain = $derived(smoothstep(0.03, 0.2, chainRate(fx)));
	const allLoaded = $derived(st.c > 0.97 && st.q > 0.97 && st.nadh > 0.95);
	const flowI = $derived(on(fx.I, REF.I));
	const flowII = $derived(on(fx.II, REF.II));
	const flowS = $derived(on(fx.throughSynthase, REF.throughSynthase));
	const flowA = $derived(on(fx.atp, REF.atp));
	const flowLeak = $derived(smoothstep(0.15, 0.5, fx.leak / REF.pumped));

	const pct = (v: number, ref: number) => `${Math.round((100 * v) / ref)}%`;
	const dpMV = $derived(Math.round(st.dp * 1000));

	// ---- emphasis -------------------------------------------------------------
	const DIM = 0.45;
	const emphasis = (f: string) => ({
		I: f === 'I' ? 1 : DIM,
		II: f === 'III' ? 1 : DIM,
		q: f === 'III' || f === 'I' ? 1 : DIM,
		III: f === 'III' ? 1 : DIM,
		cytc: f === 'III' || f === 'IV' ? 1 : DIM,
		IV: f === 'IV' ? 1 : DIM,
		atp: f === 'atp' ? 1 : DIM
	});
	const op = new Tween(
		untrack(() => emphasis(focus)),
		{ duration: 750, easing: cubicInOut }
	);
	$effect(() => {
		const target = emphasis(focus);
		const duration = reduced ? 0 : 750;
		untrack(() => op.set(target, { duration }));
	});
	const o = $derived(op.current);

	const callout = $derived.by(() => {
		if (focus === 'I') return 'NADH → NAD⁺ + H⁺ + 2 e⁻ · complex I pumps 4 H⁺ out';
		if (focus === 'III') return 'QH₂ → Q + 2 H⁺ + 2 e⁻ · 4 H⁺ out per pair · FADH₂ joins at II';
		if (focus === 'IV')
			return cond.oxygen
				? 'O₂ + 4 H⁺ + 4 e⁻ → 2 H₂O · complex IV pumps 2 H⁺ per pair'
				: allLoaded
					? 'no oxygen: every carrier is loaded, the chain has stopped'
					: 'no oxygen: electrons pile up from complex IV backwards';
		if (!cond.synthase && !cond.uncoupler)
			return 'ATP synthase blocked: protons pile up and the chain slows';
		if (cond.uncoupler) return 'leaky membrane: protons flow back without making ATP';
		return 'protons flow back through ATP synthase and make ATP';
	});

	// ---- geometry ---------------------------------------------------------------
	const MEM = { top: 266, bottom: 314, mid: 290 };
	const IMS = { top: 314, bottom: 432 };
	const CII = { x: 312 };
	const CIII = { x: 440 };
	const CIV = { x: 625 };
	const SYN = { x: 820, headY: 176 };
	const LEAK_X = 716;
	const darker = (c: string) => `color-mix(in srgb, ${c} 62%, #000)`;
	const protonInk = `color-mix(in srgb, ${colors.proton} 65%, var(--stage-ink))`;

	// Complex I: an L — a membrane arm and a matrix arm that rises from its right end.
	const CI_PATH =
		'M120 276 Q120 266 130 266 L196 266 L196 168 Q196 150 214 150 L224 150 Q242 150 242 168 L242 304 Q242 314 232 314 L130 314 Q120 314 120 304 Z';

	const ePath = smooth(
		[
			{ x: 219, y: 168 },
			{ x: 220, y: 220 },
			{ x: 214, y: 270 },
			{ x: 250, y: 292 },
			{ x: 330, y: 294 },
			{ x: 398, y: 290 },
			{ x: 446, y: 312 },
			{ x: 478, y: 344 },
			{ x: 530, y: 356 },
			{ x: 580, y: 350 },
			{ x: 612, y: 322 },
			{ x: 626, y: 286 },
			{ x: 628, y: 236 },
			{ x: 640, y: 214 }
		],
		6
	);
	const E_PERIOD = 6;
	const E_COUNT = 6;
	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));

	// FADH₂ electrons: from complex II's head down into the Q pool.
	const eII = [
		{ x: 312, y: 248 },
		{ x: 312, y: 276 },
		{ x: 330, y: 292 },
		{ x: 370, y: 294 }
	];

	const iiU = $derived(cycle(ck.ii, 3));
	const iiE = $derived(along(eII, iiU));
	const o2U = $derived(cycle(ck.e, 3));

	// NADH arrives from the matrix at the top of complex I's arm; NAD⁺ leaves.
	const nadhIn = smooth([
		{ x: 70, y: 96 },
		{ x: 150, y: 110 },
		{ x: 206, y: 138 }
	]);
	const nadOut = smooth([
		{ x: 232, y: 138 },
		{ x: 280, y: 108 },
		{ x: 350, y: 98 }
	]);
	const N_PERIOD = 4;

	// Ubiquinone shuttles through the membrane: I → III and back.
	const qLoop = [
		{ x: 248, y: 284 },
		{ x: 392, y: 284 },
		{ x: 392, y: 298 },
		{ x: 248, y: 298 },
		{ x: 248, y: 284 }
	];
	const Q_PERIOD = 6;
	const HEX = (() => {
		const pts: string[] = [];
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * TAU;
			pts.push(`${(7 * Math.cos(a)).toFixed(1)} ${(7 * Math.sin(a)).toFixed(1)}`);
		}
		return `M${pts.join(' L')} Z`;
	})();

	// Pumped protons: matrix → intermembrane space, through each pump.
	interface Lane {
		x: number;
		from: number;
		to: number;
		off: number;
	}
	const lanes: Lane[] = [
		{ x: 140, from: 236, to: 352, off: 0 },
		{ x: 160, from: 236, to: 352, off: 0.25 },
		{ x: 180, from: 236, to: 352, off: 0.5 },
		{ x: 200, from: 236, to: 352, off: 0.75 },
		// complex III: released from QH₂ on the intermembrane side
		{ x: 420, from: 300, to: 372, off: 0.1 },
		{ x: 434, from: 300, to: 372, off: 0.35 },
		{ x: 448, from: 300, to: 372, off: 0.6 },
		{ x: 462, from: 300, to: 372, off: 0.85 },
		// complex IV: 2 pumped per pair
		{ x: 646, from: 236, to: 368, off: 0.2 },
		{ x: 610, from: 236, to: 368, off: 0.7 }
	];
	const P_PERIOD = 3;

	// Protons back through ATP synthase: up from the intermembrane space.
	const sPath = smooth([
		{ x: 800, y: 400 },
		{ x: 838, y: 346 },
		{ x: 842, y: 312 },
		{ x: 842, y: 270 },
		{ x: 860, y: 236 },
		{ x: 890, y: 222 }
	]);
	const S_PERIOD = 3;
	const RING = 8;
	const ring = Array.from({ length: RING }, (_, i) => i);
	/** Rotor angle: one subunit (1/8 turn) per proton through. */
	const theta = $derived((ck.s / S_PERIOD) * 5 * (TAU / RING));
	const ATP_PERIOD = 3;
	const adpIn = smooth([
		{ x: 930, y: 230 },
		{ x: 900, y: 210 },
		{ x: 866, y: 190 }
	]);
	const atpOut = smooth([
		{ x: 860, y: 156 },
		{ x: 895, y: 120 },
		{ x: 930, y: 104 }
	]);
	// Leak through the bare membrane (an uncoupler shuttles protons back).
	const leakPath = [
		{ x: LEAK_X, y: 400 },
		{ x: LEAK_X, y: 236 }
	];

	// The proton cloud in the intermembrane space grows with Δp.
	const cloudCount = $derived(Math.round(lerp(2, 30, norm(st.dp, 0.05, 0.24))));
	const cloudPts: Point[] = Array.from({ length: 30 }, (_, i) => ({
		x: 190 + hash(i, 3) * 580,
		y: 396 + hash(i, 7) * 26
	}));

	// Electrons parked on each carrier: brighter the more reduced the pool.
	const cytcX = (k: number) => lerp(492, 578, pingpong(ck.e, 3, k / 2));
	const parked = $derived([
		{ p: { x: 219, y: 174 }, v: st.nadh },
		{ p: along(qLoop, cycle(ck.q, Q_PERIOD, 0)), v: st.q },
		{ p: { x: cytcX(0), y: 356 }, v: st.c }
	]);

	const bars = $derived([
		{ id: 'nadh', label: 'NAD pool (as NADH)', v: st.nadh, c: '#1c7ed6' },
		{ id: 'q', label: 'ubiquinone (as QH₂)', v: st.q, c: CHAIN.q },
		{ id: 'c', label: 'cytochrome c', v: st.c, c: CHAIN.cytc }
	]);
	const loaded = $derived(
		bars.map((b) => `${b.label.split(' (')[0]} ${Math.round(b.v * 100)}%`).join(' · ')
	);
</script>

<g class="chain-scene">
	<!-- ================= compartments ================= -->
	<rect x="0" y="0" width="960" height={MEM.top} fill="var(--ra-matrix)" />
	<rect x="0" y={IMS.top} width="960" height={IMS.bottom - IMS.top} fill="var(--ra-ims)" />
	<rect
		x="0"
		y={MEM.top}
		width="960"
		height={MEM.bottom - MEM.top}
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
	/>
	<rect
		x="0"
		y={IMS.bottom}
		width="960"
		height="12"
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
		opacity="0.8"
	/>
	<Readout id="m">
		<Label x={24} y={36} text="matrix" anchor="start" muted />
		<Label x={24} y={334} text="↑ inner membrane" anchor="start" size={11} muted />
		<Label x={24} y={426} text="intermembrane space" anchor="start" size={11} muted />
	</Readout>

	<Readout id="callout" order={0} label="Now" value={callout}>
		<Label x={600} y={36} text={callout} size={13} weight={600} pill />
	</Readout>

	<!-- proton cloud: as many as the gradient holds -->
	{#each cloudPts.slice(0, cloudCount) as p, i (i)}
		<Molecule kind="proton" x={p.x} y={p.y} opacity={0.75} />
	{/each}

	<!-- ================= complex I ================= -->
	<g opacity={o.I}>
		<path
			d={CI_PATH}
			fill={CHAIN.I}
			style="stroke: {darker(CHAIN.I)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x="160" y="295" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">I</text>
		<g opacity={flowI}>
			{#each [0, 1] as k (k)}
				{@const u = cycle(ck.n, N_PERIOD, k / 2)}
				{#if u < 0.5}
					{@const v = u / 0.5}
					{@const p = along(nadhIn, v)}
					<Carrier kind="NADH" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
				{:else}
					{@const v = (u - 0.5) / 0.5}
					{@const p = along(nadOut, v)}
					<Carrier kind="NAD+" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
				{/if}
			{/each}
		</g>
		<Label x={120} y={150} text="complex I" anchor="end" weight={600} />
	</g>

	<!-- ================= complex II ================= -->
	<g opacity={o.II}>
		<rect
			x={CII.x - 22}
			y="270"
			width="44"
			height="40"
			rx="10"
			fill={CHAIN.II}
			style="stroke: {darker(CHAIN.II)}"
			stroke-width="1.5"
		/>
		<circle
			cx={CII.x}
			cy="244"
			r="22"
			fill={CHAIN.II}
			style="stroke: {darker(CHAIN.II)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x={CII.x} y="296" text-anchor="middle" font-size="13" font-weight="700" fill="#fff"
			>II</text
		>
		<Carrier kind="FADH2" x={CII.x} y={244} scale={0.78} opacity={0.4 + 0.6 * flowII} />
		<Label x={CII.x} y={208} text="complex II" weight={600} />
		<Label x={CII.x} y={192} text="succinate → fumarate" size={11} muted />
		<g opacity={flowII}>
			<Molecule kind="electron" x={iiE.x} y={iiE.y} opacity={fadeEnds(iiU)} glow />
		</g>
	</g>

	<!-- ================= ubiquinone ================= -->
	<g opacity={o.q}>
		{#each [0, 1, 2] as k (k)}
			{@const u = cycle(ck.q, Q_PERIOD, k / 3)}
			{@const p = along(qLoop, u)}
			<path
				d={HEX}
				transform="translate({p.x} {p.y}) rotate({ck.q * 40 + k * 60})"
				fill={u < 0.5 ? CHAIN.q : 'var(--stage-bg)'}
				stroke={CHAIN.q}
				stroke-width="1.6"
			/>
		{/each}
		<Label x={340} y={330} text="Q" size={12} weight={700} color={CHAIN.q} />
	</g>

	<!-- ================= complex III ================= -->
	<g opacity={o.III}>
		<rect
			x={CIII.x - 46}
			y="252"
			width="92"
			height="90"
			rx="18"
			fill={CHAIN.III}
			style="stroke: {darker(CHAIN.III)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<line x1={CIII.x} y1="258" x2={CIII.x} y2="336" stroke="#fff" opacity="0.3" />
		<text x={CIII.x} y="296" text-anchor="middle" font-size="15" font-weight="700" fill="#fff"
			>III</text
		>
		<Label x={CIII.x} y={238} text="complex III" weight={600} />
	</g>

	<!-- ================= cytochrome c ================= -->
	<g opacity={o.cytc}>
		{#each [0, 1] as k (k)}
			{@const x = cytcX(k)}
			<circle
				cx={x}
				cy="356"
				r="9"
				fill={CHAIN.cytc}
				style="stroke: {darker(CHAIN.cytc)}"
				stroke-width="1.2"
				filter="url(#soft-shadow)"
			/>
		{/each}
		<Label x={535} y={382} text="cytochrome c" size={11} weight={600} />
	</g>

	<!-- ================= complex IV ================= -->
	<g opacity={o.IV}>
		<rect
			x={CIV.x - 36}
			y="254"
			width="72"
			height="86"
			rx="18"
			fill={CHAIN.IV}
			style="stroke: {darker(CHAIN.IV)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x={CIV.x} y="296" text-anchor="middle" font-size="15" font-weight="700" fill="#fff"
			>IV</text
		>
		<Label x={CIV.x - 44} y={238} text="complex IV" anchor="end" weight={600} />
		<!-- O₂ + 4 H⁺ → 2 H₂O on the matrix side -->
		<g opacity={flowE}>
			{#if o2U < 0.5}
				{@const u = o2U}
				<Molecule
					kind="O2"
					x={lerp(700, 650, u / 0.5)}
					y={lerp(150, 206, u / 0.5)}
					opacity={fadeEnds(u / 0.5)}
				/>
			{:else}
				{@const v = (o2U - 0.5) / 0.5}
				{#each [-1, 1] as s (s)}
					<Molecule
						kind="H2O"
						x={650 + s * 22 * v}
						y={206 - 60 * v}
						opacity={fadeEnds(v)}
						scale={0.9}
					/>
				{/each}
			{/if}
			{#each [0, 1] as k (k)}
				{@const w = cycle(ck.e, 3, k / 2 + 0.25)}
				<Molecule
					kind="proton"
					x={lerp(580 + k * 20, 640, w)}
					y={lerp(160 + k * 10, 210, w)}
					opacity={fadeEnds(w) * 0.9}
				/>
			{/each}
		</g>
		{#if !cond.oxygen}
			<Label x={692} y={150} text="no O₂" size={12} weight={700} color={colors.oxygenEdge} />
		{/if}
	</g>

	<!-- ================= pumped protons ================= -->
	<g opacity={flowChain * 0.95}>
		{#each lanes as l, i (i)}
			{@const u = cycle(ck.p, P_PERIOD, l.off)}
			<Molecule kind="proton" x={l.x} y={lerp(l.from, l.to, u)} opacity={fadeEnds(u)} glow />
		{/each}
	</g>
	<Readout id="pumps">
		<Label x={170} y={378} text="4 H⁺" size={11} color={protonInk} weight={700} opacity={o.I} />
		<Label x={420} y={392} text="4 H⁺" size={11} color={protonInk} weight={700} opacity={o.III} />
		<Label x={680} y={356} text="2 H⁺" size={11} color={protonInk} weight={700} opacity={o.IV} />
	</Readout>

	<!-- ================= the electrons ================= -->
	<Flow
		d={pathFrom(ePath)}
		color={colors.electronEdge}
		width={1.4}
		dash={4}
		t={ck.e}
		speed={30}
		opacity={0.35}
	/>
	<g opacity={flowChain}>
		{#each Array.from({ length: E_COUNT }, (_, i) => i) as k (k)}
			{@const u = cycle(ck.e, E_PERIOD, k / E_COUNT)}
			{@const p = along(ePath, u)}
			<Molecule kind="electron" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
		{/each}
	</g>
	<!-- electrons held: a loaded carrier glows -->
	{#each parked as e, i (i)}
		<Molecule
			kind="electron"
			x={e.p.x}
			y={e.p.y}
			opacity={smoothstep(0.55, 0.95, e.v)}
			glow
			scale={1.2}
		/>
	{/each}

	<!-- ================= leak ================= -->
	<g opacity={flowLeak}>
		<Flow d={pathFrom(leakPath)} color={protonInk} width={1.5} dash={3} t={ck.l} />
		{#each [0, 1, 2] as k (k)}
			{@const u = cycle(ck.l, 1.2, k / 3)}
			{@const p = along(leakPath, u)}
			<Molecule kind="proton" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
		{/each}
		<Label x={LEAK_X} y={224} text="leak: heat" size={11} weight={600} />
	</g>

	<!-- ================= ATP synthase ================= -->
	<g opacity={o.atp}>
		<!-- peripheral stalk (stator) -->
		<path
			d="M862 300 L872 300 L872 166 Q872 150 858 150"
			fill="none"
			stroke={darker(CHAIN.synthase)}
			stroke-width="6"
			stroke-linecap="round"
		/>
		<rect
			x={SYN.x - 34}
			y={MEM.top - 2}
			width="68"
			height={MEM.bottom - MEM.top + 4}
			rx="14"
			fill={CHAIN.synthase}
			style="stroke: {darker(CHAIN.synthase)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		{#each ring as i (i)}
			{@const a = (i / RING) * TAU + theta}
			{@const c = Math.cos(a)}
			{#if c > 0}
				<line
					x1={SYN.x + 26 * Math.sin(a)}
					y1={MEM.top + 8}
					x2={SYN.x + 26 * Math.sin(a)}
					y2={MEM.bottom - 8}
					stroke={i === 0 ? darker(CHAIN.synthase) : '#fff'}
					stroke-width={i === 0 ? 5 : 3.5}
					stroke-linecap="round"
					opacity={0.25 + 0.6 * c}
				/>
			{/if}
		{/each}
		<line
			x1={SYN.x + 5 * Math.sin(theta)}
			y1={MEM.top + 2}
			x2={SYN.x}
			y2={SYN.headY + 24}
			stroke={darker(CHAIN.synthase)}
			stroke-width="10"
			stroke-linecap="round"
		/>
		<ellipse
			cx={SYN.x}
			cy={SYN.headY}
			rx="44"
			ry="32"
			fill={CHAIN.synthase}
			style="stroke: {darker(CHAIN.synthase)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text
			x={SYN.x}
			y={SYN.headY + 4}
			text-anchor="middle"
			font-size="11"
			font-weight="700"
			fill="#fff">F₁</text
		>
		<Label x={SYN.x} y={SYN.headY - 46} text="ATP synthase" weight={600} />
		{#if !cond.synthase}
			<Label x={SYN.x} y={MEM.bottom + 24} text="blocked" size={12} weight={700} pill />
		{/if}
		<g opacity={flowS}>
			{#each [0, 1, 2, 3, 4] as k (k)}
				{@const u = cycle(ck.s, S_PERIOD, k / 5)}
				{@const p = along(sPath, u)}
				<Molecule kind="proton" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
			{/each}
		</g>
		<g opacity={flowA}>
			{#each [0, 1] as k (k)}
				{@const u = cycle(ck.a, ATP_PERIOD, k / 2 + 0.2)}
				{#if u < 0.5}
					{@const v = u / 0.5}
					{@const a = along(adpIn, v)}
					<Molecule kind="ADP" x={a.x} y={a.y} opacity={fadeEnds(v)} scale={0.85} />
					<Molecule kind="Pi" x={a.x + 4} y={a.y + 18} opacity={fadeEnds(v)} scale={0.85} />
				{:else}
					{@const v = (u - 0.5) / 0.5}
					{@const p = along(atpOut, v)}
					<Molecule kind="ATP" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
				{/if}
			{/each}
		</g>
	</g>

	<!-- ================= readouts ================= -->
	<Readout id="card1">
		<rect
			x="24"
			y="452"
			width="912"
			height="132"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout id="loaded" order={4} label="Carriers holding electrons" value={loaded}>
		<text x="44" y="478" font-size="12" font-weight="600">carriers holding electrons</text>
		{#each bars as b, i (b.id)}
			{@const y = 504 + i * 26}
			<text x="44" y={y + 4} font-size="12" class="muted">{b.label}</text>
			<rect x="200" y={y - 7} width="220" height="14" rx="7" fill="var(--stage-grid)" />
			<rect x="200" y={y - 7} width={220 * b.v} height="14" rx="7" fill={b.c} />
			<text x="430" y={y + 4} font-size="12" font-weight="600">{Math.round(b.v * 100)}%</text>
		{/each}
	</Readout>
	<Readout id="dp" order={1} label="Proton-motive force" value="{dpMV} mV">
		<text x="520" y="478" font-size="12" font-weight="600">proton-motive force</text>
		<text x="916" y="478" font-size="15" font-weight="700" text-anchor="end">{dpMV} mV</text>
	</Readout>
	<Readout id="o2" order={2} label="Oxygen used" value="{pct(fx.o2, REF.o2)} of normal">
		<text x="520" y="512" font-size="12" class="muted">oxygen used</text>
		<text x="916" y="512" font-size="14" font-weight="600" text-anchor="end"
			>{pct(fx.o2, REF.o2)} of normal</text
		>
	</Readout>
	<Readout id="atp" order={3} label="ATP made" value="{pct(fx.atp, REF.atp)} of normal">
		<text x="520" y="540" font-size="12" class="muted">ATP made</text>
		<text x="916" y="540" font-size="14" font-weight="600" text-anchor="end"
			>{pct(fx.atp, REF.atp)} of normal</text
		>
	</Readout>
	<Readout id="note">
		<text x="520" y="570" font-size="11" class="muted"
			>illustrative rates; the order the carriers fill is real</text
		>
	</Readout>
</g>
