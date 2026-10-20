<script lang="ts">
	/**
	 * The plant as a schematic (compressor, combustor, turbine, and in the last phase the boiler and
	 * steam turbine) with the temperature at each station, over a bar that splits the fuel's heat
	 * into work and losses.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { hMix, plant, T0 } from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'gt'));
	const full = $derived(phase === 'plant');
	const ratio = $derived(Number(params.ratio ?? 18));
	const tit = $derived(Number(params.tit ?? 1650));
	const p = $derived(
		plant({
			ratio,
			tit,
			pHigh: Number(params.phigh ?? 12),
			pinch: Number(params.pinch ?? 10),
			levels: Number(params.levels ?? 1)
		})
	);
	const gt = $derived(p.gt);
	const C = (T: number) => `${Math.round(T - 273.15)} °C`;
	const pct = (x: number) => `${Math.round(x * 100)}%`;

	// Shares of the fuel's heat.
	const gtWork = $derived((gt.wt - gt.wc) / gt.q);
	const exhaust = $derived((hMix(gt.exhaust, gt.t4) - hMix(gt.exhaust, T0)) / gt.q);
	const stWork = $derived(p.wst / gt.q);
	const stack = $derived((hMix(gt.exhaust, p.stack) - hMix(gt.exhaust, T0)) / gt.q);
	const condenser = $derived(Math.max(0, 1 - gtWork - stWork - stack));
	const bars = $derived(
		full
			? [
					{ id: 'gt', label: 'gas turbine work', share: gtWork, color: 'var(--cc-gt)' },
					{ id: 'st', label: 'steam turbine work', share: stWork, color: 'var(--cc-st)' },
					{ id: 'cond', label: 'condenser', share: condenser, color: 'var(--cc-loss)' },
					{ id: 'stack', label: 'up the stack', share: stack, color: 'var(--cc-gas)' }
				]
			: [
					{ id: 'gt', label: 'gas turbine work', share: gtWork, color: 'var(--cc-gt)' },
					{ id: 'exh', label: 'hot exhaust', share: 1 - gtWork, color: 'var(--cc-gas)' }
				]
	);
	const BX = 60;
	const BW = 840;
	const BY = 450;
	const starts = $derived(bars.map((_, i) => bars.slice(0, i).reduce((a, b) => a + b.share, 0)));

	// ---- schematic ------------------------------------------------------------------------------
	const Y = 170;
</script>

<g class="cc-plant">
	<!-- compressor and turbine as trapezoids on one shaft, the combustor between -->
	<line x1="60" y1={Y} x2={full ? 560 : 640} y2={Y} stroke="var(--text-muted)" stroke-width="4" />
	<path
		d="M90 {Y - 70} L190 {Y - 35} L190 {Y + 35} L90 {Y + 70} Z"
		fill="var(--surface-2)"
		stroke="var(--text)"
		stroke-width="2"
	/>
	<rect x={235} y={Y - 105} width="90" height="50" rx="10" fill="var(--cc-gas)" opacity="0.85" />
	<path
		d="M370 {Y - 35} L470 {Y - 70} L470 {Y + 70} L370 {Y + 35} Z"
		fill="var(--surface-2)"
		stroke="var(--text)"
		stroke-width="2"
	/>
	<path d="M190 {Y - 35} L235 {Y - 80}" fill="none" stroke="var(--cc-water)" stroke-width="3" />
	<path d="M325 {Y - 80} L370 {Y - 35}" fill="none" stroke="var(--cc-gas)" stroke-width="3" />
	<Label x={140} y={Y + 96} text="compressor" anchor="middle" size={13} />
	<Label x={280} y={Y - 116} text="combustor" anchor="middle" size={13} />
	<Label x={420} y={Y + 96} text="turbine" anchor="middle" size={13} />
	<Readout
		id="cc-t"
		order={2}
		label="Temperatures"
		value="air in 15 °C, compressor out {C(gt.t2)}, turbine in {C(gt.t3)}, exhaust {C(gt.t4)}"
	>
		<Label x={70} y={Y - 84} text="15 °C" anchor="middle" size={12} muted />
		<Label x={205} y={Y - 70} text={C(gt.t2)} anchor="end" size={12} />
		<Label x={350} y={Y - 92} text={C(gt.t3)} anchor="start" size={12} weight={600} />
		<Label
			x={490}
			y={Y - 60}
			text="exhaust {C(gt.t4)}"
			anchor="start"
			size={14}
			weight={700}
			color="var(--cc-gas)"
		/>
	</Readout>
	{#if full}
		<!-- boiler and steam turbine -->
		<rect
			x={600}
			y={Y - 120}
			width="90"
			height="200"
			rx="6"
			fill="none"
			stroke="var(--cc-gas)"
			stroke-width="2"
		/>
		<path
			d="M612 {Y + 60} q14 -12 0 -24 q-14 -12 0 -24 q14 -12 0 -24 q-14 -12 0 -24 q14 -12 0 -24"
			fill="none"
			stroke="var(--cc-water)"
			stroke-width="2.5"
			transform="translate(30 0)"
		/>
		<line
			x1="470"
			y1={Y - 40}
			x2="600"
			y2={Y - 40}
			stroke="var(--cc-gas)"
			stroke-width="3"
			marker-end="url(#arrowhead)"
		/>
		<path
			d="M770 {Y - 30} L850 {Y - 55} L850 {Y + 55} L770 {Y + 30} Z"
			fill="var(--surface-2)"
			stroke="var(--text)"
			stroke-width="2"
		/>
		<line x1="690" y1={Y - 80} x2="770" y2={Y - 20} stroke="var(--cc-water)" stroke-width="3" />
		<Label x={645} y={Y + 100} text="heat-recovery boiler" anchor="middle" size={13} />
		<Label x={810} y={Y + 80} text="steam turbine" anchor="middle" size={13} />
		<Readout id="cc-stack" order={3} label="Stack" value={C(p.stack)}>
			<Label
				x={645}
				y={Y - 132}
				text="stack {C(p.stack)}"
				anchor="middle"
				size={13}
				color="var(--cc-gas)"
				weight={600}
			/>
		</Readout>
	{/if}

	<!-- the fuel's heat, split -->
	<Label x={BX} y={BY - 22} text="the fuel’s heat, 100%" anchor="start" size={13} muted />
	{#each bars as b, i (b.id)}
		<Readout id="cc-bar-{b.id}" order={10 + i} label={b.label} value={pct(b.share)}>
			<rect
				x={BX + starts[i] * BW}
				y={BY}
				width={Math.max(0, b.share * BW - 2)}
				height="44"
				rx="4"
				fill={b.color}
				opacity="0.85"
			/>
			{#if b.share > 0.06}
				<Label
					x={BX + (starts[i] + b.share / 2) * BW}
					y={BY + 27}
					text={pct(b.share)}
					anchor="middle"
					size={15}
					weight={700}
					color="#fff"
					halo={false}
				/>
			{/if}
			<Label
				x={BX + (starts[i] + b.share / 2) * BW}
				y={BY + 66 + (i % 2) * 18}
				text={b.label}
				anchor="middle"
				size={12}
			/>
		</Readout>
	{/each}
	<Readout
		id="cc-eff"
		order={1}
		label="Efficiency"
		value={full ? `plant ${pct(p.efficiency)}` : `gas turbine ${pct(gt.efficiency)}`}
	>
		<Label
			x={900}
			y={60}
			text={full
				? `plant: ${(p.efficiency * 100).toFixed(1)}%`
				: `gas turbine: ${(gt.efficiency * 100).toFixed(1)}%`}
			anchor="end"
			size={20}
			weight={700}
			tabular
		/>
		{#if full}
			<Label
				x={900}
				y={84}
				text="gas turbine alone: {(gt.efficiency * 100).toFixed(1)}%"
				anchor="end"
				size={13}
				muted
				tabular
			/>
		{:else}
			<Label
				x={900}
				y={84}
				text="compressor takes {pct(gt.wc / gt.wt)} of the turbine’s work"
				anchor="end"
				size={13}
				muted
			/>
		{/if}
	</Readout>
	{#if !full && phase === 'exhaust'}
		<Readout
			id="cc-exh"
			order={4}
			label="Exhaust heat"
			value="{pct(exhaust)} of the fuel’s heat, above 15 °C"
		>
			<Label
				x={900}
				y={110}
				text="exhaust carries {pct(exhaust)} of the fuel’s heat"
				anchor="end"
				size={13}
				color="var(--cc-gas)"
			/>
		</Readout>
	{/if}
</g>
