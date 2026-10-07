<script lang="ts">
	/**
	 * Steps 5–9: the thylakoid membrane seen edge-on, with the stroma above
	 * and the lumen below. Photosystem II (core + light-harvesting antenna),
	 * the plastoquinone pool, cytochrome b₆f, plastocyanin, photosystem I
	 * (with ferredoxin and FNR) and ATP synthase sit in the membrane, left to
	 * right, and the whole chain runs continuously on ONE clock so that the
	 * events stay in step: a flash at P680 → an electron leaves → it reaches
	 * P700 just as P700 flashes → NADPH; every fourth P680 flash splits two
	 * waters; protons pile up in the lumen and stream back through ATP
	 * synthase. The step's `focus`/`phase` hints decide which part is lit up
	 * and which callout is shown; `params.light` scales the rate, fades the
	 * driven particles out when the light is off and feeds the proton gradient.
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
	/** 1 at the default light level; the whole chain runs at this rate. */
	const speed = $derived(light / 70);
	/**
	 * One clock for every driven process, so flashes, electrons and products
	 * stay in step. It is the integral of `speed` over time, accumulated from
	 * the frame-to-frame change of `t` (the sanctioned exception in the scene
	 * guide): a pure `t × speed` would make every electron, PQ, PC disc and
	 * the rotor teleport with each notch of the light slider. The guards keep
	 * it safe when `t` restarts at 0 on a step change (dt < 0: resync only)
	 * and when the clock is paused (dt = 0). Under reduced motion the frozen
	 * `t × speed` is used instead, so that frame stays the t = 2.5 s frame.
	 */
	let chainAcc = 0;
	let lastT = -1;
	const chainClock = $derived.by(() => {
		const dt = t - lastT;
		if (lastT >= 0 && dt > 0 && dt < 0.5) chainAcc += dt * speed;
		lastT = t;
		return chainAcc;
	});
	const tc = $derived(reduced ? t * speed : chainClock);

	// ---- emphasis -------------------------------------------------------------
	const DIM = 0.5;
	const emphasis = (f: string, p: string) => ({
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
	});
	const op = new Tween(
		untrack(() => emphasis(focus, phase)),
		{ duration: 750, easing: cubicInOut }
	);
	$effect(() => {
		const target = emphasis(focus, phase);
		const duration = reduced ? 0 : 750;
		// untrack: the tween's own state must not re-trigger this effect
		untrack(() => op.set(target, { duration }));
	});
	const o = $derived(op.current);
	/** 0 when a group is dimmed, 1 when it is the focus. */
	const lit = (v: number) => clamp((v - DIM) / (1 - DIM));

	// ---- light-driven flow: 1 in the light, 0 when the light is off ------------
	// Every driven particle (photons, excitations, electrons, moving protons,
	// substrates and products) is faded by this, so switching the light off
	// visibly stops the machinery instead of freezing particles in mid-air.
	const flowT = new Tween(
		untrack(() => smoothstep(0, 12, light)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const target = smoothstep(0, 12, light);
		const duration = reduced ? 0 : 700;
		untrack(() => flowT.set(target, { duration }));
	});
	const flow = $derived(flowT.current);

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

	// ---- geometry -------------------------------------------------------------
	const MEM = { top: 272, bottom: 328, mid: 300 };
	const ANT = { top: 266, bottom: 334 }; // light-harvesting antenna belt
	const PSII = { x: 170, w: 84, top: 258, bottom: 350, antL: 60, antR: 280 };
	const B6F = { x: 396, w: 60, top: 262, bottom: 338 };
	const PSI = { x: 574, w: 84, top: 258, bottom: 342, antL: 472, antR: 676 };
	const OEC = { x: 170, y: 340 };
	const FD = { x: 610, y: 243 };
	const FNR = { x: 666, y: 236 };
	const ATP = { x: 800, headY: 208 };
	const P680: Point = { x: PSII.x, y: MEM.mid };
	const P700: Point = { x: PSI.x, y: MEM.mid };

	const darker = (c: string) => `color-mix(in srgb, ${c} 62%, #000)`;
	/** Proton pink pulled towards the ink of the theme, for the small H⁺ direction cues. */
	const protonInk = `color-mix(in srgb, ${colors.proton} 65%, var(--stage-ink))`;

	// Antenna pigments: a small, regular lattice of chlorophyll a / b and
	// carotenoid molecules in each wing of the light-harvesting belt,
	// WING_ROWS rows × WING_COLS columns, indexed wing[col * WING_ROWS + row].
	interface Dot extends Point {
		r: number;
		c: string;
	}
	const WING_ROWS = 3;
	const WING_COLS = 4;
	function makeWing(x0: number, salt: number): Dot[] {
		const dots: Dot[] = [];
		for (let c = 0; c < WING_COLS; c++) {
			for (let r = 0; r < WING_ROWS; r++) {
				const i = c * WING_ROWS + r;
				const h = hash(i, salt);
				dots.push({
					x: x0 + c * 13 + (hash(i, salt + 1) - 0.5) * 1.5,
					y: 283 + r * 17 + (hash(i, salt + 2) - 0.5) * 1.5,
					r: 4 + h * 0.5,
					c: h < 0.55 ? colors.chlorophyllA : h < 0.85 ? colors.chlorophyllB : colors.carotenoid
				});
			}
		}
		return dots;
	}
	const psiiWingL = makeWing(72, 1);
	const psiiWingR = makeWing(225, 2);
	const psiWingL = makeWing(484, 3);
	const psiWingR = makeWing(628, 4);
	const psiiDots = [...psiiWingL, ...psiiWingR];
	const psiDots = [...psiWingL, ...psiWingR];

	const lerpP = (a: Point, b: Point, u: number): Point => ({
		x: lerp(a.x, b.x, u),
		y: lerp(a.y, b.y, u)
	});

	// Photons: each one has a start point, the antenna pigment it hits and the
	// chain of pigments the excitation hops along on its way to the special pair.
	const PH_PERIOD = 6;
	const PH_FLIGHT = 0.45; // cycle phase at which the photon is absorbed
	const PH_FLASH = 0.68; // cycle phase at which the excitation reaches the core
	interface PhotonSpec {
		start: Point;
		entry: Point;
		angle: number;
		chain: Point[];
		off: number;
	}
	function makePhotons(
		wing: Dot[],
		core: Point,
		specs: { start: Point; hops: [number, number][] }[],
		shift: number
	): PhotonSpec[] {
		return specs.map((s, j) => {
			const chain: Point[] = s.hops.map(([c, r]) => wing[c * WING_ROWS + r]);
			chain.push(core);
			const entry = chain[0];
			const angle = (Math.atan2(entry.y - s.start.y, entry.x - s.start.x) * 180) / Math.PI;
			const off = (((PH_FLASH - j / 3 - shift) % 1) + 1) % 1;
			return { start: s.start, entry, angle, chain, off };
		});
	}

	// Electron route: P680 → PQ (in the membrane) → cyt b₆f → PC (lumen) → P700 → Fd → FNR.
	const E_PERIOD = 10;
	const E_COUNT = 5; // one electron leaves P680 every 2 s
	const ePath = smooth(
		[
			{ x: 176, y: 300 },
			{ x: 214, y: 308 },
			{ x: 252, y: 309 },
			{ x: 300, y: 292 },
			{ x: 336, y: 302 },
			{ x: 372, y: 314 },
			{ x: 404, y: 322 },
			{ x: 424, y: 344 },
			{ x: 445, y: 352 },
			{ x: 515, y: 352 },
			{ x: 542, y: 338 },
			{ x: 574, y: 302 },
			// leave the pair along its own level and climb the right side of the
			// core, clear of the 'PSI' / 'P700' texts (x ≈ 559–589)
			{ x: 600, y: 296 },
			{ x: 612, y: 270 },
			{ x: 610, y: 252 },
			{ x: 638, y: 238 },
			{ x: 666, y: 236 }
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
	// PSII flashes 0.4 s before each electron leaves P680 (electrons leave at
	// t ≡ 0 mod 2 s); PSI flashes 0.3 s before the electron reaches P700.
	const psiiPhotons = makePhotons(
		psiiWingL,
		P680,
		[
			{
				start: { x: 30, y: 150 },
				hops: [
					[0, 0],
					[1, 1],
					[2, 2],
					[3, 1]
				]
			},
			{
				start: { x: 100, y: 90 },
				hops: [
					[2, 0],
					[3, 1]
				]
			},
			{
				start: { x: 40, y: 100 },
				hops: [
					[1, 0],
					[2, 1],
					[3, 2]
				]
			}
		],
		1.6 / PH_PERIOD
	);
	const psiPhotons = makePhotons(
		psiWingL,
		P700,
		[
			{
				// these three lines stay between the cyt b₆f subtitle (x ≤ 479)
				// and the 'Photosystem I' title (x ≥ 525)
				start: { x: 508, y: 116 },
				hops: [
					[0, 0],
					[1, 1],
					[2, 2],
					[3, 1]
				]
			},
			{
				start: { x: 478, y: 46 },
				hops: [
					[1, 0],
					[2, 1],
					[3, 2]
				]
			},
			{
				start: { x: 463, y: 78 },
				hops: [
					[2, 0],
					[3, 1]
				]
			}
		],
		((((E_PERIOD * f700 - 0.3) % 2) + 2) % 2) / PH_PERIOD
	);

	// Water in, O₂ + 4 H⁺ out at the Mn₄CaO₅ cluster (lumen side of PSII), and
	// 4 e⁻ up into P680. One O₂ per four P680 flashes = every 8 s, 0.1 s after a flash.
	const O2_PERIOD = 8;
	const W_OFF = 0.7875;
	const waterPaths = [
		smooth([
			{ x: 60, y: 520 },
			{ x: 112, y: 450 },
			{ x: 160, y: 372 }
		]),
		smooth([
			{ x: 250, y: 520 },
			{ x: 206, y: 456 },
			{ x: 180, y: 372 }
		])
	];
	// O₂ drifts away to the left, below the Mn₄CaO₅ label and clear of the
	// water routes; the four H⁺ fan out to the right and below (never along the
	// O₂ route), from the right side of the cluster.
	const o2Path = smooth([
		{ x: 162, y: 360 },
		{ x: 122, y: 378 },
		{ x: 78, y: 396 },
		{ x: 36, y: 412 }
	]);
	const BURST: Point = { x: OEC.x + 8, y: OEC.y + 10 };
	const burstAngles = [16, 44, 72, 100];

	// Plastoquinone: three molecules looping between PSII (where they pick up
	// 2 e⁻ and 2 H⁺ from the stroma) and cyt b₆f (which releases the H⁺ into the lumen).
	const PQ_PERIOD = 6;
	const PQ_OFF = 0.15;
	const pqLoop: Point[] = [
		{ x: 300, y: 284 },
		{ x: 332, y: 300 },
		{ x: 360, y: 316 },
		{ x: 332, y: 306 },
		{ x: 300, y: 284 }
	];
	const hexPath = (r: number) =>
		Array.from({ length: 6 }, (_, i) => polar(0, 0, r, (i / 6) * TAU + Math.PI / 6))
			.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
			.join(' ') + ' Z';
	const HEX = hexPath(8);

	// Ferredoxin → FNR: NADP⁺ + H⁺ in (from the stroma), NADPH out (into the stroma).
	// The two carriers run phase-locked (one arrives while the other leaves), so
	// the routes keep ≥ 55 px between them wherever they share a height; the
	// NADP⁺ start also stays clear of the ATP exit (x ≥ 781) and the CF₁ head.
	const N_PERIOD = 8;
	const nadpIn = smooth([
		{ x: 750, y: 140 },
		{ x: 744, y: 180 },
		{ x: 700, y: 226 }
	]);
	const nadphOut = smooth([
		{ x: 670, y: 222 },
		{ x: 686, y: 160 },
		{ x: 700, y: 80 }
	]);
	const hIn = smooth([
		{ x: 732, y: 262 },
		{ x: 704, y: 248 },
		{ x: 676, y: 236 }
	]);

	// ATP synthase: protons stream up through CF₀ (lumen → stroma); ADP + Pi meet at CF₁; ATP leaves.
	const ROTOR_TURN = 7; // seconds per full turn at the default light (14 H⁺)
	const ATP_PERIOD = (ROTOR_TURN / 3) * 2; // two ATP particles → 3 ATP per turn
	const H_PERIOD = 2.5; // five protons → 2 H⁺/s = 14 per turn
	const protonStream = smooth([
		{ x: 792, y: 414 },
		{ x: 797, y: 350 },
		{ x: 800, y: 300 },
		{ x: 802, y: 262 },
		{ x: 806, y: 250 }
	]);
	const adpIn = smooth([
		{ x: 926, y: 252 },
		{ x: 884, y: 238 },
		{ x: 842, y: 222 }
	]);
	const piIn = smooth([
		{ x: 930, y: 198 },
		{ x: 888, y: 200 },
		{ x: 840, y: 206 }
	]);
	const atpOut = smooth([
		{ x: 806, y: 184 },
		{ x: 792, y: 120 },
		{ x: 786, y: 50 }
	]);
	const rotor = Array.from({ length: 14 }, (_, i) => i);
	const theta = $derived((tc / ROTOR_TURN) * TAU);
	/** Two opposite c-subunits are marked, so one marker is always on the visible half. */
	const marked = (i: number) => i === 0 || i === 7;

	/**
	 * S-state of the Mn₄CaO₅ cluster: each P680 flash pulls one electron out
	 * of it (S₀ → S₁ → … → S₄) and the fourth triggers the water split, 0.1 s
	 * later, which resets it. Drawn as a yellow halo per charged Mn atom.
	 */
	const sState = $derived(Math.min(4, Math.floor(cycle(tc, O2_PERIOD, W_OFF) * 4 + 0.04)));

	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
	/** Position of the excitation pulse along a hop chain, snapping dot to dot. */
	function hop(chain: Point[], v: number) {
		const n = chain.length - 1;
		const idx = Math.min(n - 1, Math.floor(v * n));
		const f = easeInOut(clamp(v * n - idx));
		return { p: lerpP(chain[idx], chain[idx + 1], f), idx };
	}
</script>

{#snippet antennaRun(photons: PhotonSpec[], core: Point)}
	<g opacity={flow}>
		{#each photons as ph, j (j)}
			{@const u = cycle(tc, PH_PERIOD, ph.off)}
			{#if u < PH_FLIGHT}
				{@const v = u / PH_FLIGHT}
				<Photon
					x={lerp(ph.start.x, ph.entry.x, v)}
					y={lerp(ph.start.y, ph.entry.y, v)}
					angle={ph.angle}
					opacity={smoothstep(0, 0.12, v) * (1 - smoothstep(0.9, 1, v))}
					phase={t * 3}
				/>
			{:else if u < PH_FLASH}
				{@const h = hop(ph.chain, (u - PH_FLIGHT) / (PH_FLASH - PH_FLIGHT))}
				<path
					d={pathFrom(ph.chain)}
					fill="none"
					stroke={colors.photon}
					stroke-width="1.3"
					stroke-dasharray="3 3"
					opacity="0.6"
				/>
				<circle
					cx={ph.chain[h.idx].x}
					cy={ph.chain[h.idx].y}
					r="7"
					fill="none"
					stroke={colors.photon}
					stroke-width="1.5"
					opacity="0.85"
				/>
				<circle cx={h.p.x} cy={h.p.y} r="6.5" fill={colors.photon} filter="url(#glow)" />
			{:else if u < PH_FLASH + 0.12}
				{@const v = (u - PH_FLASH) / 0.12}
				<circle
					cx={core.x}
					cy={core.y}
					r={6 + 18 * v}
					fill="none"
					stroke={colors.photon}
					stroke-width={2.5 * (1 - v)}
					opacity={1 - v}
				/>
			{/if}
		{/each}
	</g>
{/snippet}

<g class="membrane-scene">
	<!-- ================= compartments ================= -->
	<rect x="0" y="0" width="960" height={MEM.top} fill="var(--stroma)" />
	<rect x="0" y={MEM.bottom} width="960" height={600 - MEM.bottom} fill="var(--lumen)" />

	<!-- proton cloud in the lumen (count follows the gradient) -->
	<g opacity={lerp(0.45, 1, o.cloud)}>
		{#each cloud as i (i)}
			{@const x = 56 + hash(i, 31) * 850 + 5 * Math.sin(t * 0.6 + i * 1.7)}
			{@const y = 392 + hash(i, 32) * 140 + 4 * Math.cos(t * 0.5 + i * 2.3)}
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
		<!-- light-harvesting antenna belt with its pigments -->
		<rect
			x={PSII.antL}
			y={ANT.top}
			width={PSII.antR - PSII.antL}
			height={ANT.bottom - ANT.top}
			rx="12"
			fill={colors.psii}
			opacity="0.3"
		/>
		{#each psiiDots as d, i (i)}
			<circle
				cx={d.x}
				cy={d.y}
				r={d.r}
				fill={d.c}
				style="stroke: {darker(d.c)}"
				stroke-width="0.8"
			/>
		{/each}
		<!-- reaction-centre core -->
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
		<!-- P680: the special chlorophyll pair, and the slot the water electrons climb through -->
		<rect x={PSII.x - 5.5} y="306" width="11" height="30" rx="5.5" fill="#fff" opacity="0.2" />
		<circle cx={PSII.x - 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<circle cx={PSII.x + 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<!-- oxygen-evolving complex: Mn₄CaO₅; a halo per Mn atom charged by a flash (S-state) -->
		<g transform="translate({OEC.x} {OEC.y})">
			{#each [[-7, -3], [3, -6], [-2, 5], [11, 0]] as [dx, dy], i (i)}
				{#if i < sState}
					<circle cx={dx} cy={dy} r="6.5" fill={colors.photon} opacity={0.6 * flow} />
				{/if}
			{/each}
			{#each [[-7, -3], [3, -6], [-2, 5], [11, 0]] as [dx, dy], i (i)}
				<circle cx={dx} cy={dy} r="3.6" fill="#a855f7" stroke="#581c87" stroke-width="1" />
			{/each}
			<circle cx="6" cy="4" r="3.2" fill="#d9f99d" stroke="#65a30d" stroke-width="1" />
		</g>

		<!-- photons → antenna → P680 (before the core texts, so the flash ring passes under them) -->
		{@render antennaRun(psiiPhotons, P680)}
		<text x={PSII.x} y="271" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
			>PSII</text
		>
		<text
			x={PSII.x}
			y="290"
			text-anchor="middle"
			font-size="10"
			font-weight="700"
			fill="#fff"
			opacity="0.95">P680</text
		>

		<!-- water in, O₂ + 4 H⁺ out, 4 e⁻ up to P680 -->
		<g opacity={flow}>
			<!-- the two waters travel almost together and both arrive just before the split -->
			{#each waterPaths as path, i (i)}
				{@const u = cycle(tc, O2_PERIOD, i * 0.06 + W_OFF)}
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
				{@const u = cycle(tc, O2_PERIOD, W_OFF)}
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
						labelPosition="below"
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
						{@const q = polar(BURST.x, BURST.y, 12 + 50 * easeInOut(v), (a * Math.PI) / 180)}
						<Molecule
							kind="proton"
							x={q.x}
							y={q.y}
							opacity={smoothstep(0, 0.1, v) * (1 - smoothstep(0.6, 1, v))}
						/>
					{/each}
				{/if}
				<!-- the four electrons climb from the cluster into P680 -->
				{#each [0, 1, 2, 3] as i (i)}
					{@const v = (u - 0.02 - i * 0.05) / 0.07}
					{#if v > 0 && v < 1}
						<Molecule
							kind="electron"
							x={OEC.x + (i - 1.5) * 2}
							y={lerp(OEC.y - 4, P680.y + 7, easeInOut(v))}
							opacity={smoothstep(0, 0.15, v) * (1 - smoothstep(0.8, 1, v))}
							glow
						/>
					{/if}
				{/each}
			{/each}
		</g>
	</g>

	<!-- ================= electron transport chain ================= -->
	<g opacity={o.etc}>
		<!-- plastoquinone shuttles: H⁺ picked up from the stroma, released by b₆f into the lumen -->
		{#each [0, 1, 2] as k (k)}
			{@const u = cycle(tc, PQ_PERIOD, k / 3 + PQ_OFF)}
			{@const p = along(pqLoop, u)}
			<path
				d={HEX}
				transform="translate({p.x} {p.y}) rotate({tc * 40 + k * 60})"
				fill="var(--protein)"
				stroke="var(--protein-edge)"
				stroke-width="1.2"
			/>
			{@const pu = cycle(tc, PQ_PERIOD, k / 3 + PQ_OFF + 0.14)}
			{#if pu < 0.14}
				{@const v = pu / 0.14}
				{#each [-7, 7] as dx (dx)}
					<Molecule
						kind="proton"
						x={pqLoop[0].x + dx}
						y={lerp(246, 284, easeInOut(v))}
						opacity={flow * smoothstep(0, 0.15, v) * (1 - smoothstep(0.85, 1, v))}
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
						opacity={flow * smoothstep(0, 0.15, v) * (1 - smoothstep(0.7, 1, v))}
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
		<!-- where the protons get on (from the stroma, onto PQ) and off (from b₆f, into the lumen) -->
		<Flow d="M316 236 L316 268" color={protonInk} width={1.5} arrow opacity={0.85} />
		<Flow d="M{B6F.x} 342 L{B6F.x} 376" color={protonInk} width={1.5} arrow opacity={0.85} />

		<!-- plastocyanin: copper protein ferrying electrons along the lumen -->
		{#each [0, 1] as k (k)}
			{@const x = lerp(445, 515, pingpong(tc, 5, k / 2))}
			<circle
				cx={x}
				cy="352"
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
		<rect
			x={PSI.antL}
			y={ANT.top}
			width={PSI.antR - PSI.antL}
			height={ANT.bottom - ANT.top}
			rx="12"
			fill={colors.psi}
			opacity="0.3"
		/>
		{#each psiDots as d, i (i)}
			<circle
				cx={d.x}
				cy={d.y}
				r={d.r}
				fill={d.c}
				style="stroke: {darker(d.c)}"
				stroke-width="0.8"
			/>
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
		<circle cx={PSI.x - 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<circle cx={PSI.x + 5} cy={MEM.mid} r="5" fill={colors.chlorophyllA} stroke="#fff" />
		<!-- photons → antenna → P700 (before the core texts, so the flash ring passes under them) -->
		{@render antennaRun(psiPhotons, P700)}
		<text x={PSI.x} y="271" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
			>PSI</text
		>
		<text
			x={PSI.x}
			y="290"
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

		<!-- NADP⁺ + H⁺ → NADPH at FNR -->
		<g opacity={flow}>
			{#each [0, 1] as k (k)}
				{@const u = cycle(tc, N_PERIOD, k / 2 + 0.3)}
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
	</g>

	<!-- electrons ride the whole chain; the route is drawn as a faint marching dash -->
	<g opacity={lerp(0.55, 1, Math.max(o.psii, o.etc, o.psi))}>
		<Flow
			d={pathFrom(ePath)}
			color={colors.electronEdge}
			width={1.4}
			dash={4}
			t={tc}
			speed={30}
			opacity={lerp(0.14, 0.45, lit(o.etc))}
		/>
		<g opacity={flow}>
			{#each Array.from({ length: E_COUNT }, (_, i) => i) as k (k)}
				{@const u = cycle(tc, E_PERIOD, k / E_COUNT)}
				{@const p = along(ePath, u)}
				<Molecule kind="electron" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
			{/each}
		</g>
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
		<!-- back half of the ring, faint, so the marked subunits can be followed all the way round -->
		{#each rotor as i (i)}
			{@const a = (i / rotor.length) * TAU + theta}
			{@const c = Math.cos(a)}
			{#if c <= 0}
				<line
					x1={ATP.x + 25 * Math.sin(a)}
					y1={MEM.top + 10}
					x2={ATP.x + 25 * Math.sin(a)}
					y2={MEM.bottom - 10}
					stroke={marked(i) ? darker(colors.atpSynthase) : '#fff'}
					stroke-width={marked(i) ? 3 : 2}
					stroke-linecap="round"
					opacity={marked(i) ? 0.3 : 0.16}
				/>
			{/if}
		{/each}
		{#each rotor as i (i)}
			{@const a = (i / rotor.length) * TAU + theta}
			{@const c = Math.cos(a)}
			{#if c > 0}
				<line
					x1={ATP.x + 25 * Math.sin(a)}
					y1={MEM.top + 8}
					x2={ATP.x + 25 * Math.sin(a)}
					y2={MEM.bottom - 8}
					stroke={marked(i) ? darker(colors.atpSynthase) : '#fff'}
					stroke-width={marked(i) ? 4 : 3}
					stroke-linecap="round"
					opacity={0.2 + 0.6 * c}
				/>
			{/if}
		{/each}
		<!-- central stalk (turns with the ring) and CF₁ head in the stroma -->
		<line
			x1={ATP.x + 5 * Math.sin(theta)}
			y1={MEM.top + 2}
			x2={ATP.x}
			y2={ATP.headY + 22}
			stroke={darker(colors.atpSynthase)}
			stroke-width="10"
			stroke-linecap="round"
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

		<g opacity={flow}>
			<!-- protons stream up through the rotor, lumen → stroma -->
			{#each [0, 1, 2, 3, 4] as k (k)}
				{@const u = cycle(tc, H_PERIOD, k / 5)}
				{@const p = along(protonStream, u)}
				<Molecule kind="proton" x={p.x} y={p.y} opacity={fadeEnds(u)} glow />
			{/each}
			<!-- ADP + Pi → ATP at the head -->
			{#each [0, 1] as k (k)}
				{@const u = cycle(tc, ATP_PERIOD, k / 2 + 0.2)}
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
	</g>

	<!-- ================= labels ================= -->
	<Label x={24} y={40} text="stroma · pH ≈ 8" anchor="start" size={14} weight={600} />
	<Label x={24} y={58} text="the Calvin cycle runs here" anchor="start" size={11} muted />
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
		opacity={1 - flow}
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
		<Label x={246} y={348} text="antenna" size={11} muted />
		<Label x={118} y={353} text="Mn₄CaO₅" anchor="end" size={11} muted />
		<line x1="121" y1="350" x2="156" y2="343" stroke="var(--stage-ink-muted)" stroke-width="1" />
	</g>
	<g opacity={o.etc}>
		<Label x={B6F.x} y={196} text="Cytochrome b₆f" weight={600} />
		<Label
			x={B6F.x}
			y={212}
			text="pumps H⁺ into the lumen"
			size={lerp(11, 12.5, lit(o.etc))}
			muted
		/>
		<Label x={323} y={250} text="2 H⁺ from stroma" anchor="start" size={11} color={protonInk} />
		<Label x={403} y={386} text="2 H⁺ into lumen" anchor="start" size={11} color={protonInk} />
		<Label x={332} y={348} text="PQ pool" size={11} muted />
		<!-- at the right end of the plastocyanin track, clear of the '2 H⁺ into lumen' label -->
		<Label x={536} y={372} text="PC" anchor="start" size={11} muted />
	</g>
	<g opacity={o.psi}>
		<Label x={PSI.x} y={196} text="Photosystem I" weight={600} />
		<Label x={PSI.x} y={212} text="re-excites electrons" size={lerp(11, 12.5, lit(o.psi))} muted />
		<Label x={592} y={247} text="Fd" anchor="end" size={11} muted />
		<Label x={FNR.x} y={262} text="FNR" size={11} muted />
		<Label x={646} y={348} text="antenna" size={11} muted />
	</g>
	<g opacity={o.atp}>
		<Label x={940} y={150} text="ATP synthase" anchor="end" weight={600} />
		<Label
			x={940}
			y={166}
			text="proton turbine"
			anchor="end"
			size={lerp(11, 12.5, lit(o.atp))}
			muted
		/>
		<Label x={840} y={348} text="CF₀ rotor" anchor="start" size={11} muted />
	</g>

	<!-- callouts -->
	<Label
		x={270}
		y={150}
		text="excitation hops pigment → pigment → P680"
		pill
		opacity={o.cAntenna}
	/>
	<Label x={330} y={412} text="2 H₂O → O₂ + 4 H⁺ + 4 e⁻" pill weight={600} opacity={o.cWater} />
	<Label
		x={440}
		y={444}
		text="electrons downhill, protons pumped into the lumen"
		pill
		opacity={o.cEtc}
	/>
	<Label x={620} y={40} text="NADP⁺ + H⁺ + 2 e⁻ → NADPH" pill weight={600} opacity={o.cPsi} />
	<Label x={800} y={452} text="~14 H⁺ per turn → 3 ATP" pill weight={600} opacity={o.cAtp} />
</g>
