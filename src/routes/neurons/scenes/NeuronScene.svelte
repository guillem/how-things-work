<script lang="ts">
	/**
	 * A neuron, schematic and not to scale: dendrites on the left receiving
	 * inputs from other axons, the cell body, a myelinated axon and its
	 * terminals with synapses on the right.
	 *
	 * One cycle (PERIOD seconds, a pure function of t): three inputs fire at
	 * their synapses and their signals run along the dendrites to the cell
	 * body, which charges up; the body fires, the spike runs along the axon
	 * jumping from node to node, and the terminals release transmitter.
	 * Under reduced motion the frame shows the spike half way along the axon.
	 */
	import { Label, along, clamp, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const PERIOD = 6.5;
	const SOMA = { x: 330, y: 300, r: 40 };

	const P = (x: number, y: number): Point => ({ x, y });
	/** Dendrites, each a polyline from the cell body outwards; `input` marks a branch whose tip gets a synapse. */
	const dendrites: { id: string; pts: Point[]; input?: number }[] = [
		{ id: 'd1', pts: [P(302, 272), P(250, 214), P(206, 160), P(170, 112)], input: 0.25 },
		{ id: 'd1b', pts: [P(250, 214), P(186, 204), P(122, 178)] },
		{ id: 'd2', pts: [P(292, 300), P(222, 296), P(156, 318), P(84, 310)], input: 0.65 },
		{ id: 'd2b', pts: [P(222, 296), P(190, 254), P(150, 238)] },
		{ id: 'd3', pts: [P(302, 328), P(254, 384), P(212, 448), P(176, 500)], input: 1.05 },
		{ id: 'd3b', pts: [P(254, 384), P(184, 404), P(118, 430)] },
		{ id: 'd4', pts: [P(318, 262), P(298, 196), P(276, 132)] },
		{ id: 'd5', pts: [P(322, 339), P(318, 420), P(300, 488)] }
	];
	const inputs = dendrites.filter((d) => d.input !== undefined);
	/** Each input runs from the tip back to the cell body. */
	const inputPath = (d: (typeof dendrites)[number]) => [...d.pts].reverse();
	const TRAVEL = 1.0; // s, synapse → cell body

	const AXON_X0 = SOMA.x + SOMA.r - 2;
	const AXON_X1 = 846;
	const NODES = [420, 500, 580, 660, 740, 820];
	const FIRE = 2.3; // s, the cell body fires
	const HOP = 0.24; // s between nodes
	const ARRIVE = FIRE + HOP * (NODES.length + 0.5);
	const TERMINALS: Point[] = [P(898, 236), P(914, 300), P(898, 364)];

	const tc = $derived(reduced ? 2.5 + HOP * 3 : t % PERIOD);

	const pathD = (pts: Point[]) => 'M' + pts.map((p) => `${p.x} ${p.y}`).join('L');

	/** Input blips: position along their dendrite and opacity. */
	const blips = $derived(
		inputs.map((d) => {
			const u = clamp((tc - (d.input ?? 0)) / TRAVEL);
			const live = tc >= (d.input ?? 0) && u < 1;
			return {
				id: d.id,
				p: along(inputPath(d), u),
				o: live ? smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u)) : 0,
				flash:
					smoothstep(0, 0.1, tc - (d.input ?? 0)) * (1 - smoothstep(0.1, 0.5, tc - (d.input ?? 0)))
			};
		})
	);
	/** Charge of the cell body: one step per input that has arrived, then it fires and resets. */
	const charge = $derived.by(() => {
		if (tc >= FIRE + 0.25) return 0;
		let c = 0;
		for (const d of inputs) c += smoothstep(0, 0.2, tc - ((d.input ?? 0) + TRAVEL));
		return c / inputs.length;
	});
	const somaFlash = $derived(
		smoothstep(FIRE - 0.05, FIRE, tc) * (1 - smoothstep(FIRE + 0.1, FIRE + 0.6, tc))
	);
	/** Which node the spike has reached (fractional), −1 before it starts. */
	const hop = $derived(tc < FIRE ? -1 : (tc - FIRE) / HOP);
	const nodeGlow = (i: number) => {
		const s = hop - i;
		return s < 0 ? 0 : smoothstep(0, 0.2, s) * (1 - smoothstep(0.6, 2.4, s));
	};
	/** The depolarised stretch of axon: from a few nodes back up to the node the spike has reached. */
	const nodeX = (i: number) => (i < 0 ? AXON_X0 : NODES[Math.min(i, NODES.length - 1)]);
	const front = $derived(
		hop < 0 ? AXON_X0 : hop >= NODES.length ? AXON_X1 : nodeX(Math.floor(hop))
	);
	const back = $derived(hop < 0 ? AXON_X0 : nodeX(Math.floor(hop) - 3));
	const spikeOn = $derived(
		hop >= 0 && tc < ARRIVE + 0.8 ? 1 - smoothstep(ARRIVE, ARRIVE + 0.8, tc) : 0
	);
	const release = $derived(
		smoothstep(ARRIVE - 0.1, ARRIVE + 0.1, tc) * (1 - smoothstep(ARRIVE + 0.9, ARRIVE + 1.6, tc))
	);
	const transmitter = $derived(clamp((tc - ARRIVE) / 0.9));
</script>

<g class="neuron">
	<!-- incoming axons from other cells, ending on the dendrites -->
	{#each inputs as d (d.id)}
		{@const tip = d.pts[d.pts.length - 1]}
		{@const dir = { x: tip.x - d.pts[d.pts.length - 2].x, y: tip.y - d.pts[d.pts.length - 2].y }}
		{@const len = Math.hypot(dir.x, dir.y)}
		<path
			d="M{tip.x + (dir.x / len) * 60} {tip.y + (dir.y / len) * 60 - 12} Q{tip.x +
				(dir.x / len) * 30} {tip.y + (dir.y / len) * 30 - 14} {tip.x + (dir.x / len) * 12} {tip.y +
				(dir.y / len) * 12}"
			fill="none"
			stroke="var(--stage-ink-muted)"
			stroke-width="2"
			opacity="0.5"
		/>
		<circle
			cx={tip.x + (dir.x / len) * 10}
			cy={tip.y + (dir.y / len) * 10}
			r="6"
			fill="var(--nr-exc)"
			opacity="0.55"
		/>
	{/each}

	<!-- dendrites -->
	{#each dendrites as d (d.id)}
		<path
			d={pathD(d.pts)}
			fill="none"
			stroke="var(--nr-axon-edge)"
			stroke-width={d.id.endsWith('b') ? 5 : 8}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
		<path
			d={pathD(d.pts)}
			fill="none"
			stroke="var(--nr-axon)"
			stroke-width={d.id.endsWith('b') ? 3 : 6}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/each}

	<!-- axon: bare core, myelin segments, terminals -->
	<path
		d="M{AXON_X0} {SOMA.y} L{AXON_X1} {SOMA.y}"
		stroke="var(--nr-axon-edge)"
		stroke-width="9"
		stroke-linecap="round"
	/>
	<path
		d="M{AXON_X0} {SOMA.y} L{AXON_X1} {SOMA.y}"
		stroke="var(--nr-axon)"
		stroke-width="7"
		stroke-linecap="round"
	/>
	{#if spikeOn > 0}
		<path
			d="M{back} {SOMA.y} L{front} {SOMA.y}"
			stroke="var(--nr-fire)"
			stroke-width="7"
			stroke-linecap="round"
			opacity={0.85 * spikeOn}
		/>
	{/if}
	{#each NODES.slice(0, -1) as x, i (x)}
		<rect
			x={x + 5}
			y={SOMA.y - 11}
			width={NODES[i + 1] - x - 10}
			height="22"
			rx="9"
			fill="var(--nr-myelin)"
			stroke="var(--nr-myelin-edge)"
			stroke-width="1.2"
		/>
	{/each}
	{#each NODES as x, i (x)}
		<circle
			cx={x}
			cy={SOMA.y}
			r={4 + 8 * nodeGlow(i)}
			fill="var(--nr-fire)"
			opacity={nodeGlow(i)}
		/>
	{/each}
	{#each TERMINALS as p (p.y)}
		<path
			d="M{AXON_X1} {SOMA.y} Q{AXON_X1 + 26} {SOMA.y} {p.x - 8} {p.y}"
			fill="none"
			stroke="var(--nr-axon-edge)"
			stroke-width="4"
		/>
		<circle
			cx={p.x}
			cy={p.y}
			r="10"
			fill="var(--nr-axon)"
			stroke="var(--nr-axon-edge)"
			stroke-width="1.5"
		/>
		<circle cx={p.x} cy={p.y} r={10 + 6 * release} fill="var(--nr-fire)" opacity={0.6 * release} />
		{#each [0, 1, 2, 3] as k (k)}
			{@const a = -0.8 + k * 0.53}
			<circle
				cx={p.x + 12 * Math.cos(a) + 14 * transmitter * Math.cos(a)}
				cy={p.y + 12 * Math.sin(a) + 14 * transmitter * Math.sin(a)}
				r="2.4"
				fill="var(--nr-glu)"
				opacity={release}
			/>
		{/each}
	{/each}

	<!-- cell body -->
	<circle
		cx={SOMA.x}
		cy={SOMA.y}
		r={SOMA.r + 14 * somaFlash}
		fill="var(--nr-fire)"
		opacity={0.5 * somaFlash}
	/>
	<circle
		cx={SOMA.x}
		cy={SOMA.y}
		r={SOMA.r}
		fill="var(--nr-axon)"
		stroke="var(--nr-axon-edge)"
		stroke-width="2"
	/>
	<circle cx={SOMA.x} cy={SOMA.y} r={SOMA.r - 3} fill="var(--nr-fire)" opacity={0.45 * charge} />
	<circle cx={SOMA.x - 6} cy={SOMA.y - 4} r="15" fill="var(--nr-axon-edge)" opacity="0.55" />

	<!-- input signals -->
	{#each blips as b (b.id)}
		<circle cx={b.p.x} cy={b.p.y} r="7" fill="var(--nr-fire)" opacity={b.o} />
	{/each}

	<!-- labels -->
	<Readout
		id="dendrites"
		order={1}
		label="Dendrites: receive inputs from other neurons"
		marker={1}
		at={[150, 70]}
	>
		<Label x={60} y={66} anchor="start" text="dendrites: receive inputs" />
		<Label x={60} y={84} anchor="start" size={11} muted text="from synapses of other neurons" />
	</Readout>
	<Readout id="soma" order={2} label="Cell body: adds up the inputs" marker={2} at={[330, 380]}>
		<Label x={392} y={236} anchor="start" text="cell body: adds up the inputs" />
		<Label
			x={392}
			y={254}
			anchor="start"
			size={11}
			muted
			text="and fires if the sum is big enough"
		/>
	</Readout>
	<Readout
		id="axon"
		order={3}
		label="Axon, wrapped in myelin: carries the spike"
		marker={3}
		at={[620, 345]}
	>
		<Label x={620} y={350} text="axon, wrapped in myelin: carries the spike" />
		<Label x={620} y={368} size={11} muted text="from node to node, without fading" />
	</Readout>
	<Readout
		id="synapses"
		order={4}
		label="Synapses: pass the signal on as a chemical"
		marker={4}
		at={[900, 420]}
	>
		<Label x={930} y={418} anchor="end" text="synapses" />
		<Label x={930} y={436} anchor="end" size={11} muted text="pass it on to the next cells" />
	</Readout>
	<Readout id="scale">
		<Label
			x={480}
			y={572}
			size={11}
			muted
			text="schematic, not to scale: a real axon can be thousands of times longer than the cell body"
		/>
	</Readout>
</g>
