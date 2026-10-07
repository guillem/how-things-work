<script lang="ts">
	/**
	 * Steps 15–16: the whole system at a glance (light reactions and Calvin
	 * cycle coupled by the ATP/NADPH shuttles, driven by the light slider) and
	 * the planetary big picture (a stylised Earth with the headline numbers).
	 * The two layouts hand over (one fades out, then the other fades in) when
	 * the step's `phase` hint changes. The light slider drives the system layout
	 * through a t-indexed history of the light level (see `frame` below).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, linear } from 'svelte/easing';
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
	/**
	 * 0 = system, 1 = planet. The layouts hand over sequentially rather than
	 * cross-fading: the system is gone by mix = 0.5 and only then does the
	 * planet fade in, so the labels of one never sit on top of the other's.
	 * The tween is linear; each half gets its own smoothstep below.
	 */
	const MIX_MS = 1000;
	const mix = new Tween(untrack(() => phase) === 'planet' ? 1 : 0, {
		duration: MIX_MS,
		easing: linear
	});
	$effect(() => {
		const target = phase === 'planet' ? 1 : 0;
		const duration = reduced ? 0 : MIX_MS;
		untrack(() => mix.set(target, { duration }));
	});
	const planetMix = $derived(mix.current);
	const systemOpacity = $derived(1 - smoothstep(0, 0.5, planetMix));
	const planetOpacity = $derived(smoothstep(0.5, 1, planetMix));

	// ---- light → carriers ---------------------------------------------------------
	const light = $derived(Number(params.light ?? 70) / 100);
	/** Seconds a carrier takes to cross the upper lane to the Calvin cycle. */
	const LANE_TIME = 5;
	/** Seconds a spent carrier takes to return along the lower lane. */
	const LOWER_TIME = 6;
	/**
	 * Oldest "light level N seconds ago" the scene asks for: a spent carrier at
	 * the end of the lower lane was charged LANE_TIME + LOWER_TIME seconds ago.
	 */
	const HISTORY = LANE_TIME + LOWER_TIME;
	/**
	 * The slider is smoothed by one short wall-clock tween (0.9 s, the guide's
	 * sanctioned use); everything downstream runs on `t`.
	 */
	const supplyTween = new Tween(
		untrack(() => light),
		{ duration: 900, easing: cubicInOut }
	);
	$effect(() => {
		const target = light;
		const duration = reduced ? 0 : 900;
		untrack(() => supplyTween.set(target, { duration }));
	});
	/** Light reaching the membrane right now. */
	const supply = $derived(supplyTween.current);

	/**
	 * Per-frame bookkeeping — the one documented exception to "a pure function
	 * of t" in this scene. Two things are kept from frame to frame:
	 *
	 * 1. A history of the light level, sampled in t-time. A carrier that is
	 *    `age` seconds along its lane was emitted `age` seconds ago, so
	 *    `levelAt(age)` says whether it exists. Cut the light and the carriers
	 *    already under way still reach the Calvin cycle while no new ones appear
	 *    behind them: the lane empties from the thylakoid end and the cycle, fed
	 *    by `levelAt(LANE_TIME)`, stalls a few seconds later — "the carriers run
	 *    out". Because the history is indexed by `t`, the lane, the gauges and
	 *    the ring stay in step at 0.5× / 2× playback and while paused (a
	 *    wall-clock delayed tween would not).
	 * 2. The ATP-synthase rotor and Calvin-ring angles, which are the integrals
	 *    of rates that change smoothly with the slider (a pure `t × rate` would
	 *    jump with every rate change).
	 *
	 * Guards: `t` restarting at 0 on a step change (dt < 0) resets the history
	 * and only resyncs the angles; a paused clock (dt = 0) records nothing new
	 * but lets the newest sample follow a slider moved while paused; under
	 * reduced motion (t frozen at 2.5 s) the history is a single sample at the
	 * current level and both angles stay at 0, so the frame is static and shows
	 * the slider's state.
	 */
	interface Sample {
		t: number;
		v: number;
	}
	let hist: Sample[] = [];
	let rotorAcc = 0;
	let ringAcc = 0;
	let lastT = -1;
	/** Newest sample taken at or before `now - age` (the oldest one if none is). */
	function lookup(samples: Sample[], now: number, age: number) {
		const target = now - age;
		let lo = 0;
		let hi = samples.length - 1;
		if (samples[0].t >= target) return samples[0].v;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (samples[mid].t <= target) lo = mid;
			else hi = mid - 1;
		}
		return samples[lo].v;
	}
	/**
	 * Calvin-cycle rate for a given carrier supply: nearly proportional while
	 * carriers are scarce, flattening towards full light, where RuBisCO and the
	 * CO₂ supply set the pace (0.7 → 0.84, 1 → 1).
	 */
	const saturate = (x: number) => (x * 1.8) / (x + 0.8);
	const frame = $derived.by(() => {
		const dt = t - lastT;
		if (reduced || lastT < 0 || dt < 0) {
			hist = [{ t, v: supply }];
		} else if (dt === 0) {
			hist[hist.length - 1] = { t, v: supply };
		} else {
			hist.push({ t, v: supply });
			while (hist.length > 1 && hist[1].t <= t - HISTORY) hist.shift();
			if (dt < 0.5) {
				rotorAcc += dt * supply;
				ringAcc += dt * saturate(lookup(hist, t, LANE_TIME));
			}
		}
		lastT = t;
		return { hist, rotor: rotorAcc, ring: ringAcc };
	});
	const clocks = $derived({ rotor: frame.rotor, ring: frame.ring });
	/** Light level as it was `age` seconds ago. */
	const levelAt = (age: number) => lookup(frame.hist, t, age);
	/** Carriers arriving at the Calvin cycle now: what left the membrane LANE_TIME ago. */
	const arrived = $derived(levelAt(LANE_TIME));
	/** 0 → 1 as a level goes from "nothing" to "clearly running". */
	const on = (level: number) => smoothstep(0.03, 0.25, level);
	const lit = $derived(on(supply));
	const running = $derived(on(arrived));
	/**
	 * Captions, both keyed to the carriers ARRIVING at the Calvin cycle so they
	 * agree with the ring and the gauges. The stall caption's window sits
	 * between two slider stops (running 0.03 → 0.2, i.e. arrived ≈ 5 % → 10 %:
	 * fully on at 5 %, fully off at 10 %); the bottleneck caption only comes in
	 * once bright-light carriers arrive (arrived 0.9 → 0.97: fully off at 90 %
	 * on the slider, clearly on at 95 %). The two sentences share a spot and are
	 * never drawn on top of each other.
	 */
	const stalled = $derived(1 - smoothstep(0.03, 0.2, running));
	const bottleneck = $derived(smoothstep(0.9, 0.97, arrived));

	const fadeEnds = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u));
	/**
	 * Lane pills fade in/out short of the Calvin ring so none is ever drawn
	 * across its stroke: the upper lane's last 10 % (its arrowhead) and the lower
	 * lane's first 10 % (where it leaves the ring) stay pill-free.
	 */
	const fadeUpper = (u: number) => smoothstep(0, 0.08, u) * (1 - smoothstep(0.8, 0.9, u));
	const fadeLower = (u: number) => smoothstep(0.1, 0.18, u) * (1 - smoothstep(0.9, 1, u));

	// ============================================================ system layout
	const LEFT = { x: 60, y: 120, w: 370, h: 350 };
	const RIGHT = { x: 530, y: 120, w: 370, h: 350 };
	const SUN = { x: 212, y: 206 };
	const PSII = { x: 150, y: 298 };
	const B6F = { x: 205, y: 299 };
	const PSI = { x: 278, y: 298 };
	const SYNTH = { x: 351, y: 298 };
	const RING = { x: 715, y: 310, r: 78 };
	const RUBISCO = { x: 793, y: 310 };

	const photonPaths = [
		{ to: { x: PSII.x + 2, y: PSII.y - 20 } },
		{ to: { x: PSI.x - 2, y: PSI.y - 20 } }
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
		{ x: 450, y: 378 },
		{ x: 412, y: 352 }
	]);
	const co2Path = smooth([
		{ x: 928, y: 282 },
		{ x: 880, y: 284 },
		{ x: 840, y: 290 },
		{ x: 816, y: 298 }
	]);
	const sugarPath = smooth([
		{ x: RING.x, y: RING.y + RING.r + 6 },
		{ x: RING.x, y: 440 },
		{ x: RING.x, y: 496 }
	]);
	/**
	 * Carrier slots on the lanes; higher slots only fill up in brighter light
	 * (4 of 5 at the default 70 %, all at 100 %). Five slots on the ≈255 px
	 * lower lane leave ≥ 13 px between the 45 px NADP⁺ pill and its neighbours.
	 * Each slot switches inside a 3 %-wide window centred between two slider
	 * stops (7.5 %, 22.5 %, 37.5 %, 57.5 %, 72.5 %), so at every reachable
	 * slider value a pill is fully on or fully off — never parked half-faded —
	 * while the 0.9 s tween still fades it rather than popping it.
	 */
	const upperPills = ['ATP', 'NADPH', 'ATP', 'ATP', 'NADPH'] as const;
	const lowerPills = ['ADP', 'Pi', 'NADP+', 'ADP', 'NADP+'] as const;
	const slotOn = (i: number, n: number, level: number) => {
		const mid = Math.floor(1 + (17 * i) / n) * 0.05 + 0.025;
		return smoothstep(mid - 0.015, mid + 0.015, level);
	};
	const gauges = [
		{ x: 455, c: colors.atp, n: 'ATP' },
		{ x: 505, c: colors.nadph, n: 'NADPH' }
	];

	const ringAngle = $derived(clocks.ring * 48);
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
	const TILE = { w: 210, h: 150, pad: 16 };
	const tiles: { x: number; y: number; n: string; lines: string[]; note?: string; c: string }[] = [
		{
			x: 508,
			y: 128,
			n: '~105 Gt C',
			lines: ['of carbon fixed every year', 'on land and in the oceans'],
			note: '(net primary production)',
			c: colors.sugar
		},
		{
			x: 730,
			y: 128,
			n: '~50 %',
			lines: ['of it at sea: microscopic', 'algae and cyanobacteria'],
			c: '#3b7dd8'
		},
		{
			x: 508,
			y: 298,
			n: '21 % O₂',
			lines: ['in the air: the accumulated', 'by-product of photosynthesis'],
			c: colors.oxygen
		},
		{
			x: 730,
			y: 298,
			n: '1–2 %',
			lines: ['of sunlight energy becomes', 'biomass in a crop field'],
			note: 'theoretical ceiling ≈ 5 %',
			c: '#d97706'
		}
	];
	/** Timeline: billions of years ago → x. */
	const tx = (bya: number) => 880 - (bya / 3) * 750;
	const TL_Y = 530;
	const milestones = [
		{ b: 3, l1: '~3 billion years ago', l2: 'first cyanobacteria' },
		{ b: 2.4, l1: '~2.4 billion years ago', l2: 'Great Oxidation Event' },
		{ b: 0.47, l1: '~470 million years ago', l2: 'plants colonise land' }
	];
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
	{#if planetMix < 0.5}
		<g opacity={systemOpacity}>
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
			<g transform="translate({SUN.x} {SUN.y})" opacity={0.3 + 0.7 * supply}>
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
			<Label x={240} y={329} text="lumen" size={11} muted />
			<Label x={412} y={196} text="stroma" size={11} muted anchor="end" />
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
			<g transform="translate({SYNTH.x} {SYNTH.y - 26}) rotate({clocks.rotor * 240})">
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
			<Label x={PSII.x} y={378} text="PSII" size={11} muted />
			<Label x={B6F.x} y={378} text="cyt b₆f" size={11} muted />
			<Label x={PSI.x} y={378} text="PSI" size={11} muted />
			<Label x={SYNTH.x} y={378} text="ATP synthase" size={11} muted />

			<!-- photons from the sun to PSII and PSI (more of them in brighter light) -->
			{#each photonPaths as p, pi (pi)}
				{#each photonSlots as k (k)}
					{@const u = cycle(t, 2.4, k / 3 + pi * 0.17)}
					{@const vis = smoothstep(k / 3 + 0.02, (k + 0.8) / 3, supply)}
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
			<!-- water in, oxygen out: like the lane pills, a molecule at phase u set off
			     u × period seconds ago, so they run out from the source and restart from it
			     instead of popping in mid-path (the +0.15 phase keeps every water
			     molecule out of its fade zones in the reduced-motion frame at t = 2.5 s) -->
			{#each [0, 1, 2] as i (i)}
				{@const u = cycle(t, 4, i / 3 + 0.15)}
				{@const p = along(waterPath, u)}
				<Molecule
					kind="H2O"
					x={p.x}
					y={p.y + 3 * Math.sin(t * 2 + i)}
					scale={0.8}
					opacity={fadeEnds(u) * on(levelAt(u * 4))}
				/>
			{/each}
			<Label x={32} y={362} text="H₂O" size={12} anchor="start" opacity={0.4 + 0.6 * lit} />
			{#each [0, 1] as i (i)}
				{@const u = cycle(t, 4.5, i / 2 + 0.3)}
				{@const p = along(o2Path, u)}
				<Molecule
					kind="O2"
					x={p.x + 4 * Math.sin(t * 1.5 + i * 2)}
					y={p.y}
					scale={0.85}
					opacity={fadeEnds(u) * on(levelAt(u * 4.5))}
				/>
			{/each}
			<Label x={158} y={108} text="O₂" size={12} anchor="start" opacity={0.4 + 0.6 * lit} />

			<!-- ---- shuttles between the two machines ---- -->
			<Flow
				d={pathFrom(upperLane)}
				color="var(--stage-ink-muted)"
				width={2}
				arrow
				dash={6}
				{t}
				speed={60}
				opacity={0.25 + 0.35 * lit}
			/>
			<Flow
				d={pathFrom(lowerLane)}
				color="var(--stage-ink-muted)"
				width={2}
				arrow
				dash={6}
				{t}
				speed={60}
				opacity={0.25 + 0.35 * running}
			/>
			<!-- a carrier at phase u set off u × LANE_TIME seconds ago -->
			{#each upperPills as kind, i (i)}
				{@const u = cycle(t, LANE_TIME, i / upperPills.length)}
				{@const p = along(upperLane, u)}
				<Molecule
					{kind}
					x={p.x}
					y={p.y}
					scale={1}
					opacity={fadeUpper(u) * slotOn(i, upperPills.length, levelAt(u * LANE_TIME))}
				/>
			{/each}
			<!-- a spent carrier at phase u left the ring u × LOWER_TIME seconds ago and was
			     charged LANE_TIME seconds before that; its age advances with the pill, so after
			     a light change the lane empties (or fills) from the ring end, never mid-lane -->
			{#each lowerPills as kind, i (i)}
				{@const u = cycle(t, LOWER_TIME, i / lowerPills.length)}
				{@const p = along(lowerLane, u)}
				<Molecule
					{kind}
					x={p.x}
					y={p.y}
					scale={0.9}
					opacity={fadeLower(u) * slotOn(i, lowerPills.length, levelAt(LANE_TIME + LOWER_TIME * u))}
				/>
			{/each}
			<!-- gauges: charged carriers on hand at the Calvin cycle. They follow what has
			     ARRIVED, not the light right now, so gauge, ring, G3P and the stall caption
			     always agree: the lane empties first, then the gauges drain as the last
			     carriers are used up and the cycle stops. -->
			{#each gauges as g (g.n)}
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
					y={334 - 72 * arrived}
					width="14"
					height={72 * arrived}
					rx="4"
					fill={g.c}
					opacity="0.9"
				/>
				<Label x={g.x} y={349} text={g.n} size={11} muted />
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
			<Label x={RING.x} y={293} text="fix · reduce" size={11} muted />
			<Label x={RING.x} y={308} text="regenerate" size={11} muted />
			<Label x={RING.x} y={330} text="9 ATP + 6 NADPH" size={11} />
			<Label x={RING.x} y={345} text="per G3P" size={11} muted />
			<ellipse
				cx={RUBISCO.x}
				cy={RUBISCO.y}
				rx="21"
				ry="15"
				fill={colors.rubisco}
				stroke="var(--protein-edge)"
				stroke-width="1"
			/>
			<Label x={RUBISCO.x + 26} y={RUBISCO.y + 21} text="RuBisCO" size={11} muted anchor="start" />
			<!-- CO₂ is the supply, not the product: it keeps drifting in on t (dimmed while
			     the cycle is stalled) instead of freezing with the ring, which left a
			     half-faded molecule stuck under the label -->
			{#each [0, 1] as i (i)}
				{@const u = cycle(t, 5, i / 2)}
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
			<Label x={905} y={262} text="CO₂" size={12} />
			{#each [0, 1] as i (i)}
				{@const u = cycle(clocks.ring, 5, i / 2 + 0.25)}
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
			<Label
				x={RING.x + 32}
				y={438}
				text="G3P"
				size={12}
				anchor="start"
				opacity={0.45 + 0.55 * running}
			/>
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
				text="no light → no ATP or NADPH → the Calvin cycle stalls"
				size={12}
				muted
				opacity={stalled}
			/>
			<Label
				x={245}
				y={502}
				text="bright light: RuBisCO and the CO₂ supply set the pace"
				size={12}
				muted
				opacity={bottleneck}
			/>
			<Label x={480} y={568} text="6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂" size={15} weight={600} />
		</g>
	{/if}

	<!-- ============================================================ planet -->
	{#if planetMix > 0.5}
		<g opacity={planetOpacity}>
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

			<!-- photons from the sun (the +0.1 phase keeps every photon out of its fade zones
			     in the reduced-motion frame at t = 2.5 s) -->
			{#each planetPhotons as p, i (i)}
				{@const u = cycle(t, 2.6, i / planetPhotons.length + 0.1)}
				<Photon
					x={lerp(PSUN.x + 30, p.to.x, u)}
					y={lerp(PSUN.y + 30, p.to.y, u)}
					angle={p.angle}
					opacity={smoothstep(0.12, 0.26, u) * (1 - smoothstep(0.88, 1, u))}
					phase={t * 3}
				/>
			{/each}
			<!-- CO₂ spiralling in (right side), O₂ leaving (left / bottom) -->
			<!-- (the +0.05 phase keeps every molecule out of its fade-in zone in the
			     reduced-motion frame at t = 2.5 s) -->
			{#each co2In as i (i)}
				{@const u = cycle(t, 7, i / co2In.length + 0.05)}
				{@const a = -1.35 + i * 0.38 + u * 0.55}
				{@const r = lerp(196, GLOBE.r + 12, u)}
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
				x={GLOBE.x}
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
					<rect x={tile.x + TILE.pad} y={tile.y + 24} width="30" height="4" rx="2" fill={tile.c} />
					<Label
						x={tile.x + TILE.pad}
						y={tile.y + 68}
						text={tile.n}
						size={26}
						weight={700}
						anchor="start"
					/>
					{#each tile.lines as line, li (li)}
						<Label
							x={tile.x + TILE.pad}
							y={tile.y + 96 + li * 18}
							text={line}
							size={12}
							muted
							anchor="start"
						/>
					{/each}
					{#if tile.note}
						<Label
							x={tile.x + TILE.pad}
							y={tile.y + 134}
							text={tile.note}
							size={11}
							muted
							anchor="start"
						/>
					{/if}
				</g>
			{/each}

			<!-- timeline -->
			<path d="{o2Curve} L{tx(0)} {TL_Y} Z" fill={colors.oxygen} opacity="0.12" />
			<path d={o2Curve} fill="none" stroke={colors.oxygen} stroke-width="1.5" opacity="0.7" />
			<Label x={tx(1.5)} y={TL_Y - 24} text="oxygen in the air" size={11} muted />
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
			{#each milestones as m (m.b)}
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
