<script lang="ts">
	/**
	 * The end of a 20 M☉ star: the onion of burning shells, the collapse of the iron core and
	 * the supernova, as one sequence driven by t (then held):
	 *   0–12 s   the layers appear from the outside in, each fuel's stage highlighted in the list
	 *            (durations and temperatures: Heger et al. 2003, Table 1, via BURNING_STAGES)
	 *   12–15 s  the iron core grows and pulses: fusion has stopped paying
	 *   15–17 s  the core collapses to a neutron star
	 *   17–26 s  the shock blows the layers outwards as a supernova, neutrinos stream out
	 * The onion's proportions are a sketch (the page says so). Under reduced motion the frame is
	 * the finished onion, with the outcome in the caption.
	 */
	import { TAU, clamp, cycle, lerp, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import Txt from './Txt.svelte';
	import { BURNING_STAGES, years } from '../star';

	let { t, reduced }: StageProps = $props();

	const CX = 290;
	const CY = 280;
	const R = 230;
	// Layers from the outside in; `stage` is the BURNING_STAGES row whose ash fills the layer.
	const LAYERS = [
		{ key: 'h', r: 1, colour: 'var(--st-h)', name: 'hydrogen envelope' },
		{ key: 'he', r: 0.74, colour: 'var(--st-he)', name: 'helium' },
		{ key: 'co', r: 0.58, colour: 'var(--st-co)', name: 'carbon, oxygen' },
		{ key: 'ne', r: 0.45, colour: 'var(--st-ne)', name: 'oxygen, neon, magnesium' },
		{ key: 'o', r: 0.33, colour: 'var(--st-o)', name: 'silicon, sulfur' },
		{ key: 'fe', r: 0.17, colour: 'var(--st-fe)', name: 'iron' }
	];
	const TS = [0.4, 2.2, 4.0, 5.8, 7.6, 9.4]; // when each layer appears
	/** The layer made of each stage’s ash (neon burning adds to the O, Ne, Mg layer). */
	const ASH = [1, 2, 3, 3, 4, 5];
	const time = $derived(reduced ? 12 : t);
	const appear = (k: number) => smoothstep(TS[k], TS[k] + 1, time);
	const activeStage = $derived(
		reduced ? -1 : time < 11 ? Math.min(5, Math.max(0, Math.floor((time - 0.4) / 1.8))) : -1
	);
	const ironGrow = $derived(smoothstep(11, 14.5, time));
	const collapse = $derived(smoothstep(15, 16.4, time));
	const boom = $derived(smoothstep(16.6, 25, time));
	const shock = $derived(smoothstep(16.4, 22, time));

	const ironR = $derived(lerp(0.17, 0.22, ironGrow) * R * (1 - 0.93 * collapse));
	/** Every layer falls in a little during the collapse, then flies outwards. */
	const scaleOf = (k: number) =>
		k === LAYERS.length - 1 ? 1 : (1 - 0.06 * collapse * (1 - boom)) * (1 + 0.9 * boom);
	const fadeOut = $derived(1 - smoothstep(18, 25, time));

	const DEBRIS = Array.from({ length: 36 }, (_, i) => ({
		i,
		a: (i * 137.5 * Math.PI) / 180,
		layer: i % 5,
		speed: 0.7 + ((i * 37) % 10) / 20
	}));
	const NEUTRINOS = Array.from({ length: 16 }, (_, i) => ({ i, a: (i * TAU) / 16 + 0.1 }));
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.sin(time * 6));

	// The list on the right.
	const LIST = { x: 588, y: 60 };
	const caption = $derived(
		reduced
			? 'then the iron core collapses into a neutron star, and the star explodes'
			: time < 11
				? 'each fuel burns at the centre, then in a shell'
				: time < 15
					? 'iron: fusing it would absorb energy, so the core can only grow'
					: time < 16.6
						? 'the iron core collapses in less than a second'
						: 'supernova: the star is blown apart; a neutron star is left'
	);
</script>

<g>
	<!-- neutrinos streaming out of the collapsed core -->
	{#if collapse > 0.5 && !reduced}
		{#each NEUTRINOS as nu (nu.i)}
			{@const p = cycle(time, 1.4, nu.i / 16)}
			{@const r0 = 20 + p * 300}
			<line
				x1={CX + r0 * Math.cos(nu.a)}
				y1={CY + r0 * Math.sin(nu.a)}
				x2={CX + (r0 + 16) * Math.cos(nu.a)}
				y2={CY + (r0 + 16) * Math.sin(nu.a)}
				stroke="var(--stage-ink-muted)"
				stroke-width="1.2"
				stroke-dasharray="2 3"
				opacity={(1 - p) * fadeOut}
			/>
		{/each}
	{/if}

	<!-- the layers -->
	<g opacity={fadeOut}>
		{#each LAYERS as l, k (l.key)}
			{#if k < LAYERS.length - 1}
				<circle
					cx={CX}
					cy={CY}
					r={l.r * R * scaleOf(k)}
					fill={l.colour}
					opacity={appear(k) * (boom > 0 ? 1 - boom * 0.6 : 1)}
					stroke="var(--border)"
					stroke-width="0.8"
				/>
			{/if}
		{/each}
		<!-- shells still burning round the core -->
		{#if time < 15}
			{#each LAYERS.slice(1, 5) as l, k (l.key)}
				<circle
					cx={CX}
					cy={CY}
					r={LAYERS[k + 2].r * R}
					fill="none"
					stroke="var(--st-burn)"
					stroke-width="2"
					opacity={0.7 * appear(k + 2)}
				/>
			{/each}
		{/if}
	</g>

	<!-- the shock and the debris -->
	{#if boom > 0.001}
		<circle
			cx={CX}
			cy={CY}
			r={20 + shock * 300}
			fill="none"
			stroke="#ffd43b"
			stroke-width={6 * (1 - shock) + 1}
			opacity={1 - shock}
		/>
		{#each DEBRIS as d (d.i)}
			{@const r = 40 + boom * 300 * d.speed}
			<circle
				cx={CX + r * Math.cos(d.a)}
				cy={CY + r * Math.sin(d.a)}
				r="5"
				fill={LAYERS[d.layer + 1].colour}
				stroke="var(--border)"
				opacity={1 - smoothstep(0.7, 1, boom)}
			/>
		{/each}
	{/if}

	<!-- the iron core, then the neutron star -->
	<circle
		cx={CX}
		cy={CY}
		r={Math.max(4, ironR)}
		fill={collapse > 0.9 ? '#d0bfff' : 'var(--st-fe)'}
		opacity={appear(5)}
		stroke={collapse > 0.9 ? '#7048e8' : 'var(--border)'}
	/>
	{#if ironGrow > 0 && collapse < 0.9}
		<circle
			cx={CX}
			cy={CY}
			r={ironR + 6 + 4 * pulse}
			fill="none"
			stroke="var(--st-fe)"
			stroke-width="2"
			opacity={ironGrow * (1 - collapse)}
		/>
	{/if}
	{#if collapse > 0.9}
		<circle cx={CX} cy={CY} r={14 + 6 * pulse} fill="#b197fc" opacity="0.35" />
		<Readout id="ns" order={3} label="Left behind" value="a neutron star, about 12 km in radius">
			<Txt x={CX} y={CY + 40} text="neutron star, ~12 km" size={13} weight={700} />
		</Readout>
	{:else if appear(5) > 0.5}
		<Txt x={CX} y={CY + 4} text="iron" size={12} weight={700} color="#f8f9fa" />
	{/if}

	<!-- the list of burning stages -->
	<rect
		x={LIST.x - 16}
		y={LIST.y - 34}
		width="372"
		height="330"
		rx="12"
		fill="var(--surface)"
		stroke="var(--border)"
	/>
	<Txt
		x={LIST.x}
		y={LIST.y - 6}
		text="Burning stages of a 20 M☉ star"
		size={15}
		weight={700}
		anchor="start"
	/>
	{#each BURNING_STAGES as s, k (s.fuel)}
		{@const y = LIST.y + 30 + k * 44}
		{@const on = activeStage === k}
		{@const l = LAYERS[ASH[k]]}
		{#if on}
			<rect
				x={LIST.x - 8}
				y={y - 20}
				width="356"
				height="40"
				rx="8"
				fill="var(--st-burn)"
				opacity="0.12"
			/>
		{/if}
		<rect
			x={LIST.x}
			y={y - 12}
			width="14"
			height="14"
			rx="3"
			fill={l.colour}
			stroke="var(--border)"
		/>
		<Readout id="stage-{k}" order={10 + k} label="{s.fuel} → {s.products}" value={years(s.years)}>
			<Txt
				x={LIST.x + 24}
				{y}
				text="{s.fuel} → {s.products}"
				anchor="start"
				size={13}
				weight={on ? 700 : 500}
			/>
			<Txt x={LIST.x + 340} {y} text={years(s.years)} anchor="end" size={13} weight={600} />
			<Txt
				x={LIST.x + 24}
				y={y + 16}
				text="at {(s.T / 1e6).toLocaleString('en-US')} million K"
				anchor="start"
				size={11}
				muted
			/>
		</Readout>
	{/each}
	<Readout id="src">
		<Txt
			x={LIST.x}
			y={LIST.y + 286}
			text="Heger et al. 2003 · layers drawn as a sketch"
			anchor="start"
			size={11}
			muted
		/>
	</Readout>

	<!-- caption -->
	<Readout id="caption" order={1} label="Now" value={caption}>
		<Txt x={CX} y={574} text={caption} size={14} weight={600} />
	</Readout>
	{#if time > 16.6 || reduced}
		<Readout
			id="bh"
			order={2}
			label="In the heaviest stars"
			value="the core falls back into a black hole"
		>
			<Txt
				x={LIST.x}
				y={LIST.y + 340}
				text="in the heaviest stars: a black hole instead"
				anchor="start"
				size={12}
				muted
				opacity={reduced ? 1 : clamp((time - 17) / 2)}
			/>
		</Readout>
	{/if}
</g>
