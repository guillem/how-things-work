<script lang="ts">
	/**
	 * A tiny circuit (inputs.ts WIRING): three input neurons wired to two
	 * receiving cells, A and B, each connection drawn with one dot per
	 * synapse (red excitatory, blue inhibitory). The input neurons the reader
	 * switches on fire; their spikes run along their axons and arrive at the
	 * receiving cells at INPUT_TIMES; each receiving cell runs the model
	 * (Hodgkin & Huxley's membrane with the illustrative synapses) and fires
	 * or not, shown by its glow, its small voltage chart and its verdict.
	 * The strength slider sets the number of synapses from 3 to A.
	 *
	 * One pass (pure function of t, restarted by any control) runs 30 ms of
	 * model time in 5 s, then holds. Under reduced motion the finished pass is
	 * shown.
	 */
	import { Label, clamp, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { REST, peak, spikeTimes } from '../hh';
	import { INPUT_TIMES, WINDOW, WIRING, circuit } from '../inputs';
	import { replayClock } from './replay';

	let { t, params, reduced }: StageProps = $props();

	const active = $derived(
		[params.in1 ?? true, params.in2 ?? true, params.in3 ?? false].map(Boolean)
	);
	const w3a = $derived(Math.round(Number(params.w3a ?? 0)));
	const runs = $derived({
		A: circuit('A', active, w3a),
		B: circuit('B', active, w3a)
	});
	const spikeA = $derived(spikeTimes(runs.A)[0] ?? Infinity);
	const spikeB = $derived(spikeTimes(runs.B)[0] ?? Infinity);

	const LEAD = 0.4;
	const SWEEP = 5;
	const HOLD = 3;
	const since = replayClock();
	const elapsed = $derived(since(`${active.join()}|${w3a}`, t));
	const ms = $derived(
		reduced ? WINDOW : clamp(((elapsed % (LEAD + SWEEP + HOLD)) - LEAD) / SWEEP) * WINDOW
	);

	// ---- geometry ----------------------------------------------------------------------
	const INPUTS = [
		{ id: 1, x: 120, y: 150 },
		{ id: 2, x: 120, y: 310 },
		{ id: 3, x: 120, y: 470 }
	];
	const CELLS = { A: { x: 560, y: 200 }, B: { x: 560, y: 420 } } as const;
	const R_IN = 30;
	const R_CELL = 40;
	/** Spikes leave the input cells this long (ms) before they arrive. */
	const TRAVEL = 1.8;

	const conns = $derived(
		(['A', 'B'] as const).flatMap((c) =>
			INPUTS.map((inp, i) => {
				const n = c === 'A' && i === 2 ? w3a : WIRING[c][i];
				const cell = CELLS[c];
				// End a little before the cell, fanning out by input so the dots don't collide.
				const ex = cell.x - R_CELL - 20;
				const ey = cell.y + (i - 1) * 22;
				return { key: `${c}${i}`, c, i, n, x0: inp.x + R_IN, y0: inp.y, x1: ex, y1: ey };
			})
		)
	);
	/** Position of a spike on its way along a connection (0–1), or −1 when none. */
	const travel = (i: number) => {
		if (!active[i]) return -1;
		const u = (ms - (INPUT_TIMES[i] - TRAVEL)) / TRAVEL;
		return u < 0 || u > 1.15 ? -1 : clamp(u);
	};
	const inGlow = (i: number) => {
		if (!active[i]) return 0;
		const d = ms - (INPUT_TIMES[i] - TRAVEL);
		return d < 0 ? 0.4 : 0.4 + 0.6 * (1 - smoothstep(0.3, 4, d));
	};
	const cellGlow = (at: number) => (ms >= at ? 1 - smoothstep(3, 12, ms - at) : 0);

	// ---- mini charts ---------------------------------------------------------------------
	const MX0 = 650;
	const MX1 = 920;
	const VMIN = -74;
	const VMAX = -40;
	const mini = (s: typeof runs.A, yMid: number) => {
		const h = 90;
		const sx = (tm: number) => MX0 + (tm / WINDOW) * (MX1 - MX0);
		const sy = (v: number) => yMid + h / 2 - ((v - VMIN) / (VMAX - VMIN)) * h;
		let d = '';
		let out = true;
		for (const p of s) {
			if (p.t > ms + 1e-9) break;
			const x = sx(p.t).toFixed(1);
			if (p.V > VMAX) {
				if (!out) d += `L${x} ${sy(VMAX).toFixed(1)}`;
				out = true;
				continue;
			}
			d += `${out ? (d ? `M${x} ${sy(VMAX).toFixed(1)}L` : 'M') : 'L'}${x} ${sy(p.V).toFixed(1)}`;
			out = false;
		}
		return { d, top: yMid - h / 2, bottom: yMid + h / 2, rest: sy(REST) };
	};
	const chartA = $derived(mini(runs.A, CELLS.A.y));
	const chartB = $derived(mini(runs.B, CELLS.B.y));
	const verdict = (spike: number, s: typeof runs.A) =>
		spike < Infinity ? 'fires' : `silent (+${(peak(s).V - REST).toFixed(1)} mV)`;
	const pattern = $derived(
		active
			.map((a, i) => (a ? String(i + 1) : ''))
			.filter(Boolean)
			.join(' and ') || 'none'
	);
	const done = $derived(reduced || ms >= WINDOW - 1e-6);
</script>

<g class="circuit">
	<!-- connections -->
	{#each conns as c (c.key)}
		{#if c.n !== 0}
			{@const inh = c.n < 0}
			{@const col = inh ? 'var(--nr-inh)' : 'var(--nr-exc)'}
			<path
				d="M{c.x0} {c.y0} C{lerp(c.x0, c.x1, 0.5)} {c.y0} {lerp(
					c.x0,
					c.x1,
					0.5
				)} {c.y1} {c.x1} {c.y1}"
				fill="none"
				stroke="var(--nr-axon-edge)"
				stroke-width={1.5 + Math.abs(c.n)}
				opacity={active[c.i] ? 0.9 : 0.4}
			/>
			{#each Array.from({ length: Math.abs(c.n) }, (_, k) => k) as k (k)}
				<circle cx={c.x1 - k * 9} cy={c.y1} r="4.5" fill={col} opacity={active[c.i] ? 1 : 0.45} />
			{/each}
			{@const u = travel(c.i)}
			{#if u >= 0}
				{@const x =
					(1 - u) ** 3 * c.x0 +
					3 * (1 - u) ** 2 * u * lerp(c.x0, c.x1, 0.5) +
					3 * (1 - u) * u * u * lerp(c.x0, c.x1, 0.5) +
					u ** 3 * c.x1}
				{@const y =
					(1 - u) ** 3 * c.y0 +
					3 * (1 - u) ** 2 * u * c.y0 +
					3 * (1 - u) * u * u * c.y1 +
					u ** 3 * c.y1}
				<circle cx={x} cy={y} r="7" fill="var(--nr-fire)" opacity={1 - smoothstep(0.95, 1.1, u)} />
			{/if}
		{/if}
	{/each}

	<!-- input neurons -->
	{#each INPUTS as inp, i (inp.id)}
		{@const g = inGlow(i)}
		<circle
			cx={inp.x}
			cy={inp.y}
			r={R_IN + 10 * g}
			fill="var(--nr-fire)"
			opacity={active[i] ? 0.35 * g : 0}
		/>
		<circle
			cx={inp.x}
			cy={inp.y}
			r={R_IN}
			fill="var(--nr-axon)"
			stroke="var(--nr-axon-edge)"
			stroke-width="2"
			opacity={active[i] ? 1 : 0.5}
		/>
		<text
			x={inp.x}
			y={inp.y + 6}
			text-anchor="middle"
			font-size="17"
			font-weight="700"
			fill="var(--stage-ink)"
			opacity={active[i] ? 1 : 0.5}>{inp.id}</text
		>
		<Readout id="in{inp.id}">
			<Label x={inp.x} y={inp.y + R_IN + 22} size={11} muted text={active[i] ? 'fires' : 'quiet'} />
		</Readout>
	{/each}
	<Readout id="in-title">
		<Label x={120} y={84} size={12} text="input neurons" />
	</Readout>

	<!-- receiving cells -->
	{#each [{ id: 'A', at: spikeA, s: runs.A, ch: chartA }, { id: 'B', at: spikeB, s: runs.B, ch: chartB }] as cell (cell.id)}
		{@const p = CELLS[cell.id as 'A' | 'B']}
		{@const g = cellGlow(cell.at)}
		<circle cx={p.x} cy={p.y} r={R_CELL + 16 * g} fill="var(--nr-fire)" opacity={0.5 * g} />
		<circle
			cx={p.x}
			cy={p.y}
			r={R_CELL}
			fill="var(--nr-axon)"
			stroke="var(--nr-axon-edge)"
			stroke-width="2"
		/>
		<text
			x={p.x}
			y={p.y + 7}
			text-anchor="middle"
			font-size="20"
			font-weight="700"
			fill="var(--stage-ink)">{cell.id}</text
		>
		<!-- mini chart -->
		<line x1={MX0} x2={MX1} y1={cell.ch.rest} y2={cell.ch.rest} stroke="var(--stage-grid)" />
		<line x1={MX0} x2={MX0} y1={cell.ch.top} y2={cell.ch.bottom} stroke="var(--stage-line)" />
		<path d={cell.ch.d} fill="none" stroke="var(--nr-v)" stroke-width="2.2" />
		<Readout
			id="cell{cell.id}"
			order={cell.id === 'A' ? 1 : 2}
			label="Cell {cell.id}"
			value={verdict(cell.at, cell.s)}
			opacity={done || ms >= cell.at ? 1 : 0}
		>
			<Label
				x={MX1}
				y={cell.ch.top - 6}
				anchor="end"
				size={13}
				weight={700}
				opacity={done || ms >= cell.at ? 1 : 0}
				color={cell.at < Infinity ? 'var(--nr-v)' : undefined}
				text="{cell.id} {verdict(cell.at, cell.s)}"
			/>
		</Readout>
	{/each}
	<Readout id="mini-title">
		<Label x={MX0} y={84} anchor="start" size={12} text="voltage, first 30 ms" />
	</Readout>

	<Readout id="pattern" order={3} label="Inputs firing" value={pattern}>
		<Label
			x={340}
			y={560}
			size={12}
			text="inputs firing: {pattern} · connection 3 → A: {w3a === 0
				? 'none'
				: `${w3a} synapse${w3a === 1 ? '' : 's'}`}"
		/>
	</Readout>
	<Readout id="key">
		<circle cx={640} cy={556} r="4.5" fill="var(--nr-exc)" />
		<Label x={650} y={560} anchor="start" size={11} muted text="excitatory synapse" />
		<circle cx={790} cy={556} r="4.5" fill="var(--nr-inh)" />
		<Label x={800} y={560} anchor="start" size={11} muted text="inhibitory synapse" />
	</Readout>
</g>
