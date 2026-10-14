<script lang="ts">
	/**
	 * Steps "equation" and "summary": the whole journey of one glucose in one
	 * picture. A cell's cytosol on the left (glycolysis), a mitochondrion on
	 * the right with its matrix (citric acid cycle) and a crista of the inner
	 * membrane (electron transport chain and ATP synthase). One glucose comes
	 * in on a loop: it splits into two pyruvate, they enter the mitochondrion,
	 * CO₂ leaves, NADH carries electrons to the membrane, O₂ comes in and
	 * leaves as water, ATP comes out of each stage in the numbers of the model.
	 *
	 * Phase "overview" adds, at the bottom, the takeaway as an energy sketch:
	 * a flame releases glucose's energy in one drop, as heat; a cell in many
	 * small steps, some of them caught as ATP. Phase "summary" has the oxygen
	 * switch (`params['oxygen-cell']`): without it the mitochondrion stops,
	 * pyruvate becomes lactate in the cytosol and the yield drops to 2 ATP.
	 */
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import {
		Molecule,
		Label,
		Flow,
		along,
		smooth,
		smoothstep,
		lerp,
		cycle,
		polar,
		pathFrom,
		TAU,
		type Point
	} from '#lib/draw/index.ts';
	import Carrier from '../Carrier.svelte';
	import { CHAIN } from '../colors';
	import { FERMENTATION_ATP, STAGES, atpYield } from '../model';

	let { step, t, params, reduced }: StageProps = $props();
	const phase = $derived(String(step.hints?.phase ?? 'overview'));
	const oxygen = $derived(phase !== 'summary' || params['oxygen-cell'] !== false);
	const aerobic = Tween.of(() => (oxygen ? 1 : 0), { duration: 900, easing: cubicInOut });
	const ox = $derived(aerobic.current);

	const yieldLo = atpYield('measured', 'glycerol').total;
	const yieldHi = atpYield('measured', 'malate').total;
	const chainLo = yieldLo - STAGES.glycolysis.atp - STAGES.cycle.atp;
	const chainHi = yieldHi - STAGES.glycolysis.atp - STAGES.cycle.atp;

	// ---- geometry ----------------------------------------------------------------
	const CELL = { x: 24, y: 64, w: 912, h: 380 };
	const MITO = { cx: 640, cy: 254, rx: 270, ry: 158 };
	const WHEEL = { x: 560, y: 254, r: 46 };
	const CRISTA = { x: 790 };
	const GLY = { x: 190, y: 254 };

	const PERIOD = 10;
	/** One glucose's journey: 0–0.25 glycolysis, 0.25–0.45 into the matrix, 0.45–1 burned. */
	const u = $derived(reduced ? 0.62 : cycle(t, PERIOD));
	const fade = (v: number) => smoothstep(0, 0.12, v) * (1 - smoothstep(0.88, 1, v));
	const seg = (a: number, b: number) => (u - a) / (b - a);
	const glucoseIn = smooth([
		{ x: 50, y: 254 },
		{ x: 110, y: 254 },
		{ x: GLY.x - 40, y: 254 }
	]);
	const pyrIn = [
		smooth([
			{ x: GLY.x + 40, y: 236 },
			{ x: 330, y: 226 },
			{ x: 420, y: 236 },
			{ x: WHEEL.x - 60, y: 246 }
		]),
		smooth([
			{ x: GLY.x + 40, y: 272 },
			{ x: 330, y: 282 },
			{ x: 420, y: 272 },
			{ x: WHEEL.x - 60, y: 262 }
		])
	];
	const lactateOut = [
		smooth([
			{ x: GLY.x + 40, y: 236 },
			{ x: 250, y: 190 },
			{ x: 260, y: 120 }
		]),
		smooth([
			{ x: GLY.x + 40, y: 272 },
			{ x: 250, y: 318 },
			{ x: 260, y: 392 }
		])
	];
	const co2Out: Point[][] = [0, 1, 2].map((k) =>
		smooth([
			{ x: WHEEL.x + (k - 1) * 22, y: WHEEL.y - WHEEL.r },
			{ x: WHEEL.x + (k - 1) * 40, y: 120 },
			{ x: WHEEL.x + (k - 1) * 70, y: 40 }
		])
	);
	const nadhPath = smooth([
		{ x: WHEEL.x + WHEEL.r + 6, y: WHEEL.y },
		{ x: 680, y: 236 },
		{ x: CRISTA.x - 30, y: 226 }
	]);
	const o2In = smooth([
		{ x: 930, y: 120 },
		{ x: 870, y: 160 },
		{ x: CRISTA.x + 20, y: 210 }
	]);
	const h2oOut = smooth([
		{ x: CRISTA.x + 20, y: 300 },
		{ x: 870, y: 360 },
		{ x: 930, y: 400 }
	]);
	// Inner membrane: an ellipse with two cristae folding in from the right.
	const innerD = (() => {
		const pts: Point[] = [];
		for (let i = 0; i <= 72; i++) {
			const a = (i / 72) * TAU;
			pts.push({
				x: MITO.cx + (MITO.rx - 22) * Math.cos(a),
				y: MITO.cy + (MITO.ry - 20) * Math.sin(a)
			});
		}
		return pathFrom(pts) + ' Z';
	})();
	const cristaD = `M${CRISTA.x + 60} ${MITO.cy - 120} C ${CRISTA.x - 10} ${MITO.cy - 110}, ${CRISTA.x - 20} ${MITO.cy - 40}, ${CRISTA.x} ${MITO.cy} C ${CRISTA.x + 20} ${MITO.cy + 40}, ${CRISTA.x - 10} ${MITO.cy + 110}, ${CRISTA.x + 60} ${MITO.cy + 120}`;
	const wheelTurn = $derived(reduced ? 0.5 : (t / 4) % 1);
	const head = $derived(polar(WHEEL.x, WHEEL.y, WHEEL.r, wheelTurn * TAU));

	// ATP popping out of each stage, as the glucose passes.
	const atpPops = $derived([
		{ id: 'gly', at: 0.2, x: GLY.x, y: 300, n: STAGES.glycolysis.atp, on: 1 },
		{ id: 'cac', at: 0.6, x: WHEEL.x, y: WHEEL.y + WHEEL.r + 24, n: STAGES.cycle.atp, on: ox },
		{ id: 'etc', at: 0.75, x: CRISTA.x - 104, y: MITO.cy + 36, n: 0, on: ox }
	]);
	const popO = (at: number) =>
		reduced ? 1 : smoothstep(at, at + 0.05, u) * (1 - smoothstep(0.92, 0.99, u));
</script>

<g class="map-scene">
	<!-- the overall equation -->
	<Readout id="eq">
		<Label
			x={480}
			y={34}
			text="C₆H₁₂O₆ + 6 O₂  →  6 CO₂ + 6 H₂O   (+ {yieldLo}–{yieldHi} ATP and heat)"
			size={15}
			weight={700}
			pill
		/>
	</Readout>

	<!-- cell and mitochondrion -->
	<rect
		x={CELL.x}
		y={CELL.y}
		width={CELL.w}
		height={CELL.h}
		rx="34"
		fill="var(--cell)"
		stroke="var(--membrane-edge)"
		stroke-width="1.5"
	/>
	<g opacity={lerp(0.45, 1, ox)}>
		<ellipse
			cx={MITO.cx}
			cy={MITO.cy}
			rx={MITO.rx}
			ry={MITO.ry}
			fill="var(--ra-ims)"
			stroke="var(--membrane-edge)"
			stroke-width="2"
		/>
		<path d={innerD} fill="var(--ra-matrix)" stroke="var(--membrane-edge)" stroke-width="2" />
		<path
			d={cristaD}
			fill="none"
			stroke="var(--membrane)"
			stroke-width="16"
			stroke-linecap="round"
		/>
		<path d={cristaD} fill="none" stroke="var(--membrane-edge)" stroke-width="1" />
		<!-- the chain on the crista: I, III, IV and ATP synthase -->
		{#each [{ c: CHAIN.I, dy: -84 }, { c: CHAIN.III, dy: -54 }, { c: CHAIN.IV, dy: -24 }] as b (b.dy)}
			<rect
				x={CRISTA.x - 26 + (b.dy + 84) * 0.12}
				y={MITO.cy + b.dy}
				width="20"
				height="22"
				rx="5"
				fill={b.c}
			/>
		{/each}
		<circle cx={CRISTA.x - 16} cy={MITO.cy + 54} r="13" fill={CHAIN.synthase} />
		<line
			x1={CRISTA.x - 4}
			y1={MITO.cy + 54}
			x2={CRISTA.x + 6}
			y2={MITO.cy + 54}
			stroke={CHAIN.synthase}
			stroke-width="5"
		/>

		<!-- the citric acid cycle -->
		<circle
			cx={WHEEL.x}
			cy={WHEEL.y}
			r={WHEEL.r}
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
		/>
		<circle cx={head.x} cy={head.y} r="6" fill="#10b981" />
	</g>

	<!-- stage names -->
	<Readout
		id="s1"
		order={1}
		label="1 Glycolysis (cytosol)"
		value="{STAGES.glycolysis.atp} ATP, {STAGES.glycolysis.nadh} NADH"
	>
		<Label x={GLY.x} y={GLY.y - 66} text="① glycolysis" weight={700} />
		<Label x={GLY.x} y={GLY.y - 50} text="cytosol" size={11} muted />
		<Label x={GLY.x} y={GLY.y - 30} text="glucose → 2 pyruvate" size={11} muted />
	</Readout>
	<Readout
		id="s2"
		order={2}
		label="2 Citric acid cycle (matrix)"
		value="{STAGES.cycle.atp} ATP, {STAGES.link.nadh + STAGES.cycle.nadh} NADH, {STAGES.cycle
			.fadh2} FADH₂, 6 CO₂"
		opacity={ox}
	>
		<Label x={WHEEL.x} y={WHEEL.y - 4} text="②" weight={700} opacity={lerp(0.45, 1, ox)} />
		<Label
			x={WHEEL.x}
			y={WHEEL.y + 12}
			text="citric acid"
			size={10}
			muted
			opacity={lerp(0.45, 1, ox)}
		/>
		<Label x={WHEEL.x} y={WHEEL.y + 24} text="cycle" size={10} muted opacity={lerp(0.45, 1, ox)} />
	</Readout>
	<Readout
		id="s3"
		order={3}
		label="3 Chain and ATP synthase (inner membrane)"
		value="≈ {chainLo}–{chainHi} ATP"
		opacity={ox}
	>
		<Label
			x={CRISTA.x - 20}
			y={MITO.cy + 98}
			text="③ chain + ATP synthase"
			weight={700}
			anchor="end"
			opacity={lerp(0.45, 1, ox)}
		/>
		<Label
			x={CRISTA.x - 20}
			y={MITO.cy + 114}
			text="inner membrane"
			size={11}
			muted
			anchor="end"
			opacity={lerp(0.45, 1, ox)}
		/>
	</Readout>
	<Readout id="mito">
		<Label
			x={MITO.cx}
			y={MITO.cy + MITO.ry + 18}
			text="mitochondrion"
			size={12}
			weight={600}
			opacity={lerp(0.45, 1, ox)}
		/>
	</Readout>

	<!-- ================= one glucose's journey ================= -->
	{#if u < 0.2}
		{@const v = seg(0, 0.2)}
		{@const p = along(glucoseIn, v)}
		<Molecule kind="sugar" x={p.x} y={p.y} carbons={6} opacity={fade(v) * 1} />
	{/if}
	{#if u >= 0.2 && u < 0.5}
		{@const v = seg(0.2, 0.5)}
		{#each [0, 1] as k (k)}
			{#if ox > 0.5}
				{@const p = along(pyrIn[k], v)}
				<Molecule kind="sugar" x={p.x} y={p.y} carbons={3} opacity={fade(v) * ox} />
			{:else}
				{@const p = along(lactateOut[k], v)}
				<Molecule kind="sugar" x={p.x} y={p.y} carbons={3} opacity={fade(v) * (1 - ox)} />
				{#if k === 0}
					<Label
						x={p.x + 30}
						y={p.y + 4}
						text="lactate"
						size={11}
						anchor="start"
						opacity={fade(v) * (1 - ox)}
					/>
				{/if}
			{/if}
		{/each}
	{/if}
	<!-- burning in the mitochondrion -->
	<g opacity={ox}>
		{#if u >= 0.5}
			{@const v = seg(0.5, 1)}
			{#each co2Out as path, k (k)}
				{@const w = (v * 3 - k * 0.4) % 1}
				{#if w > 0}
					{@const p = along(path, w)}
					<Molecule kind="CO2" x={p.x} y={p.y} opacity={fade(w)} scale={0.85} />
				{/if}
			{/each}
			{#each [0, 1, 2] as k (k)}
				{@const w = (v * 2.4 - k * 0.3) % 1}
				{#if w > 0}
					{@const p = along(nadhPath, w)}
					<Carrier kind="NADH" x={p.x} y={p.y} opacity={fade(w)} scale={0.8} />
				{/if}
			{/each}
			{@const wo = (v * 2) % 1}
			{@const po = along(o2In, wo)}
			<Molecule kind="O2" x={po.x} y={po.y} opacity={fade(wo)} scale={0.85} />
			{@const pw = along(h2oOut, wo)}
			<Molecule kind="H2O" x={pw.x} y={pw.y} opacity={fade(wo)} scale={0.85} />
		{/if}
		<Flow d={pathFrom(nadhPath)} width={1} dash={3} {t} speed={16} opacity={0.4} />
	</g>

	<!-- ATP from each stage -->
	{#each atpPops as a (a.id)}
		{#if a.id === 'etc'}
			<g opacity={popO(a.at) * a.on}>
				<Molecule kind="ATP" x={a.x - 6} y={a.y + 4} />
				<Label
					x={a.x + 18}
					y={a.y + 8}
					text="× {chainLo}–{chainHi}"
					anchor="start"
					size={12}
					weight={700}
				/>
			</g>
		{:else}
			<g opacity={popO(a.at) * a.on}>
				<Molecule kind="ATP" x={a.x} y={a.y} />
				<Label x={a.x + 24} y={a.y + 4} text="× {a.n}" anchor="start" size={12} weight={700} />
			</g>
		{/if}
	{/each}

	<!-- ================= bottom strip ================= -->
	{#if phase === 'overview'}
		<!-- the takeaway: one drop as heat, or many small steps caught as ATP -->
		<Readout id="card1">
			<rect
				x="24"
				y="458"
				width="912"
				height="126"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
		</Readout>
		<Readout
			id="flame"
			order={4}
			label="Flame or cell"
			value="a flame frees it all at once, as heat; a cell in small steps, many caught as ATP"
		>
			<text x="44" y="480" font-size="12" font-weight="600">in a flame: all at once, as heat</text>
			<path
				d="M60 496 H150 V568 H250"
				fill="none"
				stroke="#e8590c"
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<Label x={196} y={524} text="≈ 2,800 kJ/mol, all as heat" size={11} anchor="start" muted />
		</Readout>
		<Readout id="cell">
			<text x="480" y="480" font-size="12" font-weight="600"
				>in a cell: small steps, many caught as ATP</text
			>
			{@const stairs = Array.from({ length: 12 }, (_, i) => i)}
			<path
				d={'M480 496 ' +
					stairs.map((i) => `H${500 + i * 34} V${496 + (i + 1) * 6}`).join(' ') +
					' H900'}
				fill="none"
				stroke="#10b981"
				stroke-width="3"
				stroke-linejoin="round"
			/>
			{#each [2, 5, 8, 10, 11] as i (i)}
				<Molecule kind="ATP" x={514 + i * 34} y={496 + (i + 1) * 6 + 22} scale={0.7} />
			{/each}
		</Readout>
	{:else}
		<Readout id="card2">
			<rect
				x="24"
				y="458"
				width="912"
				height="126"
				rx="12"
				fill="var(--surface)"
				stroke="var(--border)"
			/>
		</Readout>
		<Readout
			id="yield"
			order={4}
			label="ATP per glucose"
			value={oxygen ? `${yieldLo}–${yieldHi}` : `${FERMENTATION_ATP} (fermentation)`}
		>
			<text x="44" y="490" font-size="13" font-weight="600">ATP per glucose</text>
			<text x="916" y="494" font-size="24" font-weight="800" text-anchor="end" fill="#f97316"
				>{oxygen ? `${yieldLo}–${yieldHi}` : FERMENTATION_ATP}</text
			>
			<text x="44" y="520" font-size="12" class="muted"
				>{oxygen
					? `glycolysis ${STAGES.glycolysis.atp} + citric acid cycle ${STAGES.cycle.atp} + chain and ATP synthase ${chainLo}–${chainHi}`
					: `glycolysis only: pyruvate becomes lactate to give back NAD⁺`}</text
			>
		</Readout>
		<Readout id="o2state">
			<text x="44" y="556" font-size="12" class="muted"
				>{oxygen
					? 'energy released in small steps → proton gradient → rotating ATP synthase'
					: 'no oxygen: the chain backs up, the citric acid cycle stops, the cell burns glucose 16 times faster for the same ATP'}</text
			>
		</Readout>
	{/if}
</g>
