<script lang="ts">
	/**
	 * Steps 12–15: the Calvin cycle, drawn as a ring in the stroma.
	 *
	 * A cohort of three RuBP molecules goes round once every 16 s: each one
	 * meets a CO₂ at RuBisCO (one o'clock), flashes as an unstable 6-carbon
	 * intermediate and splits into two 3-PGA that ride the ring as a pair. In
	 * the reduction arc ATP and NADPH arrive from the granum in the middle and
	 * leave as ADP, Pi and NADP⁺, turning the pair into G3P. At six o'clock one
	 * G3P leaves the ring and follows a path to the right, where two G3P make
	 * a glucose that is sent on to starch, sucrose or cellulose. The other five
	 * G3P are rebuilt into RuBP in the regeneration arc (three more ATP). A
	 * ledger on the right keeps the carbon bookkeeping.
	 *
	 * `step.hints.phase` (fixation | reduction | regeneration | export) decides
	 * what is emphasised and where in the cycle the cohort starts, so that each
	 * step shows its own stage within the first seconds. `params.carbons`
	 * switches between carbon-bead chains and compact labelled pills.
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
	$effect(() => {
		const target = EMPH[phase] ?? EMPH.fixation;
		const duration = reduced ? 0 : 800;
		// untrack: the tween's own state must not re-trigger this effect
		untrack(() => emph.set({ ...target }, { duration }));
	});
	const e = $derived(emph.current);
	/** Emphasis per arc; in the export step the whole ring stays half lit. */
	const arcEmph = $derived<Record<Region, number>>({
		fix: e.fix + 0.5 * e.exp,
		red: e.red + 0.5 * e.exp,
		reg: e.reg + 0.5 * e.exp
	});
	const DIM = 0.45;
	const dimTo = (w: number) => lerp(DIM, 1, clamp(w));

	// ---- ring geometry --------------------------------------------------------
	const C = { x: 400, y: 310 };
	const R = 185;
	/** Half the distance between the two lanes a 3-PGA/G3P pair rides on. */
	const LANE = 14;
	/** Ring parameter s ∈ [0, 1): 0 at eleven o'clock, clockwise. */
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
	const SPACING = 0.06;
	const S_RUBISCO = 1 / 6; // one o'clock
	const FLASH = 0.03;
	const SPLIT = 0.035;
	const S_ATP1 = 0.4;
	const S_NADPH = 0.48;
	const S_EXIT = 7 / 12; // six o'clock
	const S_ATP2 = 0.82;
	const REGROUP: [number, number] = [0.86, 0.94];
	const CARRIER = 0.06;
	const CO2_LEAD = 0.09;
	const EXIT_TRAVEL = 0.16;
	/** Where the cohort starts for each step, so the step's stage shows at once. */
	const OFFSET: Record<string, number> = {
		fixation: 0.02,
		reduction: 0.31,
		regeneration: 0.572,
		export: 0.565
	};
	const u = $derived(cycle(t, PERIOD, OFFSET[phase] ?? 0));
	const flash = $derived(0.55 + 0.45 * Math.sin(t * 36));

	const RUBISCO = at(S_RUBISCO);
	const CO2_SRC = { x: 604, y: 94 };
	const CO2_MID = { x: 566, y: 100 };
	const GRANUM = { x: 400, y: 308 };
	const G_IN = { x: GRANUM.x - 26, y: GRANUM.y };
	const G_OUT = { x: GRANUM.x + 26, y: GRANUM.y };

	// ---- export side ------------------------------------------------------------
	const J = { x: 712, y: 440 }; // where two G3P become glucose
	const exitPath = smooth([
		at(S_EXIT, R + LANE),
		{ x: 470, y: 542 },
		{ x: 560, y: 553 },
		{ x: 640, y: 520 },
		{ x: 690, y: 466 },
		{ x: J.x - 2, y: J.y + 4 }
	]);
	const STARCH = { x: 868, y: 322 };
	const PHLOEM = { x: 826, y: 419, w: 88, h: 22 };
	const WALL = { x: 826, y: 506, w: 88, h: 34 };
	const branches = [
		smooth([
			{ x: 740, y: 434 },
			{ x: 800, y: 426 },
			{ x: 838, y: 392 },
			{ x: 850, y: 352 }
		]),
		smooth([
			{ x: 740, y: 440 },
			{ x: 780, y: 436 },
			{ x: 822, y: 430 }
		]),
		smooth([
			{ x: 740, y: 446 },
			{ x: 790, y: 470 },
			{ x: 826, y: 500 },
			{ x: 848, y: 506 }
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
	type PillKind = 'CO2' | 'ATP' | 'ADP' | 'NADPH' | 'NADP+' | 'Pi';
	interface Pill {
		id: string;
		kind: PillKind;
		x: number;
		y: number;
		rotate: number;
		opacity: number;
		region: Region;
	}
	interface Carrier {
		at: number;
		kind: PillKind;
		spent: PillKind[];
		n: number;
	}
	const CARRIERS: Carrier[] = [
		{ at: S_ATP1, kind: 'ATP', spent: ['ADP'], n: 2 },
		{ at: S_NADPH, kind: 'NADPH', spent: ['NADP+', 'Pi'], n: 2 },
		{ at: S_ATP2, kind: 'ATP', spent: ['ADP'], n: 1 }
	];
	const regionOf = (p: number): Region => (p < S_3 ? 'fix' : p < S_8 ? 'red' : 'reg');
	const fadeEnds = (v: number) => smoothstep(0, 0.08, v) * (1 - smoothstep(0.9, 1, v));

	const frame = $derived.by(() => {
		const chains: Chain[] = [];
		const pills: Pill[] = [];
		let exported: { x: number; y: number; rotate: number; opacity: number } | null = null;
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
				const phosphates = p < S_ATP1 ? 1 : p < S_NADPH ? 2 : 1;
				const regroup = smoothstep(REGROUP[0], REGROUP[1], p);
				if (regroup < 1) {
					for (const lane of [-1, 1]) {
						// one of the six G3P leaves the cycle at six o'clock
						if (k === 0 && lane === 1 && p >= S_EXIT) continue;
						const pt = at(p, R + lane * LANE * split);
						chains.push({
							id: `${k}-pga${lane}`,
							x: pt.x,
							y: pt.y,
							rotate: rot,
							carbons: 3,
							phosphates,
							opacity: 1 - regroup,
							flash: false,
							region
						});
					}
				}
				if (regroup > 0) {
					chains.push({
						id: `${k}-rubp`,
						...here,
						rotate: rot,
						carbons: 5,
						phosphates: 2,
						opacity: regroup,
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

			// -- ATP / NADPH arriving from the granum, spent carriers going back
			for (const c of CARRIERS) {
				const T = at(c.at);
				const reg = regionOf(c.at);
				const vin = (p - (c.at - CARRIER)) / CARRIER;
				if (vin >= 0 && vin < 1) {
					const w = easeInOut(vin);
					for (let i = 0; i < c.n; i++) {
						pills.push({
							id: `${k}-${c.at}-in${i}`,
							kind: c.kind,
							x: lerp(G_IN.x, T.x, w) + i * 7,
							y: lerp(G_IN.y, T.y, w) + i * 9,
							rotate: 0,
							opacity: smoothstep(0, 0.2, vin),
							region: reg
						});
					}
				}
				const vout = (p - c.at) / CARRIER;
				if (vout >= 0 && vout < 1) {
					const w = easeInOut(vout);
					c.spent.forEach((kind, j) => {
						for (let i = 0; i < c.n; i++) {
							pills.push({
								id: `${k}-${c.at}-out${j}${i}`,
								kind,
								x: lerp(T.x, G_OUT.x, w) + i * 7 + j * 18,
								y: lerp(T.y, G_OUT.y, w) + i * 9 - j * 14,
								rotate: 0,
								opacity: 1 - smoothstep(0.75, 1, vout),
								region: reg
							});
						}
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
			}
		}
		return { chains, pills, exported };
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
		{ text: 'per G3P: 9 ATP + 6 NADPH', phases: ['regeneration'], cost: true },
		{ text: 'per glucose (2 G3P): 18 ATP + 12 NADPH', phases: ['export'], cost: true }
	];
	const LEDGER = { x: 650, y: 48, w: 290, h: 232 };
	const lineY = (i: number) => LEDGER.y + 52 + i * 22;
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
		<Label x={C.x} y={248} text="Calvin cycle" size={15} weight={600} />
		<Label x={C.x} y={265} text="ATP & NADPH from the thylakoids" size={11} muted />
		<Label x={C.x} y={279} text="ADP, Pi and NADP⁺ go back" size={11} muted />

		<!-- what rides each stretch of the ring -->
		<Label
			x={at(0.0417, 140).x}
			y={at(0.0417, 140).y + 4}
			text="3 RuBP · 5C"
			size={11}
			muted
			opacity={dimTo(arcEmph.fix)}
		/>
		<Label
			x={at(0.36, 132).x}
			y={at(0.36, 132).y + 4}
			text="6 × 3-PGA · 3C"
			size={11}
			muted
			opacity={dimTo(arcEmph.red)}
		/>
		<Label
			x={at(0.5417, 138).x}
			y={at(0.5417, 138).y + 4}
			text="6 × G3P · 3C"
			size={11}
			muted
			opacity={dimTo(arcEmph.red)}
		/>
		<Label
			x={at(0.75, 138).x}
			y={at(0.75, 138).y + 4}
			text="5 G3P"
			size={11}
			muted
			opacity={dimTo(arcEmph.reg)}
		/>
		<Label
			x={at(0.903, 138).x}
			y={at(0.903, 138).y + 4}
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
			y={RUBISCO.y + 5}
			text="RuBisCO"
			anchor="start"
			size={13}
			weight={600}
			opacity={dimTo(arcEmph.fix)}
		/>
		<Label x={CO2_SRC.x} y={74} text="3 CO₂ in" size={11} muted opacity={dimTo(arcEmph.fix)} />

		<!-- the molecules on the ring -->
		{#each frame.chains as c (c.id)}
			{#if c.flash}
				<circle
					cx={c.x}
					cy={c.y}
					r="26"
					fill={colors.phosphate}
					opacity={0.35 * flash * dimTo(arcEmph.fix)}
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
				opacity={c.opacity * (c.flash ? flash : 1) * dimTo(arcEmph[c.region])}
			/>
		{/each}
		{#each frame.pills as p (p.id)}
			<Molecule
				kind={p.kind}
				x={p.x}
				y={p.y}
				rotate={p.rotate}
				scale={p.kind === 'CO2' ? 0.8 : 0.72}
				opacity={p.opacity * dimTo(arcEmph[p.region])}
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
	{@render heading(40, 240, '3 · Regeneration', arcEmph.reg)}
	<Label x={40} y={264} text="5 G3P → 3 RuBP · 15 C" anchor="start" size={12} opacity={e.reg} />
	<Label x={40} y={282} text="costs 3 more ATP" anchor="start" size={11} muted opacity={e.reg} />

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
		<Label x={548} y={579} text="1 G3P out → sugars" size={12} />
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
			opacity={frame.exported.opacity * exitEmph}
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
			<Molecule
				kind="sugar"
				carbons={6}
				{compact}
				x={pt.x}
				y={pt.y}
				scale={0.5}
				opacity={fadeEnds(v)}
			/>
		{/each}
		<Molecule kind="sugar" carbons={6} {compact} x={J.x} y={J.y} scale={0.75} />
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
		<Label x={STARCH.x} y={366} text="starch grain" size={12} />
		<Label x={STARCH.x} y={381} text="stored in the chloroplast" size={11} muted />

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
		{#each [856, 886] as sx (sx)}
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
			<g transform="translate({sx} {PHLOEM.y + PHLOEM.h / 2})" opacity={fadeEnds(v)}>
				<line x1="-5" y1="0" x2="5" y2="0" stroke={colors.sugarEdge} stroke-width="2" />
				<circle cx="-5" r="4.2" fill={colors.sugar} stroke={colors.sugarEdge} stroke-width="1" />
				<circle cx="5" r="4.2" fill={colors.sugar} stroke={colors.sugarEdge} stroke-width="1" />
			</g>
		{/each}
		<Label x={STARCH.x} y={462} text="sucrose → phloem" size={12} />
		<Label x={STARCH.x} y={477} text="to roots, fruits, shoots" size={11} muted />

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
	<text x={LEDGER.x + 14} y={LEDGER.y + 25} font-size="13" font-weight="600">
		Carbon bookkeeping · one turn
	</text>
	<line
		x1={LEDGER.x + 14}
		y1={LEDGER.y + 36}
		x2={LEDGER.x + LEDGER.w - 14}
		y2={LEDGER.y + 36}
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
		<text
			x={LEDGER.x + 14}
			y={lineY(i)}
			font-size="12"
			font-weight={h > 0.5 ? 600 : 500}
			opacity={lerp(0.62, 1, h)}
			fill={line.cost ? colors.atp : undefined}
		>
			{line.text}
		</text>
	{/each}
</g>
