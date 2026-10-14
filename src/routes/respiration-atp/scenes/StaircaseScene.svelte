<script lang="ts">
	/**
	 * Step "staircase": the chain as an energy diagram, the mirror of
	 * photosynthesis's Z-scheme. Vertical axis: midpoint redox potential
	 * (model `E`), high energy (negative) at the top. Treads: NADH (or
	 * succinate, for FADH₂), ubiquinone, cytochrome c, oxygen. Each drop is a
	 * complex, labelled with the free energy two electrons release there
	 * (`dropKJ`) and the protons it sends out (`PUMPED`). A pair of electrons
	 * walks down; the protons of each drop pop out as it passes. Bars at the
	 * bottom compare the whole drop, the share stored in the gradient at
	 * 180 mV and the value of one ATP. `params.source` picks NADH or FADH₂.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Molecule, Label, clamp, lerp, smoothstep, easeInOut } from '#lib/draw/index.ts';
	import { CHAIN } from '../colors';
	import { CARRIER } from '../colors';
	import { DG_ATP_CELL, E, PUMPED, dropKJ, protonKJ } from '../model';

	let { t, params, reduced }: StageProps = $props();
	const fad = $derived(params.source === 'fadh2');

	// ---- axes ---------------------------------------------------------------------
	const V_TOP = -0.45;
	const V_BOTTOM = 0.9;
	const Y_TOP = 64;
	const Y_BOTTOM = 452;
	const yOf = (v: number) => Y_TOP + ((v - V_TOP) / (V_BOTTOM - V_TOP)) * (Y_BOTTOM - Y_TOP);
	const ticks = [-0.4, 0, 0.4, 0.8].map((v) => ({
		v,
		y: yOf(v),
		text: v === 0 ? '0 V' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} V`
	}));
	const AX = 92;

	// ---- treads ---------------------------------------------------------------------
	interface Tread {
		id: string;
		label: string;
		v: number;
		x: number;
		color: string;
	}
	const treadsAll: Tread[] = [
		{ id: 'nadh', label: 'NADH', v: E.nad, x: 190, color: CARRIER.nadh },
		{ id: 'succ', label: 'FADH₂ (succinate)', v: E.succinate, x: 190, color: CARRIER.fadh2 },
		{ id: 'q', label: 'ubiquinone', v: E.q, x: 400, color: CHAIN.q },
		{ id: 'c', label: 'cytochrome c', v: E.cytc, x: 600, color: CHAIN.cytc },
		{ id: 'o2', label: 'O₂ → H₂O', v: E.o2, x: 800, color: '#e5484d' }
	];
	const treads = $derived(treadsAll.filter((d) => d.id !== (fad ? 'nadh' : 'succ')));
	const TW = 64; // half-width of a tread
	interface Drop {
		id: string;
		name: string;
		from: Tread;
		to: Tread;
		kj: number;
		h: number;
		color: string;
		/** How the protons are counted, where it is not simply pumping. */
		extra: string;
	}
	const drops = $derived.by<Drop[]>(() => {
		const [a, b, c, d] = treads;
		return [
			{
				id: 'one',
				name: fad ? 'complex II' : 'complex I',
				from: a,
				to: b,
				kj: dropKJ(a.v, b.v),
				h: fad ? PUMPED.II : PUMPED.I,
				color: fad ? CHAIN.II : CHAIN.I,
				extra: ''
			},
			{
				id: 'three',
				name: 'complex III',
				from: b,
				to: c,
				kj: dropKJ(b.v, c.v),
				h: PUMPED.III,
				color: CHAIN.III,
				extra: ' (2 brought by QH₂)'
			},
			{
				id: 'four',
				name: 'complex IV',
				from: c,
				to: d,
				kj: dropKJ(c.v, d.v),
				h: PUMPED.IV,
				color: CHAIN.IV,
				extra: ', 2 into water'
			}
		];
	});
	const totalKJ = $derived(dropKJ(treads[0].v, E.o2));
	const totalH = $derived(drops.reduce((s, d) => s + d.h, 0));
	const DP = 0.18;
	const storedKJ = $derived(totalH * protonKJ(DP));
	const atpKJ = -DG_ATP_CELL;
	/** Bar length per kJ/mol: the NADH pair's whole drop is 380 px. */
	const scale = 380 / dropKJ(E.nad, E.o2);

	// ---- the walking electron pair ----------------------------------------------------
	const PERIOD = 9;
	/** 0…3: progress over the three drops (each: walk the tread, then fall). */
	const prog = $derived(reduced ? 3 : clamp(((t % PERIOD) / (PERIOD - 1.5)) * 3, 0, 3));
	const pair = $derived.by(() => {
		const k = Math.min(2, Math.floor(prog));
		const u = prog - k;
		const d = drops[k];
		if (prog >= 3) return { x: d.to.x, y: yOf(d.to.v) - 10 };
		// walk to the tread's right end (first 40%), then slide down the drop
		if (u < 0.4) {
			const w = easeInOut(u / 0.4);
			return { x: lerp(d.from.x - TW / 2, d.from.x + TW, w), y: yOf(d.from.v) - 10 };
		}
		const w = easeInOut((u - 0.4) / 0.6);
		return { x: lerp(d.from.x + TW, d.to.x - TW, w), y: lerp(yOf(d.from.v), yOf(d.to.v), w) - 10 };
	});
	/** How far the protons of drop k have popped out (0 before the pair falls through). */
	const popped = (k: number) => smoothstep(k + 0.4, k + 1, prog);
	const reached = (k: number) => prog >= k + 0.99;
</script>

<g class="staircase-scene">
	<!-- axis -->
	<line x1={AX} y1={Y_TOP - 10} x2={AX} y2={Y_BOTTOM + 6} stroke="var(--stage-line)" />
	{#each ticks as tk (tk.v)}
		<line x1={AX - 4} y1={tk.y} x2={AX} y2={tk.y} stroke="var(--stage-line)" />
		<text x={AX - 8} y={tk.y + 4} text-anchor="end" font-size="11" class="muted">{tk.text}</text>
		<line x1={AX} y1={tk.y} x2="930" y2={tk.y} stroke="var(--stage-grid)" />
	{/each}
	<Readout
		id="drops"
		order={1}
		label="The three drops"
		value={drops.map((d) => `${d.name}: ${Math.round(d.kj)} kJ, ${d.h} H⁺`).join(' · ')}
	/>
	<Readout id="axis">
		<Label
			x={AX + 8}
			y={Y_TOP - 22}
			text="↑ more energy per electron (redox potential)"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<!-- drops -->
	{#each drops as d, k (d.id)}
		{@const y0 = yOf(d.from.v)}
		{@const y1 = yOf(d.to.v)}
		<path
			d="M{d.from.x + TW} {y0} L{d.to.x - TW} {y1}"
			stroke={d.color}
			stroke-width="3"
			stroke-dasharray={d.h === 0 ? '5 4' : undefined}
			opacity="0.85"
		/>
		{@const mx = (d.from.x + d.to.x) / 2}
		{@const my = (y0 + y1) / 2}
		<Readout id="drop-{d.id}">
			{@const small = d.kj < 20}
			<Label
				x={small ? mx : mx + 12}
				y={small ? my - 40 : my - 8}
				text={d.name}
				anchor={small ? 'middle' : 'start'}
				size={12}
				weight={700}
				color={d.color}
			/>
			<Label
				x={small ? mx : mx + 12}
				y={small ? my - 24 : my + 8}
				text="{Math.round(d.kj)} kJ · {d.h === 0 ? 'no H⁺' : `${d.h} H⁺ out`}{d.extra}"
				anchor={small ? 'middle' : 'start'}
				size={11}
			/>
		</Readout>
		<!-- the protons of this drop, popping out sideways as the pair passes -->
		{#each Array.from({ length: d.h }, (_, i) => i) as i (i)}
			{@const p = popped(k)}
			<Molecule
				kind="proton"
				x={mx - 16 - (i % 2) * 12 - 10 * p}
				y={my + 4 + Math.floor(i / 2) * 12 + 10 * p}
				opacity={smoothstep(0, 0.3, p)}
				glow={p > 0 && p < 1}
			/>
		{/each}
	{/each}

	<!-- treads -->
	{#each treads as d, k (d.id)}
		{@const y = yOf(d.v)}
		<line
			x1={d.x - TW}
			y1={y}
			x2={d.x + TW}
			y2={y}
			stroke={d.color}
			stroke-width="5"
			stroke-linecap="round"
		/>
		<Label
			x={d.x}
			y={y + 22}
			text={d.label}
			size={12}
			weight={600}
			opacity={k === 0 || reached(k - 1) ? 1 : 0.6}
		/>
		<text x={d.x} y={y + 38} text-anchor="middle" font-size="11" class="muted"
			>{d.v > 0 ? '+' : '−'}{Math.abs(d.v).toFixed(2)} V</text
		>
	{/each}

	<!-- the electron pair -->
	<Molecule kind="electron" x={pair.x - 6} y={pair.y} glow />
	<Molecule kind="electron" x={pair.x + 6} y={pair.y} glow />

	<!-- energy bars -->
	<Readout id="card1">
		<rect
			x="24"
			y="478"
			width="912"
			height="106"
			rx="12"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
	</Readout>
	<Readout
		id="total"
		order={4}
		label="Released per electron pair"
		value="{Math.round(totalKJ)} kJ/mol"
	>
		<text x="44" y="504" font-size="12">released by one pair, {fad ? 'FADH₂' : 'NADH'} → O₂</text>
		<rect
			x="380"
			y="494"
			width={totalKJ * scale}
			height="13"
			rx="6"
			fill="var(--stage-ink-muted)"
			opacity="0.6"
		/>
		<text x={388 + totalKJ * scale} y="505" font-size="12" font-weight="700"
			>{Math.round(totalKJ)} kJ/mol</text
		>
	</Readout>
	<Readout
		id="stored"
		order={5}
		label="Stored by its protons at 180 mV"
		value="{totalH} × {protonKJ(DP).toFixed(1)} = {Math.round(storedKJ)} kJ/mol"
	>
		<text x="44" y="532" font-size="12">stored in {totalH} protons at 180 mV</text>
		<rect x="380" y="522" width={storedKJ * scale} height="13" rx="6" fill="#f472b6" />
		<text x={388 + storedKJ * scale} y="533" font-size="12" font-weight="700"
			>{Math.round(storedKJ)} kJ/mol ({Math.round((100 * storedKJ) / totalKJ)}%)</text
		>
	</Readout>
	<Readout id="atp" order={6} label="One ATP in a cell" value="≈ {atpKJ} kJ/mol">
		<text x="44" y="560" font-size="12">one ATP, as the cell keeps it</text>
		<rect x="380" y="550" width={atpKJ * scale} height="13" rx="6" fill="#f97316" />
		<text x={388 + atpKJ * scale} y="561" font-size="12" font-weight="700">≈ {atpKJ} kJ/mol</text>
	</Readout>
</g>
