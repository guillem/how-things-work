<script lang="ts">
	/**
	 * Steps 12–15: the Calvin cycle, drawn as a ring in the stroma.
	 *
	 * A cohort of three RuBP molecules goes round once every 16 s: each one
	 * meets a CO₂ at RuBisCO (one o'clock), flashes as an unstable 6-carbon
	 * intermediate and splits into two 3-PGA that ride the ring as a pair. In
	 * the reduction arc ATP and NADPH shuttle out from the granum in the middle
	 * along two-lane "roads" to a docking point just inside the ring, and the
	 * spent ADP, Pi and NADP⁺ ride back on the other lane (Pi beside its
	 * NADP⁺, between the lanes). Each carrier of a pair serves one of the two
	 * 3-PGA, so the phosphates on the chains change as it arrives. At six o'clock one
	 * G3P leaves the ring and follows a path to the right, where two G3P make a
	 * glucose that is sent on to starch, sucrose or cellulose. The other five
	 * G3P are rebuilt into RuBP in the regeneration arc (three more ATP). A
	 * ledger on the right keeps the carbon bookkeeping for one 3-CO₂ round.
	 *
	 * `step.hints.phase` (fixation | reduction | regeneration | export) decides
	 * what is emphasised and where in the cycle the cohort starts, so that each
	 * step shows its own stage within the first seconds (the ring contents are
	 * cut and faded back in across the switch, since the cohort jumps to the new
	 * station). `params.carbons` switches between carbon-bead chains and compact
	 * labelled pills.
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import type { StageProps } from '#lib/explainer/index.ts';
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
		clamp,
		easeInOut,
		polar,
		pathFrom,
		wave,
		TAU,
		type Point
	} from '#lib/draw/index.ts';

	let { step, t, params, reduced }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'fixation'));
	const compact = $derived(params.carbons === false);

	// ---- emphasis -------------------------------------------------------------
	type Region = 'fix' | 'red' | 'reg';
	interface Emph {
		fix: number;
		red: number;
		reg: number;
		exp: number;
	}
	const EMPH: Record<string, Emph> = {
		fixation: { fix: 1, red: 0, reg: 0, exp: 0 },
		reduction: { fix: 0, red: 1, reg: 0, exp: 0 },
		regeneration: { fix: 0, red: 0, reg: 1, exp: 0 },
		export: { fix: 0, red: 0, reg: 0, exp: 1 }
	};
	const emph = new Tween<Emph>({ ...EMPH.fixation }, { duration: 800, easing: cubicInOut });
	/**
	 * On a step change the cohort jumps to the new step's starting station (see
	 * OFFSET), so the ring contents are cut and faded back in instead of teleporting.
	 */
	const cut = new Tween(1, { duration: 450, easing: cubicInOut });
	let lastPhase: string | null = null;
	$effect(() => {
		const target = EMPH[phase] ?? EMPH.fixation;
		const next = phase;
		const instant = reduced;
		// untrack: the tweens' own state must not re-trigger this effect
		untrack(() => {
			emph.set({ ...target }, { duration: instant ? 0 : 800 });
			if (!instant && lastPhase !== null && lastPhase !== next) {
				cut.set(0, { duration: 0 });
				cut.set(1, { duration: 450, delay: 40 });
			} else cut.set(1, { duration: 0 });
			lastPhase = next;
		});
	});
	const e = $derived(emph.current);
	/** Emphasis per arc; in the export step the whole ring stays half lit. */
	const arcEmph = $derived<Record<Region, number>>({
		fix: e.fix + 0.5 * e.exp,
		red: e.red + 0.5 * e.exp,
		reg: e.reg + 0.5 * e.exp
	});
	const DIM = 0.5;
	const dimTo = (w: number) => lerp(DIM, 1, clamp(w));

	// ---- ring geometry --------------------------------------------------------
	const C = { x: 400, y: 310 };
	const R = 185;
	/** Half the distance between the two lanes a 3-PGA/G3P pair rides on. */
	const lane = $derived(compact ? 17 : 14);
	/** Ring parameter s ∈ [0, 1): 0 at ten o'clock, clockwise. */
	const deg = (s: number) => -120 + 360 * s;
	const at = (s: number, r = R) => polar(C.x, C.y, r, (deg(s) * Math.PI) / 180);
	const arc = (s0: number, s1: number, r = R) => {
		const a = at(s0, r);
		const b = at(s1, r);
		const large = s1 - s0 > 0.5 ? 1 : 0;
		return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 ${large} 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
	};
	const S_3 = 1 / 3; // three o'clock
	const S_8 = 0.75; // eight o'clock
	const arcs = {
		fix: arc(0, S_3),
		red: arc(S_3, S_8),
		reg: arc(S_8, 1)
	};

	// ---- timeline (fractions of one lap) ----------------------------------------
	const PERIOD = 16;
	/** Gap between the three RuBP of the cohort, as a fraction of the lap (≈ 1.4 s). */
	const SPACING = 0.09;
	const S_RUBISCO = 1 / 6; // one o'clock
	const FLASH = 0.03;
	const SPLIT = 0.035;
	const S_ATP1 = 0.4;
	const S_NADPH = 0.5;
	const S_EXIT = 7 / 12; // six o'clock
	const S_ATP2 = 0.82;
	/**
	 * Regeneration: the G3P of a pair converge and dissolve into the enzyme
	 * series, then a RuBP condenses a little further on — never both at once, so
	 * the carbon counts on screen stay honest.
	 */
	const REGROUP = { out: [0.87, 0.91], in: [0.91, 0.95] } as const;
	/** Travel time of a carrier along its road, as a fraction of the lap. */
	const CARRIER = 0.06;
	/**
	 * The second carrier of a pair follows the first by this fraction of the trip.
	 * With SPACING − CARRIER = LAG · CARRIER the pills on a lane stay evenly spaced
	 * from one cohort to the next, so two never overlap.
	 */
	const LAG = 0.5;
	const CO2_LEAD = 0.09;
	const EXIT_TRAVEL = 0.16;
	/** Where the cohort starts for each step, so the step's stage shows at once. */
	const OFFSET: Record<string, number> = {
		fixation: 0.11,
		reduction: 0.36,
		regeneration: 0.724,
		export: 0.52
	};
	const u = $derived(cycle(t, PERIOD, OFFSET[phase] ?? 0));
	const flash = $derived(0.55 + 0.45 * Math.sin(t * 36));

	const RUBISCO = at(S_RUBISCO);
	const CO2_SRC = { x: 598, y: 104 };
	const CO2_MID = { x: 572, y: 118 };
	const GRANUM = { x: 400, y: 312 };

	// ---- carrier roads: granum → dock just inside the ring → back -----------------
	type PillKind = 'CO2' | 'ATP' | 'ADP' | 'NADPH' | 'NADP+' | 'Pi';
	interface Item {
		kind: PillKind;
		/** Delay behind the first item of the trip, as a fraction of the trip. */
		lag: number;
		/** Screen-space offset from the lane point, to ride beside another pill. */
		off?: Point;
	}
	interface StationDef {
		at: number;
		/** Where the road leaves the granum. */
		anchor: Point;
		inbound: Item[];
		outbound: Item[];
	}
	const DOCK_R = R - 44;
	/** Half the width of a road: inbound and outbound lanes sit either side of it. */
	const ROAD = 18;
	/**
	 * Where a Pi rides relative to its NADP⁺: straight below the (axis-aligned)
	 * pill, which on this diagonal road keeps it clear of both lanes.
	 */
	const PI_OFF: Point = { x: 0, y: 15 };
	const STATION_DEFS: StationDef[] = [
		{
			at: S_ATP1,
			anchor: { x: GRANUM.x + 34, y: GRANUM.y + 8 },
			inbound: [
				{ kind: 'ATP', lag: 0 },
				{ kind: 'ATP', lag: LAG }
			],
			outbound: [
				{ kind: 'ADP', lag: 0 },
				{ kind: 'ADP', lag: LAG }
			]
		},
		{
			at: S_NADPH,
			anchor: { x: GRANUM.x - 8, y: GRANUM.y + 38 },
			inbound: [
				{ kind: 'NADPH', lag: 0 },
				{ kind: 'NADPH', lag: LAG }
			],
			// each NADPH leaves as NADP⁺ plus the phosphate released from the chain
			outbound: [
				{ kind: 'NADP+', lag: 0 },
				{ kind: 'Pi', lag: 0, off: PI_OFF },
				{ kind: 'NADP+', lag: LAG },
				{ kind: 'Pi', lag: LAG, off: PI_OFF }
			]
		},
		{
			at: S_ATP2,
			anchor: { x: GRANUM.x - 34, y: GRANUM.y + 2 },
			inbound: [{ kind: 'ATP', lag: 0 }],
			outbound: [{ kind: 'ADP', lag: 0 }]
		}
	];
	const regionOf = (p: number): Region => (p < S_3 ? 'fix' : p < S_8 ? 'red' : 'reg');
	const stations = STATION_DEFS.map((s) => {
		const dock = at(s.at, DOCK_R);
		const dx = dock.x - s.anchor.x;
		const dy = dock.y - s.anchor.y;
		const len = Math.hypot(dx, dy);
		const n = { x: (-dy / len) * ROAD, y: (dx / len) * ROAD };
		return {
			...s,
			dock,
			region: regionOf(s.at),
			in0: { x: s.anchor.x + n.x, y: s.anchor.y + n.y },
			in1: { x: dock.x + n.x, y: dock.y + n.y },
			out0: { x: dock.x - n.x, y: dock.y - n.y },
			out1: { x: s.anchor.x - n.x, y: s.anchor.y - n.y }
		};
	});

	// ---- export side ------------------------------------------------------------
	const J = { x: 712, y: 440 }; // where two G3P become glucose
	const exitPath = smooth([
		at(S_EXIT, R + 14),
		{ x: 470, y: 542 },
		{ x: 560, y: 553 },
		{ x: 640, y: 520 },
		{ x: 690, y: 466 },
		{ x: J.x - 2, y: J.y + 4 }
	]);
	const STARCH = { x: 858, y: 322 };
	const PHLOEM = { x: 816, y: 419, w: 88, h: 22 };
	const WALL = { x: 816, y: 506, w: 88, h: 34 };
	// The branches must not run through the captions of their targets: starch is
	// reached from below (its captions sit to its left), the phloem and the cell
	// wall from the left (their captions sit below them).
	const branches = [
		smooth([
			{ x: 740, y: 434 },
			{ x: 798, y: 428 },
			{ x: 830, y: 394 },
			{ x: 840, y: 352 }
		]),
		smooth([
			{ x: 740, y: 440 },
			{ x: 776, y: 436 },
			{ x: 812, y: 430 }
		]),
		smooth([
			{ x: 740, y: 446 },
			{ x: 752, y: 480 },
			{ x: 776, y: 512 },
			{ x: 812, y: 523 }
		])
	];

	// ---- RuBisCO: a lumpy blob with hints of its 8 + 8 subunits -------------------
	const rubiscoPath = (() => {
		const n = 72;
		const pts: Point[] = [];
		for (let i = 0; i < n; i++) {
			const a = (i / n) * TAU;
			const r =
				31 + 4 * Math.sin(3 * a + 0.6) + 2.5 * Math.cos(5 * a - 0.3) + 1.2 * Math.sin(9 * a);
			pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
		}
		return pathFrom(pts) + ' Z';
	})();

	// ---- the moving cohort ------------------------------------------------------
	interface Chain {
		id: string;
		x: number;
		y: number;
		rotate: number;
		carbons: number;
		phosphates: number;
		opacity: number;
		flash: boolean;
		region: Region;
	}
	interface Pill {
		id: string;
		kind: PillKind;
		x: number;
		y: number;
		rotate: number;
		opacity: number;
		region: Region;
	}
	const fadeEnds = (v: number) => smoothstep(0, 0.08, v) * (1 - smoothstep(0.9, 1, v));
	/** Glucose units are born on the junction glucose: they fade in only once clear of it. */
	const fadeBranch = (v: number) => smoothstep(0.05, 0.3, v) * (1 - smoothstep(0.9, 1, v));

	const frame = $derived.by(() => {
		const chains: Chain[] = [];
		const pills: Pill[] = [];
		let exported: { x: number; y: number; rotate: number; opacity: number } | null = null;
		let arrive = 0;
		for (let k = 0; k < 3; k++) {
			const p = (((u - k * SPACING) % 1) + 1) % 1;
			const region = regionOf(p);
			const rot = deg(p) + 90;
			const here = at(p);

			// -- the sugar chains
			if (p < S_RUBISCO) {
				chains.push({
					id: `${k}-rubp`,
					...here,
					rotate: rot,
					carbons: 5,
					phosphates: 2,
					opacity: 1,
					flash: false,
					region
				});
			} else if (p < S_RUBISCO + FLASH) {
				chains.push({
					id: `${k}-6c`,
					...here,
					rotate: rot,
					carbons: 6,
					phosphates: 2,
					opacity: 1,
					flash: true,
					region
				});
			} else {
				const split = easeInOut(smoothstep(S_RUBISCO + FLASH, S_RUBISCO + FLASH + SPLIT, p));
				const dissolve = smoothstep(REGROUP.out[0], REGROUP.out[1], p);
				const condense = smoothstep(REGROUP.in[0], REGROUP.in[1], p);
				if (dissolve < 1) {
					for (const side of [-1, 1]) {
						// one of the six G3P leaves the cycle at six o'clock
						if (k === 0 && side === 1 && p >= S_EXIT) continue;
						// the second carrier of each pair serves the outer molecule, a little later
						const late = side === 1 ? LAG * CARRIER : 0;
						// 3-PGA (1 P) → 1,3-bisphosphoglycerate (2 P) after ATP → G3P (1 P) after NADPH
						const phosphates = p < S_ATP1 + late ? 1 : p < S_NADPH + late ? 2 : 1;
						const pt = at(p, R + side * lane * split * (1 - dissolve));
						chains.push({
							id: `${k}-pga${side}`,
							x: pt.x,
							y: pt.y,
							rotate: rot,
							carbons: 3,
							phosphates,
							opacity: 1 - dissolve,
							flash: false,
							region
						});
					}
				}
				if (condense > 0) {
					chains.push({
						id: `${k}-rubp`,
						...here,
						rotate: rot,
						carbons: 5,
						phosphates: 2,
						opacity: condense,
						flash: false,
						region
					});
				}
			}

			// -- CO₂ flying in to RuBisCO
			const vc = (p - (S_RUBISCO - CO2_LEAD)) / CO2_LEAD;
			if (vc >= 0 && vc < 1) {
				const w = easeInOut(vc);
				const a = { x: lerp(CO2_SRC.x, CO2_MID.x, w), y: lerp(CO2_SRC.y, CO2_MID.y, w) };
				const b = { x: lerp(CO2_MID.x, RUBISCO.x, w), y: lerp(CO2_MID.y, RUBISCO.y, w) };
				pills.push({
					id: `${k}-co2`,
					kind: 'CO2',
					x: lerp(a.x, b.x, w),
					y: lerp(a.y, b.y, w),
					rotate: 20 + 60 * vc,
					opacity: smoothstep(0, 0.15, vc) * (1 - smoothstep(0.85, 1, vc)),
					region: 'fix'
				});
			}

			// -- carriers: out from the granum on one lane, back on the other
			for (let si = 0; si < stations.length; si++) {
				const s = stations[si];
				const vin = (p - (s.at - CARRIER)) / CARRIER;
				for (let i = 0; i < s.inbound.length; i++) {
					const v = vin - s.inbound[i].lag;
					if (v < 0 || v >= 1) continue;
					const w = easeInOut(v);
					pills.push({
						id: `${k}-s${si}-in${i}`,
						kind: s.inbound[i].kind,
						x: lerp(s.in0.x, s.in1.x, w),
						y: lerp(s.in0.y, s.in1.y, w),
						rotate: 0,
						opacity: smoothstep(0, 0.15, v) * (1 - smoothstep(0.93, 1, v)),
						region: s.region
					});
				}
				const vout = (p - s.at) / CARRIER;
				for (let j = 0; j < s.outbound.length; j++) {
					const v = vout - s.outbound[j].lag;
					if (v < 0 || v >= 1) continue;
					const w = easeInOut(v);
					const off = s.outbound[j].off ?? { x: 0, y: 0 };
					pills.push({
						id: `${k}-s${si}-out${j}`,
						kind: s.outbound[j].kind,
						x: lerp(s.out0.x, s.out1.x, w) + off.x,
						y: lerp(s.out0.y, s.out1.y, w) + off.y,
						rotate: 0,
						opacity: smoothstep(0, 0.08, v) * (1 - smoothstep(0.7, 0.95, v)),
						region: s.region
					});
				}
			}

			// -- the exported G3P on its way to the sugar junction
			if (k === 0) {
				const ve = (p - S_EXIT) / EXIT_TRAVEL;
				if (ve >= 0 && ve < 1) {
					const pt = along(exitPath, ve);
					exported = {
						x: pt.x,
						y: pt.y,
						rotate: (pt.angle * 180) / Math.PI,
						opacity: 1 - smoothstep(0.9, 1, ve)
					};
				}
				// the glucose at the junction swells briefly as the G3P joins it
				arrive = 1 - smoothstep(0, 0.1, Math.abs(ve - 1));
			}
		}
		return { chains, pills, exported, arrive };
	});

	// ---- ledger -----------------------------------------------------------------
	interface Line {
		text: string;
		phases: string[];
		cost?: boolean;
	}
	const LINES: Line[] = [
		{ text: '3 RuBP · 15 C', phases: ['fixation'] },
		{ text: '+ 3 CO₂ · 3 C', phases: ['fixation'] },
		{ text: '= 6 × 3-PGA · 18 C', phases: ['fixation', 'reduction'] },
		{ text: '→ 6 G3P · 18 C   (6 ATP, 6 NADPH)', phases: ['reduction'] },
		{ text: '1 G3P out (3 C) + 5 recycled (15 C)', phases: ['regeneration', 'export'] },
		{ text: '5 G3P → 3 RuBP · 15 C   (3 ATP)', phases: ['regeneration'] },
		{ text: 'per G3P (3 CO₂): 9 ATP + 6 NADPH', phases: ['regeneration'], cost: true },
		{ text: 'per glucose: 6 CO₂ · 18 ATP · 12 NADPH', phases: ['export'], cost: true }
	];
	const LEDGER = { x: 640, y: 48, w: 304, h: 232 };
	const lineY = (i: number) => LEDGER.y + 52 + i * 22;
	/** The cost rows are totals: a rule above the first one sets them apart. */
	const COST_ROW = LINES.findIndex((l) => l.cost);
	const active = $derived(LINES.map((l) => (l.phases.includes(phase) ? 1 : 0)));
	const hi = new Tween<number[]>(
		LINES.map((l) => (l.phases.includes('fixation') ? 1 : 0)),
		{ duration: 700, easing: cubicInOut }
	);
	$effect(() => {
		const target = active;
		const duration = reduced ? 0 : 700;
		untrack(() => hi.set(target, { duration }));
	});

	// ---- export-side motion -----------------------------------------------------
	const exitEmph = $derived(dimTo(Math.max(e.exp, 0.8 * e.reg)));
	const sugarEmph = $derived(lerp(0.5, 1, e.exp));
	const ringDim = $derived(lerp(1, 0.6, e.exp));
	const starchR = $derived(15 + 2 * wave(t, 8));
</script>

<g class="calvin-scene">
	<!-- ================= stroma ================= -->
	<rect
		x="24"
		y="40"
		width="596"
		height="536"
		rx="28"
		fill="var(--stroma)"
		stroke="var(--border)"
	/>
	<Label x={44} y={66} text="stroma" anchor="start" size={12} muted />

	<!-- ================= the ring ================= -->
	<g opacity={ringDim}>
		<circle cx={C.x} cy={C.y} r={R} fill="none" stroke="var(--stage-line)" stroke-width="2" />
		{#each Object.entries(arcs) as [key, d] (key)}
			<Flow
				{d}
				color="var(--stage-ink)"
				width={2.5}
				arrow
				dash={7}
				{t}
				speed={reduced ? 0 : 36}
				opacity={lerp(0.12, 0.85, clamp(arcEmph[key as Region]))}
			/>
		{/each}

		<!-- roads between the granum and the three docking points -->
		{#each stations as s, si (si)}
			<line
				x1={s.anchor.x}
				y1={s.anchor.y}
				x2={s.dock.x}
				y2={s.dock.y}
				stroke="var(--stage-line)"
				stroke-width="1"
				stroke-dasharray="2 4"
				opacity={0.8 * dimTo(arcEmph[s.region])}
			/>
		{/each}

		<!-- granum in the middle: where ATP and NADPH come from -->
		<g transform="translate({GRANUM.x} {GRANUM.y})" opacity="0.9">
			{#each [0, 1, 2, 3] as i (i)}
				<rect
					x="-24"
					y={-19 + i * 11}
					width="48"
					height="8"
					rx="4"
					fill="var(--membrane)"
					stroke="var(--membrane-edge)"
					stroke-width="1"
				/>
				<rect x="-19" y={-17 + i * 11} width="38" height="4" rx="2" fill="var(--lumen)" />
			{/each}
		</g>
		<Label x={C.x} y={244} text="Calvin cycle" size={15} weight={600} />
		<Label x={C.x} y={261} text="ATP & NADPH from the thylakoids" size={11} muted />
		<Label x={C.x} y={275} text="ADP, Pi and NADP⁺ go back" size={11} muted />

		<!-- what rides each stretch of the ring -->
		<Label
			x={at(0.0417, 140).x}
			y={at(0.0417, 140).y + 4}
			text="3 RuBP · 5C"
			size={11}
			muted
			opacity={dimTo(arcEmph.fix)}
		/>
		<!-- sits between the granum captions and the ADP lane of the first road -->
		<Label x={515} y={300} text="6 × 3-PGA · 3C" size={11} muted opacity={dimTo(arcEmph.red)} />
		<Label
			x={at(0.6, 142).x}
			y={at(0.6, 142).y + 4}
			text="6 × G3P · 3C"
			size={11}
			muted
			opacity={dimTo(arcEmph.red)}
		/>
		<Label
			x={at(0.75, 130).x}
			y={at(0.75, 130).y + 4}
			text="5 G3P"
			size={11}
			muted
			opacity={dimTo(arcEmph.reg)}
		/>
		<Label
			x={at(0.93, 138).x}
			y={at(0.93, 138).y + 4}
			text="→ 3 RuBP"
			size={11}
			muted
			opacity={dimTo(arcEmph.reg)}
		/>

		<!-- RuBisCO on the ring at one o'clock -->
		<g
			transform="translate({RUBISCO.x} {RUBISCO.y}) scale({1 + 0.025 * Math.sin(t * 1.7)})"
			opacity={dimTo(arcEmph.fix)}
		>
			<path
				d={rubiscoPath}
				fill={colors.rubisco}
				stroke="#2f6b4d"
				stroke-width="1.5"
				stroke-linejoin="round"
				filter="url(#soft-shadow)"
			/>
			{#each [[-11, -11], [11, -11], [-11, 11], [11, 11]] as [dx, dy], i (i)}
				<circle cx={dx} cy={dy} r="9" fill="#fff" opacity="0.16" />
			{/each}
			{#each [[0, -21], [21, 0], [0, 21], [-21, 0]] as [dx, dy], i (i)}
				<circle cx={dx} cy={dy} r="5" fill="#fff" opacity="0.12" />
			{/each}
		</g>
		<Label
			x={RUBISCO.x + 44}
			y={RUBISCO.y + 12}
			text="RuBisCO"
			anchor="start"
			size={13}
			weight={600}
			opacity={dimTo(arcEmph.fix)}
		/>
		<!-- anchored at its end so that it stays inside the stroma panel (x ≤ 620) -->
		<Label
			x={612}
			y={80}
			text="3 CO₂ in"
			anchor="end"
			size={11}
			muted
			opacity={dimTo(arcEmph.fix)}
		/>

		<!-- the molecules on the ring -->
		{#each frame.chains as c (c.id)}
			{#if c.flash}
				<circle
					cx={c.x}
					cy={c.y}
					r="26"
					fill={colors.phosphate}
					opacity={0.35 * flash * dimTo(arcEmph.fix) * cut.current}
					filter="url(#glow)"
				/>
			{/if}
			<Molecule
				kind="sugar"
				carbons={c.carbons}
				phosphates={c.phosphates}
				{compact}
				x={c.x}
				y={c.y}
				rotate={compact ? 0 : c.rotate}
				scale={0.72}
				opacity={c.opacity * (c.flash ? flash : 1) * dimTo(arcEmph[c.region]) * cut.current}
			/>
		{/each}
		{#each frame.pills as p (p.id)}
			<Molecule
				kind={p.kind}
				x={p.x}
				y={p.y}
				rotate={p.rotate}
				scale={p.kind === 'CO2' ? 0.8 : 0.78}
				opacity={p.opacity * dimTo(arcEmph[p.region]) * cut.current}
			/>
		{/each}
	</g>

	<!-- ================= headings & callouts ================= -->
	{#snippet heading(x: number, y: number, text: string, w: number)}
		<Label
			{x}
			{y}
			{text}
			anchor="start"
			size={13}
			weight={600}
			pill
			opacity={lerp(0.6, 1, clamp(w))}
		/>
	{/snippet}
	{@render heading(300, 72, '1 · Carbon fixation', arcEmph.fix)}
	<Label
		x={300}
		y={96}
		text="RuBP + CO₂ → unstable 6C → 2 × 3-PGA"
		anchor="start"
		size={12}
		opacity={e.fix}
	/>
	{@render heading(216, 540, '2 · Reduction', arcEmph.red)}
	<Label
		x={216}
		y={563}
		text="3-PGA + ATP + NADPH → G3P"
		anchor="start"
		size={12}
		opacity={e.red}
	/>
	{@render heading(36, 240, '3 · Regeneration', arcEmph.reg)}
	<Label x={36} y={264} text="5 G3P → 3 RuBP · 15 C" anchor="start" size={12} opacity={e.reg} />
	<Label x={36} y={282} text="costs 3 more ATP" anchor="start" size={11} muted opacity={e.reg} />

	<!-- ================= export: G3P → sugars ================= -->
	<g opacity={exitEmph}>
		<Flow
			d={pathFrom(exitPath)}
			color={colors.sugarEdge}
			width={2}
			arrow
			dash={6}
			{t}
			speed={reduced ? 0 : 30}
			opacity={0.7}
		/>
		<Label x={548} y={519} text="1 G3P out → sugars" size={12} />
	</g>
	{#if frame.exported}
		<Molecule
			kind="sugar"
			carbons={3}
			phosphates={1}
			{compact}
			x={frame.exported.x}
			y={frame.exported.y}
			rotate={compact ? 0 : frame.exported.rotate}
			scale={0.72}
			opacity={frame.exported.opacity * exitEmph * cut.current}
		/>
	{/if}

	<g opacity={sugarEmph}>
		<!-- junction: two G3P become one glucose -->
		{#each branches as b, j (j)}
			<Flow
				d={pathFrom(b)}
				color={colors.sugarEdge}
				width={1.5}
				arrow
				dash={5}
				{t}
				speed={reduced ? 0 : 24}
				opacity={0.55}
			/>
			{@const v = cycle(t, 7, j / 3 + 0.3)}
			{@const pt = along(b, v)}
			<!-- small glucose units on their way: always beads (a pill this small is unreadable) -->
			<Molecule
				kind="sugar"
				carbons={6}
				x={pt.x}
				y={pt.y}
				scale={0.5}
				opacity={fadeBranch(v) * cut.current}
			/>
		{/each}
		<Molecule
			kind="sugar"
			carbons={6}
			{compact}
			x={J.x}
			y={J.y}
			scale={0.75 + 0.12 * frame.arrive}
		/>
		<Label x={J.x} y={404} text="2 G3P → glucose (6C)" size={12} pill />

		<!-- starch grain inside a tiny chloroplast -->
		<ellipse
			cx={STARCH.x}
			cy={STARCH.y}
			rx="44"
			ry="26"
			fill="var(--stroma)"
			stroke="var(--protein-edge)"
			stroke-width="1.5"
		/>
		{#each [0, 1, 2] as i (i)}
			<rect
				x={STARCH.x - 34}
				y={STARCH.y - 8 + i * 6}
				width="22"
				height="4"
				rx="2"
				fill="var(--membrane)"
				stroke="var(--membrane-edge)"
				stroke-width="0.8"
			/>
		{/each}
		<ellipse
			cx={STARCH.x + 14}
			cy={STARCH.y + 3}
			rx={starchR}
			ry="9"
			fill="var(--surface)"
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
		<!-- captions to the left of the grain: its branch arrives from below -->
		<Label x={STARCH.x - 52} y={318} text="starch grain" anchor="end" size={12} />
		<Label
			x={STARCH.x - 52}
			y={333}
			text="stored in the chloroplast"
			anchor="end"
			size={11}
			muted
		/>

		<!-- sucrose in a phloem tube -->
		<rect
			x={PHLOEM.x}
			y={PHLOEM.y}
			width={PHLOEM.w}
			height={PHLOEM.h}
			rx="6"
			fill="var(--lumen)"
			stroke="var(--protein-edge)"
			stroke-width="1.2"
		/>
		{#each [846, 876] as sx (sx)}
			<line
				x1={sx}
				y1={PHLOEM.y + 2}
				x2={sx}
				y2={PHLOEM.y + PHLOEM.h - 2}
				stroke="var(--protein-edge)"
				stroke-width="1"
				stroke-dasharray="2 2"
			/>
		{/each}
		{#each [0, 1] as i (i)}
			{@const v = cycle(t, 3.4, i / 2)}
			{@const sx = lerp(PHLOEM.x + 6, PHLOEM.x + PHLOEM.w - 6, v)}
			<g transform="translate({sx} {PHLOEM.y + PHLOEM.h / 2})" opacity={fadeEnds(v) * cut.current}>
				<line x1="-5" y1="0" x2="5" y2="0" stroke={colors.sugarEdge} stroke-width="2" />
				<circle cx="-5" r="4.2" fill={colors.sugar} stroke={colors.sugarEdge} stroke-width="1" />
				<circle cx="5" r="4.2" fill={colors.sugar} stroke={colors.sugarEdge} stroke-width="1" />
			</g>
		{/each}
		<Label x={STARCH.x} y={462} text="sucrose → phloem" size={12} />
		<Label x={STARCH.x} y={477} text="to roots, fruits, growing tips" size={11} muted />

		<!-- cellulose: a fragment of cell wall -->
		<rect
			x={WALL.x}
			y={WALL.y}
			width={WALL.w}
			height={WALL.h}
			rx="5"
			fill="var(--cell)"
			stroke="var(--stage-line)"
			stroke-width="1.2"
		/>
		{#each [0, 1, 2] as row (row)}
			{@const y = WALL.y + 8 + row * 9}
			{@const x0 = WALL.x + 8 + (row % 2) * 5}
			<line
				x1={x0}
				y1={y}
				x2={x0 + 70}
				y2={y}
				stroke={colors.sugarEdge}
				stroke-width="1.5"
				opacity="0.8"
			/>
			{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
				<circle
					cx={x0 + i * 10}
					cy={y}
					r="3"
					fill={colors.sugar}
					stroke={colors.sugarEdge}
					stroke-width="0.8"
				/>
			{/each}
		{/each}
		<Label x={STARCH.x} y={561} text="cellulose · cell walls" size={12} />
		<Label x={STARCH.x} y={576} text="also fats, amino acids, fuel" size={11} muted />
	</g>

	<!-- ================= ledger ================= -->
	<rect
		x={LEDGER.x}
		y={LEDGER.y}
		width={LEDGER.w}
		height={LEDGER.h}
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Label
		x={LEDGER.x + 14}
		y={LEDGER.y + 25}
		text="Carbon bookkeeping · 3 CO₂ → 1 G3P"
		anchor="start"
		size={13}
		weight={600}
	/>
	<line
		x1={LEDGER.x + 14}
		y1={LEDGER.y + 36}
		x2={LEDGER.x + LEDGER.w - 14}
		y2={LEDGER.y + 36}
		stroke="var(--border)"
	/>
	<line
		x1={LEDGER.x + 14}
		y1={lineY(COST_ROW) - 15.5}
		x2={LEDGER.x + LEDGER.w - 14}
		y2={lineY(COST_ROW) - 15.5}
		stroke="var(--border)"
	/>
	{#each LINES as line, i (i)}
		{@const h = clamp(hi.current[i] ?? 0)}
		<rect
			x={LEDGER.x + 7}
			y={lineY(i) - 15}
			width={LEDGER.w - 14}
			height="21"
			rx="5"
			fill={colors.rubisco}
			opacity={0.2 * h}
		/>
		<Label
			x={LEDGER.x + 14}
			y={lineY(i)}
			text={line.text}
			anchor="start"
			size={12}
			weight={h > 0.5 ? 600 : 500}
			opacity={lerp(0.62, 1, h)}
		/>
	{/each}
</g>
