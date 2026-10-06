<script lang="ts">
	/**
	 * Steps 1–3: the leaf, its cross-section and a single chloroplast, drawn as
	 * three nested drawings so that the camera can zoom continuously from one
	 * to the next.
	 *
	 *   leaf (1×)  ⊃  cross-section (placed at 1/12)  ⊃  chloroplast (placed at 1/16)
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Photon,
		Label,
		colors,
		cycle,
		along,
		smooth,
		smoothstep,
		hash,
		lerp,
		clamp
	} from '#lib/draw/index.ts';

	let { step, t, reduced }: StageProps = $props();
	const view = $derived(String(step.hints?.view ?? 'leaf'));

	// ---- camera ---------------------------------------------------------------
	const SECTION = { x: 440, y: 292, k: 12 }; // where the cross-section sits on the leaf
	const CHLORO = { x: 384, y: 236, k: 16 }; // where the chloroplast sits in the section
	const views: Record<string, { x: number; y: number; k: number }> = {
		leaf: { x: 480, y: 300, k: 1 },
		section: { x: SECTION.x, y: SECTION.y, k: SECTION.k },
		chloroplast: {
			x: SECTION.x + (CHLORO.x - 480) / SECTION.k,
			y: SECTION.y + (CHLORO.y - 300) / SECTION.k,
			k: SECTION.k * CHLORO.k
		}
	};
	const cam = new Tween({ x: 480, y: 300, logk: 0 }, { duration: 1600, easing: cubicInOut });
	$effect(() => {
		const v = views[view] ?? views.leaf;
		const duration = reduced ? 0 : 1600;
		// untrack: the tween's own state must not re-trigger this effect every frame
		untrack(() => cam.set({ x: v.x, y: v.y, logk: Math.log(v.k) }, { duration }));
	});
	const k = $derived(Math.exp(cam.current.logk));
	const camTransform = $derived(
		`translate(480 300) scale(${k}) translate(${-cam.current.x} ${-cam.current.y})`
	);
	const leafOpacity = $derived(1 - smoothstep(18, 70, k));
	const sectionOpacity = $derived(smoothstep(1.4, 5, k));
	const chloroOpacity = $derived(smoothstep(30, 90, k));
	/** 1 when the camera has settled on the current view, 0 while zooming. */
	const settled = $derived(
		1 - clamp(Math.abs(cam.current.logk - Math.log((views[view] ?? views.leaf).k)) / 0.35)
	);

	// ---- leaf view -----------------------------------------------------------
	const SUN = { x: 820, y: 105 };
	const photonTargets = [
		{ x: 560, y: 222 },
		{ x: 470, y: 252 },
		{ x: 405, y: 285 },
		{ x: 620, y: 230 },
		{ x: 515, y: 240 },
		{ x: 350, y: 318 }
	];
	const co2Path = smooth([
		{ x: 30, y: 500 },
		{ x: 150, y: 470 },
		{ x: 270, y: 420 },
		{ x: 350, y: 380 },
		{ x: 400, y: 350 }
	]);
	const o2Path = smooth([
		{ x: 520, y: 232 },
		{ x: 600, y: 165 },
		{ x: 700, y: 95 },
		{ x: 790, y: 30 }
	]);
	const stemPath = smooth([
		{ x: 110, y: 610 },
		{ x: 135, y: 520 },
		{ x: 170, y: 430 },
		{ x: 205, y: 362 }
	]);
	const waterPath = stemPath;
	const sugarPath = smooth([
		{ x: 215, y: 372 },
		{ x: 182, y: 440 },
		{ x: 150, y: 530 },
		{ x: 125, y: 610 }
	]);

	// ---- section view --------------------------------------------------------
	const palisade = Array.from({ length: 9 }, (_, i) => ({ x: 60 + i * 95, y: 112, w: 78, h: 216 }));
	const spongy = [
		{ x: 90, y: 372, rx: 38, ry: 30 },
		{ x: 110, y: 452, rx: 30, ry: 26 },
		{ x: 330, y: 372, rx: 40, ry: 30 },
		{ x: 355, y: 455, rx: 32, ry: 28 },
		{ x: 420, y: 395, rx: 28, ry: 24 },
		{ x: 560, y: 372, rx: 42, ry: 30 },
		{ x: 620, y: 450, rx: 32, ry: 26 },
		{ x: 690, y: 385, rx: 36, ry: 30 },
		{ x: 740, y: 455, rx: 28, ry: 24 },
		{ x: 830, y: 378, rx: 40, ry: 30 },
		{ x: 870, y: 455, rx: 30, ry: 26 },
		{ x: 540, y: 465, rx: 26, ry: 22 }
	];
	const VEIN = { x: 225, y: 412 };
	const STOMA = { x: 480, y: 528 };
	const STOMA2 = { x: 780, y: 528 };
	const sectionCo2 = smooth([
		{ x: 480, y: 650 },
		{ x: 480, y: 560 },
		{ x: 478, y: 500 },
		{ x: 465, y: 455 },
		{ x: 445, y: 420 },
		{ x: 430, y: 395 }
	]);
	const sectionO2 = smooth([
		{ x: 560, y: 405 },
		{ x: 520, y: 470 },
		{ x: 492, y: 515 },
		{ x: 484, y: 560 },
		{ x: 486, y: 650 }
	]);
	const sectionWater = [
		smooth([
			{ x: 250, y: 392 },
			{ x: 300, y: 370 },
			{ x: 335, y: 330 },
			{ x: 345, y: 300 }
		]),
		smooth([
			{ x: 262, y: 420 },
			{ x: 300, y: 400 },
			{ x: 330, y: 380 }
		])
	];
	const sectionPhotons = [
		{ x: 140, end: 200 },
		{ x: 300, end: 160 },
		{ x: 520, end: 230 },
		{ x: 690, end: 180 },
		{ x: 860, end: 210 }
	];

	// ---- chloroplast view ----------------------------------------------------
	const grana = [
		{ x: 225, y: 300, n: 6 },
		{ x: 352, y: 220, n: 5 },
		{ x: 485, y: 340, n: 7 },
		{ x: 618, y: 225, n: 5 },
		{ x: 752, y: 320, n: 6 },
		{ x: 430, y: 470, n: 3 }
	];
	const DISC = { w: 108, h: 15, gap: 4 };
	const STARCH = { x: 690, y: 445 };
	const chloroPhotons = [
		{ from: { x: 120, y: 40 }, to: { x: 330, y: 190 } },
		{ from: { x: 230, y: 20 }, to: { x: 480, y: 290 } },
		{ from: { x: 420, y: 10 }, to: { x: 600, y: 200 } },
		{ from: { x: 600, y: 20 }, to: { x: 740, y: 275 } }
	];
	const carrierOut = smooth([
		{ x: 540, y: 300 },
		{ x: 590, y: 360 },
		{ x: 610, y: 420 }
	]);
	const carrierBack = smooth([
		{ x: 590, y: 440 },
		{ x: 545, y: 400 },
		{ x: 515, y: 372 }
	]);
	const chloroCo2 = smooth([
		{ x: -20, y: 440 },
		{ x: 120, y: 430 },
		{ x: 300, y: 420 },
		{ x: 460, y: 425 },
		{ x: 560, y: 440 }
	]);
	const chloroSugar = smooth([
		{ x: 640, y: 450 },
		{ x: 760, y: 470 },
		{ x: 880, y: 440 },
		{ x: 990, y: 420 }
	]);
	const chloroO2 = smooth([
		{ x: 352, y: 170 },
		{ x: 380, y: 110 },
		{ x: 420, y: 50 },
		{ x: 470, y: -20 }
	]);

	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
</script>

<g class="leaf-scene">
	<g transform={camTransform}>
		<!-- ================= 1. whole leaf ================= -->
		<g opacity={leafOpacity}>
			<!-- sun -->
			<g transform="translate({SUN.x} {SUN.y})">
				<circle r="62" fill={colors.photon} opacity="0.12" />
				<circle r="40" fill={colors.photon} opacity="0.9" />
				{#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
					{@const a = (i / 12) * Math.PI * 2 + t * 0.15}
					<line
						x1={52 * Math.cos(a)}
						y1={52 * Math.sin(a)}
						x2={(60 + 4 * Math.sin(t * 2 + i)) * Math.cos(a)}
						y2={(60 + 4 * Math.sin(t * 2 + i)) * Math.sin(a)}
						stroke={colors.photon}
						stroke-width="3"
						stroke-linecap="round"
						opacity="0.8"
					/>
				{/each}
			</g>

			<!-- stem -->
			<path
				d="M118 610 C 150 520, 175 430, 212 362"
				fill="none"
				stroke="var(--leaf-dark)"
				stroke-width="14"
				stroke-linecap="round"
			/>
			<path
				d="M118 610 C 150 520, 175 430, 212 362"
				fill="none"
				stroke="var(--leaf)"
				stroke-width="8"
				stroke-linecap="round"
			/>

			<!-- blade -->
			<path
				d="M200 362 C 280 222, 520 150, 692 198 C 575 332, 365 428, 200 362 Z"
				fill="var(--leaf)"
				stroke="var(--leaf-dark)"
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M200 362 C 280 222, 520 150, 692 198 C 640 250, 520 290, 420 310 C 330 330, 260 350, 200 362 Z"
				fill="#fff"
				opacity="0.07"
			/>
			<path
				d="M200 362 C 380 318, 545 262, 692 198"
				fill="none"
				stroke="var(--leaf-vein)"
				stroke-width="3.5"
				stroke-linecap="round"
			/>
			<g
				fill="none"
				stroke="var(--leaf-vein)"
				stroke-width="1.8"
				stroke-linecap="round"
				opacity="0.9"
			>
				<path d="M300 338 c 20 -40, 45 -75, 90 -112" />
				<path d="M380 312 c 25 -40, 60 -70, 110 -96" />
				<path d="M470 284 c 30 -35, 70 -60, 120 -74" />
				<path d="M560 254 c 30 -22, 60 -38, 95 -45" />
				<path d="M300 338 c 40 10, 85 12, 130 2" />
				<path d="M380 312 c 50 15, 100 15, 150 0" />
				<path d="M470 284 c 60 22, 110 20, 150 2" />
			</g>

			<!-- where the cross-section is taken -->
			<g opacity={0.6 + 0.4 * Math.sin(t * 2.5)}>
				<rect
					x={SECTION.x - 40}
					y={SECTION.y - 25}
					width="80"
					height="50"
					rx="4"
					fill="none"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
					stroke-dasharray="4 3"
				/>
			</g>

			<!-- particles: photons -->
			{#each photonTargets as target, i (i)}
				{@const u = cycle(t, 2.6, i / photonTargets.length)}
				{@const x = lerp(SUN.x, target.x, u)}
				{@const y = lerp(SUN.y, target.y, u)}
				{@const angle = (Math.atan2(target.y - SUN.y, target.x - SUN.x) * 180) / Math.PI}
				<Photon
					{x}
					{y}
					{angle}
					opacity={smoothstep(0.08, 0.2, u) * (1 - smoothstep(0.88, 1, u))}
					phase={t * 3}
				/>
			{/each}
			<!-- CO2 in -->
			{#each [0, 1, 2, 3] as i (i)}
				{@const u = cycle(t, 7, i / 4)}
				{@const p = along(co2Path, u)}
				<Molecule
					kind="CO2"
					x={p.x}
					y={p.y + 12 * Math.sin(t * 1.3 + i)}
					rotate={hash(i) * 40 - 20}
					opacity={fadeEnds(u)}
					scale={0.9}
				/>
			{/each}
			<!-- O2 out -->
			{#each [0, 1, 2] as i (i)}
				{@const u = cycle(t, 6, i / 3 + 0.2)}
				{@const p = along(o2Path, u)}
				<Molecule
					kind="O2"
					x={p.x + 10 * Math.sin(t * 1.1 + i * 2)}
					y={p.y}
					opacity={fadeEnds(u)}
					scale={0.9}
				/>
			{/each}
			<!-- water up the stem -->
			{#each [0, 1, 2, 3] as i (i)}
				{@const u = cycle(t, 5.5, i / 4)}
				{@const p = along(waterPath, u)}
				<Molecule kind="H2O" x={p.x - 16} y={p.y} opacity={fadeEnds(u)} scale={0.8} />
			{/each}
			<!-- sugar down the stem -->
			{#each [0, 1] as i (i)}
				{@const u = cycle(t, 8, i / 2 + 0.3)}
				{@const p = along(sugarPath, u)}
				<Molecule
					kind="sugar"
					carbons={6}
					compact
					x={p.x + 24}
					y={p.y}
					opacity={fadeEnds(u)}
					scale={0.75}
				/>
			{/each}

			<!-- equation -->
			<g transform="translate(0 532)">
				<Molecule kind="CO2" x={262} y={0} label="6 CO₂" />
				<Label x={318} y={5} text="+" size={18} muted />
				<Molecule kind="H2O" x={372} y={0} label="6 H₂O" />
				<Label x={428} y={5} text="+" size={18} muted />
				<Photon x={495} y={-2} length={34} phase={t * 3} />
				<Label x={482} y={22} text="light" size={12} />
				<Label x={546} y={6} text="→" size={22} muted />
				<Molecule kind="sugar" carbons={6} compact x={620} y={0} label="C₆H₁₂O₆ (glucose)" />
				<Label x={700} y={5} text="+" size={18} muted />
				<Molecule kind="O2" x={752} y={0} label="6 O₂" />
			</g>
		</g>

		<!-- ================= 2. cross-section (nested) ================= -->
		<g transform="translate({SECTION.x} {SECTION.y}) scale({1 / SECTION.k}) translate(-480 -300)">
			<g opacity={sectionOpacity}>
				<rect x="-200" y="-200" width="1360" height="1000" fill="var(--sky)" />
				<!-- cuticle + upper epidermis -->
				<rect x="-200" y="54" width="1360" height="8" fill="var(--membrane)" opacity="0.7" />
				{#each Array.from({ length: 13 }, (_, i) => i) as i (i)}
					<rect
						x={-40 + i * 85}
						y="62"
						width="82"
						height="46"
						rx="10"
						fill="var(--cell)"
						stroke="var(--stage-line)"
						stroke-width="1.5"
					/>
				{/each}
				<!-- palisade mesophyll -->
				{#each palisade as c, ci (ci)}
					<rect
						x={c.x}
						y={c.y}
						width={c.w}
						height={c.h}
						rx="22"
						fill="var(--cell)"
						stroke="var(--stage-line)"
						stroke-width="1.5"
					/>
					{#each [140, 186, 232, 278] as y, yi (yi)}
						{#if !(ci === 3 && yi === 2)}
							<ellipse
								cx={c.x + 18}
								cy={y + 8 * Math.sin(t * 0.6 + ci + yi)}
								rx="11"
								ry="7"
								fill="var(--leaf)"
								stroke="var(--leaf-dark)"
								stroke-width="1"
							/>
							<ellipse
								cx={c.x + c.w - 18}
								cy={y + 20 + 8 * Math.sin(t * 0.6 + ci * 2 + yi)}
								rx="11"
								ry="7"
								fill="var(--leaf)"
								stroke="var(--leaf-dark)"
								stroke-width="1"
							/>
						{/if}
					{/each}
				{/each}
				<!-- spongy mesophyll -->
				{#each spongy as s, si (si)}
					<ellipse
						cx={s.x}
						cy={s.y}
						rx={s.rx}
						ry={s.ry}
						fill="var(--cell)"
						stroke="var(--stage-line)"
						stroke-width="1.5"
					/>
					{#each [0, 1, 2] as j (j)}
						{@const a = (j / 3) * Math.PI * 2 + si}
						<ellipse
							cx={s.x + (s.rx - 13) * Math.cos(a)}
							cy={s.y + (s.ry - 10) * Math.sin(a)}
							rx="9"
							ry="6"
							fill="var(--leaf)"
							stroke="var(--leaf-dark)"
							stroke-width="1"
						/>
					{/each}
				{/each}
				<!-- vein -->
				<g transform="translate({VEIN.x} {VEIN.y})">
					<circle r="58" fill="var(--cell)" stroke="var(--stage-line)" stroke-width="1.5" />
					<circle
						r="44"
						fill="none"
						stroke="var(--stage-line)"
						stroke-width="1"
						stroke-dasharray="3 3"
					/>
					{#each [[-16, -18], [12, -22], [0, 2], [-20, 8], [22, 4]] as [dx, dy], j (j)}
						<circle cx={dx} cy={dy} r="10" fill="#9ec5e8" stroke="#4a8ac2" stroke-width="1.2" />
					{/each}
					{#each [[-24, 28], [-8, 32], [8, 32], [24, 28]] as [dx, dy], j (j)}
						<circle cx={dx} cy={dy} r="6" fill="#f0c98a" stroke="#c98a2e" stroke-width="1" />
					{/each}
				</g>
				<!-- lower epidermis with stomata -->
				{#each Array.from({ length: 13 }, (_, i) => i) as i (i)}
					{@const x = -40 + i * 85}
					{#if !(x + 41 > STOMA.x - 60 && x + 41 < STOMA.x + 60) && !(x + 41 > STOMA2.x - 60 && x + 41 < STOMA2.x + 60)}
						<rect
							{x}
							y="506"
							width="82"
							height="44"
							rx="10"
							fill="var(--cell)"
							stroke="var(--stage-line)"
							stroke-width="1.5"
						/>
					{/if}
				{/each}
				{#each [STOMA, STOMA2] as s, si (si)}
					{@const open = 9 + 3 * Math.sin(t * 0.8 + si)}
					<path
						d="M{s.x - open - 46} 528 c 0 -24, 46 -30, 46 0 c 0 30, -46 24, -46 0 Z"
						fill="var(--leaf)"
						stroke="var(--leaf-dark)"
						stroke-width="1.5"
					/>
					<path
						d="M{s.x + open + 46} 528 c 0 -24, -46 -30, -46 0 c 0 30, 46 24, 46 0 Z"
						fill="var(--leaf)"
						stroke="var(--leaf-dark)"
						stroke-width="1.5"
					/>
				{/each}
				<rect x="-200" y="551" width="1360" height="6" fill="var(--membrane)" opacity="0.7" />

				<!-- particles -->
				{#each sectionPhotons as p, i (i)}
					{@const u = cycle(t, 2.4, i / sectionPhotons.length)}
					<Photon
						x={p.x}
						y={lerp(-20, p.end, u)}
						angle={90}
						opacity={(1 - smoothstep(0.85, 1, u)) * smoothstep(0, 0.1, u)}
						phase={t * 3}
					/>
				{/each}
				{#each [0, 1, 2] as i (i)}
					{@const u = cycle(t, 6, i / 3)}
					{@const p = along(sectionCo2, u)}
					<Molecule
						kind="CO2"
						x={p.x}
						y={p.y}
						rotate={-60 + 30 * Math.sin(t + i)}
						opacity={fadeEnds(u)}
						scale={0.85}
					/>
				{/each}
				{#each [0, 1] as i (i)}
					{@const u = cycle(t, 6, i / 2 + 0.25)}
					{@const p = along(sectionO2, u)}
					<Molecule kind="O2" x={p.x + 14} y={p.y} opacity={fadeEnds(u)} scale={0.85} />
				{/each}
				{#each sectionWater as path, i (i)}
					{@const u = cycle(t, 4.5, i / 2)}
					{@const p = along(path, u)}
					<Molecule kind="H2O" x={p.x} y={p.y} opacity={fadeEnds(u)} scale={0.8} />
				{/each}
			</g>

			<!-- ================= 3. chloroplast (nested) ================= -->
			<g transform="translate({CHLORO.x} {CHLORO.y}) scale({1 / CHLORO.k}) translate(-480 -300)">
				<g opacity={chloroOpacity}>
					<rect x="-200" y="-200" width="1360" height="1000" fill="var(--cell)" />
					<!-- membranes -->
					<ellipse
						cx="480"
						cy="300"
						rx="428"
						ry="240"
						fill="var(--stage-bg)"
						stroke="var(--protein-edge)"
						stroke-width="3"
					/>
					<ellipse
						cx="480"
						cy="300"
						rx="408"
						ry="221"
						fill="var(--stroma)"
						stroke="var(--protein-edge)"
						stroke-width="3"
					/>
					<!-- stroma lamellae connecting grana -->
					<g
						fill="none"
						stroke="var(--membrane)"
						stroke-width="7"
						stroke-linecap="round"
						opacity="0.9"
					>
						<path d="M280 285 C 310 270, 320 240, 300 225" />
						<path d="M405 215 C 440 230, 440 310, 432 330" />
						<path d="M540 330 C 570 300, 575 240, 565 225" />
						<path d="M672 232 C 700 250, 700 300, 700 318" />
						<path d="M280 318 C 340 420, 360 450, 378 468" />
						<path d="M485 466 C 560 440, 640 380, 700 345" />
					</g>
					<!-- grana: stacks of thylakoid discs -->
					{#each grana as g, gi (gi)}
						{#each Array.from({ length: g.n }, (_, i) => i) as i (i)}
							{@const y = g.y - ((g.n - 1) * (DISC.h + DISC.gap)) / 2 + i * (DISC.h + DISC.gap)}
							<rect
								x={g.x - DISC.w / 2}
								y={y - DISC.h / 2}
								width={DISC.w}
								height={DISC.h}
								rx={DISC.h / 2}
								fill="var(--membrane)"
								stroke="var(--membrane-edge)"
								stroke-width="1"
							/>
							<rect
								x={g.x - DISC.w / 2 + 6}
								y={y - 2.5}
								width={DISC.w - 12}
								height="5"
								rx="2.5"
								fill="var(--lumen)"
							/>
						{/each}
					{/each}
					<!-- starch grain and ribosomes -->
					<ellipse
						cx={STARCH.x}
						cy={STARCH.y}
						rx="42"
						ry="24"
						fill="var(--surface)"
						stroke="var(--stage-line)"
						stroke-width="1.5"
					/>
					{#each Array.from({ length: 40 }, (_, i) => i) as i (i)}
						{@const a = hash(i, 3) * Math.PI * 2}
						{@const r = Math.sqrt(hash(i, 4))}
						<circle
							cx={480 + 380 * r * Math.cos(a)}
							cy={300 + 195 * r * Math.sin(a)}
							r="2"
							fill="var(--stage-ink-muted)"
							opacity="0.35"
						/>
					{/each}

					<!-- particles -->
					{#each chloroPhotons as p, i (i)}
						{@const u = cycle(t, 2.2, i / chloroPhotons.length)}
						{@const angle = (Math.atan2(p.to.y - p.from.y, p.to.x - p.from.x) * 180) / Math.PI}
						<Photon
							x={lerp(p.from.x, p.to.x, u)}
							y={lerp(p.from.y, p.to.y, u)}
							{angle}
							opacity={smoothstep(0, 0.1, u) * (1 - smoothstep(0.86, 1, u))}
							phase={t * 3}
						/>
					{/each}
					{#each [0, 1] as i (i)}
						{@const u = cycle(t, 4.5, i / 2)}
						{@const p = along(chloroO2, u)}
						<Molecule
							kind="O2"
							x={p.x + 10 * Math.sin(t + i)}
							y={p.y}
							opacity={fadeEnds(u)}
							scale={0.85}
						/>
					{/each}
					{#each [0, 1, 2] as i (i)}
						{@const u = cycle(t, 3.6, i / 3)}
						{@const p = along(carrierOut, u)}
						<Molecule
							kind={i % 2 ? 'NADPH' : 'ATP'}
							x={p.x + i * 10}
							y={p.y}
							opacity={fadeEnds(u)}
							scale={0.9}
						/>
					{/each}
					{#each [0, 1] as i (i)}
						{@const u = cycle(t, 3.6, i / 2 + 0.5)}
						{@const p = along(carrierBack, u)}
						<Molecule
							kind={i % 2 ? 'NADP+' : 'ADP'}
							x={p.x - 50 + i * 10}
							y={p.y + 30}
							opacity={fadeEnds(u)}
							scale={0.9}
						/>
					{/each}
					{#each [0, 1] as i (i)}
						{@const u = cycle(t, 7, i / 2)}
						{@const p = along(chloroCo2, u)}
						<Molecule
							kind="CO2"
							x={p.x}
							y={p.y + 8 * Math.sin(t * 1.5 + i)}
							opacity={fadeEnds(u)}
							scale={0.85}
						/>
					{/each}
					{#each [0] as i (i)}
						{@const u = cycle(t, 7, 0.4)}
						{@const p = along(chloroSugar, u)}
						<Molecule
							kind="sugar"
							carbons={3}
							phosphates={1}
							x={p.x}
							y={p.y}
							opacity={fadeEnds(u)}
							scale={0.85}
						/>
					{/each}
				</g>
			</g>
		</g>
	</g>

	<!-- ================= labels (screen space) ================= -->
	{#if view === 'leaf'}
		<g opacity={settled}>
			<Label x={SUN.x} y={SUN.y + 72} text="sunlight" muted />
			<Label x={110} y={470} text="CO₂ from the air" anchor="start" />
			<Label x={720} y={86} text="O₂ to the air" anchor="start" />
			<Label x={30} y={566} text="water from the roots" anchor="start" muted size={12} />
			<Label x={212} y={596} text="sugar to the rest of the plant" anchor="start" muted size={12} />
			<Label x={SECTION.x} y={SECTION.y + 44} text="we'll zoom in here" size={12} muted />
		</g>
	{:else if view === 'section'}
		<g opacity={settled}>
			<Label x={14} y={48} text="light" anchor="start" muted />
			<Label
				x={14}
				y={92}
				text="upper epidermis (with waxy cuticle)"
				anchor="start"
				size={12}
				pill
			/>
			<Label x={14} y={190} text="palisade mesophyll" anchor="start" size={12} pill />
			<Label
				x={14}
				y={210}
				text="tall cells packed with chloroplasts"
				anchor="start"
				size={11}
				muted
			/>
			<Label x={945} y={345} text="spongy mesophyll" anchor="end" size={12} pill />
			<Label x={945} y={365} text="loose cells, air spaces" anchor="end" size={11} muted />
			<Label
				x={VEIN.x}
				y={VEIN.y + 80}
				text="vein: xylem (water) & phloem (sugar)"
				size={12}
				pill
			/>
			<Label x={14} y={536} text="lower epidermis" anchor="start" size={12} pill />
			<Label x={STOMA.x} y={586} text="stoma, flanked by two guard cells" size={12} pill />
			<Label x={STOMA.x - 70} y={470} text="CO₂ in" anchor="end" size={12} />
			<Label x={STOMA.x + 70} y={470} text="O₂ out" anchor="start" size={12} />
			<Label x={345} y={95} text="chloroplasts" size={12} />
			<line x1="345" y1="100" x2="345" y2="128" stroke="var(--stage-ink-muted)" stroke-width="1" />
		</g>
	{:else}
		<g opacity={settled}>
			<Label x={100} y={60} text="outer membrane" anchor="start" size={12} pill />
			<line x1="170" y1="68" x2="200" y2="110" stroke="var(--stage-ink-muted)" stroke-width="1" />
			<Label x={110} y={118} text="inner membrane" anchor="start" size={12} pill />
			<line x1="200" y1="124" x2="232" y2="150" stroke="var(--stage-ink-muted)" stroke-width="1" />
			<Label x={880} y={150} text="stroma" anchor="end" size={12} pill />
			<Label x={880} y={170} text="fluid: Calvin cycle runs here" anchor="end" size={11} muted />
			<Label x={352} y={140} text="granum" size={12} pill />
			<Label x={352} y={158} text="a stack of thylakoids" size={11} muted />
			<Label x={862} y={408} text="thylakoid" size={12} pill />
			<line x1="830" y1="396" x2="796" y2="352" stroke="var(--stage-ink-muted)" stroke-width="1" />
			<Label x={862} y={428} text="membrane: light reactions" size={11} muted />
			<Label x={862} y={444} text="inside: the lumen" size={11} muted />
			<Label x={STARCH.x} y={STARCH.y + 40} text="starch grain" size={12} muted />
			<Label x={430} y={525} text="ATP & NADPH out, ADP & NADP⁺ back" size={12} muted />
			<Label x={60} y={420} text="CO₂" anchor="start" size={12} />
			<Label x={900} y={410} text="G3P (sugar)" anchor="end" size={12} />
		</g>
	{/if}
</g>
