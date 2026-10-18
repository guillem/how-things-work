<script lang="ts">
	/**
	 * Two clocks. Above: this year's fossil-fuel carbon against the volcanoes' (to scale, in
	 * billion tonnes of carbon a year). Below: a logarithmic time line from a year to ten
	 * million years with what removes fossil CO₂ and how long it takes (Archer et al. 2009):
	 * the ocean in centuries, the sea-floor limestone in thousands of years, silicate
	 * weathering in hundreds of thousands, with this box's e-folding time marked, beside a
	 * human lifetime and the industrial era. A sweep along the time line reveals the bars,
	 * then holds.
	 */
	import { Label, clamp, scale, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { P0, VOLCANIC_PGC, eFoldingYears, run } from '../model';

	let { t, reduced }: StageProps = $props();

	const FOSSIL = 10; // billion tonnes of carbon a year (Global Carbon Budget, rounded)
	const EFOLD = eFoldingYears(run({ ppm: 2 * P0, years: 3e6, samples: 300 }), P0)!;

	const X0 = 120;
	const X1 = 900;
	const sx = scale([0, 7], [X0, X1]); // log10 years
	const lx = (y: number) => sx(Math.log10(y));
	const sweep = $derived(reduced ? 7 : 7 * smoothstep(0.5, 9, t));
	const shown = (a: number) => clamp((sweep - Math.log10(a)) * 2);

	const bars = [
		{
			id: 'ocean',
			a: 200,
			b: 2000,
			text: 'the ocean takes up most of it',
			sub: 'centuries',
			y: 300,
			color: 'var(--cst-ocean)'
		},
		{
			id: 'lime',
			a: 3000,
			b: 7000,
			text: 'sea-floor limestone dissolves',
			sub: 'thousands of years',
			y: 370,
			color: 'var(--cst-lime-edge)'
		},
		{
			id: 'rock',
			a: 1e5,
			b: 1e6,
			text: 'silicate weathering, the thermostat',
			sub: 'hundreds of thousands of years',
			y: 440,
			color: 'var(--cst-co2)'
		}
	];
	const FY = 120;
	const fx = scale([0, 10], [X0, 560]);
</script>

<g>
	<Readout id="title">
		<Label
			x={X0}
			y={44}
			text="Two clocks: carbon in, and how long the slow cycle takes to take it out"
			anchor="start"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- fluxes to scale -->
	<rect
		x={fx(0)}
		y={FY - 14}
		width={fx(FOSSIL) - fx(0)}
		height="24"
		rx="3"
		fill="var(--cst-temp)"
		opacity="0.8"
	/>
	<rect
		x={fx(0)}
		y={FY + 26}
		width={Math.max(2, fx(VOLCANIC_PGC) - fx(0))}
		height="24"
		rx="1"
		fill="var(--cst-volc)"
	/>
	<Readout
		id="fossil"
		order={1}
		label="Fossil fuels"
		value="about {FOSSIL} billion tonnes of carbon a year"
		color="var(--cst-temp)"
	>
		<Label
			x={fx(FOSSIL) + 10}
			y={FY + 3}
			text="fossil fuels: ~{FOSSIL} billion t of carbon a year"
			anchor="start"
			weight={600}
		/>
	</Readout>
	<Readout
		id="volc"
		order={2}
		label="Volcanoes"
		value="about {VOLCANIC_PGC.toFixed(2)} billion tonnes a year"
		color="var(--cst-volc)"
	>
		<Label
			x={fx(0) + 12}
			y={FY + 43}
			text="volcanoes: ~{VOLCANIC_PGC.toFixed(2)}, about a hundred times less"
			anchor="start"
			weight={600}
		/>
	</Readout>

	<!-- the time line -->
	<line x1={X0} x2={X1} y1={520} y2={520} stroke="var(--stage-line)" stroke-width="1.5" />
	{#each [0, 1, 2, 3, 4, 5, 6, 7] as e (e)}
		<line x1={sx(e)} x2={sx(e)} y1={514} y2={526} stroke="var(--stage-line)" />
		<line x1={sx(e)} x2={sx(e)} y1={250} y2={514} stroke="var(--stage-grid)" />
		<text x={sx(e)} y={546} text-anchor="middle" font-size="11" class="muted"
			>{['1', '10', '100', '1,000', '10,000', '100,000', '1 million', '10 million'][e]}</text
		>
	{/each}
	<text x={X1} y={568} text-anchor="end" font-size="11" class="muted"
		>years after the carbon goes in</text
	>

	<!-- human times -->
	<g opacity={shown(80)}>
		<line x1={lx(80)} x2={lx(80)} y1={482} y2={520} stroke="var(--stage-ink)" stroke-width="2" />
		<Readout
			id="life"
			order={5}
			label="A human lifetime"
			value="about 80 years"
			opacity={shown(80)}
		>
			<Label x={lx(80) - 4} y={494} text="a lifetime" anchor="end" size={12} weight={600} />
		</Readout>
	</g>
	<g opacity={shown(175)}>
		<line
			x1={lx(175)}
			x2={lx(175)}
			y1={482}
			y2={520}
			stroke="var(--cst-temp)"
			stroke-width="2"
			stroke-dasharray="4 3"
		/>
		<Readout
			id="industry"
			order={6}
			label="Industry so far"
			value="about 175 years"
			color="var(--cst-temp)"
			opacity={shown(175)}
		>
			<Label
				x={lx(175) + 4}
				y={494}
				text="industry so far"
				anchor="start"
				size={12}
				weight={600}
				color="var(--cst-temp)"
			/>
		</Readout>
	</g>

	{#each bars as b (b.id)}
		{@const o = shown(b.a)}
		<g opacity={o}>
			<rect
				x={lx(b.a)}
				y={b.y - 12}
				width={lx(b.b) - lx(b.a)}
				height="22"
				rx="11"
				fill={b.color}
				opacity="0.85"
			/>
			<Readout id={b.id} order={3} label={b.text} value={b.sub} color={b.color} opacity={o}>
				<Label
					x={lx(b.b)}
					y={b.y - 20}
					text="{b.text}: {b.sub}"
					anchor="end"
					size={12}
					weight={600}
				/>
			</Readout>
		</g>
	{/each}
	<g opacity={shown(EFOLD)}>
		<circle
			cx={lx(EFOLD)}
			cy={440}
			r="6"
			fill="var(--stage-bg)"
			stroke="var(--stage-ink)"
			stroke-width="2"
		/>
		<Readout
			id="box"
			order={4}
			label="This page’s box"
			value="e-folding about {(Math.round(EFOLD / 10000) * 10000).toLocaleString('en-US')} years"
			opacity={shown(EFOLD)}
		>
			<Label x={lx(EFOLD)} y={472} text="this page’s box" size={11} muted />
		</Readout>
	</g>
</g>
