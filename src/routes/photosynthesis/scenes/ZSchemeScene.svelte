<script lang="ts">
	/**
	 * Step "zscheme": the light reactions drawn as an energy diagram.
	 *
	 * Vertical axis: electron energy as redox potential (volts), high energy
	 * (negative potential) at the top. Horizontal axis: position along the
	 * chain. Electrons run slowly down the sloped segments and jump quickly
	 * up the two photon "lifts", which gives the diagram its Z shape.
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

	let { t }: StageProps = $props();

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
	interface Station {
		id: string;
		x: number;
		v: number;
		color: string;
	}
	const stations: Station[] = [
		{ id: 'h2o', x: 175, v: 0.82, color: colors.oxygen },
		{ id: 'p680', x: 240, v: 1.2, color: colors.psii },
		{ id: 'p680x', x: 240, v: -0.7, color: colors.psii },
		{ id: 'pheo', x: 290, v: -0.6, color: colors.psii },
		{ id: 'qa', x: 345, v: -0.1, color: colors.psii },
		{ id: 'pq', x: 405, v: 0.1, color: colors.cytb6f },
		{ id: 'cyt', x: 470, v: 0.3, color: colors.cytb6f },
		{ id: 'pc', x: 535, v: 0.37, color: colors.cytb6f },
		{ id: 'p700', x: 600, v: 0.45, color: colors.psi },
		{ id: 'p700x', x: 600, v: -1.3, color: colors.psi },
		{ id: 'fes', x: 670, v: -1.0, color: colors.psi },
		{ id: 'fd', x: 750, v: -0.42, color: colors.psi },
		{ id: 'nadph', x: 835, v: -0.32, color: colors.nadph }
	];
	const P: Record<string, Point> = Object.fromEntries(
		stations.map((s) => [s.id, { x: s.x, y: yOf(s.v) }])
	);
	const pathD = pathFrom(stations.map((s) => P[s.id]));

	// Sloped run whose energy drop pumps protons (P680* → PC).
	const pumpD = pathFrom([P.p680x, P.pheo, P.qa, P.pq, P.cyt, P.pc]);

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
		{ pts: [P.h2o, P.p680], dur: 1.0 },
		{ pts: [P.p680, P.p680x], dur: 0.3, lift: 0 },
		{ pts: [P.p680x, P.pheo, P.qa, P.pq, P.cyt, P.pc, P.p700], dur: 3.9 },
		{ pts: [P.p700, P.p700x], dur: 0.3, lift: 1 },
		{ pts: [P.p700x, P.fes, P.fd, P.nadph], dur: 2.9 }
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
	const offsets = Array.from({ length: N_ELECTRONS }, (_, i) => i / N_ELECTRONS);
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

	/** Time (s) into the current journey for electron `i`. */
	const timeOf = (i: number) => ((t / PERIOD + offsets[i]) % 1) * PERIOD;

	const electrons = $derived(
		offsets.map((_, i) => {
			const time = timeOf(i);
			const p = posAt(time);
			const u = time / PERIOD;
			const fade = smoothstep(0, 0.03, u) * (1 - smoothstep(0.96, 1, u));
			return { i, x: p.x, y: p.y, opacity: fade };
		})
	);

	// Photon arrivals and flashes: one event per electron per lift.
	const ARRIVE = 0.55; // s before the jump that the photon is visible
	const FLASH = 0.45; // s the flash lasts after the jump
	const arrivals = $derived.by(() => {
		const out: {
			key: string;
			lift: number;
			photon: number; // 0–1 progress of the incoming photon, or -1
			flash: number; // 0–1 progress of the flash, or -1
		}[] = [];
		for (let i = 0; i < N_ELECTRONS; i++) {
			const time = timeOf(i);
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

	// Running tally since the step started: how many electrons have passed the
	// point `at` seconds into the journey (summed over all electrons).
	function countEvents(at: number) {
		let n = 0;
		const a = at / PERIOD;
		for (const off of offsets) {
			const c = Math.floor(t / PERIOD + off - a) - Math.ceil(off - a) + 1;
			if (c > 0) n += c;
		}
		return n;
	}
	const photonsAbsorbed = $derived(liftStarts.reduce((a, s) => a + countEvents(s), 0));
	const electronsStarted = $derived(countEvents(0));
	const electronsDelivered = $derived(countEvents(PERIOD - 0.05));
	const oxygenReleased = $derived(Math.floor(electronsStarted / 4));

	// Incoming photons travel diagonally down-left into the reaction centre.
	const photonFrom = (to: Point): Point => ({ x: to.x + 46, y: to.y - 39 });
	const photonAngle = (Math.atan2(54, -64) * 180) / Math.PI;

	// Complex bands under the horizontal axis.
	const bands = [
		{ x0: 160, x1: 360, color: colors.psii, text: 'photosystem II' },
		{ x0: 385, x1: 555, color: colors.cytb6f, text: 'PQ · cytochrome b₆f · PC' },
		{ x0: 585, x1: 770, color: colors.psi, text: 'photosystem I' }
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
		y1={Y_TOP - 6}
		x2={X0}
		y2={Y_BOTTOM}
		stroke="var(--stage-line)"
		stroke-width="1.2"
	/>
	<line x1={X0} y1={Y_BOTTOM} x2={X1} y2={Y_BOTTOM} stroke="var(--stage-line)" stroke-width="1.2" />
	<Label x={34} y={300} text="electron energy (redox potential)" size={12} muted rotate={-90} />
	<Label x={X0 + 8} y={Y_TOP - 10} text="high energy" size={11} anchor="start" muted />
	<Label x={X0 + 8} y={Y_BOTTOM + 20} text="low energy" size={11} anchor="start" muted />

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
	<Label x={X1} y={Y_BOTTOM + 24} text="position along the chain →" size={11} anchor="end" muted />

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
	<Flow d="M{P.nadph.x + 8} {P.nadph.y} L{P.nadph.x + 26} {P.nadph.y}" arrow width={2} />

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
	<Label x={P.h2o.x} y={P.h2o.y - 14} text="H₂O" size={12} />
	<Label x={X0 + 8} y={P.p680.y - 15} text="4 e⁻ from 2 H₂O," size={11} anchor="start" muted />
	<Label x={X0 + 8} y={P.p680.y} text="O₂ released" size={11} anchor="start" muted />
	<Label x={P.p680.x + 13} y={P.p680.y + 9} text="P680" size={12} anchor="start" />

	<!-- PSII lift -->
	<Photon x={P.p680.x + 12} y={363} angle={180} length={40} phase={t * 3} />
	<Label x={P.p680.x + 60} y={367} text="photon absorbed at PSII" size={12} anchor="start" />
	<Label x={P.p680x.x} y={P.p680x.y - 16} text="P680*" size={12} />
	<Label x={P.pheo.x + 12} y={P.pheo.y - 6} text="pheophytin" size={12} anchor="start" />
	<Label x={P.qa.x + 10} y={P.qa.y - 9} text="Qₐ" size={12} anchor="start" />
	<Label x={P.pq.x - 8} y={P.pq.y + 20} text="PQ" size={12} anchor="end" />
	<Label x={P.cyt.x + 6} y={P.cyt.y - 13} text="cyt b₆f" size={12} anchor="start" />
	<Label x={P.pc.x} y={P.pc.y + 23} text="PC" size={12} />
	<Label x={P.p700.x + 12} y={P.p700.y + 10} text="P700" size={12} anchor="start" />

	<!-- energy drop annotation -->
	<Label x={340} y={426} text="energy used to pump H⁺ →" size={12} anchor="start" />
	<Molecule kind="ATP" x={536} y={422} scale={0.8} />

	<!-- PSI lift -->
	<Label x={P.p700.x - 52} y={258} text="photon absorbed at PSI" size={12} anchor="end" />
	<Photon x={P.p700.x - 10} y={254} angle={0} length={40} phase={t * 3} />
	<Label x={P.p700x.x} y={P.p700x.y - 16} text="P700*" size={12} />
	<Label x={P.fes.x + 12} y={P.fes.y - 4} text="A₀ · Fe–S clusters" size={12} anchor="start" />
	<Label x={P.fd.x} y={P.fd.y + 23} text="ferredoxin" size={12} />
	<Label x={P.nadph.x} y={P.nadph.y - 18} text="NADP⁺" size={12} />
	<Molecule kind="NADPH" x={P.nadph.x + 49} y={P.nadph.y} scale={0.9} />
	<Label x={P.nadph.x + 49} y={P.nadph.y + 26} text="reducing power" size={11} muted />

	<!-- ================= animation ================= -->
	{#each arrivals as a (a.key)}
		{@const to = lifts[a.lift].from}
		{#if a.photon >= 0}
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
		{#if a.flash >= 0}
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
		<Molecule kind="electron" x={e.x} y={e.y} opacity={e.opacity} glow />
	{/each}

	<!-- ================= readouts ================= -->
	<Label
		x={X1}
		y={Y_TOP - 10}
		text="photons absorbed {photonsAbsorbed} · electrons to NADPH {electronsDelivered} · O₂ released {oxygenReleased}"
		size={11}
		anchor="end"
		muted
	/>
	<Label
		x={(X0 + X1) / 2}
		y={580}
		text="2 photons per electron · 4 electrons per O₂ · at least 8 photons per O₂"
		size={12}
		pill
	/>
</g>
