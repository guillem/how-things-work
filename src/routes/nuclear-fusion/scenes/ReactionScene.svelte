<script lang="ts">
	/**
	 * D + T → ⁴He + n on a loop: the two nuclei meet, fuse in a flash, and the products fly
	 * apart with equal and opposite momenta (the neutron, a quarter of the mass, four times as
	 * fast). Below: the mass balance, and the energy per kilogram of three fuels on a log scale.
	 */
	import { Label, clamp, cycle, easeOut, smoothstep } from '#lib/draw/index.ts';
	import { Readout, type StageProps } from '#lib/explainer/index.ts';
	import { DT_MASS_FRACTION, E_ALPHA, E_NEUTRON, Q_DT, atomicMass, energyPerKg } from '../model';
	import { pow10 } from './settings';

	let { t, reduced }: StageProps = $props();

	const PERIOD = 5;
	const CX = 480;
	const CY = 170;
	// Reduced motion: the moment the products have flown apart, so every part is labelled.
	const u = $derived(reduced ? 0.86 : cycle(t, PERIOD, 0.02));
	const approach = $derived(easeOut(clamp(u / 0.34)));
	const flash = $derived(smoothstep(0.32, 0.36, u) * (1 - smoothstep(0.38, 0.58, u)));
	const fly = $derived(clamp((u - 0.36) / 0.6));
	const before = $derived(u < 0.35);
	const fade = $derived(1 - smoothstep(0.93, 1, u));

	// Nucleons: [dx, dy, proton?] round each nucleus centre.
	const R = 9;
	const deut = [
		[-5, 0, true],
		[6, 2, false]
	] as const;
	const trit = [
		[0, -6, true],
		[-6, 5, false],
		[7, 5, false]
	] as const;
	const helium = [
		[-6, -5, true],
		[6, 5, true],
		[6, -5, false],
		[-6, 5, false]
	] as const;

	const dPos = $derived({ x: CX - 260 + 248 * approach, y: CY });
	const tPos = $derived({ x: CX + 260 - 248 * approach, y: CY });
	// Equal and opposite momenta: the neutron moves 4 times as fast as the alpha.
	const heTravel = 95;
	const hePos = $derived({ x: CX - heTravel * fly, y: CY - 0.25 * heTravel * fly });
	const nPos = $derived({ x: CX + 4 * heTravel * fly, y: CY + 0.25 * 4 * heTravel * fly * 0.25 });

	const massBefore = atomicMass('H-2') + atomicMass('H-3');
	const massAfter = atomicMass('He-4') + atomicMass('n');
	const mev = (kev: number) => (kev / 1000).toFixed(1);
	const mev2 = (kev: number) => (kev / 1000).toFixed(2);

	// ---- energy per kilogram -------------------------------------------------------------
	const BX0 = 250;
	const BX1 = 860;
	const E0 = 6;
	const E1 = 15;
	const bx = (j: number) => BX0 + ((Math.log10(j) - E0) / (E1 - E0)) * (BX1 - BX0);
	const grow = $derived(reduced ? 1 : smoothstep(0.4, 2.2, t));
	const tj = (j: number) =>
		j >= 1e12 ? `${Math.round(j / 1e12)} TJ/kg` : `${(j / 1e6).toFixed(0)} MJ/kg`;
	const bars = [
		{ id: 'fusion', label: 'D–T fusion', j: energyPerKg.fusion, color: 'var(--nf-fusion)', y: 400 },
		{
			id: 'fission',
			label: 'uranium-235 fission',
			j: energyPerKg.fission,
			color: 'var(--nf-dd)',
			y: 448
		},
		{
			id: 'methane',
			label: 'burning methane',
			j: energyPerKg.methane,
			color: 'var(--stage-ink-muted)',
			y: 496
		}
	];
</script>

{#snippet nucleus(cx: number, cy: number, parts: readonly (readonly [number, number, boolean])[])}
	{#each parts as p, i (i)}
		<circle
			cx={cx + p[0]}
			cy={cy + p[1]}
			r={R}
			fill={p[2] ? 'var(--nf-proton)' : 'var(--nf-neutron)'}
			stroke="var(--stage-bg)"
			stroke-width="1.2"
		/>
	{/each}
{/snippet}

<g>
	<Readout id="equation" order={1} label="Reaction" value="²H + ³H → ⁴He + n + 17.6 MeV">
		<Label x={CX} y={44} text="²H + ³H  →  ⁴He + n  +  17.6 MeV" size={16} weight={600} />
	</Readout>
	<Readout id="key">
		<g transform="translate(36 70)">
			<circle cx="8" cy="0" r="7" fill="var(--nf-proton)" />
			<text x="22" y="4" font-size="12">proton</text>
			<circle cx="88" cy="0" r="7" fill="var(--nf-neutron)" />
			<text x="102" y="4" font-size="12">neutron</text>
		</g>
	</Readout>

	<g opacity={fade}>
		{#if before}
			{@render nucleus(dPos.x, dPos.y, deut)}
			{@render nucleus(tPos.x, tPos.y, trit)}
			<Readout id="d">
				<Label
					x={dPos.x}
					y={CY + 34}
					text="deuterium"
					size={12}
					opacity={1 - smoothstep(0.2, 0.32, u)}
				/>
			</Readout>
			<Readout id="t">
				<Label
					x={tPos.x}
					y={CY + 34}
					text="tritium"
					size={12}
					opacity={1 - smoothstep(0.2, 0.32, u)}
				/>
			</Readout>
		{:else}
			<line
				x1={CX}
				y1={CY}
				x2={hePos.x}
				y2={hePos.y}
				stroke="var(--nf-alpha)"
				stroke-width="2"
				opacity={0.5 * smoothstep(0.4, 0.5, u)}
			/>
			<line
				x1={CX}
				y1={CY}
				x2={nPos.x}
				y2={nPos.y}
				stroke="var(--nf-neutron)"
				stroke-width="2"
				opacity={0.5 * smoothstep(0.4, 0.5, u)}
			/>
			{@render nucleus(hePos.x, hePos.y, helium)}
			<circle
				cx={nPos.x}
				cy={nPos.y}
				r={R}
				fill="var(--nf-neutron)"
				stroke="var(--stage-bg)"
				stroke-width="1.2"
			/>
			<g opacity={smoothstep(0.45, 0.6, u)}>
				<Readout
					id="alpha"
					order={2}
					label="Alpha (⁴He)"
					value="{mev2(E_ALPHA)} MeV"
					color="var(--nf-alpha)"
				>
					<Label
						x={hePos.x}
						y={hePos.y - 26}
						text="helium-4 · {mev2(E_ALPHA)} MeV"
						size={13}
						color="var(--nf-alpha)"
						weight={600}
					/>
				</Readout>
				<Readout id="neutron" order={3} label="Neutron" value="{mev2(E_NEUTRON)} MeV">
					<Label
						x={nPos.x}
						y={nPos.y + 28}
						text="neutron · {mev2(E_NEUTRON)} MeV"
						size={13}
						weight={600}
					/>
				</Readout>
			</g>
		{/if}
	</g>
	<circle
		cx={CX}
		cy={CY}
		r={10 + 50 * flash}
		fill="var(--nf-fusion)"
		opacity={0.75 * flash}
		filter="url(#glow)"
	/>

	<!-- mass balance -->
	<Readout
		id="mass"
		order={4}
		label="Mass"
		value="{massBefore.toFixed(4)} u → {massAfter.toFixed(4)} u: {(100 * DT_MASS_FRACTION).toFixed(
			2
		)}% becomes {mev(Q_DT)} MeV"
	>
		<Label
			x={CX}
			y={300}
			text="mass before {massBefore.toFixed(4)} u  →  after {massAfter.toFixed(4)} u:  {(
				100 * DT_MASS_FRACTION
			).toFixed(2)}% of it becomes energy"
			size={13}
			muted
		/>
	</Readout>

	<!-- energy per kilogram -->
	<Label
		x={BX0 - 220}
		y={360}
		text="Energy per kilogram of fuel"
		anchor="start"
		size={14}
		weight={600}
	/>
	{#each [6, 9, 12, 15] as e (e)}
		<line x1={bx(10 ** e)} x2={bx(10 ** e)} y1={378} y2={516} stroke="var(--stage-grid)" />
		<text x={bx(10 ** e)} y={536} text-anchor="middle" font-size="11" class="muted"
			>{pow10(e)} J</text
		>
	{/each}
	{#each bars as b (b.id)}
		{@const w = (bx(b.j) - BX0) * grow}
		<Readout id="kg-{b.id}" order={5 + b.y} label={b.label} value={tj(b.j)} color={b.color}>
			<text x={BX0 - 12} y={b.y + 5} text-anchor="end" font-size="13">{b.label}</text>
			<rect
				x={BX0}
				y={b.y - 13}
				width={Math.max(0, w)}
				height="26"
				rx="4"
				fill={b.color}
				opacity="0.85"
			/>
			<text
				x={BX0 + w + 8}
				y={b.y + 5}
				font-size="13"
				font-weight="600"
				opacity={smoothstep(0.85, 1, grow)}>{tj(b.j)}</text
			>
		</Readout>
	{/each}
	<Readout id="scale">
		<Label
			x={BX1}
			y={562}
			text="each grid line is 1,000 times the one before"
			anchor="end"
			size={11}
			muted
		/>
	</Readout>
</g>
