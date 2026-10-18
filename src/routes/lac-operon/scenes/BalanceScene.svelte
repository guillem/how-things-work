<script lang="ts">
	/**
	 * Making and losing LacY at one TMG level, without glucose (../model.ts `production`,
	 * `steadyStates`), on log–log axes: the S-shaped production curve, the straight loss line
	 * (dilution), and where they cross: stable states filled, the tipping point open. Chevrons on
	 * the loss line drift the way the level moves (towards a stable state). Control: `tmg`
	 * (log₁₀ µM).
	 */
	import { Axes, Label, cycle, scale } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { production, steadyStates, thresholds, type Medium } from '../model';

	let { t, params, reduced }: StageProps = $props();

	const logT = $derived(Number(params.tmg ?? 1));
	const T = $derived(10 ** logT);
	const medium = $derived<Medium>({ inducer: 'tmg', c: T, glucose: 0 });
	const states = $derived(steadyStates(medium));
	const range = thresholds(0);

	// ---- layout: log10 of the LacY level on both axes ------------------------------------------
	const X0 = 110;
	const X1 = 700;
	const sx = scale([-0.5, 2.3], [X0, X1]);
	const sy = scale([-0.5, 2.3], [520, 70]);
	const ticks = [0, 1, 2];
	const fmt = (v: number) => (v === 0 ? '1' : v === 1 ? '10' : '100');

	const N = 120;
	const prodPath = $derived.by(() => {
		let d = '';
		for (let i = 0; i <= N; i++) {
			const ly = -0.5 + (2.8 * i) / N;
			const p = production(10 ** ly, medium);
			d += `${i ? 'L' : 'M'}${sx(ly).toFixed(1)} ${sy(Math.log10(p)).toFixed(1)}`;
		}
		return d;
	});

	/** Chevrons along the loss line, pointing the way the level moves there. */
	const chevrons = $derived.by(() => {
		const out: { x: number; y: number; dir: number; key: number }[] = [];
		const shift = reduced ? 0.5 : cycle(t, 1.6);
		for (let k = 0; k < 18; k++) {
			const ly = -0.4 + (k + shift) * 0.15;
			if (ly > 2.2) continue;
			const y = 10 ** ly;
			const net = production(y, medium) - y;
			// No chevron right at a crossing.
			if (Math.abs(net) < 0.04 * y) continue;
			out.push({ x: sx(ly), y: sy(ly), dir: net > 0 ? 1 : -1, key: k });
		}
		return out;
	});

	const names = $derived(
		states.length === 3 ? ['off', 'tipping point', 'on'] : [states[0].y > 10 ? 'on' : 'off']
	);
	const verdict = $derived(
		states.length === 3
			? 'two stable states: off and on'
			: states[0].y > 10
				? 'one stable state: on'
				: 'one stable state: off'
	);
	const fmtY = (y: number) => (y < 10 ? y.toFixed(1) : y.toFixed(0));
	const tmgText = $derived(Number(T.toPrecision(2)));
</script>

<g>
	<Readout id="title" order={1} label="TMG outside" value="{tmgText} µM, no glucose">
		<Label
			x={24}
			y={30}
			text="TMG {tmgText} µM, no glucose: making and losing LacY"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
	</Readout>

	<Axes
		{sx}
		{sy}
		xTicks={ticks}
		yTicks={ticks}
		xFormat={fmt}
		yFormat={fmt}
		xLabel="LacY in the cell (% of full)"
		yLabel="rate × τ (% of full)"
	/>

	<!-- loss: dilution, proportional to the amount -->
	<line
		x1={sx(-0.5)}
		y1={sy(-0.5)}
		x2={sx(2.3)}
		y2={sy(2.3)}
		stroke="var(--stage-ink-muted)"
		stroke-width="2"
	/>
	{#each chevrons as c (c.key)}
		<path
			d="M{-5 * c.dir} -6 L{5 * c.dir} 0 L{-5 * c.dir} 6"
			transform="translate({c.x} {c.y}) rotate(-37.4)"
			fill="none"
			stroke="var(--stage-ink)"
			stroke-width="1.8"
			stroke-linecap="round"
			stroke-linejoin="round"
			opacity="0.7"
		/>
	{/each}
	<Readout id="loss-key">
		<Label
			x={sx(1.55) + 10}
			y={sy(1.55) + 22}
			text="loss (dilution)"
			size={12}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- production: the operon's output at that much LacY -->
	<path d={prodPath} fill="none" stroke="var(--lo-lacy)" stroke-width="3" />
	<Readout id="prod-key">
		<Label
			x={sx(0.6) + 10}
			y={sy(Math.log10(production(10 ** 0.6, medium))) + 22}
			text="production"
			size={12}
			anchor="start"
			color="var(--lo-lacy)"
			weight={600}
		/>
	</Readout>

	<!-- steady states -->
	{#each states as s, i (i)}
		{@const lx = sx(Math.log10(s.y))}
		{@const ly = sy(Math.log10(s.y))}
		<circle
			cx={lx}
			cy={ly}
			r="8"
			fill={s.stable ? 'var(--lo-lacy)' : 'var(--stage-bg)'}
			stroke="var(--lo-lacy)"
			stroke-width="2.5"
		/>
		<Readout id="st-{i}">
			<Label
				x={lx + 14}
				y={ly + 24}
				text={names[i]}
				size={12}
				anchor="start"
				weight={600}
				color={s.stable ? 'var(--lo-lacy)' : undefined}
			/>
		</Readout>
	{/each}

	<!-- side panel -->
	<Readout id="verdict" order={2} label="Steady states" value={verdict}>
		<Label x={730} y={110} text={verdict} size={14} weight={600} anchor="start" />
	</Readout>
	{#each states as s, i (i)}
		<Readout
			id="row-{i}"
			order={3 + i}
			label={names[i]}
			value="{fmtY(s.y)} % of full{s.stable ? '' : ' (unstable)'}"
		>
			<Label
				x={730}
				y={140 + i * 22}
				text="{names[i]}: {fmtY(s.y)} %{s.stable ? '' : ' (unstable)'}"
				size={13}
				anchor="start"
				tabular
			/>
		</Readout>
	{/each}
	{#if range}
		<Readout id="range">
			<Label
				x={730}
				y={230}
				text="two states between {range.off.toFixed(1)}"
				size={12}
				anchor="start"
				muted
			/>
			<Label
				x={730}
				y={248}
				text="and {range.on.toFixed(0)} µM TMG (measured:"
				size={12}
				anchor="start"
				muted
			/>
			<Label x={730} y={266} text="about 3 and 30 µM)" size={12} anchor="start" muted />
		</Readout>
	{/if}
	<Readout id="chev-key">
		<Label x={730} y={310} text="› ‹ which way the level moves" size={12} anchor="start" muted />
	</Readout>
</g>
