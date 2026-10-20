<script lang="ts">
	/**
	 * The heat-recovery boiler's temperature-heat diagram: heat passed from gas to water across,
	 * from the cold (stack) end on the left to the hot (gas inlet) end on the right; the gas line
	 * above, the water and steam line below, the pinch points marked.
	 */
	import { Axes, Label, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { hMix, plant, T0 } from '../model';

	let { step, params }: StageProps = $props();

	const phase = $derived(String(step.hints?.phase ?? 'tq'));
	const pHigh = $derived(Number(params.phigh ?? 12));
	const pinch = $derived(phase === 'tq' ? 10 : Number(params.pinch ?? 10));
	const levels = $derived(phase === 'levels' ? Number(params.levels ?? 1) : 1);
	const p = $derived(
		plant({ ratio: 18, tit: 1650, pHigh: phase === 'levels' ? 12 : pHigh, pinch, levels })
	);
	const total = $derived(p.sections.length ? p.sections[p.sections.length - 1].q1 : 1);
	// The exhaust's heat above 15 °C sets the width, so a fuller boiler fills more of it.
	const available = $derived(hMix(p.gt.exhaust, p.gt.t4) - hMix(p.gt.exhaust, T0));
	const sx = $derived(scale([0, 100], [90, 880]));
	const sy = scale([0, 700], [520, 60]);
	const C = (T: number) => T - 273.15;
	/** Left-to-right position of heat q counted from the hot end, as a % of the exhaust's heat. */
	const X = (q: number) => sx(((total - q) / available) * 100);
	const gasPath = $derived(
		[`M${X(0)} ${sy(C(p.gt.t4))}`, ...p.sections.map((s) => `L${X(s.q1)} ${sy(C(s.gasOut))}`)].join(
			' '
		)
	);
	const colour = (k: string) =>
		k === 'superheater' ? 'var(--cc-gt)' : k === 'evaporator' ? 'var(--cc-water)' : 'var(--cc-st)';
	const pinches = $derived(p.sections.filter((s) => s.kind === 'evaporator'));
</script>

<g class="cc-tq">
	<Axes
		{sx}
		{sy}
		xLabel="heat passed to the water (% of the exhaust’s heat above 15 °C)"
		yLabel="temperature (°C)"
	/>
	<!-- the gas, cooling from right to left -->
	<path d={gasPath} fill="none" stroke="var(--cc-gas)" stroke-width="3.5" />
	<Readout
		id="cc-gas"
		order={1}
		label="Gas"
		value="from {Math.round(C(p.gt.t4))} °C to the stack at {Math.round(C(p.stack))} °C"
	>
		<Label
			x={X(0) - 6}
			y={sy(C(p.gt.t4)) - 12}
			text="exhaust {Math.round(C(p.gt.t4))} °C"
			anchor="end"
			color="var(--cc-gas)"
			weight={600}
		/>
		<Label
			x={X(total) + 6}
			y={sy(C(p.stack)) - 12}
			text="stack {Math.round(C(p.stack))} °C"
			anchor="start"
			color="var(--cc-gas)"
			weight={600}
		/>
	</Readout>
	<!-- the water and steam -->
	{#each p.sections as s, i (i)}
		<line
			x1={X(s.q1)}
			y1={sy(C(s.waterIn))}
			x2={X(s.q0)}
			y2={sy(C(s.waterOut))}
			stroke={colour(s.kind)}
			stroke-width="3.5"
			stroke-linecap="round"
		/>
	{/each}
	{#each pinches as s (s.level)}
		<line
			x1={X(s.q1)}
			y1={sy(C(s.gasOut))}
			x2={X(s.q1)}
			y2={sy(C(s.waterIn))}
			stroke="var(--text)"
			stroke-width="1.5"
		/>
		<circle cx={X(s.q1)} cy={sy(C(s.gasOut))} r="4" fill="var(--text)" />
		<Readout
			id="cc-pinch-{s.level}"
			order={5 + s.level}
			label="Pinch {s.level + 1}"
			value="{pinch} K above boiling at {Math.round(C(s.waterIn))} °C"
		>
			<Label
				x={X(s.q1) + 6}
				y={(sy(C(s.gasOut)) + sy(C(s.waterIn))) / 2 + 4}
				text="pinch {pinch} K"
				anchor="start"
				size={11}
			/>
		</Readout>
	{/each}
	<!-- key -->
	<Readout
		id="cc-key"
		order={4}
		label="Water line"
		value="green: economizer; blue: evaporator (boiling); purple: superheater"
	>
		<Label
			x={110}
			y={80}
			text="economizer"
			anchor="start"
			size={12}
			color="var(--cc-st)"
			weight={600}
		/>
		<Label
			x={110}
			y={98}
			text="evaporator (boiling)"
			anchor="start"
			size={12}
			color="var(--cc-water)"
			weight={600}
		/>
		<Label
			x={110}
			y={116}
			text="superheater"
			anchor="start"
			size={12}
			color="var(--cc-gt)"
			weight={600}
		/>
	</Readout>
	<Readout
		id="cc-result"
		order={2}
		label="Plant"
		value="{(p.efficiency * 100).toFixed(1)}% efficient, {Math.round(
			p.recovered * 100
		)}% of the exhaust’s heat recovered"
	>
		<Label
			x={880}
			y={400}
			text="plant {(p.efficiency * 100).toFixed(1)}%"
			anchor="end"
			size={18}
			weight={700}
			tabular
		/>
		<Label
			x={880}
			y={422}
			text="{Math.round(p.recovered * 100)}% of the exhaust’s heat recovered"
			anchor="end"
			size={12}
			muted
		/>
	</Readout>
	<Readout
		id="cc-steam"
		order={3}
		label="Steam"
		value={p.levels.map((l) => `${l.p} MPa: boils at ${Math.round(C(l.tSat))} °C`).join('; ')}
	>
		{#each p.levels as l, i (l.p)}
			<Label
				x={880}
				y={444 + i * 18}
				text="{l.p} MPa: boils at {Math.round(C(l.tSat))} °C"
				anchor="end"
				size={12}
				tabular
			/>
		{/each}
	</Readout>
</g>
