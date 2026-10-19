<script lang="ts">
	/**
	 * The memory hierarchy as a race: one load sent from the core to each level at once, the
	 * lane to each level as long as its latency in cycles (../model.ts LATENCY, 7-cpu.com's
	 * Skylake figures), the load running out and back at a fixed number of cycles per second
	 * and sent again as soon as it returns. Counters show the cycles elapsed and the loads each
	 * level has answered. Reduced motion: the moment the first DRAM load is back.
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { LATENCY, SKYLAKE, bytes } from '../model';

	let { t, reduced }: StageProps = $props();

	/** Seconds of animation per cycle: a DRAM round trip takes 4 s. */
	const K = 0.016;
	const cycles = $derived(reduced ? LATENCY.mem : Math.max(0, t - 0.6) / K);

	const levels = [
		{ id: 'l1', name: 'L1', size: bytes(SKYLAKE.l1.size), lat: LATENCY.l1, colour: 'var(--cm-l1)' },
		{ id: 'l2', name: 'L2', size: bytes(SKYLAKE.l2.size), lat: LATENCY.l2, colour: 'var(--cm-l2)' },
		{ id: 'l3', name: 'L3', size: bytes(SKYLAKE.l3.size), lat: LATENCY.l3, colour: 'var(--cm-l3)' },
		{ id: 'mem', name: 'DRAM', size: 'gigabytes', lat: LATENCY.mem, colour: 'var(--cm-mem)' }
	];
	const CORE_X = 40;
	const CORE_W = 120;
	const LANE0 = CORE_X + CORE_W + 8;
	const PX_PER_CYCLE = 2.6;
	const BOX_W = 116;
	const rowY = (i: number) => 140 + i * 104;

	const rows = $derived(
		levels.map((l, i) => {
			const len = l.lat * PX_PER_CYCLE;
			const done = Math.floor(cycles / l.lat + 1e-9);
			const phase = cycles / l.lat - done;
			const out = 1 - Math.abs(1 - 2 * phase);
			return { ...l, i, y: rowY(i), len, done, x: LANE0 + len * out };
		})
	);
</script>

<g>
	<Readout id="title" order={1} label="Cycles elapsed" value={Math.floor(cycles).toString()}>
		<Label
			x={24}
			y={34}
			text="one load to each level at once · {Math.floor(cycles)} cycles"
			size={15}
			weight={600}
			anchor="start"
			tabular
		/>
		<Label
			x={24}
			y={56}
			text="lane length ∝ latency; Intel Core i7-6700 at 4 GHz (7-cpu.com)"
			size={11}
			anchor="start"
			muted
		/>
	</Readout>

	<!-- the core -->
	<rect
		x={CORE_X}
		y={rowY(0) - 30}
		width={CORE_W}
		height={rowY(3) - rowY(0) + 60}
		rx="10"
		fill="var(--protein)"
		stroke="var(--protein-edge)"
	/>
	<Label
		x={CORE_X + CORE_W / 2}
		y={(rowY(0) + rowY(3)) / 2 - 6}
		text="processor"
		size={14}
		weight={600}
	/>
	<Label x={CORE_X + CORE_W / 2} y={(rowY(0) + rowY(3)) / 2 + 14} text="core" size={12} muted />

	{#each rows as r (r.id)}
		<line
			x1={LANE0}
			x2={LANE0 + r.len}
			y1={r.y}
			y2={r.y}
			stroke={r.colour}
			stroke-width="2"
			stroke-dasharray="2 5"
			opacity="0.6"
		/>
		<rect
			x={LANE0 + r.len}
			y={r.y - 32}
			width={BOX_W}
			height={64}
			rx="8"
			fill={r.colour}
			fill-opacity="0.18"
			stroke={r.colour}
			stroke-width="1.5"
		/>
		<Label
			x={LANE0 + r.len + BOX_W / 2}
			y={r.y - 8}
			text={r.name}
			size={15}
			weight={700}
			color={r.colour}
		/>
		<Label x={LANE0 + r.len + BOX_W / 2} y={r.y + 10} text={r.size} size={11} muted halo={false} />
		<Label
			x={LANE0 + r.len + BOX_W / 2}
			y={r.y + 25}
			text="{r.lat} cycles"
			size={11}
			muted
			halo={false}
		/>
		{#if r.len > 30}
			<circle cx={r.x} cy={r.y} r="7" fill={r.colour} />
		{/if}
		<Readout
			id={r.id}
			order={2 + r.i}
			label="{r.name}, {r.lat} cycles"
			value="{r.done} load{r.done === 1 ? '' : 's'} back"
			color={r.colour}
		>
			<Label
				x={r.id === 'mem' ? LANE0 + r.len - 10 : 936}
				y={r.id === 'mem' ? r.y - 40 : r.y + 5}
				text="{r.done} load{r.done === 1 ? '' : 's'} back"
				size={13}
				weight={600}
				anchor="end"
				color={r.colour}
				tabular
			/>
		</Readout>
	{/each}
</g>
