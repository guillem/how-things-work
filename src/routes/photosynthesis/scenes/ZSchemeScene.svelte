<script lang="ts">
	/**
	 * Step "zscheme": the light reactions drawn as an energy diagram.
	 *
	 * Vertical axis: electron energy as redox potential (volts), high energy
	 * (negative potential) at the top. Horizontal axis: position along the
	 * chain. Electrons run slowly down the sloped segments and jump quickly
	 * up the two photon "lifts", which gives the diagram its Z shape.
	 *
	 * Electron i appears in water at t = i·SPACING and holds there briefly, so
	 * the viewer sees the first electron start in water, and the tally in the
	 * top-right only counts events that happened on screen. In the frozen
	 * reduced-motion frame the electrons are staggered the other way, so that
	 * all of them are already on the path, with no flash active and one photon
	 * in flight.
	 */
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Photon,
		Flow,
		Label,
		colors,
		along,
		pathFrom,
		smoothstep,
		easeOut,
		clamp,
		type Point
	} from '#lib/draw/index.ts';

	let { t, reduced }: StageProps = $props();

	// ---- axes ------------------------------------------------------------------
	const X0 = 110;
	const X1 = 900;
	const V_BOTTOM = 1.4;
	const V_TOP = -1.6;
	const Y_BOTTOM = 520;
	const Y_TOP = 80;
	/** y coordinate of a redox potential (volts). */
	const yOf = (v: number) => Y_BOTTOM + ((v - V_BOTTOM) / (V_TOP - V_BOTTOM)) * (Y_TOP - Y_BOTTOM);
	const ticks = [1.0, 0.5, 0, -0.5, -1.0, -1.5].map((v) => ({
		v,
		y: yOf(v),
		text: v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} V`
	}));

	// ---- stations ---------------------------------------------------------------
	// Textbook midpoint potentials, rounded.
	interface Station {
		id: string;
		x: number;
		v: number;
		color: string;
	}
	const stations: Station[] = [
		{ id: 'h2o', x: 185, v: 0.82, color: colors.oxygen },
		{ id: 'p680', x: 250, v: 1.2, color: colors.psii },
		{ id: 'p680x', x: 250, v: -0.7, color: colors.psii },
		{ id: 'pheo', x: 300, v: -0.6, color: colors.psii },
		{ id: 'qa', x: 355, v: -0.1, color: colors.psii },
		{ id: 'pq', x: 415, v: 0.1, color: colors.cytb6f },
		{ id: 'cyt', x: 480, v: 0.3, color: colors.cytb6f },
		{ id: 'pc', x: 545, v: 0.37, color: colors.cytb6f },
		{ id: 'p700', x: 610, v: 0.45, color: colors.psi },
		{ id: 'p700x', x: 610, v: -1.3, color: colors.psi },
		{ id: 'a0', x: 645, v: -1.0, color: colors.psi },
		{ id: 'a1', x: 680, v: -0.8, color: colors.psi },
		{ id: 'fes', x: 722, v: -0.55, color: colors.psi },
		{ id: 'fd', x: 775, v: -0.42, color: colors.psi },
		{ id: 'nadp', x: 845, v: -0.32, color: colors.nadph }
	];
	const P: Record<string, Point> = Object.fromEntries(
		stations.map((s) => [s.id, { x: s.x, y: yOf(s.v) }])
	);
	const pathD = pathFrom(stations.map((s) => P[s.id]));

	// The stretch whose energy drop pumps protons: plastoquinone through
	// cytochrome b₆f to plastocyanin. The pheophytin → Q_A drop inside PSII is
	// the cost of stabilising the charge separation (lost as heat), so it is
	// deliberately NOT part of this band.
	const pumpD = pathFrom([P.pq, P.cyt, P.pc]);

	// ---- lifts --------------------------------------------------------------------
	const lifts = [
		{ id: 'psii', from: P.p680, to: P.p680x },
		{ id: 'psi', from: P.p700, to: P.p700x }
	];

	// ---- electron timeline --------------------------------------------------------
	// Segments of the journey with their durations (s): slopes are slow, lifts fast.
	interface Seg {
		pts: Point[];
		dur: number;
		lift?: number;
		start: number;
	}
	const segDefs: Omit<Seg, 'start'>[] = [
		{ pts: [P.h2o, P.h2o], dur: 0.25 }, // appear and hold at the water dot
		{ pts: [P.h2o, P.p680], dur: 0.75 },
		{ pts: [P.p680, P.p680x], dur: 0.3, lift: 0 },
		{ pts: [P.p680x, P.pheo, P.qa, P.pq, P.cyt, P.pc, P.p700], dur: 3.9 },
		{ pts: [P.p700, P.p700x], dur: 0.3, lift: 1 },
		{ pts: [P.p700x, P.a0, P.a1, P.fes, P.fd, P.nadp], dur: 2.9 }
	];
	const segs: Seg[] = [];
	{
		let acc = 0;
		for (const d of segDefs) {
			segs.push({ ...d, start: acc });
			acc += d.dur;
		}
	}
	const PERIOD = segs.reduce((a, s) => a + s.dur, 0);
	// Three electrons spaced 2.8 s apart: with these durations the two lifts fire
	// alternately, a flash every 1.4 s.
	const N_ELECTRONS = 3;
	const SPACING = PERIOD / N_ELECTRONS;
	const ids = Array.from({ length: N_ELECTRONS }, (_, i) => i);
	const liftStarts = segs.filter((s) => s.lift !== undefined).map((s) => s.start);

	/** Position of an electron at `time` seconds into its journey. */
	function posAt(time: number) {
		for (const s of segs) {
			if (time < s.start + s.dur) {
				const u = clamp((time - s.start) / s.dur);
				return along(s.pts, s.lift !== undefined ? easeOut(u) : u);
			}
		}
		return along(segs[segs.length - 1].pts, 1);
	}

	// Electron i first appears in water at t = i·SPACING. In the frozen
	// reduced-motion frame (t = 2.5 s) the stagger is negated, so that all three
	// are already on the path, and shortened by 0.3 s so that no flash is active
	// at that instant: the electrons then sit near Q_A, just short of P700 (with
	// its photon in flight) and between the Fe–S clusters and ferredoxin.
	const REDUCED_SPACING = SPACING - 0.3;
	const stagger = $derived(reduced ? -REDUCED_SPACING : SPACING);
	/** Seconds since electron `i` first left water; negative before it has. */
	const ageOf = (i: number) => t - i * stagger;

	const electrons = $derived(
		ids.map((i) => {
			const age = ageOf(i);
			if (age < 0) return { i, x: 0, y: 0, opacity: 0 };
			const time = age % PERIOD;
			const p = posAt(time);
			const u = time / PERIOD;
			// Fade in within ≈ 0.13 s, while the electron still holds at the water dot.
			const fade = smoothstep(0, 0.015, u) * (1 - smoothstep(0.96, 1, u));
			return { i, x: p.x, y: p.y, opacity: fade };
		})
	);

	// Photon arrivals and flashes: one event per electron per lift.
	const ARRIVE = 0.6; // s before the jump that the photon is visible
	const FLASH = 0.45; // s the flash lasts after the jump
	const arrivals = $derived.by(() => {
		const out: {
			key: string;
			lift: number;
			photon: number; // 0–1 progress of the incoming photon, or -1
			flash: number; // 0–1 progress of the flash, or -1
		}[] = [];
		for (const i of ids) {
			const age = ageOf(i);
			if (age < 0) continue;
			const time = age % PERIOD;
			liftStarts.forEach((s, li) => {
				const d = time - s;
				const photon = d >= -ARRIVE && d < 0 ? (d + ARRIVE) / ARRIVE : -1;
				const flash = d >= 0 && d < FLASH ? d / FLASH : -1;
				if (photon >= 0 || flash >= 0) out.push({ key: `${i}-${li}`, lift: li, photon, flash });
			});
		}
		return out;
	});

	/** 0–1 brightening of each lift while an electron is jumping up it. */
	const liftPulse = $derived(
		lifts.map((_, li) =>
			arrivals.reduce((m, a) => (a.lift === li && a.flash >= 0 ? Math.max(m, 1 - a.flash) : m), 0)
		)
	);

	// Running tally since the step started: how many times an electron has
	// passed the point `at` seconds into the journey, summed over all electrons.
	// Only events that happened on screen are counted.
	function countEvents(at: number) {
		let n = 0;
		for (const i of ids) {
			const age = ageOf(i) - at;
			if (age >= 0) n += Math.floor(age / PERIOD) + 1;
		}
		return n;
	}
	const photonsAbsorbed = $derived(liftStarts.reduce((a, s) => a + countEvents(s), 0));
	// Counted once the electron is visible at the water dot (≈ 0.1 s into its hold).
	const electronsFromWater = $derived(countEvents(0.1));
	const electronsDelivered = $derived(countEvents(PERIOD - 0.05));
	const oxygenReleased = $derived(Math.floor(electronsFromWater / 4));

	// Incoming photons fly in horizontally from the right. They spawn under the
	// caption pill (which is drawn above them), so they visibly emerge from
	// behind it and cross the open gap into the reaction centre.
	const photonFrom = (to: Point): Point => ({ x: to.x + 60, y: to.y - 10 });
	const photonAngle = (Math.atan2(10, -60) * 180) / Math.PI;

	// Complex bands under the horizontal axis.
	const bands = [
		{ x0: 170, x1: 370, color: colors.psii, text: 'photosystem II' },
		{ x0: 395, x1: 565, color: colors.cytb6f, text: 'electron transport chain' },
		{ x0: 595, x1: 740, color: colors.psi, text: 'photosystem I' }
	];
</script>

<g class="zscheme-scene">
	<!-- ================= grid and axes ================= -->
	{#each ticks as tick (tick.v)}
		<line
			x1={X0}
			y1={tick.y}
			x2={X1}
			y2={tick.y}
			stroke="var(--stage-grid)"
			stroke-width="1"
			shape-rendering="crispEdges"
		/>
		<line x1={X0 - 4} y1={tick.y} x2={X0} y2={tick.y} stroke="var(--stage-line)" stroke-width="1" />
		<Label x={X0 - 8} y={tick.y + 4} text={tick.text} size={11} anchor="end" muted />
	{/each}
	<line
		x1={X0}
		y1={Y_BOTTOM}
		x2={X0}
		y2={Y_TOP - 6}
		stroke="var(--stage-line)"
		stroke-width="1.2"
		marker-end="url(#arrowhead)"
	/>
	<line
		x1={X0}
		y1={Y_BOTTOM}
		x2={X1}
		y2={Y_BOTTOM}
		stroke="var(--stage-line)"
		stroke-width="1.2"
		marker-end="url(#arrowhead)"
	/>
	<Label x={34} y={300} text="electron energy (redox potential)" size={12} muted rotate={-90} />
	<Label x={X0 + 8} y={Y_TOP - 8} text="high energy" size={11} anchor="start" muted />
	<Label x={X0 - 8} y={Y_BOTTOM + 14} text="low energy" size={11} anchor="end" muted />
	<Label
		x={X1 - 10}
		y={Y_BOTTOM - 7}
		text="position along the chain"
		size={11}
		anchor="end"
		muted
	/>

	<!-- complex bands along the horizontal axis -->
	{#each bands as b (b.text)}
		<rect
			x={b.x0}
			y={Y_BOTTOM + 4}
			width={b.x1 - b.x0}
			height="4"
			rx="2"
			fill={b.color}
			opacity="0.8"
		/>
		<Label x={(b.x0 + b.x1) / 2} y={Y_BOTTOM + 24} text={b.text} size={11} muted />
	{/each}

	<!-- ================= the Z path ================= -->
	<!-- energy drop used for proton pumping -->
	<path
		d={pumpD}
		fill="none"
		stroke={colors.atp}
		stroke-width="16"
		stroke-linecap="round"
		stroke-linejoin="round"
		opacity="0.16"
	/>
	<path
		d={pathD}
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<!-- photon lifts -->
	{#each lifts as lift, li (lift.id)}
		{#if liftPulse[li] > 0}
			<line
				x1={lift.from.x}
				y1={lift.from.y}
				x2={lift.to.x}
				y2={lift.to.y}
				stroke={colors.photon}
				stroke-width={6 + 8 * liftPulse[li]}
				stroke-linecap="round"
				opacity={0.35 * liftPulse[li]}
			/>
		{/if}
		<line
			x1={lift.from.x}
			y1={lift.from.y}
			x2={lift.to.x}
			y2={lift.to.y + 9}
			stroke={colors.photon}
			stroke-width="3.5"
			stroke-linecap="round"
			marker-end="url(#arrowhead)"
		/>
	{/each}
	<!-- arrow into NADPH -->
	<Flow d="M{P.nadp.x + 8} {P.nadp.y} L{P.nadp.x + 26} {P.nadp.y}" arrow width={2} />

	<!-- stations -->
	{#each stations as s (s.id)}
		<circle
			cx={P[s.id].x}
			cy={P[s.id].y}
			r="5.5"
			fill={s.color}
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/each}

	<!-- ================= annotations ================= -->
	<!-- start: water -->
	<Label x={X0 + 8} y={P.h2o.y - 35} text="4 e⁻ from 2 H₂O" size={11} anchor="start" muted />
	<Label x={X0 + 8} y={P.h2o.y - 20} text="O₂ released" size={11} anchor="start" muted />
	<Label x={P.h2o.x - 11} y={P.h2o.y + 4} text="H₂O" size={12} anchor="end" />
	<Label x={P.p680.x} y={P.p680.y + 18} text="P680" size={12} />

	<!-- PSII lift and the downhill run -->
	<Label x={P.p680x.x} y={P.p680x.y - 16} text="P680*" size={12} />
	<Label x={P.pheo.x + 12} y={P.pheo.y - 6} text="pheophytin" size={12} anchor="start" />
	<text class="halo" x={P.qa.x + 10} y={P.qa.y - 9} font-size="12" font-weight="500"
		>Q<tspan font-size="9" dy="2.5">A</tspan></text
	>
	<Label x={P.pq.x - 8} y={P.pq.y + 20} text="PQ" size={12} anchor="end" />
	<Label x={P.cyt.x + 6} y={P.cyt.y - 13} text="cyt b₆f" size={12} anchor="start" />
	<Label x={P.pc.x} y={P.pc.y + 23} text="PC" size={12} />
	<Label x={P.p700.x} y={P.p700.y + 19} text="P700" size={12} />
	<Label x={386} y={416} text="energy drop pumps H⁺ →" size={12} anchor="start" />
	<Molecule kind="ATP" x={559} y={412} scale={0.8} />
	<Label x={573} y={432} text="(via ATP synthase)" size={11} anchor="end" muted />

	<!-- PSI lift and the acceptor chain -->
	<Label x={P.p700x.x} y={P.p700x.y - 16} text="P700*" size={12} />
	<Label x={P.a0.x + 12} y={P.a0.y - 6} text="A₀" size={12} anchor="start" />
	<Label x={P.a1.x + 12} y={P.a1.y - 6} text="A₁" size={12} anchor="start" />
	<Label x={P.fes.x + 11} y={P.fes.y - 9} text="Fe–S clusters" size={12} anchor="start" />
	<Label x={P.fd.x} y={P.fd.y + 23} text="ferredoxin" size={12} />
	<Label x={P.nadp.x} y={P.nadp.y - 18} text="NADP⁺" size={12} />
	<Molecule kind="NADPH" x={P.nadp.x + 49} y={P.nadp.y} scale={0.9} />
	<Label x={P.nadp.x + 49} y={P.nadp.y + 26} text="energy stored" size={11} muted />

	<!-- ================= animation ================= -->
	<!-- incoming photons, drawn before the caption pills so they emerge from behind them -->
	{#each arrivals as a (a.key)}
		{#if a.photon >= 0}
			{@const to = lifts[a.lift].from}
			{@const from = photonFrom(to)}
			{@const u = a.photon}
			<Photon
				x={from.x + (to.x - from.x) * u}
				y={from.y + (to.y - from.y) * u}
				angle={photonAngle}
				length={34}
				opacity={smoothstep(0, 0.25, u)}
				phase={t * 4}
			/>
		{/if}
	{/each}

	<!-- photon captions: the animated photons fly out of these into the reaction centres -->
	<Label
		x={300}
		y={P.p680.y - 5}
		text="1st photon · absorbed at PSII"
		size={12}
		anchor="start"
		pill
	/>
	<Label
		x={660}
		y={P.p700.y - 5}
		text="2nd photon · absorbed at PSI"
		size={12}
		anchor="start"
		pill
	/>

	<!-- flashes at the reaction centres when a photon lands -->
	{#each arrivals as a (a.key)}
		{#if a.flash >= 0}
			{@const to = lifts[a.lift].from}
			{@const u = a.flash}
			<circle
				cx={to.x}
				cy={to.y}
				r={6 + 26 * easeOut(u)}
				fill={colors.photon}
				opacity={0.7 * (1 - u)}
			/>
			<circle
				cx={to.x}
				cy={to.y}
				r={10 + 30 * easeOut(u)}
				fill="none"
				stroke={colors.photon}
				stroke-width={2 * (1 - u)}
				opacity={0.7 * (1 - u)}
			/>
		{/if}
	{/each}

	{#each electrons as e (e.i)}
		{#if e.opacity > 0}
			<Molecule kind="electron" x={e.x} y={e.y} opacity={e.opacity} glow />
		{/if}
	{/each}

	<!-- ================= readouts ================= -->
	<Label
		x={X1}
		y={Y_TOP - 8}
		text="photons absorbed {photonsAbsorbed} · e⁻ from water {electronsFromWater} · e⁻ to NADPH {electronsDelivered} · O₂ released {oxygenReleased}"
		size={12}
		anchor="end"
	/>
	<Label
		x={(X0 + X1) / 2}
		y={570}
		text="2 photons per electron · 4 electrons per O₂ · at least 8 photons per O₂"
		size={12}
		pill
	/>
</g>
