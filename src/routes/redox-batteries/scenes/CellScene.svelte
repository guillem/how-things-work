<script lang="ts">
	/**
	 * The LG M50 lithium-ion cell in cross-section, its five layers at their real relative
	 * thicknesses (`M50.layers`, µm): copper foil, graphite, separator, NMC 811, aluminium
	 * foil. Graphite is drawn as carbon sheets and the oxide as metal-oxide layers, with
	 * lithium ions (pink) in the gaps between them. A wire over the top joins the foils
	 * through a lamp, a charger or nothing.
	 *
	 * The ions held by each electrode follow the state of charge: the anode's lithium
	 * fraction runs 0.0279 → 0.9014 and the cathode's 0.9084 → 0.2661 (Chen et al. 2020).
	 * The two slot grids are sized so the counts that move match (54 × 0.874 ≈ 72 × 0.642
	 * ≈ 47 ions), and the drawn counts are exact complements: lithium is conserved.
	 *
	 * Flow: while current runs, 4 Li⁺ per 2 s cross the separator and 10 e⁻ per 5 s run
	 * round the wire: 2 per second each, the same current all round the loop. Directions
	 * flip when charging. Stopping (open circuit, wire disconnected) fades the moving
	 * particles out together (a Tween), so a stopped cell looks stopped.
	 *
	 * Focus (`hints.focus`): inside (anatomy, labels, nothing moving), discharge (lamp;
	 * switch `hints.closedParam`), charge (mode from `hints.modeParam`: discharge / open /
	 * charge), curve (state of charge from `params.soc`; plot of the voltage), summary
	 * (the takeaway captions; switch `hints.closedParam`).
	 */
	import { untrack } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import {
		Axes,
		Label,
		along,
		cycle,
		hash,
		linePath,
		scale,
		smoothstep,
		type Point
	} from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { M50, cellVoltage, lithiumGrams, voltageCurve } from '../model';
	import { material } from '../electrodes';
	import { fmtV } from '../look';

	let { step, t, params, reduced }: StageProps = $props();

	const NMC = material('nmc', 'cathode');
	const GRAPHITE = material('graphite', 'anode');
	const curveData = voltageCurve(NMC, GRAPHITE, 100);

	const focus = $derived(String(step.hints?.focus ?? 'discharge'));
	const closedId = $derived(String(step.hints?.closedParam ?? ''));
	const modeId = $derived(String(step.hints?.modeParam ?? ''));
	const mode = $derived.by(() => {
		if (focus === 'inside') return 'open';
		if (modeId) return String(params[modeId] ?? 'charge');
		if (closedId && params[closedId] === false) return 'open';
		return String(step.hints?.mode ?? 'discharge');
	});
	const charging = $derived(mode === 'charge');
	const running = $derived(mode !== 'open');
	const isCurve = $derived(focus === 'curve');
	const soc = $derived(isCurve ? Number(params.soc ?? 100) / 100 : 0.6);
	const voltage = $derived(cellVoltage(NMC, GRAPHITE, soc));

	const opts = { duration: 800, easing: cubicInOut };
	const flowT = new Tween(
		untrack(() => (running ? 1 : 0)),
		opts
	);
	$effect(() => {
		const f = running ? 1 : 0;
		untrack(() => void flowT.set(f, { duration: reduced ? 0 : 800 }));
	});
	const flow = $derived(flowT.current);
	// Direction: +1 discharging (left to right), −1 charging. Switches while faded out.
	const dir = $derived(charging ? -1 : 1);

	// ---- geometry ------------------------------------------------------------------------------
	const X0 = 120;
	const W = 720;
	const totalUm =
		M50.layers.cu + M50.layers.anode + M50.layers.separator + M50.layers.cathode + M50.layers.al;
	const k = W / totalUm;
	const xCu = X0;
	const xAn = xCu + M50.layers.cu * k;
	const xSep = xAn + M50.layers.anode * k;
	const xCa = xSep + M50.layers.separator * k;
	const xAl = xCa + M50.layers.cathode * k;
	const xEnd = xAl + M50.layers.al * k;
	const TOP = 150;
	const hT = Tween.of(() => (isCurve ? 150 : 240), opts);
	const H = $derived(reduced ? (isCurve ? 150 : 240) : hT.current);
	const BOT = $derived(TOP + H);
	const WIRE_Y = 76;
	const LOAD = { x: (X0 + xEnd) / 2, y: WIRE_Y };

	// ---- lithium slots -------------------------------------------------------------------------
	const AN_COLS = 9;
	const CA_COLS = 9;
	const ROWS_AN = 6;
	const ROWS_CA = 8;
	const NA = AN_COLS * ROWS_AN;
	const NC = CA_COLS * ROWS_CA;
	const A_EMPTY = Math.round(GRAPHITE.empty * NA);
	const C_FULL = Math.round(NMC.full * NC);
	const MOVING = Math.round((GRAPHITE.full - GRAPHITE.empty) * NA);
	const moved = $derived(Math.round(soc * MOVING));
	const anodeCount = $derived(A_EMPTY + moved);
	const cathodeCount = $derived(C_FULL + (MOVING - moved));

	/** Slots in a region, in a fixed shuffled order (so filling looks even, not row by row). */
	function slots(x0: number, x1: number, cols: number, rows: number, salt: number) {
		const out: { x: number; row: number; r: number; key: number }[] = [];
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++) {
				const x = x0 + ((c + 0.5 + (r % 2) * 0.35 - 0.17) / cols) * (x1 - x0);
				out.push({ x, row: r, r: hash(r * 31 + c, salt), key: r * 100 + c });
			}
		return out.sort((a, b) => a.r - b.r);
	}
	const anSlots = slots(xAn + 8, xSep - 8, AN_COLS, ROWS_AN, 1);
	const caSlots = slots(xCa + 8, xAl - 8, CA_COLS, ROWS_CA, 2);
	const rowY = (row: number, rows: number) => TOP + ((row + 1) / (rows + 1)) * H;
	const sheetY = (i: number, rows: number) => TOP + ((i + 0.5) / (rows + 1)) * H;

	// ---- moving particles ----------------------------------------------------------------------
	const electronPath = $derived<Point[]>([
		{ x: xAn + 60, y: TOP + H * 0.55 },
		{ x: (xCu + xAn) / 2, y: TOP + H * 0.5 },
		{ x: (xCu + xAn) / 2, y: WIRE_Y },
		{ x: (xAl + xEnd) / 2, y: WIRE_Y },
		{ x: (xAl + xEnd) / 2, y: TOP + H * 0.5 },
		{ x: xAl - 60, y: TOP + H * 0.55 }
	]);
	const electrons = $derived(
		Array.from({ length: 10 }, (_, i) => {
			const u0 = cycle(t, 5, i / 10);
			const u = dir > 0 ? u0 : 1 - u0;
			const p = along(electronPath, u);
			return {
				i,
				x: p.x,
				y: p.y,
				o: flow * smoothstep(0, 0.04, u0) * (1 - smoothstep(0.96, 1, u0))
			};
		})
	);
	const ions = $derived(
		Array.from({ length: 4 }, (_, i) => {
			const u0 = cycle(t, 2, i / 4);
			const u = dir > 0 ? u0 : 1 - u0;
			const row = [1, 4, 2, 5][i];
			const y0 = rowY(row, ROWS_AN);
			const y1 = rowY([2, 6, 3, 5][i], ROWS_CA);
			const x = xSep - 40 + (xCa + 40 - (xSep - 40)) * u;
			const y = y0 + (y1 - y0) * u + 5 * Math.sin(u * Math.PI * 3 + i);
			return { i, x, y, o: flow * smoothstep(0, 0.12, u0) * (1 - smoothstep(0.88, 1, u0)) };
		})
	);
	// Electrolyte ions that just sit in the separator (the salt: Li⁺ and PF₆⁻).
	const salt = $derived(
		[0.18, 0.42, 0.66, 0.86].map((f, i) => ({
			i,
			x: (xSep + xCa) / 2 + (i % 2 ? 7 : -7),
			y: TOP + f * H,
			li: i % 2 === 0
		}))
	);

	// ---- the plot (curve focus) -------------------------------------------------------------------
	const PX0 = 160;
	const PX1 = 820;
	const PY0 = 420;
	const PY1 = 548;
	const px = scale([0, 100], [PX0, PX1]);
	const py = scale([2.4, 4.4], [PY1, PY0]);
	const plotO = Tween.of(() => (isCurve ? 1 : 0), opts);
	const plotOpacity = $derived(reduced ? (isCurve ? 1 : 0) : plotO.current);
	const chargeLeft = $derived(soc * M50.capacityAh);
	const liMoved = $derived(lithiumGrams((1 - soc) * M50.capacityAh));

	const reactions = $derived(
		charging
			? {
					an: '− side: C₆ + Li⁺ + e⁻ → LiC₆',
					anNote: 'graphite takes electrons (reduced)',
					ca: '+ side: LiMO₂ → MO₂ + Li⁺ + e⁻',
					caNote: 'nickel gives them up (oxidised)'
				}
			: {
					an: '− side: LiC₆ → C₆ + Li⁺ + e⁻',
					anNote: 'graphite gives up electrons (oxidised)',
					ca: '+ side: MO₂ + Li⁺ + e⁻ → LiMO₂',
					caNote: 'nickel takes them (reduced)'
				}
	);
	const status = $derived(
		mode === 'open'
			? focus === 'inside'
				? 'nothing connected: no current'
				: 'circuit open: ions and electrons both stop'
			: charging
				? 'charging: the charger pushes both back'
				: 'discharging through the lamp'
	);
</script>

<g style:font-variant-numeric="tabular-nums">
	<!-- the wire and the load -->
	<path
		d="M{(xCu + xAn) / 2} {TOP} V{WIRE_Y} H{LOAD.x - 40} M{LOAD.x + 40} {WIRE_Y} H{(xAl + xEnd) /
			2} V{TOP}"
		fill="none"
		stroke="var(--stage-ink)"
		stroke-width="2.2"
		stroke-linejoin="round"
	/>

	<!-- the five layers -->
	<rect x={xCu} y={TOP} width={xAn - xCu} height={H} fill="var(--rb-copper-foil)" />
	<rect x={xAn} y={TOP} width={xSep - xAn} height={H} fill="var(--rb-graphite-bg)" />
	<rect
		x={xSep}
		y={TOP}
		width={xCa - xSep}
		height={H}
		fill="var(--rb-separator)"
		stroke="var(--stage-line)"
		stroke-dasharray="3 3"
	/>
	<rect x={xCa} y={TOP} width={xAl - xCa} height={H} fill="var(--rb-oxide-bg)" />
	<rect x={xAl} y={TOP} width={xEnd - xAl} height={H} fill="var(--rb-al-foil)" />
	<!-- graphite sheets and oxide layers -->
	{#each Array.from({ length: ROWS_AN + 1 }, (_, i) => i) as i (i)}
		<line
			x1={xAn + 4}
			x2={xSep - 4}
			y1={sheetY(i, ROWS_AN)}
			y2={sheetY(i, ROWS_AN)}
			stroke="var(--rb-graphite)"
			stroke-width="2.5"
			stroke-linecap="round"
		/>
	{/each}
	{#each Array.from({ length: ROWS_CA + 1 }, (_, i) => i) as i (i)}
		<line
			x1={xCa + 4}
			x2={xAl - 4}
			y1={sheetY(i, ROWS_CA)}
			y2={sheetY(i, ROWS_CA)}
			stroke="var(--rb-oxide)"
			stroke-width="3"
			stroke-linecap="round"
			opacity="0.8"
		/>
	{/each}
	<!-- lithium ions held in the electrodes -->
	{#each anSlots.slice(0, anodeCount) as s (s.key)}
		<circle cx={s.x} cy={rowY(s.row, ROWS_AN)} r="5.5" fill="var(--rb-li)" />
	{/each}
	{#each caSlots.slice(0, cathodeCount) as s (s.key)}
		<circle cx={s.x} cy={rowY(s.row, ROWS_CA)} r="5" fill="var(--rb-li)" />
	{/each}
	<!-- the electrolyte salt in the separator -->
	{#each salt as s (s.i)}
		<circle
			cx={s.x}
			cy={s.y}
			r={s.li ? 4.5 : 6}
			fill={s.li ? 'var(--rb-li)' : 'var(--rb-anion)'}
			opacity="0.65"
		/>
	{/each}
	<!-- moving: ions inside, electrons outside -->
	{#each ions as p (p.i)}
		<circle
			cx={p.x}
			cy={p.y}
			r="7"
			fill="var(--rb-li)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={p.o}
		/>
	{/each}
	{#each electrons as e (e.i)}
		<circle
			cx={e.x}
			cy={e.y}
			r="5"
			fill="var(--rb-electron)"
			stroke="var(--stage-bg)"
			opacity={e.o}
		/>
	{/each}

	<!-- the load, drawn over the wire's moving electrons -->
	{#if mode === 'charge'}
		<rect x={LOAD.x - 40} y={LOAD.y - 22} width="80" height="44" rx="8" fill="var(--rb-charger)" />
		<text
			x={LOAD.x}
			y={LOAD.y + 5}
			text-anchor="middle"
			font-size="13"
			font-weight="700"
			style:fill="var(--stage-bg)">charger</text
		>
		<Label x={LOAD.x} y={LOAD.y - 32} text="pushes up to 4.2 V" size={11} muted />
	{:else if mode === 'discharge'}
		<line
			x1={LOAD.x - 40}
			x2={LOAD.x - 18}
			y1={WIRE_Y}
			y2={WIRE_Y}
			stroke="var(--stage-ink)"
			stroke-width="2.2"
		/>
		<line
			x1={LOAD.x + 18}
			x2={LOAD.x + 40}
			y1={WIRE_Y}
			y2={WIRE_Y}
			stroke="var(--stage-ink)"
			stroke-width="2.2"
		/>
		<circle
			cx={LOAD.x}
			cy={LOAD.y}
			r="30"
			fill="var(--rb-lamp)"
			opacity={0.35 * flow}
			filter="url(#glow)"
		/>
		<circle
			cx={LOAD.x}
			cy={LOAD.y}
			r="18"
			fill="var(--rb-lamp)"
			fill-opacity={0.15 + 0.85 * flow}
			stroke="var(--stage-ink)"
			stroke-width="1.5"
		/>
		<path
			d="M{LOAD.x - 7} {LOAD.y + 4} l4 -9 l3 9 l3 -9 l4 9"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.2"
		/>
		<Label x={LOAD.x} y={LOAD.y - 32} text="lamp" size={11} muted />
	{:else}
		<Label
			x={LOAD.x}
			y={LOAD.y + 5}
			text={focus === 'inside' ? 'not connected' : 'open circuit'}
			size={12}
			muted
		/>
	{/if}

	<!-- layer names -->
	<Readout id="layers">
		<Label x={(xAn + xSep) / 2} y={BOT + 22} text="graphite (−) · 85 µm" size={13} weight={600} />
		<Label
			x={(xCa + xAl) / 2}
			y={BOT + 22}
			text="NMC 811 oxide (+) · 76 µm"
			size={13}
			weight={600}
		/>
		{#if !isCurve}
			<Label x={xCu - 4} y={BOT + 48} text="copper foil · 12 µm" size={11} anchor="start" muted />
			<Label x={(xSep + xCa) / 2} y={BOT + 48} text="separator · 12 µm" size={11} muted />
			<Label x={xEnd + 4} y={BOT + 48} text="aluminium foil · 16 µm" size={11} anchor="end" muted />
		{/if}
	</Readout>
	<Readout id="key">
		<circle cx={X0 + 46} cy={TOP - 26} r="5.5" fill="var(--rb-li)" />
		<Label x={X0 + 58} y={TOP - 22} text="lithium ion, Li⁺" size={12} anchor="start" />
		<circle cx={X0 + 190} cy={TOP - 26} r="5" fill="var(--rb-electron)" />
		<Label x={X0 + 202} y={TOP - 22} text="electron, e⁻" size={12} anchor="start" />
	</Readout>

	<!-- readouts -->
	{#if !isCurve}
		<Readout id="status" order={1} label="Now" value={status}>
			<Label x={(xAl + xEnd) / 2 - 14} y={TOP - 22} text={status} size={12} anchor="end" />
		</Readout>
	{/if}
	{#if focus === 'inside'}
		<Readout
			id="electrolyte"
			order={2}
			label="Electrolyte"
			value="a lithium salt (Li⁺ PF₆⁻) in organic solvent, in every pore"
		>
			<Label
				x={(xSep + xCa) / 2}
				y={BOT + 76}
				text="electrolyte everywhere in the pores: Li⁺ and PF₆⁻ in an organic solvent"
				size={12}
			/>
		</Readout>
		<Readout
			id="scale"
			order={3}
			label="Real stack"
			value="one layer of each 0.2 mm thick, rolled up inside a 21 × 70 mm can"
		>
			<Label
				x={(X0 + xEnd) / 2}
				y={BOT + 102}
				text="one layer of each: 0.2 mm, drawn to scale; rolled up inside a 21 mm × 70 mm can"
				size={11}
				muted
			/>
		</Readout>
	{:else if focus === 'discharge' || focus === 'charge' || focus === 'summary'}
		<g opacity={0.35 + 0.65 * flow}>
			<Readout
				id="an"
				order={2}
				label={focus === 'summary' ? undefined : reactions.anNote}
				value={reactions.an.replace('− side: ', '')}
			>
				<Label x={(xAn + xSep) / 2} y={BOT + 76} text={reactions.an} size={13} weight={600} />
				<Label x={(xAn + xSep) / 2} y={BOT + 96} text={reactions.anNote} size={11} muted />
			</Readout>
			<Readout
				id="ca"
				order={3}
				label={focus === 'summary' ? undefined : reactions.caNote}
				value={reactions.ca.replace('+ side: ', '')}
			>
				<Label x={(xCa + xAl) / 2} y={BOT + 76} text={reactions.ca} size={13} weight={600} />
				<Label x={(xCa + xAl) / 2} y={BOT + 96} text={reactions.caNote} size={11} muted />
			</Readout>
		</g>
		<Readout
			id="same"
			order={4}
			label="Every second"
			value="as many Li⁺ cross the separator as e⁻ cross the lamp"
			opacity={flow}
		>
			<Label
				x={(X0 + xEnd) / 2}
				y={BOT + 124}
				text="every second: as many Li⁺ cross the separator as e⁻ go round the wire"
				size={12}
				opacity={flow}
			/>
		</Readout>
		{#if focus === 'summary'}
			<Readout
				id="inside"
				order={5}
				label="Ions and electrons"
				value="only ions cross inside the cell; only electrons go round outside, through what you power"
			>
				<Label
					x={(xSep + xCa) / 2}
					y={TOP - 8}
					text="ions only, inside"
					size={12}
					weight={600}
					color="var(--rb-li)"
				/>
			</Readout>
			<Readout id="outside">
				<Label
					x={LOAD.x + 130}
					y={WIRE_Y - 12}
					text="electrons only: through what you power"
					size={12}
					weight={600}
					color="var(--rb-electron)"
					anchor="start"
				/>
			</Readout>
		{/if}
	{/if}

	{#if plotOpacity > 0.01}
		<g opacity={plotOpacity}>
			<Axes
				sx={px}
				sy={py}
				xLabel="state of charge (%)"
				yLabel="voltage (V)"
				xTicks={[0, 20, 40, 60, 80, 100]}
				yTicks={[2.5, 3, 3.5, 4]}
				yFormat={(v: number) => v.toFixed(1)}
			/>
			<path
				d={linePath(
					curveData,
					(d) => d.soc * 100,
					(d) => d.v,
					px,
					py
				)}
				fill="none"
				stroke="var(--rb-cathode)"
				stroke-width="2.5"
			/>
			<circle
				cx={px(soc * 100)}
				cy={py(voltage)}
				r="7"
				fill="var(--rb-cathode)"
				stroke="var(--stage-bg)"
				stroke-width="2"
			/>
			<Readout id="v" order={2} label="Cell voltage" value={fmtV(voltage, 2)}>
				<text x={PX1 - 90} y={PY0 - 40} text-anchor="end" font-size="12" class="muted"
					>cell voltage</text
				>
				<text x={PX1} y={PY0 - 38} text-anchor="end" font-size="22" font-weight="700"
					>{fmtV(voltage, 2)}</text
				>
			</Readout>
			<Readout id="left" order={3} label="Charge left" value="{chargeLeft.toFixed(2)} of 5 Ah">
				<Label
					x={PX0}
					y={PY0 - 40}
					text="charge left: {chargeLeft.toFixed(2)} of 5 Ah"
					size={12}
					anchor="start"
				/>
			</Readout>
			<Readout id="li" order={4} label="Lithium moved to the oxide" value="{liMoved.toFixed(2)} g">
				<Label
					x={PX0 + 230}
					y={PY0 - 40}
					text="lithium moved into the oxide: {liMoved.toFixed(2)} g"
					size={12}
					anchor="start"
					muted
				/>
			</Readout>
		</g>
	{/if}
</g>
