<script lang="ts">
	/**
	 * The Marr–Albus–Ito picture: mossy fibres bring the context to granule cells, whose parallel
	 * fibres cross a Purkinje cell's dendritic fan; one climbing fibre from the inferior olive
	 * winds up the same dendrite. Spikes run along the three active parallel fibres all the time;
	 * every few seconds the climbing fibre fires (an error), and the synapses of the fibres active
	 * at that moment shrink (long-term depression). The Purkinje cell inhibits a deep cerebellar
	 * nucleus, which sends the output on. A card maps the parts onto x(n+1) = A·x(n) + B·e(n).
	 *
	 * Motion: parallel-fibre spikes loop; the climbing-fibre volley runs every 4 s and each one
	 * steps the active weights down (a pure function of t). Reduced motion: one volley has
	 * happened and the weights are drawn after it, with the climbing fibre highlighted.
	 */
	import { Label, along, cycle, smoothstep, type Point } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';

	let { t, reduced }: StageProps = $props();

	const FIBRES = [150, 180, 210, 240, 270, 300];
	const ACTIVE = new Set([1, 2, 4]);
	const X0 = 60;
	const X1 = 610;
	const SOMA = { x: 380, y: 410 };
	const DCN = { x: 560, y: 528 };
	const IO = { x: 760, y: 470 };

	const PERIOD = 4;
	const VOLLEY = 0.7;
	const tt = $derived(reduced ? 2.5 : t);
	/** Climbing-fibre volleys so far (one at 1.6 s, then every 4 s). */
	const volleys = $derived(Math.max(0, Math.floor((tt - 1.6) / PERIOD) + 1));
	/** Progress of the current volley along the climbing fibre, 0–1 (or −1 between volleys). */
	const volleyU = $derived.by(() => {
		if (reduced) return -1;
		const since = tt - 1.6 - (volleys - 1) * PERIOD;
		return volleys > 0 && since < VOLLEY ? since / VOLLEY : -1;
	});
	const flash = $derived.by(() => {
		if (reduced) return 0.6;
		const since = tt - 1.6 - (volleys - 1) * PERIOD;
		return volleys > 0 ? smoothstep(0.5, 0.75, since) * (1 - smoothstep(0.8, 1.6, since)) : 0;
	});
	/** Each volley takes 15% off the active synapses, down to 40%. */
	const weight = $derived(Math.max(0.4, 1 - 0.15 * Math.min(volleys, 4)));

	/** Dendritic fan: a trunk, then five straight branches from its top up through the fibres. */
	const FORK = { x: SOMA.x, y: 336 };
	const TIPS = [292, 336, 380, 424, 468];
	const branches = [
		`M${SOMA.x} ${SOMA.y - 14} L${FORK.x} ${FORK.y}`,
		...TIPS.map((x) => `M${FORK.x} ${FORK.y} L${x} 134`)
	];
	/** Where fibre i meets branch i mod 5: its synapse onto the Purkinje cell. */
	const synAt = (i: number, y: number) => {
		const tip = TIPS[(i * 2) % TIPS.length];
		return FORK.x + ((tip - FORK.x) * (FORK.y - y)) / (FORK.y - 134);
	};
	/** The climbing fibre: from the olive to the soma, then winding up the trunk and one branch. */
	const cfPts: Point[] = [
		IO,
		{ x: 700, y: 440 },
		{ x: 520, y: 430 },
		{ x: SOMA.x + 14, y: SOMA.y - 4 },
		{ x: SOMA.x + 6, y: 380 },
		{ x: SOMA.x - 5, y: 358 },
		...Array.from({ length: 11 }, (_, k) => {
			const u = k / 10;
			return { x: FORK.x + 44 * u + (k % 2 ? 5 : -5), y: FORK.y - 202 * u };
		})
	];
	const cfPath = `M${cfPts.map((p) => `${p.x} ${p.y}`).join(' L')}`;
	const volleyAt = $derived(volleyU >= 0 ? along(cfPts, volleyU) : null);

	const granules = [110, 150, 190, 230];
	/** Where each fibre meets the fan (its synapse onto the Purkinje cell). */
</script>

<g>
	<Readout id="title" order={0} label="Cerebellar cortex" value="the Marr–Albus–Ito circuit">
		<Label
			x={24}
			y={34}
			anchor="start"
			size={15}
			weight={700}
			text="The cerebellar circuit (Marr–Albus–Ito)"
		/>
	</Readout>

	<!-- molecular layer band -->
	<rect
		x={X0 - 10}
		y="128"
		width={X1 - X0 + 20}
		height="196"
		rx="10"
		fill="var(--cell)"
		opacity="0.5"
	/>

	<!-- parallel fibres -->
	{#each FIBRES as y, i (i)}
		{@const on = ACTIVE.has(i)}
		<line
			x1={X0}
			x2={X1}
			y1={y}
			y2={y}
			stroke="var(--cb-pf)"
			stroke-width={on ? 2 : 1.2}
			opacity={on ? 0.9 : 0.4}
		/>
		{#if on && !reduced}
			{#each [0, 0.5] as off (off)}
				{@const u = cycle(t, 1.6, off + i * 0.13)}
				<circle
					cx={X0 + (X1 - X0) * u}
					cy={y}
					r="4"
					fill="var(--cb-pf)"
					opacity={smoothstep(0, 0.08, u) * (1 - smoothstep(0.9, 1, u))}
				/>
			{/each}
		{/if}
	{/each}

	<!-- granule cells and their ascending axons -->
	{#each granules as gx, i (i)}
		{@const fy = FIBRES[[1, 2, 4, 5][i]]}
		<line
			x1={gx}
			x2={gx}
			y1={462}
			y2={fy}
			stroke="var(--cb-pf)"
			stroke-width="1.2"
			opacity="0.55"
		/>
		<circle cx={gx} cy={470} r="9" fill="var(--surface)" stroke="var(--cb-pf)" stroke-width="1.5" />
	{/each}
	<path
		d="M24 560 C 80 540, 110 510, 130 482"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>
	<path
		d="M24 560 C 120 545, 180 520, 200 482"
		fill="none"
		stroke="var(--stage-ink-muted)"
		stroke-width="1.5"
	/>

	<!-- Purkinje cell -->
	{#each branches as d, i (i)}
		<path
			{d}
			fill="none"
			stroke="var(--cb-pc)"
			stroke-width={i === 0 ? 5 : 3}
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/each}
	<circle cx={SOMA.x} cy={SOMA.y} r="18" fill="var(--cb-pc)" />
	<path
		d="M{SOMA.x} {SOMA.y + 18} C {SOMA.x} 480, 470 {DCN.y}, {DCN.x - 22} {DCN.y}"
		fill="none"
		stroke="var(--cb-pc)"
		stroke-width="2.5"
	/>
	<circle
		cx={DCN.x}
		cy={DCN.y}
		r="20"
		fill="var(--surface)"
		stroke="var(--stage-ink)"
		stroke-width="1.5"
	/>
	<line
		x1={DCN.x + 20}
		x2={DCN.x + 120}
		y1={DCN.y}
		y2={DCN.y}
		stroke="var(--stage-ink)"
		stroke-width="2"
		marker-end="url(#arrowhead)"
	/>

	<!-- synapses on the fan: active ones shrink with each climbing-fibre volley -->
	{#each FIBRES as y, i (i)}
		{@const on = ACTIVE.has(i)}
		{@const w = on ? weight : 1}
		<circle
			cx={synAt(i, y)}
			cy={y}
			r={3 + 5 * w}
			fill={on ? 'var(--cb-pf)' : 'var(--stage-ink-muted)'}
			stroke="var(--stage-bg)"
			stroke-width="1.5"
			opacity={on ? 1 : 0.6}
		/>
	{/each}

	<!-- climbing fibre -->
	<path
		d={cfPath}
		fill="none"
		stroke="var(--cb-cf)"
		stroke-width={2 + 2 * flash}
		stroke-linejoin="round"
		opacity={0.75 + 0.25 * flash}
	/>
	<circle cx={IO.x} cy={IO.y} r="16" fill="var(--cb-cf)" opacity="0.85" />
	{#if volleyAt}
		<circle
			cx={volleyAt.x}
			cy={volleyAt.y}
			r="7"
			fill="var(--cb-cf)"
			stroke="var(--stage-bg)"
			stroke-width="2"
		/>
	{/if}

	<!-- labels -->
	<Readout
		id="pf"
		order={1}
		label="Parallel fibres"
		value="the context (bright: active now)"
		color="var(--cb-pf)"
	>
		<Label
			x={X1}
			y={118}
			anchor="end"
			size={12}
			color="var(--cb-pf)"
			weight={600}
			text="parallel fibres: the context"
		/>
	</Readout>
	<Readout id="gc">
		<Label x={250} y={474} anchor="start" size={12} muted text="granule cells" />
	</Readout>
	<Readout id="mf">
		<Label
			x={60}
			y={584}
			anchor="start"
			size={11}
			muted
			text="mossy fibres: target, arm, command copy"
		/>
	</Readout>
	<Readout
		id="pc"
		order={2}
		label="Purkinje cell"
		value="sums the fibres, inhibits the nucleus"
		color="var(--cb-pc)"
	>
		<Label
			x={SOMA.x - 26}
			y={SOMA.y + 5}
			anchor="end"
			size={12}
			weight={600}
			color="var(--cb-pc)"
			text="Purkinje cell"
		/>
	</Readout>
	<Readout id="dcn">
		<Label x={DCN.x} y={DCN.y + 38} size={11} muted text="deep nucleus" />
		<Label x={DCN.x + 70} y={DCN.y - 10} size={11} muted text="to motor areas" />
		<Label x={470} y={500} anchor="end" size={11} muted text="inhibits" />
	</Readout>
	<Readout
		id="cf"
		order={3}
		label="Climbing fibre"
		value="from the inferior olive: the error"
		color="var(--cb-cf)"
	>
		<Label
			x={IO.x + 24}
			y={IO.y + 4}
			anchor="start"
			size={12}
			weight={600}
			color="var(--cb-cf)"
			text="inferior olive"
		/>
		<Label
			x={600}
			y={424}
			anchor="middle"
			size={12}
			color="var(--cb-cf)"
			text="climbing fibre: the error"
		/>
	</Readout>
	<Readout
		id="ltd"
		order={4}
		label="Active synapses"
		value="{Math.round(weight * 100)}% after {volleys} error volley{volleys === 1 ? '' : 's'}"
	>
		<Label
			x={240}
			y={352}
			anchor="middle"
			size={12}
			tabular
			text="active synapses: {Math.round(weight * 100)}% · error volleys: {volleys}"
		/>
	</Readout>

	<!-- the mapping -->
	<Readout id="map">
		<rect
			x="640"
			y="120"
			width="300"
			height="196"
			rx="10"
			fill="var(--surface)"
			stroke="var(--border)"
		/>
		<Label
			x={656}
			y={146}
			anchor="start"
			size={13}
			weight={700}
			halo={false}
			text="x(n+1) = A·x(n) + B·e(n)"
		/>
		<Label
			x={656}
			y={176}
			anchor="start"
			size={12}
			halo={false}
			color="var(--cb-cf)"
			text="e: a climbing-fibre volley"
		/>
		<Label
			x={656}
			y={198}
			anchor="start"
			size={11}
			muted
			halo={false}
			text="fires more after an unexpected error"
		/>
		<Label
			x={656}
			y={226}
			anchor="start"
			size={12}
			halo={false}
			color="var(--cb-pf)"
			text="B·e: the active synapses weaken"
		/>
		<Label
			x={656}
			y={248}
			anchor="start"
			size={11}
			muted
			halo={false}
			text="long-term depression (Ito)"
		/>
		<Label
			x={656}
			y={276}
			anchor="start"
			size={12}
			halo={false}
			text="x: the weights; A: their slow drift back"
		/>
		<Label
			x={656}
			y={298}
			anchor="start"
			size={11}
			muted
			halo={false}
			text="a model of the circuit, not a proven map"
		/>
	</Readout>
</g>
