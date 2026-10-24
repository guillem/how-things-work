<script lang="ts">
	import { Label } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { glass, samplePosition, type Solute } from '../model';
	let { step, params, t, reduced }: StageProps = $props();
	const substances: Solute[] = ['sugar', 'salt'];
	const waterSamples = Array.from({ length: 28 }, (_, i) => samplePosition(i, 7));
	const samples = Array.from({ length: 80 }, (_, i) => ({
		a: samplePosition(i, 2),
		b: samplePosition(i, 11),
		i
	}));
	let phase = $derived(step.id);
	let spoons = $derived(
		phase === 'spoon'
			? Math.min(20, Number(params.add ?? 0))
			: phase === 'particles'
				? 1
				: phase === 'salt'
					? 2
					: phase === 'full'
						? Number(params.spoons ?? 16)
						: phase === 'dry' || phase === 'next'
							? 10
							: 16
	);
	let temperature = $derived(
		phase === 'warm' ? Number(params.warm ?? 20) : phase === 'cool' ? Number(params.cool ?? 80) : 20
	);
	let evaporated = $derived(phase === 'dry' ? Number(params.dry ?? 0) : phase === 'next' ? 100 : 0);
	let states = $derived(substances.map((s) => glass(s, spoons, temperature, evaporated)));
	let waterTop = $derived(242 + (evaporated / 100) * 266);
	let progress = $derived(reduced ? 1 : Math.min(1, t / 2));
	let caption = $derived(
		phase === 'spoon'
			? 'Tip a spoonful into each glass'
			: phase === 'particles'
				? 'Sugar molecules stay joined as they spread out'
				: phase === 'salt'
					? 'Salt separates into two kinds of charged particle'
					: phase === 'warm'
						? 'Warmer water takes much more sugar, barely more salt'
						: phase === 'cool'
							? 'Cooling lets some dissolved sugar gather back into grains'
							: phase === 'dry' || phase === 'next'
								? 'The water leaves. The sugar and salt stay.'
								: 'At the limit, leaving and joining balance'
	);
</script>

{#snippet sugarParticle(x: number, y: number)}
	<!-- One joined shape stands for an intact sugar molecule, not its atomic geometry. -->
	<path
		d="M{x - 8} {y} a4 4 0 0 1 7 -3 a4 4 0 1 1 4 7 a4 4 0 0 1 -8 1 a4 4 0 0 1 -3 -5"
		fill="var(--ds-sugar)"
		stroke="var(--ds-sugar-edge)"
		stroke-width="1"
	/>
{/snippet}

<g>
	<Label x={480} y={45} size={23} weight={650} text={caption} />
	{#each substances as solute, which (solute)}
		{@const x = which === 0 ? 100 : 540}
		{@const center = x + 160}
		{@const state = states[which]}
		<Label
			x={center}
			y={100}
			size={27}
			weight={650}
			text={solute === 'sugar' ? 'Sugar' : 'Table salt'}
		/>
		<Label
			x={center}
			y={137}
			size={20}
			text={`${temperature} °C · ${spoons} spoonful${spoons === 1 ? '' : 's'}`}
		/>
		<Label
			x={center}
			y={172}
			size={16}
			text={spoons === 0 ? 'plain water' : `${state.added} g added · each spoonful weighs 20 g`}
		/>
		<path
			d="M{x} 204 L{x} 493 Q{x} 515 {x + 22} 515 L{x + 298} 515 Q{x + 320} 515 {x + 320} 493 L{x +
				320} 204"
			fill="var(--ds-glass)"
			stroke="var(--ds-glass-edge)"
			stroke-width="3"
		/>
		{#if state.water > 0}
			<rect
				x={x + 3}
				y={waterTop}
				width="314"
				height={Math.max(0, 508 - waterTop)}
				fill="var(--ds-water)"
				opacity="0.65"
			/>
			<line
				x1={x + 3}
				y1={waterTop}
				x2={x + 317}
				y2={waterTop}
				stroke="var(--ds-water-edge)"
				stroke-width="2"
			/>
			{#each waterSamples as point, i (i)}
				<circle
					cx={x + 16 + point.x * 286 + (reduced ? 0 : 3 * Math.sin(t * 1.4 + i))}
					cy={waterTop +
						7 +
						point.y * Math.max(0, 250 * (1 - evaporated / 100) - 10) +
						(reduced ? 0 : (1 - evaporated / 100) * 3 * Math.cos(t * 1.2 + i))}
					r={3.5 * Math.sqrt(1 - evaporated / 100)}
					fill="var(--ds-water-dot)"
				/>
			{/each}
		{/if}
		{#each samples.slice(0, Math.round(spoons * 4)) as sample (sample.i)}
			{@const i = sample.i}
			{@const fraction = Math.max(0, Math.min(1, (state.dissolved - i * 5) / 5)) * progress}
			{@const solidIndex = Math.max(0, i - Math.floor(state.dissolved / 5))}
			{@const baseX = x + 80 + (solidIndex % 10) * 17}
			{@const baseY = 502 - Math.floor(solidIndex / 10) * 16}
			{@const targetX = x + 20 + sample.a.x * 280 + (reduced ? 0 : Math.sin(t + i * 2) * 5)}
			{@const targetY =
				waterTop +
				12 +
				sample.a.y * Math.max(0, 235 * (1 - evaporated / 100) - 12) +
				(reduced ? 0 : Math.cos(t * 0.9 + i * 3) * 5 * (1 - evaporated / 100))}
			{@const px = baseX + (targetX - baseX) * fraction}
			{@const py = baseY + (targetY - baseY) * fraction}
			{#if solute === 'sugar'}
				{@render sugarParticle(px, py)}
			{:else}
				{@const qx =
					baseX +
					7 +
					(x + 20 + sample.b.x * 280 - baseX - 7) * fraction +
					(reduced ? 0 : 5 * Math.sin(t * 0.8 + i * 4) * fraction)}
				{@const qy =
					baseY +
					(waterTop +
						12 +
						sample.b.y * Math.max(0, 235 * (1 - evaporated / 100) - 12) +
						(reduced ? 0 : 5 * Math.cos(t * 1.1 + i * 2) * (1 - evaporated / 100)) -
						baseY) *
						fraction}
				<circle
					cx={px - (1 - fraction) * 4}
					cy={py}
					r="4.5"
					fill="var(--ds-sodium)"
					stroke="var(--ds-ion-edge)"
					stroke-width="0.7"
				/>
				<circle
					cx={qx}
					cy={qy}
					r="5.5"
					fill="var(--ds-chloride)"
					stroke="var(--ds-ion-edge)"
					stroke-width="0.7"
				/>
			{/if}
		{/each}
		{#if phase === 'full' && state.saturated && state.water > 0}
			<!-- Equal exchange in a saturated mixture; opposite arrows have the same size. -->
			<path
				d="M{x + 30} 477 L{x + 30} 401 m-7 10 l7 -10 l7 10 M{x + 60} 401 L{x +
					60} 477 m-7 -10 l7 10 l7 -10"
				fill="none"
				stroke="var(--ds-exchange)"
				stroke-width="2.5"
			/>
			<circle
				cx={x + 30}
				cy={reduced ? 437 : 477 - ((t % 3) / 3) * 76}
				r="4"
				fill="var(--ds-exchange)"
			/>
			<circle
				cx={x + 60}
				cy={reduced ? 437 : 401 + ((t % 3) / 3) * 76}
				r="4"
				fill="var(--ds-exchange)"
			/>
		{/if}
		{#if phase === 'spoon'}
			<g transform="translate({center - 45},205) rotate(15)">
				<ellipse rx="24" ry="9" fill="var(--ds-spoon)" stroke="var(--stage-line)" />
				<path d="M20 0 L95 0" stroke="var(--ds-spoon)" stroke-width="8" stroke-linecap="round" />
			</g>
		{/if}
		{#if phase === 'dry' && evaporated > 0 && evaporated < 100}
			{#each [0, 1, 2, 3] as i (i)}
				{@const u = reduced ? (i + 0.5) / 4 : (t / 5 + i / 4) % 1}
				<circle
					cx={x + 50 + i * 65}
					cy={waterTop - 15 - u * 45}
					r="4"
					fill="var(--ds-water-dot)"
					opacity={Math.sin(u * Math.PI)}
				/>
			{/each}
		{/if}
		<Readout
			id={solute}
			order={which}
			label={solute === 'sugar' ? 'Sugar' : 'Salt'}
			value={`${Math.round(state.dissolved)} g dissolved · ${Math.round(state.solid)} g in grains`}
		>
			<Label
				x={center}
				y={539}
				size={21}
				weight={600}
				text={`${Math.round(state.dissolved)} g dissolved`}
			/>
			<Label
				x={center}
				y={563}
				size={17}
				text={`${Math.round(state.solid)} g in grains on the bottom`}
			/>
		</Readout>
	{/each}
	{#if phase === 'salt'}
		<Readout
			id="legend"
			order={2}
			label="Salt particles"
			value="Sodium + · chloride −"
			note="Different colours show the two kinds, separate in water."
		>
			<circle cx="423" cy="206" r="7" fill="var(--ds-sodium)" />
			<Label x={443} y={213} size={20} text="+" />
			<circle cx="483" cy="206" r="8" fill="var(--ds-chloride)" />
			<Label x={505} y={213} size={20} text="−" />
		</Readout>
	{:else}
		<Readout
			id="water"
			order={2}
			label="Water remaining in each"
			value={`${Math.round(states[0].water)} of the starting 100 millilitres`}
			note="Magnified samples; picture is not to scale."
		>
			<Label
				x={480}
				y={581}
				size={14}
				text={`${Math.round(states[0].water)} of the starting 100 millilitres of water in each · magnified samples, not to scale`}
			/>
		</Readout>
	{/if}
</g>
