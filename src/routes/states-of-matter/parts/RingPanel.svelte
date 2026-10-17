<script lang="ts">
	/**
	 * A close-up of one hexagon of the box's ice: six water molecules of the
	 * Mercedes-Benz model, each with three arms 120° apart, joined by hydrogen
	 * bonds along the ring's edges, the third arm bonding outwards to the next
	 * ring. The molecules vibrate a little (a pure function of t).
	 */
	import { Label } from '#lib/draw/index.ts';
	import { Readout } from '#lib/explainer/index.ts';

	interface Props {
		t: number;
	}
	let { t }: Props = $props();

	const CX = 680;
	const CY = 232;
	const L = 92;
	const R = 17;
	const ARM = 30;

	const mols = $derived(
		Array.from({ length: 6 }, (_, k) => {
			const a = (Math.PI / 3) * k + Math.PI / 6;
			const wob = 2.2 * Math.sin(t * 5.3 + k * 1.9);
			const x = CX + L * Math.cos(a) + wob * Math.cos(a + 1);
			const y = CY + L * Math.sin(a) + wob * Math.sin(a + 1);
			// arms: outward, and along the two ring edges (120° from it)
			const arms = [a, a + (2 * Math.PI) / 3, a - (2 * Math.PI) / 3];
			return { k, a, x, y, arms };
		})
	);
	const arms = $derived(
		mols
			.flatMap((m) =>
				m.arms.map(
					(b) =>
						`M${m.x.toFixed(1)} ${m.y.toFixed(1)} L${(m.x + ARM * Math.cos(b)).toFixed(1)} ${(m.y + ARM * Math.sin(b)).toFixed(1)}`
				)
			)
			.join(' ')
	);
	const bonds = $derived(
		mols
			.map((m, k) => {
				const n = mols[(k + 1) % 6];
				return `M${m.x.toFixed(1)} ${m.y.toFixed(1)} L${n.x.toFixed(1)} ${n.y.toFixed(1)}`;
			})
			.join(' ')
	);
	const outward = $derived(
		mols
			.map(
				(m) =>
					`M${m.x.toFixed(1)} ${m.y.toFixed(1)} L${(m.x + 0.8 * L * Math.cos(m.a)).toFixed(1)} ${(m.y + 0.8 * L * Math.sin(m.a)).toFixed(1)}`
			)
			.join(' ')
	);
	const m0 = $derived(mols[0]);
	const m5 = $derived(mols[5]);
</script>

<g>
	<Readout id="ring-title">
		<Label x={430} y={64} text="one ring of the ice, close up" size={13} anchor="start" muted />
	</Readout>
	<path
		d={outward}
		fill="none"
		stroke="var(--som-bond)"
		stroke-width="2"
		stroke-dasharray="5 5"
		opacity="0.45"
	/>
	<path d={bonds} fill="none" stroke="var(--som-bond)" stroke-width="2.5" stroke-dasharray="6 5" />
	<path d={arms} fill="none" stroke="var(--som-arm)" stroke-width="3" stroke-linecap="round" />
	{#each mols as m (m.k)}
		<circle
			cx={m.x}
			cy={m.y}
			r={R}
			fill="var(--som-water)"
			stroke="var(--stage-bg)"
			stroke-width="1.5"
		/>
	{/each}

	<Readout id="open" order={12} label="open space" marker={2} at={[CX, CY]}>
		<Label x={CX} y={CY + 5} text="open space" size={12} muted />
	</Readout>
	<Readout
		id="hbond"
		order={11}
		label="hydrogen bond (dashed)"
		marker={1}
		at={[(m0.x + m5.x) / 2 + 40, (m0.y + m5.y) / 2 - 4]}
	>
		<Label
			x={(m0.x + m5.x) / 2 + 14}
			y={(m0.y + m5.y) / 2}
			text="hydrogen bond"
			size={12}
			anchor="start"
			color="var(--som-bond)"
			weight={600}
		/>
	</Readout>
	<Readout id="next" order={13} label="to the next ring" marker={3} at={[m0.x + 70, m0.y + 36]}>
		<Label x={m0.x + 46} y={m0.y + 40} text="to the next ring" size={11} anchor="start" muted />
	</Readout>

	<Readout
		id="ring"
		order={4}
		label="One ring of the ice"
		value="molecules stand apart around open hexagons"
		note="each bonds along its three arms; in real ice, in 3D, each bonds to four neighbours, and the crystal has hexagonal channels"
	>
		<Label
			x={430}
			y={420}
			text="Each molecule bonds along its three arms, so the"
			size={13}
			anchor="start"
		/>
		<Label
			x={430}
			y={440}
			text="molecules stand apart around open hexagons."
			size={13}
			anchor="start"
		/>
		<Label
			x={430}
			y={472}
			text="In real ice, in 3D, each molecule bonds to four"
			size={13}
			anchor="start"
			muted
		/>
		<Label
			x={430}
			y={492}
			text="neighbours, and the crystal has hexagonal channels."
			size={13}
			anchor="start"
			muted
		/>
	</Readout>
</g>
