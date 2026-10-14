<script lang="ts">
	/**
	 * Steps 11–12: a steam power plant. Water goes round boiler → turbine →
	 * condenser → pump; the energies per kilogram of water come from the ideal
	 * Rankine cycle on real steam data (`rankine` in `steam.ts`), with steam at
	 * `params.steamT` °C and the condenser at `params.condT` °C. A bar on the
	 * right compares its efficiency with the Carnot limit between the two.
	 *
	 * Phase 'combined': a gas turbine sits on top and its exhaust heats the
	 * boiler instead of a flame; the bar splits the fuel's heat into the gas
	 * turbine's work (`params.gasTurbine` %), the steam cycle's work
	 * (`params.steamShare` % of the rest) and the waste.
	 */
	import { Label, along, cycle, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { carnotLimit } from '../engine';
	import { T_BOIL, combined, rankine } from '../steam';
	import Card from './Card.svelte';
	import { fmt, pct } from './colors';

	let { step, t, params, reduced }: StageProps = $props();
	const tm = $derived(reduced ? 2.5 : t);
	const isCombined = $derived(step.hints?.phase === 'combined');

	const C2K = 273.15;
	const steamC = $derived(isCombined ? 600 : Number(params.steamT ?? 600));
	const condC = $derived(isCombined ? 46 : Number(params.condT ?? 46));
	const k = $derived(rankine(steamC + C2K, condC + C2K));
	const gt = $derived(Number(params.gasTurbine ?? 41) / 100);
	const st = $derived(Number(params.steamShare ?? 36) / 100);
	const cc = $derived(combined(gt, st));
	/** Carnot between an H-class turbine's flame (1,600 °C) and cooling water at 15 °C. */
	const ccCarnot = carnotLimit(1600 + C2K, 15 + C2K);

	// ---- layout ---------------------------------------------------------------------------------
	const BOIL = { x: 70, y: 210, w: 110, h: 190 };
	const TURB = { x: 290, y: 150, w: 150, h0: 40, h1: 100 };
	const GEN = { x: 520, y: 200, r: 34 };
	const COND = { x: 300, y: 400, w: 170, h: 90 };
	const PUMP = { x: 190, y: 520, r: 20 };
	const GT = { x: 40, y: 50, w: 240, h: 64 };
	const exhaustPts: Point[] = [
		{ x: GT.x + 10, y: GT.y + GT.h / 2 },
		{ x: GT.x - 16, y: GT.y + GT.h / 2 },
		{ x: GT.x - 16, y: BOIL.y + 60 },
		{ x: BOIL.x + 20, y: BOIL.y + 60 }
	];
	const exhaustPath = exhaustPts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');

	const loopPts: Point[] = [
		{ x: BOIL.x + 40, y: BOIL.y + 30 },
		{ x: BOIL.x + 40, y: TURB.y + 25 },
		{ x: TURB.x + 6, y: TURB.y + 25 },
		{ x: TURB.x + TURB.w - 10, y: TURB.y + 25 },
		{ x: TURB.x + TURB.w + 40, y: TURB.y + 25 },
		{ x: TURB.x + TURB.w + 40, y: COND.y - 10 },
		{ x: COND.x + COND.w / 2, y: COND.y - 10 },
		{ x: COND.x + COND.w / 2, y: COND.y + COND.h - 14 },
		{ x: COND.x + COND.w / 2, y: PUMP.y },
		{ x: PUMP.x, y: PUMP.y },
		{ x: BOIL.x + 40, y: PUMP.y },
		{ x: BOIL.x + 40, y: BOIL.y + BOIL.h - 20 }
	];
	const pipe = loopPts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
	// Fractions along the loop where the water becomes steam and steam becomes water again.
	const N_DOTS = 28;
	const dots = $derived(
		Array.from({ length: N_DOTS }, (_, i) => {
			const u = cycle(tm, 14, i / N_DOTS);
			const p = along(loopPts, u);
			// Steam from the top of the boiler to the middle of the condenser.
			const steam = u < 0.55;
			return { i, x: p.x, y: p.y, steam };
		})
	);

	const flicker = $derived(0.8 + 0.2 * Math.sin(tm * 9));

	// ---- right panel ----------------------------------------------------------------------------
	const gx = scale([0, 1], [640, 910]);
	const GY = 300;
	const rows = $derived(
		isCombined
			? [
					{ id: 'gt', label: 'Gas turbine', value: pct(gt, 1), color: 'var(--he-work)' },
					{
						id: 'st',
						label: 'Steam cycle: ' + pct(st, 1) + ' of the rest',
						value: pct((1 - gt) * st, 1),
						color: 'var(--he-water)'
					},
					{ id: 'cc', label: 'Combined', value: pct(cc, 1), strong: true },
					{
						id: 'ccc',
						label: 'Carnot limit, 1,600 °C to 15 °C',
						value: pct(ccCarnot),
						color: 'var(--he-carnot)'
					}
				]
			: [
					{
						id: 'eff',
						label: 'Efficiency (ideal cycle)',
						value: pct(k.efficiency, 1),
						strong: true
					},
					{
						id: 'carnot',
						label: 'Carnot limit',
						value: pct(k.carnot, 1),
						color: 'var(--he-carnot)'
					},
					{
						id: 'tmean',
						label: 'Heat goes in at, on average',
						value: `${fmt(k.tMeanIn - C2K)} °C`,
						color: 'var(--he-hot)'
					},
					{ id: 'x4', label: 'Turbine exhaust: vapour', value: pct(k.x4) }
				]
	);
	const effNow = $derived(isCombined ? cc : k.efficiency);
	const limitNow = $derived(isCombined ? ccCarnot : k.carnot);
	const grow = $derived(reduced ? 1 : smoothstep(0.1, 1, t));
</script>

<g>
	<!-- gas turbine (combined cycle) -->
	{#if isCombined}
		<!-- air flows right to left: compressor, burner, turbine, exhaust out of the left end -->
		<path
			d="M{GT.x + GT.w} {GT.y + 4} L{GT.x + GT.w - 90} {GT.y + 22} L{GT.x + GT.w - 90} {GT.y +
				GT.h -
				22} L{GT.x + GT.w} {GT.y + GT.h - 4} Z"
			fill="var(--he-metal)"
			stroke="var(--he-metal-edge)"
		/>
		<rect
			x={GT.x + GT.w - 148}
			y={GT.y + 16}
			width="56"
			height={GT.h - 32}
			rx="6"
			fill="var(--he-hot-soft)"
			stroke="var(--he-hot)"
		/>
		<circle
			cx={GT.x + GT.w - 120}
			cy={GT.y + GT.h / 2}
			r={9 * flicker}
			fill="var(--he-hot)"
			opacity="0.6"
		/>
		<path
			d="M{GT.x + GT.w - 150} {GT.y + 22} L{GT.x + 10} {GT.y + 6} L{GT.x + 10} {GT.y +
				GT.h -
				6} L{GT.x + GT.w - 150} {GT.y + GT.h - 22} Z"
			fill="var(--he-metal)"
			stroke="var(--he-metal-edge)"
		/>
		<Readout id="gt-labels">
			<Label x={GT.x + GT.w - 45} y={GT.y - 8} text="compressor" size={11} muted />
			<Label
				x={GT.x + GT.w - 120}
				y={GT.y + GT.h + 16}
				text="burns at 1,400 °C+"
				size={11}
				color="var(--he-hot)"
			/>
			<Label x={GT.x + 50} y={GT.y - 8} text="gas turbine" size={11} muted />
		</Readout>
		<!-- hot exhaust down into the side of the boiler -->
		<path
			d={exhaustPath}
			fill="none"
			stroke="var(--he-hot)"
			stroke-width="10"
			stroke-linejoin="round"
			opacity="0.3"
		/>
		{#each [0, 1, 2, 3] as j (j)}
			{@const u = cycle(tm, 2, j / 4)}
			{@const p = along(exhaustPts, u)}
			<circle
				cx={p.x}
				cy={p.y}
				r="3"
				fill="var(--he-hot)"
				opacity={smoothstep(0, 0.1, u) * (1 - smoothstep(0.9, 1, u))}
			/>
		{/each}
		<Readout id="gt-exhaust">
			<Label
				x={GT.x - 4}
				y={GT.y + GT.h + 40}
				text="hot exhaust"
				size={11}
				color="var(--he-hot)"
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- pipes and water -->
	<path
		d={pipe}
		fill="none"
		stroke="var(--stage-line)"
		stroke-width="8"
		stroke-linejoin="round"
		opacity="0.5"
	/>
	{#each dots as d (d.i)}
		<circle
			cx={d.x}
			cy={d.y}
			r={d.steam ? 3 : 3.5}
			fill={d.steam ? 'var(--he-steam)' : 'var(--he-water)'}
		/>
	{/each}

	<!-- boiler -->
	<rect
		x={BOIL.x}
		y={BOIL.y}
		width={BOIL.w}
		height={BOIL.h}
		rx="10"
		fill="var(--he-hot-soft)"
		stroke="var(--he-hot)"
	/>
	{#each [0, 1, 2, 3] as j (j)}
		<path
			d="M{BOIL.x + 20 + j * 22} {BOIL.y + BOIL.h - 30} q8 -24 0 -60 q-8 -30 0 -60"
			fill="none"
			stroke="var(--he-water)"
			stroke-width="2.5"
			opacity="0.5"
		/>
	{/each}
	{#if !isCombined}
		{#each [0, 1, 2] as j (j)}
			<path
				d="M{BOIL.x + 25 + j * 30} {BOIL.y + BOIL.h + 30} q-10 -14 0 -26 q10 12 0 26 Z"
				fill="var(--he-hot)"
				opacity={0.5 + 0.3 * Math.sin(tm * 7 + j * 2)}
			/>
		{/each}
	{/if}
	<Readout id="boiler">
		<Label
			x={BOIL.x + BOIL.w / 2}
			y={BOIL.y - 10}
			text={isCombined ? 'heat-recovery boiler' : 'boiler, 150 bar'}
			size={12}
		/>
		<Label
			x={BOIL.x + BOIL.w / 2}
			y={BOIL.y + BOIL.h / 2 + 4}
			text="boils at {fmt(T_BOIL - C2K)} °C"
			size={11}
			pill
		/>
	</Readout>
	{#if !isCombined}
		<Readout id="q-in">
			<Label
				x={BOIL.x + BOIL.w / 2}
				y={BOIL.y + BOIL.h + 52}
				text="heat in: {fmt(k.qIn)} kJ/kg"
				size={12}
				color="var(--he-hot)"
			/>
		</Readout>
	{/if}

	<!-- turbine and generator -->
	<path
		d="M{TURB.x} {TURB.y + 25 - TURB.h0 / 2} L{TURB.x + TURB.w} {TURB.y +
			25 -
			TURB.h1 / 2} L{TURB.x + TURB.w} {TURB.y + 25 + TURB.h1 / 2} L{TURB.x} {TURB.y +
			25 +
			TURB.h0 / 2} Z"
		fill="var(--he-metal)"
		stroke="var(--he-metal-edge)"
		stroke-width="1.5"
	/>
	{#each [0, 1, 2, 3, 4] as j (j)}
		{@const x = TURB.x + 20 + j * 26}
		{@const hh = TURB.h0 / 2 + ((TURB.h1 - TURB.h0) / 2) * ((x - TURB.x) / TURB.w)}
		<line
			x1={x}
			x2={x}
			y1={TURB.y + 25 - hh + 4}
			y2={TURB.y + 25 + hh - 4}
			stroke="var(--he-metal-edge)"
			stroke-width="2"
			opacity={0.4 + 0.4 * cycle(tm * 3, 1, j / 5)}
		/>
	{/each}
	<line
		x1={TURB.x + TURB.w}
		x2={GEN.x - GEN.r}
		y1={TURB.y + 25}
		y2={TURB.y + 25}
		stroke="var(--stage-ink-muted)"
		stroke-width="5"
	/>
	<circle
		cx={GEN.x}
		cy={TURB.y + 25}
		r={GEN.r}
		fill="var(--surface)"
		stroke="var(--he-work)"
		stroke-width="2"
	/>
	<path d="M{GEN.x - 10} {TURB.y + 20} l6 -10 l0 10 l6 0 l-6 12 l0 -10 Z" fill="var(--he-work)" />
	<Readout id="turbine">
		<Label x={TURB.x + TURB.w / 2} y={TURB.y - 36} text="steam turbine" size={12} />
		<Label x={GEN.x} y={TURB.y - 18} text="generator" size={12} />
		<Label
			x={TURB.x - 8}
			y={TURB.y - 8}
			text="{fmt(steamC)} °C steam"
			size={11}
			color="var(--he-hot)"
			anchor="end"
		/>
	</Readout>
	{#if !isCombined}
		<Readout id="w-out">
			<Label
				x={GEN.x}
				y={TURB.y + 25 + GEN.r + 18}
				text="work: {fmt(k.wTurbine)} kJ/kg"
				size={12}
				color="var(--he-work)"
			/>
		</Readout>
	{/if}

	<!-- condenser -->
	<rect
		x={COND.x}
		y={COND.y}
		width={COND.w}
		height={COND.h}
		rx="10"
		fill="var(--he-cold-soft)"
		stroke="var(--he-cold)"
	/>
	{#each [0, 1, 2] as j (j)}
		<path
			d="M{COND.x - 30} {COND.y + 24 + j * 22} L{COND.x + COND.w + 30} {COND.y + 24 + j * 22}"
			stroke="var(--he-cold)"
			stroke-width="3"
			stroke-dasharray="8 6"
			stroke-dashoffset={-((tm * 30) % 14)}
			opacity="0.7"
		/>
	{/each}
	<Readout id="cond">
		<Label
			x={COND.x + COND.w / 2}
			y={COND.y + COND.h + 22}
			text="condenser, {fmt(condC)} °C"
			size={12}
		/>
		<Label
			x={COND.x + COND.w + 36}
			y={COND.y + 12}
			text="cooling water"
			size={11}
			color="var(--he-cold)"
			anchor="start"
		/>
		<Label
			x={TURB.x + TURB.w + 48}
			y={COND.y - 30}
			text="exhaust {pct(k.x4)} vapour"
			size={11}
			muted
			anchor="start"
		/>
	</Readout>
	{#if !isCombined}
		<Readout id="q-out">
			<Label
				x={COND.x + COND.w + 36}
				y={COND.y + COND.h + 4}
				text="heat out: {fmt(k.qOut)} kJ/kg"
				size={12}
				color="var(--he-cold)"
				anchor="start"
			/>
		</Readout>
	{/if}

	<!-- pump -->
	<circle
		cx={PUMP.x}
		cy={PUMP.y}
		r={PUMP.r}
		fill="var(--surface)"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
	/>
	<path
		d="M{PUMP.x + 8} {PUMP.y - 8} L{PUMP.x - 8} {PUMP.y} L{PUMP.x + 8} {PUMP.y + 8}"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
	/>
	<Readout id="pump">
		<Label x={PUMP.x} y={PUMP.y + PUMP.r + 18} text="pump: {fmt(k.wPump)} kJ/kg" size={11} muted />
	</Readout>

	<!-- right panel -->
	<Card
		x={620}
		y={80}
		w={300}
		{rows}
		order={1}
		title={isCombined ? 'Combined cycle' : 'Per kilogram of steam'}
	/>
	<Readout id="gauge-title">
		<text x={gx(0)} y={GY - 48} font-size="12" class="muted"
			>share of the heat turned into work</text
		>
	</Readout>
	<rect
		x={gx(0)}
		y={GY - 10}
		width={gx(1) - gx(0)}
		height="20"
		rx="6"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	{#if isCombined}
		<rect
			x={gx(0)}
			y={GY - 7}
			width={(gx(gt) - gx(0)) * grow}
			height="14"
			rx="4"
			fill="var(--he-work)"
		/>
		<rect
			x={gx(gt * grow)}
			y={GY - 7}
			width={(gx(cc) - gx(gt)) * grow}
			height="14"
			rx="0"
			fill="var(--he-water)"
			opacity="0.85"
		/>
	{:else}
		<rect
			x={gx(0)}
			y={GY - 7}
			width={(gx(effNow) - gx(0)) * grow}
			height="14"
			rx="4"
			fill="var(--he-work)"
		/>
	{/if}
	<line
		x1={gx(limitNow)}
		x2={gx(limitNow)}
		y1={GY - 16}
		y2={GY + 16}
		stroke="var(--he-carnot)"
		stroke-width="2.5"
	/>
	<Readout id="gauge-labels">
		<Label x={gx(effNow)} y={GY + 30} text={pct(effNow)} size={12} weight={600} anchor="middle" />
		<Label
			x={gx(limitNow)}
			y={GY - 22}
			text="Carnot {pct(limitNow)}"
			size={12}
			color="var(--he-carnot)"
			anchor={limitNow > 0.8 ? 'end' : 'middle'}
		/>
	</Readout>
</g>
