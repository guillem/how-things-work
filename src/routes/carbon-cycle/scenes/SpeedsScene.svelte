<script lang="ts">
	/**
	 * How long a carbon atom typically stays in each store (turnover time =
	 * stock ÷ flow out, pre-industrial), on a logarithmic time axis from a year
	 * to a billion years. Fossil fuels have no natural turnover worth the name:
	 * the bar is the time they took to form. The red arrow is how long today's
	 * burning would take to empty the proven reserves.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Label, smoothstep } from '#lib/draw/index.ts';
	import { BUDGET, FOSSIL_RESERVES, NATURAL, PRE, ROCK } from '../data';

	let { t, reduced }: StageProps = $props();
	const time = $derived(reduced ? 10 : t);

	const X0 = 250;
	const X1 = 920;
	const DECADES = 9; // 10⁰ … 10⁹ years
	const sx = (years: number) => X0 + (Math.log10(years) / DECADES) * (X1 - X0);

	interface Bar {
		id: string;
		name: string;
		from?: number;
		years: number;
		color: string;
		fill: string;
		text: string;
		loop: 'fast' | 'slow';
		/** Where the text goes: after the bar (default), inside it, or before it. */
		place?: 'inside' | 'before';
	}
	const BARS: Bar[] = [
		{
			id: 'surface',
			name: 'surface ocean',
			years: PRE.surfaceOcean / (NATURAL.oceanOut + NATURAL.subduction + NATURAL.export),
			color: 'var(--cc-ocean)',
			fill: 'var(--cc-surface-fill)',
			text: '≈ 3 years',
			loop: 'fast'
		},
		{
			id: 'air',
			name: 'air',
			years: PRE.atmosphere / (NATURAL.photosynthesis + NATURAL.oceanIn + NATURAL.weathering),
			color: 'var(--cc-air)',
			fill: 'var(--cc-air-fill)',
			text: '≈ 4 years',
			loop: 'fast'
		},
		{
			id: 'plants',
			name: 'plants',
			years: PRE.plants / NATURAL.npp,
			color: 'var(--cc-plants)',
			fill: 'var(--cc-plants-fill)',
			text: '≈ 8 years',
			loop: 'fast'
		},
		{
			id: 'soils',
			name: 'soils',
			years: PRE.soils / NATURAL.npp,
			color: 'var(--cc-soil)',
			fill: 'var(--cc-soil-fill)',
			text: '≈ 30 years',
			loop: 'fast'
		},
		{
			id: 'deep',
			name: 'deep ocean',
			years: PRE.deepOcean / NATURAL.obduction,
			color: 'var(--cc-ocean)',
			fill: 'var(--cc-deep-fill)',
			text: '≈ 140 years',
			loop: 'fast'
		},
		{
			id: 'fossil',
			name: 'fossil fuels',
			from: 1e7,
			years: 3e8,
			color: 'var(--cc-fossil)',
			fill: 'var(--cc-fossil-fill)',
			text: 'formed over 10–300 million years',
			place: 'before',
			loop: 'slow'
		},
		{
			id: 'rock',
			name: 'rock',
			years: ROCK / NATURAL.seafloorBurial,
			color: 'var(--cc-rock)',
			fill: 'var(--cc-rock-fill)',
			text: '≈ 400 million years',
			place: 'inside',
			loop: 'slow'
		}
	];
	const ROW0 = 96;
	const ROW = 52;
	const rowY = (i: number) => ROW0 + i * ROW + (i >= 5 ? 26 : 0);

	const grow = (i: number) => smoothstep(0.2 + i * 0.15, 1.1 + i * 0.15, time);
	const TICKS = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
	const tickText = [
		'1 year',
		'10',
		'100',
		'1,000',
		'10⁴',
		'10⁵',
		'a million',
		'10⁷',
		'10⁸',
		'a billion'
	];
	const burnYears = FOSSIL_RESERVES / BUDGET.fossil;
	const arrowIn = $derived(smoothstep(1.6, 2.3, time));
</script>

<g>
	<Label
		x={480}
		y={36}
		text="How long a carbon atom typically stays in each store"
		size={16}
		weight={700}
	/>
	<Label
		x={480}
		y={58}
		text="years, logarithmic: each mark is ten times the last"
		size={12}
		muted
	/>

	<!-- axis -->
	{#each TICKS as v, i (v)}
		<line x1={sx(v)} x2={sx(v)} y1={78} y2={500} stroke="var(--stage-grid)" />
		<Readout id="tick-{i}">
			<Label x={sx(v)} y={520} text={tickText[i]} size={11} muted />
		</Readout>
	{/each}
	<line x1={X0} x2={X1} y1={502} y2={502} stroke="var(--stage-line)" />
	<Label x={(X0 + X1) / 2} y={546} text="years" size={12} muted />

	<!-- loops -->
	<rect
		x={24}
		y={ROW0 - 24}
		width={214}
		height={5 * ROW - 6}
		rx="8"
		fill="var(--cc-sky)"
		stroke="var(--cc-air)"
		stroke-dasharray="5 4"
	/>
	<rect
		x={24}
		y={rowY(5) - 24}
		width={214}
		height={2 * ROW - 6}
		rx="8"
		fill="var(--cc-ground)"
		stroke="var(--cc-rock)"
		stroke-dasharray="5 4"
	/>
	<Readout
		id="fast"
		order={1}
		label="Fast loop: air, surface ocean, plants, soils"
		value="a few years to decades"
	>
		<Label
			x={230}
			y={ROW0 + 5 * ROW - 38}
			text="fast loop"
			anchor="end"
			size={12}
			weight={700}
			color="var(--cc-air)"
		/>
	</Readout>

	{#each BARS as b, i (b.id)}
		{@const y = rowY(i)}
		{@const x0 = b.from ? sx(b.from) : X0}
		{@const x1 = x0 + (sx(b.years) - x0) * grow(i)}
		<Label x={40} y={y + 5} text={b.name} anchor="start" size={13} weight={600} />
		<rect
			x={x0}
			y={y - 11}
			width={Math.max(0, x1 - x0)}
			height="22"
			rx="4"
			fill={b.fill}
			stroke={b.color}
		/>
		<Readout id="bar-{b.id}">
			<Label
				x={b.place === 'inside' ? x0 + 10 : b.place === 'before' ? x0 - 8 : x1 + 8}
				y={y + 5}
				text={b.text}
				anchor={b.place === 'before' ? 'end' : 'start'}
				size={12}
				opacity={smoothstep(0.6, 1, grow(i))}
			/>
		</Readout>
	{/each}
	<Readout id="deep" order={2} label="Deep ocean" value="about 140 years on average" />
	<Readout
		id="slow"
		order={3}
		label="Slow loop: fossil fuels and rock"
		value="tens to hundreds of millions of years"
	>
		<Label x={230} y={rowY(6) + 32} text="slow loop" anchor="end" size={12} weight={700} />
	</Readout>

	<!-- burning the reserves -->
	<g opacity={arrowIn}>
		<path
			d="M{sx(1e7)} {rowY(5) - 12} Q {sx(1e5)} {rowY(5) - 56}, {sx(burnYears)} {rowY(5) - 14}"
			fill="none"
			stroke="var(--cc-human)"
			stroke-width="2.5"
			marker-end="url(#arrowhead)"
		/>
		<Readout
			id="burn"
			order={4}
			label="Burning the proven reserves at today's rate"
			value="about {Math.round(burnYears)} years"
			color="var(--cc-human)"
		>
			<Label
				x={sx(2e4)}
				y={rowY(5) - 46}
				text="burnt at today's rate: about {Math.round(burnYears)} years"
				size={12}
				weight={700}
				color="var(--cc-human)"
				pill
			/>
		</Readout>
	</g>
	<Readout id="note">
		<Label
			x={480}
			y={572}
			text="how long one atom stays, not how long an extra amount lasts"
			size={11}
			muted
		/>
	</Readout>
</g>
