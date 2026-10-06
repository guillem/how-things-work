<script lang="ts">
	/**
	 * Steps 15–16: the whole system at a glance (light reactions and Calvin
	 * cycle coupled by the ATP/NADPH shuttles, driven by the light slider) and
	 * the planetary big picture (a stylised Earth with the headline numbers).
	 * The two layouts cross-fade when the step's `phase` hint changes.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Photon,
		Flow,
		Label,
		colors,
		cycle,
		along,
		smooth,
		smoothstep,
		pathFrom,
		polar,
		hash,
		lerp,
		wave,
		TAU
	} from '#lib/draw/index.ts';
	import type { Point } from '#lib/draw/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	// ---- phase cross-fade -------------------------------------------------------
	const phase = $derived(String(step.hints?.phase ?? 'system'));
	const mix = new Tween(untrack(() => phase) === 'planet' ? 1 : 0, {
		duration: 800,
		easing: cubicInOut
	});
	$effect(() => {
		const target = phase === 'planet' ? 1 : 0;
		const duration = reduced ? 0 : 800;
		untrack(() => mix.set(target, { duration }));
	});
	const planetMix = $derived(mix.current);

	// ---- light → carrier level ---------------------------------------------------
	const lightParam = $derived(Number(params.light ?? 70) / 100);
	const carrier = new Tween(0.7, { duration: 1200, easing: cubicInOut });
	$effect(() => {
		const target = lightParam;
		const duration = reduced ? 0 : 1200;
		untrack(() => carrier.set(target, { duration }));
	});
	const level = $derived(carrier.current);
	/** 0 when the lanes are empty (no light), 1 when the shuttles are running. */
	const running = $derived(smoothstep(0.02, 0.22, level));

	/**
	 * "Flow time": the integral of the carrier level over `t`. Everything that
	 * the carriers drive (lane particles, ring rotation, O₂ and sugar output)
	 * moves along this clock, so it slows down smoothly and stops at light 0
	 * without any jump when the slider changes.
	 */
	let flowAcc = 0;
	let flowLastT = -1;
	const flow = $derived.by(() => {
		const dt = t - flowLastT;
		if (flowLastT >= 0 && dt > 0 && dt < 0.5) flowAcc += dt * level;
		flowLastT = t;
		return flowAcc;
	});

	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));

	// ============================================================ system layout
	const LEFT = { x: 60, y: 120, w: 370, h: 350 };
	const RIGHT = { x: 530, y: 120, w: 370, h: 350 };
	const SUN = { x: 392, y: 182 };
	const PSII = { x: 150, y: 298 };
	const B6F = { x: 205, y: 299 };
	const PSI = { x: 278, y: 298 };
	const SYNTH = { x: 351, y: 298 };
	const RING = { x: 715, y: 310, r: 78 };
	const RUBISCO = { x: 793, y: 310 };

	const photonPaths = [
		{ to: { x: PSII.x + 4, y: PSII.y - 18 } },
		{ to: { x: PSI.x + 4, y: PSI.y - 18 } }
	].map((p) => ({
		...p,
		angle: (Math.atan2(p.to.y - SUN.y, p.to.x - SUN.x) * 180) / Math.PI
	}));
	const photonSlots = [0, 1, 2];

	const waterPath = smooth([
		{ x: 38, y: 340 },
		{ x: 76, y: 331 },
		{ x: 110, y: 320 },
		{ x: 140, y: 312 }
	]);
	const o2Path = smooth([
		{ x: 140, y: 276 },
		{ x: 126, y: 235 },
		{ x: 124, y: 185 },
		{ x: 130, y: 140 },
		{ x: 140, y: 96 }
	]);
	const upperLane = smooth([
		{ x: 300, y: 256 },
		{ x: 365, y: 238 },
		{ x: 430, y: 226 },
		{ x: 520, y: 222 },
		{ x: 600, y: 228 },
		{ x: 652, y: 252 }
	]);
	const lowerLane = smooth([
		{ x: 652, y: 358 },
		{ x: 600, y: 376 },
		{ x: 520, y: 381 },
		{ x: 450, y: 376 },
		{ x: 406, y: 348 }
	]);
	const co2Path = smooth([
		{ x: 936, y: 282 },
		{ x: 880, y: 284 },
		{ x: 840, y: 290 },
		{ x: 816, y: 298 }
	]);
	const sugarPath = smooth([
		{ x: RING.x, y: RING.y + RING.r + 6 },
		{ x: RING.x, y: 440 },
		{ x: RING.x, y: 496 }
	]);
	const upperPills = ['ATP', 'NADPH', 'ATP', 'ATP', 'NADPH'] as const;
	const lowerPills = ['ADP', 'Pi', 'NADP+', 'ADP', 'Pi', 'NADP+'] as const;

	const ringAngle = $derived(flow * 45);
	const ringArc = (a0: number, a1: number) => {
		const p0 = polar(RING.x, RING.y, RING.r, a0);
		const p1 = polar(RING.x, RING.y, RING.r, a1);
		return `M${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A${RING.r} ${RING.r} 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
	};
	const ringArcs = [0, 1, 2].map((i) => ringArc((i / 3) * TAU, (i / 3) * TAU + 1.55));

	// ============================================================ planet layout
	const GLOBE = { x: 300, y: 310, r: 150 };
	const PSUN = { x: 82, y: 82 };
	/** Continents as wobbly ellipses (centre, radii, seed). */
	const continents = [
		{ cx: 226, cy: 238, rx: 46, ry: 50, seed: 1 },
		{ cx: 268, cy: 368, rx: 30, ry: 46, seed: 2 },
		{ cx: 358, cy: 224, rx: 72, ry: 42, seed: 3 },
		{ cx: 342, cy: 332, rx: 38, ry: 52, seed: 4 },
		{ cx: 398, cy: 402, rx: 24, ry: 17, seed: 5 }
	];
	function blobPath(cx: number, cy: number, rx: number, ry: number, seed: number) {
		const n = 10;
		const pts: Point[] = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * TAU;
			const k = 1 + 0.22 * (hash(i, seed) - 0.5);
			pts.push({ x: cx + rx * k * Math.cos(a), y: cy + ry * k * Math.sin(a) });
		}
		const ext = [pts[n - 1], ...pts, pts[0], pts[1]];
		const s = 6;
		const sm = smooth(ext, s).slice(s, (n + 1) * s + 1);
		return pathFrom(sm) + ' Z';
	}
	const continentPaths = continents.map((c) => blobPath(c.cx, c.cy, c.rx, c.ry, c.seed));
	const plankton = Array.from({ length: 70 }, (_, i) => {
		const a = hash(i, 11) * TAU;
		const r = Math.sqrt(hash(i, 12)) * 142;
		return { x: GLOBE.x + r * Math.cos(a), y: GLOBE.y + r * Math.sin(a), i };
	}).filter(
		(p) =>
			!continents.some(
				(c) => ((p.x - c.cx) / (c.rx * 1.2)) ** 2 + ((p.y - c.cy) / (c.ry * 1.2)) ** 2 < 1
			) &&
			p.y > GLOBE.y - 128 &&
			p.y < GLOBE.y + 130
	);
	const planetPhotons = [-146, -133, -120, -107].map((deg) => {
		const to = polar(GLOBE.x, GLOBE.y, GLOBE.r + 8, (deg / 180) * Math.PI);
		return { to, angle: (Math.atan2(to.y - PSUN.y, to.x - PSUN.x) * 180) / Math.PI };
	});
	const co2In = [0, 1, 2, 3, 4, 5];
	const o2Out = [0, 1, 2, 3, 4];
	const tiles = [
		{
			x: 520,
			y: 128,
			n: '~105 Gt C',
			a: 'of carbon fixed every year',
			b: 'by all photosynthesis',
			c: colors.sugar
		},
		{
			x: 735,
			y: 128,
			n: '~½',
			a: 'of it happens at sea:',
			b: 'algae and cyanobacteria',
			c: '#3b7dd8'
		},
		{
			x: 520,
			y: 298,
			n: '21 % O₂',
			a: 'in the atmosphere —',
			b: 'all of it from photosynthesis',
			c: colors.oxygen
		},
		{
			x: 735,
			y: 298,
			n: '1–2 %',
			a: 'of sunlight energy ends up',
			b: 'as biomass in a crop field',
			c: '#d97706'
		}
	];
	const TILE = { w: 200, h: 150 };
	/** Timeline: billions of years ago → x. */
	const tx = (bya: number) => 880 - (bya / 3) * 750;
	const TL_Y = 530;
	const o2Curve = pathFrom([
		{ x: tx(3), y: TL_Y },
		{ x: tx(2.5), y: TL_Y - 1 },
		{ x: tx(2.4), y: TL_Y - 9 },
		{ x: tx(2.2), y: TL_Y - 10 },
		{ x: tx(1.0), y: TL_Y - 11 },
		{ x: tx(0.75), y: TL_Y - 14 },
		{ x: tx(0.55), y: TL_Y - 26 },
		{ x: tx(0.3), y: TL_Y - 34 },
		{ x: tx(0), y: TL_Y - 33 }
	]);
</script>

<g class="summary-scene">
	<clipPath id="summary-globe-clip">
		<circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} />
	</clipPath>
	<radialGradient id="summary-globe-shade" cx="36%" cy="30%" r="78%">
		<stop offset="0" stop-color="#ffffff" stop-opacity="0.28" />
		<stop offset="0.55" stop-color="#ffffff" stop-opacity="0" />
		<stop offset="1" stop-color="#061a3a" stop-opacity="0.42" />
	</radialGradient>

	<!-- ============================================================ system -->
	{#if planetMix < 0.995}
		<g opacity={1 - planetMix}>
			<!-- compartments -->
			<rect
				x={LEFT.x}
				y={LEFT.y}
				width={LEFT.w}
				height={LEFT.h}
				rx="18"
				fill="var(--stroma)"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			<rect
				x={RIGHT.x}
				y={RIGHT.y}
				width={RIGHT.w}
				height={RIGHT.h}
				rx="18"
				fill="var(--stroma)"
				stroke="var(--stage-line)"
				stroke-width="1.5"
			/>
			<Label x={245} y={150} text="Light reactions" size={14} weight={600} />
			<Label x={245} y={168} text="thylakoid membrane" size={11} muted />
			<Label x={715} y={150} text="Calvin cycle" size={14} weight={600} />
			<Label x={715} y={168} text="stroma" size={11} muted />

			<!-- ---- light reactions ---- -->
			<!-- sun -->
			<g transform="translate({SUN.x} {SUN.y})" opacity={0.3 + 0.7 * level}>
				<circle r="22" fill={colors.photon} opacity="0.14" />
				<circle r="11" fill={colors.photon} />
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
					{@const a = (i / 8) * TAU + t * 0.2}
					<line
						x1={15 * Math.cos(a)}
						y1={15 * Math.sin(a)}
						x2={(19 + 1.5 * Math.sin(t * 2 + i)) * Math.cos(a)}
						y2={(19 + 1.5 * Math.sin(t * 2 + i)) * Math.sin(a)}
						stroke={colors.photon}
						stroke-width="2"
						stroke-linecap="round"
					/>
				{/each}
			</g>
			<!-- thylakoid disc: membrane around the lumen -->
			<rect
				x="85"
				y="296"
				width="310"
				height="56"
				rx="28"
				fill="var(--membrane)"
				stroke="var(--membrane-edge)"
				stroke-width="1"
			/>
			<rect x="96" y="307" width="288" height="34" rx="17" fill="var(--lumen)" />
			<Label x={240} y={329} text="lumen" size={10} muted />
			<Label x={412} y={262} text="stroma" size={10} muted anchor="end" />
			<!-- complexes -->
			<rect
				x={PSII.x - 17}
				y={PSII.y - 18}
				width="34"
				height="36"
				rx="8"
				fill={colors.psii}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<rect
				x={B6F.x - 13}
				y={B6F.y - 15}
				width="26"
				height="30"
				rx="7"
				fill={colors.cytb6f}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<rect
				x={PSI.x - 17}
				y={PSI.y - 18}
				width="34"
				height="36"
				rx="8"
				fill={colors.psi}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<rect
				x={SYNTH.x - 6}
				y={SYNTH.y - 8}
				width="12"
				height="28"
				rx="4"
				fill={colors.atpSynthase}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<g transform="translate({SYNTH.x} {SYNTH.y - 26}) rotate({flow * 240})">
				<circle r="12" fill={colors.atpSynthase} stroke="var(--protein-edge)" stroke-width="1" />
				<line
					x1="-7"
					y1="0"
					x2="7"
					y2="0"
					stroke="var(--stage-bg)"
					stroke-width="2"
					opacity="0.7"
				/>
				<line
					x1="0"
					y1="-7"
					x2="0"
					y2="7"
					stroke="var(--stage-bg)"
					stroke-width="2"
					opacity="0.7"
				/>
			</g>
			<Label x={PSII.x} y={370} text="PSII" size={10} muted />
			<Label x={B6F.x} y={370} text="cyt b₆f" size={10} muted />
			<Label x={PSI.x} y={370} text="PSI" size={10} muted />
			<Label x={SYNTH.x} y={370} text="ATP synthase" size={10} muted />

			<!-- photons from the sun to PSII and PSI -->
			{#each photonPaths as p, pi (pi)}
				{#each photonSlots as k (k)}
					{@const u = cycle(t, 2.4, k / 3 + pi * 0.17)}
					{@const vis = smoothstep(k / 3 + 0.02, (k + 0.8) / 3, level)}
					<Photon
						x={lerp(SUN.x, p.to.x, u)}
						y={lerp(SUN.y, p.to.y, u)}
						angle={p.angle}
						length={30}
						opacity={vis * smoothstep(0.1, 0.22, u) * (1 - smoothstep(0.86, 1, u))}
						phase={t * 3}
					/>
				{/each}
			{/each}
			<!-- water in, oxygen out -->
			{#each [0, 1, 2] as i (i)}
				{@const u = cycle(flow, 4, i / 3)}
				{@const p = along(waterPath, u)}
				<Molecule
					kind="H2O"
					x={p.x}
					y={p.y + 3 * Math.sin(t * 2 + i)}
					scale={0.8}
					opacity={fadeEnds(u) * running}
				/>
			{/each}
			<Label x={32} y={362} text="H₂O" size={11} muted anchor="start" />
			{#each [0, 1] as i (i)}
				{@const u = cycle(flow, 4.5, i / 2 + 0.3)}
				{@const p = along(o2Path, u)}
				<Molecule
					kind="O2"
					x={p.x + 4 * Math.sin(t * 1.5 + i * 2)}
					y={p.y}
					scale={0.85}
					opacity={fadeEnds(u) * running}
				/>
			{/each}
			<Label x={158} y={108} text="O₂" size={12} anchor="start" opacity={0.4 + 0.6 * running} />

			<!-- ---- shuttles between the two machines ---- -->
			<Flow
				d={pathFrom(upperLane)}
				color="var(--stage-ink-muted)"
				width={2}
				arrow
				dash={6}
				t={flow}
				speed={60}
				opacity={0.25 + 0.35 * running}
			/>
			<Flow
				d={pathFrom(lowerLane)}
				color="var(--stage-ink-muted)"
				width={2}
				arrow
				dash={6}
				t={flow}
				speed={60}
				opacity={0.25 + 0.35 * running}
			/>
			{#each upperPills as kind, i (i)}
				{@const u = cycle(flow, 5, i / upperPills.length)}
				{@const p = along(upperLane, u)}
				<Molecule {kind} x={p.x} y={p.y} scale={0.85} opacity={fadeEnds(u) * running} />
			{/each}
			{#each lowerPills as kind, i (i)}
				{@const u = cycle(flow, 6, i / lowerPills.length)}
				{@const p = along(lowerLane, u)}
				<Molecule {kind} x={p.x} y={p.y} scale={0.85} opacity={fadeEnds(u) * running} />
			{/each}
			<!-- gauges -->
			{#each [{ x: 455, c: colors.atp, n: 'ATP' }, { x: 505, c: colors.nadph, n: 'NADPH' }] as g (g.n)}
				<rect
					x={g.x - 7}
					y="262"
					width="14"
					height="72"
					rx="4"
					fill="var(--stage-grid)"
					stroke="var(--stage-line)"
					stroke-width="1"
				/>
				<rect
					x={g.x - 7}
					y={334 - 72 * level}
					width="14"
					height={72 * level}
					rx="4"
					fill={g.c}
					opacity="0.9"
				/>
				<Label x={g.x} y={350} text={g.n} size={9} muted />
			{/each}

			<!-- ---- Calvin cycle ---- -->
			<circle
				cx={RING.x}
				cy={RING.y}
				r={RING.r}
				fill="none"
				stroke="var(--stage-line)"
				stroke-width="6"
				opacity="0.7"
			/>
			<g transform="rotate({ringAngle} {RING.x} {RING.y})" opacity={0.35 + 0.65 * running}>
				{#each ringArcs as d, i (i)}
					<path
						{d}
						fill="none"
						stroke={colors.sugar}
						stroke-width="3"
						stroke-linecap="round"
						marker-end="url(#arrowhead)"
					/>
				{/each}
			</g>
			<Label x={RING.x} y={294} text="fix · reduce" size={10} muted />
			<Label x={RING.x} y={308} text="regenerate" size={10} muted />
			<Label x={RING.x} y={329} text="9 ATP + 6 NADPH" size={10} />
			<Label x={RING.x} y={343} text="per G3P" size={10} muted />
			<ellipse
				cx={RUBISCO.x}
				cy={RUBISCO.y}
				rx="21"
				ry="15"
				fill={colors.rubisco}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<Label x={RUBISCO.x + 26} y={RUBISCO.y + 20} text="RuBisCO" size={10} muted anchor="start" />
			{#each [0, 1] as i (i)}
				{@const u = cycle(flow, 5, i / 2)}
				{@const p = along(co2Path, u)}
				<Molecule
					kind="CO2"
					x={p.x}
					y={p.y + 4 * Math.sin(t * 1.3 + i)}
					rotate={-10 + 10 * Math.sin(t + i)}
					scale={0.85}
					opacity={fadeEnds(u) * (0.35 + 0.65 * running)}
				/>
			{/each}
			<Label x={905} y={262} text="CO₂" size={11} muted />
			{#each [0, 1] as i (i)}
				{@const u = cycle(flow, 5, i / 2 + 0.25)}
				{@const p = along(sugarPath, u)}
				<Molecule
					kind="sugar"
					carbons={3}
					phosphates={1}
					x={p.x}
					y={p.y}
					scale={0.85}
					opacity={fadeEnds(u) * running}
				/>
			{/each}
			<Label x={RING.x + 32} y={438} text="G3P" size={11} muted anchor="start" />
			<Label
				x={RING.x}
				y={522}
				text="sugars (sucrose, starch, cellulose)"
				size={12}
				opacity={0.45 + 0.55 * running}
			/>

			<!-- captions -->
			<Label
				x={245}
				y={502}
				text="no light → no ATP/NADPH → the Calvin cycle stalls"
				size={12}
				muted
				opacity={1 - running}
			/>
			<Label x={480} y={568} text="6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂" size={15} weight={600} />
		</g>
	{/if}

	<!-- ============================================================ planet -->
	{#if planetMix > 0.005}
		<g opacity={planetMix}>
			<!-- sun -->
			<g transform="translate({PSUN.x} {PSUN.y})">
				<circle r="46" fill={colors.photon} opacity="0.12" />
				<circle r="27" fill={colors.photon} opacity="0.95" />
				{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as i (i)}
					{@const a = (i / 12) * TAU + t * 0.15}
					<line
						x1={35 * Math.cos(a)}
						y1={35 * Math.sin(a)}
						x2={(41 + 3 * Math.sin(t * 2 + i)) * Math.cos(a)}
						y2={(41 + 3 * Math.sin(t * 2 + i)) * Math.sin(a)}
						stroke={colors.photon}
						stroke-width="2.5"
						stroke-linecap="round"
						opacity="0.8"
					/>
				{/each}
			</g>
			<Label x={PSUN.x} y={PSUN.y + 62} text="sunlight" size={11} muted />

			<!-- atmosphere -->
			<circle
				cx={GLOBE.x}
				cy={GLOBE.y}
				r={GLOBE.r + 16}
				fill="none"
				stroke="#8ec5ff"
				stroke-width="12"
				opacity="0.1"
			/>
			<circle
				cx={GLOBE.x}
				cy={GLOBE.y}
				r={GLOBE.r + 7}
				fill="none"
				stroke="#8ec5ff"
				stroke-width="5"
				opacity="0.3"
			/>
			<!-- globe -->
			<circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="#3b7dd8" />
			<g clip-path="url(#summary-globe-clip)">
				{#each continentPaths as d, i (i)}
					<path {d} fill="#4fae6c" stroke="#2f8a4f" stroke-width="1.5" stroke-linejoin="round" />
				{/each}
				<ellipse cx={GLOBE.x} cy={GLOBE.y - 142} rx="78" ry="16" fill="#eef4fb" opacity="0.95" />
				<ellipse cx={GLOBE.x} cy={GLOBE.y + 146} rx="96" ry="18" fill="#eef4fb" opacity="0.95" />
				{#each plankton as p (p.i)}
					<circle
						cx={p.x}
						cy={p.y}
						r="2"
						fill="#9ff0a6"
						opacity={0.15 + 0.7 * wave(t, 1.6 + hash(p.i, 13) * 2.4, hash(p.i, 14))}
					/>
				{/each}
				<circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="url(#summary-globe-shade)" />
			</g>
			<circle cx={GLOBE.x} cy={GLOBE.y} r={GLOBE.r} fill="none" stroke="#2a5da8" stroke-width="2" />

			<!-- photons from the sun -->
			{#each planetPhotons as p, i (i)}
				{@const u = cycle(t, 2.6, i / planetPhotons.length)}
				<Photon
					x={lerp(PSUN.x + 30, p.to.x, u)}
					y={lerp(PSUN.y + 30, p.to.y, u)}
					angle={p.angle}
					opacity={smoothstep(0.12, 0.26, u) * (1 - smoothstep(0.88, 1, u))}
					phase={t * 3}
				/>
			{/each}
			<!-- CO₂ spiralling in (right side), O₂ leaving (left / bottom) -->
			{#each co2In as i (i)}
				{@const u = cycle(t, 7, i / co2In.length)}
				{@const a = -1.35 + i * 0.38 + u * 0.55}
				{@const r = lerp(205, GLOBE.r + 12, u)}
				{@const p = polar(GLOBE.x, GLOBE.y, r, a)}
				<Molecule
					kind="CO2"
					x={p.x}
					y={p.y}
					rotate={(a * 180) / Math.PI + 90}
					scale={0.75}
					opacity={fadeEnds(u)}
				/>
			{/each}
			{#each o2Out as i (i)}
				{@const u = cycle(t, 6, i / o2Out.length + 0.3)}
				{@const a = 2.4 + i * 0.26 + u * 0.3}
				{@const r = lerp(GLOBE.r + 10, 228, u)}
				{@const p = polar(GLOBE.x, GLOBE.y, r, a)}
				<Molecule
					kind="O2"
					x={p.x}
					y={p.y}
					rotate={(a * 180) / Math.PI}
					scale={0.8}
					opacity={fadeEnds(u)}
				/>
			{/each}
			<Label x={470} y={122} text="CO₂ in" size={11} muted />
			<Label x={62} y={462} text="O₂ out" size={11} muted />
			<Label
				x={250}
				y={GLOBE.y + GLOBE.r + 42}
				text="phytoplankton · forests · crops"
				size={11}
				muted
			/>

			<!-- stat tiles -->
			{#each tiles as tile, i (tile.n)}
				{@const o = reduced ? 1 : smoothstep(0.2 + i * 0.22, 0.8 + i * 0.22, t)}
				<g opacity={o} transform="translate(0 {(1 - o) * 8})">
					<rect
						x={tile.x}
						y={tile.y}
						width={TILE.w}
						height={TILE.h}
						rx="14"
						fill="var(--surface)"
						stroke="var(--stage-line)"
						stroke-width="1"
					/>
					<rect x={tile.x + 20} y={tile.y + 24} width="30" height="4" rx="2" fill={tile.c} />
					<text x={tile.x + 20} y={tile.y + 70} font-size="28" font-weight="700">{tile.n}</text>
					<text x={tile.x + 20} y={tile.y + 100} font-size="12" class="muted">{tile.a}</text>
					<text x={tile.x + 20} y={tile.y + 118} font-size="12" class="muted">{tile.b}</text>
				</g>
			{/each}

			<!-- timeline -->
			<path d="{o2Curve} L{tx(0)} {TL_Y} Z" fill={colors.oxygen} opacity="0.12" />
			<path d={o2Curve} fill="none" stroke={colors.oxygen} stroke-width="1.5" opacity="0.7" />
			<Label x={tx(1.5)} y={TL_Y - 18} text="oxygen in the air" size={10} muted />
			<Flow
				d="M{tx(3)} {TL_Y} L{tx(0) + 14} {TL_Y}"
				color="var(--stage-ink-muted)"
				width={1.5}
				arrow
				dash={4}
				{t}
				speed={30}
				opacity={0.6}
			/>
			{#each [{ b: 3, l1: '~3 billion years ago', l2: 'first cyanobacteria' }, { b: 2.4, l1: '~2.4 billion years ago', l2: 'Great Oxidation Event' }, { b: 0.47, l1: '~470 million years ago', l2: 'plants colonise land' }] as m (m.b)}
				<circle
					cx={tx(m.b)}
					cy={TL_Y}
					r="4"
					fill="var(--stage-bg)"
					stroke="var(--stage-ink)"
					stroke-width="1.5"
				/>
				<Label x={tx(m.b)} y={TL_Y + 22} text={m.l1} size={11} />
				<Label x={tx(m.b)} y={TL_Y + 37} text={m.l2} size={11} muted />
			{/each}
			<circle cx={tx(0)} cy={TL_Y} r="4" fill="var(--stage-ink)" />
			<Label x={tx(0)} y={TL_Y + 22} text="today" size={11} weight={600} />
		</g>
	{/if}
</g>
