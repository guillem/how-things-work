<script lang="ts">
	/**
	 * How long particles live, grouped by the force that makes them decay: PDG mean lives on a
	 * logarithmic time axis (10⁻²⁴ s to 10⁴ s), bars coloured by force, growing in at the start
	 * of the step. Below, why the weak force is slow: the W's mass against the energy a
	 * neutron's decay has, and the reach ħ/(M_W c) that follows.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { smoothstep } from '#lib/draw/index.ts';
	import {
		hadrons,
		lifeText,
		massText,
		neutronQ,
		particle,
		reach,
		sci,
		type Force,
		type Quantity
	} from '../particles';
	import { forceColour, FORCE_NAME } from './shared';
	import T from './T.svelte';
	import Card from './Card.svelte';

	let { t, reduced }: StageProps = $props();

	const h = (name: string) => {
		const x = hadrons.find((q) => q.name === name);
		if (!x?.life) throw new Error(`no lifetime for ${name}`);
		return x.life;
	};
	const ROWS: { id: string; who: string; decay: string; force: Force; life: Quantity }[] = [
		{ id: 'delta', who: 'Δ⁺⁺', decay: '→ p π⁺', force: 'strong', life: h('Δ⁺⁺') },
		{ id: 'phi', who: 'φ', decay: '→ K⁺ K⁻', force: 'strong', life: h('φ') },
		{ id: 'sigma0', who: 'Σ⁰', decay: '→ Λ⁰ γ', force: 'em', life: h('Σ⁰') },
		{ id: 'pi0', who: 'π⁰', decay: '→ γ γ', force: 'em', life: h('π⁰') },
		{ id: 'lambda', who: 'Λ⁰', decay: '→ p π⁻', force: 'weak', life: h('Λ⁰') },
		{ id: 'pi', who: 'π⁺', decay: '→ μ⁺ νμ', force: 'weak', life: h('π⁺') },
		{
			id: 'mu',
			who: 'μ⁻',
			decay: '→ e⁻ ν̄e νμ',
			force: 'weak',
			life: particle('mu').life ?? h('π⁺')
		},
		{ id: 'n', who: 'n', decay: '→ p e⁻ ν̄e', force: 'weak', life: h('neutron') }
	];

	const LO = -24;
	const HI = 4;
	const AX0 = 210;
	const AX1 = 900;
	const xOf = (s: number) => AX0 + ((Math.log10(s) - LO) / (HI - LO)) * (AX1 - AX0);
	const rowY = (i: number) => 92 + i * 44;
	const TICKS = [-24, -20, -16, -12, -8, -4, 0, 4];
	const MARKS = [
		{ s: 1e-9, label: '1 ns' },
		{ s: 1, label: '1 s' },
		{ s: 3600, label: '1 hour' }
	];
	const sup = (n: number) =>
		String(n)
			.replace('-', '⁻')
			.replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]);

	const grow = (i: number) => (reduced ? 1 : smoothstep(0.2 + i * 0.12, 1.4 + i * 0.12, t));
	const pulse = $derived(reduced ? 0 : 0.5 + 0.5 * Math.sin(t * 3));

	const wMass = particle('W').mass?.v ?? 0;
	const q = neutronQ();
	const ratio = Number((wMass / q).toPrecision(2)).toLocaleString('en-US');
	const lifeShort = (l: Quantity) => {
		const s = lifeText(l);
		return l.estimate ? `${s} (est.)` : s;
	};
</script>

<g>
	<Readout id="title">
		<T
			x={24}
			y={34}
			text="How long they live, and which force makes them decay"
			size={15}
			weight={700}
		/>
	</Readout>

	<!-- axis -->
	{#each TICKS as e (e)}
		<line
			x1={xOf(10 ** e)}
			x2={xOf(10 ** e)}
			y1={70}
			y2={rowY(ROWS.length - 1) + 18}
			stroke="var(--stage-grid)"
		/>
		<Readout id="tick{e}">
			{#snippet narrow()}
				{#if e % 8 === 0}
					<T
						x={xOf(10 ** e)}
						y={rowY(ROWS.length - 1) + 48}
						text="10{sup(e)} s"
						anchor="middle"
						size={28}
						muted
					/>
				{/if}
			{/snippet}
			<T
				x={xOf(10 ** e)}
				y={rowY(ROWS.length - 1) + 36}
				text="10{sup(e)} s"
				anchor="middle"
				size={11}
				muted
			/>
		</Readout>
	{/each}
	{#each MARKS as m (m.label)}
		<line
			x1={xOf(m.s)}
			x2={xOf(m.s)}
			y1={70}
			y2={rowY(ROWS.length - 1) + 18}
			stroke="var(--stage-ink-muted)"
			stroke-dasharray="2 4"
		/>
		<Readout id="mark-{m.label}">
			<T x={xOf(m.s)} y={64} text={m.label} anchor="middle" size={11} muted />
		</Readout>
	{/each}

	<!-- rows -->
	{#each ROWS as r, i (r.id)}
		{@const y = rowY(i)}
		{@const x = xOf(r.life.v)}
		{@const g = grow(i)}
		{@const col = forceColour(r.force)}
		<rect
			x={AX0}
			y={y - 7}
			width={Math.max(0, (x - AX0) * g)}
			height="14"
			rx="7"
			fill={col}
			opacity="0.75"
		/>
		<circle
			cx={AX0 + (x - AX0) * g}
			cy={y}
			r={6 + (i === ROWS.length - 1 ? 2 * pulse : 0)}
			fill={col}
		/>
		<Readout id="row-{r.id}">
			{#snippet narrow()}
				<T x={AX0 - 14} y={y + 12} text={r.who} size={34} weight={700} color={col} anchor="end" />
			{/snippet}
			<T x={24} y={y + 5} text={r.who} size={15} weight={700} color={col} />
			<T x={62} y={y + 5} text={r.decay} size={12.5} />
			<T
				x={x > 760 ? x : x + 14}
				y={x > 760 ? y - 13 : y + 4}
				text={lifeShort(r.life)}
				anchor={x > 760 ? 'middle' : 'start'}
				size={12}
				weight={600}
				opacity={g}
			/>
		</Readout>
	{/each}

	<!-- force key -->
	<Readout id="key">
		{#each ['strong', 'em', 'weak'] as f, i (f)}
			<rect
				x={AX0 + i * 150}
				y={rowY(ROWS.length - 1) + 50}
				width="14"
				height="14"
				rx="3"
				fill={forceColour(f as Force)}
			/>
			<T
				x={AX0 + 20 + i * 150}
				y={rowY(ROWS.length - 1) + 62}
				text={FORCE_NAME[f as Force]}
				size={12}
			/>
		{/each}
	</Readout>

	<!-- why weak is slow -->
	<Card x={20} y={486} w={920} h={98} />
	<Readout
		id="w-mass"
		order={10}
		label="W boson"
		value="{massText(wMass)}, against {q.toFixed(2)} MeV in a neutron's decay: virtual"
	>
		<T
			x={40}
			y={514}
			text="The W weighs {massText(wMass)}; a neutron's decay has {q.toFixed(
				2
			)} MeV to spend, about {ratio} times less:"
			size={13.5}
			weight={600}
		/>
		<T
			x={40}
			y={536}
			text="the W can only be virtual. A carrier of mass M reaches only about ħ/(Mc):"
			size={13.5}
		/>
	</Readout>
	<Readout
		id="w-reach"
		order={11}
		label="Reach of the weak force"
		value="≈ {sci(reach(wMass), 2)} m"
	>
		<T
			x={40}
			y={560}
			text="for the W, {sci(reach(wMass), 2)} m, a few hundred times less than a proton's radius."
			size={13.5}
			color="var(--sm-weak)"
			weight={600}
		/>
	</Readout>
</g>
