<script lang="ts">
	/**
	 * Summation on a receiving cell (inputs.ts: illustrative synapses on
	 * Hodgkin & Huxley's membrane). Left: the cell, with 8 excitatory synapses
	 * on its dendrites and 4 inhibitory ones on its body; the active ones are
	 * lit and flash as their input arrives. Right: the cell's voltage over
	 * 30 ms, with the arrival of each input marked above it and, faint, the
	 * response to one excitatory input alone. The chart is clipped at −40 mV
	 * so that the small rises stay visible; a spike leaves the top with its
	 * peak written on it.
	 *
	 * A cursor sweeps the 30 ms in SWEEP seconds (pure function of t), holds
	 * and repeats; a control change restarts it. Under reduced motion the
	 * finished trace is shown.
	 */
	import { Axes, Label, clamp, linePath, scale, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { REST, peak } from '../hh';
	import { WINDOW, events, fires, receive } from '../inputs';
	import { replayClock } from './replay';

	let { t, params, reduced }: StageProps = $props();

	const nE = $derived(Math.round(Number(params.exc ?? 2)));
	const nI = $derived(Math.round(Number(params.inh ?? 0)));
	const spread = $derived(Number(params.spread ?? 0));
	const set = $derived({ exc: nE, inh: nI, spread });
	const series = $derived(receive(set));
	const ev = $derived(events(set));
	const fired = $derived(fires(series));
	const top = $derived(peak(series));
	const single = receive({ exc: 1, inh: 0, spread: 0 });

	// ---- cursor ---------------------------------------------------------------------
	const LEAD = 0.5;
	const SWEEP = 5;
	const HOLD = 3;
	const since = replayClock();
	const elapsed = $derived(since(`${nE}|${nI}|${spread}`, t));
	const ms = $derived(
		reduced ? WINDOW : clamp(((elapsed % (LEAD + SWEEP + HOLD)) - LEAD) / SWEEP) * WINDOW
	);
	const shown = $derived(series.filter((p) => p.t <= ms + 1e-9));
	const done = $derived(reduced || ms >= WINDOW - 1e-6);

	// ---- the cell ----------------------------------------------------------------------
	const SOMA = { x: 230, y: 320, r: 46 };
	const P = (x: number, y: number): Point => ({ x, y });
	const dendrites: Point[][] = [
		[P(196, 290), P(140, 220), P(100, 140)],
		[P(214, 278), P(200, 190), P(214, 100)],
		[P(250, 278), P(290, 200), P(340, 124)],
		[P(186, 320), P(110, 316), P(44, 300)],
		[P(196, 352), P(130, 420), P(84, 500)],
		[P(250, 362), P(300, 440), P(350, 512)]
	];
	/** Excitatory synapse sites, along the dendrites. */
	const excSites: Point[] = [
		P(110, 158),
		P(208, 120),
		P(326, 144),
		P(64, 304),
		P(100, 474),
		P(334, 490),
		P(152, 236),
		P(285, 208)
	];
	/** Inhibitory sites on the cell body. */
	const inhSites: Point[] = [0.6, 2.2, 3.6, 5.0].map((a) =>
		P(SOMA.x + (SOMA.r + 10) * Math.cos(a), SOMA.y + (SOMA.r + 10) * Math.sin(a))
	);
	const flash = (at: number) => {
		const d = ms - at;
		return d < 0 ? 0 : 1 - smoothstep(0.5, 3, d);
	};
	const excEv = $derived(ev.filter((e) => e.E > REST));
	const inhEv = $derived(ev.filter((e) => e.E < REST));
	const spikeAt = $derived(fired ? (series.find((p) => p.V >= 0)?.t ?? 0) : Infinity);
	const somaGlow = $derived(fired && ms >= spikeAt ? 1 - smoothstep(2, 8, ms - spikeAt) : 0);
	/** The cell's voltage now, shown as the fill of the body (rest → threshold region). */
	const vNow = $derived(shown.length ? shown[shown.length - 1].V : REST);

	// ---- chart -------------------------------------------------------------------------
	const CX0 = 470;
	const CX1 = 924;
	const CY = { y0: 120, y1: 470 };
	const VMIN = -74;
	const VMAX = -40;
	const sx = scale([0, WINDOW], [CX0, CX1]);
	const sy = scale([VMIN, VMAX], [CY.y1, CY.y0]);
	const clip = (v: number) => clamp(v, VMIN, VMAX);
	/** The voltage path, leaving through the top of the chart while a spike is above it. */
	const path = $derived.by(() => {
		let d = '';
		let out = true;
		for (const p of shown) {
			const x = sx(p.t).toFixed(1);
			if (p.V > VMAX) {
				if (!out) d += `L${x} ${sy(VMAX).toFixed(1)}`;
				out = true;
				continue;
			}
			d += `${out ? (d ? `M${x} ${sy(VMAX).toFixed(1)}L` : 'M') : 'L'}${x} ${sy(p.V).toFixed(1)}`;
			out = false;
		}
		return d;
	});
	const singlePath = linePath(
		single,
		(p) => p.t,
		(p) => clip(p.V),
		sx,
		sy
	);
	const fmt = (v: number) => `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))} mV`;
	const verdict = $derived(
		fired
			? { text: 'it fires: a full spike', sub: `peak ${fmt(top.V)}, off the top of the chart` }
			: nE === 0 && nI === 0
				? { text: 'no input: it rests', sub: 'at −60 mV' }
				: { text: 'no spike', sub: `highest ${(top.V - REST).toFixed(1)} mV above rest` }
	);
	const verdictO = $derived(done || (fired && ms >= spikeAt) ? 1 : 0);
</script>

<g class="summation">
	<!-- the receiving cell -->
	{#each dendrites as d, i (i)}
		<path
			d={'M' + d.map((p) => `${p.x} ${p.y}`).join('L')}
			fill="none"
			stroke="var(--nr-axon-edge)"
			stroke-width="9"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d={'M' + d.map((p) => `${p.x} ${p.y}`).join('L')}
			fill="none"
			stroke="var(--nr-axon)"
			stroke-width="7"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/each}
	<path
		d="M{SOMA.x + SOMA.r - 4} {SOMA.y + 10} L{SOMA.x + 150} {SOMA.y + 40}"
		stroke="var(--nr-axon-edge)"
		stroke-width="8"
		stroke-linecap="round"
	/>
	<path
		d="M{SOMA.x + SOMA.r - 4} {SOMA.y + 10} L{SOMA.x + 150} {SOMA.y + 40}"
		stroke="var(--nr-axon)"
		stroke-width="6"
		stroke-linecap="round"
	/>
	<circle
		cx={SOMA.x}
		cy={SOMA.y}
		r={SOMA.r + 18 * somaGlow}
		fill="var(--nr-fire)"
		opacity={0.5 * somaGlow}
	/>
	<circle
		cx={SOMA.x}
		cy={SOMA.y}
		r={SOMA.r}
		fill="var(--nr-axon)"
		stroke="var(--nr-axon-edge)"
		stroke-width="2"
	/>
	<circle
		cx={SOMA.x}
		cy={SOMA.y}
		r={SOMA.r - 3}
		fill="var(--nr-fire)"
		opacity={0.6 * clamp((vNow - REST) / 10)}
	/>
	<Readout id="axon">
		<Label x={SOMA.x + 156} y={SOMA.y + 62} anchor="middle" size={11} muted text="axon →" />
	</Readout>

	{#each excSites as p, i (i)}
		{@const on = i < nE}
		{@const f = on ? flash(excEv[i]?.at ?? Infinity) : 0}
		<circle
			cx={p.x}
			cy={p.y}
			r={9 + 6 * f}
			fill="var(--nr-exc)"
			opacity={on ? 0.35 + 0.65 * Math.max(0.5, f) : 0.18}
		/>
		{#if on}
			<text
				x={p.x}
				y={p.y + 4}
				text-anchor="middle"
				font-size="11"
				font-weight="700"
				fill="var(--stage-bg)">+</text
			>
		{/if}
	{/each}
	{#each inhSites as p, i (i)}
		{@const on = i < nI}
		{@const f = on ? flash(inhEv[i]?.at ?? Infinity) : 0}
		<circle
			cx={p.x}
			cy={p.y}
			r={9 + 6 * f}
			fill="var(--nr-inh)"
			opacity={on ? 0.35 + 0.65 * Math.max(0.5, f) : 0.18}
		/>
		{#if on}
			<text
				x={p.x}
				y={p.y + 4}
				text-anchor="middle"
				font-size="12"
				font-weight="700"
				fill="var(--stage-bg)">−</text
			>
		{/if}
	{/each}
	<Readout
		id="key-exc"
		order={3}
		label="Excitatory synapses active"
		value="{nE} of 8"
		color="var(--nr-exc)"
	>
		<Label
			x={24}
			y={560}
			anchor="start"
			size={12}
			color="var(--nr-exc)"
			text="● excitatory: {nE} of 8 active"
		/>
	</Readout>
	<Readout
		id="key-inh"
		order={4}
		label="Inhibitory synapses active"
		value="{nI} of 4"
		color="var(--nr-inh)"
	>
		<Label
			x={224}
			y={560}
			anchor="start"
			size={12}
			color="var(--nr-inh)"
			text="● inhibitory: {nI} of 4 active"
		/>
	</Readout>

	<!-- the chart -->
	<Axes
		{sx}
		{sy}
		xTicks={[0, 5, 10, 15, 20, 25, 30]}
		yTicks={[-70, -65, -60, -55, -50, -45, -40]}
		xLabel="time (ms)"
		yFormat={(v) => `${v}`.replace('-', '−')}
	/>
	<Readout id="c-title">
		<Label
			x={CX0}
			y={CY.y0 - 44}
			anchor="start"
			size={12}
			text="voltage of the receiving cell (mV)"
		/>
	</Readout>
	<!-- input arrivals -->
	{#each ev as e, i (i)}
		{@const y = e.E > REST ? CY.y0 - 22 : CY.y0 - 10}
		<line
			x1={sx(e.at)}
			x2={sx(e.at)}
			y1={y - 6}
			y2={y + 6}
			stroke={e.E > REST ? 'var(--nr-exc)' : 'var(--nr-inh)'}
			stroke-width="3"
			opacity={ms >= e.at ? 1 : 0.3}
		/>
	{/each}
	<path
		d={singlePath}
		fill="none"
		stroke="var(--nr-exc)"
		stroke-width="1.5"
		stroke-dasharray="4 3"
		opacity="0.6"
	/>
	<Readout id="single">
		<Label
			x={sx(9)}
			y={sy(-58)}
			anchor="start"
			size={11}
			color="var(--nr-exc)"
			text="one excitatory input alone"
		/>
	</Readout>
	<path d={path} fill="none" stroke="var(--nr-v)" stroke-width="2.6" stroke-linejoin="round" />
	{#if fired && ms >= spikeAt}
		<path d="M{sx(spikeAt)} {sy(VMAX) - 4} l-6 10 h12 z" fill="var(--nr-v)" />
	{/if}
	<Readout
		id="verdict"
		order={1}
		label="Receiving cell"
		value={verdict.text}
		note={verdict.sub}
		opacity={verdictO}
	>
		<g opacity={verdictO}>
			<Label
				x={CX1}
				y={CY.y0 + 22}
				anchor="end"
				size={15}
				weight={700}
				color={fired ? 'var(--nr-v)' : undefined}
				text={verdict.text}
			/>
			<Label x={CX1} y={CY.y0 + 42} anchor="end" size={11} muted text={verdict.sub} />
		</g>
	</Readout>
	<Readout id="rest-line">
		<Label x={CX1} y={sy(REST) + 16} anchor="end" size={11} muted text="rest" />
	</Readout>
</g>
