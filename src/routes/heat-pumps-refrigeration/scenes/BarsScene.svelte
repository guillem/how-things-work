<script lang="ts">
	/**
	 * Where a heat pump's heat comes from, for one unit of work: the work itself plus the heat taken
	 * from outside, against the heat delivered and the Carnot ceiling (R-134a, with the compressor,
	 * superheat and subcooling the reader set).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { cycle } from '../model';

	let { params }: StageProps = $props();

	const K = (c: number) => c + 273.15;
	const c = $derived(
		cycle({
			fluid: 'r134a',
			tEvap: K(Number(params.tevap ?? 0)),
			high: { tCond: K(Number(params.tcond ?? 40)) },
			eta: Number(params.eta ?? 0.75),
			superheat: Number(params.superheat ?? 5),
			subcool: Number(params.subcool ?? 5)
		})
	);
	const U = $derived(700 / Math.max(c.carnotHeating, c.copHeating, 1));
	const X = 150;
</script>

<g class="hp-bars">
	<Readout
		id="hp-in"
		order={1}
		label="In"
		value="1 unit of electricity + {(c.copHeating - 1).toFixed(2)} units of heat from outside"
	>
		<Label x={X - 12} y={176} text="in" anchor="end" size={15} weight={600} />
		<rect x={X} y={150} width={U} height="44" rx="4" fill="var(--hp-work)" />
		<rect
			x={X + U + 2}
			y={150}
			width={Math.max(0, (c.copHeating - 1) * U - 2)}
			height="44"
			rx="4"
			fill="var(--hp-cold)"
		/>
		<Label
			x={X + U / 2}
			y={177}
			text="work 1"
			anchor="middle"
			size={14}
			weight={700}
			color="#fff"
			halo={false}
		/>
		<Label
			x={X + U + ((c.copHeating - 1) * U) / 2}
			y={177}
			text="heat from outside {(c.copHeating - 1).toFixed(1)}"
			anchor="middle"
			size={14}
			weight={700}
			color="#fff"
			halo={false}
		/>
	</Readout>
	<Readout
		id="hp-out"
		order={2}
		label="Out"
		value="{c.copHeating.toFixed(2)} units of heat delivered"
	>
		<Label x={X - 12} y={276} text="out" anchor="end" size={15} weight={600} />
		<rect x={X} y={250} width={c.copHeating * U} height="44" rx="4" fill="var(--hp-hot)" />
		<Label
			x={X + (c.copHeating * U) / 2}
			y={277}
			text="heat delivered {c.copHeating.toFixed(1)}"
			anchor="middle"
			size={14}
			weight={700}
			color="#fff"
			halo={false}
		/>
	</Readout>
	<Readout id="hp-limit" order={3} label="Carnot ceiling" value={c.carnotHeating.toFixed(2)}>
		<line
			x1={X + c.carnotHeating * U}
			y1={130}
			x2={X + c.carnotHeating * U}
			y2={320}
			stroke="var(--text)"
			stroke-dasharray="6 4"
			stroke-width="2"
		/>
		<Label
			x={X + c.carnotHeating * U}
			y={344}
			text="Carnot ceiling {c.carnotHeating.toFixed(1)}"
			anchor="middle"
			size={13}
			weight={600}
		/>
	</Readout>
	<Label
		x={480}
		y={420}
		text="Energy is conserved: what comes out is the work plus the heat moved in from outside."
		anchor="middle"
		size={14}
		muted
	/>
</g>
