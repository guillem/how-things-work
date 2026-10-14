<script lang="ts">
	/**
	 * The 17 particles of the Standard Model in the usual layout: three generations of quarks
	 * and leptons (columns I–III), the four force carriers, and the Higgs.
	 *
	 * Views (`step.hints.view`):
	 *   browse — tap a cell (or Tab + Enter) to see its PDG mass, charge, spin and lifetime in
	 *            the card; the choice is kept in `params['sm:pick']`. Generation I is outlined:
	 *            the particles of ordinary matter.
	 *   forces — the `force` control picks a force: the particles that feel it stay bright, the
	 *            rest dim, its carrier is ringed in the force's colour, and the card gives the
	 *            carrier and its reach. "All four" rings every carrier and lists the forces,
	 *            gravity with no carrier.
	 */
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { Tween } from 'svelte/motion';
	import { cubicInOut } from 'svelte/easing';
	import { untrack } from 'svelte';
	import {
		PARTICLES,
		lifeText,
		massText,
		neutrinoMassLimit,
		particle,
		reach,
		sci,
		thirds,
		type Force,
		type Fundamental
	} from '../particles';
	import { familyColour, forceColour, FORCE_NAME } from './shared';
	import T from './T.svelte';
	import Card from './Card.svelte';

	let { step, params, setParam, reduced }: StageProps = $props();

	const view = $derived(step.hints?.view === 'forces' ? 'forces' : 'browse');
	const forceSel = $derived(String(params.force ?? 'all') as Force | 'gravity' | 'all');
	const pick = $derived(String(params['sm:pick'] ?? 'u'));

	// ---- layout ------------------------------------------------------------------------
	const W = 110;
	const H = 102;
	const COLX = [60, 178, 296, 430, 548];
	const ROWY = [74, 184, 294, 404];
	const LAYOUT: Record<string, [number, number]> = {
		u: [0, 0],
		c: [1, 0],
		t: [2, 0],
		d: [0, 1],
		s: [1, 1],
		b: [2, 1],
		e: [0, 2],
		mu: [1, 2],
		tau: [2, 2],
		nue: [0, 3],
		numu: [1, 3],
		nutau: [2, 3],
		g: [3, 0],
		gamma: [3, 1],
		Z: [3, 2],
		W: [3, 3],
		H: [4, 0]
	};
	const cells = PARTICLES.map((p) => {
		const [c, r] = LAYOUT[p.key];
		return { p, x: COLX[c], y: ROWY[r] };
	});

	const neutrino = (p: Fundamental) => p.key.startsWith('nu');
	function massLine(p: Fundamental): string {
		if (neutrino(p)) return `< ${massText(neutrinoMassLimit.v)}`;
		if (p.key === 'g') return '0';
		if (p.key === 'gamma') return '0';
		return p.mass ? massText(p.mass.v) : '—';
	}
	const spinText = (s: string) => s.replace('1/2', '½');

	// ---- focus per view ---------------------------------------------------------------------
	const feels = (p: Fundamental, f: Force | 'gravity' | 'all') =>
		f === 'all' || f === 'gravity' ? true : p.feels.includes(f) || p.carries === f;
	const dimT = new Map(
		PARTICLES.map((p) => [p.key, new Tween(1, { duration: 600, easing: cubicInOut })])
	);
	$effect(() => {
		const v = view;
		const f = forceSel;
		untrack(() => {
			for (const p of PARTICLES) {
				const on = v === 'browse' || feels(p, f);
				dimT.get(p.key)?.set(on ? 1 : 0.35, { duration: reduced ? 0 : 600 });
			}
		});
	});
	const opacityOf = (key: string) => dimT.get(key)?.current ?? 1;
	const ringed = (p: Fundamental) =>
		view === 'forces' && p.carries && (forceSel === 'all' || forceSel === p.carries);

	// ---- the card ----------------------------------------------------------------------
	const sel = $derived(PARTICLES.find((p) => p.key === pick) ?? PARTICLES[0]);
	const GEN = ['', 'I', 'II', 'III'];
	const famLine = $derived(
		sel.family === 'quark' || sel.family === 'lepton'
			? `${sel.family} · generation ${GEN[sel.generation ?? 1]}`
			: sel.family === 'gauge'
				? `force carrier (${FORCE_NAME[sel.carries ?? 'em']})`
				: 'scalar boson'
	);
	const massCard = $derived.by(() => {
		const p = sel;
		if (neutrino(p)) return `below ${massText(neutrinoMassLimit.v)}, not yet measured`;
		if (p.key === 'g') return '0 (in theory)';
		if (p.key === 'gamma') return `0 (measured: below ${sci((p.mass?.v ?? 0) * 1e6, 0)} eV)`;
		if (!p.mass) return '—';
		return massText(p.mass.v);
	});
	const lifeCard = $derived.by(() => {
		const p = sel;
		if (p.family === 'quark' && p.key !== 't') return 'never free: always bound in hadrons';
		if (p.key === 't') return `${lifeText(p.life)}, too short to bind`;
		if (p.key === 'e') return `stable (${lifeText(p.life)})`;
		if (neutrino(p) || p.key === 'g' || p.key === 'gamma') return 'stable';
		return lifeText(p.life);
	});
	const feelsCard = $derived(
		sel.feels.length
			? sel.feels.map((f) => FORCE_NAME[f]).join(', ')
			: 'none of the three (it has no charge)'
	);

	// ---- forces card ---------------------------------------------------------------------
	const wMass = particle('W').mass?.v ?? 0;
	const zMass = particle('Z').mass?.v ?? 0;
	const FORCES: {
		id: Force | 'gravity';
		carrier: string;
		short: string;
		reach: string;
		felt: string;
	}[] = [
		{
			id: 'strong',
			short: 'gluon g',
			carrier: 'gluon g (massless)',
			reach: 'held inside hadrons, about 10⁻¹⁵ m',
			felt: 'quarks and gluons'
		},
		{
			id: 'em',
			short: 'photon γ',
			carrier: 'photon γ (massless)',
			reach: 'unlimited',
			felt: 'everything with charge'
		},
		{
			id: 'weak',
			short: 'W± and Z⁰',
			carrier: `W± (${massText(wMass)}), Z⁰ (${massText(zMass)})`,
			reach: `about ${sci(reach(wMass), 2)} m`,
			felt: 'every quark and lepton'
		},
		{
			id: 'gravity',
			short: 'none',
			carrier: 'none in the Standard Model',
			reach: 'unlimited (general relativity)',
			felt: 'everything with energy'
		}
	];
	const fsel = $derived(FORCES.find((f) => f.id === forceSel));

	const CX = 700;
	const select = (key: string) => setParam('sm:pick', key);
</script>

<g>
	<!-- headers -->
	<Readout id="headers">
		{#each ['I', 'II', 'III'] as g, i (g)}
			<T x={COLX[i] + W / 2} y={60} text={g} anchor="middle" size={13} weight={700} muted />
		{/each}
		<T x={COLX[3] + W / 2} y={60} text="carriers" anchor="middle" size={12} muted />
		<T x={COLX[4] + W / 2} y={60} text="Higgs" anchor="middle" size={12} muted />
		<T x={COLX[1] + W / 2} y={36} text="generations of matter" anchor="middle" size={12} muted />
		<g transform="rotate(-90 36 {(ROWY[0] + ROWY[1] + H) / 2})">
			<T x={36} y={(ROWY[0] + ROWY[1] + H) / 2} text="quarks" anchor="middle" size={12} muted />
		</g>
		<g transform="rotate(-90 36 {(ROWY[2] + ROWY[3] + H) / 2})">
			<T x={36} y={(ROWY[2] + ROWY[3] + H) / 2} text="leptons" anchor="middle" size={12} muted />
		</g>
	</Readout>

	<!-- generation I: ordinary matter -->
	{#if view === 'browse' || forceSel === 'all'}
		<rect
			x={COLX[0] - 7}
			y={ROWY[0] - 7}
			width={W + 14}
			height={ROWY[3] + H - ROWY[0] + 14}
			rx="16"
			fill="none"
			stroke="var(--explainer-accent)"
			stroke-width="2"
			stroke-dasharray="6 5"
		/>
		<Readout
			id="ordinary"
			order={9}
			label="Generation I"
			value="u, d and e make all ordinary matter"
		>
			<T
				x={COLX[0] + W / 2}
				y={ROWY[3] + H + 26}
				text="ordinary matter:"
				anchor="middle"
				size={12}
				weight={600}
				color="var(--explainer-accent)"
			/>
			<T
				x={COLX[0] + W / 2}
				y={ROWY[3] + H + 42}
				text="u, d, e"
				anchor="middle"
				size={12}
				weight={600}
				color="var(--explainer-accent)"
			/>
		</Readout>
	{/if}

	<!-- cells -->
	{#snippet cellBody(c: (typeof cells)[number])}
		{@const p = c.p}
		{@const col = familyColour(p.family)}
		{@const on = view === 'browse' && p.key === pick}
		{#if ringed(p)}
			<rect
				x={c.x - 6}
				y={c.y - 6}
				width={W + 12}
				height={H + 12}
				rx="16"
				fill="none"
				stroke={forceColour(p.carries ?? 'em')}
				stroke-width="4"
			/>
		{/if}
		<rect class="ring" x={c.x - 5} y={c.y - 5} width={W + 10} height={H + 10} rx="15" />
		<rect
			x={c.x}
			y={c.y}
			width={W}
			height={H}
			rx="12"
			fill="var(--surface)"
			stroke={col}
			stroke-width={on ? 3.5 : 1.5}
		/>
		<rect x={c.x} y={c.y} width={W} height={H} rx="12" fill={col} opacity={on ? 0.22 : 0.1} />
		<text x={c.x + 9} y={c.y + 18} style:font-size="11px" class="muted">{thirds(p.charge3)}</text>
		<text x={c.x + W - 9} y={c.y + 18} text-anchor="end" style:font-size="11px" class="muted"
			>{spinText(p.spin)}</text
		>
		<text
			x={c.x + W / 2}
			y={c.y + 52}
			text-anchor="middle"
			font-weight="700"
			style:font-size="28px"
			style:fill={col}>{p.symbol}</text
		>
		<text x={c.x + W / 2} y={c.y + 72} text-anchor="middle" style:font-size="11.5px">{p.name}</text>
		<text x={c.x + W / 2} y={c.y + 90} text-anchor="middle" style:font-size="11px" class="muted"
			>{massLine(p)}</text
		>
	{/snippet}
	{#each cells as c (c.p.key)}
		{#if view === 'browse'}
			<g
				class="cell clickable"
				opacity={opacityOf(c.p.key)}
				role="button"
				tabindex="0"
				aria-label="{c.p.name}: show details"
				onclick={() => select(c.p.key)}
				onkeydown={(e) => {
					if (e.key !== 'Enter' && e.key !== ' ') return;
					e.preventDefault();
					e.stopPropagation();
					select(c.p.key);
				}}
			>
				{@render cellBody(c)}
			</g>
		{:else}
			<g class="cell" opacity={opacityOf(c.p.key)}>{@render cellBody(c)}</g>
		{/if}
	{/each}
	<Readout id="key">
		<T x={COLX[3]} y={ROWY[3] + H + 26} text="corners: charge (e), spin" size={11} muted />
		<T x={COLX[3]} y={ROWY[3] + H + 42} text="masses: PDG 2026" size={11} muted />
	</Readout>

	<!-- card -->
	<Readout id="card-1"><Card x={CX - 16} y={24} w={256} h={560} /></Readout>
	{#if view === 'browse'}
		<Readout
			id="p-name"
			order={1}
			label={sel.name}
			value={sel.symbol}
			note={famLine}
			color={familyColour(sel.family)}
		>
			<T x={CX} y={70} text={sel.symbol} size={40} weight={700} color={familyColour(sel.family)} />
			<T x={CX} y={100} text={sel.name} size={17} weight={700} />
			<T x={CX} y={120} text={famLine} size={12} muted />
		</Readout>
		<T x={CX} y={160} text="Mass" size={12} muted />
		<Readout id="p-mass" order={2} label="Mass" value={massCard}>
			<T x={CX} y={180} text={massCard} size={massCard.length > 26 ? 12 : 15} weight={600} />
		</Readout>
		<T x={CX} y={218} text="Charge · spin" size={12} muted />
		<Readout
			id="p-charge"
			order={3}
			label="Charge, spin"
			value="{thirds(sel.charge3)} e, spin {spinText(sel.spin)}"
		>
			<T
				x={CX}
				y={238}
				text="{thirds(sel.charge3)} e · spin {spinText(sel.spin)}"
				size={15}
				weight={600}
			/>
		</Readout>
		<T x={CX} y={276} text="Lifetime" size={12} muted />
		<Readout id="p-life" order={4} label="Lifetime" value={lifeCard}>
			<T x={CX} y={296} text={lifeCard} size={lifeCard.length > 26 ? 12 : 15} weight={600} />
		</Readout>
		<T x={CX} y={334} text="Feels the forces" size={12} muted />
		<Readout id="p-feels">
			<T x={CX} y={354} text={feelsCard} size={12.5} />
			{#if sel.carries}
				<T
					x={CX}
					y={376}
					text="carries the {FORCE_NAME[sel.carries]} force"
					size={12.5}
					weight={600}
					color={forceColour(sel.carries)}
				/>
			{/if}
		</Readout>
		<Readout id="p-anti">
			<T
				x={CX}
				y={420}
				text={sel.family === 'gauge' || sel.family === 'scalar'
					? sel.key === 'W'
						? 'W⁺ and W⁻ are each other’s'
						: 'its own antiparticle'
					: `antiparticle: opposite charge`}
				size={12}
				muted
			/>
			{#if sel.key === 'W'}<T x={CX} y={437} text="antiparticles" size={12} muted />{/if}
			<T x={CX} y={550} text="Tap any particle." size={12} muted />
			<T x={CX} y={568} text="Data: PDG 2026" size={11} muted />
		</Readout>
	{:else}
		{#if fsel}
			<Readout
				id="f-name"
				order={1}
				label="Force"
				value={FORCE_NAME[fsel.id]}
				color={forceColour(fsel.id)}
			>
				<T
					x={CX}
					y={70}
					text={FORCE_NAME[fsel.id]}
					size={22}
					weight={700}
					color={forceColour(fsel.id)}
				/>
			</Readout>
			<T x={CX} y={110} text="Carried by" size={12} muted />
			<Readout id="f-carrier" order={2} label="Carried by" value={fsel.carrier}>
				<T
					x={CX}
					y={130}
					text={fsel.carrier}
					size={fsel.carrier.length > 24 ? 12 : 14}
					weight={600}
				/>
			</Readout>
			<T x={CX} y={168} text="Reach" size={12} muted />
			<Readout id="f-reach" order={3} label="Reach" value={fsel.reach}>
				<T x={CX} y={188} text={fsel.reach} size={13} weight={600} />
			</Readout>
			<T x={CX} y={226} text="Felt by" size={12} muted />
			<Readout id="f-felt" order={4} label="Felt by" value={fsel.felt}>
				<T x={CX} y={246} text={fsel.felt} size={13} weight={600} />
			</Readout>
			{#if fsel.id === 'gravity'}
				<Readout id="f-grav">
					<T x={CX} y={290} text="The Standard Model has no" size={12.5} />
					<T x={CX} y={307} text="particle for gravity. A graviton" size={12.5} />
					<T x={CX} y={324} text="is a hypothesis, not part of it." size={12.5} />
				</Readout>
			{/if}
		{:else}
			<T x={CX} y={62} text="Four forces" size={18} weight={700} />
			{#each FORCES as f, i (f.id)}
				{@const y = 102 + i * 108}
				<rect x={CX} y={y - 14} width="5" height="78" rx="2.5" fill={forceColour(f.id)} />
				<Readout
					id="f-{f.id}"
					order={1 + i}
					label={FORCE_NAME[f.id]}
					value={f.carrier}
					color={forceColour(f.id)}
				>
					<T
						x={CX + 16}
						{y}
						text={FORCE_NAME[f.id]}
						size={15}
						weight={700}
						color={forceColour(f.id)}
					/>
					<T
						x={CX + 16}
						y={y + 21}
						text={f.id === 'gravity' ? 'no carrier in the' : `carrier: ${f.short}`}
						size={12.5}
						weight={f.id === 'gravity' ? 700 : 500}
					/>
					{#if f.id === 'gravity'}<T
							x={CX + 16}
							y={y + 38}
							text="Standard Model"
							size={12.5}
							weight={700}
						/>{/if}
					<T
						x={CX + 16}
						y={y + (f.id === 'gravity' ? 55 : 40)}
						text="felt by {f.felt}"
						size={11.5}
						muted
					/>
				</Readout>
			{/each}
			<Readout id="f-take">
				<T x={CX} y={545} text="Three of the four forces come" size={12} weight={600} />
				<T x={CX} y={562} text="from exchanging particles." size={12} weight={600} />
			</Readout>
		{/if}
	{/if}
</g>

<style>
	.cell {
		outline: none;
	}
	.cell.clickable {
		cursor: pointer;
	}
	.cell .ring {
		fill: none;
		stroke: var(--focus);
		stroke-width: 3;
		opacity: 0;
	}
	.cell:focus-visible .ring {
		opacity: 1;
	}
</style>
