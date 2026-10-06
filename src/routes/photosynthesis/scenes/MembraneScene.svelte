<script lang="ts">
	/**
	 * Steps 5–9: the thylakoid membrane seen edge-on, with the stroma above
	 * and the lumen below. Photosystem II, the plastoquinone pool, cytochrome
	 * b₆f, plastocyanin, photosystem I (with ferredoxin and FNR) and ATP
	 * synthase sit in the membrane, left to right, and the whole chain runs
	 * continuously: photons → excitation → electrons → NADPH, water → O₂ +
	 * protons, protons → ATP. The step's `focus`/`phase` hints decide which
	 * part is lit up and which callout is shown; `params.light` scales every
	 * rate and feeds the proton gradient.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Photon,
		Label,
		Flow,
		colors,
		cycle,
		along,
		smooth,
		smoothstep,
		hash,
		lerp,
		clamp,
		easeInOut,
		pingpong,
		polar,
		dist,
		pathFrom,
		TAU,
		type Point
	} from '#lib/draw/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const focus = $derived(String(step.hints?.focus ?? 'psii'));
	const phase = $derived(String(step.hints?.phase ?? 'antenna'));
	const light = $derived(clamp(Number(params.light ?? 70), 0, 100));
	/** 1 at the default light level; every rate in the scene is multiplied by it. */
	const speed = $derived(light / 70);

	// ---- emphasis -------------------------------------------------------------
	const DIM = 0.4;
	const op = new Tween(
		{
			psii: 1,
			etc: DIM,
			psi: DIM,
			atp: DIM,
			cloud: 0.5,
			cAntenna: 1,
			cWater: 0,
			cEtc: 0,
			cPsi: 0,
			cAtp: 0
		},
		{ duration: 750, easing: cubicInOut }
	);
	$effect(() => {
		const f = focus;
		const p = phase;
		const duration = reduced ? 0 : 750;
		untrack(() =>
			op.set(
				{
					psii: f === 'psii' ? 1 : DIM,
					etc: f === 'etc' ? 1 : DIM,
					psi: f === 'psi' ? 1 : DIM,
					atp: f === 'atp' ? 1 : DIM,
					cloud: f === 'etc' || f === 'atp' || p === 'water' ? 1 : 0.5,
					cAntenna: p === 'antenna' ? 1 : 0,
					cWater: p === 'water' ? 1 : 0,
					cEtc: p === 'etc' ? 1 : 0,
					cPsi: p === 'psi' ? 1 : 0,
					cAtp: p === 'atp' ? 1 : 0
				},
				{ duration }
			)
		);
	});
	const o = $derived(op.current);
	/** 0 when a group is dimmed, 1 when it is the focus. */
	const lit = (v: number) => clamp((v - DIM) / (1 - DIM));

	// ---- proton gradient (0–1) follows the light with a lag -------------------
	const gradient = new Tween(
		untrack(() => Math.sqrt(light / 100)),
		{ duration: 2500, easing: cubicInOut }
	);
	$effect(() => {
		const target = Math.sqrt(light / 100);
		const duration = reduced ? 0 : 2500;
		untrack(() => gradient.set(target, { duration }));
	});
	const g = $derived(gradient.current);
	const lumenPH = $derived((8 - 3 * g).toFixed(1));
	const cloudCount = $derived(Math.round(lerp(6, 30, g)));
	const cloud = $derived(Array.from({ length: cloudCount }, (_, i) => i));

	// ---- group clocks: dimmed parts keep moving, at half speed -------------------
	const rate = (f: number) => speed * (0.5 + 0.5 * f);
	const tPsii = $derived(t * rate(o.psii));
	const tEtc = $derived(t * rate(o.etc));
	const tPsi = $derived(t * rate(o.psi));
	const tAtp = $derived(t * rate(o.atp));
	const tElec = $derived(t * rate(Math.max(o.psii, o.etc, o.psi)));

	// ---- geometry -------------------------------------------------------------
	const MEM = { top: 272, bottom: 328, mid: 300 };
	const PSII = { x: 170, w: 84, top: 258, bottom: 350 };
	const B6F = { x: 400, w: 60, top: 262, bottom: 338 };
	const PSI = { x: 560, w: 84, top: 258, bottom: 342 };
	const OEC = { x: 170, y: 340 };
	const FD = { x: 596, y: 243 };
	const FNR = { x: 650, y: 236 };
	const ATP = { x: 800, headY: 208 };

	const darker = (c: string) => `color-mix(in srgb, ${c} 62%, #000)`;

	// Antenna: two rings of pigment dots around a photosystem, skipping the
	// part of the ring that the protein itself covers.
	interface Dot extends Point {
		r: number;
		c: string;
	}
	function makeAntenna(
		cx: number,
		halfW: number,
		top: number,
		bottom: number,
		salt: number,
		gapBelow: boolean
	): Dot[] {
		const dots: Dot[] = [];
		const rings = [
			{ n: 24, rx: 82, ry: 54 },
			{ n: 20, rx: 64, ry: 44 }
		];
		rings.forEach((ring, ri) => {
			for (let i = 0; i < ring.n; i++) {
				const a = (i / ring.n) * TAU + ri * 0.16 + (hash(i, salt + ri) - 0.5) * 0.14;
				if (gapBelow && ri === 0 && Math.abs(a - Math.PI / 2) < 0.55) continue;
				const jr = 1 + (hash(i, salt + 7 + ri) - 0.5) * 0.12;
				const x = cx + ring.rx * jr * Math.cos(a);
				const y = MEM.mid + ring.ry * jr * Math.sin(a);
				if (Math.abs(x - cx) < halfW + 5 && y > top - 5 && y < bottom + 5) continue;
				const h = hash(i, salt + 13 + ri);
				dots.push({
					x,
					y,
					r: 2.8 + h * 1.2,
					c: h < 0.55 ? colors.chlorophyllA : h < 0.85 ? colors.chlorophyllB : colors.carotenoid
				});
			}
		});
		return dots;
	}
	const psiiDots = makeAntenna(PSII.x, PSII.w / 2, PSII.top, PSII.bottom, 1, true);
	const psiDots = makeAntenna(PSI.x, PSI.w / 2, PSI.top, PSI.bottom, 2, false);

	const lerpP = (a: Point, b: Point, u: number): Point => ({
		x: lerp(a.x, b.x, u),
		y: lerp(a.y, b.y, u)
	});
	function nearest(dots: Dot[], p: Point, exclude: Point[] = []): Point {
		let best = dots[0];
		let bd = Infinity;
		for (const d of dots) {
			if (exclude.includes(d)) continue;
			const dd = dist(d, p);
			if (dd < bd) {
				bd = dd;
				best = d;
			}
		}
		return best;
	}

	// Photons: each one has a start point, the antenna pigment it hits and the
	// chain of pigments the excitation hops along on its way to the core.
	const PH_PERIOD = 6;
	const PH_FLASH = 0.68; // cycle phase at which the excitation reaches the core
	interface PhotonSpec {
		start: Point;
		entry: Point;
		angle: number;
		chain: Point[];
		off: number;
	}
	function makePhotons(
		dots: Dot[],
		cx: number,
		core: Point,
		specs: { start: Point; angle: number }[],
		shift: number
	): PhotonSpec[] {
		return specs.map((s, j) => {
			// The excitation wanders around the ring to the pigments beside the
			// core (in the membrane plane) before it is trapped by the special pair.
			const rad = (deg: number) => (deg * Math.PI) / 180;
			const entry = nearest(dots, polar(cx, MEM.mid, 82, rad(s.angle)));
			const m1 = nearest(dots, polar(cx, MEM.mid, 82, rad((s.angle + 180) / 2)), [entry]);
			const m2 = nearest(dots, polar(cx, MEM.mid, 64, Math.PI), [entry, m1]);
			const angle = (Math.atan2(entry.y - s.start.y, entry.x - s.start.x) * 180) / Math.PI;
			const off = (((PH_FLASH - j / 3 - shift) % 1) + 1) % 1;
			return { start: s.start, entry, angle, chain: [entry, m1, m2, core], off };
		});
	}
	const P680: Point = { x: PSII.x, y: MEM.mid };
	const P700: Point = { x: PSI.x, y: MEM.mid };

	// Electron route: P680 → PQ (in the membrane) → cyt b₆f → PC (lumen) → PSI → Fd → FNR.
	const E_PERIOD = 10;
	const E_COUNT = 5;
	const ePath = smooth(
		[
			{ x: 178, y: 300 },
			{ x: 222, y: 296 },
			{ x: 290, y: 300 },
			{ x: 356, y: 306 },
			{ x: 398, y: 316 },
			{ x: 428, y: 342 },
			{ x: 445, y: 350 },
			{ x: 515, y: 350 },
			{ x: 540, y: 338 },
			{ x: 560, y: 302 },
			{ x: 572, y: 272 },
			{ x: 596, y: 246 },
			{ x: 625, y: 236 },
			{ x: 650, y: 234 }
		],
		6
	);
	/** Arc-length fraction of the electron route at which it passes P700. */
	const f700 = (() => {
		let best = 0;
		let bd = Infinity;
		ePath.forEach((p, i) => {
			const d = dist(p, P700);
			if (d < bd) {
				bd = d;
				best = i;
			}
		});
		let total = 0;
		let upTo = 0;
		for (let i = 1; i < ePath.length; i++) {
			const d = dist(ePath[i - 1], ePath[i]);
			total += d;
			if (i <= best) upTo += d;
		}
		return upTo / total;
	})();
	// Electrons leave P680 every E_PERIOD / E_COUNT seconds (= 2 s); the PSII
	// flashes are phased to coincide, and the PSI flashes to the electron's
	// arrival at P700.
	const psiiPhotons = makePhotons(
		psiiDots,
		PSII.x,
		P680,
		[
			{ start: { x: 60, y: 150 }, angle: 185 },
			{ start: { x: 72, y: 112 }, angle: 210 },
			{ start: { x: 90, y: 92 }, angle: 235 }
		],
		0
	);
	const psiPhotons = makePhotons(
		psiDots,
		PSI.x,
		P700,
		[
			{ start: { x: 476, y: 124 }, angle: 200 },
			{ start: { x: 488, y: 102 }, angle: 220 },
			{ start: { x: 504, y: 86 }, angle: 240 }
		],
		((E_PERIOD * f700) % 2) / PH_PERIOD
	);

	// Water in, O₂ and protons out (PSII, lumen side).
	const O2_PERIOD = 8;
	const waterPaths = [
		smooth([
			{ x: 66, y: 534 },
			{ x: 116, y: 454 },
			{ x: 160, y: 370 }
		]),
		smooth([
			{ x: 236, y: 540 },
			{ x: 198, y: 460 },
			{ x: 178, y: 370 }
		])
	];
	const o2Path = smooth([
		{ x: 170, y: 360 },
		{ x: 132, y: 410 },
		{ x: 92, y: 456 },
		{ x: 58, y: 500 }
	]);
	const burstAngles = [28, 66, 112, 152];

	// Plastoquinone: three molecules looping between PSII (stroma side, where
	// they pick up protons) and cyt b₆f (lumen side, where the protons are
	// released).
	const PQ_PERIOD = 6;
	const pqLoop: Point[] = [
		{ x: 238, y: 283 },
		{ x: 300, y: 298 },
		{ x: 362, y: 316 },
		{ x: 300, y: 308 },
		{ x: 238, y: 283 }
	];
	const hexPath = (r: number) =>
		Array.from({ length: 6 }, (_, i) => polar(0, 0, r, (i / 6) * TAU + Math.PI / 6))
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' ') + ' Z';
	const HEX = hexPath(8);

	// Ferredoxin → FNR: NADP⁺ + H⁺ in, NADPH out.
	const N_PERIOD = 8;
	const nadpIn = smooth([
		{ x: 766, y: 40 },
		{ x: 752, y: 130 },
		{ x: 682, y: 214 }
	]);
	const nadphOut = smooth([
		{ x: 668, y: 228 },
		{ x: 676, y: 162 },
		{ x: 692, y: 104 }
	]);
	const hIn = smooth([
		{ x: 736, y: 262 },
		{ x: 702, y: 246 },
		{ x: 672, y: 232 }
	]);

	// ATP synthase: protons stream up through CF₀; ADP + Pi meet at CF₁; ATP leaves.
	const ROTOR_TURN = 7; // seconds per full turn at the default light (14 H⁺)
	const ATP_PERIOD = (ROTOR_TURN / 3) * 2; // two ATP particles → 3 ATP per turn
	const H_PERIOD = 2.5; // five protons → 2 H⁺/s = 14 per turn
	const protonStream = smooth([
		{ x: 792, y: 414 },
		{ x: 797, y: 350 },
		{ x: 800, y: 300 },
		{ x: 802, y: 262 },
		{ x: 806, y: 248 }
	]);
	const adpIn = smooth([
		{ x: 926, y: 246 },
		{ x: 882, y: 236 },
		{ x: 838, y: 218 }
	]);
	const piIn = smooth([
		{ x: 930, y: 200 },
		{ x: 886, y: 200 },
		{ x: 836, y: 206 }
	]);
	const atpOut = smooth([
		{ x: 818, y: 190 },
		{ x: 842, y: 120 },
		{ x: 846, y: 52 }
	]);
	const rotor = Array.from({ length: 14 }, (_, i) => i);
	const theta = $derived((tAtp / ROTOR_TURN) * TAU);

	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
	/** Position of the excitation pulse along a hop chain, snapping dot to dot. */
	function hop(chain: Point[], v: number) {
		const n = chain.length - 1;
		const idx = Math.min(n - 1, Math.floor(v * n));
		const f = easeInOut(clamp(v * n - idx));
		return { p: lerpP(chain[idx], chain[idx + 1], f), idx };
	}

	const noLight = $derived(1 - smoothstep(0, 10, light));
</script>

<g class="membrane-scene">
	<!-- ================= compartments ================= -->
	<rect x="0" y="0" width="960" height={MEM.top} fill="var(--stroma)" />
	<rect x="0" y={MEM.bottom} width="960" height={600 - MEM.bottom} fill="var(--lumen)" />

	<!-- proton cloud in the lumen (count follows the gradient) -->
	<g opacity={lerp(0.45, 1, o.cloud)}>
		{#each cloud as i (i)}
			{@const x = 56 + hash(i, 31) * 850 + 5 * Math.sin(t * 0.6 + i * 1.7)}
			{@const y = 374 + hash(i, 32) * 160 + 4 * Math.cos(t * 0.5 + i * 2.3)}
			<Molecule kind="proton" {x} {y} scale={0.85} opacity={0.85} />
		{/each}
	</g>
	<!-- a few protons in the stroma: scarce, and scarcer in bright light -->
	<g opacity={lerp(0.9, 0.35, g)}>
		<Molecule kind="proton" x={300} y={80} scale={0.85} />
		<Molecule kind="proton" x={600} y={112} scale={0.85} />
		<Molecule kind="proton" x={900} y={92} scale={0.85} />
	</g>

	<!-- ================= lipid bilayer ================= -->
	<rect
		x="0"
		y={MEM.top}
		width="960"
		height={MEM.bottom - MEM.top}
		fill="var(--membrane)"
		stroke="var(--membrane-edge)"
		stroke-width="1"
	/>
	<!-- tails: one thick dashed line gives a row of vertical bars -->
	<line
		x1="4"
		y1={MEM.mid}
		x2="956"
		y2={MEM.mid}
		stroke="var(--membrane-edge)"
		stroke-width="18"
		stroke-dasharray="1.2 9.8"
		opacity="0.45"
	/>
	<!-- heads: dash length 0 with round caps gives a row of dots -->
	{#each [MEM.top + 7, MEM.bottom - 7] as y (y)}
		<line
			x1="8"
			y1={y}
			x2="952"
			y2={y}
			stroke="var(--membrane-edge)"
			stroke-width="8"
			stroke-linecap="round"
			stroke-dasharray="0 11"
		/>
		<line
			x1="8"
			y1={y}
			x2="952"
			y2={y}
			stroke="var(--membrane)"
			stroke-width="5.5"
			stroke-linecap="round"
			stroke-dasharray="0 11"
		/>
	{/each}

	<!-- ================= photosystem II ================= -->
	<g opacity={o.psii}>
		{#each psiiDots as d, i (i)}
			<circle cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity="0.9" />
		{/each}
		<rect
			x={PSII.x - PSII.w / 2}
			y={PSII.top}
			width={PSII.w}
			height={PSII.bottom - PSII.top}
			rx="20"
			fill={colors.psii}
			style="stroke: {darker(colors.psii)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x={PSII.x} y="281" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
			>PSII</text
		>
		<!-- P680: the special chlorophyll pair -->
		<circle cx={PSII.x - 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<circle cx={PSII.x + 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<text
			x={PSII.x}
			y="320"
			text-anchor="middle"
			font-size="10"
			font-weight="700"
			fill="#fff"
			opacity="0.95">P680</text
		>
		<!-- oxygen-evolving complex: Mn₄CaO₅ -->
		<g transform="translate({OEC.x} {OEC.y})">
			{#each [[-7, -3], [3, -6], [-2, 5], [11, 0]] as [dx, dy], i (i)}
				<circle cx={dx} cy={dy} r="3.6" fill="#a855f7" stroke="#581c87" stroke-width="1" />
			{/each}
			<circle cx="6" cy="4" r="3.2" fill="#d9f99d" stroke="#65a30d" stroke-width="1" />
		</g>

		<!-- photons → antenna → P680 -->
		{#each psiiPhotons as ph, j (j)}
			{@const u = cycle(tPsii, PH_PERIOD, ph.off)}
			{#if u < 0.45}
				{@const v = u / 0.45}
				<Photon
					x={lerp(ph.start.x, ph.entry.x, v)}
					y={lerp(ph.start.y, ph.entry.y, v)}
					angle={ph.angle}
					opacity={smoothstep(0, 0.12, v) * (1 - smoothstep(0.9, 1, v))}
					phase={t * 3}
				/>
			{:else if u < PH_FLASH}
				{@const h = hop(ph.chain, (u - 0.45) / (PH_FLASH - 0.45))}
				<path
					d={pathFrom(ph.chain)}
					fill="none"
					stroke={colors.photon}
					stroke-width="1.2"
					stroke-dasharray="3 3"
					opacity="0.55"
				/>
				<circle
					cx={ph.chain[h.idx].x}
					cy={ph.chain[h.idx].y}
					r="7"
					fill="none"
					stroke={colors.photon}
					stroke-width="1.5"
					opacity="0.8"
				/>
				<circle cx={h.p.x} cy={h.p.y} r="6" fill={colors.photon} filter="url(#glow)" />
			{:else if u < PH_FLASH + 0.12}
				{@const v = (u - PH_FLASH) / 0.12}
				<circle
					cx={P680.x}
					cy={P680.y}
					r={6 + 18 * v}
					fill="none"
					stroke={colors.photon}
					stroke-width={2.5 * (1 - v)}
					opacity={1 - v}
				/>
			{/if}
		{/each}

		<!-- water in, O₂ and 4 H⁺ out -->
		{#each waterPaths as path, i (i)}
			{@const u = cycle(tPsii, O2_PERIOD, i / 2)}
			{@const p = along(path, u)}
			<Molecule
				kind="H2O"
				x={p.x}
				y={p.y}
				rotate={-20 + 25 * Math.sin(t + i * 2)}
				opacity={fadeEnds(u)}
				scale={0.85}
				label={i === 0 ? 'H₂O' : undefined}
				labelPosition="left"
			/>
		{/each}
		{#each [0] as k (k)}
			{@const u = cycle(tPsii, O2_PERIOD, 0)}
			{#if u < 0.55}
				{@const v = u / 0.55}
				{@const p = along(o2Path, v)}
				<Molecule
					kind="O2"
					x={p.x}
					y={p.y}
					rotate={-40 + 20 * Math.sin(t * 1.3)}
					opacity={fadeEnds(v)}
					scale={0.9}
					label="O₂"
					labelPosition="right"
				/>
			{/if}
			{#if u < 0.22}
				{@const v = u / 0.22}
				<circle
					cx={OEC.x}
					cy={OEC.y + 8}
					r={8 + 22 * v}
					fill="none"
					stroke={colors.oxygen}
					stroke-width={2 * (1 - v)}
					opacity={0.8 * (1 - v)}
				/>
				{#each burstAngles as a, i (i)}
					{@const p = polar(OEC.x, OEC.y + 10, 12 + 52 * easeInOut(v), (a * Math.PI) / 180)}
					<Molecule
						kind="proton"
						x={p.x}
						y={p.y}
						opacity={smoothstep(0, 0.1, v) * (1 - smoothstep(0.6, 1, v))}
					/>
				{/each}
			{/if}
		{/each}
	</g>

	<!-- ================= electron transport chain ================= -->
	<g opacity={o.etc}>
		<!-- plastoquinone shuttles: H⁺ picked up from the stroma, released by b₆f into the lumen -->
		{#each [0, 1, 2] as k (k)}
			{@const u = cycle(tEtc, PQ_PERIOD, k / 3)}
			{@const p = along(pqLoop, u)}
			<path
				d={HEX}
				transform="translate({p.x} {p.y}) rotate({tEtc * 40 + k * 60})"
				fill="var(--protein)"
				stroke="var(--protein-edge)"
				stroke-width="1.2"
			/>
			{@const pu = cycle(tEtc, PQ_PERIOD, k / 3 + 0.14)}
			{#if pu < 0.14}
				{@const v = pu / 0.14}
				{#each [-7, 7] as dx (dx)}
					<Molecule
						kind="proton"
						x={pqLoop[0].x + dx}
						y={lerp(236, 280, easeInOut(v))}
						opacity={smoothstep(0, 0.15, v) * (1 - smoothstep(0.85, 1, v))}
					/>
				{/each}
			{/if}
			{#if u > 0.5 && u < 0.64}
				{@const v = (u - 0.5) / 0.14}
				{#each [-8, 8] as dx (dx)}
					<Molecule
						kind="proton"
						x={B6F.x + dx + dx * v}
						y={lerp(320, 374, easeInOut(v))}
						opacity={smoothstep(0, 0.15, v) * (1 - smoothstep(0.7, 1, v))}
					/>
				{/each}
			{/if}
		{/each}

		<!-- cytochrome b₆f -->
		<rect
			x={B6F.x - B6F.w / 2}
			y={B6F.top}
			width={B6F.w}
			height={B6F.bottom - B6F.top}
			rx="16"
			fill={colors.cytb6f}
			style="stroke: {darker(colors.cytb6f)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x={B6F.x} y="296" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
			>cyt b₆f</text
		>

		<!-- plastocyanin: copper protein ferrying electrons along the lumen -->
		{#each [0, 1] as k (k)}
			{@const x = lerp(440, 520, pingpong(tEtc, 5, k / 2))}
			<circle
				cx={x}
				cy="350"
				r="8"
				fill="#60a5fa"
				stroke="#1d4ed8"
				stroke-width="1.2"
				filter="url(#soft-shadow)"
			/>
		{/each}
	</g>

	<!-- ================= photosystem I ================= -->
	<g opacity={o.psi}>
		{#each psiDots as d, i (i)}
			<circle cx={d.x} cy={d.y} r={d.r} fill={d.c} opacity="0.9" />
		{/each}
		<rect
			x={PSI.x - PSI.w / 2}
			y={PSI.top}
			width={PSI.w}
			height={PSI.bottom - PSI.top}
			rx="20"
			fill={colors.psi}
			style="stroke: {darker(colors.psi)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		<text x={PSI.x} y="281" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
			>PSI</text
		>
		<circle cx={PSI.x - 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<circle cx={PSI.x + 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<text
			x={PSI.x}
			y="320"
			text-anchor="middle"
			font-size="10"
			font-weight="700"
			fill="#fff"
			opacity="0.95">P700</text
		>
		<!-- ferredoxin and FNR on the stroma side -->
		<circle
			cx={FD.x}
			cy={FD.y}
			r="9"
			fill="#fb923c"
			stroke="#c2410c"
			stroke-width="1.2"
			filter="url(#soft-shadow)"
		/>
		<ellipse
			cx={FNR.x}
			cy={FNR.y}
			rx="19"
			ry="11"
			fill="var(--protein)"
			stroke="var(--protein-edge)"
			stroke-width="1.2"
			filter="url(#soft-shadow)"
		/>

		{#each psiPhotons as ph, j (j)}
			{@const u = cycle(tPsi, PH_PERIOD, ph.off)}
			{#if u < 0.45}
				{@const v = u / 0.45}
				<Photon
					x={lerp(ph.start.x, ph.entry.x, v)}
					y={lerp(ph.start.y, ph.entry.y, v)}
					angle={ph.angle}
					opacity={smoothstep(0, 0.12, v) * (1 - smoothstep(0.9, 1, v))}
					phase={t * 3}
				/>
			{:else if u < PH_FLASH}
				{@const h = hop(ph.chain, (u - 0.45) / (PH_FLASH - 0.45))}
				<path
					d={pathFrom(ph.chain)}
					fill="none"
					stroke={colors.photon}
					stroke-width="1.2"
					stroke-dasharray="3 3"
					opacity="0.55"
				/>
				<circle
					cx={ph.chain[h.idx].x}
					cy={ph.chain[h.idx].y}
					r="7"
					fill="none"
					stroke={colors.photon}
					stroke-width="1.5"
					opacity="0.8"
				/>
				<circle cx={h.p.x} cy={h.p.y} r="6" fill={colors.photon} filter="url(#glow)" />
			{:else if u < PH_FLASH + 0.12}
				{@const v = (u - PH_FLASH) / 0.12}
				<circle
					cx={P700.x}
					cy={P700.y}
					r={6 + 18 * v}
					fill="none"
					stroke={colors.photon}
					stroke-width={2.5 * (1 - v)}
					opacity={1 - v}
				/>
			{/if}
		{/each}

		<!-- NADP⁺ + H⁺ → NADPH at FNR -->
		{#each [0, 1] as k (k)}
			{@const u = cycle(tPsi, N_PERIOD, k / 2 + 0.3)}
			{#if u < 0.5}
				{@const v = u / 0.5}
				{@const p = along(nadpIn, v)}
				<Molecule kind="NADP+" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
				{#if v > 0.4}
					{@const w = (v - 0.4) / 0.6}
					{@const q = along(hIn, w)}
					<Molecule kind="proton" x={q.x} y={q.y} opacity={fadeEnds(w)} />
				{/if}
			{:else}
				{@const v = (u - 0.5) / 0.5}
				{@const p = along(nadphOut, v)}
				<Molecule kind="NADPH" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
			{/if}
		{/each}
	</g>

	<!-- electrons ride the whole chain; the route is drawn as a faint marching dash -->
	<g opacity={lerp(0.55, 1, Math.max(o.psii, o.etc, o.psi))}>
		<Flow
			d={pathFrom(ePath)}
			color={colors.electronEdge}
			width={1.4}
			dash={4}
			t={tElec}
			speed={30}
			opacity={lerp(0.14, 0.45, lit(o.etc))}
		/>
		{#each Array.from({ length: E_COUNT }, (_, i) => i) as k (k)}
			{@const u = cycle(tElec, E_PERIOD, k / E_COUNT)}
			{@const p = along(ePath, u)}
			<Molecule kind="electron" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
		{/each}
	</g>

	<!-- ================= ATP synthase ================= -->
	<g opacity={o.atp}>
		<!-- CF₀ ring in the membrane, with the rotor seen from the side -->
		<rect
			x={ATP.x - 32}
			y={MEM.top - 2}
			width="64"
			height={MEM.bottom - MEM.top + 4}
			rx="14"
			fill={colors.atpSynthase}
			style="stroke: {darker(colors.atpSynthase)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		{#each rotor as i (i)}
			{@const a = (i / rotor.length) * TAU + theta}
			{@const c = Math.cos(a)}
			{#if c > 0}
				<line
					x1={ATP.x + 25 * Math.sin(a)}
					y1={MEM.top + 8}
					x2={ATP.x + 25 * Math.sin(a)}
					y2={MEM.bottom - 8}
					stroke="#fff"
					stroke-width="3"
					stroke-linecap="round"
					opacity={0.15 + 0.6 * c}
				/>
			{/if}
		{/each}
		<!-- stalk and CF₁ head in the stroma -->
		<rect
			x={ATP.x - 6}
			y={ATP.headY + 22}
			width="12"
			height={MEM.top - ATP.headY - 20}
			fill={darker(colors.atpSynthase)}
		/>
		<ellipse
			cx={ATP.x}
			cy={ATP.headY}
			rx="42"
			ry="30"
			fill={colors.atpSynthase}
			style="stroke: {darker(colors.atpSynthase)}"
			stroke-width="1.5"
			filter="url(#soft-shadow)"
		/>
		{#each [-90, 30, 150] as a (a)}
			{@const p = polar(ATP.x, ATP.headY, 15, (a * Math.PI) / 180)}
			<circle cx={p.x} cy={p.y} r="13" fill="#fff" opacity="0.16" />
		{/each}
		<text
			x={ATP.x}
			y={ATP.headY + 4}
			text-anchor="middle"
			font-size="10"
			font-weight="700"
			fill="#fff">CF₁</text
		>
		<text x={ATP.x + 38} y="346" text-anchor="start" font-size="10" class="muted">CF₀ rotor</text>

		<!-- protons stream up through the rotor -->
		{#each [0, 1, 2, 3, 4] as k (k)}
			{@const u = cycle(tAtp, H_PERIOD, k / 5)}
			{@const p = along(protonStream, u)}
			<Molecule kind="proton" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
		{/each}
		<!-- ADP + Pi → ATP at the head -->
		{#each [0, 1] as k (k)}
			{@const u = cycle(tAtp, ATP_PERIOD, k / 2)}
			{#if u < 0.5}
				{@const v = u / 0.5}
				{@const a = along(adpIn, v)}
				{@const q = along(piIn, v)}
				<Molecule kind="ADP" x={a.x} y={a.y} opacity={fadeEnds(v)} scale={0.9} />
				<Molecule kind="Pi" x={q.x} y={q.y} opacity={fadeEnds(v)} scale={0.9} />
			{:else}
				{@const v = (u - 0.5) / 0.5}
				{@const p = along(atpOut, v)}
				<Molecule kind="ATP" x={p.x} y={p.y} opacity={fadeEnds(v)} scale={0.9} />
			{/if}
		{/each}
	</g>

	<!-- ================= labels ================= -->
	<Label x={24} y={40} text="stroma · pH ≈ 8" anchor="start" size={14} weight={600} />
	<Label x={24} y={58} text="the Calvin cycle runs out here" anchor="start" size={11} muted />
	<Label
		x={24}
		y={562}
		text="thylakoid lumen · pH ≈ {lumenPH}"
		anchor="start"
		size={14}
		weight={600}
	/>
	<Label
		x={24}
		y={580}
		text="about 1000× more acidic than the stroma in bright light"
		anchor="start"
		size={11}
		muted
	/>
	<Label
		x={940}
		y={580}
		text="no light: electron flow stops and the gradient drains away"
		anchor="end"
		size={11}
		muted
		opacity={noLight}
	/>

	<!-- names and roles -->
	<g opacity={o.psii}>
		<Label x={124} y={196} text="Photosystem II" anchor="start" weight={600} />
		<Label
			x={124}
			y={212}
			text="splits water, fires electrons"
			anchor="start"
			size={lerp(11, 12.5, lit(o.psii))}
			muted
		/>
		<Label x={220} y={366} text="Mn₄CaO₅" anchor="start" size={11} muted />
	</g>
	<g opacity={o.etc}>
		<Label x={400} y={196} text="Cytochrome b₆f" weight={600} />
		<Label x={400} y={212} text="pumps H⁺ into the lumen" size={lerp(11, 12.5, lit(o.etc))} muted />
		<Label x={290} y={352} text="PQ pool" size={11} muted />
		<Label x={480} y={373} text="PC" size={11} muted />
	</g>
	<g opacity={o.psi}>
		<Label x={512} y={196} text="Photosystem I" anchor="start" weight={600} />
		<Label
			x={512}
			y={212}
			text="re-energises electrons"
			anchor="start"
			size={lerp(11, 12.5, lit(o.psi))}
			muted
		/>
		<Label x={583} y={247} text="Fd" anchor="end" size={11} muted />
		<Label x={650} y={262} text="FNR" size={11} muted />
	</g>
	<g opacity={o.atp}>
		<Label x={852} y={150} text="ATP synthase" anchor="start" weight={600} />
		<Label
			x={852}
			y={166}
			text="proton turbine"
			anchor="start"
			size={lerp(11, 12.5, lit(o.atp))}
			muted
		/>
	</g>

	<!-- callouts -->
	<Label
		x={270}
		y={150}
		text="excitation hops pigment → pigment → P680"
		pill
		opacity={o.cAntenna}
	/>
	<Label x={320} y={412} text="2 H₂O → O₂ + 4 H⁺ + 4 e⁻" pill weight={600} opacity={o.cWater} />
	<Label
		x={440}
		y={444}
		text="electrons downhill, protons pumped into the lumen"
		pill
		opacity={o.cEtc}
	/>
	<Label x={600} y={70} text="NADP⁺ + H⁺ + 2 e⁻ → NADPH" pill weight={600} opacity={o.cPsi} />
	<Label x={800} y={452} text="~14 H⁺ per turn → 3 ATP" pill weight={600} opacity={o.cAtp} />
</g>
